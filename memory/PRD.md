# Nureal CRM — PRD

## Problem Statement
Costruire un CRM commerciale completo per gestione lead, clienti, post-vendita, agenti, commesse, sub-agenzie, calendario e automazioni WhatsApp via Spoki + Chatbot OpenAI.

## Linguaggio utente
**Italiano** (rispondere sempre in italiano).

## Stack
- Backend FastAPI (server.py monolitico + moduli spoki_*) + MongoDB
- Frontend React (App.js monolitico + componenti dedicati) + xyflow per workflow canvas
- Integrazioni: Spoki WhatsApp (X-Spoki-Api-Key), OpenAI gpt-4o-mini via Emergent LLM key, Aruba SMTP

## Componenti chiave
- **Lead** management (creazione webhook GET/POST/standard, qualificazione bot)
- **Clienti** con custom fields, pessimistic locking, Post Vendita, multi-select filtri
- **Spoki** integration (per Unit: numero + template + chatbot prompt)
- **Chatbot OpenAI** (gpt-4o-mini): risposte JSON strutturate, memoria multi-turno, slot proposal
- **Calendario Appuntamenti** per Unit con working_hours + slot finder
- **Workflow Builder V2**: visual canvas con nodi Spoki/Chatbot/Calendar/Wait-for-reply

## Implementato (CHANGELOG)

### Dec 2025 - Feb 2026
- Modulo Post Vendita completo + Lean list + KPI funnel
- Multi-select filtri Include/Exclude globali su /api/clienti
- Excel export con multi-value e include/exclude
- Migrazione automatica legacy notes su startup
- Filtro data Clienti server-side + scorciatoie (Oggi/7gg/30gg/Mese)
- Fix Backoffice Commessa: clienti con servizio_id=None ora visibili in listing e export
- Rimozione cliente da Post Vendita (non cancellazione)

### Feb 2026 — FASE A Spoki/Chatbot/Calendar/Workflow
- `spoki_module.py`: SpokiService (X-Spoki-Api-Key, send template/session, webhook signature) + modelli
- `spoki_chatbot.py`: gpt-4o-mini con output JSON + slot finder (working_hours, slot_duration, blackout)
- `spoki_routes.py`: 14 endpoint `/api/spoki/*` e `/api/calendar/*`
- Workflow Executor V2 (`workflow_executor.py`): edge-driven, branching, suspendable (wait_for_reply), persistent state in `workflow_executions_v2`, timeout loop background ogni 60s
- Nuovi node types catalogo:
  - Actions: send_spoki_template, send_spoki_message, run_chatbot, create_appointment
  - Conditions: working_hours
  - Delays: wait_for_reply (timeout + reply branches)
- Hook lead creation in 3 punti → trigger workflows V2 + welcome Spoki
- Spoki webhook → resume_on_reply su workflow_executions_v2 in attesa
- Frontend nuovi componenti: SpokiAdminConfig, AppointmentsCalendar, LeadConversationsTab
- Sidebar admin: "WhatsApp Spoki" + "Calendario Appuntamenti"
- Sidebar super_referente: "Calendario Appuntamenti"
- LeadDetailModal: tab "Conversazione WhatsApp"

## Allineamento Spoki API ufficiale (giugno 2026)
Modulo Spoki riallineato alla documentazione ufficiale (Postman collection 21611004/UzBqnPvF):
- Auth: header `X-Spoki-Api-Key`, base `https://api.spoki.com/api/1` (CONFERMATO da docs)
- Invio template: POST `/messages/send/` con `{"type":"Template","phone":...,"template":<id numerico>,"language":"IT","custom_fields":{...}}` — il template si risolve per nome→id via `/templates/`
- Invio free-text: `{"type":"Message","content_type":"Text","phone":...,"text":...}`
- Webhook inbound ufficiale: `{"version":1,"event":"message.inbound","data":{from_phone,text,uuid,contact}}` — parser aggiornato + matching telefono normalizzato (ultime 9 cifre, gestisce +39 vs senza prefisso)
- Pairing: NON esiste QR via API; endpoint `/pair` ora legge i canali reali via GET `/channel/` e marca CONNECTED se il numero corrisponde
- Test E2E webhook verificato: inbound → match lead → chatbot GPT-4o-mini risponde → log outbound

## Bloccanti esterni
- **Spoki API key** (`228eb...ec2a`): respinta dai server Spoki su entrambi i domini ufficiali con header documentato ("Authentication credentials were not provided"). La chiave NON è attiva lato Spoki: l'utente deve verificare in Spoki → Integrazione → API → Richiedi API Key (può richiedere approvazione) e che non si tratti della "Chiave Privata" o del webhook secret.
- **Aruba SMTP**: IP del preview blacklistato — solo infrastrutturale

## Backlog prioritizzato

### P0 (in corso)
- Verifica end-to-end Spoki appena chiave attivata
- FASE B Workflow: cartelle, statistiche per nodo, draft/published, test mode

### P1
- FASE C: condition multi-branch avanzati, sistema tag UI, Go To node
- FASE D: polish UX canvas (palette nodi colorata, minimap, animazioni)
- Duplica configurazione Custom Fields

### P2
- Sezioni STANDARD cliente condizionate da Commessa
- Refactoring App.js (>29k) e server.py (>23k) in moduli
- Preset filtri salvabili per gli utenti

## Test credentials
Vedi `/app/memory/test_credentials.md`
