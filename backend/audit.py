"""Audit log clienti — helper condiviso (estratto da server.py, refactoring fase 2)."""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from database import db
from models import ClienteLogAction, User

async def log_client_action(
    cliente_id: str,
    action: ClienteLogAction,
    description: str,
    user: User,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None
):
    """Registra un'azione nel log di audit del cliente"""
    try:
        log_entry = {
            "id": str(uuid.uuid4()),
            "cliente_id": cliente_id,
            "action": action.value,
            "description": description,
            "user_id": user.id,
            "user_name": user.username,  # Usa username invece di nome/cognome
            "user_role": user.role.value,
            "old_value": old_value,
            "new_value": new_value,
            "metadata": metadata or {},
            "timestamp": datetime.now(timezone.utc),
            "ip_address": ip_address
        }
        
        # Rimuovi _id se presente per evitare conflitti MongoDB
        if '_id' in log_entry:
            del log_entry['_id']
            
        await db.clienti_logs.insert_one(log_entry)
        logging.info(f"📝 CLIENT LOG: {action.value} for cliente {cliente_id} by {user.username} ({user.email})")
        
    except Exception as e:
        logging.error(f"Error logging client action: {e}")
        # Non interrompere l'operazione principale se il logging fallisce

