"""Route: Cestino Lead (recycle bin) — estratte da server.py (refactoring fase 2, giugno 2026)."""
import asyncio
import io
import json
import logging
import re
import uuid
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Dict, Any

from fastapi import (
    APIRouter, HTTPException, Depends, Query, Body, Request,
    UploadFile, File, Form, status,
)
from fastapi.responses import StreamingResponse, JSONResponse

from database import db
from security import (
    get_current_user, get_password_hash, verify_password,
    check_commessa_access, get_user_accessible_commesse, get_user_accessible_sub_agenzie,
    can_user_access_cliente, can_user_access_cliente_notes, can_user_delete_cliente,
    can_user_modify_cliente,
)
from models import *  # noqa: F401,F403

router = APIRouter()
logger = logging.getLogger(__name__)

# ============================================================================
# LEADS CESTINO (RECYCLE BIN) ENDPOINTS
# ============================================================================

@router.get("/leads-cestino")
async def get_leads_cestino(
    current_user: User = Depends(get_current_user)
):
    """Get all deleted leads - Admin only"""
    # Only admin can access cestino
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono accedere al cestino")
    
    try:
        deleted_leads = await db.leads.find(
            {"is_deleted": True},
            {"_id": 0}
        ).sort("deleted_at", -1).to_list(length=500)
        
        # Enrich with unit names and agent names
        for lead in deleted_leads:
            # Get unit name
            if lead.get("unit_id"):
                unit = await db.units.find_one({"id": lead["unit_id"]})
                lead["unit_nome"] = unit.get("nome", "N/A") if unit else "N/A"
            else:
                lead["unit_nome"] = "N/A"
            
            # Get agent name (last assigned)
            if lead.get("last_assigned_agent_id"):
                agent = await db.users.find_one({"id": lead["last_assigned_agent_id"]})
                lead["last_agent_name"] = agent.get("username", "Sconosciuto") if agent else "Sconosciuto"
            elif lead.get("assigned_agent_id"):
                agent = await db.users.find_one({"id": lead["assigned_agent_id"]})
                lead["last_agent_name"] = agent.get("username", "Sconosciuto") if agent else "Sconosciuto"
            else:
                lead["last_agent_name"] = "Non assegnato"
        
        return {
            "success": True,
            "leads": deleted_leads,
            "total": len(deleted_leads)
        }
        
    except Exception as e:
        logging.error(f"Error fetching leads cestino: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nel recupero del cestino: {str(e)}")


@router.post("/leads-cestino/{lead_id}/ripristina")
async def restore_lead(
    lead_id: str,
    current_user: User = Depends(get_current_user)
):
    """Restore a deleted lead from cestino - Admin only"""
    # Only admin can restore
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono ripristinare i lead")
    
    lead_doc = await db.leads.find_one({"id": lead_id, "is_deleted": True})
    if not lead_doc:
        raise HTTPException(status_code=404, detail="Lead non trovato nel cestino")
    
    try:
        restored_at = datetime.now(timezone.utc)
        last_assigned_agent = lead_doc.get("last_assigned_agent_id") or lead_doc.get("assigned_agent_id")
        last_esito = lead_doc.get("last_esito", "Nuovo")
        
        # Restore the lead
        await db.leads.update_one(
            {"id": lead_id},
            {
                "$set": {
                    "is_deleted": False,
                    "restored_at": restored_at,
                    "restored_by": current_user.id,
                    "restored_by_username": current_user.username,
                    "assigned_agent_id": last_assigned_agent,
                    "esito": last_esito
                },
                "$unset": {
                    "deleted_at": "",
                    "deleted_by": "",
                    "deleted_by_username": "",
                    "last_assigned_agent_id": "",
                    "last_esito": ""
                }
            }
        )
        
        # Log the restore
        await db.logs.insert_one({
            "id": str(uuid.uuid4()),
            "entity_type": "lead",
            "entity_id": lead_id,
            "action": "restore",
            "description": f"Lead ripristinato dal cestino da {current_user.username}",
            "metadata": {
                "action_type": "restore",
                "old_value": "cestino",
                "new_value": last_esito,
                "restored_at": restored_at.isoformat(),
                "restored_by": current_user.id,
                "restored_by_username": current_user.username,
                "restored_to_agent": last_assigned_agent
            },
            "user_id": current_user.id,
            "user_name": current_user.username,
            "created_at": restored_at
        })
        
        # Get agent name
        restored_agent_name = "nessuno"
        if last_assigned_agent:
            agent_doc = await db.users.find_one({"id": last_assigned_agent})
            if agent_doc:
                restored_agent_name = agent_doc.get("username", "sconosciuto")
        
        return {
            "success": True,
            "message": f"Lead {lead_doc['nome']} {lead_doc['cognome']} ripristinato con successo",
            "lead_id": lead_id,
            "assigned_to_name": restored_agent_name,
            "esito": last_esito
        }
        
    except Exception as e:
        logging.error(f"Error restoring lead {lead_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nel ripristino del lead: {str(e)}")


@router.delete("/leads-cestino/{lead_id}/elimina-definitivo")
async def permanent_delete_lead(
    lead_id: str,
    current_user: User = Depends(get_current_user)
):
    """Permanently delete a lead from cestino - Admin only"""
    # Only admin can permanently delete
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono eliminare definitivamente")
    
    lead_doc = await db.leads.find_one({"id": lead_id, "is_deleted": True})
    if not lead_doc:
        raise HTTPException(status_code=404, detail="Lead non trovato nel cestino")
    
    try:
        # Check if lead has associated documents
        documents_count = await db.documents.count_documents({"lead_id": lead_id})
        if documents_count > 0:
            # Delete associated documents first
            await db.documents.delete_many({"lead_id": lead_id})
        
        # Permanently delete the lead
        await db.leads.delete_one({"id": lead_id})
        
        # Log the permanent deletion
        await db.logs.insert_one({
            "id": str(uuid.uuid4()),
            "entity_type": "lead",
            "entity_id": lead_id,
            "action": "permanent_delete",
            "description": f"Lead eliminato definitivamente da {current_user.username}",
            "metadata": {
                "action_type": "permanent_delete",
                "lead_name": f"{lead_doc['nome']} {lead_doc['cognome']}",
                "documents_deleted": documents_count
            },
            "user_id": current_user.id,
            "user_name": current_user.username,
            "created_at": datetime.now(timezone.utc)
        })
        
        return {
            "success": True,
            "message": f"Lead {lead_doc['nome']} {lead_doc['cognome']} eliminato definitivamente",
            "lead_id": lead_id,
            "documents_deleted": documents_count
        }
        
    except Exception as e:
        logging.error(f"Error permanently deleting lead {lead_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nell'eliminazione definitiva: {str(e)}")


