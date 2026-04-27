# CRM Nureal - Product Requirements Document

## Original Problem Statement
Sistema CRM completo per gestione clienti, lead, agenti e workflow automatizzati con integrazione WhatsApp e notifiche email.

## Current State (Febbraio 2026)

### ✅ Completato in questa sessione (27 Feb 2026)

- **Sistema Lock Anagrafica Cliente (🔒 Lucchetto)**
  - Quando un utente apre una scheda cliente (View o Edit), il sistema acquisisce un lock esclusivo. Altri utenti non possono né visualizzare né modificare la scheda finché non viene rilasciata o scade automaticamente.
  - Timeout: **10 minuti** di inattività (heartbeat dal frontend ogni 4 min mentre il modal è aperto)
  - Rilascio automatico: su chiusura modal, tab close (via `fetch keepalive` DELETE), scadenza backend
  - **Backend** (`/app/backend/server.py` linee 16568-16780): 6 endpoint `POST/DELETE/GET /api/clienti/{id}/lock`, `POST .../lock/heartbeat`, `POST .../lock/force-release` (admin-only), `GET /api/cliente-locks`. Collezione `cliente_locks`. Constante `CLIENTE_LOCK_TIMEOUT_MINUTES = 10`.
  - **Frontend** (`/app/frontend/src/components/ClienteLock.jsx`): hook `useClienteLock(clienteId)`, componente `ClienteLockedScreen` con info utente + bottone admin "Forza sblocco", hook `useActiveClienteLocks` per badge 🔒 nella lista Clienti (polling 30s)
  - Integrazione in `ViewClienteModal` e `EditClienteModal`: early-return con `ClienteLockedScreen` se lock detenuto da altro utente
  - Admin può forzare il rilascio di qualsiasi lock (override manuale)
  - Testing (iteration_6.json): backend 14/14 ✓, frontend 100% ✓ — validato con admin + lock_tester in due context browser differenti

### ✅ Completato in precedenti sessioni (21 Feb 2026)

- **Sezioni Custom sempre prima della sezione Note** in CreateClienteModal, EditClienteModal e ViewClienteModal
- **Riorganizzazione campi Indirizzo Cliente in due blocchi distinti**
  - Bloc 1 "Indirizzo Residenza": indirizzo, comune_residenza, provincia, cap
  - Bloc 2 "Indirizzo Attivazione": indirizzo_attivazione, comune_attivazione, provincia_attivazione, cap_attivazione
  - `CreateClienteModal`, `EditClienteModal` e `ViewClienteModal` ora mostrano la stessa struttura con UI coerente (residenza in grigio slate, attivazione in amber)
  - `ViewClienteModal`: blocco "📍 Indirizzo Attivazione / Installazione" visibile solo se almeno uno dei 4 campi attivazione è compilato, mostra tutti e 4 i campi valorizzati
  - Backend: `Cliente`, `ClienteCreate`, `ClienteUpdate` aggiornati con `provincia_attivazione` e `cap_attivazione` (Optional[str])
  - `PROVINCE_ITALIANE` spostato a livello modulo in App.js per accessibilità da tutti i componenti
  - Testing: iteration_5.json — backend 3/3 ✓, frontend 100% ✓ (8 data-testid verificati, salvataggio PUT 200)

### ✅ Completato in precedenti sessioni (20 Aprile 2026)

- **Custom Fields inclusi nell'Export Excel Clienti**
  - Sia `GET /api/clienti/export/excel` sia `GET /api/analytics/pivot/export-clienti` ora aggiungono automaticamente colonne dinamiche `[Custom] {label}` per ogni custom field attivo definito in `cliente_custom_fields`
  - Dedup per `name` (se lo stesso logical field è stato creato per più combinazioni commessa+tipologia, appare una sola colonna con la label della prima trovata)
  - Formattazione: `list` → join con virgola, `bool` → "Sì/No"
  - Test: campo custom "Tipologia d'uso" → 62 colonne totali nell'export, ultima colonna correttamente popolata con valore salvato in `cliente.dati_aggiuntivi`
  - File: `/app/backend/server.py` (funzione `create_clienti_excel_report` + endpoint pivot)

- **Pulizia campi sezione Energia Clienti**
  - POD non più obbligatorio (rimossa validazione in handleSubmit, tolto `*` e messaggio rosso)
  - Aggiunta opzione **"Nuovo Allaccio"** nel dropdown Tipologia Energia (Create + Edit modal)
  - Rimossi campi **Codice PDR** e **REMI** dal form (Create + Edit) — backend models invariati per preservare dati storici
  - File: `/app/frontend/src/App.js` (CreateClienteModal + EditClienteModal)

- **Filtro Tipologie per Commessa nei 3 Dialog e Filtro principale**
  - Prima: i dropdown tipologia mostravano tutte le 39 tipologie indipendentemente dalla commessa scelta.
  - Ora: in **Filtro principale**, **Dialog Nuovo Campo**, **Dialog Nuova Sezione**, **Dialog Nuovo Status** — dopo aver selezionato la commessa, il dropdown tipologia mostra solo le tipologie associate a quella commessa (tramite `GET /api/tipologie-contratto?commessa_id=X`).
  - In modalità create: se si cambia la commessa dopo aver selezionato una tipologia non compatibile, la tipologia viene resettata automaticamente.
  - File: `/app/frontend/src/components/ClienteCustomFieldsManager.jsx` (nuovo helper `fetchTipologieForCommessa` + 4 state list + 4 useEffect)

- **Campi Personalizzati Clienti — FASE 3 (Status Personalizzati con mappatura Analytics)**
  - **Backend**: nuovo enum `StatusStage` (nuovo / in_lavorazione / chiuso_vinto / chiuso_perso). Modello `ClienteCustomStatus` con (name, value auto-normalizzato, color, icon, stage, order, active). CRUD su `/api/cliente-custom-statuses` (admin only). `Cliente.status` convertito da `ClienteStatus` enum a `str` per accettare valori custom. Endpoint `/api/cliente-status-options?commessa_id=X&tipologia_contratto_id=Y` ritorna lista combinata (14 standard + custom). Endpoint `/api/analytics/cliente-statuses-breakdown` aggrega clienti per status e per stage (funnel).
  - **Frontend**: terzo Tab "Status" in `ClienteCustomFieldsManager.jsx` con Dialog create/edit (icon/color/stage), lista status con badge colore+stage. Widget "Imbuto Status Cliente" mostra 4 tiles per stage con % del totale + dettaglio per singolo status. `EditClienteModal` usa nuovo hook `useClienteStatusOptions` per popolare dropdown status dinamicamente (standard + custom per commessa+tipologia del cliente, con `⭐` sui custom).
  - **Test**: testing agent v3 — **100% backend** (20/20), **100% frontend**. Nessun issue.

- **Campi Personalizzati Clienti — FASE 2 (Sezioni personalizzabili)**
  - **Backend**: modelli `ClienteCustomSection` / `ClienteCustomSectionCreate` / `ClienteCustomSectionUpdate` + CRUD admin su `/api/cliente-custom-sections`. Campo `section_id` opzionale aggiunto a `ClienteCustomField`. Quando una sezione viene eliminata, i campi assegnati vengono automaticamente spostati al gruppo default (section_id impostato a null). Fix PUT endpoint per permettere `section_id=null` (usa `exclude_unset`).
  - **Frontend admin** (`ClienteCustomFieldsManager.jsx` riscritto con Tabs):
    - Tab "Campi" e Tab "Sezioni" affiancate
    - Dialog create/edit sezione con campi: nome, icona (emoji), ordine, attiva
    - Dialog create/edit campo ora include dropdown "Sezione di destinazione" (filtrato per commessa+tipologia)
    - Campi nella lista mostrano badge "📁 {nome sezione}"
  - **Rendering nei 3 modali Cliente** (`CustomFieldsRenderer.jsx`):
    - `useClienteCustomFields` ora ritorna anche `sections`
    - `groupFieldsBySection()` raggruppa i campi per sezione in ordine di `order`
    - Ogni gruppo renderizza con header "{icon} {name}" (indigo) o "📝 Campi Aggiuntivi" (amber) per il gruppo default
  - **Test**: testing agent v3 — Backend 100% (13/13), Frontend 100%. Fix applicato per issue minor su PUT+section_id=null.

  - **Campi Personalizzati Clienti — FASE 1 (configurabili per Commessa + Tipologia Contratto)**
  - **Backend**: modelli `ClienteCustomField` / `ClienteCustomFieldCreate` / `ClienteCustomFieldUpdate` (`/app/backend/server.py` linee 556-600) + CRUD admin-only su `/api/cliente-custom-fields` (linee ~6313-6423). Validazione 9 field_type (text, textarea, number, date, email, phone, select, multi_select, checkbox). Duplicati (name+commessa+tipologia) respinti. Nome normalizzato (lowercase + replace non-alphanum con `_`).
  - **Frontend**: nuova pagina admin in sidebar "Campi Clienti" → componente `/app/frontend/src/components/ClienteCustomFieldsManager.jsx` (CRUD UI con filtri, dialog create/edit, delete con conferma)
  - **Rendering dinamico**: hook `useClienteCustomFields(commessa, tipologia)` + componenti `CustomFieldsSection` (form) e `CustomFieldsViewSection` (readonly) in `/app/frontend/src/components/CustomFieldsRenderer.jsx`
  - **Integrazione nei modali** Cliente (`/app/frontend/src/App.js`):
    - **CreateClienteModal**: sezione "Campi Aggiuntivi" dinamica, salvataggio in `dati_aggiuntivi`, validazione campi obbligatori
    - **EditClienteModal**: stessa sezione, valori precompilati, salvataggio e validazione
    - **ViewClienteModal**: sezione readonly
  - **Test**: testing agent v3 — Backend 100% (16/16), Frontend 95% (admin UI + Edit verificati, Create non testabile via automazione per la complessità del cascading)

- **Riorganizzazione View Cliente (Anagrafica + Indirizzo + Contatti)** — fix campi errati (`provincia_residenza` → `provincia`, `numero_civico`/`comune`/`cellulare` inesistenti → rimossi/sostituiti), nuove sezioni logiche
- **Nuovo campo "Comune di Installazione" (`comune_attivazione`)** — aggiunto a modelli backend + Create/Edit/View Cliente, raggruppato con "Indirizzo Attivazione" in sub-block ambra
- **Nuovo campo "Indirizzo Attivazione" (`indirizzo_attivazione`)** — aggiunto a modelli backend + Create/Edit/View Cliente
- **Label "Telefono" rinominato in "Cellulare"** nei modali Create/Edit/View (campo DB `telefono` invariato)
- **Copia anagrafica esistente**: estesa a tutti i campi (anagrafica completa + contatti + pagamento + documento). Mantenuti esclusi: contract-specific fields, note, file upload.

### ✅ Completato in questa sessione (17 Febbraio 2026)
- **Copia Anagrafica Esistente nel Modale Crea Cliente**: Implementata la funzionalità di pre-compilazione del form cliente partendo da un cliente esistente.
  - UI: box ambra "Copia da anagrafica esistente" all'inizio della scheda cliente (dopo completamento filiera cascading)
  - Ricerca debounced (300ms) con minimo 2 caratteri su `GET /api/clienti?search=X&page_size=10`
  - Copia SOLO anagrafica base: `nome`, `cognome`, `ragione_sociale`, `indirizzo`, `comune_residenza`, `provincia`, `cap`
  - ESCLUSI: codice_fiscale, partita_iva, telefono, email, documenti, IBAN, campi contratto, note
  - `window.confirm` prima della sovrascrittura se campi già compilati
  - File modificato: `/app/frontend/src/App.js` (CreateClienteModal, ~linee 22505-22600 e ~23968-24070)
  - Test: testing agent v3 frontend — 100% passed (tutti gli step validati: login, cascading, ricerca, copia, esclusioni, conferma sovrascrittura, toast)
  - Fix collaterale: `response.data.items` → `response.data.clienti` per allineamento con ClientiPaginatedResponse del backend

### ✅ Completato in sessioni precedenti (13 Febbraio 2026)
- **Verifica Notifiche Email Super Referente**: Confermato che la logica per le notifiche email ai Super Referenti per lead stagnanti (>7 giorni con stato "Lead Interessato") è completa e funzionante. Il sistema:
  - Controlla ogni ora i lead non lavorati
  - A 3+ giorni: notifica all'Agente
  - A 7+ giorni: notifica all'Agente + Referente + Super Referente (se esiste)
  - Endpoint admin manuale: `POST /api/admin/send-lead-reminders`
- **Nota**: Le email non vengono inviate per problemi di blacklist IP su Aruba SMTP (problema infrastrutturale, non del codice)

### ✅ Completato in sessioni precedenti
- **Fix Email Notifica Lead**: Corretto errore `uuid4()` → `uuid.uuid4()` che bloccava le notifiche
- Sistema email SMTP Aruba funzionante
- **Cestino Lead**: Implementato soft delete, ripristino e eliminazione definitiva per i lead (solo Admin)
- **Ruolo Supervisor**: Nuovo ruolo con gestione multi-unità, analytics dedicati, export lead
- **Assegnazione Lead Avanzata**: Assegnazione diretta al referente per unità con auto-assign disabilitato
- **Stati Lead per Unità**: Supporto stati globali e specifici per unità
- **Permessi Aggiornati**: Agenti/Referenti possono modificare stati lead; Store_assist/Promoter_presidi bloccati da eliminazione clienti
- **Export Excel migliorato**: Mostra nomi invece di ID per Commessa, Unit, Segmento
- Display "Note Backoffice" nel modal cliente
- Responsività mobile per Clienti, Lead, Users, Commesse, Sub-Agency
- Pulsanti "Chiudi" espliciti su tutti i modali
- Export clienti da Pivot Analytics con filtri
- Logica upload documenti (fail se salvataggio esterno fallisce)
- Export Excel con nomi segmento invece di ID
- Paginazione server-side per lista Lead
- Logica avanzata assegnazione lead (cap 30 lead non lavorati per agente)
- Sistema notifiche email completo (assegnazione + reminder 3/7 giorni + CC manager)
- Cestino Clienti (soft delete + restore) - Backend completato

### 🔄 In Verifica
- Sistema email notifiche lead (utente deve testare flusso completo)

### 📋 Backlog (P2-P3)
- **P2**: Refactoring critico file monolitici:
  - `frontend/src/App.js` (~25,000 linee)
  - `backend/server.py` (~15,000 linee)
- **P3**: Feature modifica "preventivo" (in attesa chiarimenti utente)

## Architettura Tecnica

### Stack
- **Frontend**: React + Shadcn/UI
- **Backend**: FastAPI + Motor (MongoDB async)
- **Database**: MongoDB
- **WhatsApp**: whatsapp-web.js (Node.js service)
- **Email**: SMTP Aruba (smtps.aruba.it:465)
- **Background Jobs**: APScheduler

### File Principali
- `/app/backend/server.py` - API monolitico
- `/app/frontend/src/App.js` - Frontend monolitico
- `/app/backend/.env` - Credenziali SMTP e DB

### Credenziali
- Admin: `admin` / `admin123`
- SMTP: `comunicazioni@nureal.it` / `Nureal2026!!`

## API Chiave
- `POST /api/admin/test-email` - Test configurazione email
- `PUT /api/leads/{id}` - Trigger assegnazione su cambio stato "Lead Interessato"
- `DELETE /api/clienti/{id}` - Soft delete cliente
- `POST /api/clienti/{id}/restore` - Ripristino cliente
- `GET /api/clienti/cestino` - Lista clienti eliminati
