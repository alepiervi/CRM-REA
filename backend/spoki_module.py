"""
Spoki WhatsApp Integration Module per Nureal CRM.

Architettura:
- SpokiService: client HTTP centralizzato verso https://api.spoki.com/api/1/
- Modelli Mongo: UnitSpokiConfig (per-unit phone/template), UnitCalendarConfig (working hours),
  Appointment (booking dal chatbot), LeadChatbotSession (memoria multi-turno gpt-4o-mini)
- Tutta l'autenticazione Spoki passa da un'unica X-Spoki-Api-Key letta da env.

Note:
- L'API Spoki accetta header `X-Spoki-Api-Key`. Endpoint esatti (es. /messages/send vs /messages)
  saranno confermati appena la chiave funziona; il service è scritto per essere flessibile.
- Webhook inbound atterra su POST /api/spoki/webhook (in spoki_routes.py).
"""
from __future__ import annotations

import os
import hmac
import hashlib
import uuid
import logging
from datetime import datetime, timezone, time, timedelta, date as date_type
from typing import Optional, List, Dict, Any
from enum import Enum

import httpx
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

SPOKI_BASE_URL = "https://api.spoki.com/api/1"


# =====================================================
# MODELLI Pydantic / Mongo
# =====================================================

class SpokiPairingStatus(str, Enum):
    NOT_PAIRED = "not_paired"
    PAIRING = "pairing"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"


class UnitSpokiConfig(BaseModel):
    """Configurazione Spoki per singola Unit (1:1 con commessa.id o unit.id).

    NOTE multi-tenancy: usiamo UNA sola API key globale (env SPOKI_API_KEY).
    Per Unit conserviamo solo il numero WhatsApp da pairare via QR e il template
    di benvenuto preferito.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_id: str  # commessa_id o sub_agenzia_id o un id Unit reale
    unit_label: Optional[str] = None  # nome leggibile, popolato in fetch
    whatsapp_number: Optional[str] = None  # es. +393331234567
    pairing_status: SpokiPairingStatus = SpokiPairingStatus.NOT_PAIRED
    spoki_connection_id: Optional[str] = None  # restituito da Spoki dopo pairing
    welcome_template_name: Optional[str] = None
    welcome_template_language: str = "it"
    welcome_template_variables: Dict[str, str] = Field(default_factory=dict)
    # Prompt di sistema per il chatbot (italiano)
    chatbot_system_prompt: Optional[str] = None
    chatbot_enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UnitSpokiConfigUpdate(BaseModel):
    whatsapp_number: Optional[str] = None
    welcome_template_name: Optional[str] = None
    welcome_template_language: Optional[str] = None
    welcome_template_variables: Optional[Dict[str, str]] = None
    chatbot_system_prompt: Optional[str] = None
    chatbot_enabled: Optional[bool] = None


class WorkingHourSlot(BaseModel):
    """Slot orario lavorativo per un giorno della settimana."""
    weekday: int  # 0=Lunedì .. 6=Domenica (ISO)
    start_time: str  # "09:00"
    end_time: str    # "18:00"


class UnitCalendarConfig(BaseModel):
    """Configurazione calendario per Unit: orari lavorativi + durata slot + blackout."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_id: str
    working_hours: List[WorkingHourSlot] = Field(default_factory=list)
    slot_duration_minutes: int = 30
    timezone: str = "Europe/Rome"
    blackout_dates: List[str] = Field(default_factory=list)  # ISO YYYY-MM-DD
    advance_booking_min_hours: int = 2  # non si può prenotare nelle prossime N ore
    advance_booking_max_days: int = 30
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AppointmentStatus(str, Enum):
    PROPOSED = "proposed"      # proposto da bot, in attesa di conferma cliente
    PENDING = "pending"        # accettato da cliente, in attesa di conferma Unit
    CONFIRMED = "confirmed"    # confermato da super_referente
    CANCELED = "canceled"
    COMPLETED = "completed"
    NO_SHOW = "no_show"


class Appointment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_id: str
    lead_id: Optional[str] = None
    cliente_id: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_name: Optional[str] = None
    appointment_date: str  # ISO YYYY-MM-DD
    appointment_time: str  # HH:MM (24h)
    duration_minutes: int = 30
    status: AppointmentStatus = AppointmentStatus.PROPOSED
    notes: Optional[str] = None
    booked_via: str = "chatbot"  # "chatbot" | "manual"
    confirmed_by_id: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class LeadChatbotSession(BaseModel):
    """Sessione multi-turno chatbot per un lead. Memoria storica in `messages`."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    unit_id: Optional[str] = None
    status: str = "active"  # "active" | "qualified" | "appointment_booked" | "lost" | "timeout"
    qualification_score: int = 0
    intent_detected: Optional[str] = None
    proposed_appointment_id: Optional[str] = None
    messages: List[Dict[str, str]] = Field(default_factory=list)  # [{role, content, ts}]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SpokiMessage(BaseModel):
    """Log unificato dei messaggi WhatsApp (in/out)."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_id: Optional[str] = None
    lead_id: Optional[str] = None
    cliente_id: Optional[str] = None
    direction: str  # "outbound" | "inbound"
    phone_number: str
    body: Optional[str] = None
    template_name: Optional[str] = None
    template_variables: Optional[Dict[str, str]] = None
    spoki_message_id: Optional[str] = None
    status: Optional[str] = None  # sent | delivered | read | failed | received
    error: Optional[str] = None
    sender: str = "system"  # "system" | "bot" | "admin" | "lead"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# =====================================================
# SpokiService — client HTTP
# =====================================================

class SpokiService:
    """Client per Spoki API. Singola API key da env SPOKI_API_KEY."""

    def __init__(self, api_key: Optional[str] = None, base_url: str = SPOKI_BASE_URL):
        self.api_key = api_key or os.environ.get("SPOKI_API_KEY", "")
        self.base_url = base_url.rstrip("/")
        self.webhook_secret = os.environ.get("SPOKI_WEBHOOK_SECRET", "")

    def _headers(self) -> Dict[str, str]:
        return {
            "X-Spoki-Api-Key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def _request(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("SPOKI_API_KEY non configurato in backend/.env")
        url = f"{self.base_url}{path}"
        timeout = kwargs.pop("timeout", 15.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.request(method, url, headers=self._headers(), **kwargs)
        if res.status_code == 401:
            raise RuntimeError("Spoki API: 401 Unauthorized — verificare validità della SPOKI_API_KEY")
        if res.status_code >= 400:
            try:
                detail = res.json()
            except Exception:
                detail = res.text
            raise RuntimeError(f"Spoki API {method} {path} → {res.status_code}: {detail}")
        try:
            return res.json()
        except Exception:
            return {"raw": res.text}

    async def list_templates(self) -> List[Dict[str, Any]]:
        """Ritorna i template WhatsApp approvati sull'account Spoki."""
        data = await self._request("GET", "/templates")
        if isinstance(data, list):
            return data
        return data.get("items") or data.get("data") or data.get("templates") or []

    async def send_template_message(
        self,
        to: str,
        template_name: str,
        language: str = "it",
        variables: Optional[Dict[str, str]] = None,
        connection_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Invia un template WhatsApp. variables: mapping nome_var → valore (es. {"nome": "Mario"})."""
        payload: Dict[str, Any] = {
            "to": to,
            "type": "template",
            "template": {
                "name": template_name,
                "language": language,
                "variables": variables or {},
            },
        }
        if connection_id:
            payload["connection_id"] = connection_id
        return await self._request("POST", "/messages/send", json=payload)

    async def send_session_message(
        self, to: str, body: str, connection_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Invia messaggio free-text (entro la finestra 24h di Whatsapp Business)."""
        payload: Dict[str, Any] = {"to": to, "body": body}
        if connection_id:
            payload["connection_id"] = connection_id
        return await self._request("POST", "/messages/send", json=payload)

    async def generate_pairing_qr(self, unit_id: str) -> Dict[str, Any]:
        """Richiede a Spoki un QR di pairing per associare un numero WhatsApp alla Unit.
        L'endpoint esatto va confermato; struttura tipica: POST /connections + GET QR.
        """
        # Best-effort: tentativo su endpoint comuni
        try:
            return await self._request("POST", "/connections", json={"label": f"unit-{unit_id}"})
        except RuntimeError as e:
            logger.warning(f"Spoki /connections fallito ({e}), nessun QR generato.")
            raise

    def verify_webhook_signature(self, raw_body: bytes, signature_header: Optional[str]) -> bool:
        """Verifica firma HMAC del webhook Spoki. Header e algoritmo esatti vanno confermati."""
        if not self.webhook_secret:
            # senza secret configurato salta la verifica (utile in dev)
            return True
        if not signature_header:
            return False
        expected = hmac.new(
            key=self.webhook_secret.encode("utf-8"),
            msg=raw_body,
            digestmod=hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature_header)


# Singleton istanziato a runtime usando l'env (creato in spoki_routes.py)
