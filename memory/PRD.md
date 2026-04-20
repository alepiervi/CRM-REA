# CRM Nureal - Product Requirements Document

## Original Problem Statement
Sistema CRM completo per gestione clienti, lead, agenti e workflow automatizzati con integrazione WhatsApp e notifiche email.

## Current State (Febbraio 2026)

### ✅ Completato in questa sessione (20 Aprile 2026)

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
