# CRM Nureal - Product Requirements Document

## Original Problem Statement
Sistema CRM completo per gestione clienti, lead, agenti e workflow automatizzati con integrazione WhatsApp e notifiche email.

## Current State (Dicembre 2025)

### ✅ Completato in questa sessione (Fork attuale)
- **Fix Pivot Analytics Segmenti**: Corretto bug che mostrava UUID invece dei nomi dei segmenti. La logica ora cerca nella collezione `db.segmenti` invece di cercare dentro `tipologie_contratto`
- **Frontend Build**: Verificato che `yarn build` funziona correttamente (36 secondi, nessun errore)

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
