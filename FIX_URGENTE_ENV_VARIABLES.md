# 🚨 FIX URGENTE - Environment Variables Deployment

## ✅ PROBLEMA IDENTIFICATO

**Root Cause Confermata**:
```
Deployment su Emergent ha environment variables che SOVRASCRIVONO il codice:

❌ REACT_APP_BACKEND_URL = https://mobil-analytics-1.emergent.host
   Questa variabile forza l'uso del vecchio URL, 
   ignorando il codice modificato in App.js
```

**Risultato**:
- Anche con codice aggiornato, il deployment usa vecchio URL
- CORS errors su tutte le chiamate
- 405 errors perché mobil-analytics-1 non ha gli endpoint giusti

## 🚀 SOLUZIONE IMMEDIATA

### Passo 1: Aggiorna Environment Variables su Emergent

**Vai su Emergent Dashboard**:
1. https://app.emergentagent.com
2. Trova deployment per `nureal.it`
3. Click su "Settings" o "Environment Variables"

**Modifica Queste Variabili**:

#### Frontend Variables:

**REACT_APP_BACKEND_URL**:
```
VECCHIO: https://mobil-analytics-1.emergent.host
NUOVO:   https://lead2ai-flow.preview.emergentagent.com
```

#### Backend Variables:

**CORS_ORIGINS**:
```
VALORE: https://nureal.it,https://www.nureal.it,https://lead2ai-flow.preview.emergentagent.com
```

**DB_NAME**:
```
VALORE: mobil-analytics-1-crm_database
(lascia come è)
```

**REDIS_URL**:
```
VALORE: redis://localhost:6379
(lascia come è)
```

### Passo 2: Redeploy

Dopo aver modificato le environment variables:

1. **Click "Redeploy"** o **"Deploy Now"**
2. Aspetta 10-15 minuti per completamento
3. Riceverai notifica quando pronto

### Passo 3: Verifica

**Hard Reload Browser**:
```
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)
```

**Console (F12) deve mostrare**:
```
✅ Backend URL configured: https://lead2ai-flow.preview.emergentagent.com
✅ API endpoint: https://lead2ai-flow.preview.emergentagent.com/api
```

## 📊 CONFIGURAZIONE CORRETTA COMPLETA

### Frontend Environment Variables

```bash
# Deployment nureal.it
REACT_APP_BACKEND_URL=https://lead2ai-flow.preview.emergentagent.com
WDS_SOCKET_PORT=443
```

### Backend Environment Variables

```bash
# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=mobil-analytics-1-crm_database

# CORS - CRITICO!
CORS_ORIGINS=https://nureal.it,https://www.nureal.it,https://lead2ai-flow.preview.emergentagent.com

# Security
SECRET_KEY=crm-secret-key-change-in-production

# Redis
REDIS_URL=redis://localhost:6379

# Emergent LLM
EMERGENT_LLM_KEY=sk-emergent-6C5B3D385B6Bb82DeC

# Playwright
PLAYWRIGHT_BROWSERS_PATH=/pw-browsers
```

## 🎯 PERCHÉ SUCCEDE

### Come Funzionano Environment Variables

```
Build Time:
1. Emergent legge env variables dal deployment
2. Inietta nel bundle JS durante build
3. Sovrascrive qualsiasi valore nel codice

Runtime:
- Il bundle JS usa i valori iniettati
- Non usa .env file del repository
- Non usa valori hardcoded in App.js
```

### Priorità Variabili (Dal più alto al più basso):

```
1. Deployment Env Variables (Emergent Dashboard) ⭐ MASSIMA
2. .env file nel repository
3. Valori hardcoded in codice
```

**Quindi**: Anche se abbiamo modificato App.js, il deployment usa le sue env variables!

## 🔧 TROUBLESHOOTING

### Problema: Modificato Env Variables ma Ancora Errore

**Causa**: Non hai fatto redeploy dopo modifica

**Soluzione**:
```
1. Modifica env variables su Emergent
2. Click "Redeploy" o "Deploy Now"
3. Aspetta completamento
4. Hard reload browser
```

### Problema: Non Trovo Environment Variables su Emergent

**Possibili Locations**:
- Deployment Settings → Environment Variables
- Deployment → Configure → Env Vars
- Project Settings → Variables

**Se Non Trovi**:
```
Contatta supporto Emergent:
- Discord: https://discord.gg/VzKfwCXC4A
- Email: support@emergent.sh

Chiedi: "Come modifico environment variables per deployment?"
```

### Problema: Post-Deploy Ancora CORS Error

**Causa 1**: Cache browser

**Soluzione**:
```
1. Apri Incognito/Private window
2. Test su https://nureal.it
3. Se funziona → clear cache browser normale
```

**Causa 2**: Env variables non salvate

**Soluzione**:
```
1. Verifica env variables su Emergent dashboard
2. Controlla che modifiche siano salvate
3. Redeploy se necessario
```

## 📝 CHECKLIST COMPLETA

### Prima del Deploy:

- [ ] Environment variables configurate su Emergent:
  - [ ] REACT_APP_BACKEND_URL = nureal-crm.preview.emergentagent.com
  - [ ] CORS_ORIGINS = nureal.it,www.nureal.it,...
  - [ ] DB_NAME = mobil-analytics-1-crm_database
  - [ ] REDIS_URL = redis://localhost:6379

- [ ] Codice repository aggiornato:
  - [ ] App.js ha logica URL corretta
  - [ ] Backend CORS configurato
  - [ ] Upload semplificato implementato

### Durante Deploy:

- [ ] Click "Deploy Now" su Emergent
- [ ] Aspetta notifica completamento (10-15 min)
- [ ] NON interrompere processo

### Dopo Deploy:

- [ ] Hard reload browser (Ctrl + Shift + R)
- [ ] Test in Incognito window
- [ ] Verifica console:
  - [ ] Backend URL corretto
  - [ ] Nessun CORS error
- [ ] Test funzionalità:
  - [ ] Login immediato
  - [ ] Upload documenti funziona
  - [ ] Nessun 504 timeout

## 🎉 STATO POST-FIX

**Dopo aver aggiornato env variables e redeployed**:

```
✅ https://nureal.it usa URL backend corretto
✅ Console mostra: nureal-crm.preview.emergentagent.com
✅ CORS configurato per nureal.it
✅ Login immediato (< 2 secondi)
✅ Upload documenti funziona (10-15 secondi)
✅ Nessun 405 o 504 error
```

## 📞 SUPPORTO EMERGENT

Se hai difficoltà a modificare le environment variables:

**Discord** (Risposta veloce):
- https://discord.gg/VzKfwCXC4A
- Canale: #support
- Chiedi: "Come modifico REACT_APP_BACKEND_URL nel deployment?"

**Email** (Risposta 24-48h):
- support@emergent.sh
- Oggetto: "Environment Variables Deployment Issue"

**Documentazione**:
- https://docs.emergent.sh
- Cerca: "Environment Variables" o "Deployment Settings"

## 🎯 RIEPILOGO AZIONE URGENTE

**ADESSO**:
1. Vai su Emergent Dashboard
2. Trova deployment `nureal.it`
3. Settings → Environment Variables
4. Modifica:
   - REACT_APP_BACKEND_URL → nureal-crm.preview.emergentagent.com
   - CORS_ORIGINS → nureal.it,www.nureal.it,...
5. Save & Redeploy
6. Aspetta 10-15 minuti
7. Hard reload browser
8. ✅ RISOLTO!

**WORKAROUND IMMEDIATO** (mentre aspetti deploy):
```
Usa preview environment:
https://lead2ai-flow.preview.emergentagent.com
Login: admin / admin123

Questo funziona SUBITO!
```

---

**Data**: 22 Ottobre 2024
**Urgenza**: CRITICA
**Tempo Risoluzione**: 10-15 minuti (dopo modifica env vars)
**Status**: SOLUZIONE IDENTIFICATA - AZIONE RICHIESTA
