"""Route: Segnalazioni — i Segnalatori inseriscono clienti segnalati, il BackOffice Commessa li esita."""
import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel, Field

from database import db
from security import get_current_user
from models import User, UserRole
from services import NextcloudClient

router = APIRouter()
logger = logging.getLogger(__name__)

ESITI = ["OK", "KO", "NR"]
SOTTO_ESITI_OK = ["OK Energy", "OK Gas", "OK Dual", "OK Fisso", "OK Fisso + Mobile", "OK Mobile"]
ESITO_ROLES = {UserRole.ADMIN, UserRole.RESPONSABILE_COMMESSA, UserRole.BACKOFFICE_COMMESSA}
MAX_DOC_SIZE = 25 * 1024 * 1024


class SegnalazioneCreate(BaseModel):
    nome: str = Field(min_length=1)
    cognome: str = Field(min_length=1)
    telefono: str = Field(min_length=5, max_length=20, pattern=r"^\+?[0-9 ./-]{5,20}$")
    note: Optional[str] = ""
    commessa_id: str
    servizio_id: str


class EsitoUpdate(BaseModel):
    esito: str
    sotto_esiti: List[str] = []
    nota_esito: Optional[str] = ""


def _scope_query(user: User) -> dict:
    if user.role == UserRole.ADMIN:
        return {}
    if user.role == UserRole.SEGNALATORE:
        return {"created_by": user.id}
    if user.role in ESITO_ROLES:
        q = {"commessa_id": {"$in": user.commesse_autorizzate or []}}
        if user.servizi_autorizzati:
            q["servizio_id"] = {"$in": user.servizi_autorizzati}
        return q
    raise HTTPException(status_code=403, detail="Accesso non consentito alle segnalazioni")


async def _get_accessible(segnalazione_id: str, user: User) -> dict:
    doc = await db.segnalazioni.find_one({"id": segnalazione_id, **_scope_query(user)}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Segnalazione non trovata")
    return doc


async def _aruba_client(commessa_id: str) -> NextcloudClient:
    commessa = await db.commesse.find_one({"id": commessa_id}, {"_id": 0})
    cfg = (commessa or {}).get("aruba_drive_config") or {}
    if not cfg.get("enabled"):
        settings = await db.settings.find_one({"key": "aruba_drive_global"}, {"_id": 0})
        cfg = (settings or {}).get("value") or {}
    if not cfg.get("enabled") or not cfg.get("url"):
        raise HTTPException(status_code=400, detail="Aruba Drive non è configurato per questa commessa. Contattare l'amministratore.")
    root = (cfg.get("root_folder_path") or (commessa or {}).get("nome") or "Documenti").strip("/")
    return NextcloudClient(base_url=cfg["url"], username=cfg.get("username"), password=cfg.get("password"),
                           folder_path=f"{root}/Segnalazioni")


def _safe(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", (s or "").strip()).strip("_")


@router.get("/segnalazioni/options")
async def get_segnalazioni_options(current_user: User = Depends(get_current_user)):
    """Commesse e servizi su cui l'utente può inserire/filtrare segnalazioni."""
    _scope_query(current_user)
    c_query = {"is_active": {"$ne": False}}
    s_query = {"is_active": {"$ne": False}}
    if current_user.role != UserRole.ADMIN:
        c_query["id"] = {"$in": current_user.commesse_autorizzate or []}
        if current_user.servizi_autorizzati:
            s_query["id"] = {"$in": current_user.servizi_autorizzati}
    commesse = await db.commesse.find(c_query, {"_id": 0, "id": 1, "nome": 1}).to_list(None)
    s_query["commessa_id"] = {"$in": [c["id"] for c in commesse]}
    servizi = await db.servizi.find(s_query, {"_id": 0, "id": 1, "nome": 1, "commessa_id": 1}).to_list(None)
    result = []
    for c in sorted(commesse, key=lambda x: (x.get("nome") or "").lower()):
        srv = sorted([s for s in servizi if s["commessa_id"] == c["id"]], key=lambda x: (x.get("nome") or "").lower())
        if srv:
            result.append({"id": c["id"], "nome": c["nome"], "servizi": [{"id": s["id"], "nome": s["nome"]} for s in srv]})
    return {"commesse": result, "esiti": ESITI, "sotto_esiti_ok": SOTTO_ESITI_OK}


@router.get("/segnalazioni/da-lavorare/count")
async def count_da_lavorare(current_user: User = Depends(get_current_user)):
    if current_user.role not in ESITO_ROLES:
        return {"count": 0}
    return {"count": await db.segnalazioni.count_documents({**_scope_query(current_user), "esito": None})}


@router.post("/segnalazioni")
async def create_segnalazione(data: SegnalazioneCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in (UserRole.SEGNALATORE, UserRole.ADMIN):
        raise HTTPException(status_code=403, detail="Solo i Segnalatori possono inserire segnalazioni")
    servizio = await db.servizi.find_one({"id": data.servizio_id, "commessa_id": data.commessa_id}, {"_id": 0})
    if not servizio:
        raise HTTPException(status_code=400, detail="Servizio non valido per la commessa selezionata")
    if current_user.role == UserRole.SEGNALATORE:
        if data.commessa_id not in (current_user.commesse_autorizzate or []) or (
            current_user.servizi_autorizzati and data.servizio_id not in current_user.servizi_autorizzati
        ):
            raise HTTPException(status_code=403, detail="Commessa o servizio non autorizzati")
    commessa = await db.commesse.find_one({"id": data.commessa_id}, {"_id": 0, "nome": 1})
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "nome": data.nome.strip(),
        "cognome": data.cognome.strip(),
        "telefono": data.telefono.strip(),
        "note": (data.note or "").strip(),
        "commessa_id": data.commessa_id,
        "commessa_nome": (commessa or {}).get("nome"),
        "servizio_id": data.servizio_id,
        "servizio_nome": servizio.get("nome"),
        "esito": None,
        "sotto_esiti": [],
        "nota_esito": "",
        "esito_history": [],
        "documents": [],
        "created_by": current_user.id,
        "created_by_username": current_user.username,
        "created_at": now,
        "updated_at": now,
    }
    await db.segnalazioni.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/segnalazioni")
async def list_segnalazioni(
    esito: Optional[str] = None,
    commessa_id: Optional[str] = None,
    servizio_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    query = _scope_query(current_user)
    if esito == "da_lavorare":
        query["esito"] = None
    elif esito in ESITI:
        query["esito"] = esito
    if commessa_id:
        if "commessa_id" in query and commessa_id not in query["commessa_id"]["$in"]:
            return []
        query["commessa_id"] = commessa_id
    if servizio_id:
        if "servizio_id" in query and servizio_id not in query["servizio_id"]["$in"]:
            return []
        query["servizio_id"] = servizio_id
    if search and search.strip():
        rx = {"$regex": re.escape(search.strip()), "$options": "i"}
        query["$or"] = [{"nome": rx}, {"cognome": rx}, {"telefono": rx}, {"created_by_username": rx}]
    return await db.segnalazioni.find(query, {"_id": 0, "esito_history": 0}).sort("created_at", -1).to_list(1000)


@router.get("/segnalazioni/{segnalazione_id}")
async def get_segnalazione(segnalazione_id: str, current_user: User = Depends(get_current_user)):
    return await _get_accessible(segnalazione_id, current_user)


@router.put("/segnalazioni/{segnalazione_id}/esito")
async def update_esito(segnalazione_id: str, data: EsitoUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ESITO_ROLES:
        raise HTTPException(status_code=403, detail="Solo il BackOffice Commessa può esitare le segnalazioni")
    await _get_accessible(segnalazione_id, current_user)
    if data.esito not in ESITI:
        raise HTTPException(status_code=400, detail="Esito non valido")
    sotto = [s for s in SOTTO_ESITI_OK if s in data.sotto_esiti] if data.esito == "OK" else []
    if data.esito == "OK" and not sotto:
        raise HTTPException(status_code=400, detail="Con esito OK seleziona almeno un sotto esito")
    now = datetime.now(timezone.utc).isoformat()
    entry = {"esito": data.esito, "sotto_esiti": sotto, "nota_esito": (data.nota_esito or "").strip(),
             "by_id": current_user.id, "by_username": current_user.username, "at": now}
    await db.segnalazioni.update_one(
        {"id": segnalazione_id},
        {"$set": {"esito": data.esito, "sotto_esiti": sotto, "nota_esito": entry["nota_esito"],
                  "esito_by": current_user.username, "esito_at": now, "updated_at": now},
         "$push": {"esito_history": entry}},
    )
    return await db.segnalazioni.find_one({"id": segnalazione_id}, {"_id": 0})


@router.post("/segnalazioni/{segnalazione_id}/documents")
async def upload_segnalazione_document(
    segnalazione_id: str, file: UploadFile = File(...), current_user: User = Depends(get_current_user)
):
    seg = await _get_accessible(segnalazione_id, current_user)
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File vuoto")
    if len(content) > MAX_DOC_SIZE:
        raise HTTPException(status_code=400, detail="File troppo grande (max 25MB)")
    client = await _aruba_client(seg["commessa_id"])
    original = file.filename or "documento"
    stem, ext = _safe(Path(original).stem) or "documento", Path(original).suffix.lower()
    prefix = "_".join(p for p in [_safe(seg["telefono"]), _safe(seg["nome"]), _safe(seg["cognome"])] if p)
    filename = f"{prefix}_{uuid.uuid4().hex[:6]}_{stem}{ext}"
    ok, cloud_path = await client.upload_file(content, filename)
    if not ok:
        raise HTTPException(status_code=503, detail="Errore di caricamento su Aruba Drive. Il documento NON è stato salvato.")
    doc = {
        "id": str(uuid.uuid4()),
        "filename": filename,
        "original_filename": original,
        "cloud_path": cloud_path,
        "file_type": file.content_type or "application/octet-stream",
        "file_size": len(content),
        "uploaded_by": current_user.username,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.segnalazioni.update_one({"id": segnalazione_id}, {"$push": {"documents": doc}})
    return doc


@router.get("/segnalazioni/{segnalazione_id}/documents/{document_id}/download")
async def download_segnalazione_document(
    segnalazione_id: str, document_id: str, current_user: User = Depends(get_current_user)
):
    seg = await _get_accessible(segnalazione_id, current_user)
    doc = next((d for d in seg.get("documents", []) if d["id"] == document_id), None)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento non trovato")
    client = await _aruba_client(seg["commessa_id"])
    ok, content = await client.download_file(doc["filename"])
    if not ok:
        raise HTTPException(status_code=404, detail="File non trovato su Aruba Drive")
    return Response(content=content, media_type=doc["file_type"],
                    headers={"Content-Disposition": f'attachment; filename="{doc["original_filename"]}"'})
