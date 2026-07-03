"""Route: colori personalizzati degli Status (Cliente fissi/custom + Lead). Modifica solo Admin.

- Cliente fissi: nessun colore nativo → override salvato in collezione `status_colors`.
- Cliente custom: hanno già `color` in `cliente_custom_statuses` (override in `status_colors` ha priorità).
- Lead: hanno già `colore` in `lead_statuses` → si aggiorna direttamente lì.
"""
import logging
import re
from datetime import datetime, timezone
from typing import Dict, Any

from fastapi import APIRouter, HTTPException, Depends, Body

from database import db
from security import get_current_user
from models import User, UserRole

router = APIRouter()
logger = logging.getLogger(__name__)

HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")

# Status Cliente FISSI (enum ClienteStatus) con label e colore di default
CLIENTE_FIXED_STATUSES = [
    ("inserito", "Inserito", "#22c55e"),
    ("ko", "KO", "#ef4444"),
    ("infoline", "Infoline", "#64748b"),
    ("inviata_consumer", "Inviata Consumer", "#3b82f6"),
    ("problematiche_inserimento", "Problematiche Inserimento", "#f97316"),
    ("attesa_documenti_clienti", "Attesa Documenti Clienti", "#eab308"),
    ("non_acquisibile_richiesta_escalation", "Non Acquisibile - Richiesta Escalation", "#dc2626"),
    ("in_gestione_struttura_consulente", "In Gestione Struttura/Consulente", "#8b5cf6"),
    ("non_risponde", "Non Risponde", "#94a3b8"),
    ("passata_al_bo", "Passata al BO", "#0ea5e9"),
    ("da_inserire", "Da Inserire", "#a855f7"),
    ("inserito_sotto_altro_canale", "Inserito Sotto Altro Canale", "#14b8a6"),
    ("proveniente_da_altro_canale", "Proveniente da Altro Canale", "#06b6d4"),
    ("scontrinare", "Scontrinare", "#f59e0b"),
]


async def _cliente_overrides() -> Dict[str, str]:
    out = {}
    async for o in db.status_colors.find({"scope": "cliente"}, {"_id": 0, "key": 1, "color": 1}):
        if o.get("key") and o.get("color"):
            out[o["key"]] = o["color"]
    return out


@router.get("/status-colors")
async def get_status_colors(current_user: User = Depends(get_current_user)):
    """Mappa colori per i badge. cliente: base dai custom + override; lead: da lead_statuses."""
    cliente_map: Dict[str, str] = {}
    async for s in db.cliente_custom_statuses.find({}, {"_id": 0, "value": 1, "color": 1}):
        if s.get("value") and s.get("color"):
            cliente_map[s["value"]] = s["color"]
    cliente_map.update(await _cliente_overrides())

    lead_map: Dict[str, str] = {}
    async for s in db.lead_statuses.find({}, {"_id": 0, "id": 1, "nome": 1, "colore": 1}):
        if s.get("colore"):
            if s.get("id"):
                lead_map[s["id"]] = s["colore"]
            if s.get("nome"):
                lead_map[s["nome"]] = s["colore"]
    return {"cliente": cliente_map, "lead": lead_map}


@router.get("/status-colors/catalog")
async def get_status_colors_catalog(current_user: User = Depends(get_current_user)):
    """Elenco completo degli status da colorare (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può gestire i colori degli status")

    overrides = await _cliente_overrides()
    cliente_fixed = [
        {"key": k, "label": label, "color": overrides.get(k, default)}
        for k, label, default in CLIENTE_FIXED_STATUSES
    ]

    cliente_custom = []
    seen = set()
    async for s in db.cliente_custom_statuses.find({"active": {"$ne": False}}, {"_id": 0, "value": 1, "name": 1, "color": 1}).sort("order", 1):
        v = s.get("value")
        if not v or v in seen:
            continue
        seen.add(v)
        cliente_custom.append({
            "key": v,
            "label": s.get("name") or v,
            "color": overrides.get(v, s.get("color") or "#6366f1"),
        })

    lead = []
    async for s in db.lead_statuses.find({"is_active": {"$ne": False}}, {"_id": 0, "id": 1, "nome": 1, "colore": 1}).sort("ordine", 1):
        lead.append({
            "key": s.get("id"),
            "label": s.get("nome") or s.get("id"),
            "color": s.get("colore") or "#3b82f6",
        })

    return {"cliente_fixed": cliente_fixed, "cliente_custom": cliente_custom, "lead": lead}


@router.put("/status-colors")
async def set_status_color(payload: Dict[str, Any] = Body(...), current_user: User = Depends(get_current_user)):
    """Imposta il colore di uno status (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può gestire i colori degli status")

    scope = (payload or {}).get("scope")
    key = (payload or {}).get("key")
    color = (payload or {}).get("color")
    if scope not in ("cliente", "lead"):
        raise HTTPException(status_code=400, detail="scope deve essere 'cliente' o 'lead'")
    if not key:
        raise HTTPException(status_code=400, detail="key obbligatorio")
    if not color or not HEX_RE.match(str(color)):
        raise HTTPException(status_code=400, detail="color deve essere un colore hex valido (es. #3b82f6)")

    if scope == "cliente":
        await db.status_colors.update_one(
            {"scope": "cliente", "key": key},
            {"$set": {"color": color, "updated_by": current_user.id, "updated_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
    else:  # lead → aggiorna direttamente il colore nella collezione lead_statuses
        res = await db.lead_statuses.update_one({"id": key}, {"$set": {"colore": color}})
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Status lead non trovato")

    return {"ok": True, "scope": scope, "key": key, "color": color}
