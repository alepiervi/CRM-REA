"""
Spoki / Chatbot / Calendar / Appointments API routes.

Uso:
    from spoki_routes import build_spoki_routers
    spoki_router, calendar_router = build_spoki_routers(db, get_current_user, UserRole)
    api_router.include_router(spoki_router)
    api_router.include_router(calendar_router)
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, Request, Body

from spoki_module import (
    SpokiService, UnitSpokiConfig, UnitSpokiConfigUpdate, SpokiPairingStatus,
    UnitCalendarConfig, WorkingHourSlot, Appointment, AppointmentStatus,
    SpokiMessage, LeadChatbotSession,
)
from spoki_chatbot import (
    chatbot_generate_reply, find_next_free_slot, find_slot_near,
    DEFAULT_SYSTEM_PROMPT_IT,
)

logger = logging.getLogger(__name__)
spoki_service = SpokiService()


def build_spoki_routers(db, get_current_user, UserRole):
    """Costruisce e ritorna (spoki_router, calendar_router) con dependency reale."""
    router = APIRouter(prefix="/spoki", tags=["spoki"])
    calendar_router = APIRouter(prefix="/calendar", tags=["calendar"])

    # ---- helpers di autorizzazione ----
    def _require_admin(user):
        if user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Riservato ad Admin")

    async def _user_can_see_unit(user, unit_id: str) -> bool:
        if user.role == UserRole.ADMIN:
            return True
        if user.role == UserRole.SUPER_REFERENTE and getattr(user, "unit_id", None) == unit_id:
            return True
        if getattr(user, "commesse_autorizzate", None) and unit_id in user.commesse_autorizzate:
            return True
        return False

    # ---- helpers interni (richiamabili anche fuori dai router) ----
    async def send_welcome_for_lead(lead: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not lead.get("id") or not lead.get("telefono") or not lead.get("commessa_id"):
            return None
        unit_id = lead["commessa_id"]
        cfg = await db.unit_spoki_configs.find_one({"unit_id": unit_id}, {"_id": 0})
        if not cfg or not cfg.get("welcome_template_name"):
            return None
        already = await db.spoki_messages.find_one({
            "lead_id": lead["id"], "direction": "outbound",
            "template_name": cfg["welcome_template_name"],
        })
        if already:
            return None
        variables = {"nome": lead.get("nome") or "Cliente", "cognome": lead.get("cognome") or ""}
        variables.update(cfg.get("welcome_template_variables") or {})
        out = SpokiMessage(
            unit_id=unit_id, lead_id=lead["id"], direction="outbound",
            phone_number=lead["telefono"], template_name=cfg["welcome_template_name"],
            template_variables=variables, sender="system",
        ).dict()
        try:
            if not spoki_service.is_configured:
                out["status"] = "skipped_no_api_key"
            else:
                res = await spoki_service.send_template_message(
                    to=lead["telefono"], template_name=cfg["welcome_template_name"],
                    language=cfg.get("welcome_template_language") or "it",
                    variables=variables, connection_id=cfg.get("spoki_connection_id"),
                )
                out["spoki_message_id"] = res.get("id") or res.get("message_id")
                out["status"] = res.get("status") or "sent"
        except Exception as e:
            out["status"] = "failed"
            out["error"] = str(e)[:500]
            logger.exception(f"send_welcome_for_lead error: {e}")
        await db.spoki_messages.insert_one(out)
        return out

    async def _bot_handle_inbound(lead: Dict[str, Any], user_message: str) -> None:
        lead_id = lead["id"]
        unit_id = lead.get("commessa_id")
        cfg = await db.unit_spoki_configs.find_one({"unit_id": unit_id}, {"_id": 0}) if unit_id else None
        if cfg and cfg.get("chatbot_enabled") is False:
            return
        sys_prompt = (cfg or {}).get("chatbot_system_prompt") or DEFAULT_SYSTEM_PROMPT_IT
        session = await db.lead_chatbot_sessions.find_one({"lead_id": lead_id}, {"_id": 0})
        if not session:
            session = LeadChatbotSession(lead_id=lead_id, unit_id=unit_id).dict()
            await db.lead_chatbot_sessions.insert_one(session)
        history = session.get("messages", [])
        history.append({"role": "user", "content": user_message, "ts": datetime.now(timezone.utc).isoformat()})

        next_slot_hint = None
        if unit_id and session.get("status") in ("active", "scheduling"):
            slot = await find_next_free_slot(db, unit_id)
            if slot:
                next_slot_hint = f"{slot['weekday']} {slot['date']} alle {slot['time']}"

        reply = await chatbot_generate_reply(
            lead_id=lead_id, user_message=user_message, history=history,
            system_prompt=sys_prompt, next_free_slot_hint=next_slot_hint,
        )
        bot_text = (reply.get("reply") or "").strip() or "Grazie!"
        history.append({"role": "assistant", "content": bot_text, "ts": datetime.now(timezone.utc).isoformat()})

        intent = reply.get("intent") or "unclear"
        new_status = session.get("status", "active")
        appt_id = None
        if reply.get("ready_to_book") and unit_id:
            user_iso = reply.get("user_proposed_datetime") or ""
            chosen = None
            if user_iso:
                chosen = await find_slot_near(db, unit_id, user_iso)
            if not chosen:
                chosen = await find_next_free_slot(db, unit_id)
            if chosen:
                appt = Appointment(
                    unit_id=unit_id, lead_id=lead_id,
                    contact_phone=lead.get("telefono"), contact_name=lead.get("nome"),
                    appointment_date=chosen["date"], appointment_time=chosen["time"],
                    duration_minutes=chosen["duration_minutes"],
                    status=AppointmentStatus.PENDING, booked_via="chatbot",
                )
                await db.appointments.insert_one(appt.dict())
                appt_id = appt.id
                new_status = "appointment_booked"
        elif intent in ("wants_appointment", "scheduling"):
            new_status = "scheduling"
        elif intent == "not_interested":
            new_status = "lost"
        elif intent == "completed":
            new_status = "qualified"

        await db.lead_chatbot_sessions.update_one(
            {"lead_id": lead_id},
            {"$set": {
                "messages": history[-50:],
                "qualification_score": int(reply.get("qualification_score") or 0),
                "intent_detected": intent,
                "status": new_status,
                "proposed_appointment_id": appt_id,
                "updated_at": datetime.now(timezone.utc),
            }},
        )

        out = SpokiMessage(
            unit_id=unit_id, lead_id=lead_id, direction="outbound",
            phone_number=lead.get("telefono") or "", body=bot_text, sender="bot",
        ).dict()
        try:
            if spoki_service.is_configured and lead.get("telefono"):
                res = await spoki_service.send_session_message(
                    to=lead["telefono"], body=bot_text,
                    connection_id=(cfg or {}).get("spoki_connection_id"),
                )
                out["spoki_message_id"] = res.get("id") or res.get("message_id")
                out["status"] = res.get("status") or "sent"
            else:
                out["status"] = "skipped_no_api_key"
        except Exception as e:
            out["status"] = "failed"
            out["error"] = str(e)[:500]
        await db.spoki_messages.insert_one(out)

    # ====================================
    # Endpoints SPOKI
    # ====================================

    @router.get("/health")
    async def spoki_health(current_user=Depends(get_current_user)):
        _require_admin(current_user)
        info = {
            "api_key_configured": spoki_service.is_configured,
            "base_url": spoki_service.base_url,
            "webhook_secret_configured": bool(spoki_service.webhook_secret),
        }
        if not spoki_service.is_configured:
            info["status"] = "no_api_key"
            return info
        try:
            await spoki_service.list_templates()
            info["status"] = "ok"
        except Exception as e:
            info["status"] = "error"
            info["error"] = str(e)
        return info

    @router.get("/unit-configs", response_model=List[UnitSpokiConfig])
    async def list_unit_configs(current_user=Depends(get_current_user)):
        _require_admin(current_user)
        out = []
        async for d in db.unit_spoki_configs.find({}, {"_id": 0}):
            out.append(UnitSpokiConfig(**d))
        return out

    @router.get("/unit-configs/{unit_id}", response_model=UnitSpokiConfig)
    async def get_unit_config(unit_id: str, current_user=Depends(get_current_user)):
        if not await _user_can_see_unit(current_user, unit_id):
            raise HTTPException(status_code=403, detail="Accesso negato")
        doc = await db.unit_spoki_configs.find_one({"unit_id": unit_id}, {"_id": 0})
        if not doc:
            cfg = UnitSpokiConfig(unit_id=unit_id, chatbot_system_prompt=DEFAULT_SYSTEM_PROMPT_IT)
            await db.unit_spoki_configs.insert_one(cfg.dict())
            return cfg
        return UnitSpokiConfig(**doc)

    @router.patch("/unit-configs/{unit_id}", response_model=UnitSpokiConfig)
    async def update_unit_config(unit_id: str, payload: UnitSpokiConfigUpdate, current_user=Depends(get_current_user)):
        _require_admin(current_user)
        set_doc = {k: v for k, v in payload.dict(exclude_unset=True).items() if v is not None}
        set_doc["updated_at"] = datetime.now(timezone.utc)
        await db.unit_spoki_configs.update_one(
            {"unit_id": unit_id},
            {
                "$set": set_doc,
                "$setOnInsert": {
                    "id": str(uuid.uuid4()), "unit_id": unit_id,
                    "created_at": datetime.now(timezone.utc),
                    "pairing_status": SpokiPairingStatus.NOT_PAIRED.value,
                    "chatbot_enabled": True,
                },
            },
            upsert=True,
        )
        doc = await db.unit_spoki_configs.find_one({"unit_id": unit_id}, {"_id": 0})
        return UnitSpokiConfig(**doc)

    @router.get("/templates")
    async def list_templates(current_user=Depends(get_current_user)):
        _require_admin(current_user)
        if not spoki_service.is_configured:
            return {"templates": [], "warning": "SPOKI_API_KEY non configurato"}
        try:
            items = await spoki_service.list_templates()
            return {"templates": items}
        except Exception as e:
            return {"templates": [], "error": str(e)}

    @router.post("/unit-configs/{unit_id}/pair")
    async def pair_unit_number(unit_id: str, current_user=Depends(get_current_user)):
        _require_admin(current_user)
        if not spoki_service.is_configured:
            raise HTTPException(status_code=400, detail="SPOKI_API_KEY non configurato")
        try:
            res = await spoki_service.generate_pairing_qr(unit_id)
            await db.unit_spoki_configs.update_one(
                {"unit_id": unit_id},
                {"$set": {"pairing_status": SpokiPairingStatus.PAIRING.value, "updated_at": datetime.now(timezone.utc)}},
                upsert=True,
            )
            return {"success": True, "spoki_response": res}
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Errore Spoki: {e}")

    @router.post("/webhook")
    async def spoki_webhook(request: Request):
        raw = await request.body()
        sig = request.headers.get("X-Spoki-Signature") or request.headers.get("X-Hub-Signature-256")
        if not spoki_service.verify_webhook_signature(raw, sig):
            logger.warning("Spoki webhook: firma non valida")
            raise HTTPException(status_code=401, detail="Invalid signature")
        try:
            payload = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="JSON malformato")
        msgs = payload.get("messages") or payload.get("data") or []
        if isinstance(msgs, dict):
            msgs = [msgs]
        if not msgs and payload.get("from"):
            msgs = [payload]
        processed = 0
        for m in msgs:
            try:
                phone = m.get("from") or m.get("phone") or m.get("contact", {}).get("phone")
                body_txt = m.get("body") or m.get("text") or m.get("message")
                spoki_msg_id = m.get("id") or m.get("message_id")
                if not phone or not body_txt:
                    continue
                lead = await db.leads.find_one({"telefono": phone}, {"_id": 0, "id": 1, "commessa_id": 1, "nome": 1, "telefono": 1})
                cliente = None
                if not lead:
                    cliente = await db.clienti.find_one(
                        {"$or": [{"telefono": phone}, {"cellulare": phone}]},
                        {"_id": 0, "id": 1, "commessa_id": 1, "nome": 1},
                    )
                unit_id = (lead or cliente or {}).get("commessa_id")
                log = SpokiMessage(
                    unit_id=unit_id, lead_id=(lead or {}).get("id"),
                    cliente_id=(cliente or {}).get("id"),
                    direction="inbound", phone_number=phone, body=body_txt,
                    spoki_message_id=spoki_msg_id, status="received", sender="lead",
                ).dict()
                await db.spoki_messages.insert_one(log)
                processed += 1
                if lead:
                    try:
                        await _bot_handle_inbound(lead, body_txt)
                    except Exception as e:
                        logger.exception(f"chatbot error lead {lead['id']}: {e}")
            except Exception as e:
                logger.exception(f"webhook msg parse error: {e}")
        return {"received": processed}

    @router.get("/webhook")
    async def spoki_webhook_verify(request: Request):
        ch = request.query_params.get("hub.challenge") or request.query_params.get("challenge")
        if ch:
            return int(ch) if ch.isdigit() else ch
        return {"status": "ok"}

    @router.get("/conversations/{lead_id}")
    async def get_lead_conversation(lead_id: str, current_user=Depends(get_current_user)):
        lead = await db.leads.find_one({"id": lead_id}, {"_id": 0, "id": 1, "commessa_id": 1})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead non trovato")
        if not await _user_can_see_unit(current_user, lead.get("commessa_id") or ""):
            raise HTTPException(status_code=403, detail="Accesso negato")
        msgs = await db.spoki_messages.find({"lead_id": lead_id}, {"_id": 0}).sort("created_at", 1).to_list(length=1000)
        session = await db.lead_chatbot_sessions.find_one({"lead_id": lead_id}, {"_id": 0})
        return {"lead_id": lead_id, "messages": msgs, "chatbot_session": session}

    @router.post("/conversations/{lead_id}/send")
    async def admin_send_message(lead_id: str, body: Dict[str, Any] = Body(...), current_user=Depends(get_current_user)):
        lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead non trovato")
        if not await _user_can_see_unit(current_user, lead.get("commessa_id") or ""):
            raise HTTPException(status_code=403, detail="Accesso negato")
        text = (body.get("body") or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="Body richiesto")
        cfg = await db.unit_spoki_configs.find_one({"unit_id": lead.get("commessa_id")}, {"_id": 0})
        out = SpokiMessage(
            unit_id=lead.get("commessa_id"), lead_id=lead_id, direction="outbound",
            phone_number=lead.get("telefono") or "", body=text, sender="admin",
        ).dict()
        try:
            if spoki_service.is_configured and lead.get("telefono"):
                res = await spoki_service.send_session_message(
                    to=lead["telefono"], body=text,
                    connection_id=(cfg or {}).get("spoki_connection_id"),
                )
                out["spoki_message_id"] = res.get("id") or res.get("message_id")
                out["status"] = res.get("status") or "sent"
            else:
                out["status"] = "skipped_no_api_key"
        except Exception as e:
            out["status"] = "failed"
            out["error"] = str(e)[:500]
        await db.spoki_messages.insert_one(out)
        return out

    # ====================================
    # Endpoints CALENDAR
    # ====================================

    @calendar_router.get("/unit-configs/{unit_id}", response_model=UnitCalendarConfig)
    async def get_calendar_config(unit_id: str, current_user=Depends(get_current_user)):
        if not await _user_can_see_unit(current_user, unit_id):
            raise HTTPException(status_code=403, detail="Accesso negato")
        doc = await db.unit_calendar_configs.find_one({"unit_id": unit_id}, {"_id": 0})
        if not doc:
            cfg = UnitCalendarConfig(
                unit_id=unit_id,
                working_hours=[WorkingHourSlot(weekday=d, start_time="09:00", end_time="18:00") for d in range(0, 5)],
            )
            await db.unit_calendar_configs.insert_one(cfg.dict())
            return cfg
        return UnitCalendarConfig(**doc)

    @calendar_router.put("/unit-configs/{unit_id}", response_model=UnitCalendarConfig)
    async def update_calendar_config(unit_id: str, payload: UnitCalendarConfig, current_user=Depends(get_current_user)):
        _require_admin(current_user)
        payload.unit_id = unit_id
        payload.updated_at = datetime.now(timezone.utc)
        await db.unit_calendar_configs.update_one(
            {"unit_id": unit_id},
            {"$set": payload.dict(), "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        return payload

    @calendar_router.get("/appointments")
    async def list_appointments(
        unit_id: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        current_user=Depends(get_current_user),
    ):
        query: Dict[str, Any] = {}
        if current_user.role == UserRole.SUPER_REFERENTE:
            query["unit_id"] = getattr(current_user, "unit_id", None)
        elif unit_id:
            if not await _user_can_see_unit(current_user, unit_id):
                raise HTTPException(status_code=403, detail="Accesso negato")
            query["unit_id"] = unit_id
        elif current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Accesso negato")
        date_filter: Dict[str, str] = {}
        if date_from:
            date_filter["$gte"] = date_from
        if date_to:
            date_filter["$lte"] = date_to
        if date_filter:
            query["appointment_date"] = date_filter
        items = await db.appointments.find(query, {"_id": 0}).sort([("appointment_date", 1), ("appointment_time", 1)]).to_list(length=2000)
        return {"appointments": items, "count": len(items)}

    @calendar_router.patch("/appointments/{appointment_id}")
    async def update_appointment(appointment_id: str, payload: Dict[str, Any] = Body(...), current_user=Depends(get_current_user)):
        appt = await db.appointments.find_one({"id": appointment_id}, {"_id": 0})
        if not appt:
            raise HTTPException(status_code=404, detail="Appuntamento non trovato")
        if not await _user_can_see_unit(current_user, appt.get("unit_id") or ""):
            raise HTTPException(status_code=403, detail="Accesso negato")
        allowed = {"status", "appointment_date", "appointment_time", "duration_minutes", "notes"}
        set_doc = {k: v for k, v in payload.items() if k in allowed and v is not None}
        set_doc["updated_at"] = datetime.now(timezone.utc)
        if set_doc.get("status") == AppointmentStatus.CONFIRMED.value:
            set_doc["confirmed_by_id"] = current_user.id
            set_doc["confirmed_at"] = datetime.now(timezone.utc)
        await db.appointments.update_one({"id": appointment_id}, {"$set": set_doc})
        return await db.appointments.find_one({"id": appointment_id}, {"_id": 0})

    @calendar_router.post("/appointments")
    async def create_appointment(payload: Dict[str, Any] = Body(...), current_user=Depends(get_current_user)):
        unit_id = payload.get("unit_id")
        if not unit_id or not await _user_can_see_unit(current_user, unit_id):
            raise HTTPException(status_code=403, detail="Accesso negato")
        appt = Appointment(
            unit_id=unit_id,
            lead_id=payload.get("lead_id"),
            cliente_id=payload.get("cliente_id"),
            contact_phone=payload.get("contact_phone"),
            contact_name=payload.get("contact_name"),
            appointment_date=payload["appointment_date"],
            appointment_time=payload["appointment_time"],
            duration_minutes=int(payload.get("duration_minutes") or 30),
            status=AppointmentStatus(payload.get("status") or "confirmed"),
            notes=payload.get("notes"),
            booked_via="manual",
            confirmed_by_id=current_user.id,
            confirmed_at=datetime.now(timezone.utc),
        )
        await db.appointments.insert_one(appt.dict())
        return appt.dict()

    # Espone anche helper richiamabili da server.py (welcome trigger)
    router.send_welcome_for_lead = send_welcome_for_lead  # type: ignore[attr-defined]

    return router, calendar_router
