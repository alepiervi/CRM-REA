"""Route: Storico note cliente (append-only) — estratte da server.py (refactoring fase 2, giugno 2026)."""
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
from audit import log_client_action

router = APIRouter()
logger = logging.getLogger(__name__)

# ============================================================
# CLIENTE NOTES HISTORY (Storico note immutabile)
# ============================================================
# Ogni entry è append-only: no edit, no delete. Mostra timestamp + autore.

class ClienteNoteEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cliente_id: str
    tipo: str  # "cliente" | "backoffice" | "post_vendita"
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by_id: str
    created_by_username: str


class ClienteNoteEntryCreate(BaseModel):
    tipo: str  # "cliente" | "backoffice" | "post_vendita"
    content: str


@router.post("/clienti/{cliente_id}/note-history", response_model=ClienteNoteEntry)
async def add_cliente_note_history(
    cliente_id: str,
    payload: ClienteNoteEntryCreate,
    current_user: User = Depends(get_current_user)
):
    """Append a new immutable note entry to the cliente notes history."""
    # Validate cliente exists and user has access
    cliente_doc = await db.clienti.find_one({"id": cliente_id}, {"_id": 0})
    if not cliente_doc:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    cliente_obj = Cliente(**cliente_doc)
    if not await can_user_access_cliente_notes(current_user, cliente_obj):
        raise HTTPException(status_code=403, detail="Accesso negato al cliente")

    tipo = (payload.tipo or "").strip().lower()
    if tipo not in ("cliente", "backoffice", "post_vendita"):
        raise HTTPException(status_code=400, detail="tipo must be 'cliente', 'backoffice' or 'post_vendita'")

    content = (payload.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="La nota non può essere vuota")

    # Per note_backoffice, solo admin + backoffice_commessa possono aggiungere
    if tipo == "backoffice" and current_user.role not in (UserRole.ADMIN, UserRole.BACKOFFICE_COMMESSA):
        raise HTTPException(
            status_code=403,
            detail="Solo Admin e Back Office Commessa possono aggiungere note Back Office"
        )

    # Note Post Vendita: solo admin + backoffice_commessa (stessi ruoli autorizzati al post-vendita)
    if tipo == "post_vendita" and current_user.role not in (UserRole.ADMIN, UserRole.BACKOFFICE_COMMESSA):
        raise HTTPException(
            status_code=403,
            detail="Solo Admin e Back Office Commessa possono aggiungere note Post Vendita"
        )

    entry = ClienteNoteEntry(
        cliente_id=cliente_id,
        tipo=tipo,
        content=content,
        created_by_id=current_user.id,
        created_by_username=current_user.username,
    )
    await db.cliente_note_history.insert_one(entry.dict())
    return entry


@router.post("/clienti/{cliente_id}/migrate-legacy-notes")
async def migrate_legacy_cliente_notes(
    cliente_id: str,
    current_user: User = Depends(get_current_user)
):
    """Sposta il campo `note` (e `note_backoffice`) legacy nello Storico Note e svuota i campi raw.
    Idempotente: non duplica se una entry con lo stesso contenuto esiste già."""
    cliente_doc = await db.clienti.find_one({"id": cliente_id}, {"_id": 0})
    if not cliente_doc:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    cliente_obj = Cliente(**cliente_doc)
    if not await can_user_modify_cliente(current_user, cliente_obj):
        raise HTTPException(status_code=403, detail="Non hai i permessi per modificare questo cliente")

    migrated = []
    set_fields = {}

    note_content = (cliente_doc.get("note") or "").strip()
    if note_content:
        existing = await db.cliente_note_history.find_one(
            {"cliente_id": cliente_id, "tipo": "cliente", "content": note_content}
        )
        if not existing:
            entry = ClienteNoteEntry(
                cliente_id=cliente_id, tipo="cliente", content=note_content,
                created_by_id=current_user.id, created_by_username=current_user.username,
            )
            await db.cliente_note_history.insert_one(entry.dict())
        set_fields["note"] = ""
        migrated.append("cliente")

    bo_content = (cliente_doc.get("note_backoffice") or cliente_doc.get("note_back_office") or "").strip()
    if bo_content:
        existing_bo = await db.cliente_note_history.find_one(
            {"cliente_id": cliente_id, "tipo": "backoffice", "content": bo_content}
        )
        if not existing_bo:
            entry = ClienteNoteEntry(
                cliente_id=cliente_id, tipo="backoffice", content=bo_content,
                created_by_id=current_user.id, created_by_username=current_user.username,
            )
            await db.cliente_note_history.insert_one(entry.dict())
        set_fields["note_backoffice"] = ""
        set_fields["note_back_office"] = ""
        migrated.append("backoffice")

    if set_fields:
        set_fields["legacy_migrated_at"] = datetime.now(timezone.utc)
        await db.clienti.update_one({"id": cliente_id}, {"$set": set_fields})

    return {
        "migrated": migrated,
        "message": "Note spostate nello Storico Note" if migrated else "Nessuna nota da spostare",
    }



@router.get("/clienti/{cliente_id}/note-history", response_model=List[ClienteNoteEntry])
async def get_cliente_note_history(
    cliente_id: str,
    tipo: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Return all note history entries for a cliente, newest first.
    Optional filter by tipo ('cliente' | 'backoffice' | 'post_vendita').

    Le note 'post_vendita' sono visibili SOLO ad admin e backoffice_commessa,
    e sono escluse dalla scheda cliente normale (devono essere richieste esplicitamente).
    """
    cliente_doc = await db.clienti.find_one({"id": cliente_id}, {"_id": 0})
    if not cliente_doc:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    cliente_obj = Cliente(**cliente_doc)
    if not await can_user_access_cliente_notes(current_user, cliente_obj):
        raise HTTPException(status_code=403, detail="Accesso negato al cliente")

    query: dict = {"cliente_id": cliente_id}
    if tipo and tipo.lower() in ("cliente", "backoffice", "post_vendita"):
        tipo_lower = tipo.lower()
        # Gating: post_vendita notes visible only to admin + backoffice_commessa
        if tipo_lower == "post_vendita" and current_user.role not in (UserRole.ADMIN, UserRole.BACKOFFICE_COMMESSA):
            raise HTTPException(status_code=403, detail="Accesso negato alle note Post Vendita")
        query["tipo"] = tipo_lower
    else:
        # No explicit tipo filter: hide post_vendita notes from the generic note stream
        # unless the caller has PV role (they'll see them in the PV tab anyway).
        if current_user.role not in (UserRole.ADMIN, UserRole.BACKOFFICE_COMMESSA):
            query["tipo"] = {"$ne": "post_vendita"}
        else:
            # Even admin should NOT see PV notes on the generic cliente view by default.
            # They can pass tipo='post_vendita' explicitly to retrieve them.
            query["tipo"] = {"$ne": "post_vendita"}

    entries = await db.cliente_note_history.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=None)
    return [ClienteNoteEntry(**e) for e in entries]






@router.get("/clienti-cestino")
async def get_clienti_cestino(
    current_user: User = Depends(get_current_user)
):
    """Get all soft-deleted clienti (trash bin) - Admin only"""
    
    # Only admin can access trash
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono accedere al cestino")
    
    try:
        # Find all deleted clienti
        deleted_clienti = await db.clienti.find(
            {"is_deleted": True},
            {"_id": 0}
        ).sort("deleted_at", -1).to_list(None)
        
        # Enrich with sub_agenzia and commessa names
        for cliente in deleted_clienti:
            if cliente.get("sub_agenzia_id"):
                sub_agenzia = await db.sub_agenzie.find_one({"id": cliente["sub_agenzia_id"]})
                cliente["sub_agenzia_nome"] = sub_agenzia.get("nome") if sub_agenzia else ""
            
            if cliente.get("commessa_id"):
                commessa = await db.commesse.find_one({"id": cliente["commessa_id"]})
                cliente["commessa_nome"] = commessa.get("nome") if commessa else ""
            
            # Get deletion logs
            logs = await db.cliente_logs.find(
                {
                    "cliente_id": cliente["id"],
                    "metadata.action_type": {"$in": ["soft_delete", "restore"]}
                },
                {"_id": 0}
            ).sort("timestamp", -1).to_list(10)
            cliente["deletion_logs"] = logs
        
        return {
            "success": True,
            "clienti": deleted_clienti,
            "total": len(deleted_clienti)
        }
        
    except Exception as e:
        logger.error(f"Error fetching deleted clienti: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nel recupero del cestino: {str(e)}")


@router.post("/clienti-cestino/{cliente_id}/ripristina")
async def ripristina_cliente(
    cliente_id: str,
    current_user: User = Depends(get_current_user)
):
    """Restore a soft-deleted cliente - Admin only"""
    
    # Only admin can restore
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono ripristinare i clienti")
    
    # Check if cliente exists and is deleted
    cliente_doc = await db.clienti.find_one({"id": cliente_id, "is_deleted": True})
    if not cliente_doc:
        raise HTTPException(status_code=404, detail="Cliente non trovato nel cestino")
    
    try:
        # Get the last assigned user
        last_assigned_to = cliente_doc.get("last_assigned_to")
        last_status = cliente_doc.get("last_status", "da_lavorare")
        
        # Restore cliente
        restored_at = datetime.now(timezone.utc)
        
        await db.clienti.update_one(
            {"id": cliente_id},
            {
                "$set": {
                    "is_deleted": False,
                    "restored_at": restored_at,
                    "restored_by": current_user.id,
                    "restored_by_username": current_user.username,
                    "assigned_to": last_assigned_to,  # Restore to last assigned user
                    "status": last_status  # Restore original status
                },
                "$unset": {
                    "deleted_at": "",
                    "deleted_by": "",
                    "deleted_by_username": ""
                }
            }
        )
        
        # Log the restoration
        await log_client_action(
            cliente_id=cliente_id,
            action=ClienteLogAction.STATUS_CHANGED,
            description=f"Cliente ripristinato da {current_user.username}",
            user=current_user,
            old_value="cestino",
            new_value="attivo",
            metadata={
                "action_type": "restore",
                "restored_at": restored_at.isoformat(),
                "restored_by": current_user.id,
                "restored_by_username": current_user.username,
                "restored_to_user": last_assigned_to
            }
        )
        
        # Get restored user name
        restored_user_name = "nessuno"
        if last_assigned_to:
            user_doc = await db.users.find_one({"id": last_assigned_to})
            if user_doc:
                restored_user_name = user_doc.get("username", "sconosciuto")
        
        return {
            "success": True,
            "message": f"Cliente {cliente_doc.get('nome')} {cliente_doc.get('cognome')} ripristinato con successo",
            "assigned_to": last_assigned_to,
            "assigned_to_name": restored_user_name
        }
        
    except Exception as e:
        logger.error(f"Error restoring cliente: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nel ripristino del cliente: {str(e)}")


@router.delete("/clienti-cestino/{cliente_id}/elimina-definitivo")
async def elimina_definitivo_cliente(
    cliente_id: str,
    current_user: User = Depends(get_current_user)
):
    """Permanently delete a cliente from trash - Admin only"""
    
    # Only admin can permanently delete
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo gli amministratori possono eliminare definitivamente")
    
    # Check if cliente exists and is in trash
    cliente_doc = await db.clienti.find_one({"id": cliente_id, "is_deleted": True})
    if not cliente_doc:
        raise HTTPException(status_code=404, detail="Cliente non trovato nel cestino")
    
    try:
        # Delete associated documents
        await db.documents.delete_many({"entity_id": cliente_id})
        
        # Delete logs
        await db.cliente_logs.delete_many({"cliente_id": cliente_id})
        
        # Permanently delete cliente
        result = await db.clienti.delete_one({"id": cliente_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Cliente not found")
        
        return {
            "success": True,
            "message": f"Cliente {cliente_doc.get('nome')} {cliente_doc.get('cognome')} eliminato definitivamente"
        }
        
    except Exception as e:
        logger.error(f"Error permanently deleting cliente: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nell'eliminazione definitiva: {str(e)}")

@router.delete("/lead/{lead_id}")
async def delete_lead(
    lead_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete lead completely from system"""
    
    # Only admin and responsabile_commessa can delete lead
    if current_user.role not in [UserRole.ADMIN, UserRole.RESPONSABILE_COMMESSA]:
        raise HTTPException(status_code=403, detail="Insufficient permissions to delete lead")
    
    # Check if lead exists
    lead_doc = await db.lead.find_one({"id": lead_id})
    if not lead_doc:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    lead = Lead(**lead_doc)
    
    # Verify user can access this lead (similar permission check)
    if current_user.role == UserRole.RESPONSABILE_COMMESSA:
        # Check commessa access based on lead's campagna/gruppo
        # This would need more sophisticated logic based on your requirements
        pass
    
    try:
        # Delete associated documents
        await db.documents.delete_many({"lead_id": lead_id})
        
        # Delete lead
        result = await db.lead.delete_one({"id": lead_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        return {"success": True, "message": f"Lead {lead.nome} {lead.cognome} eliminato completamente dal sistema"}
        
    except Exception as e:
        logger.error(f"Error deleting lead: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nell'eliminazione del lead: {str(e)}")

# Gestione Autorizzazioni Utenti
@router.post("/user-commessa-authorizations", response_model=UserCommessaAuthorization)
async def create_user_authorization(
    auth_data: UserCommessaAuthorizationCreate,
    current_user: User = Depends(get_current_user)
):
    """Create user authorization for commessa"""
    if current_user.role not in [UserRole.ADMIN, UserRole.RESPONSABILE_COMMESSA]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Responsabile commessa può autorizzare solo per le sue commesse
    if current_user.role == UserRole.RESPONSABILE_COMMESSA:
        if not await check_commessa_access(current_user, auth_data.commessa_id):
            raise HTTPException(status_code=403, detail="Access denied to this commessa")
    
    # Verifica che l'utente esista
    user = await db.users.find_one({"id": auth_data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Controlla se autorizzazione già esiste
    existing_auth = await db.user_commessa_authorizations.find_one({
        "user_id": auth_data.user_id,
        "commessa_id": auth_data.commessa_id,
        "sub_agenzia_id": auth_data.sub_agenzia_id
    })
    
    if existing_auth:
        raise HTTPException(status_code=400, detail="Authorization already exists")
    
    authorization = UserCommessaAuthorization(**auth_data.dict())
    await db.user_commessa_authorizations.insert_one(authorization.dict())
    
    return authorization

@router.get("/user-commessa-authorizations")
async def get_user_authorizations(
    user_id: Optional[str] = None,
    commessa_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get user authorizations"""
    if current_user.role not in [UserRole.ADMIN, UserRole.RESPONSABILE_COMMESSA]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    query = {"is_active": True}
    
    if user_id:
        query["user_id"] = user_id
    
    if commessa_id:
        # Responsabile commessa può vedere solo le sue commesse
        if current_user.role == UserRole.RESPONSABILE_COMMESSA:
            if not await check_commessa_access(current_user, commessa_id):
                raise HTTPException(status_code=403, detail="Access denied")
        query["commessa_id"] = commessa_id
    
    authorizations = await db.user_commessa_authorizations.find(query).to_list(length=None)
    return [UserCommessaAuthorization(**auth) for auth in authorizations]

# Analytics per Responsabile Commessa
@router.get("/commesse/{commessa_id}/analytics")
async def get_commessa_analytics(commessa_id: str, current_user: User = Depends(get_current_user)):
    """Get analytics for commessa"""
    if not await check_commessa_access(current_user, commessa_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Analytics per sub agenzia
    pipeline = [
        {"$match": {"commessa_id": commessa_id}},
        {"$group": {
            "_id": "$sub_agenzia_id",
            "total_clienti": {"$sum": 1},
            "clienti_completati": {"$sum": {"$cond": [{"$eq": ["$status", "completato"]}, 1, 0]}},
            "clienti_in_lavorazione": {"$sum": {"$cond": [{"$eq": ["$status", "in_lavorazione"]}, 1, 0]}},
            "ultimo_cliente": {"$max": "$created_at"}
        }}
    ]
    
    results = await db.clienti.aggregate(pipeline).to_list(length=None)
    
    # Get sub agenzia details
    sub_agenzie_stats = []
    for result in results:
        sub_agenzia = await db.sub_agenzie.find_one({"id": result["_id"]})
        if sub_agenzia:
            sub_agenzie_stats.append({
                "sub_agenzia_id": result["_id"],
                "sub_agenzia_nome": sub_agenzia["nome"],
                "total_clienti": result["total_clienti"],
                "clienti_completati": result["clienti_completati"],
                "clienti_in_lavorazione": result["clienti_in_lavorazione"],
                "ultimo_cliente": result["ultimo_cliente"]
            })
    
    # Analytics generali commessa
    total_clienti = await db.clienti.count_documents({"commessa_id": commessa_id})
    clienti_completati = await db.clienti.count_documents({
        "commessa_id": commessa_id,
        "status": "completato"
    })
    
    return {
        "commessa_id": commessa_id,
        "total_clienti": total_clienti,
        "clienti_completati": clienti_completati,
        "tasso_completamento": (clienti_completati / total_clienti * 100) if total_clienti > 0 else 0,
        "sub_agenzie_stats": sub_agenzie_stats
    }

