"""Route: Lock anagrafica cliente — estratte da server.py (refactoring fase 2, giugno 2026)."""
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
# CLIENTE LOCK SYSTEM (Lucchetto Anagrafica Cliente)
# ============================================================
# Quando un utente apre una scheda cliente (view o edit), acquisisce
# un lock. Altri utenti non possono entrare finché non viene rilasciato
# o scaduto (timeout 10 minuti).

CLIENTE_LOCK_TIMEOUT_MINUTES = 10


class ClienteLockInfo(BaseModel):
    cliente_id: str
    user_id: str
    username: str
    locked_at: datetime
    expires_at: datetime
    last_heartbeat: datetime


def _lock_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=CLIENTE_LOCK_TIMEOUT_MINUTES)


async def _get_active_lock(cliente_id: str) -> Optional[dict]:
    """Return active (not expired) lock document for the cliente, or None."""
    now = datetime.now(timezone.utc)
    lock = await db.cliente_locks.find_one({"cliente_id": cliente_id}, {"_id": 0})
    if not lock:
        return None
    # Parse datetime if stored as string
    expires_at = lock.get("expires_at")
    if isinstance(expires_at, str):
        try:
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        except Exception:
            expires_at = None
    if not expires_at:
        await db.cliente_locks.delete_one({"cliente_id": cliente_id})
        return None
    # Make tz-aware if naive
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        # Expired → remove it
        await db.cliente_locks.delete_one({"cliente_id": cliente_id})
        return None
    return lock


@router.post("/clienti/{cliente_id}/lock")
async def acquire_cliente_lock(
    cliente_id: str,
    current_user: User = Depends(get_current_user)
):
    """Acquire a lock on the cliente profile.
    - Returns 200 with lock info if acquired (or refreshed for same user).
    - Returns 409 with {locked_by} if another user holds the lock.
    """
    # Verify cliente exists
    cliente_doc = await db.clienti.find_one({"id": cliente_id}, {"_id": 0})
    if not cliente_doc:
        raise HTTPException(status_code=404, detail="Cliente non trovato")

    now = datetime.now(timezone.utc)
    existing = await _get_active_lock(cliente_id)

    if existing and existing.get("user_id") != current_user.id:
        # Another user owns the active lock → forbidden
        return JSONResponse(
            status_code=409,
            content={
                "locked": True,
                "cliente_id": cliente_id,
                "locked_by": {
                    "user_id": existing.get("user_id"),
                    "username": existing.get("username"),
                },
                "locked_at": existing.get("locked_at").isoformat() if isinstance(existing.get("locked_at"), datetime) else existing.get("locked_at"),
                "expires_at": existing.get("expires_at").isoformat() if isinstance(existing.get("expires_at"), datetime) else existing.get("expires_at"),
                "message": f"🔒 Scheda in lavorazione da {existing.get('username')}",
            },
        )

    # Acquire or refresh for current user
    lock_doc = {
        "cliente_id": cliente_id,
        "user_id": current_user.id,
        "username": current_user.username,
        "locked_at": existing.get("locked_at") if existing else now,
        "expires_at": _lock_expiry(),
        "last_heartbeat": now,
    }
    await db.cliente_locks.update_one(
        {"cliente_id": cliente_id},
        {"$set": lock_doc},
        upsert=True,
    )
    return {
        "locked": True,
        "owned_by_me": True,
        "cliente_id": cliente_id,
        "user_id": current_user.id,
        "username": current_user.username,
        "locked_at": lock_doc["locked_at"].isoformat() if isinstance(lock_doc["locked_at"], datetime) else lock_doc["locked_at"],
        "expires_at": lock_doc["expires_at"].isoformat(),
    }


@router.delete("/clienti/{cliente_id}/lock")
async def release_cliente_lock(
    cliente_id: str,
    current_user: User = Depends(get_current_user)
):
    """Release the lock. Only the owner can release (admin can always release)."""
    existing = await _get_active_lock(cliente_id)
    if not existing:
        return {"released": True, "message": "Nessun lock attivo"}
    if existing.get("user_id") != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo il proprietario del lock o un admin può rilasciarlo")
    await db.cliente_locks.delete_one({"cliente_id": cliente_id})
    return {"released": True, "cliente_id": cliente_id}


@router.post("/clienti/{cliente_id}/lock/heartbeat")
async def heartbeat_cliente_lock(
    cliente_id: str,
    current_user: User = Depends(get_current_user)
):
    """Refresh the lock expiry. Only the owner can heartbeat."""
    existing = await _get_active_lock(cliente_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Lock non trovato o scaduto")
    if existing.get("user_id") != current_user.id:
        return JSONResponse(
            status_code=409,
            content={
                "locked": True,
                "owned_by_me": False,
                "locked_by": {
                    "user_id": existing.get("user_id"),
                    "username": existing.get("username"),
                },
                "message": f"Il lock è ora detenuto da {existing.get('username')}",
            },
        )
    now = datetime.now(timezone.utc)
    new_expiry = _lock_expiry()
    await db.cliente_locks.update_one(
        {"cliente_id": cliente_id},
        {"$set": {"last_heartbeat": now, "expires_at": new_expiry}},
    )
    return {"refreshed": True, "expires_at": new_expiry.isoformat()}


@router.get("/clienti/{cliente_id}/lock")
async def get_cliente_lock_status(
    cliente_id: str,
    current_user: User = Depends(get_current_user)
):
    """Return current lock status for a cliente (or null)."""
    existing = await _get_active_lock(cliente_id)
    if not existing:
        return {"locked": False}
    return {
        "locked": True,
        "owned_by_me": existing.get("user_id") == current_user.id,
        "cliente_id": cliente_id,
        "user_id": existing.get("user_id"),
        "username": existing.get("username"),
        "locked_at": existing.get("locked_at").isoformat() if isinstance(existing.get("locked_at"), datetime) else existing.get("locked_at"),
        "expires_at": existing.get("expires_at").isoformat() if isinstance(existing.get("expires_at"), datetime) else existing.get("expires_at"),
    }


@router.post("/clienti/{cliente_id}/lock/force-release")
async def force_release_cliente_lock(
    cliente_id: str,
    current_user: User = Depends(get_current_user)
):
    """Admin-only: force release any lock on this cliente."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo admin può forzare il rilascio del lock")
    result = await db.cliente_locks.delete_one({"cliente_id": cliente_id})
    return {"force_released": True, "deleted": result.deleted_count}


@router.get("/cliente-locks")
async def list_cliente_locks(current_user: User = Depends(get_current_user)):
    """Return list of all active (non-expired) cliente locks.
    Used by the frontend to show 🔒 badges on the clients list.
    """
    now = datetime.now(timezone.utc)
    # Cleanup expired locks opportunistically
    await db.cliente_locks.delete_many({"expires_at": {"$lt": now}})
    locks = await db.cliente_locks.find({}, {"_id": 0}).to_list(length=None)
    # Serialize datetimes
    out = []
    for l in locks:
        out.append({
            "cliente_id": l.get("cliente_id"),
            "user_id": l.get("user_id"),
            "username": l.get("username"),
            "locked_at": l.get("locked_at").isoformat() if isinstance(l.get("locked_at"), datetime) else l.get("locked_at"),
            "expires_at": l.get("expires_at").isoformat() if isinstance(l.get("expires_at"), datetime) else l.get("expires_at"),
            "owned_by_me": l.get("user_id") == current_user.id,
        })
    return {"locks": out, "count": len(out)}



