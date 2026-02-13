# 🚨 DEPLOY BACKEND PRODUZIONE URGENTE - CORS Fix

## ✅ ROOT CAUSE IDENTIFICATO

**Problema Confermato**:
- Backend produzione `mobil-analytics-1.emergent.host` ha **CODICE VECCHIO**
- NON ha CORS middleware aggiornato
- NON gestisce OPTIONS preflight requests
- Risultato: CORS errors da nureal.it

**Proof**:
```
Local Backend (aggiornato):
✅ CORS funziona
✅ OPTIONS requests gestiti
✅ Headers Access-Control-Allow-Origin presenti

Production Backend (vecchio):
❌ CORS non configurato
❌ OPTIONS returns 405
❌ No Access-Control-Allow-Origin header
```

## 🚀 SOLUZIONE: Deploy Backend Produzione

### STEP 1: Verifica Codice Pronto

Il codice nel repository è **già aggiornato e pronto**:

**Backend CORS Configuration** (già nel codice):
```python
# File: /app/backend/server.py (lines 11188-11217)

# CORS Configuration
cors_origins_env = os.environ.get("CORS_ORIGINS", "").split(",")
cors_origins_env = [origin.strip() for origin in cors_origins_env if origin.strip()]

if not cors_origins_env:
    cors_origins = ["*"]
else:
    cors_origins = cors_origins_env

# Always include production domains
production_domains = [
    "https://nureal.it",
    "https://www.nureal.it",
    "https://mobil-analytics-1.emergent.host",
    "https://referente-oversight.preview.emergentagent.com",
]

for domain in production_domains:
    if domain not in cors_origins:
        cors_origins.append(domain)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)
```

✅ Questo codice gestisce:
- CORS per nureal.it
- OPTIONS preflight requests
- Tutti HTTP methods necessari

### STEP 2: Configura Environment Variables su Emergent

**Su Emergent Dashboard → Deployment `mobil-analytics-1`**:

**Environment Variables da configurare/verificare**:

```bash
# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=mobil-analytics-1-crm_database

# CORS - CRITICO! ⭐
CORS_ORIGINS=https://nureal.it,https://www.nureal.it

# Security
SECRET_KEY=crm-secret-key-change-in-production-RANDOM

# Emergent LLM
EMERGENT_LLM_KEY=sk-emergent-6C5B3D385B6Bb82DeC

# Redis
REDIS_URL=redis://localhost:6379

# Playwright
PLAYWRIGHT_BROWSERS_PATH=/pw-browsers
```

**⚠️ IMPORTANTE**:
- `CORS_ORIGINS` deve contenere `https://nureal.it`
- Nessuno spazio tra URL
- NO slash finale
- Separati da virgola

### STEP 3: Deploy Backend Produzione

**Su Emergent Dashboard**:

1. **Vai a Deployment** `mobil-analytics-1`

2. **Verifica Source Code**:
   - Repository collegato correttamente
   - Branch: main (o branch corrente)
   - Path: `/app/backend`

3. **Click "Deploy Now"**

4. **Aspetta Completamento** (15-20 minuti):
   - Install dependencies
   - Install Playwright browsers (~175MB)
   - Start backend
   - Health checks pass

5. **Verifica Logs Deploy**:
   ```
   ✅ Installing Python dependencies...
   ✅ Installing Playwright...
   ✅ Backend starting...
   ✅ 🌐 CORS Origins configured: ['https://nureal.it', ...]
   ✅ Application startup complete
   ```

   **⚠️ Log Critico da Cercare**:
   ```
   🌐 CORS Origins configured: [...]
   ```
   Se NON vedi questo → CORS non configurato!

### STEP 4: Verifica Post-Deploy

#### Test 1: Health Endpoint

```bash
curl https://mobil-analytics-1.emergent.host/api/health

# Response attesa:
{"status":"ok","service":"nureal-crm-backend","timestamp":"..."}
```

#### Test 2: CORS OPTIONS Preflight

```bash
curl -I -X OPTIONS https://mobil-analytics-1.emergent.host/api/documents/upload \
  -H "Origin: https://nureal.it" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"

# Headers attesi nella response:
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://nureal.it
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
Access-Control-Allow-Headers: *
Access-Control-Allow-Credentials: true
```

**Se vedi questi headers → CORS funziona! ✅**

#### Test 3: Upload da nureal.it

**Browser su https://nureal.it**:

1. **Hard reload**: Ctrl + Shift + R
2. **Login**: admin / admin123
3. **Clienti** → Cliente con Aruba Drive
4. **Upload documento PDF**
5. **Console (F12) NON deve mostrare**:
   ```
   ❌ CORS policy error
   ```
6. **Upload deve completare**:
   ```
   ✅ Documento caricato con successo
   ```

### STEP 5: Monitor First Upload (Chromium Install)

**Primo upload dopo deploy**:
- Tempo: 2-3 minuti (installa Chromium)
- Logs backend mostrano:
  ```
  📥 Downloading Chromium browser...
  ✅ Chromium installed successfully
  ✅ Document uploaded to Aruba Drive
  ```

**Upload successivi**:
- Tempo: 10-15 secondi (Chromium già installato)
- Upload diretto su Aruba Drive

## 🔧 TROUBLESHOOTING POST-DEPLOY

### Problema: CORS Error Persiste

**Causa**: Environment variables non salvate o deployment non completato

**Soluzione**:
```
1. Emergent → mobil-analytics-1 → Environment Variables
2. Verifica CORS_ORIGINS presente e corretto
3. Click Save
4. Redeploy (se necessario)
5. Aspetta completamento
6. Hard reload browser (Ctrl + Shift + R)
7. Test upload
```

### Problema: 405 Method Not Allowed Persiste

**Causa**: Deployment fallito o codice non aggiornato

**Verifica**:
```bash
# Test OPTIONS endpoint
curl -I -X OPTIONS https://mobil-analytics-1.emergent.host/api/documents/upload

# Se ritorna 405 → Codice vecchio ancora in produzione
# Se ritorna 200 → Codice nuovo deployato ✅
```

**Soluzione**:
```
1. Verifica deployment completato con successo
2. Check logs deploy per errori
3. Se necessario, redeploy
4. Contatta supporto Emergent se problemi persistono
```

### Problema: Upload Veloce (<2s) = Local Storage

**Causa**: Chromium non installato in produzione

**Soluzione**:
```
1. Primo upload installa Chromium automaticamente
2. Aspetta 2-3 minuti primo upload
3. Upload successivi veloci (10-15s)
4. Verifica GET /api/documents/upload-debug mostra:
   "✅ Chromium already installed"
```

### Problema: Backend va in Standby

**Causa**: Always on non configurato

**Soluzione**:
```
1. Setup UptimeRobot:
   - URL: https://mobil-analytics-1.emergent.host/api/health
   - Interval: 5 minutes
   
2. Contatta supporto Emergent:
   - Discord: https://discord.gg/VzKfwCXC4A
   - Richiedi always on per mobil-analytics-1
```

## 📋 CHECKLIST DEPLOY

### Pre-Deploy:

- [x] Codice backend aggiornato nel repository
- [x] CORS middleware presente in server.py
- [x] Endpoint /api/health implementato
- [x] Environment variables preparate

### Durante Deploy:

- [ ] Environment variables configurate su Emergent
- [ ] CORS_ORIGINS include https://nureal.it
- [ ] Deploy avviato
- [ ] Logs monitorati per errori
- [ ] "🌐 CORS Origins configured" presente nei logs

### Post-Deploy:

- [ ] Health endpoint risponde: /api/health
- [ ] OPTIONS preflight test passa
- [ ] CORS headers presenti nella response
- [ ] Test upload da nureal.it funziona
- [ ] Nessun CORS error in console
- [ ] Document uploaded to Aruba Drive

### Final Checks:

- [ ] Upload successivi veloci (10-15s)
- [ ] Chromium installato e funzionante
- [ ] Debug logs mostrano Playwright success
- [ ] UptimeRobot configurato per keep-alive
- [ ] Monitoring attivo

## 🎉 STATO FINALE ATTESO

**Dopo Deploy Completato**:

```
Backend Produzione (mobil-analytics-1):
✅ Codice aggiornato con CORS
✅ CORS_ORIGINS configurato
✅ OPTIONS requests gestiti
✅ Upload endpoint funzionante
✅ Chromium installato
✅ Always on configurato (o UptimeRobot)

Frontend Produzione (nureal.it):
✅ Usa backend produzione
✅ CORS funzionante
✅ Nessun error in console
✅ Upload documenti su Aruba Drive
✅ Tutte features operative

User Experience:
✅ Login immediato
✅ Upload documenti 10-15s
✅ Nessun CORS error
✅ App completamente funzionale
✅ Mobile-friendly
```

## 📞 SUPPORTO

**Se Deploy Fallisce o Problemi Persistono**:

**Discord Emergent** (Risposta veloce):
- URL: https://discord.gg/VzKfwCXC4A
- Canale: #support
- Messaggio:
  ```
  Ciao team,
  
  Ho deployato backend su mobil-analytics-1 ma CORS non funziona.
  
  Deployment: mobil-analytics-1
  Problema: CORS error da nureal.it su /api/documents/upload
  Environment vars: CORS_ORIGINS configurato
  
  Logs deploy: [copia ultimi 50 righe]
  
  Test OPTIONS: [risultato curl]
  
  Serve aiuto per verificare deployment corretto.
  Grazie!
  ```

**Email**:
- support@emergent.sh
- Oggetto: "Backend Deploy CORS Issue - mobil-analytics-1"
- [Stesso messaggio Discord]

---

**Data**: 23 Ottobre 2024
**Urgenza**: CRITICA
**Problema**: Backend produzione codice vecchio
**Soluzione**: Deploy backend con CORS fix
**Status**: DEPLOY RICHIESTO SU EMERGENT
