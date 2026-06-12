"""Route: Campi/Sezioni/Status custom cliente + duplica configurazione — estratte da server.py (refactoring fase 2, giugno 2026)."""
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
# CLIENTE CUSTOM FIELDS - CRUD (Fase 1)
# ============================================================

@router.get("/cliente-custom-fields", response_model=List[ClienteCustomField])
async def get_cliente_custom_fields(
    commessa_id: Optional[str] = None,
    tipologia_contratto_id: Optional[str] = None,
    active_only: bool = True,
    current_user: User = Depends(get_current_user)
):
    """Get all cliente custom fields, optionally filtered by (commessa_id, tipologia_contratto_id)"""
    query = {}
    if commessa_id:
        query["commessa_id"] = commessa_id
    if tipologia_contratto_id:
        query["tipologia_contratto_id"] = tipologia_contratto_id
    if active_only:
        query["active"] = True
    fields = await db.cliente_custom_fields.find(query, {"_id": 0}).sort("order", 1).to_list(length=None)
    return [ClienteCustomField(**f) for f in fields]


@router.post("/cliente-custom-fields", response_model=ClienteCustomField)
async def create_cliente_custom_field(
    field_data: ClienteCustomFieldCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new cliente custom field for a specific (commessa + tipologia_contratto)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can create cliente custom fields")
    
    # Validate field_type
    valid_types = {"text", "number", "date", "select", "multi_select", "checkbox", "textarea", "email", "phone"}
    if field_data.field_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid field_type. Must be one of: {', '.join(sorted(valid_types))}"
        )
    
    # Check uniqueness of (commessa + tipologia + name)
    existing = await db.cliente_custom_fields.find_one({
        "commessa_id": field_data.commessa_id,
        "tipologia_contratto_id": field_data.tipologia_contratto_id,
        "name": field_data.name
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Un campo '{field_data.name}' esiste già per questa combinazione commessa+tipologia"
        )
    
    # Normalize name: lowercase + replace spaces/special chars with underscores
    normalized_name = re.sub(r'[^a-z0-9_]', '_', field_data.name.lower().strip())
    field_data.name = re.sub(r'_+', '_', normalized_name).strip('_')
    
    field_obj = ClienteCustomField(
        **field_data.dict(),
        created_by=current_user.id
    )
    await db.cliente_custom_fields.insert_one(field_obj.dict())
    return field_obj


@router.put("/cliente-custom-fields/{field_id}", response_model=ClienteCustomField)
async def update_cliente_custom_field(
    field_id: str,
    update_data: ClienteCustomFieldUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update an existing cliente custom field"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update cliente custom fields")
    
    existing = await db.cliente_custom_fields.find_one({"id": field_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Cliente custom field not found")
    
    # Use exclude_unset to distinguish between "not provided" and "provided as null"
    # Special case: section_id CAN be set to null (to move field out of a section to default group)
    raw_update = update_data.dict(exclude_unset=True)
    update_dict = {k: v for k, v in raw_update.items() if v is not None or k == "section_id"}
    if "field_type" in update_dict:
        valid_types = {"text", "number", "date", "select", "multi_select", "checkbox", "textarea", "email", "phone"}
        if update_dict["field_type"] not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid field_type. Must be one of: {', '.join(sorted(valid_types))}"
            )
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.cliente_custom_fields.update_one({"id": field_id}, {"$set": update_dict})
    updated = await db.cliente_custom_fields.find_one({"id": field_id}, {"_id": 0})
    return ClienteCustomField(**updated)


@router.delete("/cliente-custom-fields/{field_id}")
async def delete_cliente_custom_field(
    field_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a cliente custom field (hard delete from config, does NOT delete values stored in clienti)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete cliente custom fields")
    
    field = await db.cliente_custom_fields.find_one({"id": field_id}, {"_id": 0})
    if not field:
        raise HTTPException(status_code=404, detail="Cliente custom field not found")
    
    await db.cliente_custom_fields.delete_one({"id": field_id})
    return {"message": "Cliente custom field deleted", "id": field_id}


# ============================================================
# CLIENTE CUSTOM SECTIONS - CRUD (Fase 2)
# ============================================================

@router.get("/cliente-custom-sections", response_model=List[ClienteCustomSection])
async def get_cliente_custom_sections(
    commessa_id: Optional[str] = None,
    tipologia_contratto_id: Optional[str] = None,
    active_only: bool = True,
    current_user: User = Depends(get_current_user)
):
    """Get cliente custom sections, optionally filtered by (commessa_id, tipologia_contratto_id)"""
    query = {}
    if commessa_id:
        query["commessa_id"] = commessa_id
    if tipologia_contratto_id:
        query["tipologia_contratto_id"] = tipologia_contratto_id
    if active_only:
        query["active"] = True
    sections = await db.cliente_custom_sections.find(query, {"_id": 0}).sort("order", 1).to_list(length=None)
    return [ClienteCustomSection(**s) for s in sections]


@router.post("/cliente-custom-sections", response_model=ClienteCustomSection)
async def create_cliente_custom_section(
    section_data: ClienteCustomSectionCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new cliente custom section for a specific (commessa + tipologia_contratto)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can create cliente custom sections")
    
    # Check uniqueness of (commessa + tipologia + name)
    existing = await db.cliente_custom_sections.find_one({
        "commessa_id": section_data.commessa_id,
        "tipologia_contratto_id": section_data.tipologia_contratto_id,
        "name": section_data.name
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Una sezione '{section_data.name}' esiste già per questa combinazione commessa+tipologia"
        )
    
    section_obj = ClienteCustomSection(
        **section_data.dict(),
        created_by=current_user.id
    )
    await db.cliente_custom_sections.insert_one(section_obj.dict())
    return section_obj


@router.put("/cliente-custom-sections/{section_id}", response_model=ClienteCustomSection)
async def update_cliente_custom_section(
    section_id: str,
    update_data: ClienteCustomSectionUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update an existing cliente custom section"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update cliente custom sections")
    
    existing = await db.cliente_custom_sections.find_one({"id": section_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Cliente custom section not found")
    
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.cliente_custom_sections.update_one({"id": section_id}, {"$set": update_dict})
    updated = await db.cliente_custom_sections.find_one({"id": section_id}, {"_id": 0})
    return ClienteCustomSection(**updated)


@router.delete("/cliente-custom-sections/{section_id}")
async def delete_cliente_custom_section(
    section_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a cliente custom section. Fields assigned to this section are moved to default (section_id=null)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete cliente custom sections")
    
    section = await db.cliente_custom_sections.find_one({"id": section_id}, {"_id": 0})
    if not section:
        raise HTTPException(status_code=404, detail="Cliente custom section not found")
    
    # Unassign fields from this section (don't delete the fields)
    await db.cliente_custom_fields.update_many(
        {"section_id": section_id},
        {"$set": {"section_id": None}}
    )
    
    await db.cliente_custom_sections.delete_one({"id": section_id})
    return {"message": "Cliente custom section deleted, fields moved to default", "id": section_id}


@router.post("/cliente-custom-config/duplicate")
async def duplicate_cliente_custom_config(
    payload: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user)
):
    """Duplica l'intera configurazione cliente (sezioni + campi + status) da una
    combinazione (commessa, tipologia) a un'altra.

    Body: {source_commessa_id, source_tipologia_id, target_commessa_id, target_tipologia_id,
           mode: "merge" (default, salta gli esistenti) | "overwrite" (cancella e ricopia)}
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo gli admin possono duplicare la configurazione")

    src_c = payload.get("source_commessa_id")
    src_t = payload.get("source_tipologia_id")
    tgt_c = payload.get("target_commessa_id")
    tgt_t = payload.get("target_tipologia_id")
    mode = payload.get("mode") or "merge"
    if not all([src_c, src_t, tgt_c, tgt_t]):
        raise HTTPException(status_code=400, detail="Sorgente e destinazione (commessa + tipologia) sono obbligatorie")
    if (src_c, src_t) == (tgt_c, tgt_t):
        raise HTTPException(status_code=400, detail="Sorgente e destinazione coincidono")
    if mode not in ("merge", "overwrite"):
        raise HTTPException(status_code=400, detail="mode deve essere 'merge' o 'overwrite'")

    src_q = {"commessa_id": src_c, "tipologia_contratto_id": src_t}
    tgt_q = {"commessa_id": tgt_c, "tipologia_contratto_id": tgt_t}

    src_sections = await db.cliente_custom_sections.find(src_q, {"_id": 0}).sort("order", 1).to_list(length=None)
    src_fields = await db.cliente_custom_fields.find(src_q, {"_id": 0}).sort("order", 1).to_list(length=None)
    src_statuses = await db.cliente_custom_statuses.find(src_q, {"_id": 0}).sort("order", 1).to_list(length=None)
    if not (src_sections or src_fields or src_statuses):
        raise HTTPException(status_code=404, detail="La configurazione sorgente è vuota: niente da duplicare")

    if mode == "overwrite":
        await db.cliente_custom_sections.delete_many(tgt_q)
        await db.cliente_custom_fields.delete_many(tgt_q)
        await db.cliente_custom_statuses.delete_many(tgt_q)

    existing_sections = {s["name"]: s["id"] async for s in db.cliente_custom_sections.find(tgt_q, {"_id": 0, "name": 1, "id": 1})}
    existing_field_names = {f["name"] async for f in db.cliente_custom_fields.find(tgt_q, {"_id": 0, "name": 1})}
    existing_status_values = {s["value"] async for s in db.cliente_custom_statuses.find(tgt_q, {"_id": 0, "value": 1})}

    now = datetime.now(timezone.utc)
    counts = {"sections_copied": 0, "fields_copied": 0, "statuses_copied": 0,
              "sections_skipped": 0, "fields_skipped": 0, "statuses_skipped": 0}

    # 1) Sezioni (mappa old_id -> new_id per rimappare i campi)
    section_id_map = {}
    for s in src_sections:
        if s["name"] in existing_sections:
            section_id_map[s["id"]] = existing_sections[s["name"]]
            counts["sections_skipped"] += 1
            continue
        new_id = str(uuid.uuid4())
        section_id_map[s["id"]] = new_id
        doc = {**s, "id": new_id, "commessa_id": tgt_c, "tipologia_contratto_id": tgt_t,
               "created_at": now, "updated_at": now, "created_by": current_user.id}
        await db.cliente_custom_sections.insert_one(doc)
        counts["sections_copied"] += 1

    # 2) Campi (section_id rimappato)
    for f in src_fields:
        if f["name"] in existing_field_names:
            counts["fields_skipped"] += 1
            continue
        doc = {**f, "id": str(uuid.uuid4()), "commessa_id": tgt_c, "tipologia_contratto_id": tgt_t,
               "section_id": section_id_map.get(f.get("section_id")) if f.get("section_id") else None,
               "created_at": now, "updated_at": now, "created_by": current_user.id}
        await db.cliente_custom_fields.insert_one(doc)
        counts["fields_copied"] += 1

    # 3) Status
    for st in src_statuses:
        if st.get("value") in existing_status_values:
            counts["statuses_skipped"] += 1
            continue
        doc = {**st, "id": str(uuid.uuid4()), "commessa_id": tgt_c, "tipologia_contratto_id": tgt_t,
               "created_at": now, "updated_at": now, "created_by": current_user.id}
        await db.cliente_custom_statuses.insert_one(doc)
        counts["statuses_copied"] += 1

    return {"success": True, "mode": mode, **counts}


# ============================================================
# CLIENTE CUSTOM STATUSES - CRUD (Fase 3)
# ============================================================

STANDARD_CLIENTE_STATUSES = [
    {"value": s.value, "name": s.value.replace("_", " ").title(), "is_standard": True, "stage": "in_lavorazione"}
    for s in ClienteStatus
]
# Manual stage override for standard statuses (for analytics funnel)
_STANDARD_STAGES = {
    "da_inserire": "nuovo",
    "inserito": "chiuso_vinto",
    "ko": "chiuso_perso",
    "infoline": "in_lavorazione",
    "inviata_consumer": "in_lavorazione",
    "problematiche_inserimento": "in_lavorazione",
    "attesa_documenti_clienti": "in_lavorazione",
    "non_acquisibile_richiesta_escalation": "in_lavorazione",
    "in_gestione_struttura_consulente": "in_lavorazione",
    "non_risponde": "in_lavorazione",
    "passata_al_bo": "in_lavorazione",
    "inserito_sotto_altro_canale": "chiuso_vinto",
    "proveniente_da_altro_canale": "in_lavorazione",
    "scontrinare": "in_lavorazione",
}
for _s in STANDARD_CLIENTE_STATUSES:
    _s["stage"] = _STANDARD_STAGES.get(_s["value"], "in_lavorazione")


def _normalize_status_value(name: str) -> str:
    v = re.sub(r'[^a-z0-9_]', '_', name.lower().strip())
    return re.sub(r'_+', '_', v).strip('_')


@router.get("/cliente-custom-statuses", response_model=List[ClienteCustomStatus])
async def get_cliente_custom_statuses(
    commessa_id: Optional[str] = None,
    tipologia_contratto_id: Optional[str] = None,
    active_only: bool = True,
    current_user: User = Depends(get_current_user)
):
    """Get cliente custom statuses filtered by (commessa_id, tipologia_contratto_id)"""
    query = {}
    if commessa_id:
        query["commessa_id"] = commessa_id
    if tipologia_contratto_id:
        query["tipologia_contratto_id"] = tipologia_contratto_id
    if active_only:
        query["active"] = True
    items = await db.cliente_custom_statuses.find(query, {"_id": 0}).sort("order", 1).to_list(length=None)
    return [ClienteCustomStatus(**x) for x in items]


@router.get("/cliente-status-options")
async def get_cliente_status_options(
    commessa_id: Optional[str] = None,
    tipologia_contratto_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Returns combined list of standard + custom statuses for a given (commessa_id + tipologia_contratto_id).
    Used by frontend to populate status dropdowns.
    """
    # Always include standard
    options = [
        {"value": s["value"], "name": s["name"], "color": None, "icon": None, "stage": s["stage"], "is_standard": True}
        for s in STANDARD_CLIENTE_STATUSES
    ]
    # Add custom statuses for (commessa + tipologia) if both provided
    if commessa_id and tipologia_contratto_id:
        custom = await db.cliente_custom_statuses.find(
            {"commessa_id": commessa_id, "tipologia_contratto_id": tipologia_contratto_id, "active": True},
            {"_id": 0}
        ).sort("order", 1).to_list(length=None)
        for c in custom:
            options.append({
                "value": c["value"],
                "name": c["name"],
                "color": c.get("color"),
                "icon": c.get("icon"),
                "stage": c.get("stage", "in_lavorazione"),
                "is_standard": False,
            })
    return options


@router.post("/cliente-custom-statuses", response_model=ClienteCustomStatus)
async def create_cliente_custom_status(
    data: ClienteCustomStatusCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new custom status for a specific (commessa + tipologia_contratto)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can create cliente custom statuses")
    
    # Compute normalized value from name
    normalized_value = _normalize_status_value(data.name)
    if not normalized_value:
        raise HTTPException(status_code=400, detail="Nome status non valido")
    
    # Prevent conflict with standard enum values
    if normalized_value in {s.value for s in ClienteStatus}:
        raise HTTPException(
            status_code=400,
            detail=f"Il valore '{normalized_value}' è riservato a uno status standard. Usa un nome differente."
        )
    
    # Uniqueness per (commessa + tipologia + value)
    existing = await db.cliente_custom_statuses.find_one({
        "commessa_id": data.commessa_id,
        "tipologia_contratto_id": data.tipologia_contratto_id,
        "value": normalized_value
    })
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Uno status '{data.name}' esiste già per questa combinazione commessa+tipologia"
        )
    
    obj = ClienteCustomStatus(
        **data.dict(),
        value=normalized_value,
        created_by=current_user.id
    )
    await db.cliente_custom_statuses.insert_one(obj.dict())
    return obj


@router.put("/cliente-custom-statuses/{status_id}", response_model=ClienteCustomStatus)
async def update_cliente_custom_status(
    status_id: str,
    update_data: ClienteCustomStatusUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update an existing custom status (name/color/icon/stage/order/active). The `value` is NOT editable to preserve historical references."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update cliente custom statuses")
    
    existing = await db.cliente_custom_statuses.find_one({"id": status_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Cliente custom status not found")
    
    update_dict = {k: v for k, v in update_data.dict(exclude_unset=True).items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.cliente_custom_statuses.update_one({"id": status_id}, {"$set": update_dict})
    updated = await db.cliente_custom_statuses.find_one({"id": status_id}, {"_id": 0})
    return ClienteCustomStatus(**updated)


@router.delete("/cliente-custom-statuses/{status_id}")
async def delete_cliente_custom_status(
    status_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a custom status. Clients currently using this status will keep it (historical data), but it won't appear in dropdowns anymore."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete cliente custom statuses")
    
    existing = await db.cliente_custom_statuses.find_one({"id": status_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Cliente custom status not found")
    
    # Count clients using this status (informational)
    clienti_count = await db.clienti.count_documents({"status": existing["value"]})
    
    await db.cliente_custom_statuses.delete_one({"id": status_id})
    return {
        "message": "Cliente custom status deleted",
        "id": status_id,
        "clients_using_status": clienti_count,
        "note": "Gli eventuali clienti con questo status manterranno il valore storico"
    }


@router.get("/analytics/cliente-statuses-breakdown")
async def get_cliente_statuses_breakdown(
    commessa_id: Optional[str] = None,
    tipologia_contratto_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Aggregates clienti by status (standard + custom) with stage mapping for funnel analytics.
    Returns: { total, by_status: [...], by_stage: { nuovo, in_lavorazione, chiuso_vinto, chiuso_perso } }
    """
    query = {"is_active": {"$ne": False}}
    if commessa_id:
        query["commessa_id"] = commessa_id
    if tipologia_contratto_id:
        query["tipologia_contratto_id"] = tipologia_contratto_id
    
    # Aggregation pipeline
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    raw = await db.clienti.aggregate(pipeline).to_list(length=None)
    
    # Build status map (standard + custom)
    status_map = {s["value"]: {**s} for s in STANDARD_CLIENTE_STATUSES}
    custom_query = {}
    if commessa_id:
        custom_query["commessa_id"] = commessa_id
    if tipologia_contratto_id:
        custom_query["tipologia_contratto_id"] = tipologia_contratto_id
    customs = await db.cliente_custom_statuses.find(custom_query, {"_id": 0}).to_list(length=None)
    for c in customs:
        status_map[c["value"]] = {
            "value": c["value"],
            "name": c["name"],
            "stage": c.get("stage", "in_lavorazione"),
            "is_standard": False,
            "color": c.get("color"),
        }
    
    by_status = []
    by_stage = {"nuovo": 0, "in_lavorazione": 0, "chiuso_vinto": 0, "chiuso_perso": 0}
    total = 0
    for entry in raw:
        status_val = entry["_id"]
        cnt = entry["count"]
        total += cnt
        meta = status_map.get(status_val, {
            "value": status_val,
            "name": status_val or "Sconosciuto",
            "stage": "in_lavorazione",
            "is_standard": False,
            "color": None,
        })
        by_status.append({
            "value": status_val,
            "name": meta.get("name"),
            "stage": meta.get("stage", "in_lavorazione"),
            "is_standard": meta.get("is_standard", False),
            "color": meta.get("color"),
            "count": cnt,
        })
        stage = meta.get("stage", "in_lavorazione")
        if stage in by_stage:
            by_stage[stage] += cnt
    
    return {
        "total": total,
        "by_status": by_status,
        "by_stage": by_stage,
        "filters": {"commessa_id": commessa_id, "tipologia_contratto_id": tipologia_contratto_id}
    }


# Document management endpoints
# Global variable to store last upload attempt details for debugging
