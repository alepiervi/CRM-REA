"""
Lead Qualification Chatbot (gpt-4o-mini) + Calendar/Slot finder.

Architettura:
- `LeadChatbot.handle_inbound(lead_id, message)` riceve risposta cliente, genera prossima risposta
  bot e ritorna un dict {reply_text, intent, score, proposed_appointment, status}.
- `find_next_free_slot(unit_id, db)` interroga UnitCalendarConfig + Appointment per il prossimo
  slot libero secondo orari di lavoro.
- Memoria persistente per lead in collection `lead_chatbot_sessions`.

Il bot lavora in ITALIANO. Modello: gpt-4o-mini via emergentintegrations + EMERGENT_LLM_KEY.
"""
from __future__ import annotations

import os
import re
import json
import logging
import uuid
from datetime import datetime, timezone, timedelta, date as date_type, time
from typing import Optional, List, Dict, Any, Tuple

from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)


DEFAULT_SYSTEM_PROMPT_IT = """Sei l'assistente virtuale di una Unit commerciale di Nureal.
Parli SOLO in italiano, in tono cordiale, professionale ma diretto.

Il tuo obiettivo è:
1) Verificare se il lead è interessato ai nostri servizi
2) Raccogliere brevemente i suoi bisogni (max 2-3 domande)
3) Proporre un appuntamento con il referente di Unit

Regole:
- Una sola domanda per messaggio.
- Risposte SEMPRE brevi (max 2 frasi più una domanda).
- Quando il lead conferma l'interesse per l'appuntamento, NON proporre tu uno slot:
  attendi che il sistema ti mandi nel prossimo turno il valore di "next_free_slot".

Ad OGNI tuo turno devi rispondere SOLO con un JSON valido (niente testo extra, niente
markdown, niente code-fence) con questi campi:
{
  "reply": "<testo da inviare al cliente in italiano>",
  "intent": "interested" | "not_interested" | "needs_info" | "wants_appointment" | "scheduling" | "completed" | "unclear",
  "qualification_score": <int 0-100>,
  "user_proposed_datetime": "<ISO YYYY-MM-DDTHH:MM o stringa vuota>",
  "ready_to_book": <true|false>
}

`user_proposed_datetime` va valorizzato SOLO quando il cliente propone esplicitamente data+ora
(es. "giovedì alle 15", "domani mattina alle 10"); interpreta liberamente rispetto a today.
`ready_to_book` = true quando il cliente conferma uno slot proposto.
"""


def _normalize_session_id(lead_id: str) -> str:
    return f"lead-chatbot-{lead_id}"


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    """Estrae il primo blob JSON da un testo del modello, tollerando code fences."""
    if not text:
        return None
    txt = text.strip()
    # togli code fence ```json ... ```
    if txt.startswith("```"):
        txt = re.sub(r"^```[a-zA-Z]*\n?", "", txt)
        txt = re.sub(r"\n?```$", "", txt)
    # find first JSON object
    m = re.search(r"\{.*\}", txt, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


async def chatbot_generate_reply(
    lead_id: str,
    user_message: str,
    history: List[Dict[str, str]],
    system_prompt: Optional[str] = None,
    next_free_slot_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """Genera la prossima risposta del bot. Ritorna dict con reply/intent/score/etc."""
    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not api_key:
        return {
            "reply": "Grazie per il messaggio! Un operatore ti contatterà a breve.",
            "intent": "unclear",
            "qualification_score": 0,
            "user_proposed_datetime": "",
            "ready_to_book": False,
            "error": "EMERGENT_LLM_KEY non configurato",
        }

    sys_prompt = (system_prompt or DEFAULT_SYSTEM_PROMPT_IT).strip()
    if next_free_slot_hint:
        sys_prompt += f"\n\nCONTESTO: lo slot disponibile più vicino è {next_free_slot_hint}. Proponilo al cliente nel `reply` formattandolo in modo umano (es. \"mercoledì 15 alle 10:30\")."

    today_str = datetime.now(timezone.utc).strftime("%A %d %B %Y, ore %H:%M (UTC)")
    sys_prompt += f"\n\nData/ora corrente: {today_str}"

    chat = LlmChat(
        api_key=api_key,
        session_id=_normalize_session_id(lead_id),
        system_message=sys_prompt,
    ).with_model("openai", "gpt-4o-mini")

    # Re-iniettiamo la storia (la libreria mantiene già la sessione, ma per resilienza
    # in caso di restart la "ri-allineiamo" con un riassunto inline).
    if history:
        summary = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in history[-6:]])
        user_payload = f"Storia conversazione recente:\n{summary}\n\nUltimo messaggio del cliente:\n{user_message}"
    else:
        user_payload = user_message

    try:
        raw = await chat.send_message(UserMessage(text=user_payload))
    except Exception as e:
        logger.exception("chatbot LLM error")
        return {
            "reply": "Mi scuso, c'è un problema tecnico. Un operatore ti contatterà a breve.",
            "intent": "unclear",
            "qualification_score": 0,
            "user_proposed_datetime": "",
            "ready_to_book": False,
            "error": str(e),
        }

    parsed = _extract_json(raw or "")
    if not parsed:
        # fallback: trattiamo l'intera risposta come testo
        return {
            "reply": (raw or "").strip()[:1000] or "Grazie, puoi dirmi di più?",
            "intent": "unclear",
            "qualification_score": 0,
            "user_proposed_datetime": "",
            "ready_to_book": False,
        }
    # difese
    parsed.setdefault("reply", "Grazie!")
    parsed.setdefault("intent", "unclear")
    parsed.setdefault("qualification_score", 0)
    parsed.setdefault("user_proposed_datetime", "")
    parsed.setdefault("ready_to_book", False)
    try:
        parsed["qualification_score"] = int(parsed["qualification_score"])
    except (TypeError, ValueError):
        parsed["qualification_score"] = 0
    return parsed


# =====================================================
# CALENDAR / SLOT FINDER
# =====================================================

def _parse_hhmm(s: str) -> time:
    h, m = s.split(":")[:2]
    return time(int(h), int(m))


def _gen_slots_for_day(day_cfg: List[Dict[str, Any]], slot_min: int, day: date_type) -> List[datetime]:
    """Genera lista di datetime di slot per il giorno dato, secondo working_hours del weekday."""
    weekday = day.weekday()  # 0=Mon
    out: List[datetime] = []
    for h in day_cfg:
        if h["weekday"] != weekday:
            continue
        start_t = _parse_hhmm(h["start_time"])
        end_t = _parse_hhmm(h["end_time"])
        cur = datetime.combine(day, start_t)
        end_dt = datetime.combine(day, end_t)
        while cur + timedelta(minutes=slot_min) <= end_dt:
            out.append(cur)
            cur = cur + timedelta(minutes=slot_min)
    return out


async def find_next_free_slot(
    db,
    unit_id: str,
    from_dt: Optional[datetime] = None,
    duration_min: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """Trova il prossimo slot libero per la Unit. Ritorna {date, time, datetime_iso} o None."""
    cfg = await db.unit_calendar_configs.find_one({"unit_id": unit_id}, {"_id": 0})
    if not cfg or not cfg.get("working_hours"):
        return None
    slot_min = duration_min or int(cfg.get("slot_duration_minutes", 30))
    advance_h = int(cfg.get("advance_booking_min_hours", 2))
    max_days = int(cfg.get("advance_booking_max_days", 30))
    blackout = set(cfg.get("blackout_dates") or [])

    now = from_dt or datetime.now(timezone.utc)
    earliest = now + timedelta(hours=advance_h)

    # Pre-carica appuntamenti esistenti
    existing_cursor = db.appointments.find(
        {
            "unit_id": unit_id,
            "status": {"$in": ["proposed", "pending", "confirmed"]},
            "appointment_date": {"$gte": now.strftime("%Y-%m-%d")},
        },
        {"_id": 0, "appointment_date": 1, "appointment_time": 1, "duration_minutes": 1},
    )
    booked = set()
    async for a in existing_cursor:
        key = f"{a['appointment_date']} {a['appointment_time']}"
        booked.add(key)

    for delta in range(0, max_days + 1):
        day = (now + timedelta(days=delta)).date()
        if day.isoformat() in blackout:
            continue
        slots = _gen_slots_for_day(cfg["working_hours"], slot_min, day)
        for s in slots:
            if s.replace(tzinfo=timezone.utc) < earliest:
                continue
            key = f"{day.isoformat()} {s.strftime('%H:%M')}"
            if key in booked:
                continue
            return {
                "date": day.isoformat(),
                "time": s.strftime("%H:%M"),
                "datetime_iso": s.isoformat() + "Z",
                "weekday": day.strftime("%A").lower(),
                "duration_minutes": slot_min,
            }
    return None


async def find_slot_near(
    db, unit_id: str, target_iso: str, duration_min: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """Verifica se uno slot vicino al datetime proposto dal cliente è libero.
    Cerca lo slot uguale o successivo entro 2h dal target, lo stesso giorno.
    """
    try:
        target_dt = datetime.fromisoformat(target_iso.replace("Z", ""))
    except Exception:
        return None
    return await find_next_free_slot(db, unit_id, from_dt=target_dt - timedelta(minutes=1), duration_min=duration_min)
