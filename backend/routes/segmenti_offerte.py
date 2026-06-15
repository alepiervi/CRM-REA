"""Route: Segmenti e Offerte — estratte da server.py (refactoring fase 2, giugno 2026)."""
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

# ================================
# SEGMENTI ENDPOINTS
# ================================

@router.get("/tipologie-contratto/{tipologia_id}/segmenti")
async def get_segmenti_by_tipologia(
    tipologia_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get segmenti for a specific tipologia contratto"""
    
    try:
        # Check if tipologia exists
        tipologia = await db.tipologie_contratto.find_one({"id": tipologia_id})
        if not tipologia:
            raise HTTPException(status_code=404, detail="Tipologia contratto non trovata")
        
        # Get segmenti for this tipologia
        segmenti = await db.segmenti.find({
            "tipologia_contratto_id": tipologia_id
        }).to_list(length=None)
        
        # If no segmenti exist, create the default ones (Privato and Business)
        if not segmenti:
            default_segmenti = [
                {
                    "id": str(uuid.uuid4()),
                    "tipo": "privato",
                    "nome": "Privato",
                    "tipologia_contratto_id": tipologia_id,
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc)
                },
                {
                    "id": str(uuid.uuid4()),
                    "tipo": "business", 
                    "nome": "Business",
                    "tipologia_contratto_id": tipologia_id,
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc)
                }
            ]
            
            # Insert default segmenti
            await db.segmenti.insert_many(default_segmenti)
            segmenti = default_segmenti
        
        # Clean up for JSON serialization
        for segmento in segmenti:
            if "_id" in segmento:
                del segmento["_id"]
            if "created_at" in segmento and hasattr(segmento["created_at"], "isoformat"):
                segmento["created_at"] = segmento["created_at"].isoformat()
            if "updated_at" in segmento and segmento["updated_at"] and hasattr(segmento["updated_at"], "isoformat"):
                segmento["updated_at"] = segmento["updated_at"].isoformat()
        
        return segmenti
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching segmenti for tipologia {tipologia_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nel caricamento segmenti: {str(e)}")

@router.put("/segmenti/{segmento_id}")
async def update_segmento(
    segmento_id: str,
    update_data: SegmentoUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update segmento (principalmente per attivare/disattivare)"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo gli admin possono modificare i segmenti")
    
    try:
        update_dict = update_data.dict(exclude_unset=True)
        if update_dict:
            update_dict["updated_at"] = datetime.now(timezone.utc)
        
        result = await db.segmenti.update_one(
            {"id": segmento_id},
            {"$set": update_dict}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Segmento non trovato")
        
        return {"success": True, "message": "Segmento aggiornato con successo"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating segmento: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nell'aggiornamento: {str(e)}")

@router.put("/segmenti/{segmento_id}/aruba-config")
async def update_segmento_aruba_config(
    segmento_id: str,
    config: SegmentoArubaDriveConfig,
    current_user: User = Depends(get_current_user)
):
    """Update Aruba Drive configuration for a specific segmento"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo gli admin possono modificare la configurazione Aruba Drive")
    
    try:
        # Check if segmento exists
        segmento = await db.segmenti.find_one({"id": segmento_id})
        if not segmento:
            raise HTTPException(status_code=404, detail="Segmento non trovato")
        
        # Update aruba_config
        config_dict = config.dict()
        
        result = await db.segmenti.update_one(
            {"id": segmento_id},
            {"$set": {
                "aruba_config": config_dict,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Segmento non trovato")
        
        return {
            "success": True, 
            "message": "Configurazione Aruba Drive aggiornata con successo",
            "segmento_id": segmento_id,
            "config_enabled": config.enabled
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating segmento aruba config: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nell'aggiornamento configurazione: {str(e)}")

@router.get("/segmenti/{segmento_id}/aruba-config")
async def get_segmento_aruba_config(
    segmento_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get Aruba Drive configuration for a specific segmento"""
    
    try:
        segmento = await db.segmenti.find_one({"id": segmento_id})
        if not segmento:
            raise HTTPException(status_code=404, detail="Segmento non trovato")
        
        aruba_config = segmento.get("aruba_config", {})
        
        return {
            "success": True,
            "segmento_id": segmento_id,
            "aruba_config": aruba_config
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting segmento aruba config: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nel caricamento configurazione: {str(e)}")

# ================================
# OFFERTE ENDPOINTS
# ================================

@router.get("/segmenti/{segmento_id}/offerte")
async def get_offerte_by_segmento(
    segmento_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get offerte for a specific segmento (excludes sub-offerte)"""
    
    try:
        # Check if segmento exists
        segmento = await db.segmenti.find_one({"id": segmento_id})
        if not segmento:
            raise HTTPException(status_code=404, detail="Segmento non trovato")
        
        # Get offerte for this segmento (exclude sub-offerte)
        offerte = await db.offerte.find({
            "segmento_id": segmento_id,
            "$or": [
                {"parent_offerta_id": None},
                {"parent_offerta_id": {"$exists": False}}
            ]
        }).sort("created_at", -1).to_list(length=None)
        
        # Clean up for JSON serialization
        for offerta in offerte:
            if "_id" in offerta:
                del offerta["_id"]
            if "created_at" in offerta and hasattr(offerta["created_at"], "isoformat"):
                offerta["created_at"] = offerta["created_at"].isoformat()
            if "updated_at" in offerta and offerta["updated_at"] and hasattr(offerta["updated_at"], "isoformat"):
                offerta["updated_at"] = offerta["updated_at"].isoformat()
        
        return offerte
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching offerte for segmento {segmento_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nel caricamento offerte: {str(e)}")

@router.post("/offerte")
async def create_offerta(
    offerta_data: OffertaCreate,
    current_user: User = Depends(get_current_user)
):
    """Create new offerta"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo gli admin possono creare offerte")
    
    try:
        # Check if segmento exists
        segmento = await db.segmenti.find_one({"id": offerta_data.segmento_id})
        if not segmento:
            raise HTTPException(status_code=404, detail="Segmento non trovato")
        
        # Create offerta
        offerta_dict = offerta_data.dict()
        offerta_dict.update({
            "id": str(uuid.uuid4()),
            "created_at": datetime.now(timezone.utc),
            "created_by": current_user.id
        })
        
        result = await db.offerte.insert_one(offerta_dict)
        
        return {
            "success": True,
            "message": "Offerta creata con successo",
            "offerta_id": offerta_dict["id"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating offerta: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nella creazione: {str(e)}")

@router.get("/offerte", response_model=List[OffertaModel])
async def get_all_offerte(
    segmento: Optional[str] = None,
    commessa_id: Optional[str] = None,
    servizio_id: Optional[str] = None,
    tipologia_contratto_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all offerte with optional filters for entire filiera (commessa, servizio, tipologia, segmento)
    NOTE: This endpoint excludes sub-offerte (offerte with parent_offerta_id set)"""
    try:
        query_conditions = []
        
        # CRITICAL: Exclude sub-offerte from main list
        query_conditions.append({
            "$or": [
                {"parent_offerta_id": None},
                {"parent_offerta_id": {"$exists": False}}
            ]
        })
        
        # Handle segmento - support both UUID and string ("privato"/"business")
        if segmento:
            segmento_ids = [segmento]  # Start with the provided value
            
            # If it's a string like "privato" or "business", find all matching UUID segmenti
            if segmento in ["privato", "business"]:
                # Find all segmenti with this name
                segmenti_docs = await db.segmenti.find({}).to_list(length=None)
                matching_uuids = [
                    seg["id"] for seg in segmenti_docs 
                    if seg.get("nome", "").lower() == segmento.lower()
                ]
                segmento_ids.extend(matching_uuids)
            
            # Query: match if segmento_id is in any of the identified IDs
            query_conditions.append({"segmento_id": {"$in": segmento_ids}})
        
        if is_active is not None:
            query_conditions.append({"is_active": is_active})
        
        # Build filiera filter - SIMPLIFIED
        # Show ONLY offerte that match: segmento + tipologia (mandatory) + (commessa/servizio if set)
        
        final_conditions = []
        
        # 1. MANDATORY: tipologia must match (or be empty in offerta)
        if tipologia_contratto_id and '-' in tipologia_contratto_id:
            final_conditions.append({
                "$or": [
                    {"tipologia_contratto_id": tipologia_contratto_id},
                    {"tipologia_contratto_id": None},
                    {"tipologia_contratto_id": ""}
                ]
            })
        
        # 2. Commessa: if provided, offerta must match OR be null
        if commessa_id:
            final_conditions.append({
                "$or": [
                    {"commessa_id": commessa_id},
                    {"commessa_id": None},
                    {"commessa_id": ""}
                ]
            })
        
        # 3. Servizio: if provided, offerta must match OR be null
        if servizio_id:
            final_conditions.append({
                "$or": [
                    {"servizio_id": servizio_id},
                    {"servizio_id": None},
                    {"servizio_id": ""}
                ]
            })
        
        # Add these to query_conditions
        if final_conditions:
            query_conditions.extend(final_conditions)
        
        # Final query
        if query_conditions:
            query = {"$and": query_conditions} if len(query_conditions) > 1 else query_conditions[0]
        else:
            query = {}
        
        offerte = await db.offerte.find(query).to_list(length=None)
        return [OffertaModel(**off) for off in offerte]
        
    except Exception as e:
        logger.error(f"Error fetching offerte: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nel recupero offerte: {str(e)}")

@router.get("/offerte/{offerta_id}", response_model=OffertaModel)
async def get_offerta(
    offerta_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get single offerta by ID"""
    try:
        offerta = await db.offerte.find_one({"id": offerta_id})
        if not offerta:
            raise HTTPException(status_code=404, detail="Offerta non trovata")
        
        return OffertaModel(**offerta)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching offerta: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nel recupero offerta: {str(e)}")

@router.get("/offerte/{offerta_id}/sub-offerte")
async def get_sub_offerte(
    offerta_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get sub-offerte for a specific parent offerta"""
    try:
        logging.info(f"🔍 Fetching sub-offerte for offerta: {offerta_id}")
        
        # Check if parent offerta exists and has sub-offerte enabled
        parent_offerta = await db.offerte.find_one({"id": offerta_id})
        if not parent_offerta:
            raise HTTPException(status_code=404, detail="Offerta non trovata")
        
        if not parent_offerta.get("has_sub_offerte", False):
            logging.info(f"📭 Offerta {offerta_id} does not have sub-offerte enabled")
            return []
        
        # Find all sub-offerte for this parent
        sub_offerte_docs = await db.offerte.find({
            "parent_offerta_id": offerta_id,
            "is_active": True
        }).to_list(length=None)
        
        logging.info(f"✅ Found {len(sub_offerte_docs)} sub-offerte for offerta {offerta_id}")
        
        # Convert to JSON serializable format
        sub_offerte = []
        for doc in sub_offerte_docs:
            if '_id' in doc:
                del doc['_id']
            sub_offerte.append(doc)
        
        return sub_offerte
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching sub-offerte: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nel recupero sub-offerte: {str(e)}")

@router.put("/offerte/{offerta_id}")
async def update_offerta(
    offerta_id: str,
    update_data: OffertaUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update offerta (nome, descrizione, attivazione/disattivazione)"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo gli admin possono modificare le offerte")
    
    try:
        update_dict = update_data.dict(exclude_unset=True)
        if update_dict:
            update_dict["updated_at"] = datetime.now(timezone.utc)
        
        result = await db.offerte.update_one(
            {"id": offerta_id},
            {"$set": update_dict}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Offerta non trovata")
        
        return {"success": True, "message": "Offerta aggiornata con successo"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating offerta: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nell'aggiornamento: {str(e)}")

@router.delete("/offerte/{offerta_id}")
async def delete_offerta(
    offerta_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete offerta permanently"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo gli admin possono eliminare le offerte")
    
    try:
        # Check if offerta is used by any clienti (if you have such relationship)
        # clienti_count = await db.clienti.count_documents({"offerta_id": offerta_id})
        # 
        # if clienti_count > 0:
        #     raise HTTPException(
        #         status_code=400, 
        #         detail=f"Impossibile eliminare: offerta utilizzata da {clienti_count} clienti"
        #     )
        
        # Delete offerta
        result = await db.offerte.delete_one({"id": offerta_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Offerta non trovata")
        
        return {"success": True, "message": "Offerta eliminata con successo"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting offerta: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nell'eliminazione: {str(e)}")

@router.get("/segmenti")  
async def get_segmenti(current_user: User = Depends(get_current_user)):
    """Get available segmenti"""
    return [
        {"value": "privato", "label": "Privato"},
        {"value": "business", "label": "Business"}
    ]

# Gestione Sub Agenzie
@router.post("/sub-agenzie", response_model=SubAgenzia)
async def create_sub_agenzia(sub_agenzia_data: SubAgenziaCreate, current_user: User = Depends(get_current_user)):
    """Create new sub agenzia"""
    # Solo admin e responsabile commessa possono creare sub agenzie
    if current_user.role not in [UserRole.ADMIN, UserRole.RESPONSABILE_COMMESSA]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Verifica che l'utente abbia accesso alle commesse specificate
    for commessa_id in sub_agenzia_data.commesse_autorizzate:
        if not await check_commessa_access(current_user, commessa_id):
            raise HTTPException(status_code=403, detail=f"No access to commessa {commessa_id}")
    
    # I privilegi can_change_status e hidden_tipologie_for_bo_commessa
    # possono essere impostati solo dall'Admin. Se chi crea non è admin, vengono ignorati.
    payload = sub_agenzia_data.dict()
    if current_user.role != UserRole.ADMIN:
        payload["can_change_status"] = False
        payload["hidden_tipologie_for_bo_commessa"] = []
    
    sub_agenzia = SubAgenzia(
        **payload,
        created_by=current_user.id
    )
    await db.sub_agenzie.insert_one(sub_agenzia.dict())
    
    return sub_agenzia

@router.get("/sub-agenzie", response_model=List[SubAgenzia])
async def get_sub_agenzie(
    commessa_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get sub agenzie accessible to current user"""
    query = {"is_active": True}
    
    if current_user.role == UserRole.ADMIN:
        # Admin vede tutte
        if commessa_id:
            query["commesse_autorizzate"] = {"$in": [commessa_id]}
    elif current_user.role in [UserRole.RESPONSABILE_SUB_AGENZIA, UserRole.BACKOFFICE_SUB_AGENZIA]:
        # Questi ruoli vedono solo la loro sub agenzia
        # Cerca l'autorizzazione per ottenere la sub_agenzia_id
        authorizations = await db.user_commessa_authorizations.find({
            "user_id": current_user.id,
            "is_active": True
        }).to_list(length=None)
        
        if not authorizations:
            return []
        
        # Raccoglie tutte le sub agenzie autorizzate
        sub_agenzia_ids = []
        for auth in authorizations:
            if auth.get("sub_agenzia_id"):
                sub_agenzia_ids.append(auth["sub_agenzia_id"])
        
        if not sub_agenzia_ids:
            return []
        
        query["id"] = {"$in": sub_agenzia_ids}
        
        # Filter by authorized services
        if current_user.servizi_autorizzati:
            query["servizi_autorizzati"] = {"$in": current_user.servizi_autorizzati}
        
        if commessa_id:
            query["commesse_autorizzate"] = {"$in": [commessa_id]}
    else:
        # Altri ruoli vedono le sub agenzie delle loro commesse E servizi
        accessible_commesse = await get_user_accessible_commesse(current_user)
        query["commesse_autorizzate"] = {"$in": accessible_commesse}
        
        # Filter by authorized services
        if current_user.servizi_autorizzati:
            query["servizi_autorizzati"] = {"$in": current_user.servizi_autorizzati}
        
        if commessa_id:
            if commessa_id not in accessible_commesse:
                raise HTTPException(status_code=403, detail="Access denied to this commessa")
            query["commesse_autorizzate"] = {"$in": [commessa_id]}
    
    sub_agenzie = await db.sub_agenzie.find(query).to_list(length=None)
    return [SubAgenzia(**sa) for sa in sub_agenzie]

@router.put("/sub-agenzie/{sub_agenzia_id}", response_model=SubAgenzia)
async def update_sub_agenzia(
    sub_agenzia_id: str,
    sub_agenzia_update: SubAgenziaUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update sub agenzia"""
    if current_user.role not in [UserRole.ADMIN, UserRole.RESPONSABILE_COMMESSA]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Get current sub agenzia
    current_sub_agenzia = await db.sub_agenzie.find_one({"id": sub_agenzia_id})
    if not current_sub_agenzia:
        raise HTTPException(status_code=404, detail="Sub Agenzia not found")
    
    # Verifica autorizzazioni per le nuove commesse
    if sub_agenzia_update.commesse_autorizzate:
        for commessa_id in sub_agenzia_update.commesse_autorizzate:
            if not await check_commessa_access(current_user, commessa_id):
                raise HTTPException(status_code=403, detail=f"No access to commessa {commessa_id}")
    
    update_data = {k: v for k, v in sub_agenzia_update.dict().items() if v is not None}
    # Solo l'Admin può modificare i privilegi can_change_status e hidden_tipologie_for_bo_commessa.
    # Se chi aggiorna non è admin, rimuoviamo silenziosamente questi campi dall'update.
    if current_user.role != UserRole.ADMIN:
        update_data.pop("can_change_status", None)
        update_data.pop("hidden_tipologie_for_bo_commessa", None)
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.sub_agenzie.update_one(
        {"id": sub_agenzia_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Sub Agenzia not found")

    sub_agenzia_doc = await db.sub_agenzie.find_one({"id": sub_agenzia_id})
    return SubAgenzia(**sub_agenzia_doc)

@router.delete("/sub-agenzie/{sub_agenzia_id}")
async def delete_sub_agenzia(
    sub_agenzia_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete sub agenzia"""
    if current_user.role not in [UserRole.ADMIN, UserRole.RESPONSABILE_COMMESSA]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Get current sub agenzia to check permissions
    sub_agenzia = await db.sub_agenzie.find_one({"id": sub_agenzia_id})
    if not sub_agenzia:
        raise HTTPException(status_code=404, detail="Sub Agenzia not found")
    
    # Check if user has access to this sub agenzia's commesse
    if current_user.role != UserRole.ADMIN:
        accessible_commesse = await get_user_accessible_commesse(current_user)
        sub_agenzia_commesse = set(sub_agenzia.get("commesse_autorizzate", []))
        if not sub_agenzia_commesse.intersection(accessible_commesse):
            raise HTTPException(status_code=403, detail="No access to this sub agenzia")
    
    # Check if there are users assigned to this sub agenzia
    users_count = await db.users.count_documents({"sub_agenzia_id": sub_agenzia_id})
    if users_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete sub agenzia: {users_count} users are still assigned to it"
        )
    
    # Proceed with deletion
    result = await db.sub_agenzie.delete_one({"id": sub_agenzia_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sub Agenzia not found")
    
    return {"success": True, "message": f"Sub Agenzia '{sub_agenzia['nome']}' eliminata con successo"}



