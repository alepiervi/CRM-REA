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

## Bloccanti esterni
- **Spoki API key** restituisce 401 — utente sta verificando attivazione nel pannello Spoki Partner
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
