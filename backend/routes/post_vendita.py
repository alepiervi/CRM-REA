"""Route: Modulo Post Vendita + bulk import — estratte da server.py (refactoring fase 2, giugno 2026)."""
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

# ============================================================
# POST VENDITA MODULE
# ============================================================
# Accessibile solo ad admin + backoffice_commessa.
# - Clienti vengono marcati passed_to_post_vendita=True manualmente
# - Ogni commessa ha il suo workflow di status configurabile
# - Bulk import CSV/Excel per aggiornare status + codice_account di massa

class PostVenditaStatusConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    commessa_id: str
    value: str  # es. "da_lavorare"
    label: str  # es. "Da Lavorare"
    color: Optional[str] = "#6b7280"
    stage: str = "lavorazione"  # 'lavorazione' | 'attivato' | 'ko' — propagato sulla anagrafica cliente.status
    order: int = 0
    is_default: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PostVenditaStatusConfigCreate(BaseModel):
    commessa_id: str
    value: str
    label: str
    color: Optional[str] = "#6b7280"
    stage: str = "lavorazione"
    order: int = 0
    is_default: bool = False


class PostVenditaStatusConfigUpdate(BaseModel):
    value: Optional[str] = None
    label: Optional[str] = None
    color: Optional[str] = None
    stage: Optional[str] = None
    order: Optional[int] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None


# Mapping stage -> valore da impostare sull'anagrafica cliente (campo `status`).
# 'lavorazione' è VOLUTAMENTE assente: in lavorazione lo status anagrafica NON cambia,
# la scheda cliente mostra solo un pallino giallo accanto allo status corrente.
_PV_STAGE_TO_CLIENTE_STATUS = {
    "ko": "ko",
    "attivato": "attivato",
}

VALID_PV_STAGES = {"lavorazione", "attivato", "ko"}


async def _apply_pv_stage_to_cliente(cliente_id: str, pv_status_value: str, commessa_id: Optional[str] = None, actor: Optional[User] = None):
    """Single source of truth to switch a cliente's post-vendita status.
    Performs:
      1. Read previous PV state (status, label, stage) BEFORE any mutation.
      2. Persist new status + label + stage + updated_at + passed_to_post_vendita=True.
      3. For stage 'attivato' / 'ko' rewrite cliente.status (final outcome). For 'lavorazione' the
         anagrafica status is left untouched (only the dot signals it).
      4. Append an immutable history entry in `cliente_post_vendita_history`.
    Idempotent on stage/label, but always logs the audit when the status value changes.
    """
    if not pv_status_value:
        return
    q = {"value": pv_status_value, "is_active": True}
    if commessa_id:
        q["commessa_id"] = commessa_id
    cfg = await db.post_vendita_status_config.find_one(q, {"_id": 0, "stage": 1, "label": 1, "color": 1})
    if not cfg:
        return
    stage = (cfg.get("stage") or "lavorazione").lower()
    label = cfg.get("label") or pv_status_value
    color = cfg.get("color") or None

    # Snapshot previous state
    prev = await db.clienti.find_one(
        {"id": cliente_id},
        {"_id": 0, "post_vendita_status": 1, "post_vendita_stage": 1, "post_vendita_status_label": 1}
    ) or {}
    prev_status = prev.get("post_vendita_status")
    prev_label = prev.get("post_vendita_status_label")
    prev_stage = prev.get("post_vendita_stage")

    set_doc = {
        "post_vendita_status": pv_status_value,
        "post_vendita_status_label": label,
        "post_vendita_stage": stage,
        "post_vendita_status_updated_at": datetime.now(timezone.utc),
        "passed_to_post_vendita": True,
    }
    new_cliente_status = _PV_STAGE_TO_CLIENTE_STATUS.get(stage)
    if new_cliente_status:
        set_doc["status"] = new_cliente_status
    await db.clienti.update_one(
        {"id": cliente_id},
        {"$set": set_doc}
    )

    # Append history when the PV status value, stage or label actually changed
    changed = (prev_status != pv_status_value) or (prev_stage != stage) or (prev_label != label)
    if changed:
        history_entry = {
            "id": str(uuid.uuid4()),
            "cliente_id": cliente_id,
            "post_vendita_status": pv_status_value,
            "post_vendita_status_label": label,
            "post_vendita_stage": stage,
            "color": color,
            "previous_status": prev_status,
            "previous_label": prev_label,
            "previous_stage": prev_stage,
            "created_at": datetime.now(timezone.utc),
            "created_by_id": actor.id if actor else None,
            "created_by_username": actor.username if actor else "system",
        }
        await db.cliente_post_vendita_history.insert_one(history_entry)


def _require_post_vendita_role(current_user: User):
    if current_user.role not in (UserRole.ADMIN, UserRole.BACKOFFICE_COMMESSA):
        raise HTTPException(status_code=403, detail="Accesso Post Vendita riservato ad admin e backoffice commessa")


def _check_post_vendita_commessa_access(current_user: User, commessa_id: str, servizio_id: Optional[str] = None):
    """Backoffice commessa can only operate on their authorized commesse AND, if servizi_autorizzati is set,
    on those specific servizi within the commessa. If servizi_autorizzati is empty, full commessa access."""
    if current_user.role == UserRole.BACKOFFICE_COMMESSA:
        allowed_comm = list(current_user.commesse_autorizzate or [])
        if commessa_id not in allowed_comm:
            raise HTTPException(status_code=403, detail="Commessa non autorizzata")
        allowed_serv = list(current_user.servizi_autorizzati or [])
        if servizio_id and allowed_serv and servizio_id not in allowed_serv:
            raise HTTPException(status_code=403, detail="Servizio non autorizzato per questo utente")


@router.get("/post-vendita/status-config")
async def get_post_vendita_status_config(
    commessa_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    _require_post_vendita_role(current_user)
    q = {"is_active": True}
    if commessa_id:
        q["commessa_id"] = commessa_id
    docs = await db.post_vendita_status_config.find(q, {"_id": 0}).sort("order", 1).to_list(length=None)
    return docs


@router.post("/post-vendita/status-config", response_model=PostVenditaStatusConfig)
async def create_post_vendita_status_config(
    payload: PostVenditaStatusConfigCreate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può creare status config")
    data = payload.dict()
    stage = (data.get("stage") or "lavorazione").lower()
    if stage not in VALID_PV_STAGES:
        raise HTTPException(status_code=400, detail=f"stage deve essere uno di: {sorted(VALID_PV_STAGES)}")
    data["stage"] = stage
    entry = PostVenditaStatusConfig(**data)
    await db.post_vendita_status_config.insert_one(entry.dict())
    return entry


@router.put("/post-vendita/status-config/{config_id}", response_model=PostVenditaStatusConfig)
async def update_post_vendita_status_config(
    config_id: str,
    payload: PostVenditaStatusConfigUpdate,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    update_data = {k: v for k, v in payload.dict().items() if v is not None}
    if "stage" in update_data:
        stage = (update_data["stage"] or "lavorazione").lower()
        if stage not in VALID_PV_STAGES:
            raise HTTPException(status_code=400, detail=f"stage deve essere uno di: {sorted(VALID_PV_STAGES)}")
        update_data["stage"] = stage
    await db.post_vendita_status_config.update_one({"id": config_id}, {"$set": update_data})
    doc = await db.post_vendita_status_config.find_one({"id": config_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Config not found")
    # If stage changed, propagate to all clienti currently using this status value
    if "stage" in update_data:
        current_value = doc.get("value")
        commessa_id = doc.get("commessa_id")
        if current_value and commessa_id:
            cli_cursor = db.clienti.find(
                {"post_vendita_status": current_value, "commessa_id": commessa_id, "is_active": {"$ne": False}},
                {"_id": 0, "id": 1}
            )
            async for c in cli_cursor:
                await _apply_pv_stage_to_cliente(c["id"], current_value, commessa_id, actor=current_user)
    return PostVenditaStatusConfig(**doc)


@router.delete("/post-vendita/status-config/{config_id}")
async def delete_post_vendita_status_config(
    config_id: str,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    await db.post_vendita_status_config.update_one({"id": config_id}, {"$set": {"is_active": False}})
    return {"success": True}


@router.post("/admin/migrate-legacy-notes")
async def migrate_legacy_notes_to_history(
    force: bool = False,
    current_user: User = Depends(get_current_user)
):
    """One-shot migration: copia il contenuto di `cliente.note` e `cliente.note_backoffice`
    (campi inline legacy) come entry immutabili in `cliente_note_history` (tipo='cliente'/'backoffice').
    
    - Idempotente: salta i clienti già migrati (segnati con `legacy_migrated_at`).
    - `force=True`: ri-esegue per i clienti senza entry storiche di quel tipo.
    Solo admin.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin")
    
    migrated_cli = 0
    migrated_bo = 0
    skipped = 0
    now = datetime.now(timezone.utc)
    cursor = db.clienti.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0, "id": 1, "note": 1, "note_backoffice": 1, "note_back_office": 1, "created_at": 1, "created_by": 1, "legacy_migrated_at": 1}
    )
    async for c in cursor:
        cid = c.get("id")
        if not cid:
            continue
        if c.get("legacy_migrated_at") and not force:
            skipped += 1
            continue
        creator_doc = None
        if c.get("created_by"):
            creator_doc = await db.users.find_one({"id": c["created_by"]}, {"_id": 0, "username": 1})
        creator_username = creator_doc.get("username") if creator_doc else "(legacy)"
        creator_id = c.get("created_by") or "legacy"
        created_at = c.get("created_at") or now

        # Migra note "cliente" se presente e non già nello storico (tipo='cliente')
        note_content = (c.get("note") or "").strip()
        if note_content:
            existing = await db.cliente_note_history.find_one({"cliente_id": cid, "tipo": "cliente", "legacy_migrated": True})
            if not existing:
                await db.cliente_note_history.insert_one({
                    "id": str(uuid.uuid4()),
                    "cliente_id": cid,
                    "tipo": "cliente",
                    "content": note_content,
                    "created_at": created_at,
                    "created_by_id": creator_id,
                    "created_by_username": creator_username,
                    "legacy_migrated": True,
                })
                migrated_cli += 1

        # Migra note "backoffice" se presente
        bo_content = (c.get("note_backoffice") or c.get("note_back_office") or "").strip()
        if bo_content:
            existing_bo = await db.cliente_note_history.find_one({"cliente_id": cid, "tipo": "backoffice", "legacy_migrated": True})
            if not existing_bo:
                await db.cliente_note_history.insert_one({
                    "id": str(uuid.uuid4()),
                    "cliente_id": cid,
                    "tipo": "backoffice",
                    "content": bo_content,
                    "created_at": created_at,
                    "created_by_id": creator_id,
                    "created_by_username": creator_username,
                    "legacy_migrated": True,
                })
                migrated_bo += 1

        await db.clienti.update_one({"id": cid}, {"$set": {"legacy_migrated_at": now}})

    return {
        "success": True,
        "migrated_cliente_notes": migrated_cli,
        "migrated_backoffice_notes": migrated_bo,
        "skipped_already_migrated": skipped,
    }


@router.get("/clienti/{cliente_id}/post-vendita-history")
async def get_post_vendita_history(
    cliente_id: str,
    current_user: User = Depends(get_current_user)
):
    """Return the immutable history of post-vendita status changes for a cliente.
    Visible to ANY user with access to the cliente (admin, BO Commessa, creator,
    same sub-agenzia, or commessa-authorized).
    """
    cliente_doc = await db.clienti.find_one({"id": cliente_id}, {"_id": 0})
    if not cliente_doc:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    cliente = Cliente(**cliente_doc)
    if not await can_user_access_cliente_notes(current_user, cliente):
        raise HTTPException(status_code=403, detail="Accesso negato")
    docs = await db.cliente_post_vendita_history.find(
        {"cliente_id": cliente_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=None)
    return {
        "cliente_id": cliente_id,
        "current": {
            "post_vendita_status": cliente_doc.get("post_vendita_status"),
            "post_vendita_status_label": cliente_doc.get("post_vendita_status_label"),
            "post_vendita_stage": cliente_doc.get("post_vendita_stage"),
            "passed_to_post_vendita": bool(cliente_doc.get("passed_to_post_vendita")),
            "post_vendita_status_updated_at": cliente_doc.get("post_vendita_status_updated_at"),
        },
        "history": docs,
        "count": len(docs),
    }


@router.patch("/clienti/{cliente_id}/codice-account")
async def patch_cliente_codice_account(
    cliente_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user)
):
    """Set the cliente codice_account without submitting a full Cliente payload.
    Used for ops/post-vendita flows where the codice_account is assigned later."""
    code = (payload or {}).get("codice_account", "")
    if code is None:
        code = ""
    code = str(code).strip()
    cliente_doc = await db.clienti.find_one({"id": cliente_id}, {"_id": 0})
    if not cliente_doc:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    cliente = Cliente(**cliente_doc)
    if not await can_user_access_cliente(current_user, cliente):
        raise HTTPException(status_code=403, detail="Accesso negato")
    await db.clienti.update_one(
        {"id": cliente_id},
        {"$set": {"codice_account": code or None}}
    )
    return {"success": True, "codice_account": code or None}


@router.post("/clienti/{cliente_id}/pass-to-post-vendita")
async def pass_cliente_to_post_vendita(
    cliente_id: str,
    current_user: User = Depends(get_current_user)
):
    """Mark a cliente as passed to post-vendita. Available to creator, assigned user,
    admin, backoffice_commessa."""
    cliente_doc = await db.clienti.find_one({"id": cliente_id}, {"_id": 0})
    if not cliente_doc:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    cliente = Cliente(**cliente_doc)
    if not await can_user_access_cliente(current_user, cliente):
        raise HTTPException(status_code=403, detail="Accesso negato")
    # Determine default PV status from commessa config
    default_status = None
    if cliente.commessa_id:
        default_cfg = await db.post_vendita_status_config.find_one(
            {"commessa_id": cliente.commessa_id, "is_default": True, "is_active": True},
            {"_id": 0}
        )
        if default_cfg:
            default_status = default_cfg.get("value")
    final_pv_status = cliente.post_vendita_status or default_status
    if final_pv_status:
        # Helper performs the full mutation + history entry
        await _apply_pv_stage_to_cliente(cliente_id, final_pv_status, cliente.commessa_id, actor=current_user)
    else:
        # No default status configured: just mark as passed_to_post_vendita
        await db.clienti.update_one(
            {"id": cliente_id},
            {"$set": {
                "passed_to_post_vendita": True,
                "post_vendita_status_updated_at": datetime.now(timezone.utc),
            }}
        )
    return {"success": True, "post_vendita_status": final_pv_status}


@router.delete("/post-vendita/clienti/{cliente_id}")
async def remove_cliente_from_post_vendita(
    cliente_id: str,
    current_user: User = Depends(get_current_user)
):
    """Rimuove un cliente SOLO dalla sezione Post Vendita (resetta passed_to_post_vendita e
    i campi PV) mantenendo l'anagrafica cliente intatta. Dopo questa operazione il pulsante
    'Passa al Post Vendita' torna cliccabile sulla scheda cliente.

    Lo storico in `cliente_post_vendita_history` viene preservato per audit. Aggiunge una
    entry 'removed' nello storico per tracciabilità.
    """
    _require_post_vendita_role(current_user)
    cliente_doc = await db.clienti.find_one({"id": cliente_id}, {"_id": 0})
    if not cliente_doc:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    cliente = Cliente(**cliente_doc)
    # Re-check commessa/servizio access for backoffice_commessa
    _check_post_vendita_commessa_access(current_user, cliente.commessa_id or "", getattr(cliente, "servizio_id", None))

    prev_status = cliente_doc.get("post_vendita_status")
    prev_label = cliente_doc.get("post_vendita_status_label")
    prev_stage = cliente_doc.get("post_vendita_stage")

    # Reset PV fields on cliente. Keep the cliente anagrafica untouched (status, etc.).
    await db.clienti.update_one(
        {"id": cliente_id},
        {"$set": {
            "passed_to_post_vendita": False,
            "post_vendita_status": None,
            "post_vendita_status_label": None,
            "post_vendita_stage": None,
            "post_vendita_status_updated_at": datetime.now(timezone.utc),
        }}
    )

    # Audit history entry (immutable trail)
    await db.cliente_post_vendita_history.insert_one({
        "id": str(uuid.uuid4()),
        "cliente_id": cliente_id,
        "post_vendita_status": None,
        "post_vendita_status_label": "Rimosso da Post Vendita",
        "post_vendita_stage": "removed",
        "color": None,
        "previous_status": prev_status,
        "previous_label": prev_label,
        "previous_stage": prev_stage,
        "created_at": datetime.now(timezone.utc),
        "created_by_id": current_user.id,
        "created_by_username": current_user.username,
    })
    return {"success": True, "removed_from_post_vendita": True}


@router.get("/post-vendita/clienti/stats")
async def post_vendita_stats(
    commessa_id: Optional[str] = None,
    servizio_id: Optional[List[str]] = Query(None),  # multi-select
    current_user: User = Depends(get_current_user)
):
    """KPI counters per stage per (commessa, servizio) (lavorazione / attivato / ko / no_stage)."""
    _require_post_vendita_role(current_user)
    base = {"passed_to_post_vendita": True, "is_active": {"$ne": False}, "is_deleted": {"$ne": True}}
    requested_servizi = [s for s in (servizio_id or []) if s]
    if current_user.role == UserRole.BACKOFFICE_COMMESSA:
        allowed_comm = list(current_user.commesse_autorizzate or [])
        if not allowed_comm:
            return {"lavorazione": 0, "attivato": 0, "ko": 0, "no_stage": 0, "total": 0}
        if commessa_id:
            if commessa_id not in allowed_comm:
                raise HTTPException(status_code=403, detail="Commessa non autorizzata")
            base["commessa_id"] = commessa_id
        else:
            base["commessa_id"] = {"$in": allowed_comm}
        # Auto-restrict to authorized servizi when servizi_autorizzati is configured
        allowed_serv = list(current_user.servizi_autorizzati or [])
        if requested_servizi:
            if allowed_serv and any(s not in allowed_serv for s in requested_servizi):
                raise HTTPException(status_code=403, detail="Uno o più servizi non autorizzati")
            base["servizio_id"] = {"$in": requested_servizi}
        elif allowed_serv:
            base["servizio_id"] = {"$in": allowed_serv}
    else:
        if commessa_id:
            base["commessa_id"] = commessa_id
        if requested_servizi:
            base["servizio_id"] = {"$in": requested_servizi}

    pipeline = [
        {"$match": base},
        {"$group": {"_id": {"$ifNull": ["$post_vendita_stage", "no_stage"]}, "count": {"$sum": 1}}},
    ]
    res = await db.clienti.aggregate(pipeline).to_list(length=None)
    out = {"lavorazione": 0, "attivato": 0, "ko": 0, "no_stage": 0}
    for r in res:
        key = r["_id"] if r["_id"] in out else "no_stage"
        out[key] = out.get(key, 0) + r["count"]
    out["total"] = sum(out.values())
    return out


@router.get("/post-vendita/clienti")
async def list_post_vendita_clienti(
    commessa_id: Optional[str] = None,
    servizio_id: Optional[List[str]] = Query(None),  # multi-select: ?servizio_id=A&servizio_id=B
    post_vendita_status: Optional[str] = None,
    stage: Optional[str] = None,  # "lavorazione" | "attivato" | "ko" — overrides include_closed
    codice_account_filter: Optional[str] = None,  # "present" or "missing"
    search: Optional[str] = None,
    include_closed: bool = False,  # If True, also include attivato/ko (chiusi). Default: only "lavorazione".
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_current_user)
):
    _require_post_vendita_role(current_user)
    query = {"passed_to_post_vendita": True, "is_active": {"$ne": False}, "is_deleted": {"$ne": True}}
    requested_servizi = [s for s in (servizio_id or []) if s]
    # Stage explicit filter takes precedence over include_closed default
    if stage:
        query["post_vendita_stage"] = stage
    elif not include_closed:
        # Default behaviour: exclude clienti chiusi (stage attivato / ko) per mantenere lista snella.
        # L'esito finale resta sempre tracciato sull'anagrafica + storia.
        query["$and"] = [
            {"$or": [
                {"post_vendita_stage": {"$exists": False}},
                {"post_vendita_stage": None},
                {"post_vendita_stage": "lavorazione"},
            ]}
        ]
    # Restrict backoffice_commessa to only their authorized commesse + servizi
    if current_user.role == UserRole.BACKOFFICE_COMMESSA:
        allowed_comm = list(current_user.commesse_autorizzate or [])
        if not allowed_comm:
            return {"clienti": [], "total": 0, "page": page, "page_size": page_size}
        if commessa_id:
            if commessa_id not in allowed_comm:
                raise HTTPException(status_code=403, detail="Commessa non autorizzata")
            query["commessa_id"] = commessa_id
        else:
            query["commessa_id"] = {"$in": allowed_comm}
        # Auto-restrict to authorized servizi when servizi_autorizzati is configured
        allowed_serv = list(current_user.servizi_autorizzati or [])
        effective_servizi = requested_servizi
        if effective_servizi:
            if allowed_serv and any(s not in allowed_serv for s in effective_servizi):
                raise HTTPException(status_code=403, detail="Uno o più servizi non autorizzati")
            query["servizio_id"] = {"$in": effective_servizi}
        elif allowed_serv:
            query["servizio_id"] = {"$in": allowed_serv}
    else:
        if commessa_id:
            query["commessa_id"] = commessa_id
        if requested_servizi:
            query["servizio_id"] = {"$in": requested_servizi}
    if post_vendita_status:
        query["post_vendita_status"] = post_vendita_status
    if codice_account_filter == "present":
        query["codice_account"] = {"$nin": [None, ""]}
    elif codice_account_filter == "missing":
        query["$or"] = [{"codice_account": None}, {"codice_account": ""}, {"codice_account": {"$exists": False}}]
    if search:
        # Case-insensitive search on nome/cognome/email/telefono/codice_fiscale
        regex = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [
            {"nome": regex}, {"cognome": regex}, {"email": regex},
            {"telefono": regex}, {"codice_fiscale": regex}, {"codice_account": regex},
        ]
    total = await db.clienti.count_documents(query)
    skip = max(0, (page - 1) * page_size)
    cursor = db.clienti.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(page_size)
    items = await cursor.to_list(length=page_size)
    # Enrich with offerta_name (from offerte collection)
    offerta_ids = list({c.get("offerta_id") for c in items if c.get("offerta_id")})
    offerte_map = {}
    if offerta_ids:
        async for o in db.offerte.find({"id": {"$in": offerta_ids}}, {"_id": 0, "id": 1, "nome": 1}):
            offerte_map[o["id"]] = o.get("nome") or ""
    for c in items:
        c["offerta_name"] = offerte_map.get(c.get("offerta_id"), "") if c.get("offerta_id") else ""
    return {"clienti": items, "total": total, "page": page, "page_size": page_size}


@router.patch("/post-vendita/clienti/{cliente_id}/status")
async def patch_post_vendita_status(
    cliente_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user)
):
    _require_post_vendita_role(current_user)
    new_status = (payload or {}).get("post_vendita_status")
    if not new_status:
        raise HTTPException(status_code=400, detail="post_vendita_status required")
    cli_doc = await db.clienti.find_one({"id": cliente_id}, {"_id": 0, "commessa_id": 1, "servizio_id": 1})
    if not cli_doc:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    # ACL: backoffice_commessa restricted to authorized commessa + servizi
    _check_post_vendita_commessa_access(current_user, cli_doc.get("commessa_id"), cli_doc.get("servizio_id"))
    # The helper performs the update + history append atomically per call
    await _apply_pv_stage_to_cliente(cliente_id, new_status, cli_doc.get("commessa_id"), actor=current_user)
    return {"success": True}


# ============= BULK IMPORT =============
import csv as _csv
from io import BytesIO, StringIO

async def _parse_import_file(file: UploadFile) -> tuple[list[str], list[dict]]:
    """Parse uploaded CSV or XLSX file. Returns (headers, rows)."""
    filename = (file.filename or "").lower()
    content = await file.read()
    if filename.endswith(".csv"):
        text = content.decode("utf-8-sig", errors="replace")
        reader = _csv.DictReader(StringIO(text))
        rows = list(reader)
        headers = reader.fieldnames or []
    elif filename.endswith(".xlsx") or filename.endswith(".xls"):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(BytesIO(content), read_only=True, data_only=True)
            ws = wb.active
            all_rows = list(ws.iter_rows(values_only=True))
            if not all_rows:
                return [], []
            headers = [str(h) if h is not None else f"col_{i}" for i, h in enumerate(all_rows[0])]
            rows = []
            for r in all_rows[1:]:
                if all(c is None or c == "" for c in r):
                    continue
                rows.append({headers[i]: (str(r[i]) if r[i] is not None else "") for i in range(min(len(headers), len(r)))})
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Errore parsing xlsx: {e}")
    else:
        raise HTTPException(status_code=400, detail="Formato non supportato. Usa .csv o .xlsx")
    return headers, rows


@router.post("/post-vendita/bulk-import/analyze")
async def bulk_import_analyze(
    file: UploadFile = File(...),
    commessa_id: str = Form(...),
    codice_account_column: str = Form(...),
    new_status: str = Form(...),
    match_columns: str = Form("[]"),  # JSON array of {file_col: str, cliente_field: str}
    current_user: User = Depends(get_current_user)
):
    """Step 1: Analyze the file and return match preview.
    - Auto-match rows whose `codice_account_column` matches an existing cliente.codice_account
    - Unmatched rows returned for manual matching against clienti without codice_account on that commessa
    """
    _require_post_vendita_role(current_user)
    _check_post_vendita_commessa_access(current_user, commessa_id)
    # NOTE: bulk-import opera al livello commessa. Per backoffice_commessa con servizi_autorizzati,
    # le righe verranno filtrate sui clienti accessibili (servizi autorizzati) durante l'analyze.
    try:
        match_cols = json.loads(match_columns or "[]")
    except Exception:
        match_cols = []

    headers, rows = await _parse_import_file(file)
    if not headers:
        raise HTTPException(status_code=400, detail="File vuoto o formato invalido")

    # Load all clienti of commessa into memory (any state - import will mark them as passed_to_post_vendita)
    cli_query = {"commessa_id": commessa_id, "is_active": {"$ne": False}}
    # Backoffice commessa con servizi_autorizzati: restringe il match ai propri servizi
    if current_user.role == UserRole.BACKOFFICE_COMMESSA:
        allowed_serv = list(current_user.servizi_autorizzati or [])
        if allowed_serv:
            cli_query["servizio_id"] = {"$in": allowed_serv}
    clienti_all = await db.clienti.find(
        cli_query,
        {"_id": 0, "id": 1, "nome": 1, "cognome": 1, "email": 1, "telefono": 1,
         "codice_fiscale": 1, "partita_iva": 1, "codice_account": 1}
    ).to_list(length=None)

    code_to_cliente = {c.get("codice_account"): c for c in clienti_all if c.get("codice_account")}
    clienti_without_code = [c for c in clienti_all if not c.get("codice_account")]

    auto_matched = []
    unmatched = []
    for idx, row in enumerate(rows):
        code_value = (row.get(codice_account_column) or "").strip()
        if not code_value:
            unmatched.append({"row_index": idx, "row": row, "reason": "codice_account vuoto nel file"})
            continue
        cli = code_to_cliente.get(code_value)
        if cli:
            auto_matched.append({
                "row_index": idx,
                "row": row,
                "cliente_id": cli["id"],
                "cliente_label": f"{cli.get('cognome','')} {cli.get('nome','')} ({code_value})",
                "codice_account": code_value,
            })
        else:
            # Try to find candidate match by match_cols heuristic
            candidates = []
            for mc in match_cols:
                fcol = mc.get("file_col")
                cfield = mc.get("cliente_field")
                fvalue = (row.get(fcol) or "").strip().lower() if fcol else ""
                if not fvalue or not cfield:
                    continue
                for cwc in clienti_without_code:
                    cval = (cwc.get(cfield) or "").strip().lower()
                    if cval and cval == fvalue:
                        candidates.append({
                            "cliente_id": cwc["id"],
                            "cliente_label": f"{cwc.get('cognome','')} {cwc.get('nome','')}",
                            "matched_field": cfield,
                        })
            unmatched.append({
                "row_index": idx,
                "row": row,
                "code_to_set": code_value,
                "candidates": candidates,
            })

    return {
        "total_rows": len(rows),
        "auto_matched": auto_matched,
        "unmatched": unmatched,
        "clienti_without_code_count": len(clienti_without_code),
    }


@router.post("/post-vendita/bulk-import/execute")
async def bulk_import_execute(
    payload: dict,
    current_user: User = Depends(get_current_user)
):
    """Step 2: Execute the import.
    Payload:
      {
        commessa_id: str,
        new_status: str,
        auto_matched: [{cliente_id, codice_account}],
        manual_matched: [{cliente_id, codice_account}],
      }
    """
    _require_post_vendita_role(current_user)
    new_status = (payload.get("new_status") or "").strip()
    commessa_id = payload.get("commessa_id")
    if not new_status:
        raise HTTPException(status_code=400, detail="new_status required")
    if not commessa_id:
        raise HTTPException(status_code=400, detail="commessa_id required")
    _check_post_vendita_commessa_access(current_user, commessa_id)
    auto_matched = payload.get("auto_matched") or []
    manual_matched = payload.get("manual_matched") or []

    # Auto-create the post_vendita_status_config if it doesn't exist for this commessa (user choice)
    status_value_normalized = re.sub(r"[^a-z0-9_]+", "_", new_status.lower()).strip("_") or "status"
    existing_cfg = await db.post_vendita_status_config.find_one({
        "commessa_id": commessa_id,
        "value": status_value_normalized,
        "is_active": True,
    })
    status_auto_created = False
    if not existing_cfg:
        # Determine next order
        last = await db.post_vendita_status_config.find(
            {"commessa_id": commessa_id, "is_active": True}, {"_id": 0, "order": 1}
        ).sort("order", -1).limit(1).to_list(length=1)
        next_order = (last[0]["order"] + 1) if last else 0
        new_cfg = PostVenditaStatusConfig(
            commessa_id=commessa_id,
            value=status_value_normalized,
            label=new_status,
            color="#6b7280",
            order=next_order,
            is_default=False,
            is_active=True,
        )
        await db.post_vendita_status_config.insert_one(new_cfg.dict())
        status_auto_created = True
    # Use the normalized value going forward to keep storage consistent
    status_to_set = status_value_normalized

    import_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    updated_auto = 0
    updated_manual = 0
    errors = []

    # Auto-matched: status update via the helper (atomic + audit history)
    for item in auto_matched:
        cid = item.get("cliente_id")
        if not cid:
            continue
        try:
            exists = await db.clienti.count_documents({"id": cid})
            if exists:
                await _apply_pv_stage_to_cliente(cid, status_to_set, commessa_id, actor=current_user)
                updated_auto += 1
        except Exception as e:
            errors.append({"cliente_id": cid, "error": str(e)})

    # Manual-matched: per user choice, ONLY update status (do NOT touch codice_account)
    for item in manual_matched:
        cid = item.get("cliente_id")
        if not cid:
            continue
        try:
            exists = await db.clienti.count_documents({"id": cid})
            if exists:
                await _apply_pv_stage_to_cliente(cid, status_to_set, commessa_id, actor=current_user)
                updated_manual += 1
        except Exception as e:
            errors.append({"cliente_id": cid, "error": str(e)})

    # Log import
    import_record = {
        "id": import_id,
        "uploaded_at": now,
        "uploaded_by_id": current_user.id,
        "uploaded_by_username": current_user.username,
        "commessa_id": payload.get("commessa_id"),
        "new_status": status_to_set,
        "new_status_label": new_status,
        "status_auto_created": status_auto_created,
        "auto_matched_count": updated_auto,
        "manual_matched_count": updated_manual,
        "errors": errors,
    }
    await db.post_vendita_imports.insert_one(import_record)

    return {
        "success": True,
        "import_id": import_id,
        "auto_matched": updated_auto,
        "manual_matched": updated_manual,
        "status_auto_created": status_auto_created,
        "status_value": status_to_set,
        "errors": errors,
    }


@router.get("/post-vendita/imports")
async def list_post_vendita_imports(
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    _require_post_vendita_role(current_user)
    docs = await db.post_vendita_imports.find({}, {"_id": 0}).sort("uploaded_at", -1).limit(limit).to_list(length=limit)
    return {"imports": docs, "count": len(docs)}



