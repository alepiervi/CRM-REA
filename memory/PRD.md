# CRM Nureal - Product Requirements Document

## Original Problem Statement
Sistema CRM completo per gestione clienti, lead, agenti e workflow automatizzati con integrazione WhatsApp e notifiche email.

## Current State (Febbraio 2026)

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
