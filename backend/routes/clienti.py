"""Route: CRUD Clienti, filtri, export, import massivo — estratte da server.py (refactoring fase 3, giugno 2026)."""
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
from models import *  # noqa: F401,F403
import pandas as pd
from helpers import get_hardcoded_tipologie_contratto, should_use_hardcoded_elements

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/clienti", response_model=Cliente)
async def create_cliente(cliente_data: ClienteCreate, current_user: User = Depends(get_current_user)):
    """Create new cliente"""
    
    # CRITICAL FIX: Dual check pattern per autorizzazione commessa
    has_commessa_access = False
    
    # Admin sempre autorizzato
    if current_user.role == UserRole.ADMIN:
        has_commessa_access = True
    else:
        # Metodo 1: Controlla tabella separata (vecchia logica)
        if await check_commessa_access(current_user, cliente_data.commessa_id, ["can_create_clients"]):
            has_commessa_access = True
        
        # Metodo 2: Controlla campo diretto nell'utente (nuova logica)
        if hasattr(current_user, 'commesse_autorizzate') and current_user.commesse_autorizzate:
            if cliente_data.commessa_id in current_user.commesse_autorizzate:
                has_commessa_access = True
    
    if not has_commessa_access:
        raise HTTPException(status_code=403, detail="No permission to create clients in this commessa")
    
    # Verifica che la sub agenzia sia autorizzata per la commessa
    sub_agenzia = await db.sub_agenzie.find_one({"id": cliente_data.sub_agenzia_id})
    if not sub_agenzia or cliente_data.commessa_id not in sub_agenzia.get("commesse_autorizzate", []):
        raise HTTPException(status_code=400, detail="Sub agenzia not authorized for this commessa")
    
    # CRITICAL FIX: Add detailed validation error logging
    try:
        cliente_dict = cliente_data.dict()
        # Set default status to "passata_al_bo" if not provided (using correct enum format)
        if not cliente_dict.get('status') or cliente_dict.get('status') == '':
            cliente_dict['status'] = "passata_al_bo"
        
        cliente = Cliente(
            **cliente_dict,
            created_by=current_user.id
        )
    except ValidationError as e:
        # Log detailed validation error for debugging
        print(f"❌ VALIDATION ERROR in Cliente creation: {e}")
        print(f"❌ Cliente data received: {cliente_data.dict()}")
        print(f"❌ Current user ID: {current_user.id}")
        
        # Return detailed error to frontend
        error_details = []
        for error in e.errors():
            error_details.append(f"{error['loc'][0] if error['loc'] else 'unknown'}: {error['msg']}")
        
        raise HTTPException(
            status_code=422, 
            detail=f"Validation error: {'; '.join(error_details)}"
        )
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR in Cliente creation: {e}")
        print(f"❌ Cliente data: {cliente_data.dict()}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    
    await db.clienti.insert_one(cliente.dict())
    
    # 📝 LOG: Registra la creazione del cliente
    await log_client_action(
        cliente_id=cliente.id,
        action=ClienteLogAction.CREATED,
        description=f"Cliente creato: {cliente.nome} {cliente.cognome}",
        user=current_user,
        new_value=f"{cliente.nome} {cliente.cognome} - Tel: {cliente.telefono}",
        metadata={
            "commessa_id": cliente.commessa_id,
            "sub_agenzia_id": cliente.sub_agenzia_id,
            "servizio_id": cliente.servizio_id,
            "tipologia_contratto": cliente.tipologia_contratto,  # Now a string, no .value needed
            "segmento": cliente.segmento,  # Now a string, no .value needed
            "creation_method": "cascading_flow" if hasattr(cliente_data, 'created_via') else "standard_form"
        }
    )
    
    # Enrich with segmento_nome for display
    cliente_dict = cliente.dict()
    if cliente_dict.get("segmento"):
        segmento_doc = await db.segmenti.find_one({
            "$or": [
                {"id": cliente_dict["segmento"]},
                {"tipo": cliente_dict["segmento"]}
            ]
        }, {"_id": 0})
        
        if segmento_doc:
            cliente_dict["segmento_nome"] = segmento_doc.get("nome", cliente_dict["segmento"])
        else:
            cliente_dict["segmento_nome"] = cliente_dict["segmento"].capitalize()
    else:
        cliente_dict["segmento_nome"] = "N/A"
    
    return Cliente(**cliente_dict)

@router.get("/clienti", response_model=ClientiPaginatedResponse)
async def get_clienti(
    commessa_id: Optional[str] = None,
    sub_agenzia_id: Optional[List[str]] = Query(None),  # Multi: ?sub_agenzia_id=A&sub_agenzia_id=B
    sub_agenzia_id_exclude: Optional[List[str]] = Query(None),
    status: Optional[List[str]] = Query(None),
    status_exclude: Optional[List[str]] = Query(None),
    tipologia_contratto: Optional[List[str]] = Query(None),
    tipologia_contratto_exclude: Optional[List[str]] = Query(None),
    created_by: Optional[List[str]] = Query(None),  # DEPRECATED: Use assigned_to instead
    created_by_exclude: Optional[List[str]] = Query(None),
    assigned_to: Optional[List[str]] = Query(None),  # NEW: Filter by assigned user (not creator)
    assigned_to_exclude: Optional[List[str]] = Query(None),
    servizio_id: Optional[List[str]] = Query(None),  # Multi
    servizio_id_exclude: Optional[List[str]] = Query(None),
    segmento: Optional[List[str]] = Query(None),     # Multi
    segmento_exclude: Optional[List[str]] = Query(None),
    commessa_id_filter: Optional[List[str]] = Query(None),  # Multi (separate from main commessa_id)
    commessa_id_filter_exclude: Optional[List[str]] = Query(None),
    search: Optional[str] = None,  # NEW: Search by name, email, phone, codice_fiscale
    date_from: Optional[str] = None,  # NEW: Date range filter (YYYY-MM-DD, start of day UTC)
    date_to: Optional[str] = None,    # NEW: Date range filter (YYYY-MM-DD, end of day UTC)
    page: int = 1,  # NEW: Page number (1-based)
    page_size: int = 50,  # NEW: Items per page
    current_user: User = Depends(get_current_user)
):
    """Get clienti accessible to current user based on role.
    
    Filter parameters supporting INCLUDE (multi-value via repeated query param) and EXCLUDE
    (parallel `<name>_exclude` arrays). Backward-compatible: clients sending a single value
    still work because FastAPI accepts both `?status=A` and `?status=A&status=B`.

    Logic:
      - Within a single filter: OR (any of selected values)
      - Across different filters: AND (all conditions must match)
      - Exclusion uses `$nin` with `$exists: True` so clienti with NULL in that field are NOT excluded
        only when the value is non-null and IN the exclude list (per user spec)
    """
    # Helpers per gestire i parametri (accettano None, [], oppure liste)
    def _clean(v: Optional[List[str]]) -> List[str]:
        if not v:
            return []
        return [x for x in v if x and x != "all"]

    f_sub_agenzia = _clean(sub_agenzia_id)
    f_sub_agenzia_ex = _clean(sub_agenzia_id_exclude)
    f_status = _clean(status)
    f_status_ex = _clean(status_exclude)
    f_tipologia = _clean(tipologia_contratto)
    f_tipologia_ex = _clean(tipologia_contratto_exclude)
    f_created_by = _clean(created_by)
    f_created_by_ex = _clean(created_by_exclude)
    f_assigned_to = _clean(assigned_to)
    f_assigned_to_ex = _clean(assigned_to_exclude)
    f_servizio = _clean(servizio_id)
    f_servizio_ex = _clean(servizio_id_exclude)
    f_segmento = _clean(segmento)
    f_segmento_ex = _clean(segmento_exclude)
    f_commessa_filter = _clean(commessa_id_filter)
    f_commessa_filter_ex = _clean(commessa_id_filter_exclude)
    query = {}
    
    # IMPORTANT: Exclude soft-deleted clients from normal listing
    query["$or"] = [{"is_deleted": False}, {"is_deleted": {"$exists": False}}]
    
    # CRITICAL FIX: Role-based client visibility system
    if current_user.role == UserRole.ADMIN:
        # Admin può vedere tutti i clienti (non eliminati)
        print(f"🔓 ADMIN ACCESS: User {current_user.username} can see all clients")
        pass  # No additional filtering for admin
        
    elif current_user.role == UserRole.RESPONSABILE_COMMESSA:
        # Responsabile Commessa: vede clienti delle commesse autorizzate + sub agenzie autorizzate
        print(f"🎯 RESPONSABILE_COMMESSA ACCESS: User {current_user.username}")
        accessible_commesse = await get_user_accessible_commesse(current_user)
        
        # Determina le sub agenzie da usare: può essere sub_agenzie_autorizzate O sub_agenzia_id
        sub_agenzie_ids = []
        if hasattr(current_user, 'sub_agenzie_autorizzate') and current_user.sub_agenzie_autorizzate:
            sub_agenzie_ids = current_user.sub_agenzie_autorizzate
            print(f"  Using sub_agenzie_autorizzate: {sub_agenzie_ids}")
        elif hasattr(current_user, 'sub_agenzia_id') and current_user.sub_agenzia_id:
            sub_agenzie_ids = [current_user.sub_agenzia_id]
            print(f"  Using sub_agenzia_id: {sub_agenzie_ids}")
        
        if accessible_commesse or sub_agenzie_ids:
            # Build query with commessa_id OR sub_agenzia_id
            or_conditions = []
            if accessible_commesse:
                or_conditions.append({"commessa_id": {"$in": accessible_commesse}})
            if sub_agenzie_ids:
                or_conditions.append({"sub_agenzia_id": {"$in": sub_agenzie_ids}})
            
            if len(or_conditions) > 1:
                query["$or"] = or_conditions
            else:
                query.update(or_conditions[0])
            
            # Filter by authorized services
            if current_user.servizi_autorizzati:
                servizio_filter = {
                    "$or": [
                        {"servizio_id": {"$in": current_user.servizi_autorizzati}},
                        {"servizio_id": None},
                        {"servizio_id": {"$exists": False}}
                    ]
                }
                if "$or" in query:
                    # Already have $or for commesse/sub_agenzie, wrap in $and
                    existing_or = query.pop("$or")
                    query["$and"] = [{"$or": existing_or}, servizio_filter]
                else:
                    query["$and"] = [query.copy(), servizio_filter]
                    # Clean up the duplicate keys
                    for key in list(query.keys()):
                        if key != "$and":
                            del query[key]
        else:
            print("⚠️ No accessible commesse or sub agenzie found for responsabile_commessa")
            return []
            
    elif current_user.role == UserRole.BACKOFFICE_COMMESSA:
        # BackOffice Commessa: vede tutti i clienti delle commesse autorizzate
        print(f"🏢 BACKOFFICE_COMMESSA ACCESS: User {current_user.username}")
        if hasattr(current_user, 'commesse_autorizzate') and current_user.commesse_autorizzate:
            query["commessa_id"] = {"$in": current_user.commesse_autorizzate}
            # Filter by authorized services (include null/missing for backward compatibility:
            # clienti without servizio_id assigned must still be visible to BO della commessa)
            if current_user.servizi_autorizzati:
                servizio_filter = {
                    "$or": [
                        {"servizio_id": {"$in": current_user.servizi_autorizzati}},
                        {"servizio_id": None},
                        {"servizio_id": {"$exists": False}},
                    ]
                }
                existing_or = query.pop("$or", None)
                if existing_or:
                    query["$and"] = [{"$or": existing_or}, servizio_filter]
                else:
                    query.setdefault("$and", []).append(servizio_filter)
        else:
            # Fallback: usa get_user_accessible_commesse
            accessible_commesse = await get_user_accessible_commesse(current_user)
            if accessible_commesse:
                query["commessa_id"] = {"$in": accessible_commesse}
                # Filter by authorized services (include null/missing per la stessa motivazione sopra)
                if current_user.servizi_autorizzati:
                    servizio_filter = {
                        "$or": [
                            {"servizio_id": {"$in": current_user.servizi_autorizzati}},
                            {"servizio_id": None},
                            {"servizio_id": {"$exists": False}},
                        ]
                    }
                    existing_or = query.pop("$or", None)
                    if existing_or:
                        query["$and"] = [{"$or": existing_or}, servizio_filter]
                    else:
                        query.setdefault("$and", []).append(servizio_filter)
            else:
                print("⚠️ No accessible commesse found for backoffice_commessa")
                return []
                
    elif current_user.role == UserRole.RESPONSABILE_SUB_AGENZIA:
        # Responsabile Sub Agenzia: vede TUTTI i clienti della propria Sub Agenzia
        # Indipendentemente da chi li ha creati o dal servizio
        print(f"🏪 RESPONSABILE_SUB_AGENZIA ACCESS: User {current_user.username} - ALL clients from sub agenzia")
        if hasattr(current_user, 'sub_agenzia_id') and current_user.sub_agenzia_id:
            query["sub_agenzia_id"] = current_user.sub_agenzia_id
            # NO servizio_id filter - Responsabile Sub Agenzia sees ALL clients in their sub agenzia
            # regardless of service assignment
            print(f"  Sub Agenzia ID: {current_user.sub_agenzia_id}")
        else:
            print("⚠️ No sub_agenzia_id found for responsabile_sub_agenzia")
            return []
            
    elif current_user.role == UserRole.BACKOFFICE_SUB_AGENZIA:
        # BackOffice Sub Agenzia: vede TUTTI i clienti della propria agenzia
        # Indipendentemente da chi li ha creati o dal servizio
        print(f"🏬 BACKOFFICE_SUB_AGENZIA ACCESS: User {current_user.username} - ALL clients from sub agenzia")
        if hasattr(current_user, 'sub_agenzia_id') and current_user.sub_agenzia_id:
            query["sub_agenzia_id"] = current_user.sub_agenzia_id
            # NO servizio_id filter - BackOffice Sub Agenzia sees ALL clients in their sub agenzia
            # regardless of service assignment
            print(f"  Sub Agenzia ID: {current_user.sub_agenzia_id}")
        else:
            print("⚠️ No sub_agenzia_id found for backoffice_sub_agenzia")
            return []
            
    elif current_user.role in [UserRole.AGENTE_SPECIALIZZATO, UserRole.OPERATORE]:
        # Agente Specializzato & Operatore: vedono clienti creati da loro O assegnati a loro
        print(f"👤 {current_user.role} ACCESS: User {current_user.username} - own and assigned clients")
        query["$or"] = [
            {"created_by": current_user.id},
            {"assigned_to": current_user.id}
        ]
        
    elif current_user.role == UserRole.RESPONSABILE_PRESIDI:
        # Responsabile Presidi: vede clienti degli utenti con le stesse sub agenzie
        print(f"🏛️ RESPONSABILE_PRESIDI ACCESS: User {current_user.username} - clients from users with same sub agenzie")
        
        # Determina le sub agenzie da usare: può essere sub_agenzie_autorizzate O sub_agenzia_id
        sub_agenzie_ids = []
        if hasattr(current_user, 'sub_agenzie_autorizzate') and current_user.sub_agenzie_autorizzate:
            sub_agenzie_ids = current_user.sub_agenzie_autorizzate
            print(f"  Using sub_agenzie_autorizzate: {sub_agenzie_ids}")
        elif hasattr(current_user, 'sub_agenzia_id') and current_user.sub_agenzia_id:
            sub_agenzie_ids = [current_user.sub_agenzia_id]
            print(f"  Using sub_agenzia_id: {sub_agenzie_ids}")
        
        if sub_agenzie_ids:
            # Trova tutti gli utenti con le stesse sub agenzie
            users_in_sub_agenzie = await db.users.find({
                "sub_agenzia_id": {"$in": sub_agenzie_ids}
            }).to_list(length=None)
            
            user_ids_in_sub_agenzie = [user["id"] for user in users_in_sub_agenzie]
            user_ids_in_sub_agenzie.append(current_user.id)  # Include anche i propri clienti
            
            # Build base query with created_by OR assigned_to OR sub_agenzia_id
            user_filter = {
                "$or": [
                    {"created_by": {"$in": user_ids_in_sub_agenzie}},
                    {"assigned_to": {"$in": user_ids_in_sub_agenzie}},
                    {"sub_agenzia_id": {"$in": sub_agenzie_ids}}  # NEW: Include clients directly on authorized sub agenzie
                ]
            }
            
            # Filter by authorized services (only if defined and not empty)
            if current_user.servizi_autorizzati and len(current_user.servizi_autorizzati) > 0:
                # Include clients with matching servizio_id OR clients with no servizio_id (null/undefined)
                servizio_filter = {
                    "$or": [
                        {"servizio_id": {"$in": current_user.servizi_autorizzati}},
                        {"servizio_id": None},
                        {"servizio_id": {"$exists": False}}
                    ]
                }
                query["$and"] = [user_filter, servizio_filter]
                print(f"  Filtering by servizi_autorizzati: {current_user.servizi_autorizzati}")
            else:
                query.update(user_filter)
                print(f"  No servizi filter applied")
            
            # Filter by authorized commesse (if defined)
            if hasattr(current_user, 'commesse_autorizzate') and current_user.commesse_autorizzate and len(current_user.commesse_autorizzate) > 0:
                commesse_filter = {
                    "$or": [
                        {"commessa_id": {"$in": current_user.commesse_autorizzate}},
                        {"commessa_id": None},
                        {"commessa_id": {"$exists": False}}
                    ]
                }
                # Add commesse filter to existing query
                if "$and" in query:
                    query["$and"].append(commesse_filter)
                else:
                    query["$and"] = [user_filter, commesse_filter]
                print(f"  Filtering by commesse_autorizzate: {current_user.commesse_autorizzate}")
            
            print(f"🔍 RESPONSABILE_PRESIDI: Monitoring {len(user_ids_in_sub_agenzie)} users across {len(sub_agenzie_ids)} sub agenzie")
        else:
            # Se non ha sub agenzie assegnate, vede i propri clienti O quelli assegnati a lui
            print(f"⚠️ RESPONSABILE_PRESIDI: No sub agenzie assigned - own and assigned clients")
            query["$or"] = [
                {"created_by": current_user.id},
                {"assigned_to": current_user.id}
            ]
    
    elif current_user.role in [UserRole.RESPONSABILE_STORE, UserRole.STORE_ASSIST, UserRole.PROMOTER_PRESIDI]:
        # Ruoli Store e Presidi (escluso Responsabile Presidi): vedono clienti creati da loro O assegnati a loro
        print(f"🏪 {current_user.role} ACCESS: User {current_user.username} - own and assigned clients")
        query["$or"] = [
            {"created_by": current_user.id},
            {"assigned_to": current_user.id}
        ]
        
    elif current_user.role == UserRole.AREA_MANAGER:
        # Area Manager: vede clienti degli utenti con le stesse sub agenzie (stessa logica di Responsabile Presidi)
        print(f"🌍 AREA_MANAGER ACCESS: User {current_user.username} - clients from users with same sub agenzie")
        
        # Determina le sub agenzie da usare: può essere sub_agenzie_autorizzate O sub_agenzia_id
        sub_agenzie_ids = []
        if hasattr(current_user, 'sub_agenzie_autorizzate') and current_user.sub_agenzie_autorizzate:
            sub_agenzie_ids = current_user.sub_agenzie_autorizzate
            print(f"  Using sub_agenzie_autorizzate: {sub_agenzie_ids}")
        elif hasattr(current_user, 'sub_agenzia_id') and current_user.sub_agenzia_id:
            sub_agenzie_ids = [current_user.sub_agenzia_id]
            print(f"  Using sub_agenzia_id: {sub_agenzie_ids}")
        
        if sub_agenzie_ids:
            # Trova tutti gli utenti con le stesse sub agenzie
            users_in_sub_agenzie = await db.users.find({
                "sub_agenzia_id": {"$in": sub_agenzie_ids}
            }).to_list(length=None)
            
            user_ids_in_sub_agenzie = [user["id"] for user in users_in_sub_agenzie]
            user_ids_in_sub_agenzie.append(current_user.id)  # Include anche i propri clienti
            
            # Build base query with created_by OR assigned_to OR sub_agenzia_id
            user_filter = {
                "$or": [
                    {"created_by": {"$in": user_ids_in_sub_agenzie}},
                    {"assigned_to": {"$in": user_ids_in_sub_agenzie}},
                    {"sub_agenzia_id": {"$in": sub_agenzie_ids}}  # NEW: Include clients directly on authorized sub agenzie
                ]
            }
            
            # Filter by authorized services (only if defined and not empty)
            if current_user.servizi_autorizzati and len(current_user.servizi_autorizzati) > 0:
                # Include clients with matching servizio_id OR clients with no servizio_id (null/undefined)
                servizio_filter = {
                    "$or": [
                        {"servizio_id": {"$in": current_user.servizi_autorizzati}},
                        {"servizio_id": None},
                        {"servizio_id": {"$exists": False}}
                    ]
                }
                query["$and"] = [user_filter, servizio_filter]
                print(f"  Filtering by servizi_autorizzati: {current_user.servizi_autorizzati}")
            else:
                query.update(user_filter)
                print(f"  No servizi filter applied")
            
            # Filter by authorized commesse (if defined)
            if hasattr(current_user, 'commesse_autorizzate') and current_user.commesse_autorizzate and len(current_user.commesse_autorizzate) > 0:
                commesse_filter = {
                    "$or": [
                        {"commessa_id": {"$in": current_user.commesse_autorizzate}},
                        {"commessa_id": None},
                        {"commessa_id": {"$exists": False}}
                    ]
                }
                # Add commesse filter to existing query
                if "$and" in query:
                    query["$and"].append(commesse_filter)
                else:
                    query["$and"] = [user_filter, commesse_filter]
                print(f"  Filtering by commesse_autorizzate: {current_user.commesse_autorizzate}")
            
            print(f"🔍 AREA_MANAGER: Monitoring {len(user_ids_in_sub_agenzie)} users across {len(sub_agenzie_ids)} sub agenzie")
        else:
            # Se non ha sub agenzie assegnate, vede i propri clienti O quelli assegnati a lui
            print(f"⚠️ AREA_MANAGER: No sub agenzie assigned - own and assigned clients")
            query["$or"] = [
                {"created_by": current_user.id},
                {"assigned_to": current_user.id}
            ]
        
    else:
        # Ruolo non riconosciuto - accesso negato
        print(f"❌ UNKNOWN ROLE: {current_user.role} for user {current_user.username}")
        raise HTTPException(status_code=403, detail=f"Role {current_user.role} not authorized for client access")
    
    # NEW (feb 2026): per BACKOFFICE_COMMESSA, escludi i clienti delle sub agenzie privilegiate
    # con tipologie "nascoste" (campo `hidden_tipologie_for_bo_commessa` su sub_agenzie).
    # Esempio: sub agenzia X ha `hidden_tipologie_for_bo_commessa = ["TELEFONIA"]` ⇒ il BO Commessa
    # NON vede i clienti X con tipologia_contratto == "TELEFONIA".
    if current_user.role == UserRole.BACKOFFICE_COMMESSA:
        privileged_subs = await db.sub_agenzie.find({
            "hidden_tipologie_for_bo_commessa": {"$exists": True, "$ne": []}
        }).to_list(length=None)
        nor_conditions = []
        for sa in privileged_subs:
            hidden = sa.get("hidden_tipologie_for_bo_commessa") or []
            if not hidden:
                continue
            nor_conditions.append({
                "sub_agenzia_id": sa["id"],
                "tipologia_contratto": {"$in": hidden}
            })
        if nor_conditions:
            query.setdefault("$and", []).append({"$nor": nor_conditions})
            print(f"🔒 BO_COMMESSA HIDDEN FILTER: {len(nor_conditions)} sub agenzie con tipologie nascoste")
    
    # Filtri aggiuntivi dai parametri della query (se forniti)
    if commessa_id and commessa_id != "all":
        # Se commessa_id è specificata, aggiungiamola al filtro (se autorizzata)
        if "commessa_id" in query:
            # Se già esiste un filtro commessa, facciamo l'intersezione
            if isinstance(query["commessa_id"], dict) and "$in" in query["commessa_id"]:
                if commessa_id in query["commessa_id"]["$in"]:
                    query["commessa_id"] = commessa_id
                else:
                    # Commessa richiesta non autorizzata
                    raise HTTPException(status_code=403, detail="Access denied to this commessa")
            else:
                query["commessa_id"] = commessa_id
        else:
            # Per admin o altri ruoli senza filtro commessa preimpostato
            query["commessa_id"] = commessa_id
    
    # ===== APPLICAZIONE FILTRI MULTI-VALORE + ESCLUSIONI =====
    # NOTE: I controlli RBAC sopra (responsabile_commessa, backoffice_sub_agenzia, ecc.)
    # potrebbero aver già impostato chiavi su `query` (es. servizio_id, sub_agenzia_id).
    # Qui aggiungiamo i filtri richiesti dall'utente, intersecandoli con quelli esistenti.

    def _add_in_filter(field: str, values: List[str]):
        """Aggiunge un filtro $in al campo, intersecando con il vincolo già presente (se c'è)."""
        if not values:
            return
        # Se RBAC ha già forzato uno scope, il nuovo filtro deve essere un sotto-insieme
        existing = query.get(field)
        if isinstance(existing, dict) and "$in" in existing:
            allowed = set(existing["$in"]) & set(values)
            if not allowed:
                # nessun valore comune → non far rispondere clienti
                query[field] = {"$in": [], "$exists": True}
            else:
                query[field] = {"$in": list(allowed)}
        elif isinstance(existing, str):
            # Lo scope RBAC era un valore singolo: deve essere tra i valori richiesti
            if existing in values:
                pass  # ok, il singolo valore è coerente
            else:
                query[field] = {"$in": []}  # nessun match
        else:
            query[field] = {"$in": values} if len(values) > 1 else values[0]

    def _add_nin_filter(field: str, values: List[str]):
        """Aggiunge esclusione: campo presente E NON IN values (clienti con campo NULL non vengono toccati)."""
        if not values:
            return
        # $nin esclude solo i valori specifici. La spec utente dice: esclusione mostra solo clienti
        # con campo valorizzato e diverso → richiediamo $exists True + $nin
        condition = {"$exists": True, "$nin": values, "$ne": None}
        # Se c'è già un vincolo sul campo, lo combiniamo con $and
        existing = query.get(field)
        if existing is None:
            query[field] = condition
        else:
            # Combina via $and a livello query
            query.setdefault("$and", []).append({field: condition})
            # Manteniamo l'esistente sul campo (rimosso solo se è ridondante)

    # commessa_id (singolo): rimane single-select per il drilldown principale
    if commessa_id:
        if "commessa_id" in query:
            existing = query["commessa_id"]
            if isinstance(existing, dict) and "$in" in existing:
                if commessa_id not in existing["$in"]:
                    raise HTTPException(status_code=403, detail="Access denied to this commessa")
                query["commessa_id"] = commessa_id
            elif isinstance(existing, str) and existing != commessa_id:
                raise HTTPException(status_code=403, detail="Access denied to this commessa")
        else:
            query["commessa_id"] = commessa_id

    # sub_agenzia_id (multi)
    _add_in_filter("sub_agenzia_id", f_sub_agenzia)
    _add_nin_filter("sub_agenzia_id", f_sub_agenzia_ex)

    # status
    _add_in_filter("status", f_status)
    _add_nin_filter("status", f_status_ex)

    # tipologia_contratto
    _add_in_filter("tipologia_contratto", f_tipologia)
    _add_nin_filter("tipologia_contratto", f_tipologia_ex)

    # NEW: Filter by user (assigned_to OR created_by) to match UI display
    # UI shows assigned_to if exists, otherwise created_by, so filter must search both
    if f_assigned_to or f_created_by:
        # Combine include sets
        user_ids_include = list(set(f_assigned_to + f_created_by))
        user_filter = {
            "$or": [
                {"assigned_to": {"$in": user_ids_include}},
                {"created_by": {"$in": user_ids_include}},
            ]
        }
        if "$and" in query:
            query["$and"].append(user_filter)
        else:
            query.setdefault("$and", []).append(user_filter)

    # User EXCLUDE: cliente che NON ha né assigned_to né created_by tra gli esclusi
    if f_assigned_to_ex or f_created_by_ex:
        user_ids_exclude = list(set(f_assigned_to_ex + f_created_by_ex))
        # cliente escluso se assigned_to ∈ excl OR (assigned_to null AND created_by ∈ excl)
        # → mantieni cliente se assigned_to ∉ excl AND (created_by ∉ excl o assigned_to esiste)
        # Più semplice: nessuno dei due deve avere un valore nell'exclude list
        user_excl_filter = {
            "$nor": [
                {"assigned_to": {"$in": user_ids_exclude}},
                {"created_by": {"$in": user_ids_exclude}},
            ]
        }
        query.setdefault("$and", []).append(user_excl_filter)

    # servizio_id
    _add_in_filter("servizio_id", f_servizio)
    _add_nin_filter("servizio_id", f_servizio_ex)

    # segmento (con expansion compatibility)
    if f_segmento:
        expanded_segmenti = await _expand_segmento_filter_values(f_segmento)
        _add_in_filter("segmento", expanded_segmenti)
    if f_segmento_ex:
        expanded_segmenti_ex = await _expand_segmento_filter_values(f_segmento_ex)
        _add_nin_filter("segmento", expanded_segmenti_ex)

    # commessa_id_filter (separato dal commessa_id RBAC)
    if f_commessa_filter:
        # se commessa_id RBAC è già stato impostato, intersechiamo
        existing_comm = query.get("commessa_id")
        if isinstance(existing_comm, str):
            if existing_comm in f_commessa_filter:
                pass
            else:
                query["commessa_id"] = {"$in": []}  # nessun match
        elif isinstance(existing_comm, dict) and "$in" in existing_comm:
            inter = list(set(existing_comm["$in"]) & set(f_commessa_filter))
            query["commessa_id"] = {"$in": inter} if inter else {"$in": []}
        else:
            query["commessa_id"] = {"$in": f_commessa_filter} if len(f_commessa_filter) > 1 else f_commessa_filter[0]
    if f_commessa_filter_ex:
        _add_nin_filter("commessa_id", f_commessa_filter_ex)
    
    # NEW: Search filter (name, email, phone, codice_fiscale, partita_iva)
    if search and search.strip():
        search_term = search.strip()
        search_fields = ["nome", "cognome", "ragione_sociale", "email", "telefono", "codice_fiscale", "partita_iva"]

        def _or_for_token(tok):
            rgx = {"$regex": re.escape(tok), "$options": "i"}
            return {"$or": [{f: rgx} for f in search_fields]}

        tokens = [t for t in search_term.split() if t]
        if len(tokens) <= 1:
            # Un solo termine: match su qualsiasi campo
            search_conditions = _or_for_token(search_term)
        else:
            # Più termini (es. "Nome Cognome"): OGNI token deve matchare almeno un campo.
            # Così "Alessandro Piervincenzi" trova il cliente anche se nome e cognome sono su campi diversi.
            search_conditions = {"$and": [_or_for_token(t) for t in tokens]}

        # Combine with existing query using $and
        if query:
            query = {"$and": [query, search_conditions]}
        else:
            query = search_conditions
    
    # NEW: Date range filter on cliente.created_at (server-side, so pagination is consistent)
    # IMPORTANT (feb 2026): le date arrivano da UI in Europe/Rome (es. "2026-02-16" = inizio
    # del 16 feb a Roma). Convertiamo nell'intervallo UTC corretto gestendo l'ora legale.
    if date_from or date_to:
        from helpers import rome_date_to_utc_range
        date_filter = {}
        if date_from:
            try:
                start_utc, _ = rome_date_to_utc_range(date_from, current_user.timezone)
                date_filter["$gte"] = start_utc
            except ValueError:
                raise HTTPException(status_code=400, detail="Formato date_from non valido. Usa YYYY-MM-DD")
        if date_to:
            try:
                _, end_utc = rome_date_to_utc_range(date_to, current_user.timezone)
                date_filter["$lte"] = end_utc
            except ValueError:
                raise HTTPException(status_code=400, detail="Formato date_to non valido. Usa YYYY-MM-DD")
        if date_filter:
            # Coexist with previous filters via $and to avoid overwriting other constraints
            existing = query.get("created_at")
            if existing:
                query.setdefault("$and", []).append({"created_at": date_filter})
            else:
                query["created_at"] = date_filter

    print(f"🔍 FINAL QUERY for {current_user.role}: {query}")
    
    # Count total matching documents BEFORE pagination
    total = await db.clienti.count_documents(query)
    print(f"📊 Total matching clients: {total}")
    
    # Calculate pagination
    total_pages = (total + page_size - 1) // page_size  # Ceiling division
    skip = (page - 1) * page_size
    
    # Fetch paginated results
    clienti = await db.clienti.find(query).sort("created_at", -1).skip(skip).limit(page_size).to_list(length=page_size)
    print(f"📊 Returning page {page}/{total_pages} with {len(clienti)} clients for user {current_user.username}")
    
    # Enrich clienti with segmento_nome for display purposes
    for cliente in clienti:
        if cliente.get("segmento"):
            # Try to find segmento by ID or by tipo
            segmento_doc = await db.segmenti.find_one({
                "$or": [
                    {"id": cliente["segmento"]},
                    {"tipo": cliente["segmento"]}
                ]
            }, {"_id": 0})
            
            if segmento_doc:
                cliente["segmento_nome"] = segmento_doc.get("nome", cliente["segmento"])
            else:
                # Fallback: capitalize and format the segmento value
                cliente["segmento_nome"] = cliente["segmento"].capitalize()
        else:
            cliente["segmento_nome"] = "N/A"
    
    return ClientiPaginatedResponse(
        clienti=[Cliente(**c) for c in clienti],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/clienti/filter-options")
async def get_clienti_filter_options(current_user: User = Depends(get_current_user)):
    """Get dynamic filter options based on existing data in the system"""
    try:
        # Build base query based on user role (same logic as main clienti endpoint)
        base_query = {}
        
        if current_user.role == UserRole.ADMIN:
            pass  # Admin can see all
        elif current_user.role in [UserRole.RESPONSABILE_COMMESSA, UserRole.BACKOFFICE_COMMESSA]:
            if current_user.commesse_autorizzate:
                base_query["commessa_id"] = {"$in": current_user.commesse_autorizzate}
            else:
                base_query["_id"] = {"$exists": False}  # No results if no authorized commesse
        elif current_user.role in [UserRole.RESPONSABILE_SUB_AGENZIA, UserRole.BACKOFFICE_SUB_AGENZIA]:
            # Responsabile/BackOffice Sub Agenzia: see ALL clients from their sub agenzia
            # NO commessa or servizio filter - they manage the entire sub agenzia
            if current_user.sub_agenzia_id:
                base_query["sub_agenzia_id"] = current_user.sub_agenzia_id
            else:
                base_query["_id"] = {"$exists": False}
        elif current_user.role in [UserRole.AGENTE_SPECIALIZZATO, UserRole.OPERATORE, UserRole.RESPONSABILE_STORE, UserRole.STORE_ASSIST, UserRole.PROMOTER_PRESIDI]:
            # Agente Specializzato, Operatore, Responsabile Store, Store Assistant, Promoter Presidi
            # All these roles see clients created by them OR assigned to them
            # MUST match logic in GET /api/clienti endpoint (lines 10515-10521 and 10595-10601)
            base_query["$or"] = [
                {"created_by": current_user.id},
                {"assigned_to": current_user.id}
            ]
        elif current_user.role == UserRole.RESPONSABILE_PRESIDI:
            # Responsabile Presidi: see clients from users in their sub agenzie
            if hasattr(current_user, 'sub_agenzie_autorizzate') and current_user.sub_agenzie_autorizzate:
                users_in_sub_agenzie = await db.users.find({
                    "sub_agenzia_id": {"$in": current_user.sub_agenzie_autorizzate}
                }).to_list(length=None)
                
                user_ids_in_sub_agenzie = [user["id"] for user in users_in_sub_agenzie]
                user_ids_in_sub_agenzie.append(current_user.id)
                
                base_query["$or"] = [
                    {"created_by": {"$in": user_ids_in_sub_agenzie}},
                    {"assigned_to": {"$in": user_ids_in_sub_agenzie}}
                ]
            else:
                # Fallback: own and assigned clients
                base_query["$or"] = [
                    {"created_by": current_user.id},
                    {"assigned_to": current_user.id}
                ]
        elif current_user.role == UserRole.AREA_MANAGER:
            # Area Manager: vede clienti delle sub agenzie a lui assegnate (SAME LOGIC AS GET /api/clienti)
            # Determina le sub agenzie da usare: può essere sub_agenzie_autorizzate O sub_agenzia_id
            sub_agenzie_ids = []
            if hasattr(current_user, 'sub_agenzie_autorizzate') and current_user.sub_agenzie_autorizzate:
                sub_agenzie_ids = current_user.sub_agenzie_autorizzate
                print(f"  FILTER-OPTIONS: Using sub_agenzie_autorizzate: {sub_agenzie_ids}")
            elif hasattr(current_user, 'sub_agenzia_id') and current_user.sub_agenzia_id:
                sub_agenzie_ids = [current_user.sub_agenzia_id]
                print(f"  FILTER-OPTIONS: Using sub_agenzia_id: {sub_agenzie_ids}")
            
            if sub_agenzie_ids:
                # Trova tutti gli utenti con le stesse sub agenzie (SAME AS GET /api/clienti)
                users_in_sub_agenzie = await db.users.find({
                    "sub_agenzia_id": {"$in": sub_agenzie_ids}
                }).to_list(length=None)
                
                user_ids_in_sub_agenzie = [user["id"] for user in users_in_sub_agenzie]
                user_ids_in_sub_agenzie.append(current_user.id)  # Include anche i propri clienti
                
                # Build user filter (SAME AS GET /api/clienti)
                user_filter = {
                    "$or": [
                        {"created_by": {"$in": user_ids_in_sub_agenzie}},
                        {"assigned_to": {"$in": user_ids_in_sub_agenzie}},
                        {"sub_agenzia_id": {"$in": sub_agenzie_ids}}
                    ]
                }
                
                # CRITICAL: Apply servizi_autorizzati filter (SAME AS GET /api/clienti)
                if current_user.servizi_autorizzati and len(current_user.servizi_autorizzati) > 0:
                    servizio_filter = {
                        "$or": [
                            {"servizio_id": {"$in": current_user.servizi_autorizzati}},
                            {"servizio_id": None},
                            {"servizio_id": {"$exists": False}}
                        ]
                    }
                    base_query["$and"] = [user_filter, servizio_filter]
                    print(f"  FILTER-OPTIONS: Applying servizi filter: {current_user.servizi_autorizzati}")
                else:
                    base_query.update(user_filter)
                
                print(f"  FILTER-OPTIONS: Monitoring {len(user_ids_in_sub_agenzie)} users across {len(sub_agenzie_ids)} sub agenzie")
            else:
                # Se non ha sub agenzie assegnate, vede i propri clienti O quelli assegnati a lui
                base_query["$or"] = [
                    {"created_by": current_user.id},
                    {"assigned_to": current_user.id}
                ]
        else:
            base_query["_id"] = {"$exists": False}
        
        # Get available data from system collections AND actual client usage
        
        # Get tipologie contratto: combination of authorized + present in user's clients
        print(f"🔄 Loading tipologie for filter-options, user: {current_user.username} ({current_user.role})")
        
        # Get tipologie from user's existing clients
        tipologie_pipeline = [{"$match": base_query}] if base_query else []
        tipologie_pipeline += [
            {"$group": {"_id": "$tipologia_contratto"}},
            {"$match": {"_id": {"$ne": None, "$ne": ""}}},
            {"$sort": {"_id": 1}}
        ]
        tipologie_result = await db.clienti.aggregate(tipologie_pipeline).to_list(length=None)
        tipologie_from_clients = [item["_id"] for item in tipologie_result]
        print(f"  Tipologie from user's clients: {len(tipologie_from_clients)}")
        
        # Get ALL available tipologie (hardcoded + database) with labels
        all_tipologie_dict = {}
        
        use_hardcoded = await should_use_hardcoded_elements()
        if use_hardcoded:
            hardcoded_tipologie = await get_hardcoded_tipologie_contratto()
            for tipologia in hardcoded_tipologie:
                all_tipologie_dict[tipologia["value"]] = tipologia["label"]
        
        db_tipologie = await db.tipologie_contratto.find({"is_active": True}).to_list(length=None)
        for tipologia in db_tipologie:
            all_tipologie_dict[tipologia["id"]] = tipologia["nome"]
        
        print(f"  Total available tipologie: {len(all_tipologie_dict)}")
        
        # Build final list based on role and authorization
        allowed_tipologie_ids = set()
        
        # ALL USERS (including Admin): Show only tipologie present in their accessible clients
        # This ensures the filter shows only relevant options, not all system tipologie
        allowed_tipologie_ids = set(tipologie_from_clients)
        print(f"  Showing {len(allowed_tipologie_ids)} tipologie from user's accessible clients")
        
        # For roles that see clients BEYOND their own (Responsabile Commessa, Backoffice, Area Manager),
        # also include tipologie_autorizzate to allow filtering by all possible values
        # Store Assistant, Agente, Operatore should ONLY see tipologie from their own clients
        roles_with_extended_tipologie = [
            UserRole.RESPONSABILE_COMMESSA, 
            UserRole.BACKOFFICE_COMMESSA,
            UserRole.RESPONSABILE_SUB_AGENZIA,
            UserRole.BACKOFFICE_SUB_AGENZIA,
            UserRole.AREA_MANAGER
        ]
        
        if current_user.role in roles_with_extended_tipologie:
            if hasattr(current_user, 'tipologie_autorizzate') and current_user.tipologie_autorizzate:
                allowed_tipologie_ids.update(current_user.tipologie_autorizzate)
                print(f"  {current_user.role}: Added {len(current_user.tipologie_autorizzate)} authorized tipologie")
        
        # NO FALLBACK: If user has no accessible clients, return empty tipologie list
        # The filter should only show tipologie from clients the user can actually see
        # Showing all system tipologie when user has 0 clients is confusing and incorrect
        if not allowed_tipologie_ids:
            print(f"  ℹ️ User has no accessible clients - returning empty tipologie list")
        
        # Build final list with labels
        tipologie_contratto = []
        for tip_id in allowed_tipologie_ids:
            if tip_id in all_tipologie_dict:
                # Found in dictionary (hardcoded or database with matching key)
                tipologie_contratto.append({
                    "value": tip_id,
                    "label": all_tipologie_dict[tip_id]
                })
            else:
                # CRITICAL FIX: Handle string tipologie from client data that don't match dictionary keys
                # This happens when clients store tipologia as string but system expects UUID keys
                # For these cases, use the string value as both value and label
                if tip_id and isinstance(tip_id, str):
                    tipologie_contratto.append({
                        "value": tip_id,
                        "label": tip_id.replace("_", " ").title()  # Convert "energia_fastweb" to "Energia Fastweb"
                    })
                    print(f"  ⚠️ Using string tipologia as fallback: {tip_id}")
                else:
                    print(f"  ⚠️ Skipping invalid tipologia: {tip_id} (type: {type(tip_id)})")
        
        # Sort by label
        tipologie_contratto.sort(key=lambda x: x["label"])
        
        print(f"✅ Final tipologie_contratto: {len(tipologie_contratto)} items with labels")
        
        # Get status values from actual client data + possible values
        status_pipeline = [{"$match": base_query}] if base_query else []
        status_pipeline += [
            {"$group": {"_id": "$status"}},
            {"$match": {"_id": {"$ne": None, "$ne": ""}}},
            {"$sort": {"_id": 1}}
        ]
        status_result = await db.clienti.aggregate(status_pipeline).to_list(length=None)
        status_from_clients = [item["_id"] for item in status_result]
        
        # Add common status values that might be used
        common_status = ["nuovo", "attivo", "inattivo", "sospeso", "completato"]
        status_values = list(set(status_from_clients + common_status))
        
        # Get ALL segmenti available - merge da hardcoded, DB collection e valori effettivi sui clienti
        # FIX: prima era solo ["privato", "business"] hardcoded, ora include anche i custom user-created
        segmenti_pipeline = [{"$match": base_query}] if base_query else []
        segmenti_pipeline += [
            {"$group": {"_id": "$segmento"}},
            {"$match": {"_id": {"$ne": None, "$ne": ""}}},
            {"$sort": {"_id": 1}}
        ]
        segmenti_from_clients_result = await db.clienti.aggregate(segmenti_pipeline).to_list(length=None)
        segmenti_from_clients = [item["_id"] for item in segmenti_from_clients_result if item.get("_id")]

        # Add segmenti dalla collection (sia tipo che nome)
        segmenti_db = await db.segmenti.find({}, {"_id": 0}).to_list(length=None)
        segmenti_set = set(["privato", "business"])  # base values
        segmenti_set.update(segmenti_from_clients)
        for s in segmenti_db:
            tipo = s.get("tipo")
            nome = s.get("nome")
            if tipo:
                segmenti_set.add(tipo)
            if nome:
                segmenti_set.add(nome)

        # Filter out empty + UUIDs (mantieni solo nomi/tipi leggibili)
        segmenti_values = sorted([
            v for v in segmenti_set
            if v and (len(str(v)) < 30 or " " in str(v))  # esclude UUID lunghi
        ])
        
        # Get sub agenzie from ACTUAL clients - shows only sub agenzie in the client list
        print(f"🔄 Loading sub agenzie for filter-options from actual clients")
        
        # Extract unique sub_agenzia_id from user's accessible clients
        sub_agenzie_pipeline = [{"$match": base_query}] if base_query else []
        sub_agenzie_pipeline += [
            {"$group": {"_id": "$sub_agenzia_id"}},
            {"$match": {"_id": {"$ne": None, "$ne": ""}}},
            {"$sort": {"_id": 1}}
        ]
        sub_agenzie_result = await db.clienti.aggregate(sub_agenzie_pipeline).to_list(length=None)
        sub_agenzia_ids_from_clients = [item["_id"] for item in sub_agenzie_result]
        print(f"  Sub agenzie from accessible clients: {len(sub_agenzia_ids_from_clients)}")
        
        # Now fetch sub agenzie details for these IDs only
        if sub_agenzia_ids_from_clients:
            sub_agenzie_cursor = db.sub_agenzie.find({"id": {"$in": sub_agenzia_ids_from_clients}})
            sub_agenzie = await sub_agenzie_cursor.to_list(length=None)
            print(f"  Found {len(sub_agenzie)} sub agenzie details")
        else:
            sub_agenzie = []
            print(f"  No sub agenzie found in accessible clients")
        
        # Get users from accessible clients
        print(f"🔄 Loading users for filter-options")
        
        # All roles including Responsabile Presidi: get users from visible clients only
        if True:
            # For other roles: get users from accessible clients
            try:
                print(f"  📥 Calling get_clienti for user {current_user.username} ({current_user.role})")
                visible_clienti = await get_clienti(
                    current_user=current_user,
                    commessa_id=None,
                    sub_agenzia_id=None,
                    status=None,
                    tipologia_contratto=None,
                    assigned_to=None,
                    created_by=None,
                    servizio_id=None,
                    segmento=None,
                    commessa_id_filter=None
                )
                print(f"  📤 get_clienti returned {len(visible_clienti)} clients")
                
                # Extract unique user IDs from both assigned_to and created_by
                all_user_ids = set()
                for cliente in visible_clienti:
                    assigned = getattr(cliente, 'assigned_to', None)
                    created = getattr(cliente, 'created_by', None)
                    if assigned:
                        all_user_ids.add(assigned)
                    if created:
                        all_user_ids.add(created)
                
                user_ids_from_clients = [uid for uid in all_user_ids if uid]
                print(f"  Users from {len(visible_clienti)} visible clients: {len(user_ids_from_clients)} unique user_ids: {user_ids_from_clients[:5]}")
                
                # Now fetch user details for these IDs only
                if user_ids_from_clients:
                    users_cursor = db.users.find({"id": {"$in": user_ids_from_clients}})
                    users = await users_cursor.to_list(length=None)
                else:
                    users = []
                    
            except Exception as e:
                print(f"  ⚠️ Error getting visible clienti: {e}")
                # Fallback to base_query approach
                visible_clienti_cursor = db.clienti.find(base_query, {"assigned_to": 1, "created_by": 1, "_id": 0})
                visible_clienti = await visible_clienti_cursor.to_list(length=None)
                
                all_user_ids = set()
                for cliente in visible_clienti:
                    if cliente.get("assigned_to"):
                        all_user_ids.add(cliente["assigned_to"])
                    if cliente.get("created_by"):
                        all_user_ids.add(cliente["created_by"])
                
                user_ids_from_clients = [uid for uid in all_user_ids if uid]
                print(f"  Users from {len(visible_clienti)} visible clients (fallback): {len(user_ids_from_clients)} unique user_ids")
                
                # Now fetch user details for these IDs only
                if user_ids_from_clients:
                    users_cursor = db.users.find({"id": {"$in": user_ids_from_clients}})
                    users = await users_cursor.to_list(length=None)
                else:
                    users = []
        
        # Process users for display (common for all roles)
        print(f"  Found {len(users)} user details in users collection")
        
        # NEW: Get servizi authorized for current user
        servizi_query = {}
        if current_user.role == UserRole.ADMIN:
            # Admin sees all servizi
            pass  
        else:
            # Other users see only servizi they are authorized for
            if hasattr(current_user, 'servizi_autorizzati') and current_user.servizi_autorizzati:
                servizi_query["id"] = {"$in": current_user.servizi_autorizzati}
            elif hasattr(current_user, 'commesse_autorizzate') and current_user.commesse_autorizzate:
                # If no direct servizi authorization, get servizi from authorized commesse
                servizi_query["commessa_id"] = {"$in": current_user.commesse_autorizzate}
        
        servizi_cursor = db.servizi.find(servizi_query)
        servizi = await servizi_cursor.to_list(length=None)
        
        # NEW: Get commesse authorized for current user
        commesse_query = {}
        if current_user.role == UserRole.ADMIN:
            # Admin sees all commesse
            pass
        else:
            # Other users see only their authorized commesse
            if hasattr(current_user, 'commesse_autorizzate') and current_user.commesse_autorizzate:
                commesse_query["id"] = {"$in": current_user.commesse_autorizzate}
            elif hasattr(current_user, 'sub_agenzia_id') and current_user.sub_agenzia_id:
                # Get commesse from user's sub agenzia
                sub_agenzia = await db.sub_agenzie.find_one({"id": current_user.sub_agenzia_id})
                if sub_agenzia and sub_agenzia.get("commesse_autorizzate"):
                    commesse_query["id"] = {"$in": sub_agenzia["commesse_autorizzate"]}
        
        commesse_cursor = db.commesse.find(commesse_query)
        commesse = await commesse_cursor.to_list(length=None)
        
        # Map enum values to display names
        def map_tipologia_display(tipologia):
            mapping = {
                "energia_fastweb": "Energia Fastweb",
                "fotovoltaico": "Fotovoltaico",
                "efficientamento_energetico": "Efficientamento Energetico"
            }
            return mapping.get(tipologia, tipologia.replace("_", " ").title())
        
        def map_segmento_display(segmento):
            mapping = {
                "privato": "Privato",
                "business": "Business"
            }
            return mapping.get(segmento, segmento.replace("_", " ").title())
        
        def map_status_display(status):
            # Map to uppercase to match client card display format
            mapping = {
                "attivo": "ATTIVO",
                "inattivo": "INATTIVO", 
                "sospeso": "SOSPESO",
                "nuovo": "NUOVO",
                "completato": "COMPLETATO"
            }
            return mapping.get(status, status.replace("_", " ").upper())
        
        # Format response with display names
        return {
            # tipologie_contratto is already a list of {"value": ..., "label": ...} objects
            "tipologie_contratto": tipologie_contratto,
            "status_values": [
                {"value": status, "label": map_status_display(status)} 
                for status in sorted([s for s in status_values if s is not None])
            ],
            "segmenti": (lambda: [
                {"value": seg, "label": map_segmento_display(seg)}
                for seg in sorted({
                    # Dedup canonicalizzato: lowercase preferito ma keep custom names as-is
                    s.lower() if s and s.lower() in ("privato", "business") else s
                    for s in segmenti_values if s
                })
            ])(),
            "sub_agenzie": [
                {"value": sub["id"], "label": sub["nome"]} 
                for sub in sorted(sub_agenzie, key=lambda x: x.get("nome", "") or "")
            ],
            "users": [
                {"value": user["id"], "label": user.get('username', 'Unknown')}
                for user in sorted(users, key=lambda x: x.get("username", "") or "")
            ],
            # NEW: Additional filter options
            "servizi": [
                {"value": servizio["id"], "label": servizio.get("nome", "Nome non disponibile")}
                for servizio in sorted(servizi, key=lambda x: x.get("nome", "") or "")
            ],
            "commesse": [
                {"value": commessa["id"], "label": commessa.get("nome", "Nome non disponibile")}
                for commessa in sorted(commesse, key=lambda x: x.get("nome", "") or "")
            ]
        }
        
    except Exception as e:
        import traceback
        logging.error(f"Error getting clienti filter options: {str(e)}")
        logging.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Errore nel caricamento opzioni filtri: {str(e)}")

@router.get("/clienti/export/excel")
async def export_clienti_excel(
    sub_agenzia_id: Optional[List[str]] = Query(None),
    sub_agenzia_id_exclude: Optional[List[str]] = Query(None),
    tipologia_contratto: Optional[List[str]] = Query(None),
    tipologia_contratto_exclude: Optional[List[str]] = Query(None),
    status: Optional[List[str]] = Query(None),
    status_exclude: Optional[List[str]] = Query(None),
    created_by: Optional[List[str]] = Query(None),  # DEPRECATED: Use assigned_to instead
    created_by_exclude: Optional[List[str]] = Query(None),
    assigned_to: Optional[List[str]] = Query(None),  # NEW: Filter by assigned user (not creator)
    assigned_to_exclude: Optional[List[str]] = Query(None),
    servizio_id: Optional[List[str]] = Query(None),  # NEW: Servizio filter
    servizio_id_exclude: Optional[List[str]] = Query(None),
    segmento: Optional[List[str]] = Query(None),  # NEW: Segmento filter
    segmento_exclude: Optional[List[str]] = Query(None),
    commessa_id_filter: Optional[List[str]] = Query(None),  # NEW: Commessa filter
    commessa_id_filter_exclude: Optional[List[str]] = Query(None),
    search: Optional[str] = Query(None),  # NEW: Search query
    search_type: Optional[str] = Query(None, regex="^(all|id|cognome|codice_fiscale|partita_iva|telefono|email)$"),  # NEW: Search type
    date_from: Optional[str] = Query(None),  # NEW: Date range filter (start)
    date_to: Optional[str] = Query(None),  # NEW: Date range filter (end)
    current_user: User = Depends(get_current_user)
):
    """Export clienti to Excel with enhanced filters and expanded SIM rows.

    All filters mirror the listing endpoint (`GET /api/clienti`): multi-value via repeated
    query params (e.g. `?status=A&status=B`) and exclusion via `<name>_exclude`.
    """
    try:
        from datetime import datetime, timezone

        def _clean_list(v):
            if not v:
                return []
            return [x for x in v if x and x != "all"]

        f_sub_agenzia = _clean_list(sub_agenzia_id)
        f_sub_agenzia_ex = _clean_list(sub_agenzia_id_exclude)
        f_tipologia = _clean_list(tipologia_contratto)
        f_tipologia_ex = _clean_list(tipologia_contratto_exclude)
        f_status = _clean_list(status)
        f_status_ex = _clean_list(status_exclude)
        f_assigned_to = _clean_list(assigned_to)
        f_assigned_to_ex = _clean_list(assigned_to_exclude)
        f_created_by = _clean_list(created_by)
        f_created_by_ex = _clean_list(created_by_exclude)
        f_servizio = _clean_list(servizio_id)
        f_servizio_ex = _clean_list(servizio_id_exclude)
        f_segmento = _clean_list(segmento)
        f_segmento_ex = _clean_list(segmento_exclude)
        f_commessa_filter = _clean_list(commessa_id_filter)
        f_commessa_filter_ex = _clean_list(commessa_id_filter_exclude)

        # Build query based on user role and filters (reuse logic from main endpoint)
        query = {}
        
        # Role-based access control for EXPORT
        # Export must filter by Sub Agenzia, Commessa AND Servizio autorizzati
        if current_user.role == UserRole.ADMIN:
            pass  # Admin can see all
        elif current_user.role in [UserRole.RESPONSABILE_COMMESSA, UserRole.BACKOFFICE_COMMESSA]:
            # Filter by authorized commesse AND servizi (servizi: include null/missing per
            # consentire la visibilità dei clienti senza servizio_id assegnato esplicitamente)
            if current_user.commesse_autorizzate:
                query["commessa_id"] = {"$in": current_user.commesse_autorizzate}
            else:
                query["_id"] = {"$exists": False}
            if current_user.servizi_autorizzati:
                query.setdefault("$and", []).append({
                    "$or": [
                        {"servizio_id": {"$in": current_user.servizi_autorizzati}},
                        {"servizio_id": None},
                        {"servizio_id": {"$exists": False}},
                    ]
                })
        elif current_user.role in [UserRole.RESPONSABILE_SUB_AGENZIA, UserRole.BACKOFFICE_SUB_AGENZIA]:
            # Filter by sub_agenzia, commesse AND servizi autorizzati
            if current_user.sub_agenzia_id:
                query["sub_agenzia_id"] = current_user.sub_agenzia_id
            else:
                query["_id"] = {"$exists": False}
            if current_user.commesse_autorizzate:
                query["commessa_id"] = {"$in": current_user.commesse_autorizzate}
            if current_user.servizi_autorizzati:
                query["servizio_id"] = {"$in": current_user.servizi_autorizzati}
        elif current_user.role in [UserRole.AGENTE_SPECIALIZZATO, UserRole.OPERATORE, UserRole.RESPONSABILE_STORE, UserRole.STORE_ASSIST, UserRole.PROMOTER_PRESIDI]:
            # Filter by own/assigned clients AND authorized sub agenzia/commessa/servizio
            query["$or"] = [
                {"created_by": current_user.id},
                {"assigned_to": current_user.id}
            ]
            if current_user.sub_agenzia_id:
                query["sub_agenzia_id"] = current_user.sub_agenzia_id
            if hasattr(current_user, 'commesse_autorizzate') and current_user.commesse_autorizzate:
                query["commessa_id"] = {"$in": current_user.commesse_autorizzate}
            if current_user.servizi_autorizzati:
                query["servizio_id"] = {"$in": current_user.servizi_autorizzati}
        elif current_user.role == UserRole.RESPONSABILE_PRESIDI:
            # Filter by authorized sub agenzie AND commesse/servizi
            if hasattr(current_user, 'sub_agenzie_autorizzate') and current_user.sub_agenzie_autorizzate:
                query["sub_agenzia_id"] = {"$in": current_user.sub_agenzie_autorizzate}
            elif current_user.sub_agenzia_id:
                query["sub_agenzia_id"] = current_user.sub_agenzia_id
            else:
                query["_id"] = {"$exists": False}
            if hasattr(current_user, 'commesse_autorizzate') and current_user.commesse_autorizzate:
                query["commessa_id"] = {"$in": current_user.commesse_autorizzate}
            if current_user.servizi_autorizzati:
                query["servizio_id"] = {"$in": current_user.servizi_autorizzati}
        elif current_user.role == UserRole.AREA_MANAGER:
            # Filter by authorized sub agenzie AND commesse/servizi
            if hasattr(current_user, 'sub_agenzie_autorizzate') and current_user.sub_agenzie_autorizzate:
                query["sub_agenzia_id"] = {"$in": current_user.sub_agenzie_autorizzate}
            else:
                query["_id"] = {"$exists": False}
            if hasattr(current_user, 'commesse_autorizzate') and current_user.commesse_autorizzate:
                query["commessa_id"] = {"$in": current_user.commesse_autorizzate}
            if current_user.servizi_autorizzati:
                query["servizio_id"] = {"$in": current_user.servizi_autorizzati}
        else:
            query["_id"] = {"$exists": False}
        
        # Apply additional filters (multi-select with include/exclude semantics matching listing endpoint)
        def _add_in(field: str, values: List[str]):
            if not values:
                return
            existing = query.get(field)
            if isinstance(existing, dict) and "$in" in existing:
                inter = list(set(existing["$in"]) & set(values))
                query[field] = {"$in": inter} if inter else {"$in": []}
            elif isinstance(existing, str):
                if existing not in values:
                    query[field] = {"$in": []}
            else:
                query[field] = {"$in": values} if len(values) > 1 else values[0]

        def _add_nin(field: str, values: List[str]):
            if not values:
                return
            cond = {"$exists": True, "$nin": values, "$ne": None}
            if query.get(field) is None:
                query[field] = cond
            else:
                query.setdefault("$and", []).append({field: cond})

        _add_in("sub_agenzia_id", f_sub_agenzia)
        _add_nin("sub_agenzia_id", f_sub_agenzia_ex)
        _add_in("tipologia_contratto", f_tipologia)
        _add_nin("tipologia_contratto", f_tipologia_ex)
        _add_in("status", f_status)
        _add_nin("status", f_status_ex)

        # Assigned_to / created_by: UI mostra assigned_to OR fallback created_by, quindi filtriamo per entrambi
        user_ids_include = list(set(f_assigned_to + f_created_by))
        if user_ids_include:
            user_filter = {
                "$or": [
                    {"assigned_to": {"$in": user_ids_include}},
                    {"created_by": {"$in": user_ids_include}},
                ]
            }
            query.setdefault("$and", []).append(user_filter)
        user_ids_exclude = list(set(f_assigned_to_ex + f_created_by_ex))
        if user_ids_exclude:
            user_excl_filter = {
                "$nor": [
                    {"assigned_to": {"$in": user_ids_exclude}},
                    {"created_by": {"$in": user_ids_exclude}},
                ]
            }
            query.setdefault("$and", []).append(user_excl_filter)

        _add_in("servizio_id", f_servizio)
        _add_nin("servizio_id", f_servizio_ex)

        if f_segmento:
            expanded = await _expand_segmento_filter_values(f_segmento)
            _add_in("segmento", expanded)
        if f_segmento_ex:
            expanded_ex = await _expand_segmento_filter_values(f_segmento_ex)
            _add_nin("segmento", expanded_ex)

        _add_in("commessa_id", f_commessa_filter)
        _add_nin("commessa_id", f_commessa_filter_ex)
        
        # NEW: Add search filter for nome, cognome, CF, etc.
        if search and search.strip():
            search_value = search.strip()
            search_type_value = search_type or 'all'
            
            if search_type_value == 'all':
                # Search in multiple fields (case-insensitive regex)
                query["$or"] = [
                    {"nome": {"$regex": search_value, "$options": "i"}},
                    {"cognome": {"$regex": search_value, "$options": "i"}},
                    {"codice_fiscale": {"$regex": search_value, "$options": "i"}},
                    {"email": {"$regex": search_value, "$options": "i"}},
                    {"telefono": {"$regex": search_value, "$options": "i"}},
                    {"partita_iva": {"$regex": search_value, "$options": "i"}},
                    {"id": {"$regex": search_value, "$options": "i"}}
                ]
            elif search_type_value == 'id':
                query["id"] = {"$regex": search_value, "$options": "i"}
            elif search_type_value == 'cognome':
                query["cognome"] = {"$regex": search_value, "$options": "i"}
            elif search_type_value == 'codice_fiscale':
                query["codice_fiscale"] = {"$regex": search_value, "$options": "i"}
            elif search_type_value == 'partita_iva':
                query["partita_iva"] = {"$regex": search_value, "$options": "i"}
            elif search_type_value == 'telefono':
                query["telefono"] = {"$regex": search_value, "$options": "i"}
            elif search_type_value == 'email':
                query["email"] = {"$regex": search_value, "$options": "i"}
        
        # NEW: Add date range filter for creation period
        # (feb 2026) interpretazione Europe/Rome → UTC
        if date_from or date_to:
            from helpers import rome_date_to_utc_range
            date_query = {}
            if date_from:
                start_utc, _ = rome_date_to_utc_range(date_from, current_user.timezone)
                date_query["$gte"] = start_utc
            if date_to:
                _, end_utc = rome_date_to_utc_range(date_to, current_user.timezone)
                date_query["$lte"] = end_utc
            
            if date_query:
                query["created_at"] = date_query
        
        # NEW (feb 2026): BACKOFFICE_COMMESSA — escludi clienti delle sub agenzie con tipologie nascoste
        if current_user.role == UserRole.BACKOFFICE_COMMESSA:
            privileged_subs = await db.sub_agenzie.find({
                "hidden_tipologie_for_bo_commessa": {"$exists": True, "$ne": []}
            }).to_list(length=None)
            nor_conditions = []
            for sa in privileged_subs:
                hidden = sa.get("hidden_tipologie_for_bo_commessa") or []
                if not hidden:
                    continue
                nor_conditions.append({
                    "sub_agenzia_id": sa["id"],
                    "tipologia_contratto": {"$in": hidden}
                })
            if nor_conditions:
                query.setdefault("$and", []).append({"$nor": nor_conditions})
        
        # Get clienti with enriched data
        clienti = await db.clienti.find(query).sort("created_at", -1).to_list(length=None)
        
        # Enrich data with related info and expand SIM rows
        expanded_rows = []
        for cliente in clienti:
            base_cliente = dict(cliente)
            
            # Get sub agenzia name
            if cliente.get("sub_agenzia_id"):
                sub_agenzia = await db["sub_agenzie"].find_one({"id": cliente["sub_agenzia_id"]})
                base_cliente["sub_agenzia_name"] = sub_agenzia.get("nome") if sub_agenzia else ""
            else:
                base_cliente["sub_agenzia_name"] = ""
            
            # Get commessa name
            if cliente.get("commessa_id"):
                commessa = await db["commesse"].find_one({"id": cliente["commessa_id"]})
                base_cliente["commessa_name"] = commessa.get("nome") if commessa else ""
            else:
                base_cliente["commessa_name"] = ""
            
            # Get servizio name
            if cliente.get("servizio_id"):
                servizio = await db["servizi"].find_one({"id": cliente["servizio_id"]})
                base_cliente["servizio_name"] = servizio.get("nome") if servizio else ""
            else:
                base_cliente["servizio_name"] = ""
            
            # Map tipologia contratto to display name
            tipologia = cliente.get("tipologia_contratto", "")
            base_cliente["tipologia_contratto_display"] = tipologia.replace("_", " ").title() if tipologia else ""
            
            # Map segmento ID to display name (lookup in database)
            segmento_id = cliente.get("segmento", "")
            if segmento_id:
                # Try to find segmento by ID in the database
                segmento_doc = await db.segmenti.find_one({"id": segmento_id})
                if segmento_doc:
                    base_cliente["segmento_display"] = segmento_doc.get("nome", segmento_id)
                else:
                    # Fallback: capitalize the value if not found (might be old data with string value)
                    base_cliente["segmento_display"] = segmento_id.capitalize() if segmento_id else ""
            else:
                base_cliente["segmento_display"] = ""
            
            # Get offerta name (principale del cliente)
            if cliente.get("offerta_id"):
                offerta = await db["offerte"].find_one({"id": cliente["offerta_id"]})
                if offerta:
                    offerta_nome = offerta.get("nome", "")
                    base_cliente["offerta_name"] = offerta_nome if offerta_nome else ""
                    logging.info(f"Cliente {cliente.get('id', 'N/A')[:8]} - Offerta found: {offerta_nome}")
                else:
                    base_cliente["offerta_name"] = ""
                    logging.warning(f"Cliente {cliente.get('id', 'N/A')[:8]} - Offerta NOT found for ID: {cliente.get('offerta_id')}")
            else:
                base_cliente["offerta_name"] = ""
                logging.info(f"Cliente {cliente.get('id', 'N/A')[:8]} - No offerta_id")
            
            # Get creator name - Use assigned_to if present, otherwise created_by
            user_id_to_display = cliente.get("assigned_to") or cliente.get("created_by")
            if user_id_to_display:
                user_doc = await db["users"].find_one({"id": user_id_to_display})
                base_cliente["created_by_name"] = user_doc.get("username") if user_doc else ""
            else:
                base_cliente["created_by_name"] = ""
            
            # Check if cliente has SIM items (convergenza or mobile) or convergenza fissa
            convergenza_items = cliente.get("convergenza_items", [])
            mobile_items = cliente.get("mobile_items", [])
            has_convergenza = cliente.get("convergenza", False)
            
            # If cliente has convergenza or SIM items, create multiple rows
            if has_convergenza or convergenza_items or mobile_items:
                
                # FIRST: If convergenza is enabled, create row for LINEA FISSA
                if has_convergenza:
                    row = base_cliente.copy()
                    row["sim_type"] = "Linea Fissa"
                    row["sim_index"] = ""
                    row["sim_numero_cellulare"] = ""
                    row["sim_iccid"] = ""
                    row["sim_operatore"] = ""
                    row["sim_telefono_da_portare"] = ""
                    row["sim_titolare_diverso"] = ""
                    row["sim_offerta_name"] = ""
                    row["sim_assigned_user"] = ""
                    # Ensure offerta_name is populated for Linea Fissa row
                    # This shows the fixed line offer (cliente.offerta_id)
                    if not row.get("offerta_name"):
                        row["offerta_name"] = ""
                    # Linea fissa mantiene i dati di tecnologia, codice migrazione, gestore
                    expanded_rows.append(row)
                
                # SECOND: Process convergenza SIM items
                for idx, sim in enumerate(convergenza_items):
                    row = base_cliente.copy()
                    row["sim_type"] = "SIM Convergenza"
                    row["sim_index"] = idx + 1
                    row["sim_numero_cellulare"] = sim.get("numero_cellulare", "")
                    row["sim_iccid"] = sim.get("iccid", "")
                    row["sim_operatore"] = sim.get("operatore", "")
                    row["sim_telefono_da_portare"] = ""
                    row["sim_titolare_diverso"] = ""
                    
                    # Get assigned user for this SIM
                    if sim.get("assigned_user_id"):
                        assigned_user = await db["users"].find_one({"id": sim["assigned_user_id"]})
                        row["sim_assigned_user"] = assigned_user.get("username") if assigned_user else ""
                    else:
                        row["sim_assigned_user"] = ""
                    
                    # Get offerta SIM name
                    if sim.get("offerta_sim"):
                        # offerta_sim could be an ID or a name, check if it's an ID (UUID format)
                        if len(sim["offerta_sim"]) > 30:  # Likely an ID
                            offerta_sim = await db["offerte"].find_one({"id": sim["offerta_sim"]})
                            row["sim_offerta_name"] = offerta_sim.get("nome") if offerta_sim else sim["offerta_sim"]
                        else:
                            row["sim_offerta_name"] = sim["offerta_sim"]
                    else:
                        row["sim_offerta_name"] = ""
                    
                    expanded_rows.append(row)
                
                # Process mobile items
                for idx, mobile in enumerate(mobile_items):
                    row = base_cliente.copy()
                    row["sim_type"] = "Mobile"
                    row["sim_index"] = idx + 1
                    row["sim_numero_cellulare"] = ""
                    row["sim_iccid"] = mobile.get("iccid", "")
                    row["sim_operatore"] = mobile.get("operatore", "")
                    row["sim_telefono_da_portare"] = mobile.get("telefono_da_portare", "")
                    row["sim_titolare_diverso"] = mobile.get("titolare_diverso", "")
                    row["sim_offerta_name"] = ""  # Mobile items don't have offerta
                    row["sim_assigned_user"] = ""  # Mobile items don't have assigned user (for now)
                    
                    expanded_rows.append(row)
            else:
                # No SIM items, add single row with empty SIM fields
                row = base_cliente.copy()
                row["sim_type"] = ""
                row["sim_index"] = ""
                row["sim_numero_cellulare"] = ""
                row["sim_iccid"] = ""
                row["sim_operatore"] = ""
                row["sim_telefono_da_portare"] = ""
                row["sim_titolare_diverso"] = ""
                row["sim_offerta_name"] = ""
                row["sim_assigned_user"] = ""
                expanded_rows.append(row)
        
        # Create Excel file
        excel_file_path = await create_clienti_excel_report(expanded_rows, f"clienti_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        
        # Return Excel file
        return FileResponse(
            path=excel_file_path,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename=f"clienti_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        )
        
    except Exception as e:
        logging.error(f"Error in clienti Excel export: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Errore nell'export Excel: {str(e)}")


# ============================================
# ANALYTICS ENDPOINTS
# ============================================


@router.get("/clienti/{cliente_id}", response_model=Cliente)
async def get_cliente(cliente_id: str, current_user: User = Depends(get_current_user)):
    """Get specific cliente with role-based access control"""
    cliente_doc = await db.clienti.find_one({"id": cliente_id})
    if not cliente_doc:
        raise HTTPException(status_code=404, detail="Cliente not found")
    
    # Enrich with segmento_nome for display
    if cliente_doc.get("segmento"):
        segmento_doc = await db.segmenti.find_one({
            "$or": [
                {"id": cliente_doc["segmento"]},
                {"tipo": cliente_doc["segmento"]}
            ]
        }, {"_id": 0})
        
        if segmento_doc:
            cliente_doc["segmento_nome"] = segmento_doc.get("nome", cliente_doc["segmento"])
        else:
            cliente_doc["segmento_nome"] = cliente_doc["segmento"].capitalize()
    else:
        cliente_doc["segmento_nome"] = "N/A"
    
    cliente = Cliente(**cliente_doc)
    
    # CRITICAL FIX: Role-based access control for single client
    if current_user.role == UserRole.ADMIN:
        # Admin può accedere a qualsiasi cliente
        print(f"🔓 ADMIN ACCESS: User {current_user.username} accessing client {cliente_id}")
        return cliente
        
    elif current_user.role == UserRole.RESPONSABILE_COMMESSA:
        # Responsabile Commessa: deve essere autorizzato per la commessa del cliente
        accessible_commesse = await get_user_accessible_commesse(current_user)
        if cliente.commessa_id not in accessible_commesse:
            raise HTTPException(status_code=403, detail="Access denied to this client's commessa")
            
    elif current_user.role == UserRole.BACKOFFICE_COMMESSA:
        # BackOffice Commessa: deve essere autorizzato per la commessa del cliente
        if hasattr(current_user, 'commesse_autorizzate') and current_user.commesse_autorizzate:
            if cliente.commessa_id not in current_user.commesse_autorizzate:
                raise HTTPException(status_code=403, detail="Access denied to this client's commessa")
        else:
            accessible_commesse = await get_user_accessible_commesse(current_user)
            if cliente.commessa_id not in accessible_commesse:
                raise HTTPException(status_code=403, detail="Access denied to this client's commessa")
        # NEW (feb 2026): se il cliente è di una sub agenzia privilegiata con tipologia nascosta, blocca l'accesso
        if cliente.sub_agenzia_id:
            sub_doc = await db.sub_agenzie.find_one({"id": cliente.sub_agenzia_id})
            if sub_doc:
                hidden = sub_doc.get("hidden_tipologie_for_bo_commessa") or []
                if hidden and cliente.tipologia_contratto and cliente.tipologia_contratto in hidden:
                    raise HTTPException(status_code=403, detail="Access denied: cliente nascosto per la tua role (tipologia riservata)")
                
    elif current_user.role in [UserRole.RESPONSABILE_SUB_AGENZIA, UserRole.BACKOFFICE_SUB_AGENZIA]:
        # Responsabile/BackOffice Sub Agenzia: deve essere della stessa sub agenzia
        if not hasattr(current_user, 'sub_agenzia_id') or not current_user.sub_agenzia_id:
            raise HTTPException(status_code=403, detail="User has no assigned sub agenzia")
        if cliente.sub_agenzia_id != current_user.sub_agenzia_id:
            raise HTTPException(status_code=403, detail="Access denied to client from different sub agenzia")
            
    elif current_user.role in [UserRole.AGENTE_SPECIALIZZATO, UserRole.OPERATORE]:
        # Agente Specializzato & Operatore: possono vedere solo clienti creati da loro
        if cliente.created_by != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied - you can only view clients you created")
            
    else:
        raise HTTPException(status_code=403, detail=f"Role {current_user.role} not authorized for client access")
    
    print(f"✅ ACCESS GRANTED: User {current_user.username} ({current_user.role}) accessing client {cliente_id}")
    return cliente

@router.put("/clienti/{cliente_id}", response_model=Cliente)
async def update_cliente(
    cliente_id: str,
    cliente_update: ClienteUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update cliente"""
    try:
        cliente_doc = await db.clienti.find_one({"id": cliente_id})
        if not cliente_doc:
            raise HTTPException(status_code=404, detail="Cliente not found")
        
        cliente = Cliente(**cliente_doc)
        
        # Verifica permessi di modifica
        if not await can_user_modify_cliente(current_user, cliente):
            raise HTTPException(status_code=403, detail="No permission to modify this cliente")
        
        # Only ADMIN, BACKOFFICE_COMMESSA and RESPONSABILE_COMMESSA can modify status field by default.
        # NEW (feb 2026): BACKOFFICE_SUB_AGENZIA può modificare lo status se la propria sub agenzia
        # ha il flag `can_change_status=True` e il cliente appartiene a quella sub agenzia.
        status_changed_via_sub_agenzia_privilege = False
        if cliente_update.status is not None:
            allowed_status_roles = [UserRole.ADMIN, UserRole.BACKOFFICE_COMMESSA, UserRole.RESPONSABILE_COMMESSA]
            can_modify_status = current_user.role in allowed_status_roles
            if not can_modify_status and current_user.role == UserRole.BACKOFFICE_SUB_AGENZIA:
                # Verifica che il cliente sia della stessa sub agenzia dell'utente
                # E che la sub agenzia abbia il privilegio attivo
                if getattr(current_user, "sub_agenzia_id", None) and cliente.sub_agenzia_id == current_user.sub_agenzia_id:
                    sub_doc = await db.sub_agenzie.find_one({"id": current_user.sub_agenzia_id})
                    if sub_doc and sub_doc.get("can_change_status"):
                        can_modify_status = True
                        status_changed_via_sub_agenzia_privilege = True
            if not can_modify_status:
                # If user is not authorized, restore original status
                cliente_update.status = cliente.status
                logging.warning(f"User {current_user.username} (role: {current_user.role}) attempted to modify status - permission denied")
        
        # Prepare update data with special handling for empty fields
        update_dict = cliente_update.dict()
        
        # Handle empty email field - convert empty string to None, validate if not empty
        if update_dict.get('email') == "":
            update_dict['email'] = None
        elif update_dict.get('email') and '@' not in str(update_dict.get('email')):
            # If email is provided but not valid, set to None
            logging.warning(f"Invalid email format provided: {update_dict.get('email')}, setting to None")
            update_dict['email'] = None
        
        # Handle tipologia_contratto - convert UUID to nome user-created if needed
        # IMPORTANT: questo campo è dinamico e accetta QUALSIASI nome user-created.
        # NON normalizzare più a lowercase/underscore (era un bug legacy che produceva
        # 'energia_fastweb' invece di 'ENERGIA').
        if update_dict.get('tipologia_contratto'):
            tipologia_value = update_dict['tipologia_contratto']
            # If it looks like a UUID (length > 20), try to convert it to the actual nome
            if len(str(tipologia_value)) > 20:
                tipologia_doc = await db.tipologie_contratto.find_one({"id": str(tipologia_value)})
                if tipologia_doc and tipologia_doc.get("nome"):
                    update_dict['tipologia_contratto'] = tipologia_doc["nome"]
                    # Save UUID anche su tipologia_contratto_id se non già presente
                    if not update_dict.get('tipologia_contratto_id'):
                        update_dict['tipologia_contratto_id'] = str(tipologia_value)
                    logging.info(f"Converted tipologia UUID {tipologia_value} → nome: {tipologia_doc['nome']}")
                else:
                    logging.warning(f"Tipologia UUID {tipologia_value} not found in DB, keeping original value")
        
        update_data = {k: v for k, v in update_dict.items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        # 📝 LOG: Rileva i cambiamenti prima dell'aggiornamento
        changes = await detect_client_changes(cliente, update_data)
        
        result = await db.clienti.update_one(
            {"id": cliente_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Cliente not found")
        
        # 📝 LOG: Registra i cambiamenti nel log
        if changes:
            # Log generico di aggiornamento
            change_descriptions = [change["description"] for change in changes]
            
            await log_client_action(
                cliente_id=cliente_id,
                action=ClienteLogAction.UPDATED,
                description=f"Anagrafica aggiornata: {'; '.join(change_descriptions)}",
                user=current_user,
                old_value=f"{cliente.nome} {cliente.cognome}",
                new_value=f"Aggiornati {len(changes)} campi",
                metadata={
                    "changes_count": len(changes),
                    "changes": changes,
                    "updated_fields": [change["field"] for change in changes]
                }
            )
            
            # Log specifico per cambio status (se presente)
            status_change = next((change for change in changes if change["field"] == "status"), None)
            if status_change:
                status_metadata = {
                    "old_status": status_change["old_value"],
                    "new_status": status_change["new_value"],
                }
                if status_changed_via_sub_agenzia_privilege:
                    # NEW (feb 2026): traccia esplicitamente quando il cambio è fatto da BO Sub Agenzia con privilegio.
                    # Usato dall'endpoint /api/audit/sub-agenzia-status-changes.
                    status_metadata["via_sub_agenzia_privilege"] = True
                    status_metadata["sub_agenzia_id"] = current_user.sub_agenzia_id
                await log_client_action(
                    cliente_id=cliente_id,
                    action=ClienteLogAction.STATUS_CHANGED,
                    description=f"Status cambiato da '{status_change['old_value']}' a '{status_change['new_value']}'",
                    user=current_user,
                    old_value=status_change["old_value"],
                    new_value=status_change["new_value"],
                    metadata=status_metadata,
                )
        
        cliente_doc = await db.clienti.find_one({"id": cliente_id})
        
        # Enrich with segmento_nome for display
        if cliente_doc.get("segmento"):
            segmento_doc = await db.segmenti.find_one({
                "$or": [
                    {"id": cliente_doc["segmento"]},
                    {"tipo": cliente_doc["segmento"]}
                ]
            }, {"_id": 0})
            
            if segmento_doc:
                cliente_doc["segmento_nome"] = segmento_doc.get("nome", cliente_doc["segmento"])
            else:
                cliente_doc["segmento_nome"] = cliente_doc["segmento"].capitalize()
        else:
            cliente_doc["segmento_nome"] = "N/A"
        
        return Cliente(**cliente_doc)
    
    except HTTPException:
        raise
    except ValidationError as e:
        logging.error(f"❌ CLIENT UPDATE VALIDATION ERROR: {e}")
        raise HTTPException(status_code=422, detail=f"Errore validazione dati: {str(e)}")
    except Exception as e:
        logging.error(f"❌ CLIENT UPDATE ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

@router.put("/clienti/{cliente_id}/assign")
async def assign_cliente(
    cliente_id: str,
    assigned_to: str,
    current_user: User = Depends(get_current_user)
):
    """Assign cliente to a user - only Admin, Responsabile Commessa, and Backoffice Commessa can assign"""
    try:
        # Check if user has permission to assign (only specific roles)
        allowed_roles = [
            UserRole.ADMIN, 
            UserRole.RESPONSABILE_COMMESSA, 
            UserRole.BACKOFFICE_COMMESSA
        ]
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403, 
                detail="Solo Admin, Responsabile Commessa e Backoffice Commessa possono assegnare clienti"
            )
        
        cliente_doc = await db.clienti.find_one({"id": cliente_id})
        if not cliente_doc:
            raise HTTPException(status_code=404, detail="Cliente not found")
        
        cliente = Cliente(**cliente_doc)
        
        # Verifica permessi di modifica (only for non-admin)
        if current_user.role != UserRole.ADMIN:
            if not await can_user_modify_cliente(current_user, cliente):
                raise HTTPException(status_code=403, detail="No permission to modify this cliente")
        
        # Verify that target user has access to this cliente's commessa/sub_agenzia and servizio
        target_user_doc = await db.users.find_one({"id": assigned_to, "is_active": True})
        if not target_user_doc:
            raise HTTPException(status_code=404, detail="Utente target non trovato o non attivo")
        
        target_user = User(**target_user_doc)
        
        # Admin can be assigned to anyone
        if target_user.role != UserRole.ADMIN:
            # Check if target user has access via commessa OR sub_agenzia
            has_access = False
            
            # Check commesse_autorizzate
            if hasattr(target_user, 'commesse_autorizzate') and target_user.commesse_autorizzate:
                if cliente.commessa_id in target_user.commesse_autorizzate:
                    has_access = True
            
            # Check sub_agenzie_autorizzate (if no commessa access and cliente has sub_agenzia)
            if not has_access and cliente.sub_agenzia_id:
                if hasattr(target_user, 'sub_agenzie_autorizzate') and target_user.sub_agenzie_autorizzate:
                    if cliente.sub_agenzia_id in target_user.sub_agenzie_autorizzate:
                        has_access = True
            
            if not has_access:
                raise HTTPException(
                    status_code=403, 
                    detail="L'utente target non ha accesso alla commessa o sub-agenzia di questo cliente"
                )
            
            # Check if target user has access to cliente's servizio
            if cliente.servizio_id:
                if not hasattr(target_user, 'servizi_autorizzati') or not target_user.servizi_autorizzati:
                    raise HTTPException(
                        status_code=403, 
                        detail="L'utente target non ha servizi autorizzati"
                    )
                
                if cliente.servizio_id not in target_user.servizi_autorizzati:
                    raise HTTPException(
                        status_code=403, 
                        detail="L'utente target non ha accesso al servizio di questo cliente"
                    )
        
        # Update assignment
        result = await db.clienti.update_one(
            {"id": cliente_id},
            {"$set": {
                "assigned_to": assigned_to,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Cliente not found")
        
        # Log assignment action
        await log_client_action(
            cliente_id=cliente_id,
            action=ClienteLogAction.ASSIGNED,
            description=f"Cliente assegnato a utente {assigned_to}",
            user=current_user,
            old_value=cliente.assigned_to,
            new_value=assigned_to
        )
        
        # Return updated cliente
        cliente_doc = await db.clienti.find_one({"id": cliente_id})
        
        # Enrich with segmento_nome for display
        if cliente_doc.get("segmento"):
            segmento_doc = await db.segmenti.find_one({
                "$or": [
                    {"id": cliente_doc["segmento"]},
                    {"tipo": cliente_doc["segmento"]}
                ]
            }, {"_id": 0})
            
            if segmento_doc:
                cliente_doc["segmento_nome"] = segmento_doc.get("nome", cliente_doc["segmento"])
            else:
                cliente_doc["segmento_nome"] = cliente_doc["segmento"].capitalize()
        else:
            cliente_doc["segmento_nome"] = "N/A"
        
        return Cliente(**cliente_doc)
    
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"❌ CLIENT ASSIGNMENT ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

@router.get("/users/display-name/{user_id}")
async def get_user_display_name(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """Ottieni il nome visualizzabile di un utente per l'UI"""
    try:
        user = await db.users.find_one({"id": user_id})
        if user:
            # Rimuovi _id per evitare problemi di serializzazione
            if '_id' in user:
                del user['_id']
            
            display_name = f"{user.get('nome', '')} {user.get('cognome', '')}".strip()
            if not display_name:
                display_name = user.get('username', user_id)
            
            return {
                "user_id": user_id,
                "display_name": display_name,
                "username": user.get('username'),
                "role": user.get('role')
            }
        else:
            return {
                "user_id": user_id,
                "display_name": user_id[:8] + "...",
                "username": "Unknown",
                "role": "Unknown"
            }
    except Exception as e:
        logging.error(f"Error fetching user display name: {e}")
        return {
            "user_id": user_id,
            "display_name": "Error",
            "username": "Error",
            "role": "Error"
        }


# ============================================================================
# AUDIT: cambi status fatti da BO Sub Agenzia con privilegio (feb 2026)
# ============================================================================
@router.get("/audit/sub-agenzia-status-changes")
async def get_sub_agenzia_status_changes_audit(
    sub_agenzia_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    current_user: User = Depends(get_current_user)
):
    """Audit dedicato ai cambi status fatti da utenti Backoffice Sub Agenzia
    quando la loro sub agenzia ha il privilegio `can_change_status` attivo.

    Accessibile a: ADMIN, RESPONSABILE_COMMESSA.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.RESPONSABILE_COMMESSA]:
        raise HTTPException(status_code=403, detail="Solo Admin e Responsabile Commessa possono visualizzare questo audit")

    query: Dict[str, Any] = {
        "action": ClienteLogAction.STATUS_CHANGED.value,
        "metadata.via_sub_agenzia_privilege": True,
    }

    # Filtro per sub agenzia (singola)
    if sub_agenzia_id:
        query["metadata.sub_agenzia_id"] = sub_agenzia_id

    # Per Responsabile Commessa: filtra solo sub agenzie che includono commesse a lui autorizzate
    if current_user.role == UserRole.RESPONSABILE_COMMESSA:
        accessible_commesse = await get_user_accessible_commesse(current_user)
        if not accessible_commesse:
            return []
        sub_docs = await db.sub_agenzie.find({
            "commesse_autorizzate": {"$in": accessible_commesse}
        }).to_list(length=None)
        allowed_sub_ids = [s["id"] for s in sub_docs]
        if not allowed_sub_ids:
            return []
        if sub_agenzia_id and sub_agenzia_id not in allowed_sub_ids:
            raise HTTPException(status_code=403, detail="Sub agenzia non accessibile")
        query["metadata.sub_agenzia_id"] = {"$in": allowed_sub_ids} if not sub_agenzia_id else sub_agenzia_id

    # Filtro date (feb 2026: Europe/Rome → UTC)
    if date_from or date_to:
        from helpers import rome_date_to_utc_range
        ts_filter = {}
        if date_from:
            start_utc, _ = rome_date_to_utc_range(date_from, current_user.timezone)
            ts_filter["$gte"] = start_utc
        if date_to:
            _, end_utc = rome_date_to_utc_range(date_to, current_user.timezone)
            ts_filter["$lte"] = end_utc
        query["timestamp"] = ts_filter

    logs = await db.clienti_logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(length=None)

    # Enrichment: cliente nome+cognome, sub agenzia nome
    cliente_ids = list({log.get("cliente_id") for log in logs if log.get("cliente_id")})
    sub_ids = list({log.get("metadata", {}).get("sub_agenzia_id") for log in logs if log.get("metadata", {}).get("sub_agenzia_id")})

    clienti_map: Dict[str, Dict[str, Any]] = {}
    if cliente_ids:
        async for c in db.clienti.find({"id": {"$in": cliente_ids}}, {"_id": 0, "id": 1, "nome": 1, "cognome": 1, "tipologia_contratto": 1, "sub_agenzia_id": 1}):
            clienti_map[c["id"]] = c

    sub_map: Dict[str, str] = {}
    if sub_ids:
        async for s in db.sub_agenzie.find({"id": {"$in": sub_ids}}, {"_id": 0, "id": 1, "nome": 1}):
            sub_map[s["id"]] = s.get("nome", "")

    out = []
    for log in logs:
        meta = log.get("metadata") or {}
        cli = clienti_map.get(log.get("cliente_id")) or {}
        sub_id = meta.get("sub_agenzia_id") or cli.get("sub_agenzia_id")
        # Normalize timestamp to ISO string
        ts = log.get("timestamp")
        if hasattr(ts, "isoformat"):
            ts = ts.isoformat()
        out.append({
            "id": log.get("id"),
            "cliente_id": log.get("cliente_id"),
            "cliente_nome": cli.get("nome", ""),
            "cliente_cognome": cli.get("cognome", ""),
            "tipologia_contratto": cli.get("tipologia_contratto", ""),
            "sub_agenzia_id": sub_id,
            "sub_agenzia_nome": sub_map.get(sub_id, ""),
            "old_status": meta.get("old_status") or log.get("old_value"),
            "new_status": meta.get("new_status") or log.get("new_value"),
            "user_id": log.get("user_id"),
            "user_name": log.get("user_name"),
            "user_role": log.get("user_role"),
            "timestamp": ts,
        })
    return out


@router.get("/clienti/{cliente_id}/logs")
async def get_cliente_logs(
    cliente_id: str,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Recupera la cronologia completa delle azioni per un cliente"""
    
    # Verifica che l'utente possa accedere a questo cliente
    cliente_doc = await db.clienti.find_one({"id": cliente_id})
    if not cliente_doc:
        raise HTTPException(status_code=404, detail="Cliente not found")
    
    cliente = Cliente(**cliente_doc)
    
    # Verifica permessi: se l'utente può VEDERE il cliente (via GET /api/clienti), può vedere i log
    # Usa logica più permissiva rispetto a can_user_modify_cliente
    can_view = False
    
    if current_user.role == UserRole.ADMIN:
        can_view = True
    elif current_user.role == UserRole.RESPONSABILE_PRESIDI:
        # Responsabile Presidi: può vedere log di clienti nelle sue sub agenzie
        if hasattr(current_user, 'sub_agenzie_autorizzate') and current_user.sub_agenzie_autorizzate:
            # Verifica se il cliente appartiene a una delle sue sub agenzie
            if cliente.sub_agenzia_id in current_user.sub_agenzie_autorizzate:
                can_view = True
            else:
                # Verifica se il cliente è stato creato o assegnato a utenti nelle sue sub agenzie
                users_in_sub_agenzie = await db.users.find({
                    "sub_agenzia_id": {"$in": current_user.sub_agenzie_autorizzate}
                }).to_list(length=None)
                user_ids_in_sub_agenzie = [user["id"] for user in users_in_sub_agenzie]
                user_ids_in_sub_agenzie.append(current_user.id)
                
                if cliente.created_by in user_ids_in_sub_agenzie or cliente.assigned_to in user_ids_in_sub_agenzie:
                    can_view = True
        elif cliente.created_by == current_user.id or cliente.assigned_to == current_user.id:
            can_view = True
    elif current_user.role in [UserRole.AREA_MANAGER]:
        # Area Manager: stessa logica di Responsabile Presidi
        if hasattr(current_user, 'sub_agenzie_autorizzate') and current_user.sub_agenzie_autorizzate:
            if cliente.sub_agenzia_id in current_user.sub_agenzie_autorizzate:
                can_view = True
            else:
                users_in_sub_agenzie = await db.users.find({
                    "sub_agenzia_id": {"$in": current_user.sub_agenzie_autorizzate}
                }).to_list(length=None)
                user_ids_in_sub_agenzie = [user["id"] for user in users_in_sub_agenzie]
                user_ids_in_sub_agenzie.append(current_user.id)
                
                if cliente.created_by in user_ids_in_sub_agenzie or cliente.assigned_to in user_ids_in_sub_agenzie:
                    can_view = True
        elif cliente.created_by == current_user.id or cliente.assigned_to == current_user.id:
            can_view = True
    elif current_user.role in [UserRole.RESPONSABILE_SUB_AGENZIA, UserRole.BACKOFFICE_SUB_AGENZIA]:
        # Sub Agenzia roles: can view all clients from their sub agenzia
        if current_user.sub_agenzia_id and cliente.sub_agenzia_id == current_user.sub_agenzia_id:
            can_view = True
    else:
        # Per altri ruoli: usa la funzione can_user_modify_cliente esistente
        can_view = await can_user_modify_cliente(current_user, cliente)
    
    if not can_view:
        raise HTTPException(status_code=403, detail="No permission to view this cliente's logs")
    
    try:
        # Recupera i log ordinati per timestamp (più recenti prima)
        logs_cursor = db.clienti_logs.find({"cliente_id": cliente_id}).sort("timestamp", -1).limit(limit)
        logs = await logs_cursor.to_list(length=None)
        
        # Collect all user_ids from logs to fetch user details
        user_ids_in_logs = set()
        for log in logs:
            if log.get('user_id'):
                user_ids_in_logs.add(log['user_id'])
            # Also check in details for assigned_to changes
            if log.get('details'):
                details = log['details']
                if isinstance(details, dict):
                    if details.get('new_value'):
                        user_ids_in_logs.add(details['new_value'])
                    if details.get('old_value'):
                        user_ids_in_logs.add(details['old_value'])
        
        # Fetch user details for all user_ids found in logs
        user_map = {}
        if user_ids_in_logs:
            users_cursor = db.users.find({"id": {"$in": list(user_ids_in_logs)}})
            users = await users_cursor.to_list(length=None)
            user_map = {user['id']: user.get('username', 'Unknown') for user in users}
        
        # Rimuovi _id MongoDB e formatta per il frontend con nomi utente
        formatted_logs = []
        for log in logs:
            if '_id' in log:
                del log['_id']
            
            # Replace user_id with username
            if log.get('user_id') and log['user_id'] in user_map:
                log['user_name'] = user_map[log['user_id']]
            
            # Replace user_ids in details (for assigned_to changes)
            if log.get('details') and isinstance(log['details'], dict):
                details = log['details']
                if details.get('new_value') and details['new_value'] in user_map:
                    details['new_value_display'] = user_map[details['new_value']]
                if details.get('old_value') and details['old_value'] in user_map:
                    details['old_value_display'] = user_map[details['old_value']]
            
            # Formatta timestamp per display user-friendly
            if isinstance(log.get('timestamp'), datetime):
                log['timestamp_display'] = log['timestamp'].strftime('%d/%m/%Y %H:%M:%S')
            
            formatted_logs.append(log)
        
        return {
            "cliente_id": cliente_id,
            "cliente_name": f"{cliente.nome} {cliente.cognome}",
            "total_logs": len(formatted_logs),
            "logs": formatted_logs
        }
        
    except Exception as e:
        logging.error(f"Error fetching cliente logs: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nel recupero dei log: {str(e)}")

@router.delete("/clienti/{cliente_id}")
async def delete_cliente(
    cliente_id: str,
    current_user: User = Depends(get_current_user)
):
    """Soft delete cliente - sposta nel cestino invece di eliminare definitivamente"""
    
    # Check if cliente exists
    cliente_doc = await db.clienti.find_one({"id": cliente_id})
    if not cliente_doc:
        raise HTTPException(status_code=404, detail="Cliente not found")
    
    cliente = Cliente(**cliente_doc)
    
    # Verify user can delete this cliente (checks status lock and permissions)
    if not await can_user_delete_cliente(current_user, cliente):
        raise HTTPException(status_code=403, detail="No permission to delete this cliente")
    
    try:
        # SOFT DELETE: Mark as deleted instead of removing
        deleted_at = datetime.now(timezone.utc)
        
        await db.clienti.update_one(
            {"id": cliente_id},
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_at": deleted_at,
                    "deleted_by": current_user.id,
                    "deleted_by_username": current_user.username,
                    "last_assigned_to": cliente_doc.get("assigned_to"),  # Save for restore
                    "last_status": cliente_doc.get("status")  # Save original status
                }
            }
        )
        
        # Log the deletion
        await log_client_action(
            cliente_id=cliente_id,
            action=ClienteLogAction.STATUS_CHANGED,
            description=f"Cliente spostato nel cestino da {current_user.username}",
            user=current_user,
            old_value="attivo",
            new_value="cestino",
            metadata={
                "action_type": "soft_delete",
                "deleted_at": deleted_at.isoformat(),
                "deleted_by": current_user.id,
                "deleted_by_username": current_user.username
            }
        )
        
        return {
            "success": True, 
            "message": f"Cliente {cliente.nome} {cliente.cognome} spostato nel cestino",
            "can_restore": True
        }
        
    except Exception as e:
        logger.error(f"Error soft deleting cliente: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nell'eliminazione del cliente: {str(e)}")

# Importazione Clienti Endpoints
@router.post("/clienti/import/preview")
async def preview_clienti_import(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Preview clienti import file"""
    # Check permissions
    if current_user.role not in [UserRole.ADMIN, UserRole.OPERATORE, UserRole.BACKOFFICE_COMMESSA, UserRole.BACKOFFICE_AGENZIA]:
        raise HTTPException(status_code=403, detail="Insufficient permissions for import")
    
    # Validate file type
    allowed_extensions = ['csv', 'xls', 'xlsx']
    file_extension = file.filename.lower().split('.')[-1] if '.' in file.filename else ''
    
    if file_extension not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Supported: {allowed_extensions}")
    
    # Read file content
    try:
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=400, detail="File too large. Maximum size: 10MB")
        
        preview = await parse_uploaded_file(content, file.filename)
        return preview
        
    except Exception as e:
        logging.error(f"Preview import error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@router.post("/clienti/import/execute", response_model=ImportResult)
async def execute_clienti_import(
    file: UploadFile = File(...),
    config: str = Form(...),  # JSON string of ImportConfiguration
    current_user: User = Depends(get_current_user)
):
    """Execute clienti import"""
    # Check permissions
    if current_user.role not in [UserRole.ADMIN, UserRole.OPERATORE, UserRole.BACKOFFICE_COMMESSA, UserRole.BACKOFFICE_AGENZIA]:
        raise HTTPException(status_code=403, detail="Insufficient permissions for import")
    
    try:
        # Parse configuration
        import json
        config_dict = json.loads(config)
        import_config = ImportConfiguration(**config_dict)
        
        # Verify access to commessa
        if not await check_commessa_access(current_user, import_config.commessa_id):
            raise HTTPException(status_code=403, detail="Access denied to this commessa")
        
        # Verify sub agenzia exists and is authorized for commessa
        sub_agenzia = await db.sub_agenzie.find_one({"id": import_config.sub_agenzia_id})
        if not sub_agenzia:
            raise HTTPException(status_code=404, detail="Sub agenzia not found")
        
        if import_config.commessa_id not in sub_agenzia.get("commesse_autorizzate", []):
            raise HTTPException(status_code=400, detail="Sub agenzia not authorized for this commessa")
        
        # Read file content
        content = await file.read()
        
        # Process import
        result = await process_import_batch(
            content,
            file.filename,
            import_config,
            current_user.id
        )
        
        return result
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid configuration format")
    except Exception as e:
        logging.error(f"Execute import error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@router.get("/clienti/import/template/{file_type}")
async def download_import_template(
    file_type: str,
    current_user: User = Depends(get_current_user)
):
    """Download import template file"""
    if file_type not in ['csv', 'xlsx']:
        raise HTTPException(status_code=400, detail="Invalid file type. Use 'csv' or 'xlsx'")
    
    # Define template columns
    template_data = {
        'nome': ['Mario', 'Luigi', 'Anna'],
        'cognome': ['Rossi', 'Verdi', 'Bianchi'],
        'email': ['mario.rossi@email.com', 'luigi.verdi@email.com', 'anna.bianchi@email.com'],
        'telefono': ['+393471234567', '+393487654321', '+393451122334'],
        'indirizzo': ['Via Roma 1', 'Via Milano 23', 'Via Napoli 45'],
        'citta': ['Roma', 'Milano', 'Napoli'],
        'provincia': ['RM', 'MI', 'NA'],
        'cap': ['00100', '20100', '80100'],
        'codice_fiscale': ['RSSMRA80A01H501Z', 'VRDLGU75B15F205X', 'BNCNNA90C45F839Y'],
        'partita_iva': ['12345678901', '98765432109', '11223344556'],
        'note': ['Cliente VIP', 'Contatto commerciale', 'Referenziato']
    }
    
    df = pd.DataFrame(template_data)
    
    if file_type == 'csv':
        # Create CSV
        output = io.BytesIO()
        df.to_csv(output, index=False, encoding='utf-8')
        output.seek(0)
        
        return StreamingResponse(
            io.BytesIO(output.getvalue()),
            media_type="application/csv",
            headers={"Content-Disposition": "attachment; filename=template_clienti.csv"}
        )
    
    elif file_type == 'xlsx':
        # Create Excel
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Clienti', index=False)
        output.seek(0)
        
        return StreamingResponse(
            io.BytesIO(output.getvalue()),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=template_clienti.xlsx"}
        )

# CORS Configuration - Support for production domain
