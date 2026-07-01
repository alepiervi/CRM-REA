# Nureal CRM — PRD

## Fix ricerca clienti "Nome Cognome" (1 lug 2026) — RISOLTO
**Problema** (segnalato dal testing agent): la ricerca full-text con nome+cognome completo (es. "Alessandro Piervincenzi") restituiva 0 risultati, mentre i singoli token funzionavano — perché la singola regex sull'intera stringa non matcha nessun campo che contenga entrambe le parole.
**Fix** (`routes/clienti.py`, search block ~665): tokenizzazione del termine; se ci sono più token, ogni token deve matchare almeno un campo (AND tra token, OR tra i campi nome/cognome/ragione_sociale/email/telefono/CF/P.IVA), con `re.escape`. Un solo token = comportamento invariato.
**Testing self** (curl): "Alessandro Piervincenzi" → 19 (prima 0), ordine inverso "Piervincenzi Alessandro" → 19, token inesistente "Alessandro Zxqmai" → 0 (AND corretto).


**Segnalazione utente**: nell'export Excel dei clienti la colonna BM contiene note NON visibili nell'anagrafica del cliente.
**Causa**: la colonna BM (65ª = "Note") dell'export corrisponde al campo `note` del documento cliente; questo campo veniva caricato nel form ma NON era mai renderizzato (né in visualizzazione né come campo modificabile). Spesso popolato dall'import massivo.
**Fix (solo frontend)**:
- `ViewClienteModal.jsx`: nuova card "Note" (read-only) che mostra `cliente.note` e `cliente.note_backoffice` se presenti (data-testid `view-cliente-note-card`, `view-cliente-note`)
- `EditClienteModal.jsx`: nuovo Textarea editabile per `note` (data-testid `edit-cliente-note-textarea`); il payload PUT include già `...formData` → la nota si salva
- Backend già accettava il campo (ClienteUpdate.note) — nessuna modifica necessaria
**Testing**: testing_agent iteration_17 → backend 100% (GET restituisce note, PUT persiste, export colonna BM contiene il valore); verifica visiva confermata (card "Note" mostra il valore). Test file `/app/backend/tests/test_cliente_note_field.py`.

## Miglioramento — Consolidamento nota anagrafica nello Storico Note (1 lug 2026)
- Nuovo endpoint `POST /api/clienti/{id}/migrate-legacy-notes` (in `routes/cliente_notes.py`): sposta `note`→Storico (tipo cliente) e `note_backoffice`→Storico (tipo backoffice), poi svuota i campi raw. IDEMPOTENTE + de-dup (non crea doppioni se una entry con lo stesso contenuto esiste già). Richiede permesso di modifica cliente.
- Frontend `ViewClienteModal.jsx`: pulsante "Sposta nello Storico" (icona Archive, data-testid `migrate-legacy-notes-btn`) nella card Note (admin/backoffice_commessa); dopo il click nasconde la card e ricarica lo Storico (key bump). Così le note vivono in un unico posto.
- Testing self: curl → migrate sposta e svuota `note`, seconda chiamata "Nessuna nota da spostare", storico resta 1 entry (no doppioni); screenshot conferma pulsante nella card.

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

## Integrazione Chatbot OpenAI Assistants + Workflow (giugno 2026)
- **OPENAI_API_KEY** (chiave personale utente, sk-proj-...) in backend/.env — VALIDA, 7+ Assistant sull'account (Gaia, Giulia, Silvia, Sofia... uno per Unit)
- `spoki_chatbot.py`: `assistant_generate_reply` (threads/runs Assistants API v2, retry su thread scaduto), `generate_unit_reply` (usa Assistant della Unit se configurato, altrimenti chatbot interno gpt-4o-mini), `list_openai_assistants`
- `UnitSpokiConfig.openai_assistant_id`: assistant selezionabile per Unit da SpokiAdminConfig (dropdown data-testid spoki-assistant-select), endpoint GET /api/spoki/openai-assistants
- Thread OpenAI persistito in `lead_chatbot_sessions.openai_thread_id` (multi-turno verificato)
- **GATE chatbot**: il bot risponde ai messaggi WhatsApp inbound SOLO se la sessione ha `activated_by_workflow: true` — attivata dal nuovo nodo workflow **"Attiva Chatbot AI"** (actions/activate_chatbot, campo opzionale first_message) o dal nodo run_chatbot
- **Benvenuto SOLO via workflow**: rimossi i 4 hook automatici `spoki_send_welcome_for_lead` alla creazione lead in server.py; il benvenuto parte dal nodo "Spoki: Invia Template" quando il lead scende sulla Unit autorizzata
- Fix (testing agent): conflitto $set/$setOnInsert su PATCH /api/spoki/unit-configs (500 al salvataggio)
- Test: pytest 5/5 (/app/backend/tests/test_spoki_chatbot_workflow.py) + UI Spoki Config verificata

## Pagina "Conversazioni AI" (giugno 2026)
- Nuova voce sidebar "Conversazioni AI" (admin + super_referente) → `components/spoki/AIConversations.jsx`
- Lista conversazioni WhatsApp (una per lead, aggregazione spoki_messages) con badge stato bot (attivo/in pausa/non attivato), unit, ultimo messaggio; ricerca; polling 8s
- Pannello chat: thread messaggi (Cliente/Bot AI/Operatore), invio manuale, **toggle bot per lead** (data-testid ai-conv-bot-toggle)
- Backend: GET /api/spoki/conversations (filtrato per unit visibili), POST /api/spoki/conversations/{lead_id}/toggle-bot ({paused: bool}; riattivando marca activated_by_workflow=true → presa in carico manuale)
- Gate aggiornato: bot non risponde se `bot_paused=true` (sia webhook inbound che nodo run_chatbot)
- Fix: corruzione pre-esistente in App.js riga 3262 (`setFilters..filters` → sintassi rotta) che bloccava la compilazione webpack

## Notifiche messaggi non gestiti (giugno 2026)
- Webhook inbound: se il bot NON risponde (in pausa/non attivato/disabilitato/errore) il messaggio viene flaggato `needs_attention: true` in spoki_messages
- GET /api/spoki/conversations/unhandled-count → numero lead con messaggi da gestire (filtrato per unit visibili) — NOTA: registrato PRIMA di /conversations/{lead_id} per evitare conflitto di route
- POST /api/spoki/conversations/{lead_id}/mark-read → azzera i flag (chiamato all'apertura conversazione nella pagina Conversazioni AI)
- Lista conversazioni: campo `unhandled_count` per lead + badge rosso "N da gestire"
- Sidebar (App.js, componente Dashboard): badge rosso con contatore sulla voce "Conversazioni AI" (desktop data-testid ai-conv-unhandled-badge + mobile), polling 30s, solo admin/super_referente
- Il nodo workflow run_chatbot azzera i needs_attention del lead dopo aver risposto

## Duplica configurazione Campi Custom Cliente (giugno 2026)
- POST /api/cliente-custom-config/duplicate (admin): copia sezioni + campi + status da (commessa, tipologia) sorgente a destinazione
- Modalità: "merge" (default, salta elementi già esistenti per nome/value) | "overwrite" (elimina config destinazione e ricopia)
- section_id dei campi rimappato sulle nuove sezioni (o su sezioni esistenti omonime in merge)
- UI: bottone "Duplica configurazione" (data-testid duplicate-config-btn) nella card Filtri di ClienteCustomFieldsManager → dialog con sorgente (pre-compilata dai filtri), anteprima conteggi, destinazione, selettore modalità, conferma con riepilogo copiati/saltati
- Testato E2E: copia, doppia esecuzione merge (tutto skipped), overwrite, validazione sorgente==destinazione, UI con anteprima

## Privilegi Sub Agenzia (15 feb 2026) — COMPLETATO E TESTATO (9/9)
**Requisito utente**: alcune sub agenzie devono poter consentire ai loro BO Sub Agenzia di modificare lo status clienti; per le tipologie indicate, i clienti di quella sub agenzia non sono visibili al BO Commessa (esempio: TELEFONIA nascosta, ENERGIA visibile).

**Backend**:
- `models.py`: `SubAgenzia` + `Create/Update` con 2 nuovi campi
  - `can_change_status: bool = False` — abilita modifica status ai BO Sub Agenzia
  - `hidden_tipologie_for_bo_commessa: List[str] = []` — label tipologie nascoste al BO Commessa
- `routes/segmenti_offerte.py` (create/update sub-agenzie): solo Admin può impostare i 2 nuovi campi; per altri ruoli sono silenziosamente azzerati/ignorati
- `routes/users_auth.py` `/auth/me`: arricchito con `bo_sub_agenzia_can_change_status: bool` (lookup sub_agenzia per ruolo BACKOFFICE_SUB_AGENZIA)
- `routes/clienti.py`:
  - `update_cliente`: BO Sub Agenzia con privilegio attivo + cliente della propria sub agenzia può modificare lo status
  - `get_clienti` (list) + `get_clienti_export`: per BO Commessa applica `$nor` su coppie `(sub_agenzia_id, tipologia_contratto∈hidden)`
  - `get_cliente` (detail): BO Commessa → 403 se cliente ha tipologia nascosta per la sua sub agenzia
- Match label tipologia_contratto case-sensitive (es. "Energia"/"Telefonia") — coerente con il valore salvato nei clienti

**Frontend** (`pages/SubAgenzie.jsx`, `pages/clienti/EditClienteModal.jsx`):
- `CreateSubAgenziaModal` + `EditSubAgenziaModal`: nuova sezione "Privilegi Speciali (Admin)" condizionata a `user.role === 'admin'`, con Switch can_change_status + checkbox multi-select tipologie (fetch `/api/tipologie-contratto/all`). Data-testid: `sub-agenzia-privileges-section`, `sub-agenzia-can-change-status-toggle`, `hidden-tipologia-create-{id}`/`hidden-tipologia-edit-{id}`
- `EditClienteModal` Select Status ora abilitato anche se `user.role === 'backoffice_sub_agenzia' && user.bo_sub_agenzia_can_change_status && cliente.sub_agenzia_id === user.sub_agenzia_id` (data-testid `cliente-status-select`)

**Test**: `/app/backend/tests/test_sub_agenzia_privileges.py` (6 test: 3 schema + 3 endpoint audit) + `/app/backend/tests/test_sub_agenzia_privileges_e2e.py` (6 E2E del testing agent). Suite completa pytest 60/64 (4 skip, 0 fail).

## Spoki Multi-Tenant — chiave API per Unit (15 feb 2026)
**Requisito utente**: ogni Unit deve avere la sua API Key + Webhook Secret Spoki dedicate. Rimossa la chiave globale dall'.env.

**Backend**:
- `spoki_module.py`:
  - `UnitSpokiConfig` esteso con `api_key` + `webhook_secret` per-Unit
  - `SpokiService.__init__(api_key, webhook_secret)` esplicito (rimosso lettura `os.environ.get('SPOKI_API_KEY')`)
  - Nuova factory `get_spoki_service_for_unit(db, unit_id)` — carica le credenziali dal DB e ritorna un service configurato (o None se chiave mancante)
  - Utility `mask_secret(s)` per UI (`bf7b...6241`)
- `spoki_routes.py`: refactor di TUTTI i call sites (welcome, bot inbound, send manual, pair, templates, webhook) per usare il service per-Unit. Il webhook verifica la firma usando il webhook_secret della Unit identificata dal lead/cliente del numero mittente.
- Endpoint nuovi/aggiornati:
  - `GET /api/spoki/unit-configs` e `GET /api/spoki/unit-configs/{id}` — risposta serializzata che NON espone secrets in chiaro: aggiunge `api_key_configured: bool`, `api_key_masked: 'bf7b...6241'`, idem per webhook_secret
  - `PATCH /api/spoki/unit-configs/{id}` — Admin only, accetta api_key + webhook_secret + convenzione: campo omesso = invariato; valore non vuoto = aggiorna
  - `GET /api/spoki/unit-configs/{id}/secrets` — Admin only, ritorna i secrets in chiaro per il toggle "Mostra" dell'UI (loggato lato server)
  - `GET /api/spoki/diagnostics?unit_id=...` — testa la chiave di una specifica Unit; senza parametro testa TUTTE le Unit con chiave configurata. Report aggregato per Unit
  - `GET /api/spoki/health` — globale: ritorna `units_total` + `units_with_api_key`; con `?unit_id=...` testa la singola Unit
  - `GET /api/spoki/templates?unit_id=...` — lista template per la specifica Unit

## Timezone fix Europe/Rome (15 feb 2026) — RCA + fix completo
**Bug riportato dall'utente**:
1. I clienti creati non comparivano subito in lista/export — apparivano "dopo qualche ora"
2. Le note e gli altri timestamp mostravano l'ora di Londra (UTC) anziché di Roma

**RCA**:
- Backend: i filtri `date_from`/`date_to` interpretavano la data come `YYYY-MM-DDT00:00:00 UTC`. Un utente italiano alle 01:30 di notte (CEST = UTC+2) vede "oggi" ma in UTC sono ancora 23:30 del giorno prima. Risultato: i clienti creati tra mezzanotte Roma e le 02:00 Roma venivano esclusi dal filtro "oggi".
- Frontend: Mongo storage perde la timezone info (Motor restituisce naive datetimes). FastAPI serializza come `"2026-02-15T14:30:00"` (senza `Z`). `new Date(stringa_senza_tz)` in JavaScript interpreta come **ora locale**, non UTC. Risultato: timestamp mostrati 1-2 ore in meno.

**Fix backend**:
- `helpers.py`: nuova funzione `rome_date_to_utc_range(date_str)` + `APP_TIMEZONE=ZoneInfo("Europe/Rome")` — gestisce automaticamente CET/CEST e i giorni di transizione DST
- `routes/clienti.py` (3 punti: lista, export, audit), `routes/leads.py`, `routes/analytics.py` (4 endpoint inclusi supervisor/unit) — tutti i `datetime.fromisoformat(d).replace(tzinfo=timezone.utc)` sostituiti con `rome_date_to_utc_range(d)`

**Fix frontend**:
- `lib/datetime.js` (nuovo modulo): `parseBackendDate`, `formatDateTimeIT`, `formatDateIT`, `formatTimeIT`, `todayRomeISO`. `parseBackendDate` forza interpretazione UTC se manca marker tz nella stringa ISO
- `lib/appUtils.js` `formatDate`: ora delega a `parseBackendDate` + `timeZone: 'Europe/Rome'`
- Sostituiti `new Date(x).toLocaleString("it-IT")` con `formatDateTimeIT(x)` in: `ClienteNotesHistory.jsx`, `ClientePostVenditaSection.jsx`, `ClienteLock.jsx`, `PermissionsAudit.jsx`, `PostVendita.jsx`, `spoki/AIConversations.jsx`, `spoki/LeadConversationsTab.jsx`, `ClientiManagement.jsx` (log timestamp), `SubAgenziaStatusAudit.jsx`

**Test**: pytest `tests/test_timezone_rome.py` (creato dal testing agent) — 17/17 PASSED inclusi edge case mezzanotte Roma CEST + CET + DST transition day 2026-03-29. Suite completa di regressione OK.

- `.env`: rimossa `SPOKI_API_KEY` globale (più nessun codice la legge)

**Frontend** (`components/spoki/SpokiAdminConfig.jsx`):
- Nuova card "Credenziali Spoki di questa Unit" in cima alla "Configurazione Unit"
- Input `api_key` mascherato con toggle Mostra/Nascondi (chiama `/secrets`); idem `webhook_secret`
- Badge "Chiave attiva"/"Chiave mancante" per Unit

## Workflow Builder FASE B + C completate (15 feb 2026)
**Stato precedente**: backend già implementava cartelle, draft/published, node-stats, test-run, add_tag/remove_tag/go_to/if_else/match_value. Mancavano UI di configurazione.

**Aggiunte sessione**:
- Frontend `WorkflowBuilder.jsx`: bottone "Test Run" nell'editor + dialog con form lead fittizio + risposta simulata + result panel
- `NodeEditorModal` esteso con 4 UI di configurazione specifiche:
  - **add_tag** / **remove_tag**: selettore tag esistenti (fetch `/api/lead-tags`) + bottone "Crea nuovo tag" inline
  - **go_to**: dropdown del nodo target (lista tutti i nodi del workflow corrente, esclude se stesso)
  - **if_else**: campo, operatore (equals/contains/gt/lt/empty/etc), valore — produce branch `yes`/`no`
  - **match_value**: input campo + textarea cases (formato `valore|label`, uno per riga) + default_label — produce branch dinamici
- Backend cleanup: rimossi duplicati `add_tag`/`remove_tag` (versione EN) dai workflow-node-types; `POST /api/workflows/{id}/test-run` ora ritorna `404` esplicito se workflow non esiste (+400 se executor fallisce)

**Test**: pytest `tests/test_workflow_executor_v2_phase_bc.py` (creato dal testing agent) — 17/17 PASSED. Copre: test-run no side effects, add_tag $addToSet, remove_tag $pull, go_to bypass edges, if_else con _resolve_path, match_value list e JSON-string, sourceHandle branch routing.


## Gallery Template Workflow estesa (15 feb 2026)
**Da 4 a 8 template** pre-configurati + categorizzazione + filtri UI.

**Nuovi template** (`workflow_templates.py`):
- **Recupero Lead Freddo** (nurturing): Wait 7gg + check status nuovo + DM recupero + tag `lead_freddo`
- **Alert Status KO** (post_vendita): trigger su KO + email admin + tag `perdita`
- **Upsell Post Vendita 30gg** (post_vendita): trigger su `inserito` + wait 30gg + DM upsell + tag `upsell_inviato`
- **Tag automatico per Provincia** (acquisizione): match_value su lead.provincia → 3 rami tag zona_nord/centro/sud (8 province preconfigurate)

**Categorizzazione**: ogni template ha ora `category` (acquisizione / nurturing / post_vendita). 

**Frontend `WorkflowBuilder.jsx` — Template Import Modal**:
- Barra filtri **sticky** in cima (sempre visibile durante lo scroll)
- 4 tab categoria con conteggio dinamico: Tutti (9), Acquisizione (4), Nurturing (2), Post-Vendita (2)
- Input search testuale (cerca su name + description + features)
- Empty state quando i filtri non producono risultati
- `DialogContent` reso flex-col con scroll interno per gestire +N template

**Test**: 23/23 pytest passati (timezone + workflow + sub agenzia). UI testata manualmente con tutti i filtri.

- Badge globale in header "X/Y Unit configurate" (verde se tutte, ambra se parziali)
- `fetchTemplates(unitId)` ora richiede unit_id; diagnostica mirata sulla Unit selezionata
- `handleSave` invia api_key/webhook_secret SOLO se modificati (convenzione `revealApiKey || input non vuoto`)

**Test**: 165 pytest passati (suite completa). Verifica E2E manuale: PATCH credenziali → reveal → diagnostics → templates fetch tutto OK.


## Audit Status Sub Agenzie (15 feb 2026)
Enhancement della feature privilegi sub agenzia: tracciamento dei cambi status fatti via privilegio.

**Backend**:
- `routes/clienti.py` `update_cliente`: quando il cambio status è autorizzato tramite il privilegio BO Sub Agenzia, viene loggato con `metadata.via_sub_agenzia_privilege=true` e `metadata.sub_agenzia_id`
- Nuovo endpoint `GET /api/audit/sub-agenzia-status-changes` (Admin + Responsabile Commessa) — query su `clienti_logs` con filtri `sub_agenzia_id`, `date_from`, `date_to`. Enrichment cliente nome+tipologia + sub agenzia nome. Per Responsabile Commessa scope limitato alle sue commesse autorizzate

**Frontend**:
- Nuova pagina `pages/SubAgenziaStatusAudit.jsx`: filtri sub agenzia/date, tabella movimenti con data/cliente/tipologia/sub agenzia/old→new status/operatore, export CSV, lazy-loaded via `React.lazy`
- Sidebar voce "Audit Status Sub Agenzie" visibile ad Admin e Responsabile Commessa


## REFACTORING STRUTTURALE (giugno 2026) — COMPLETATO E TESTATO
**Backend:**
- `/app/backend/models.py` (1.600 righe): tutti i 141 modelli Pydantic + Enum estratti da server.py (importati con `from models import *` nello stesso punto). server.py: 24.488 → 22.900 righe
- Test regressione: `/app/backend/tests/test_refactor_regression.py` (pytest 10/10, riusabile come smoke per futuri refactor)

**Frontend — App.js: 29.842 → 2.608 righe:**
- `src/lib/appUtils.js`: getBackendURL, BACKEND_URL, API, PROVINCE_ITALIANE, formatDate, normalizeProvinceName, provinciaMatches, formatClienteStatus, getClienteStatusVariant, STATUS_CLIENTI (tutti export)
- `src/context/AuthContext.jsx`: AuthContext, useAuth, AuthProvider (session timeout 15min)
- `src/pages/` (14 file): UsersManagement, Analytics, Documents, AiWhatsApp, WorkflowBuilder (con NODE_COLOR_PALETTE/NODE_ICONS), CallCenter, Commesse, SubAgenzie, Cestini, NetworkAnalytics, ClienteModals (6.937 righe: Create/Import/View/EditClienteModal, ArubaDriveConfigModal, ClientDocumentsModal), ClientiManagement, LeadsManagement, LeadsConfig
- Ogni page file ha header import condiviso (template da App.js con path "../") + named exports; App.js importa tutto
- Cross-import: ClientiManagement→ClienteModals; SubAgenzie→LeadsConfig (CreateUnitModal/EditUnitModal)
- In App.js restano: PasswordChangeModal, Login, DashboardStats, ResponsabileCommessaDashboard, Dashboard (shell), Containers*, App, AppWithAuth
- Verificato: build produzione OK, regressione testing agent 100% (backend 10/10, frontend 0 ReferenceError su 10 sezioni), canvas workflow con palette OK
- Aggiunti data-testid workflow-edit/copy/delete-{id} alle righe workflow (richiesta testing agent)

**Code-splitting (giugno 2026):**
- App.js: import statici delle pages sostituiti con `React.lazy` via helper `lazyNamed(loader, name)` (named exports); solo i 19 componenti realmente usati da App.js
- `<React.Suspense fallback={<PageLoader />}>` attorno a `{renderTabContent()}`; Suspense separato per EditClienteModal (flusso Post Vendita)
- Risultato build: main bundle 672K + 16 chunk on-demand (il maggiore 380K). Verificato: build produzione OK + navigazione 7 sezioni senza errori/ChunkLoadError

## REFACTORING FASE 2 (giugno 2026) — COMPLETATO E TESTATO (21/21)
**Backend (server.py: 22.901 → ~19.180 righe):**
- `database.py`: connessione MongoDB condivisa (client, db) con load_dotenv
- `security.py`: SECRET_KEY/JWT, pwd_context, verify_password, get_password_hash, create_access_token, get_current_user + helper autorizzazioni (check_commessa_access, get_user_accessible_commesse/sub_agenzie, can_user_access/modify/delete_cliente, can_user_access_document...)
- `audit.py`: log_client_action (condiviso server.py + routes)
- `routes/` (8 moduli, ~3.240 righe): leads_cestino, units, lead_status, cliente_custom (+duplicate), segmenti_offerte, cliente_lock, cliente_notes (+clienti-cestino), post_vendita (+bulk import). Ogni modulo: APIRouter proprio, importa database/security/audit/models; inclusi in api_router PRIMA di app.include_router
- Verifica: diff set route VUOTO (286 identiche pre/post), AST check nomi non risolti pulito, pytest test_refactor_regression.py 10/10 + test_refactor_fase2.py 21/21 (nuova suite del testing agent, copre tutti gli 8 moduli)

**Frontend:**
- ClienteModals.jsx (7.127 righe) → 6 file in `src/pages/clienti/` (CreateClienteModal 2.522, EditClienteModal 2.281, ViewClienteModal 757, ClientDocumentsModal 724, ImportClientiModal 469, ArubaDriveConfigModal 190) + barrel ClienteModals.jsx per compatibilità import
- Aggiunti data-testid sulle azioni riga cliente: cliente-view/documents/history/edit/delete-btn-{id}

**Metodo di verifica refactor (riusare nei prossimi):** snapshot route pre (`/tmp/routes_before.txt`) → diff post; pyflakes + AST name-check; pytest entrambe le suite; curl smoke sui gruppi spostati

## REFACTORING FASE 3 (giugno 2026) — COMPLETATO E TESTATO (pytest 133/133 + testing agent 100%)
**Backend (server.py: 19.189 → 9.598 righe):**
- `services.py` (~1.700): ArubadriveService, ChatBotService, TwilioService, CallCenterService, ACDService, WhatsAppService, LeadQualificationBot + istanze singleton + NextcloudClient + costanti env (ARUBA_*, TWILIO_*, UPLOAD_DIR, EMERGENT_LLM_KEY) + validate_uploaded_file/save_temporary_file/create_document_record
- `helpers.py` (~1.200): ITALIAN_PROVINCES, normalize_province_name, provincia_matches, assign_lead_to_agent, parse_uploaded_file/validate_cliente_data/process_import_batch, create_excel_report, create_clienti_excel_report, get_user_ip, detect_client_changes, _expand_segmento_filter_values, get_hardcoded_tipologie_contratto, should_use_hardcoded_elements
- `notifications.py` (~570): SMTP Aruba, send_email_notification, notify_agent_new_lead, reminder lead + scheduler
- Nuovi moduli route fase 3: `routes/users_auth.py` (login/JWT/users CRUD/province), `routes/leads.py` (CRUD lead + webhook /webhook/lead E /webhook/{unit_id} + proxy lazy trigger_workflows_for_lead via sys.modules per evitare import circolare), `routes/documents.py` (upload + last_upload_debug), `routes/analytics.py` (agent/supervisor/referente + pivot + export), `routes/clienti.py` (CRUD + filtri + export + import massivo)
- **REGRESSIONE TROVATA E FIXATA**: l'ordine di matching /webhook/lead vs /webhook/{unit_id} — i webhook parametrici sono stati spostati in leads.py DOPO /webhook/lead. Creato scan sistematico "route oscurate" (regex match per coppie metodo/path in ordine di registrazione) → 0 problemi su tutta l'app
- Fix URL stantii in 5 file tests/ (puntavano a preview di job precedenti)
- Verifiche: diff set 286 route VUOTO, AST name-check pulito, pytest 133/133, testing agent backend 20/20 + frontend 0 errori console

**Lezioni per refactor futuri:** 1) l'ordine di registrazione route conta — usare lo scan route-oscurate; 2) i moduli route si registrano DOPO le route inline di server.py; 3) funzioni server-level richiamate dai moduli → proxy lazy sys.modules o spostamento in modulo condiviso

**Refactoring residuo (P4, opzionale):** server.py ~9.6k righe contiene ancora: chat/AI config routes, whatsapp legacy, lead qualification/workflow v1+v2, call center/twilio, aruba webdav/web-automation block, commesse/sub-agenzie/servizi CRUD, startup/scheduler. Estraibili con la stessa metodologia.

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

## Workflow Builder FASE D — Polish UX Canvas (30 giu 2026) — COMPLETATO
**Requisito (backlog)**: rendere il canvas del Workflow Builder più leggibile e moderno.

**Frontend** (`pages/WorkflowBuilder.jsx`, solo presentazione, nessuna modifica backend):
- Helper `buildNodeStyle(accent)`, `branchColor(handle)`, `decorateEdge(edge)`
- Nodi: sfondo bianco + barra accent colorata a sinistra (5px), bordo soft, ombra, label allineate a sinistra, larghezza 200, altezza auto. Colore accent derivato da `NODE_COLOR_PALETTE`; salvato in `data.accent`/`data.color`
- Nodi/edge esistenti normalizzati al nuovo stile in fase di caricamento (retro-compatibile con workflow salvati che usavano box pieni)
- Edge: `type=smoothstep`, animati, frecce `MarkerType.ArrowClosed`, colore per ramo (sì=verde, no=rosso, timeout=ambra, default=slate) + label del ramo (sourceHandle)
- `onConnect` usa `decorateEdge`; `defaultEdgeOptions` + `connectionLineType/Style` smoothstep indaco
- MiniMap colorata (`nodeColor`/`nodeStrokeColor` da `data.accent`), pannable/zoomable, card bianca
- Background dots più chiari; empty-state ridisegnato (icona gradient indaco/violet); `hideAttribution`

**Test**: verificato via screenshot su workflow reale con ramo condizionale ("Risposta Positiva? → SI → Avvia AI Assistant"); nodi/edge/minimap renderizzati correttamente, badge statistiche per nodo ancora funzionanti.

### FASE D+ — Icona del tipo di nodo nel box (30 giu 2026)
- Ogni nodo del canvas mostra ora un'icona specifica del tipo (es. user-plus per Lead Creato, clock per Attendi, check-circle per condizione, bot per AI, settings per update) + titolo + badge statistiche in pill
- `makeNodeLabel(iconKey, title, count)` rende la label come JSX (icona lucide + titolo troncato + pill `N×`); `data.label` resta STRINGA al salvataggio via `serializeNodes(nodes)` (evita di serializzare JSX) applicato a Salva/Test Run/Pubblica
- `resolveIconKey(node, catalog)`: usa `data.iconKey` se reale, altrimenti risolve dal catalogo `/workflow-node-types` con fallback scan su tutte le categorie (gestisce mismatch singolare/plurale nodeType: `triggers` vs `trigger`); ignora un `default` memorizzato per ri-risolvere quando il catalogo è disponibile
- `addNode` salva `iconKey` (da `subtype.icon`); palette passa `icon` su drag/click; effetto di rigenerazione label su `[nodeStats, nodeTypes]`
- Estesa `NODE_ICONS` con cpu→Bot, edit/edit-3→Settings, user-check→UserPlus, form-input→CheckSquare, circle→CheckCircle, message-square→MessageSquare
- Verificato via screenshot: icone distinte per ogni nodo del template, retro-compatibile con nodi salvati

### FASE D+ — Pulsante Auto-layout (30 giu 2026)
- Nuovo pulsante "Auto-layout" (icona Network, data-testid `workflow-autolayout-btn`) in toolbar canvas accanto a "Salva"
- `autoLayout()`: calcola il livello di ogni nodo con longest-path relaxation sugli edge (Bellman-Ford, sicuro anche con cicli go_to), raggruppa per livello e li dispone in un albero verticale centrato (LEVEL_GAP_Y=140, NODE_GAP_X=260, CENTER_X=460); poi `reactFlowInstance.fitView` con animazione + toast di conferma
- Verificato via screenshot: nodo spostato manualmente → click Auto-layout → riallineamento ordinato e vista centrata

## Workflow Builder FASE E (30 giu 2026) — COMPLETATO
**Solo frontend (`WorkflowBuilder.jsx`/`WorkflowCanvas`), nessuna modifica backend.**

### Validazione visuale workflow
- Pulsante "Valida" (data-testid `workflow-validate-btn`, icona ShieldCheck) apre dialog `workflow-validation-dialog`
- `computeValidation()` rileva: workflow vuoto (error), trigger mancante (error), trigger multipli (warning), edge verso nodi inesistenti (error), nodi non collegati (warning), nodi non raggiungibili dal trigger (warning)
- I nodi problematici vengono evidenziati con ring rosso (error) / ambra (warning) via `highlightNodes`; ogni issue con `nodeId` ha "Vai al nodo →" che fa `fitView` sul nodo (`goToNode`)
- `handlePublish` esegue la validazione e BLOCCA la pubblicazione se ci sono errori (i warning sono consentiti)

### Undo / Redo
- Stack `past`/`future` (cap 50) con `nodesRef`/`edgesRef`; `commitHistory()` esposto via `historyCommitRef` per evitare TDZ nelle callback
- `commitHistory` invocato prima di: onConnect, addNode, updateNodeConfig, autoLayout, onNodeDragStart, onNodesDelete, onEdgesDelete
- Pulsanti Undo (`workflow-undo-btn`) / Redo (`workflow-redo-btn`) in toolbar con stato disabled corretto; scorciatoie Ctrl/Cmd+Z (undo), Ctrl+Shift+Z / Ctrl+Y (redo)
- Verificato via screenshot: nodo orfano aggiunto → 2 warning con highlight ambra + "Vai al nodo"; undo abilitato e funzionante

### Badge live di validazione (30 giu 2026)
- Il pulsante "Valida" mostra un badge automatico con il numero di problemi, calcolato ad ogni render (`liveIssues`/`liveErrorCount`/`liveWarnCount`): rosso col conteggio errori se presenti, altrimenti ambra col conteggio avvisi; nessun badge se il workflow è valido
- Si aggiorna in tempo reale all'apertura del workflow e ad ogni modifica di nodi/edge, senza dover aprire il dialog (data-testid `workflow-validate-badge`)
- Verificato via screenshot: nodo orfano → badge "2" ambra sul pulsante Valida

### Onboarding / mini-tutorial Workflow Builder (30 giu 2026)
- Tour a 5 step (benvenuto + palette + costruzione + validazione + test/pubblica) che si apre automaticamente al primo accesso al canvas (flag `wf_builder_tour_done` in localStorage)
- Dialog `workflow-tour-dialog` con icona gradient per step, dots di progresso, controlli Salta/Indietro/Avanti/Inizia a costruire
- Pulsante "?" (`workflow-help-btn`, icona HelpCircle) in toolbar per riaprire la guida in qualsiasi momento
- Verificato via screenshot: auto-apertura al primo accesso, navigazione step, skip e riapertura da pulsante help

## Workflow Builder FASE F — Versioning + Duplica (30 giu 2026) — COMPLETATO

### Fix critico persistenza (prerequisito)
- BUG preesistente: il builder LEGGE i nodi/edge dal TOP-LEVEL del documento workflow (così come l'executor), ma il salvataggio scriveva SOLO dentro `workflow_data` → le modifiche del builder non venivano persistite dove lette.
- Fix: `WorkflowUpdate` ora accetta `nodes`/`edges`; i 3 salvataggi frontend (Salva/Test Run/Pubblica) inviano nodi/edge sia top-level sia in `workflow_data`. La validazione trigger in `update_workflow` ora controlla i nodi builder (data.nodeType trigger/triggers) con fallback alla collezione legacy.

### Duplica workflow
- `POST /api/workflows/{id}/duplicate` (admin): deep-copy dell'intero documento nella stessa Unit, nome "… (Copia)", `is_published=False`
- Pulsante "Duplica" (icona CopyPlus verde, `workflow-duplicate-{id}`) in ogni card della lista; handler `handleDuplicateWorkflow` + refresh

### Versioning (cronologia + ripristino)
- Collezione `workflow_versions`: `{id, workflow_id, version, label, snapshot{name,description,workflow_data,nodes,edges,trigger_type,folder_id}, nodes_count, created_by, created_at}`
- Helper `_create_workflow_version`; snapshot AUTOMATICO ad ogni pubblicazione
- `GET /api/workflows/{id}/versions`, `POST /api/workflows/{id}/versions` (manuale), `POST /api/workflows/{id}/versions/{version_id}/restore` (salva backup pre-ripristino, ripristina in bozza)
- Frontend: pulsante "Cronologia" (icona History) in toolbar canvas → dialog `workflow-versions-dialog` con lista versioni, "Salva versione attuale" e "Ripristina"; `applyWorkflowData` aggiorna il canvas in-place dopo il ripristino
- Verificato via curl + screenshot: duplica (5 nodi, bozza), salva versione, lista, ripristino (riporta 5 nodi + crea backup v2 dello stato a 1 nodo), persistenza nodi top-level al salvataggio

## Selettore Fuso Orario per Utente (30 giu 2026) — COMPLETATO E TESTATO
**Requisito utente (P1)**: rendere il fuso orario configurabile per-utente (es. Europe/Rome vs Europe/London) per supportare sub-agenzie internazionali; prima era hardcoded su Europe/Rome.

**Backend**:
- `models.py`: `User.timezone: str = "Europe/Rome"`; `UserUpdate.timezone: Optional[str]`
- `helpers.py`: `rome_date_to_utc_range(date_str, tz_name=None)` ora accetta un fuso opzionale (fallback Europe/Rome); gestisce DST via zoneinfo
- `routes/users_auth.py`: `/auth/me` ritorna sempre `timezone` (default Roma per utenti legacy); nuovo `PATCH /api/auth/me/timezone` self-service (valida IANA con ZoneInfo, 400 se non valido)
- Tutti i call-site dei filtri data (`routes/clienti.py` 3x, `routes/leads.py` 1x, `routes/analytics.py` 8x) ora passano `current_user.timezone` a `rome_date_to_utc_range`

**Frontend**:
- `lib/datetime.js`: aggiunto `setActiveTimezone`/`getActiveTimezone` (modulo-level, default Europe/Rome); tutte le funzioni di format (`formatDateTimeIT`, `formatDateIT`, `formatTimeIT`, `todayRomeISO`) usano il fuso attivo
- `lib/appUtils.js` `formatDate`: usa `getActiveTimezone()`
- `context/AuthContext.jsx`: `setActiveTimezone(user.timezone)` su login/fetchCurrentUser/extendSession; esposto `setUser` nel context value
- Nuovo `components/settings/TimezoneSettingsDialog.jsx`: dialog con Select di 14 fusi comuni (data-testid `timezone-settings-trigger`, `timezone-select-trigger`, `timezone-save-btn`); montato nell'header desktop e nel menu mobile di App.js

**Fix collaterale critico** (`notifications.py`): `send_email_notification` usava `smtplib.SMTP_SSL` bloccante dentro l'event loop → con SMTP Aruba irraggiungibile (IP blacklistato) congelava l'intero backend (502/timeout). Ora gira in `asyncio.to_thread` con `timeout=15s`.

**Test**: e2e curl OK (PATCH timezone Roma↔Londra, validazione 400 su fuso invalido, filtri clienti/leads/analytics-pivot 200 con fuso utente); UI dialog verificata via screenshot.
