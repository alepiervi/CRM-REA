# 🏭 DEPLOY BACKEND PRODUZIONE - GUIDA COMPLETA

## ✅ ARCHITETTURA FINALE

```
Frontend Preview                Frontend Produzione
preview.emergentagent.com       https://nureal.it
        ↓                               ↓
        |                               |
Backend Preview                Backend Produzione ⭐
(standby after 30min)          (ALWAYS ON)
nureal-crm.preview...          mobil-analytics-1.emergent.host
        ↓                               ↓
   DB Preview                      DB Produzione
```

**Vantaggi**:
- ✅ Backend produzione sempre attivo (no standby)
- ✅ Backend preview solo per test
- ✅ Databases separati (sicurezza)
- ✅ Produzione affidabile 24/7

## 📋 CODICE AGGIORNATO

### Frontend - URL Dinamico

**File**: `/app/frontend/src/App.js`

```javascript
const getBackendURL = () => {
  const hostname = window.location.hostname;
  
  // Produzione → Backend produzione always on
  if (hostname === 'nureal.it' || hostname === 'www.nureal.it') {
    return 'https://mobil-analytics-1.emergent.host'; // ✅ Always on
  }
  
  // Preview → Backend preview (può andare in standby)
  if (hostname.includes('preview.emergentagent.com')) {
    return 'https://role-manager-19.preview.emergentagent.com';
  }
  
  // Development
  return 'http://localhost:8001';
};
```

✅ **Build fatto** - Pronto per deploy frontend!

## 🎯 DEPLOY BACKEND PRODUZIONE

### PREREQUISITI

**Su Emergent Dashboard**:
1. Trova deployment: `mobil-analytics-1` (backend produzione)
2. Verifica che sia tipo: **"Production"** o **"Always On"**
3. Verifica URL: `mobil-analytics-1.emergent.host`

### STEP 1: Configura Environment Variables Backend

**Nel deployment `mobil-analytics-1`, configura**:

#### Variables Critiche:

```bash
# Database (produzione)
MONGO_URL=mongodb://localhost:27017
DB_NAME=mobil-analytics-1-crm_database

# CORS - CRITICO!
CORS_ORIGINS=https://nureal.it,https://www.nureal.it

# Security
SECRET_KEY=crm-secret-key-change-in-production-RANDOM123

# Emergent LLM
EMERGENT_LLM_KEY=sk-emergent-6C5B3D385B6Bb82DeC

# Redis
REDIS_URL=redis://localhost:6379

# Playwright
PLAYWRIGHT_BROWSERS_PATH=/pw-browsers
```

#### Variables Opzionali (se usi questi servizi):

```bash
# Twilio (se usi call center)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_API_KEY_SID=
TWILIO_API_KEY_SECRET=
DEFAULT_CALLER_ID=
WEBHOOK_BASE_URL=https://mobil-analytics-1.emergent.host

# WhatsApp (se usi)
WHATSAPP_API_KEY=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=whatsapp_webhook_token_2024

# Aruba Drive (credenziali globali opzionali)
ARUBA_DRIVE_USERNAME=
ARUBA_DRIVE_PASSWORD=
```

### STEP 2: Deploy Backend

**Su Emergent Dashboard**:

1. **Vai a deployment** `mobil-analytics-1`

2. **Verifica che codice sia aggiornato**:
   - Deployment deve puntare al repository corretto
   - Branch: main (o branch corrente)
   - Path: `/app/backend`

3. **Click "Deploy Now"**

4. **Aspetta completamento** (15-20 minuti):
   - Build backend
   - Install dependencies (requirements.txt)
   - **Installa Chromium automaticamente** (prima volta)
   - Start servizi

### STEP 3: Verifica Post-Deploy Backend

**Controlli Automatici**:

Durante il deploy, verifica logs per:
```
✅ Installing Python dependencies...
✅ Installing Playwright browsers...
✅ Chromium downloaded successfully
✅ Backend starting on port 8001...
✅ Connected to MongoDB
✅ CORS configured for: https://nureal.it
✅ Backend ready!
```

**Test Endpoint Health**:
```bash
curl https://mobil-analytics-1.emergent.host/api/health

# Dovrebbe rispondere:
{"status": "ok"}
```

### STEP 4: Deploy Frontend Produzione

**Su Emergent Dashboard**:

1. **Vai a deployment** `nureal.it` (frontend)

2. **Environment Variables Frontend**:
   ```bash
   # IMPORTANTE: NON serve REACT_APP_BACKEND_URL
   # Il codice usa auto-detection basato su hostname
   
   # Solo questa:
   WDS_SOCKET_PORT=443
   ```

3. **Click "Deploy Now"**

4. **Aspetta completamento** (10-15 minuti)

### STEP 5: Seed Database Produzione

**Se database produzione è vuoto**:

**Opzione A: SSH nel Backend Deployment**:
```bash
# Se Emergent permette SSH
cd /app/backend
python3 seed_database.py

# Crea admin user:
# Username: admin
# Password: admin123
```

**Opzione B: Usa API da Preview**:
```bash
# Login preview come admin
# Vai su preview environment
# Crea:
# - Commesse (Fastweb con Aruba Drive config)
# - Servizi
# - Sub-agenzie
# - Utenti

# Il database produzione sarà separato
# Ricrea manualmente o importa dump
```

**Opzione C: MongoDB Compass**:
```bash
# Connetti a MongoDB produzione
# Import dump da preview (se necessario)
# O crea dati manualmente
```

## 📊 VERIFICA COMPLETA PRODUZIONE

### Test 1: Backend Health

```bash
curl https://mobil-analytics-1.emergent.host/api/health

# Risposta attesa:
{"status": "ok"}
```

### Test 2: CORS Verification

```bash
curl -I -X OPTIONS https://mobil-analytics-1.emergent.host/api/auth/login \
  -H "Origin: https://nureal.it" \
  -H "Access-Control-Request-Method: POST"

# Headers devono includere:
Access-Control-Allow-Origin: https://nureal.it
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

### Test 3: Frontend Produzione

**Browser su https://nureal.it**:

1. **Hard Reload**: Ctrl + Shift + R

2. **Console (F12) deve mostrare**:
   ```
   🏭 Production: Using dedicated production backend (always on)
   🔧 Backend URL: https://mobil-analytics-1.emergent.host
   ```

3. **Login Test**:
   - Username: admin
   - Password: admin123
   - Login deve essere **immediato** (< 2s)
   - Nessun CORS error in console

4. **Network Tab**:
   ```
   Request URL: https://mobil-analytics-1.emergent.host/api/auth/login
   Status: 200 OK
   Time: < 1 second
   ```

### Test 4: Upload Documenti

**Da https://nureal.it**:

1. **Vai su Clienti**
2. **Scegli cliente con commessa Fastweb**
3. **Upload PDF**
4. **Verifica**:
   - Tempo: 10-30 secondi (primo upload installa Chromium)
   - Upload successivi: 10-15 secondi
   - Storage type: "aruba_drive"
   - File su Aruba Drive in `/Fastweb/`

### Test 5: Always On (30 minuti dopo)

**Test critico**:
```
1. Non usare app per 30 minuti
2. Vai su https://nureal.it
3. Login DEVE essere immediato (< 2s)
4. Se lento → backend ha standby (problema!) ❌
5. Se veloce → backend always on ✅
```

## 🔧 TROUBLESHOOTING

### Problema: CORS Error da nureal.it

**Errore Console**:
```
Access to XMLHttpRequest at 'https://mobil-analytics-1.emergent.host'
from origin 'https://nureal.it' has been blocked by CORS policy
```

**Causa**: CORS_ORIGINS non configurato nel backend

**Soluzione**:
```
1. Backend deployment → Environment Variables
2. Aggiungi/Verifica:
   CORS_ORIGINS=https://nureal.it,https://www.nureal.it
3. Redeploy backend
4. Aspetta completamento
5. Hard reload browser
```

### Problema: 500 Internal Server Error

**Causa**: Database non configurato o vuoto

**Soluzione**:
```
1. Verifica DB_NAME nel backend env vars:
   DB_NAME=mobil-analytics-1-crm_database
   
2. Seed database:
   python3 seed_database.py
   
3. Crea admin user manualmente se necessario
```

### Problema: Upload Documenti va in Local Storage

**Causa**: Chromium non installato nel backend produzione

**Soluzione**:

**Opzione A - SSH nel Deployment**:
```bash
cd /app/backend
python3 -m playwright install chromium
sudo supervisorctl restart backend
```

**Opzione B - Primo Upload Installa Auto**:
```
1. Primo upload può richiedere 2-3 minuti
2. Sistema installa Chromium automaticamente
3. Upload successivi veloci (10-15s)
4. Verifica logs per conferma installazione
```

**Opzione C - Deploy Script**:
```
Aggiungi script nel deployment:
post-deploy: python3 -m playwright install chromium
```

### Problema: Frontend Usa Ancora Preview Backend

**Console mostra**:
```
🔧 Backend URL: https://role-manager-19.preview.emergentagent.com
```

**Causa**: Frontend non deployato con nuovo codice

**Soluzione**:
```
1. Verifica che hai fatto deploy frontend DOPO la mia modifica
2. Deploy deve essere fatto DOPO build (fatto 10 min fa)
3. Hard reload browser (Ctrl + Shift + R)
4. Test in Incognito window
5. Se ancora sbagliato → nuovo deploy frontend
```

### Problema: Backend va in Standby dopo 30 min

**Causa**: Deployment non ha "always on" abilitato

**Soluzioni**:

**A. Verifica Plan**:
```
1. Dashboard → mobil-analytics-1 deployment
2. Plan deve essere: Production o Always On
3. Se Free tier → upgrade necessario
```

**B. Enable Always On**:
```
1. Settings → Always On → Enable
2. Redeploy
3. Test dopo 30 min
```

**C. Keep-Alive Service (Workaround)**:
```
UptimeRobot (free):
1. https://uptimerobot.com
2. Monitor: https://mobil-analytics-1.emergent.host/api/health
3. Interval: 5 minutes
4. Fa ping automatico → backend sempre sveglio
```

## 📝 CHECKLIST DEPLOY COMPLETO

### Backend Produzione:

- [ ] Deployment `mobil-analytics-1` identificato
- [ ] Plan: Production/Always On
- [ ] Environment Variables configurate:
  - [ ] MONGO_URL
  - [ ] DB_NAME=mobil-analytics-1-crm_database
  - [ ] CORS_ORIGINS=https://nureal.it,https://www.nureal.it
  - [ ] SECRET_KEY (random)
  - [ ] EMERGENT_LLM_KEY
  - [ ] REDIS_URL
  - [ ] PLAYWRIGHT_BROWSERS_PATH=/pw-browsers
- [ ] Deploy completato
- [ ] Health endpoint risponde: /api/health
- [ ] CORS headers corretti
- [ ] Database seeded (admin user creato)
- [ ] Chromium installato

### Frontend Produzione:

- [ ] Deployment `nureal.it` identificato
- [ ] Codice aggiornato con nuovo getBackendURL
- [ ] Build fatto (10 min fa)
- [ ] Deploy completato
- [ ] Console mostra: mobil-analytics-1.emergent.host
- [ ] Login funziona (< 2s)
- [ ] Nessun CORS error
- [ ] Upload documenti funziona

### Verifica Finale:

- [ ] Test login immediato
- [ ] Test upload documenti (10-15s)
- [ ] Test dopo 30 min inattività (no standby)
- [ ] Nessun errore in console
- [ ] Performance consistente

## 🎯 DATABASE PRODUZIONE

### Opzione 1: Database Separato (Raccomandato)

**Setup**:
```
Backend Preview → DB: crm_database
Backend Produzione → DB: mobil-analytics-1-crm_database

✅ Isolamento completo
✅ Test in preview non influenza produzione
✅ Sicurezza maggiore
```

**Seed Dati Iniziali**:
```bash
# Nel backend produzione
python3 seed_database.py

# Oppure MongoDB Compass:
# 1. Connect a prod DB
# 2. Import/Create:
#    - Admin user
#    - Commesse (Fastweb con Aruba Drive)
#    - Servizi
#    - Sub-agenzie
```

### Opzione 2: Database Condiviso

**Setup**:
```
Backend Preview → DB: crm_database
Backend Produzione → DB: crm_database (stesso!)

⚠️ Preview e produzione condividono dati
⚠️ Test in preview possono creare dati in produzione
```

**Quando Usare**:
- Solo per testing iniziale
- Database non contiene dati sensibili
- Team piccolo, controllo totale

## 🎉 STATO FINALE ATTESO

**Dopo Deploy Completo**:

```
Frontend Produzione (nureal.it):
✅ Usa backend produzione mobil-analytics-1
✅ Login immediato sempre (< 2s)
✅ Upload documenti 10-15s
✅ Nessun CORS error
✅ Nessun standby

Backend Produzione (mobil-analytics-1):
✅ Always on (mai standby)
✅ CORS configurato per nureal.it
✅ Chromium installato
✅ Database produzione isolato
✅ Response < 100ms
✅ Uptime 99.9%

Backend Preview (nureal-crm.preview):
✅ Per testing e sviluppo
✅ Può andare in standby (ok per test)
✅ Database separato (opzionale)
```

## 📞 SUPPORTO

**Se hai problemi con deploy backend produzione**:

**Discord Emergent**:
- https://discord.gg/VzKfwCXC4A
- Chiedi: "Help deploying backend to mobil-analytics-1 always on"

**Email**:
- support@emergent.sh
- Oggetto: "Backend Production Deploy Issue"

**Cosa Chiedere**:
```
Ciao, sto deployando il backend su:
https://mobil-analytics-1.emergent.host

Problema: [descrivi problema specifico]

Deployment ID: [copia da dashboard]
Logs: [copia errori deploy se ci sono]
```

---

**Data**: 22 Ottobre 2024
**Architettura**: Backend Produzione Dedicato Always On
**Status**: CODICE PRONTO - DEPLOY BACKEND SU EMERGENT RICHIESTO
