# CRM Nureal - Product Requirements Document

## Original Problem Statement
Sistema CRM completo per gestione clienti, lead, agenti e workflow automatizzati con integrazione WhatsApp e notifiche email.

## Current State (Dicembre 2025)

### ✅ Completato in questa sessione
- **Fix Email Notifica Lead**: Corretto errore `uuid4()` → `uuid.uuid4()` che bloccava le notifiche
- Sistema email SMTP Aruba funzionante

### ✅ Completato in sessioni precedenti
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
