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
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, Request, Body

from spoki_module import (
    SpokiService, UnitSpokiConfig, UnitSpokiConfigUpdate, SpokiPairingStatus,
    UnitCalendarConfig, WorkingHourSlot, Appointment, AppointmentStatus,
    SpokiMessage, LeadChatbotSession,
    get_spoki_service_for_unit, mask_secret,
)
from spoki_chatbot import (
    chatbot_generate_reply, generate_unit_reply, list_openai_assistants,
    find_next_free_slot, find_slot_near,
    DEFAULT_SYSTEM_PROMPT_IT,
)

logger = logging.getLogger(__name__)
# NOTE (feb 2026): Il singleton globale `spoki_service` è stato DEPRECATO.
# Ogni operazione Spoki ora usa `get_spoki_service_for_unit(db, unit_id)` con le credenziali della Unit.
# Lo manteniamo come stub non configurato per non rompere import esterni.
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

    # ---- matching telefono (Spoki invia "+39333...", in DB può essere "333..." ecc.) ----
    def _phone_regex(phone: str):
        digits = re.sub(r"\D", "", phone or "")
        if len(digits) < 8:
            return None
        return {"$regex": re.escape(digits[-9:]) + r"$"}

    async def _find_lead_by_phone(phone: str):
        proj = {"_id": 0, "id": 1, "commessa_id": 1, "nome": 1, "cognome": 1, "telefono": 1}
        lead = await db.leads.find_one({"telefono": phone}, proj)
        if lead:
            return lead
        rx = _phone_regex(phone)
        if rx:
            lead = await db.leads.find_one({"telefono": rx}, proj)
        return lead

    async def _find_cliente_by_phone(phone: str):
        proj = {"_id": 0, "id": 1, "commessa_id": 1, "nome": 1}
        cliente = await db.clienti.find_one({"$or": [{"telefono": phone}, {"cellulare": phone}]}, proj)
        if cliente:
            return cliente
        rx = _phone_regex(phone)
        if rx:
            cliente = await db.clienti.find_one({"$or": [{"telefono": rx}, {"cellulare": rx}]}, proj)
        return cliente

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
        # NEW (feb 2026): usa il service Spoki della specifica Unit
        unit_svc = await get_spoki_service_for_unit(db, unit_id)
        try:
            if not unit_svc:
                out["status"] = "skipped_no_api_key"
                out["error"] = "API key Spoki non configurata per questa Unit"
            else:
                res = await unit_svc.send_template_message(
                    to=lead["telefono"], template_name=cfg["welcome_template_name"],
                    language=cfg.get("welcome_template_language") or "it",
                    variables=variables, connection_id=cfg.get("spoki_connection_id"),
                )
                out["spoki_message_id"] = res.get("uuid") or res.get("id") or res.get("message_id")
                out["status"] = res.get("status") or "sent"
        except Exception as e:
            out["status"] = "failed"
            out["error"] = str(e)[:500]
            logger.exception(f"send_welcome_for_lead error: {e}")
        await db.spoki_messages.insert_one(out)
        return out

    async def _bot_handle_inbound(lead: Dict[str, Any], user_message: str) -> bool:
        """Ritorna True se il bot ha gestito (risposto) il messaggio, False altrimenti."""
        lead_id = lead["id"]
        unit_id = lead.get("commessa_id")
        cfg = await db.unit_spoki_configs.find_one({"unit_id": unit_id}, {"_id": 0}) if unit_id else None
        if cfg and cfg.get("chatbot_enabled") is False:
            return False
        sys_prompt = (cfg or {}).get("chatbot_system_prompt") or DEFAULT_SYSTEM_PROMPT_IT
        session = await db.lead_chatbot_sessions.find_one({"lead_id": lead_id}, {"_id": 0})
        # GATE: il bot risponde SOLO se attivato da un workflow (nodo "Attiva Chatbot AI")
        if not session or not session.get("activated_by_workflow"):
            logger.info(f"Chatbot non attivato dal workflow per lead {lead_id}: messaggio loggato senza risposta automatica")
            return False
        if session.get("status") in ("lost", "timeout"):
            return False
        if session.get("bot_paused"):
            logger.info(f"Chatbot in pausa per lead {lead_id}: nessuna risposta automatica")
            return False
        history = session.get("messages", [])
        history.append({"role": "user", "content": user_message, "ts": datetime.now(timezone.utc).isoformat()})

        next_slot_hint = None
        if unit_id and session.get("status") in ("active", "scheduling"):
            slot = await find_next_free_slot(db, unit_id)
            if slot:
                next_slot_hint = f"{slot['weekday']} {slot['date']} alle {slot['time']}"

        reply = await generate_unit_reply(
            db, lead_id, cfg, user_message, history,
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
        # NEW (feb 2026): usa il service Spoki della specifica Unit
        unit_svc = await get_spoki_service_for_unit(db, unit_id)
        try:
            if unit_svc and lead.get("telefono"):
                res = await unit_svc.send_session_message(
                    to=lead["telefono"], body=bot_text,
                    connection_id=(cfg or {}).get("spoki_connection_id"),
                )
                out["spoki_message_id"] = res.get("uuid") or res.get("id") or res.get("message_id")
                out["status"] = res.get("status") or "sent"
            else:
                out["status"] = "skipped_no_api_key"
        except Exception as e:
            out["status"] = "failed"
            out["error"] = str(e)[:500]
        await db.spoki_messages.insert_one(out)
        return True

    # ====================================
    # Endpoints SPOKI
    # ====================================

    @router.get("/diagnostics")
    async def spoki_diagnostics(unit_id: Optional[str] = None, current_user=Depends(get_current_user)):
        """Diagnostica della connessione Spoki per una specifica Unit (o per TUTTE quelle configurate
        se `unit_id` non è fornito). Testa la chiave su entrambi i domini ufficiali."""
        _require_admin(current_user)
        import httpx

        # Carica le configurazioni unit da testare
        if unit_id:
            cfgs = await db.unit_spoki_configs.find({"unit_id": unit_id, "api_key": {"$nin": [None, ""]}}, {"_id": 0}).to_list(length=None)
        else:
            cfgs = await db.unit_spoki_configs.find({"api_key": {"$nin": [None, ""]}}, {"_id": 0}).to_list(length=None)

        if not cfgs:
            return {
                "configured": False,
                "units": [],
                "report": "Nessuna Unit ha configurato una API key Spoki. Vai su Admin → WhatsApp Spoki e imposta la chiave per Unit."
            }

        results = []
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        report_lines = [
            "=== REPORT DIAGNOSTICO INTEGRAZIONE SPOKI API (da CRM Nureal) ===",
            f"Data test: {now}",
            "Header di autenticazione: X-Spoki-Api-Key: <api_key>",
            "Riferimento docs: https://documenter.getpostman.com/view/21611004/UzBqnPvF",
            "",
        ]
        async with httpx.AsyncClient(timeout=15) as client:
            for cfg in cfgs:
                u_id = cfg.get("unit_id")
                api_key = (cfg.get("api_key") or "").strip()
                masked = mask_secret(api_key) or "***"
                attempts = []
                for base in ["https://api.spoki.com/api/1", "https://app.spoki.it/api/1"]:
                    for ep in ["/templates/", "/channel/"]:
                        try:
                            r = await client.get(
                                base + ep,
                                headers={"X-Spoki-Api-Key": api_key, "Accept": "application/json"},
                            )
                            attempts.append({
                                "url": base + ep, "method": "GET",
                                "http_status": r.status_code,
                                "response_body": r.text[:300],
                                "server_date": r.headers.get("date"),
                            })
                        except Exception as e:
                            attempts.append({"url": base + ep, "method": "GET", "error": str(e)[:200]})
                ok = any(a.get("http_status") == 200 for a in attempts)
                # Look up unit label
                unit_doc = await db.units.find_one({"id": u_id}, {"_id": 0, "nome": 1}) if u_id else None
                unit_label = (unit_doc or {}).get("nome") or u_id
                results.append({
                    "unit_id": u_id,
                    "unit_label": unit_label,
                    "api_key_masked": masked,
                    "success": ok,
                    "attempts": attempts,
                })
                report_lines.append(f"--- Unit: {unit_label} (id {u_id}) — key {masked} ---")
                for a in attempts:
                    if "error" in a:
                        report_lines.append(f"  ERRORE DI RETE su {a['url']}: {a['error']}")
                    else:
                        report_lines.append(f"  GET {a['url']} → HTTP {a['http_status']}  ({a['response_body'][:120]})")
                report_lines.append("ESITO: ✅ chiave attiva" if ok else "ESITO: ❌ chiave NON riconosciuta")
                report_lines.append("")
        overall_ok = all(r.get("success") for r in results) if results else False
        return {
            "configured": True,
            "success": overall_ok,
            "units": results,
            "report": "\n".join(report_lines),
        }

    @router.get("/health")
    async def spoki_health(unit_id: Optional[str] = None, current_user=Depends(get_current_user)):
        _require_admin(current_user)
        if not unit_id:
            # Status aggregato: quante unit hanno la chiave configurata
            total = await db.unit_spoki_configs.count_documents({})
            with_key = await db.unit_spoki_configs.count_documents({"api_key": {"$nin": [None, ""]}})
            return {
                "scope": "global",
                "units_total": total,
                "units_with_api_key": with_key,
                "status": "ok" if with_key > 0 else "no_api_key",
            }
        svc = await get_spoki_service_for_unit(db, unit_id)
        info: Dict[str, Any] = {
            "scope": "unit",
            "unit_id": unit_id,
            "api_key_configured": bool(svc),
            "webhook_secret_configured": bool(svc and svc.webhook_secret),
        }
        if not svc:
            info["status"] = "no_api_key"
            return info
        try:
            await svc.list_templates()
            info["status"] = "ok"
        except Exception as e:
            info["status"] = "error"
            info["error"] = str(e)
        return info

    def _serialize_unit_cfg(d: Dict[str, Any]) -> Dict[str, Any]:
        """Serializza UnitSpokiConfig per la UI senza esporre i segreti in chiaro.

        - api_key e webhook_secret NON sono inclusi in chiaro nella risposta
        - sono aggiunti `api_key_configured: bool` + `api_key_masked: str|None`
          (e gli omologhi per webhook_secret) per UI a stato
        """
        out = dict(d)
        ak = out.pop("api_key", None)
        ws = out.pop("webhook_secret", None)
        out["api_key_configured"] = bool(ak)
        out["api_key_masked"] = mask_secret(ak)
        out["webhook_secret_configured"] = bool(ws)
        out["webhook_secret_masked"] = mask_secret(ws)
        # Garantisci la presenza dei campi del modello UnitSpokiConfig (anche se mancanti nel doc legacy)
        out.setdefault("chatbot_enabled", True)
        out.setdefault("welcome_template_language", "it")
        out.setdefault("welcome_template_variables", {})
        out.setdefault("pairing_status", SpokiPairingStatus.NOT_PAIRED.value)
        return out

    @router.get("/unit-configs")
    async def list_unit_configs(current_user=Depends(get_current_user)):
        _require_admin(current_user)
        out = []
        async for d in db.unit_spoki_configs.find({}, {"_id": 0}):
            out.append(_serialize_unit_cfg(d))
        return out

    @router.get("/unit-configs/{unit_id}")
    async def get_unit_config(unit_id: str, current_user=Depends(get_current_user)):
        if not await _user_can_see_unit(current_user, unit_id):
            raise HTTPException(status_code=403, detail="Accesso negato")
        doc = await db.unit_spoki_configs.find_one({"unit_id": unit_id}, {"_id": 0})
        if not doc:
            cfg = UnitSpokiConfig(unit_id=unit_id, chatbot_system_prompt=DEFAULT_SYSTEM_PROMPT_IT)
            await db.unit_spoki_configs.insert_one(cfg.dict())
            return _serialize_unit_cfg(cfg.dict())
        return _serialize_unit_cfg(doc)

    @router.get("/unit-configs/{unit_id}/secrets")
    async def reveal_unit_secrets(unit_id: str, current_user=Depends(get_current_user)):
        """Endpoint dedicato per rivelare api_key e webhook_secret in chiaro (Admin only).
        Usato dal toggle 'Mostra' nell'UI; ogni richiesta è loggata."""
        _require_admin(current_user)
        doc = await db.unit_spoki_configs.find_one({"unit_id": unit_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Configurazione Unit non trovata")
        logger.info(f"[SPOKI SECRETS REVEAL] user={current_user.username} unit_id={unit_id}")
        return {
            "unit_id": unit_id,
            "api_key": doc.get("api_key") or "",
            "webhook_secret": doc.get("webhook_secret") or "",
        }

    @router.patch("/unit-configs/{unit_id}")
    async def update_unit_config(unit_id: str, payload: UnitSpokiConfigUpdate, current_user=Depends(get_current_user)):
        _require_admin(current_user)
        # exclude_unset=True: include solo i campi esplicitamente inviati
        # Convenzione frontend: "" stringa vuota = cancella; campo omesso = lascia invariato
        set_doc: Dict[str, Any] = {}
        for k, v in payload.dict(exclude_unset=True).items():
            if v is None:
                continue
            set_doc[k] = v
        set_doc["updated_at"] = datetime.now(timezone.utc)
        # $setOnInsert keys must NOT overlap with $set keys (MongoDB rejects conflicting paths)
        on_insert = {
            "id": str(uuid.uuid4()), "unit_id": unit_id,
            "created_at": datetime.now(timezone.utc),
            "pairing_status": SpokiPairingStatus.NOT_PAIRED.value,
            "chatbot_enabled": True,
        }
        on_insert = {k: v for k, v in on_insert.items() if k not in set_doc}
        await db.unit_spoki_configs.update_one(
            {"unit_id": unit_id},
            {
                "$set": set_doc,
                "$setOnInsert": on_insert,
            },
            upsert=True,
        )
        doc = await db.unit_spoki_configs.find_one({"unit_id": unit_id}, {"_id": 0})
        return _serialize_unit_cfg(doc)

    @router.get("/openai-assistants")
    async def get_openai_assistants(current_user=Depends(get_current_user)):
        """Lista gli Assistant OpenAI dell'account utente (per il dropdown di config Unit)."""
        _require_admin(current_user)
        if not os.environ.get("OPENAI_API_KEY"):
            return {"assistants": [], "configured": False, "warning": "OPENAI_API_KEY non configurato"}
        try:
            items = await list_openai_assistants()
            return {"assistants": items, "configured": True}
        except Exception as e:
            return {"assistants": [], "configured": True, "error": str(e)}

    @router.get("/templates")
    async def list_templates(unit_id: Optional[str] = None, current_user=Depends(get_current_user)):
        """Lista template Spoki di una specifica Unit. Se `unit_id` non è fornito ed esiste
        una sola Unit configurata, usa quella. Richiede api_key configurata sulla Unit."""
        _require_admin(current_user)
        if not unit_id:
            # Auto-select: se esiste una sola Unit con api_key, usala
            configured = await db.unit_spoki_configs.find({"api_key": {"$nin": [None, ""]}}, {"_id": 0, "unit_id": 1}).to_list(length=None)
            if len(configured) == 1:
                unit_id = configured[0]["unit_id"]
            elif len(configured) == 0:
                return {"templates": [], "warning": "Nessuna Unit ha una API key Spoki configurata"}
            else:
                return {"templates": [], "warning": "Specificare ?unit_id=... (più Unit configurate)"}
        svc = await get_spoki_service_for_unit(db, unit_id)
        if not svc:
            return {"templates": [], "warning": f"API key Spoki non configurata per la Unit {unit_id}"}
        try:
            items = await svc.list_templates()
            return {"templates": items, "unit_id": unit_id}
        except Exception as e:
            return {"templates": [], "error": str(e), "unit_id": unit_id}

    @router.post("/unit-configs/{unit_id}/pair")
    async def pair_unit_number(unit_id: str, current_user=Depends(get_current_user)):
        """Verifica lo stato del numero WhatsApp della Unit sui canali Spoki reali (usa la key della Unit)."""
        _require_admin(current_user)
        svc = await get_spoki_service_for_unit(db, unit_id)
        if not svc:
            raise HTTPException(status_code=400, detail="API key Spoki non configurata per questa Unit")
        cfg = await db.unit_spoki_configs.find_one({"unit_id": unit_id}, {"_id": 0})
        wanted = re.sub(r"\D", "", (cfg or {}).get("whatsapp_number") or "")
        try:
            channels = await svc.list_channels()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Errore Spoki: {e}")
        matched = None
        for ch in channels:
            ch_phone = re.sub(r"\D", "", str(ch.get("phone") or ch.get("phone_number") or ""))
            if wanted and ch_phone and (ch_phone.endswith(wanted[-9:]) or wanted.endswith(ch_phone[-9:])):
                matched = ch
                break
        if not matched and len(channels) == 1:
            matched = channels[0]
        new_status = SpokiPairingStatus.CONNECTED.value if matched else SpokiPairingStatus.NOT_PAIRED.value
        await db.unit_spoki_configs.update_one(
            {"unit_id": unit_id},
            {"$set": {
                "pairing_status": new_status,
                "spoki_connection_id": str(matched.get("id")) if matched else None,
                "updated_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )
        return {"success": bool(matched), "status": new_status, "channel": matched, "channels_found": len(channels)}

    @router.post("/webhook")
    async def spoki_webhook(request: Request):
        """Webhook inbound da Spoki. NEW (feb 2026): verifica firma usando il webhook_secret
        della Unit identificata dal lead/cliente associato al numero mittente."""
        raw = await request.body()
        sig = request.headers.get("X-Spoki-Signature") or request.headers.get("X-Hub-Signature-256")
        try:
            payload = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="JSON malformato")
        # Per validare la firma serve sapere a quale Unit appartiene il messaggio.
        # Strategia: estrai phone dal payload, trova lead/cliente, ricava unit_id, carica il service per-Unit.
        msgs_for_sig = []
        data0 = payload.get("data")
        if isinstance(data0, dict):
            msgs_for_sig = [data0]
        elif isinstance(data0, list):
            msgs_for_sig = data0
        elif payload.get("messages"):
            msgs_for_sig = payload["messages"] if isinstance(payload["messages"], list) else [payload["messages"]]
        elif payload.get("from") or payload.get("from_phone"):
            msgs_for_sig = [payload]
        sender_unit_id = None
        for m in msgs_for_sig:
            contact = m.get("contact") or {}
            ph = m.get("from_phone") or m.get("from") or m.get("phone") or contact.get("phone")
            if not ph:
                continue
            ld = await _find_lead_by_phone(ph)
            cl = None if ld else await _find_cliente_by_phone(ph)
            sender_unit_id = (ld or cl or {}).get("commessa_id")
            if sender_unit_id:
                break
        # Verifica firma con il webhook_secret della Unit (se identificata)
        if sender_unit_id:
            svc = await get_spoki_service_for_unit(db, sender_unit_id)
            if svc and not svc.verify_webhook_signature(raw, sig):
                logger.warning(f"Spoki webhook: firma non valida (unit {sender_unit_id})")
                raise HTTPException(status_code=401, detail="Invalid signature")
        # else: nessuna Unit identificata → accetta senza verifica firma (impossibile selezionare il secret)
        # Formato ufficiale Spoki: {"version": 1, "event": "message.inbound", "data": {...}}
        event = payload.get("event") or ""
        msgs = []
        data = payload.get("data")
        if isinstance(data, dict):
            msgs = [data]
        elif isinstance(data, list):
            msgs = data
        elif payload.get("messages"):
            msgs = payload["messages"] if isinstance(payload["messages"], list) else [payload["messages"]]
        elif payload.get("from") or payload.get("from_phone"):
            msgs = [payload]
        processed = 0
        for m in msgs:
            try:
                # Ignora eventi non-inbound (es. status di consegna outbound)
                direction = (m.get("direction") or "").lower()
                if event and not event.startswith("message.inbound") and direction != "inbound":
                    continue
                contact = m.get("contact") or {}
                phone = m.get("from_phone") or m.get("from") or m.get("phone") or contact.get("phone")
                body_txt = m.get("text") or m.get("body") or (m.get("preview") or {}).get("body") or m.get("message")
                spoki_msg_id = m.get("uuid") or m.get("id") or m.get("message_id")
                if not phone or not body_txt:
                    continue
                lead = await _find_lead_by_phone(phone)
                cliente = None
                if not lead:
                    cliente = await _find_cliente_by_phone(phone)
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
                    handled = False
                    try:
                        handled = bool(await _bot_handle_inbound(lead, body_txt))
                    except Exception as e:
                        logger.exception(f"chatbot error lead {lead['id']}: {e}")
                    if not handled:
                        # Lead ha scritto ma il bot non ha risposto (in pausa/non attivato/errore):
                        # segnala il messaggio come "da gestire" per il contatore in sidebar
                        await db.spoki_messages.update_one(
                            {"id": log["id"]}, {"$set": {"needs_attention": True}}
                        )
                    # Resume workflows V2 in attesa (ramo 'reply')
                    try:
                        wf_v2 = getattr(router, "workflow_executor_v2", None)
                        if wf_v2:
                            await wf_v2.resume_on_reply(lead["id"], body_txt)
                    except Exception as e:
                        logger.warning(f"WF V2 resume error: {e}")
            except Exception as e:
                logger.exception(f"webhook msg parse error: {e}")
        return {"received": processed}

    @router.get("/webhook")
    async def spoki_webhook_verify(request: Request):
        ch = request.query_params.get("hub.challenge") or request.query_params.get("challenge")
        if ch:
            return int(ch) if ch.isdigit() else ch
        return {"status": "ok"}

    @router.get("/conversations")
    async def list_all_conversations(current_user=Depends(get_current_user), limit: int = 200):
        """Lista tutte le conversazioni WhatsApp (una per lead), ordinate per ultimo messaggio."""
        pipeline = [
            {"$match": {"lead_id": {"$ne": None}}},
            {"$sort": {"created_at": -1}},
            {"$group": {
                "_id": "$lead_id",
                "last_message": {"$first": "$$ROOT"},
                "messages_count": {"$sum": 1},
                "unhandled_count": {"$sum": {"$cond": [{"$eq": ["$needs_attention", True]}, 1, 0]}},
            }},
            {"$sort": {"last_message.created_at": -1}},
            {"$limit": limit},
        ]
        groups = await db.spoki_messages.aggregate(pipeline).to_list(length=limit)
        lead_ids = [g["_id"] for g in groups]
        leads = {l["id"]: l async for l in db.leads.find(
            {"id": {"$in": lead_ids}},
            {"_id": 0, "id": 1, "nome": 1, "cognome": 1, "telefono": 1, "commessa_id": 1},
        )}
        sessions = {s["lead_id"]: s async for s in db.lead_chatbot_sessions.find(
            {"lead_id": {"$in": lead_ids}},
            {"_id": 0, "lead_id": 1, "status": 1, "bot_paused": 1, "activated_by_workflow": 1, "qualification_score": 1},
        )}
        unit_ids = list({(leads.get(lid) or {}).get("commessa_id") for lid in lead_ids if leads.get(lid)})
        unit_names = {c["id"]: c.get("nome") async for c in db.commesse.find(
            {"id": {"$in": [u for u in unit_ids if u]}}, {"_id": 0, "id": 1, "nome": 1},
        )}
        out = []
        for g in groups:
            lead = leads.get(g["_id"])
            if not lead:
                continue
            unit_id = lead.get("commessa_id") or ""
            if not await _user_can_see_unit(current_user, unit_id):
                continue
            lm = g["last_message"]
            out.append({
                "lead_id": lead["id"],
                "lead_name": f"{lead.get('nome') or ''} {lead.get('cognome') or ''}".strip() or lead.get("telefono") or lead["id"],
                "phone": lead.get("telefono"),
                "unit_id": unit_id,
                "unit_label": unit_names.get(unit_id),
                "messages_count": g["messages_count"],
                "unhandled_count": g.get("unhandled_count") or 0,
                "last_message": {
                    "body": lm.get("body") or (f"[Template: {lm.get('template_name')}]" if lm.get("template_name") else ""),
                    "direction": lm.get("direction"),
                    "sender": lm.get("sender"),
                    "status": lm.get("status"),
                    "created_at": lm.get("created_at"),
                },
                "session": sessions.get(lead["id"]),
            })
        return {"conversations": out}

    @router.get("/conversations/unhandled-count")
    async def conversations_unhandled_count(current_user=Depends(get_current_user)):
        """Numero di lead con messaggi WhatsApp non gestiti (bot in pausa/non attivato)."""
        pipeline = [
            {"$match": {"needs_attention": True, "lead_id": {"$ne": None}}},
            {"$group": {"_id": "$unit_id", "leads": {"$addToSet": "$lead_id"}}},
        ]
        total = 0
        async for g in db.spoki_messages.aggregate(pipeline):
            if await _user_can_see_unit(current_user, g["_id"] or ""):
                total += len(g["leads"])
        return {"count": total}

    @router.post("/conversations/{lead_id}/mark-read")
    async def mark_conversation_read(lead_id: str, current_user=Depends(get_current_user)):
        """Segna come gestiti i messaggi 'da gestire' di un lead (apertura conversazione)."""
        lead = await db.leads.find_one({"id": lead_id}, {"_id": 0, "id": 1, "commessa_id": 1})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead non trovato")
        if not await _user_can_see_unit(current_user, lead.get("commessa_id") or ""):
            raise HTTPException(status_code=403, detail="Accesso negato")
        res = await db.spoki_messages.update_many(
            {"lead_id": lead_id, "needs_attention": True},
            {"$set": {"needs_attention": False}},
        )
        return {"success": True, "cleared": res.modified_count}

    @router.post("/conversations/{lead_id}/toggle-bot")
    async def toggle_bot_for_lead(lead_id: str, body: Dict[str, Any] = Body(...), current_user=Depends(get_current_user)):
        """Mette in pausa / riattiva il chatbot per un singolo lead.

        body: {"paused": true|false}. Riattivando (paused=false) la sessione viene anche
        marcata activated_by_workflow=True (presa in carico manuale del bot).
        """
        lead = await db.leads.find_one({"id": lead_id}, {"_id": 0, "id": 1, "commessa_id": 1})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead non trovato")
        if not await _user_can_see_unit(current_user, lead.get("commessa_id") or ""):
            raise HTTPException(status_code=403, detail="Accesso negato")
        paused = bool(body.get("paused"))
        set_doc = {"bot_paused": paused, "updated_at": datetime.now(timezone.utc)}
        if not paused:
            set_doc["activated_by_workflow"] = True
            set_doc["status"] = "active"
        await db.lead_chatbot_sessions.update_one(
            {"lead_id": lead_id},
            {"$set": set_doc,
             "$setOnInsert": {"id": str(uuid.uuid4()), "lead_id": lead_id,
                              "unit_id": lead.get("commessa_id"), "messages": [],
                              "qualification_score": 0, "created_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        session = await db.lead_chatbot_sessions.find_one({"lead_id": lead_id}, {"_id": 0})
        return {"success": True, "session": session}

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
        # NEW (feb 2026): usa il service Spoki della Unit del lead
        unit_svc = await get_spoki_service_for_unit(db, lead.get("commessa_id"))
        try:
            if unit_svc and lead.get("telefono"):
                res = await unit_svc.send_session_message(
                    to=lead["telefono"], body=text,
                    connection_id=(cfg or {}).get("spoki_connection_id"),
                )
                out["spoki_message_id"] = res.get("uuid") or res.get("id") or res.get("message_id")
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
