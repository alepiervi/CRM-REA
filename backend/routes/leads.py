"""Route: CRUD Lead + webhook ricezione lead — estratte da server.py (refactoring fase 3, giugno 2026)."""
import asyncio
import io
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Dict, Any

from fastapi import (
    APIRouter, HTTPException, Depends, Query, Body, Request,
    UploadFile, File, Form, status,
)
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse, Response

from database import db
from security import (
    get_current_user, get_password_hash, verify_password, create_access_token,
    pwd_context, ACCESS_TOKEN_EXPIRE_MINUTES,
    get_user_commessa_authorizations, check_commessa_access, get_user_accessible_commesse,
    get_user_accessible_sub_agenzie, can_user_access_cliente, can_user_access_cliente_notes,
    can_user_delete_cliente, can_user_modify_cliente, can_user_access_document,
    get_user_accessible_documents,
)
from helpers import (
    ITALIAN_PROVINCES, PROVINCE_TO_CODE, normalize_province_name, provincia_matches,
    MAX_UNWORKED_LEADS_PER_AGENT, assign_lead_to_agent,
    parse_uploaded_file, validate_cliente_data, process_import_batch,
    create_excel_report, create_clienti_excel_report,
    get_user_ip, detect_client_changes, _expand_segmento_filter_values,
)
from services import (
    UPLOAD_DIR, MAX_FILE_SIZE, ALLOWED_FILE_TYPES,
    aruba_service, validate_uploaded_file, save_temporary_file, create_document_record,
)
from notifications import notify_agent_new_lead, send_email_notification
from audit import log_client_action
from workflow_executor import WorkflowExecutor
from models import *  # noqa: F401,F403
from services import lead_qualification_bot

async def trigger_workflows_for_lead(lead_dict, trigger_subtype="lead_created"):
    """Proxy lazy verso server.trigger_workflows_for_lead (evita import circolare)."""
    import sys
    fn = getattr(sys.modules.get("server"), "trigger_workflows_for_lead", None)
    if fn is None:
        return None
    return await fn(lead_dict, trigger_subtype=trigger_subtype)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/leads", response_model=Lead)
async def create_lead(lead_data: LeadCreate):
    """Create lead - accessible via webhook with automatic qualification"""
    # Validate province
    if lead_data.provincia not in ITALIAN_PROVINCES:
        raise HTTPException(status_code=400, detail="Invalid province")
    
    lead_obj = Lead(**lead_data.dict())
    await db.leads.insert_one(lead_obj.dict())
    
    # Check if qualification should be started based on commessa settings
    should_start_qualification = False
    
    try:
        # Find the commessa associated with this lead
        commessa = None
        if lead_obj.campagna:
            commessa = await db.commesse.find_one({"nome": lead_obj.campagna})
        elif lead_obj.gruppo:
            # Fallback: try to find by gruppo field if campagna is not set
            commessa = await db.commesse.find_one({"nome": lead_obj.gruppo})
        
        if commessa:
            # Check if AI (bot) is enabled for this commessa
            should_start_qualification = commessa.get("has_ai", False)
            logging.info(f"Found commessa '{commessa.get('nome')}' for lead {lead_obj.id}. has_ai: {should_start_qualification}")
        else:
            logging.warning(f"No commessa found for lead {lead_obj.id} (campagna: {lead_obj.campagna}, gruppo: {lead_obj.gruppo})")
            # Default behavior if no commessa found: no qualification (immediate assignment)
            should_start_qualification = False
            
    except Exception as e:
        logging.error(f"Error checking commessa AI settings for lead {lead_obj.id}: {e}")
        # Default behavior on error: no qualification (immediate assignment)
        should_start_qualification = False
    
    # PRIORITY CHECK: First check if Unit has auto_assign disabled
    # If disabled, assign directly to referente/agent REGARDLESS of AI qualification
    if lead_obj.unit_id:
        unit = await db.units.find_one({"id": lead_obj.unit_id})
        if unit and not unit.get("auto_assign_enabled", True):
            # Auto-assignment disabled - assign directly to referente or agent in this Unit
            logging.info(f"[CREATE-LEAD] Unit {lead_obj.unit_id} has auto_assign disabled. Looking for referente or agent...")
            
            # First try to find a referente for this unit
            assignee = await db.users.find_one({
                "$or": [
                    {"unit_id": lead_obj.unit_id},
                    {"unit_autorizzate": lead_obj.unit_id}
                ],
                "role": "referente",
                "is_active": True
            })
            
            # If no referente found, try to find an agent
            if not assignee:
                assignee = await db.users.find_one({
                    "$or": [
                        {"unit_id": lead_obj.unit_id},
                        {"unit_autorizzate": lead_obj.unit_id}
                    ],
                    "role": "agente",
                    "is_active": True
                })
            
            if assignee:
                assignee_id = assignee["id"]
                assignee_name = assignee.get("username", "unknown")
                assignee_role = assignee.get("role", "unknown")
                current_esito = lead_obj.esito or "Nuovo"
                
                # Update lead with assignment
                await db.leads.update_one(
                    {"id": lead_obj.id},
                    {
                        "$set": {
                            "assigned_agent_id": assignee_id,
                            "assigned_at": datetime.now(timezone.utc),
                            "esito_at_assignment": current_esito
                        }
                    }
                )
                
                # Update local object for return
                lead_obj.assigned_agent_id = assignee_id
                lead_obj.assigned_at = datetime.now(timezone.utc)
                
                logging.info(f"[CREATE-LEAD] Lead {lead_obj.id} assigned to {assignee_role} {assignee_name} ({assignee_id}) for unit {unit.get('nome')} (auto_assign disabled)")
                
                # Send email notification
                asyncio.create_task(notify_agent_new_lead(assignee_id, lead_obj.dict()))
            else:
                logging.warning(f"[CREATE-LEAD] No referente or agent found for unit {lead_obj.unit_id}. Lead {lead_obj.id} will remain unassigned.")
            
            # Trigger Spoki welcome message + Workflows V2 (fire-and-forget)
            try:
                asyncio.create_task(trigger_workflows_for_lead(lead_obj.dict(), "lead_created"))
            except Exception as _se:
                logging.warning(f"[SPOKI/WF] trigger failed: {_se}")

            # Return early - skip qualification for units with auto_assign disabled
            return lead_obj
    
    # For units WITH auto_assign enabled: Start qualification or leave unassigned
    if should_start_qualification:
        try:
            # Start qualification process
            await lead_qualification_bot.start_qualification_process(lead_obj.id)
            
            logging.info(f"Started automatic qualification for new lead {lead_obj.id} (commessa has AI enabled)")
            
        except Exception as e:
            logging.error(f"Error starting qualification for new lead {lead_obj.id}: {e}")
            # NON assegnare qui - l'assegnazione avviene solo quando lo status cambia a "Lead Interessato"
            logging.info(f"Lead {lead_obj.id} remains unassigned until status changes to 'Lead Interessato'")
    else:
        # Unit has auto_assign enabled but no AI - lead remains unassigned until status changes
        logging.info(f"Lead {lead_obj.id} created with status 'Nuovo' - will be assigned when status changes to 'Lead Interessato'")

    # Trigger Spoki welcome message + Workflows V2 (fire-and-forget) — vale per tutti i flussi che cadono qui
    try:
        asyncio.create_task(trigger_workflows_for_lead(lead_obj.dict(), "lead_created"))
    except Exception as _se:
        logging.warning(f"[SPOKI/WF] trigger failed: {_se}")

    return lead_obj

@router.get("/webhook/lead")
async def create_lead_webhook_get(
    nome: Optional[str] = None,
    cognome: Optional[str] = None,
    telefono: Optional[str] = None,
    email: Optional[str] = None,
    provincia: Optional[str] = None,
    unit_id: Optional[str] = None,  # UUID della Unit (preferito)
    commessa_id: Optional[str] = None,  # UUID della Commessa (preferito)
    campagna: Optional[str] = None,  # Fallback: nome campagna
    gruppo: Optional[str] = None,  # Fallback: nome unit
    indirizzo: Optional[str] = None,
    regione: Optional[str] = None,
    url: Optional[str] = None,
    inserzione: Optional[str] = None,
    ip_address: Optional[str] = None,
    privacy_consent: Optional[bool] = None,
    marketing_consent: Optional[bool] = None
):
    """Create lead via GET webhook (for Zapier)
    Public endpoint - no authentication required
    
    Accepts either UUID directly (unit_id, commessa_id) or names (gruppo, campagna)
    UUID is preferred for performance"""
    
    logging.info(f"[WEBHOOK GET] Received: nome={nome}, cognome={cognome}, unit_id={unit_id}, gruppo={gruppo}")
    
    # Convert provincia name to code if needed (e.g., "Roma" → "RM")
    provincia_code = None
    if provincia:
        if len(provincia) == 2:
            # Already a code
            provincia_code = provincia.upper()
        elif provincia in PROVINCE_TO_CODE:
            # Convert full name to code
            provincia_code = PROVINCE_TO_CODE[provincia]
            logging.info(f"[WEBHOOK GET] Converted provincia '{provincia}' → '{provincia_code}'")
        else:
            logging.warning(f"[WEBHOOK GET] Unknown provincia: {provincia}")
    
    # Use provided unit_id OR lookup from gruppo name
    final_unit_id = unit_id
    if not final_unit_id and gruppo:
        try:
            unit = await db.units.find_one({"name": gruppo})
            if not unit:
                unit = await db.units.find_one({"nome": gruppo})
            
            if unit:
                final_unit_id = unit.get("id")
                logging.info(f"[WEBHOOK GET] Resolved gruppo '{gruppo}' → unit_id: {final_unit_id}")
            else:
                logging.warning(f"[WEBHOOK GET] Unit not found for gruppo: {gruppo}")
        except Exception as e:
            logging.error(f"[WEBHOOK GET] Error resolving unit: {e}")
    
    # Use provided commessa_id OR lookup from campagna name
    final_commessa_id = commessa_id
    if not final_commessa_id and campagna:
        try:
            commessa = await db.commesse.find_one({"nome": campagna})
            if commessa:
                final_commessa_id = commessa.get("id")
                logging.info(f"[WEBHOOK GET] Resolved campagna '{campagna}' → commessa_id: {final_commessa_id}")
            else:
                logging.warning(f"[WEBHOOK GET] Commessa not found: {campagna}")
        except Exception as e:
            logging.error(f"[WEBHOOK GET] Error resolving commessa: {e}")
    
    # Create lead object
    lead_data = LeadCreate(
        nome=nome,
        cognome=cognome,
        telefono=telefono,
        email=email,
        provincia=provincia_code,  # Use converted code
        campagna=campagna,
        gruppo=gruppo,
        unit_id=final_unit_id,
        commessa_id=final_commessa_id,
        indirizzo=indirizzo,
        regione=regione,
        url=url,
        inserzione=inserzione,
        ip_address=ip_address,
        privacy_consent=privacy_consent,
        marketing_consent=marketing_consent
    )
    
    lead_obj = Lead(**lead_data.dict())
    await db.leads.insert_one(lead_obj.dict())
    
    logging.info(f"[WEBHOOK GET] Lead created: {lead_obj.id} with unit_id={final_unit_id}, commessa_id={final_commessa_id}")
    
    # Check if qualification should be started based on commessa settings
    should_start_qualification = False
    
    try:
        # Find the commessa associated with this lead
        commessa = None
        if lead_obj.campagna:
            commessa = await db.commesse.find_one({"nome": lead_obj.campagna})
        elif lead_obj.gruppo:
            commessa = await db.commesse.find_one({"nome": lead_obj.gruppo})
        
        if commessa:
            should_start_qualification = commessa.get("has_ai", False)
            logging.info(f"[WEBHOOK GET] Found commessa '{commessa.get('nome')}' for lead {lead_obj.id}. has_ai: {should_start_qualification}")
        else:
            logging.warning(f"[WEBHOOK GET] No commessa found for lead {lead_obj.id}")
            should_start_qualification = False
            
    except Exception as e:
        logging.error(f"[WEBHOOK GET] Error checking commessa AI settings for lead {lead_obj.id}: {e}")
        should_start_qualification = False
    
    # PRIORITY CHECK: First check if Unit has auto_assign disabled
    # If disabled, assign directly to referente/agent REGARDLESS of AI qualification
    if final_unit_id:
        unit = await db.units.find_one({"id": final_unit_id})
        if unit and not unit.get("auto_assign_enabled", True):
            # Auto-assignment disabled - assign directly to referente or agent in this Unit
            logging.info(f"[WEBHOOK GET] Unit {final_unit_id} has auto_assign disabled. Looking for referente or agent...")
            
            # First try to find a referente for this unit
            assignee = await db.users.find_one({
                "$or": [
                    {"unit_id": final_unit_id},
                    {"unit_autorizzate": final_unit_id}
                ],
                "role": "referente",
                "is_active": True
            })
            
            # If no referente found, try to find an agent
            if not assignee:
                assignee = await db.users.find_one({
                    "$or": [
                        {"unit_id": final_unit_id},
                        {"unit_autorizzate": final_unit_id}
                    ],
                    "role": "agente",
                    "is_active": True
                })
            
            if assignee:
                assignee_id = assignee["id"]
                assignee_name = assignee.get("username", "unknown")
                assignee_role = assignee.get("role", "unknown")
                current_esito = lead_obj.esito or "Nuovo"
                
                # Update lead with assignment
                await db.leads.update_one(
                    {"id": lead_obj.id},
                    {
                        "$set": {
                            "assigned_agent_id": assignee_id,
                            "assigned_at": datetime.now(timezone.utc),
                            "esito_at_assignment": current_esito
                        }
                    }
                )
                
                logging.info(f"[WEBHOOK GET] Lead {lead_obj.id} assigned to {assignee_role} {assignee_name} ({assignee_id}) for unit {unit.get('nome')} (auto_assign disabled)")
                
                # Send email notification
                asyncio.create_task(notify_agent_new_lead(assignee_id, lead_obj.dict()))
            else:
                logging.warning(f"[WEBHOOK GET] No referente or agent found for unit {final_unit_id}. Lead {lead_obj.id} will remain unassigned.")
            
            # Return early - skip qualification for units with auto_assign disabled
            return {
                "success": True,
                "message": "Lead created and assigned (auto_assign disabled)",
                "lead_id": lead_obj.id,
                "assigned_to": assignee_id if assignee else None,
                "lead": lead_obj
            }
    
    # For units WITH auto_assign enabled: Start qualification or leave unassigned
    if should_start_qualification:
        try:
            await lead_qualification_bot.start_qualification_process(lead_obj.id)
            logging.info(f"[WEBHOOK GET] Started automatic qualification for lead {lead_obj.id}")
        except Exception as e:
            logging.error(f"[WEBHOOK GET] Error starting qualification for lead {lead_obj.id}: {e}")
            logging.info(f"[WEBHOOK GET] Lead {lead_obj.id} remains unassigned until status changes to 'Lead Interessato'")
    else:
        # Unit has auto_assign enabled but no AI - lead remains unassigned until status changes
        logging.info(f"[WEBHOOK GET] Lead {lead_obj.id} created with status 'Nuovo' - will be assigned when status changes to 'Lead Interessato'")
    
    # Trigger Spoki welcome message + Workflows V2 (fire-and-forget)
    try:
        asyncio.create_task(trigger_workflows_for_lead(lead_obj.dict(), "lead_created"))
    except Exception as _se:
        logging.warning(f"[SPOKI/WF] trigger failed: {_se}")

    # Return simple response (Cloudflare-friendly)
    return {
        "status": "ok",
        "success": True,
        "message": "Lead created successfully",
        "lead_id": lead_obj.id
    }

@router.post("/webhook/lead")
async def create_lead_webhook_post(lead_data: LeadCreate):
    """Create lead via POST webhook (recommended for Zapier)
    Public endpoint - no authentication required"""
    
    logging.info(f"[WEBHOOK POST] Received lead: {lead_data.nome} {lead_data.cognome}, gruppo={lead_data.gruppo}")
    
    # Resolve gruppo (unit name) to unit_id (UUID)
    unit_id = lead_data.unit_id  # Use provided unit_id if exists
    commessa_id = lead_data.commessa_id  # Use provided commessa_id if exists
    
    if lead_data.gruppo and not unit_id:
        try:
            unit = await db.units.find_one({"name": lead_data.gruppo})
            if not unit:
                unit = await db.units.find_one({"nome": lead_data.gruppo})
            
            if unit:
                unit_id = unit.get("id")
                logging.info(f"[WEBHOOK POST] Resolved gruppo '{lead_data.gruppo}' to unit_id: {unit_id}")
            else:
                logging.warning(f"[WEBHOOK POST] Unit not found for gruppo: {lead_data.gruppo}")
        except Exception as e:
            logging.error(f"[WEBHOOK POST] Error resolving unit: {e}")
    
    # Resolve campagna to commessa_id
    if lead_data.campagna and not commessa_id:
        try:
            commessa = await db.commesse.find_one({"nome": lead_data.campagna})
            if commessa:
                commessa_id = commessa.get("id")
                logging.info(f"[WEBHOOK POST] Resolved campagna '{lead_data.campagna}' to commessa_id: {commessa_id}")
            else:
                logging.warning(f"[WEBHOOK POST] Commessa not found for campagna: {lead_data.campagna}")
        except Exception as e:
            logging.error(f"[WEBHOOK POST] Error resolving commessa: {e}")
    
    # Validate province if provided (but don't fail if invalid)
    if lead_data.provincia and lead_data.provincia not in ITALIAN_PROVINCES:
        logging.warning(f"[WEBHOOK POST] Invalid province: {lead_data.provincia}")
        lead_data.provincia = None
    
    # Update lead_data with resolved IDs
    lead_data.unit_id = unit_id
    lead_data.commessa_id = commessa_id
    
    lead_obj = Lead(**lead_data.dict())
    await db.leads.insert_one(lead_obj.dict())
    
    logging.info(f"[WEBHOOK POST] Lead created: {lead_obj.id} with unit_id={unit_id}, commessa_id={commessa_id}")
    
    # Check if qualification should be started
    should_start_qualification = False
    
    try:
        commessa = None
        if lead_obj.campagna:
            commessa = await db.commesse.find_one({"nome": lead_obj.campagna})
        elif lead_obj.gruppo:
            commessa = await db.commesse.find_one({"nome": lead_obj.gruppo})
        
        if commessa:
            should_start_qualification = commessa.get("has_ai", False)
            logging.info(f"[WEBHOOK POST] Found commessa for lead {lead_obj.id}. has_ai: {should_start_qualification}")
        else:
            logging.warning(f"[WEBHOOK POST] No commessa found for lead {lead_obj.id}")
            
    except Exception as e:
        logging.error(f"[WEBHOOK POST] Error checking commessa for lead {lead_obj.id}: {e}")
    
    # Start qualification or leave unassigned until status changes
    if should_start_qualification:
        try:
            await lead_qualification_bot.start_qualification_process(lead_obj.id)
            logging.info(f"[WEBHOOK POST] Started qualification for lead {lead_obj.id}")
        except Exception as e:
            logging.error(f"[WEBHOOK POST] Error starting qualification: {e}")
            logging.info(f"[WEBHOOK POST] Lead {lead_obj.id} remains unassigned until status changes to 'Lead Interessato'")
    else:
        # Check if Unit has auto_assign disabled - assign directly to referente
        if unit_id:
            unit = await db.units.find_one({"id": unit_id})
            if unit and not unit.get("auto_assign_enabled", True):
                # Auto-assignment disabled - assign directly to referente or agent in this Unit
                logging.info(f"[WEBHOOK POST] Unit {unit_id} has auto_assign disabled. Looking for referente or agent...")
                
                # First try to find a referente for this unit
                assignee = await db.users.find_one({
                    "$or": [
                        {"unit_id": unit_id},
                        {"unit_autorizzate": unit_id}
                    ],
                    "role": "referente",
                    "is_active": True
                })
                
                # If no referente found, try to find an agent
                if not assignee:
                    assignee = await db.users.find_one({
                        "$or": [
                            {"unit_id": unit_id},
                            {"unit_autorizzate": unit_id}
                        ],
                        "role": "agente",
                        "is_active": True
                    })
                
                if assignee:
                    assignee_id = assignee["id"]
                    assignee_name = assignee.get("username", "unknown")
                    assignee_role = assignee.get("role", "unknown")
                    current_esito = lead_obj.esito or "Nuovo"
                    
                    # Update lead with assignment
                    await db.leads.update_one(
                        {"id": lead_obj.id},
                        {
                            "$set": {
                                "assigned_agent_id": assignee_id,
                                "assigned_at": datetime.now(timezone.utc),
                                "esito_at_assignment": current_esito
                            }
                        }
                    )
                    
                    logging.info(f"[WEBHOOK POST] Lead {lead_obj.id} assigned to {assignee_role} {assignee_name} ({assignee_id}) for unit {unit.get('nome')} (auto_assign disabled)")
                    
                    # Send email notification
                    asyncio.create_task(notify_agent_new_lead(assignee_id, lead_obj.dict()))
                else:
                    logging.warning(f"[WEBHOOK POST] No referente or agent found for unit {unit_id}. Lead {lead_obj.id} will remain unassigned.")
            else:
                logging.info(f"[WEBHOOK POST] Lead {lead_obj.id} created with status 'Nuovo' - will be assigned when status changes to 'Lead Interessato'")
        else:
            logging.info(f"[WEBHOOK POST] Lead {lead_obj.id} created without unit_id - will be assigned when status changes to 'Lead Interessato'")
    
    # Trigger Spoki welcome message + Workflows V2 (fire-and-forget)
    try:
        asyncio.create_task(trigger_workflows_for_lead(lead_obj.dict(), "lead_created"))
    except Exception as _se:
        logging.warning(f"[SPOKI/WF] trigger failed: {_se}")

    return {
        "success": True,
        "message": "Lead created successfully",
        "lead_id": lead_obj.id,
        "lead": lead_obj
    }

@router.get("/leads", response_model=LeadsPaginatedResponse)
async def get_leads(
    unit_id: Optional[str] = None,
    campagna: Optional[str] = None,
    provincia: Optional[str] = None,
    status: Optional[str] = None,  # Filter by esito (status)
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    assigned_agent_id: Optional[str] = None,  # NEW: Filter by agent
    search: Optional[str] = None,  # NEW: Search by name/phone
    page: int = Query(1, ge=1),  # Pagination: page number
    page_size: int = Query(50, ge=1, le=200),  # Pagination: items per page
    current_user: User = Depends(get_current_user)
):
    # Exclude deleted leads
    query = {"$or": [{"is_deleted": False}, {"is_deleted": {"$exists": False}}]}
    
    # Role-based filtering
    if current_user.role == UserRole.AGENTE:
        # Agent sees only their assigned leads
        query["assigned_agent_id"] = current_user.id
        
        # Further filter by agent's authorized units
        if current_user.unit_autorizzate:
            if "unit_id" not in query:
                query["unit_id"] = {"$in": current_user.unit_autorizzate}
                
    elif current_user.role == UserRole.REFERENTE:
        # Referente sees leads of agents under them
        agents = await db["users"].find({"referente_id": current_user.id}).to_list(length=None)
        agent_ids = [agent["id"] for agent in agents]
        agent_ids.append(current_user.id)  # Include referente's own leads if any
        query["assigned_agent_id"] = {"$in": agent_ids}
        
        # Filter by referente's authorized units
        if current_user.unit_autorizzate:
            query["unit_id"] = {"$in": current_user.unit_autorizzate}
    
    elif current_user.role == UserRole.SUPER_REFERENTE:
        # Super Referente sees leads assigned to their authorized Referenti and their agents
        # BUT only within their assigned Unit
        super_ref_unit_id = current_user.unit_id
        referenti_ids = current_user.referenti_autorizzati or []
        
        if super_ref_unit_id and referenti_ids:
            # Get all agents under authorized referenti
            agents = await db["users"].find({
                "referente_id": {"$in": referenti_ids},
                "is_active": True
            }).to_list(length=None)
            agent_ids = [agent["id"] for agent in agents]
            
            # All IDs: referenti + their agents + super referente itself
            all_ids = list(set(agent_ids + referenti_ids + [current_user.id]))
            
            # Filter by BOTH: Unit AND assigned to referenti/agents
            query["unit_id"] = super_ref_unit_id
            query["assigned_agent_id"] = {"$in": all_ids}
            logging.info(f"[LEADS] Super Referente {current_user.username} viewing leads in unit {super_ref_unit_id} assigned to {len(all_ids)} users (referenti + agents)")
        elif super_ref_unit_id:
            # Has unit but no referenti - see only own leads in that unit
            query["unit_id"] = super_ref_unit_id
            query["assigned_agent_id"] = current_user.id
            logging.info(f"[LEADS] Super Referente {current_user.username} has unit but no referenti, showing only own leads in unit {super_ref_unit_id}")
        elif referenti_ids:
            # Has referenti but no unit - use only referenti filter
            agents = await db["users"].find({
                "referente_id": {"$in": referenti_ids},
                "is_active": True
            }).to_list(length=None)
            agent_ids = [agent["id"] for agent in agents]
            all_ids = list(set(agent_ids + referenti_ids + [current_user.id]))
            query["assigned_agent_id"] = {"$in": all_ids}
            logging.info(f"[LEADS] Super Referente {current_user.username} (no unit) viewing leads for {len(all_ids)} users")
        else:
            # No unit and no referenti - see only own leads
            query["assigned_agent_id"] = current_user.id
            logging.info(f"[LEADS] Super Referente {current_user.username} has no unit/referenti, showing only own leads")
    
    elif current_user.role == UserRole.SUPERVISOR:
        # Supervisor sees ALL leads in their authorized Units (regardless of assignment)
        if current_user.unit_autorizzate and len(current_user.unit_autorizzate) > 0:
            query["unit_id"] = {"$in": current_user.unit_autorizzate}
            logging.info(f"[LEADS] Supervisor {current_user.username} viewing leads for units {current_user.unit_autorizzate}")
        elif current_user.unit_id:
            # Fallback to single unit_id if unit_autorizzate is empty
            query["unit_id"] = current_user.unit_id
            logging.info(f"[LEADS] Supervisor {current_user.username} viewing leads for unit {current_user.unit_id}")
        else:
            # If supervisor has no units assigned, show nothing
            logging.warning(f"[LEADS] Supervisor {current_user.username} has no units assigned")
            query["unit_id"] = "NO_UNIT_ASSIGNED"
            
    # Admin can see all leads (no role filter)
    
    # Helper function to add $or condition without overwriting
    def add_or_condition(q, or_cond):
        """Add an $or condition to the query, combining with $and if needed"""
        if "$or" in q:
            # Already have an $or, need to use $and
            existing_or = q.pop("$or")
            if "$and" in q:
                q["$and"].append({"$or": existing_or})
                q["$and"].append({"$or": or_cond})
            else:
                q["$and"] = [{"$or": existing_or}, {"$or": or_cond}]
        else:
            q["$or"] = or_cond
    
    # Unit filtering (override role-based if specified)
    if unit_id:
        # Use $or for backward compatibility with old field name
        add_or_condition(query, [
            {"unit_id": unit_id},
            {"gruppo": unit_id}
        ])
    
    # Apply additional filters
    if campagna:
        query["campagna"] = {"$regex": campagna, "$options": "i"}  # Case-insensitive search
    if provincia:
        query["provincia"] = {"$regex": provincia, "$options": "i"}  # Case-insensitive search
    if status:
        # Special handling for "Nuovo" status - includes null/empty esito
        if status == "Nuovo":
            add_or_condition(query, [
                {"esito": None},
                {"esito": ""},
                {"esito": "Nuovo"},
                {"esito": {"$exists": False}}
            ])
        else:
            query["esito"] = status
    # Filtro date (feb 2026: input Europe/Rome → UTC; accetta sia YYYY-MM-DD che ISO con time)
    if date_from or date_to:
        from helpers import rome_date_to_utc_range
        existing = query.get("created_at") or {}
        if date_from:
            try:
                if "T" in date_from:
                    existing["$gte"] = datetime.fromisoformat(date_from)
                else:
                    start_utc, _ = rome_date_to_utc_range(date_from)
                    existing["$gte"] = start_utc
            except ValueError:
                pass
        if date_to:
            try:
                if "T" in date_to:
                    existing["$lte"] = datetime.fromisoformat(date_to)
                else:
                    _, end_utc = rome_date_to_utc_range(date_to)
                    existing["$lte"] = end_utc
            except ValueError:
                pass
        if existing:
            query["created_at"] = existing
    
    # NEW: Filter by assigned agent
    if assigned_agent_id:
        if assigned_agent_id == "unassigned":
            # Show only unassigned leads
            add_or_condition(query, [
                {"assigned_agent_id": None},
                {"assigned_agent_id": {"$exists": False}}
            ])
        else:
            # Override role-based filter if admin/referente/super_referente specifies an agent
            if current_user.role in [UserRole.ADMIN, UserRole.REFERENTE, UserRole.SUPER_REFERENTE, UserRole.SUPERVISOR]:
                query["assigned_agent_id"] = assigned_agent_id
    
    # NEW: Search by name or phone
    if search:
        search_regex = {"$regex": search, "$options": "i"}  # Case-insensitive
        add_or_condition(query, [
            {"nome": search_regex},
            {"cognome": search_regex},
            {"telefono": search_regex},
            {"email": search_regex}
        ])
    
    # Count total matching documents BEFORE pagination
    total = await db["leads"].count_documents(query)
    
    # Calculate pagination
    skip = (page - 1) * page_size
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    
    # Fetch paginated leads
    leads = await db["leads"].find(query).sort("created_at", -1).skip(skip).limit(page_size).to_list(length=page_size)
    
    # Get all units for populating unit_nome
    units = await db["units"].find().to_list(length=None)
    units_map = {u["id"]: u.get("nome", "N/A") for u in units}
    
    # Filter out leads with validation errors to prevent crashes
    valid_leads = []
    for lead_data in leads:
        try:
            # Populate unit_nome from units_map
            if lead_data.get("unit_id"):
                lead_data["unit_nome"] = units_map.get(lead_data["unit_id"], "Unit sconosciuta")
            else:
                lead_data["unit_nome"] = "Non assegnata"
            
            lead = Lead(**lead_data)
            valid_leads.append(lead)
        except Exception as e:
            # Log the validation error but continue
            logging.warning(f"Skipping lead {lead_data.get('id', 'unknown')} due to validation error: {str(e)}")
            continue
    
    return LeadsPaginatedResponse(
        leads=valid_leads,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/leads/assignable-agents")
async def get_assignable_agents(
    unit_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get list of agents that can be assigned leads - for Admin and Supervisor"""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
        raise HTTPException(status_code=403, detail="Non autorizzato")
    
    query = {
        "role": {"$in": ["agente", "referente"]},
        "is_active": True
    }
    
    # Supervisor can only see agents in their authorized units
    if current_user.role == UserRole.SUPERVISOR:
        supervisor_units = (current_user.unit_autorizzate or []) + ([current_user.unit_id] if current_user.unit_id else [])
        query["unit_id"] = {"$in": supervisor_units}
    elif unit_id:
        # Admin can filter by unit
        query["unit_id"] = unit_id
    
    agents = await db.users.find(query, {"_id": 0, "password": 0}).to_list(length=500)
    
    # Get unit names for each agent
    unit_ids = list(set([a.get("unit_id") for a in agents if a.get("unit_id")]))
    units = await db.units.find({"id": {"$in": unit_ids}}).to_list(length=None)
    unit_names = {u["id"]: u.get("nome", u["id"]) for u in units}
    
    result = []
    for agent in agents:
        result.append({
            "id": agent["id"],
            "username": agent.get("username"),
            "email": agent.get("email"),
            "role": agent.get("role"),
            "unit_id": agent.get("unit_id"),
            "unit_nome": unit_names.get(agent.get("unit_id"), "N/A")
        })
    
    return {"agents": result, "total": len(result)}

@router.put("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, lead_update: LeadUpdate, current_user: User = Depends(get_current_user)):
    # Find the lead
    lead = await db["leads"].find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Debug logging
    logging.info(f"[UPDATE_LEAD] User: {current_user.username} (role: {current_user.role}, id: {current_user.id})")
    logging.info(f"[UPDATE_LEAD] Lead: {lead_id}, assigned_to: {lead.get('assigned_agent_id')}, unit: {lead.get('unit_id')}")
    
    # Check permissions for updating lead
    if current_user.role == UserRole.AGENTE:
        # Agente può modificare solo i lead assegnati a lui
        if lead.get("assigned_agent_id") != current_user.id:
            logging.warning(f"[UPDATE_LEAD] DENIED - Agente {current_user.username} tried to update lead not assigned to them")
            raise HTTPException(status_code=403, detail="Puoi modificare solo i lead assegnati a te")
        logging.info(f"[UPDATE_LEAD] ALLOWED - Agente {current_user.username} updating own lead")
    elif current_user.role == UserRole.REFERENTE:
        # Referente può modificare:
        # 1. Lead assegnati a lui stesso
        # 2. Lead assegnati ai suoi agenti
        # 3. Lead non assegnati nella sua unit
        is_own_lead = lead.get("assigned_agent_id") == current_user.id
        is_agent_lead = False
        is_unit_lead = False
        
        if lead.get("assigned_agent_id") and not is_own_lead:
            agent = await db["users"].find_one({"id": lead["assigned_agent_id"]})
            is_agent_lead = agent and agent.get("referente_id") == current_user.id
        
        # Check if lead is in referente's unit
        if current_user.unit_id and lead.get("unit_id") == current_user.unit_id:
            is_unit_lead = True
        elif current_user.unit_autorizzate and lead.get("unit_id") in current_user.unit_autorizzate:
            is_unit_lead = True
        
        logging.info(f"[UPDATE_LEAD] Referente check: is_own={is_own_lead}, is_agent={is_agent_lead}, is_unit={is_unit_lead}")
        
        if not (is_own_lead or is_agent_lead or is_unit_lead):
            logging.warning(f"[UPDATE_LEAD] DENIED - Referente {current_user.username} has no permission")
            raise HTTPException(status_code=403, detail="Non hai i permessi per modificare questo lead")
        logging.info(f"[UPDATE_LEAD] ALLOWED - Referente {current_user.username}")
    elif current_user.role == UserRole.SUPERVISOR:
        # Supervisor can update leads in their authorized Units
        lead_unit = lead.get("unit_id")
        supervisor_units = current_user.unit_autorizzate or []
        if current_user.unit_id:
            supervisor_units = supervisor_units + [current_user.unit_id]
        if lead_unit not in supervisor_units:
            logging.warning(f"[UPDATE_LEAD] DENIED - Supervisor {current_user.username} unit mismatch")
            raise HTTPException(status_code=403, detail="Puoi modificare solo i lead delle tue Unit autorizzate")
        logging.info(f"[UPDATE_LEAD] ALLOWED - Supervisor {current_user.username}")
    else:
        logging.info(f"[UPDATE_LEAD] ALLOWED - Admin/other role {current_user.username}")
    
    # Update lead
    update_data = lead_update.dict(exclude_unset=True)
    
    # CRITICAL: Only Admin and Supervisor can REASSIGN leads (change assigned_agent_id to a DIFFERENT value)
    if "assigned_agent_id" in update_data:
        current_assigned = lead.get("assigned_agent_id")
        new_assigned = update_data["assigned_agent_id"]
        
        # Only check permissions if the value is actually changing
        if new_assigned != current_assigned:
            if current_user.role not in [UserRole.ADMIN, UserRole.SUPERVISOR]:
                raise HTTPException(
                    status_code=403, 
                    detail="Solo Admin e Supervisor possono riassegnare i lead"
                )
            # If Supervisor, verify the new agent is in their authorized units
            if current_user.role == UserRole.SUPERVISOR and new_assigned:
                new_agent = await db.users.find_one({"id": new_assigned})
                if new_agent:
                    supervisor_units = (current_user.unit_autorizzate or []) + ([current_user.unit_id] if current_user.unit_id else [])
                    if new_agent.get("unit_id") not in supervisor_units:
                        raise HTTPException(
                            status_code=403,
                            detail="Puoi assegnare lead solo ad agenti delle tue Unit"
                        )
                # Update assigned_at when reassigning
                update_data["assigned_at"] = datetime.now(timezone.utc)
        else:
            # Se il valore non è cambiato, rimuovilo dai dati da aggiornare
            del update_data["assigned_agent_id"]
    
    # If esito is being set, update contacted_at
    if update_data.get("esito"):
        update_data["contacted_at"] = datetime.now(timezone.utc)
    
    # NEW: Auto-assign when status changes to "Lead Interessato"
    # Status che indicano che il lead non è ancora stato lavorato/assegnato
    unassigned_statuses = ["Nuovo", "Bot Qualificato", "Timeout Bot", "", None]
    old_esito = lead.get("esito", "Nuovo") or "Nuovo"
    new_esito = update_data.get("esito")
    
    if new_esito and new_esito == "Lead Interessato" and old_esito in unassigned_statuses:
        # Check if lead is currently unassigned
        if not lead.get("assigned_agent_id"):
            # Check if Unit has auto_assign_enabled
            unit_id = lead.get("unit_id")
            should_auto_assign = True
            
            if unit_id:
                unit = await db.units.find_one({"id": unit_id})
                if unit and not unit.get("auto_assign_enabled", True):
                    should_auto_assign = False
                    # Auto-assignment disabled - assign directly to the Unit's referente
                    logging.info(f"[AUTO-ASSIGN] Unit {unit_id} has auto_assign disabled. Looking for referente...")
                    
                    referente = await db.users.find_one({
                        "unit_id": unit_id,
                        "role": "referente",
                        "is_active": True
                    })
                    
                    if referente:
                        referente_id = referente["id"]
                        referente_name = referente.get("username", "unknown")
                        
                        update_data["assigned_agent_id"] = referente_id
                        update_data["assigned_at"] = datetime.now(timezone.utc)
                        update_data["esito_at_assignment"] = new_esito
                        
                        logging.info(f"[AUTO-ASSIGN] Lead {lead_id} assigned to referente {referente_name} ({referente_id}) for unit {unit.get('nome')} (auto_assign disabled)")
                        
                        # Send email notification to referente
                        lead_data = {**lead, **update_data}
                        asyncio.create_task(notify_agent_new_lead(referente_id, lead_data))
                    else:
                        logging.warning(f"[AUTO-ASSIGN] No referente found for unit {unit_id}. Lead {lead_id} will remain unassigned.")
            
            if should_auto_assign:
                # Create Lead object for assignment
                lead_obj = Lead(**lead)
                assigned_agent_id = await assign_lead_to_agent(lead_obj)
                
                if assigned_agent_id:
                    update_data["assigned_agent_id"] = assigned_agent_id
                    update_data["assigned_at"] = datetime.now(timezone.utc)
                    logging.info(f"[AUTO-ASSIGN] Lead {lead_id} auto-assigned to agent {assigned_agent_id} after status change to 'Lead Interessato'")
                else:
                    logging.warning(f"[AUTO-ASSIGN] No agent found for lead {lead_id} with provincia {lead.get('provincia')}")
    
    # NEW: If status is being changed to a "closed" status, calculate tempo_gestione
    if update_data.get("status"):
        # Check if this is a closing status (you can define specific statuses as "closed")
        # For now, any status change on an unassigned lead counts
        if not lead.get("closed_at"):
            # Check if status indicates closure (customize this logic based on your status names)
            closing_statuses = ["Chiuso", "Convertito", "Perso", "Non Interessato"]
            if update_data["status"] in closing_statuses:
                now = datetime.now(timezone.utc)
                update_data["closed_at"] = now
                
                # Calculate tempo_gestione in minutes
                created_at = lead.get("created_at")
                if created_at:
                    if isinstance(created_at, str):
                        created_at = datetime.fromisoformat(created_at)
                    delta = now - created_at
                    update_data["tempo_gestione_minuti"] = int(delta.total_seconds() / 60)
    
    await db["leads"].update_one(
        {"id": lead_id},
        {"$set": update_data}
    )
    
    # LOG: Save lead history entry for all changes
    changes_log = {}
    for field, new_value in update_data.items():
        old_value = lead.get(field)
        # Only log if value actually changed
        if old_value != new_value:
            # Convert datetime objects to ISO strings for storage
            if isinstance(old_value, datetime):
                old_value = old_value.isoformat()
            if isinstance(new_value, datetime):
                new_value = new_value.isoformat()
            changes_log[field] = {"old": old_value, "new": new_value}
    
    if changes_log:
        history_entry = {
            "id": str(uuid.uuid4()),
            "lead_id": lead_id,
            "user_id": current_user.id,
            "username": current_user.username,
            "action": "update",
            "changes": changes_log,
            "timestamp": datetime.now(timezone.utc)
        }
        await db["lead_history"].insert_one(history_entry)
        logging.info(f"[LEAD_HISTORY] Logged changes for lead {lead_id} by user {current_user.username}")
    
    updated_lead = await db["leads"].find_one({"id": lead_id})
    return Lead(**updated_lead)

@router.get("/leads/{lead_id}/history")
async def get_lead_history(lead_id: str, current_user: User = Depends(get_current_user)):
    """Get the change history for a lead - Admin only"""
    
    # Only admin can view lead history
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo gli Admin possono visualizzare lo storico dei lead")
    
    # Check if lead exists
    lead = await db["leads"].find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Fetch history entries sorted by timestamp (newest first)
    history_entries = await db["lead_history"].find(
        {"lead_id": lead_id}
    ).sort("timestamp", -1).to_list(length=100)
    
    # Clean up _id from MongoDB
    for entry in history_entries:
        if "_id" in entry:
            del entry["_id"]
        # Convert datetime to ISO string
        if isinstance(entry.get("timestamp"), datetime):
            entry["timestamp"] = entry["timestamp"].isoformat()
    
    return {
        "lead_id": lead_id,
        "history": history_entries,
        "total": len(history_entries)
    }

@router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, current_user: User = Depends(get_current_user)):
    """Soft delete a lead - sposta nel cestino invece di eliminare definitivamente"""
    
    # Find the lead
    lead = await db.leads.find_one({"id": lead_id, "$or": [{"is_deleted": False}, {"is_deleted": {"$exists": False}}]})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check permissions - only admin can delete leads
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete leads")
    
    try:
        # Soft delete - mark as deleted instead of removing
        deleted_at = datetime.now(timezone.utc)
        await db.leads.update_one(
            {"id": lead_id},
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_at": deleted_at,
                    "deleted_by": current_user.id,
                    "deleted_by_username": current_user.username,
                    "last_assigned_agent_id": lead.get("assigned_agent_id"),  # Save for restore
                    "last_esito": lead.get("esito")  # Save current status for restore
                }
            }
        )
        
        # Log the soft delete
        await db.logs.insert_one({
            "id": str(uuid.uuid4()),
            "entity_type": "lead",
            "entity_id": lead_id,
            "action": "soft_delete",
            "description": f"Lead spostato nel cestino da {current_user.username}",
            "metadata": {
                "action_type": "soft_delete",
                "old_value": lead.get("esito", "N/A"),
                "new_value": "cestino",
                "deleted_by": current_user.id,
                "deleted_by_username": current_user.username
            },
            "user_id": current_user.id,
            "user_name": current_user.username,
            "created_at": deleted_at
        })
        
        return {
            "success": True,
            "message": f"Lead {lead['nome']} {lead['cognome']} spostato nel cestino",
            "lead_id": lead_id,
            "can_restore": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error soft deleting lead {lead_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete lead")




# Webhook per-unit (spostati da server.py per preservare l'ordine di matching: /webhook/lead PRIMA di /webhook/{unit_id})
@router.post("/webhook/{unit_id}")
async def webhook_receive_lead(unit_id: str, lead_data: LeadCreate):
    """Webhook endpoint for receiving leads from external sources with auto-assignment"""
    try:
        # Validate that unit exists
        unit = await db["units"].find_one({"id": unit_id})
        if not unit:
            raise HTTPException(status_code=404, detail="Unit not found")
        
        # Set unit_id for the lead
        lead_data.unit_id = unit_id
        lead_data.gruppo = unit_id  # Backward compatibility
        
        # VALIDATION: Check if commessa_id is provided and belongs to this unit
        if lead_data.commessa_id:
            unit_commesse = unit.get("commesse_autorizzate", [])
            if lead_data.commessa_id not in unit_commesse:
                logging.warning(f"Lead commessa_id {lead_data.commessa_id} not authorized for unit {unit_id}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Commessa {lead_data.commessa_id} not authorized for this unit"
                )
        
        # AUTO-ASSIGNMENT LOGIC
        assigned_agent_id = None
        
        # Check if Unit has auto_assign disabled - assign directly to referente or agent
        if not unit.get("auto_assign_enabled", True):
            logging.info(f"[WEBHOOK] Unit {unit_id} has auto_assign disabled. Looking for referente or agent...")
            
            # First try to find a referente for this unit
            assignee = await db.users.find_one({
                "$or": [
                    {"unit_id": unit_id},
                    {"unit_autorizzate": unit_id}
                ],
                "role": "referente",
                "is_active": True
            })
            
            # If no referente found, try to find an agent
            if not assignee:
                assignee = await db.users.find_one({
                    "$or": [
                        {"unit_id": unit_id},
                        {"unit_autorizzate": unit_id}
                    ],
                    "role": "agente",
                    "is_active": True
                })
            
            if assignee:
                assigned_agent_id = assignee["id"]
                assignee_role = assignee.get("role", "unknown")
                logging.info(f"[WEBHOOK] Lead will be assigned to {assignee_role} {assignee.get('username')} ({assigned_agent_id}) for unit {unit.get('nome')} (auto_assign disabled)")
            else:
                logging.warning(f"[WEBHOOK] No referente or agent found for unit {unit_id}. Lead will remain unassigned.")
        
        elif lead_data.provincia:
            # Find agents authorized for this unit and provincia
            agents = await db["users"].find({
                "role": UserRole.AGENTE,
                "is_active": True,
                "unit_id": unit_id,  # Changed from unit_autorizzate to unit_id
                "provinces": lead_data.provincia
            }).to_list(length=None)
            
            if agents:
                # Calculate agent workload and performance
                agent_scores = []
                for agent in agents:
                    # Get agent's current lead count
                    lead_count = await db["leads"].count_documents({
                        "assigned_agent_id": agent["id"],
                        "closed_at": None  # Only count open leads
                    })
                    
                    # Get agent's average handling time
                    agent_leads = await db["leads"].find({
                        "assigned_agent_id": agent["id"],
                        "tempo_gestione_minuti": {"$exists": True, "$ne": None}
                    }).to_list(length=100)
                    
                    avg_time = 0
                    if agent_leads:
                        total_time = sum([l.get("tempo_gestione_minuti", 0) for l in agent_leads])
                        avg_time = total_time / len(agent_leads)
                    
                    # Score: lower is better (less workload + faster handling)
                    # Weight: 70% current workload, 30% avg handling time
                    score = (lead_count * 0.7) + (avg_time / 60 * 0.3)  # Convert minutes to hours
                    
                    agent_scores.append({
                        "agent_id": agent["id"],
                        "score": score,
                        "lead_count": lead_count,
                        "avg_time": avg_time
                    })
                
                # Sort by score (ascending) and pick the best agent
                agent_scores.sort(key=lambda x: x["score"])
                assigned_agent_id = agent_scores[0]["agent_id"]
                
                logging.info(f"Lead auto-assigned to agent {assigned_agent_id} (score: {agent_scores[0]['score']:.2f})")
        
        # Create the lead
        lead_obj = Lead(**lead_data.dict())
        
        # Set assigned agent if found (after creating Lead object)
        if assigned_agent_id:
            lead_obj.assigned_agent_id = assigned_agent_id
            lead_obj.assigned_at = datetime.now(timezone.utc)
        
        await db["leads"].insert_one(lead_obj.dict())
        logging.info(f"Lead created via webhook: {lead_obj.id} for unit {unit_id}")
        
        # If lead was assigned, update with esito_at_assignment and send email notification
        if assigned_agent_id:
            current_esito = lead_obj.esito or "Nuovo"
            await db["leads"].update_one(
                {"id": lead_obj.id},
                {"$set": {"esito_at_assignment": current_esito}}
            )
            # Send email notification to assigned agent/referente
            asyncio.create_task(notify_agent_new_lead(assigned_agent_id, lead_obj.dict()))
        
        # STEP 3: Send WhatsApp welcome message (after agent assignment)
        whatsapp_sent = False
        if assigned_agent_id and unit.get("welcome_message"):
            try:
                # Get WhatsApp config for this unit
                whatsapp_config = await db.whatsapp_configurations.find_one({"unit_id": unit_id})
                
                if whatsapp_config and lead_data.telefono:
                    welcome_message = unit.get("welcome_message", "")
                    # Replace placeholders
                    welcome_message = welcome_message.replace("{nome}", lead_data.nome or "")
                    welcome_message = welcome_message.replace("{unit_name}", unit.get("nome", ""))
                    
                    # TODO: Send WhatsApp message via Twilio/WhatsApp API
                    # For now, just log it
                    logging.info(f"WhatsApp welcome message ready for lead {lead_obj.id}: {welcome_message[:50]}...")
                    whatsapp_sent = True
            except Exception as wa_error:
                logging.error(f"Error sending WhatsApp welcome message: {wa_error}")
        
        # STEP 4: Auto-execute workflow if one exists for this unit (AFTER agent assignment and WhatsApp)
        workflow_execution_result = None
        try:
            # Find active workflow for this unit with trigger "lead_created"
            workflow = await db.workflows.find_one({
                "unit_id": unit_id,
                "is_active": True,
                "trigger_type": "lead_created"
            })
            
            if workflow:
                # Get OpenAI API key
                ai_config = await db.ai_configurations.find_one({}, {"_id": 0})
                openai_key = ai_config.get("openai_api_key") if ai_config else None
                
                # Initialize and execute workflow
                executor = WorkflowExecutor(db, openai_key)
                workflow_result = await executor.execute_workflow(
                    workflow["id"],
                    {
                        "lead_id": lead_obj.id,
                        "unit_tag": unit.get("nome"),
                        "lead_data": lead_obj.dict()
                    }
                )
                
                workflow_execution_result = {
                    "workflow_executed": True,
                    "workflow_id": workflow["id"],
                    "result": workflow_result
                }
                
                logging.info(f"Workflow auto-executed for lead {lead_obj.id}: {workflow_result.get('success')}")
        except Exception as wf_error:
            logging.error(f"Workflow execution error for lead {lead_obj.id}: {wf_error}")
            workflow_execution_result = {
                "workflow_executed": False,
                "error": str(wf_error)
            }
        
        return {
            "success": True,
            "lead_id": lead_obj.id,
            "assigned_agent_id": assigned_agent_id,
            "message": f"Lead created and {'assigned to agent' if assigned_agent_id else 'awaiting assignment'}",
            "workflow": workflow_execution_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in webhook for unit {unit_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process webhook: {str(e)}")


@router.get("/webhook/{unit_id}")
async def webhook_receive_lead_get(
    unit_id: str,
    request: Request,
    nome: Optional[str] = None,
    cognome: Optional[str] = None,
    telefono: Optional[str] = None,
    email: Optional[str] = None,
    provincia: Optional[str] = None,
    commessa_id: Optional[str] = None,
    campagna: Optional[str] = None,
    tipologia_abitazione: Optional[str] = None,
    indirizzo: Optional[str] = None,
    regione: Optional[str] = None,
    url: Optional[str] = None,
    otp: Optional[str] = None,
    inserzione: Optional[str] = None,
    privacy_consent: Optional[str] = None,  # English: privacy_consent
    marketing_consent: Optional[str] = None,  # English: marketing_consent
    consenso_privacy: Optional[str] = None,  # Italian alias: consenso_privacy
    consenso_marketing: Optional[str] = None,  # Italian alias: consenso_marketing
):
    """GET Webhook endpoint for receiving leads from external sources (e.g., Zapier, URL redirects)
    
    Accepts both English (privacy_consent/marketing_consent) and Italian (consenso_privacy/consenso_marketing) parameter names
    Accepts values as: yes/no, true/false, 1/0, si/sì
    Also accepts custom fields by name (e.g., ?test=valore&Tipologia%20Abitazione=casa)
    
    Example URLs:
    - English: ?privacy_consent=yes&marketing_consent=no
    - Italian: ?consenso_privacy=true&consenso_marketing=false
    """
    try:
        # Helper function to convert string to boolean
        def str_to_bool(value: Optional[str]) -> Optional[bool]:
            if value is None:
                return None
            value_lower = str(value).lower().strip()
            if value_lower in ('yes', 'true', '1', 'si', 'sì'):
                return True
            elif value_lower in ('no', 'false', '0'):
                return False
            return None  # If invalid value, treat as None
        
        # Support both English and Italian parameter names
        # If Italian name is provided, use it; otherwise use English name
        final_privacy = consenso_privacy if consenso_privacy is not None else privacy_consent
        final_marketing = consenso_marketing if consenso_marketing is not None else marketing_consent
        
        # Convert consent strings to booleans
        privacy_bool = str_to_bool(final_privacy)
        marketing_bool = str_to_bool(final_marketing)
        
        # Process custom fields from query parameters
        # Get all custom fields from database
        custom_fields_db = await db.custom_fields.find().to_list(length=None)
        custom_fields_map = {cf["name"].lower(): cf["id"] for cf in custom_fields_db}
        
        logging.info(f"[WEBHOOK] Available custom fields: {list(custom_fields_map.keys())}")
        
        # Standard parameters to exclude from custom fields
        standard_params = {
            "unit_id", "nome", "cognome", "telefono", "email", "provincia",
            "commessa_id", "campagna", "tipologia_abitazione", "indirizzo",
            "regione", "url", "otp", "inserzione", "privacy_consent",
            "marketing_consent", "consenso_privacy", "consenso_marketing"
        }
        
        # Extract custom fields from query parameters
        custom_fields_values = {}
        all_query_params = dict(request.query_params)
        
        logging.info(f"[WEBHOOK] All query params received: {list(all_query_params.keys())}")
        
        for param_name, param_value in all_query_params.items():
            param_name_lower = param_name.lower()
            logging.info(f"[WEBHOOK] Processing param: '{param_name}' (lower: '{param_name_lower}')")
            
            if param_name_lower not in standard_params:
                # Check if this param matches a custom field name (case-insensitive)
                if param_name_lower in custom_fields_map:
                    field_id = custom_fields_map[param_name_lower]
                    custom_fields_values[field_id] = param_value
                    logging.info(f"[WEBHOOK] ✅ Custom field MATCHED: '{param_name}' -> ID {field_id} = '{param_value}'")
                else:
                    logging.info(f"[WEBHOOK] ⚠️ Param '{param_name}' NOT in custom fields map")
        
        logging.info(f"[WEBHOOK] Final custom_fields_values: {custom_fields_values}")
        
        # Create LeadCreate object from query parameters
        lead_data = LeadCreate(
            nome=nome,
            cognome=cognome,
            telefono=telefono,
            email=email,
            provincia=provincia,
            commessa_id=commessa_id,
            campagna=campagna,
            tipologia_abitazione=tipologia_abitazione,
            indirizzo=indirizzo,
            regione=regione,
            url=url,
            otp=otp,
            inserzione=inserzione,
            privacy_consent=privacy_bool,
            marketing_consent=marketing_bool,
            custom_fields=custom_fields_values,  # Add custom fields
        )
        
        # Validate that unit exists
        unit = await db["units"].find_one({"id": unit_id})
        if not unit:
            raise HTTPException(status_code=404, detail="Unit not found")
        
        # Set unit_id for the lead
        lead_data.unit_id = unit_id
        lead_data.gruppo = unit_id  # Backward compatibility
        
        # VALIDATION: Check if commessa_id is provided and belongs to this unit
        if lead_data.commessa_id:
            unit_commesse = unit.get("commesse_autorizzate", [])
            if lead_data.commessa_id not in unit_commesse:
                logging.warning(f"Lead commessa_id {lead_data.commessa_id} not authorized for unit {unit_id}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Commessa {lead_data.commessa_id} not authorized for this unit"
                )
        
        # NUOVA LOGICA: NON assegnare automaticamente alla creazione
        # Il lead viene assegnato SOLO quando lo status cambia a "Lead Interessato"
        logging.info(f"Lead will be created without assignment - will be assigned when status changes to 'Lead Interessato'")
        
        # Create the lead (without assignment)
        lead_obj = Lead(**lead_data.dict())
        # Explicitly set assigned_agent_id to None
        lead_obj.assigned_agent_id = None
        lead_obj.assigned_at = None
        
        await db["leads"].insert_one(lead_obj.dict())
        logging.info(f"Lead created via GET webhook: {lead_obj.id} for unit {unit_id}")
        
        # Check if Unit has auto_assign disabled - assign directly to referente/agent
        unit = await db.units.find_one({"id": unit_id})
        if unit and not unit.get("auto_assign_enabled", True):
            logging.info(f"[WEBHOOK GET {unit_id}] Unit has auto_assign disabled. Looking for referente or agent...")
            
            # First try to find a referente for this unit
            assignee = await db.users.find_one({
                "$or": [
                    {"unit_id": unit_id},
                    {"unit_autorizzate": unit_id}
                ],
                "role": "referente",
                "is_active": True
            })
            
            # If no referente found, try to find an agent
            if not assignee:
                assignee = await db.users.find_one({
                    "$or": [
                        {"unit_id": unit_id},
                        {"unit_autorizzate": unit_id}
                    ],
                    "role": "agente",
                    "is_active": True
                })
            
            if assignee:
                assignee_id = assignee["id"]
                assignee_name = assignee.get("username", "unknown")
                assignee_role = assignee.get("role", "unknown")
                
                # Update lead with assignment
                await db.leads.update_one(
                    {"id": lead_obj.id},
                    {
                        "$set": {
                            "assigned_agent_id": assignee_id,
                            "assigned_at": datetime.now(timezone.utc),
                            "esito_at_assignment": "Nuovo"
                        }
                    }
                )
                
                logging.info(f"[WEBHOOK GET {unit_id}] Lead {lead_obj.id} assigned to {assignee_role} {assignee_name} ({assignee_id})")
                
                # Send email notification
                asyncio.create_task(notify_agent_new_lead(assignee_id, lead_obj.dict()))
                
                return {
                    "success": True,
                    "lead_id": lead_obj.id,
                    "assigned_agent_id": assignee_id,
                    "assigned_to": assignee_name,
                    "message": f"Lead creato e assegnato a {assignee_name} (auto_assign disabled)"
                }
            else:
                logging.warning(f"[WEBHOOK GET {unit_id}] No referente or agent found. Lead {lead_obj.id} will remain unassigned.")
        
        return {
            "success": True,
            "lead_id": lead_obj.id,
            "assigned_agent_id": None,
            "message": "Lead created with status 'Nuovo' - will be assigned when status changes to 'Lead Interessato'"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in GET webhook for unit {unit_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process webhook: {str(e)}")

# Dashboard stats
