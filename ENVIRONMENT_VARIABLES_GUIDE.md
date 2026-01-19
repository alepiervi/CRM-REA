# 📋 GUIDA ENVIRONMENT VARIABLES

## Frontend Variables (.env)

### REACT_APP_BACKEND_URL
```bash
REACT_APP_BACKEND_URL=https://agentify-6.preview.emergentagent.com
```

**Cosa Fa**:
- URL del backend API da usare
- Viene letto da `process.env.REACT_APP_BACKEND_URL` nel codice

**Quando Viene Usato**:
- Come **fallback** se la logica auto-detection non funziona
- Principalmente per **development/test**

**Nota Importante**:
- ⚠️ **NON viene usato in produzione se App.js ha auto-detection**
- Il codice in `App.js` usa `window.location.hostname` per decidere:
  - `nureal.it` → `https://mobil-analytics-1.emergent.host` (produzione)
  - `preview.emergentagent.com` → `https://agentify-6.preview.emergentagent.com` (preview)
  - `localhost` → `http://localhost:8001` (development)

**Valore Raccomandato**:
```bash
# Per preview/development
REACT_APP_BACKEND_URL=https://agentify-6.preview.emergentagent.com
```

---

### WDS_SOCKET_PORT
```bash
WDS_SOCKET_PORT=443
```

**Cosa Fa**:
- Configura la **porta WebSocket** per webpack-dev-server
- Usata per **hot-reload** durante sviluppo
- Permette al browser di connettersi al dev server via WebSocket

**Perché 443**:
- In produzione Emergent usa **HTTPS** (porta 443)
- WebSocket deve usare stessa porta (WSS su 443)
- Evita errori tipo: `wss://....:NaN/ws`

**Quando Viene Usato**:
- Durante **development** con `yarn start`
- Durante **preview** su Emergent
- **NON** usato nel bundle production (build statico)

**Problemi se Mancante/Sbagliato**:
```
❌ ERROR: Failed to construct 'WebSocket': URL 'wss://...:NaN/ws' is invalid
```

**Valore Sempre**:
```bash
WDS_SOCKET_PORT=443
```

---

### REACT_APP_ENABLE_VISUAL_EDITS
```bash
REACT_APP_ENABLE_VISUAL_EDITS=false
```

**Cosa Fa**:
- Feature flag per abilitare/disabilitare **visual editor**
- Potrebbe essere usata per drag-and-drop UI builder
- Feature avanzata per modificare UI senza codice

**Valori Possibili**:
- `true` → Abilita visual editor (se implementato)
- `false` → Disabilita visual editor (default)

**Stato Attuale**:
- ⚠️ Feature **NON implementata** nel codice attuale
- Variabile presente ma **non usata**
- Può essere rimossa o lasciata per future features

**Raccomandazione**:
```bash
# Lascia false o rimuovi completamente
REACT_APP_ENABLE_VISUAL_EDITS=false
```

---

## Backend Variables (.env)

### CORS_ORIGINS
```bash
CORS_ORIGINS="https://nureal.it,https://www.nureal.it,https://agentify-6.preview.emergentagent.com"
```

**Cosa Fa**:
- Lista di **origini autorizzate** per richieste CORS
- Permette al frontend (browser) di fare chiamate API
- Protegge da richieste non autorizzate

**Formato**:
- Separati da virgola (`,`)
- URL completi con protocollo (`https://`)
- NO spazi tra URL
- NO slash finale (`/`)

**Domini da Includere**:
```bash
# Produzione
https://nureal.it
https://www.nureal.it

# Preview/Test
https://agentify-6.preview.emergentagent.com

# Development (opzionale)
http://localhost:3000
```

**Come Funziona nel Codice**:
```python
# server.py - CORS middleware
cors_origins = os.environ.get("CORS_ORIGINS", "").split(",")

# Se vuoto, usa "*" (tutti)
if not cors_origins or cors_origins == [""]:
    cors_origins = ["*"]

# Aggiungi domini production
production_domains = [
    "https://nureal.it",
    "https://www.nureal.it",
    # ...
]
```

**Problemi se Mancante/Sbagliato**:
```
❌ Access to XMLHttpRequest blocked by CORS policy:
   No 'Access-Control-Allow-Origin' header present
```

**Valore Corretto Attuale**:
```bash
CORS_ORIGINS="https://nureal.it,https://www.nureal.it,https://agentify-6.preview.emergentagent.com"
```

---

### MONGO_URL
```bash
MONGO_URL="mongodb://localhost:27017"
```

**Cosa Fa**:
- URL connessione MongoDB database
- Usato da Motor (async MongoDB driver)

**Formato**:
```bash
mongodb://[username:password@]host:port[/database]
```

**Esempi**:
```bash
# Locale senza auth
MONGO_URL="mongodb://localhost:27017"

# Locale con auth
MONGO_URL="mongodb://admin:password@localhost:27017"

# MongoDB Atlas
MONGO_URL="mongodb+srv://user:pass@cluster.mongodb.net"

# Docker/Kubernetes
MONGO_URL="mongodb://mongodb-service:27017"
```

**Produzione**:
- Emergent configura automaticamente
- Usa servizio MongoDB interno
- Non modificare a meno che necessario

---

### DB_NAME
```bash
DB_NAME="crm_database"
```

**Cosa Fa**:
- Nome del database MongoDB da usare
- Isola dati tra ambienti

**Valori Raccomandati**:
```bash
# Preview
DB_NAME="crm_database"

# Produzione
DB_NAME="mobil-analytics-1-crm_database"
```

**Perché Diversi**:
- Preview e produzione usano **DB separati**
- Test non influenzano dati produzione
- Sicurezza e isolamento

---

### EMERGENT_LLM_KEY
```bash
EMERGENT_LLM_KEY="sk-emergent-6C5B3D385B6Bb82DeC"
```

**Cosa Fa**:
- Chiave universale Emergent per AI models
- Funziona con: OpenAI, Anthropic, Google AI
- Nessun setup API keys separati necessario

**Quando Usare**:
- Per features AI nel CRM
- Chat AI, summaries, analysis
- Image generation (OpenAI)

**Vantaggi**:
- Una sola chiave per tutti i provider
- Billing unificato Emergent
- Nessuna gestione keys separata

**Sicurezza**:
- ⚠️ NON commitare nel repository
- Usa environment variables deployment
- Rotate periodicamente

---

### PLAYWRIGHT_BROWSERS_PATH
```bash
PLAYWRIGHT_BROWSERS_PATH="/pw-browsers"
```

**Cosa Fa**:
- Directory dove Playwright installa browsers (Chromium)
- Usata per upload documenti Aruba Drive

**Perché Necessaria**:
- Chromium (~175MB) installato una volta
- Riutilizzato per tutti gli upload
- Evita reinstallazione ogni deploy

**Valore Standard**:
```bash
PLAYWRIGHT_BROWSERS_PATH="/pw-browsers"
```

**NON modificare** a meno che problemi spazio disco

---

## 🎯 CONFIGURAZIONE CORRETTA ATTUALE

### Frontend .env (Preview/Development)
```bash
REACT_APP_BACKEND_URL=https://agentify-6.preview.emergentagent.com
WDS_SOCKET_PORT=443
REACT_APP_ENABLE_VISUAL_EDITS=false
```

### Backend .env (Preview/Development)
```bash
MONGO_URL="mongodb://localhost:27017"
DB_NAME="crm_database"
CORS_ORIGINS="https://nureal.it,https://www.nureal.it,https://agentify-6.preview.emergentagent.com"
SECRET_KEY="crm-secret-key-change-in-production"
EMERGENT_LLM_KEY="sk-emergent-6C5B3D385B6Bb82DeC"
REDIS_URL="redis://localhost:6379"
PLAYWRIGHT_BROWSERS_PATH="/pw-browsers"
```

---

## 📋 DEPLOYMENT PRODUCTION

### Frontend Production (nureal.it)

**Environment Variables da Configurare su Emergent**:
```bash
# Opzionale - il codice usa auto-detection
REACT_APP_BACKEND_URL=https://mobil-analytics-1.emergent.host

# Obbligatorio
WDS_SOCKET_PORT=443

# Opzionale
REACT_APP_ENABLE_VISUAL_EDITS=false
```

### Backend Production (mobil-analytics-1)

**Environment Variables da Configurare su Emergent**:
```bash
# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=mobil-analytics-1-crm_database

# CORS - CRITICO!
CORS_ORIGINS=https://nureal.it,https://www.nureal.it

# Security
SECRET_KEY=[GENERA CHIAVE RANDOM SICURA]

# AI
EMERGENT_LLM_KEY=sk-emergent-6C5B3D385B6Bb82DeC

# Services
REDIS_URL=redis://localhost:6379
PLAYWRIGHT_BROWSERS_PATH=/pw-browsers
```

---

## 🔧 TROUBLESHOOTING

### CORS Error
```
ERROR: No 'Access-Control-Allow-Origin' header
```

**Soluzione**:
1. Verifica `CORS_ORIGINS` nel backend
2. Deve includere `https://nureal.it`
3. Nessuno spazio tra URL
4. Redeploy backend

### WebSocket NaN Error
```
ERROR: Failed to construct 'WebSocket': URL 'wss://...:NaN/ws'
```

**Soluzione**:
1. Aggiungi `WDS_SOCKET_PORT=443` in frontend .env
2. Rebuild frontend
3. Deploy

### Backend URL Sbagliato
```
Console: Backend URL: https://wrong-url.com
```

**Soluzione**:
1. Verifica `App.js` auto-detection logic
2. Check `window.location.hostname`
3. Rebuild con codice corretto

### Database Connessione Fallita
```
ERROR: Could not connect to MongoDB
```

**Soluzione**:
1. Verifica `MONGO_URL` corretto
2. Check servizio MongoDB running
3. Verifica `DB_NAME` esiste
4. Test connessione: `mongosh $MONGO_URL`

---

## 📝 BEST PRACTICES

### 1. Secrets Management
```bash
# ❌ MAI fare questo
git commit .env

# ✅ Usa invece
# .env in .gitignore
# Configure su Emergent deployment
```

### 2. Environment Separation
```bash
# Preview
DB_NAME=crm_database

# Production
DB_NAME=mobil-analytics-1-crm_database

# Mai mescolare!
```

### 3. CORS Specifici
```bash
# ❌ Evita in produzione
CORS_ORIGINS=*

# ✅ Usa domini specifici
CORS_ORIGINS=https://nureal.it,https://www.nureal.it
```

### 4. Keys Rotation
```bash
# Cambia periodicamente:
# - SECRET_KEY
# - EMERGENT_LLM_KEY (se possibile)
# - Database passwords
```

---

**Data**: 23 Ottobre 2024
**Versione**: 1.0
**Status**: DOCUMENTAZIONE COMPLETA ✅
