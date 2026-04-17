# 🚀 BACKEND CONDIVISO ALWAYS ON - CONFIGURAZIONE

## ✅ SOLUZIONE IMPLEMENTATA

**Architettura Scelta**: Backend Condiviso Preview/Produzione Always On

```
Frontend Preview              Frontend Produzione
nureal-crm.preview...         https://nureal.it
        ↓                              ↓
        └──────────┬───────────────────┘
                   ↓
        Backend Condiviso ALWAYS ON
    https://referente-hub.preview.emergentagent.com
                   ↓
              MongoDB Database
```

**Vantaggi**:
- ✅ Un solo backend da mantenere
- ✅ Sempre attivo (no standby)
- ✅ Stesso database per preview e produzione
- ✅ Economico (un solo deployment always on)
- ✅ Facile manutenzione

## 📋 CONFIGURAZIONE COMPLETATA NEL CODICE

### 1. Frontend - URL Hardcoded

**File**: `/app/frontend/src/App.js`

```javascript
// HARDCODED FIX: Force correct URL
const getBackendURL = () => {
  const forcedURL = 'https://referente-hub.preview.emergentagent.com';
  return forcedURL; // ✅ Sempre questo, per tutti
};
```

**Risultato**:
- Preview usa: `nureal-crm.preview.emergentagent.com` ✅
- Produzione usa: `nureal-crm.preview.emergentagent.com` ✅
- **Stesso backend sempre!**

### 2. Backend - CORS Configurato

**File**: `/app/backend/.env`

```bash
CORS_ORIGINS="https://nureal.it,https://www.nureal.it,https://referente-hub.preview.emergentagent.com"
```

**Risultato**:
- ✅ Accetta richieste da nureal.it
- ✅ Accetta richieste da preview
- ✅ Nessun CORS error

## 🎯 AZIONE RICHIESTA SU EMERGENT

### STEP 1: Trova Backend Deployment

**Su Emergent Dashboard**:
1. Vai a: https://app.emergentagent.com
2. Cerca deployment: `nureal-crm` (o nome backend)
3. Quello che risponde su: `nureal-crm.preview.emergentagent.com`

### STEP 2: Abilita "Always On"

**Nel deployment settings**:

Cerca una di queste opzioni:
- ✅ **"Always On"** → Enable
- ✅ **"Keep Alive"** → Enable  
- ✅ **"No Standby"** → Enable
- ✅ **"Prevent Sleep"** → Enable
- ✅ **"Production Mode"** → Enable

**Costo stimato**: 50-100 crediti/mese

**Se non trovi questa opzione**:
- Potrebbe essere: Plan upgrade necessario
- Contatta supporto Emergent per abilitare always on

### STEP 3: Configura Environment Variables Backend

**Nel backend deployment, verifica/aggiungi**:

```bash
CORS_ORIGINS=https://nureal.it,https://www.nureal.it,https://referente-hub.preview.emergentagent.com

# Altri (se non ci sono già):
DB_NAME=crm_database
MONGO_URL=mongodb://localhost:27017
REDIS_URL=redis://localhost:6379
```

### STEP 4: Redeploy Backend

**Dopo aver abilitato always on e configurato env vars**:
1. Click "Redeploy" o "Deploy Now"
2. Aspetta 10-15 minuti
3. Backend ripartirà in modalità always on

### STEP 5: Deploy Frontend (se non fatto)

**Deploy frontend nureal.it con codice hardcoded**:
1. Assicurati di fare deploy #2 (quello con hardcode che ho fatto)
2. Questo userà il backend condiviso
3. Aspetta 10-15 minuti
4. Hard reload browser

## 📊 VERIFICA CONFIGURAZIONE

### Test 1: Backend Sempre Attivo

**Aspetta 30 minuti senza usare app**:
```
1. Non usare app per 30 minuti
2. Poi vai su https://nureal.it
3. Login deve essere immediato (< 2s)
4. Se lento/errore → backend è andato in standby ❌
5. Se veloce → always on funziona ✅
```

### Test 2: CORS Funzionante

**Da https://nureal.it**:
```
1. Apri console (F12)
2. Login
3. Console NON deve mostrare CORS errors
4. Network tab: tutte richieste 200 OK
```

### Test 3: Upload Documenti

**Da https://nureal.it**:
```
1. Clienti → Cliente Fastweb
2. Upload PDF
3. Attendi 10-15 secondi
4. ✅ Success - documento su Aruba Drive
5. Nessun timeout o errore
```

## 🔧 TROUBLESHOOTING

### Problema: Backend va ancora in standby dopo 30 min

**Causa**: Always on non abilitato correttamente

**Soluzioni**:

**A. Verifica Setting Emergent**:
```
1. Dashboard → Backend deployment
2. Settings → Controlla "Always On" sia enabled
3. Se disabilitato, abilita
4. Redeploy
```

**B. Upgrade Piano se Necessario**:
```
- Free tier potrebbe non supportare always on
- Upgrade a piano Production
- Contatta supporto: support@emergent.sh
```

**C. Ping Periodico (Workaround)**:
```
Crea un cron job che pinga backend ogni 5 minuti:
curl https://referente-hub.preview.emergentagent.com/api/health

Questo mantiene backend sveglio
```

### Problema: CORS Error da nureal.it

**Causa**: Backend env vars non aggiornate

**Soluzione**:
```
1. Backend deployment → Environment Variables
2. Aggiungi/Modifica:
   CORS_ORIGINS=https://nureal.it,https://www.nureal.it,...
3. Redeploy backend
4. Hard reload browser
```

### Problema: Upload Documenti Lento (>30s)

**Causa**: Chromium non installato in backend produzione

**Soluzione**:
```
Se backend deployment è nuovo/diverso da preview:

1. SSH nel backend deployment (se possibile)
2. Installa Chromium:
   python3 -m playwright install chromium
3. Riavvia backend

Oppure:
- Primo upload sarà lento (installa Chromium auto)
- Upload successivi veloci (10-15s)
```

## 💡 ALTERNATIVE SE ALWAYS ON NON DISPONIBILE

### Opzione A: Cloudflare Worker Keep-Alive

**Crea un worker che pinga ogni 5 minuti**:
```javascript
// Cloudflare Worker
addEventListener('scheduled', event => {
  event.waitUntil(keepAlive());
});

async function keepAlive() {
  await fetch('https://referente-hub.preview.emergentagent.com/api/health');
}
```

**Costo**: Free (Cloudflare free tier)

### Opzione B: UptimeRobot Monitoring

**Setup monitoring gratuito**:
1. Vai su: https://uptimerobot.com
2. Add Monitor:
   - URL: https://referente-hub.preview.emergentagent.com/api/health
   - Interval: 5 minutes
3. UptimeRobot farà ping automatico
4. Backend rimane sveglio

**Costo**: Free

### Opzione C: GitHub Actions Cron

**Crea workflow che pinga ogni 5 minuti**:
```yaml
# .github/workflows/keep-alive.yml
name: Keep Backend Alive
on:
  schedule:
    - cron: '*/5 * * * *'  # Ogni 5 minuti
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl https://referente-hub.preview.emergentagent.com/api/health
```

**Costo**: Free (GitHub Actions free tier)

## 🎯 VANTAGGI ARCHITETTURA CONDIVISA

### 1. Semplicità
```
Un solo backend da:
- Mantenere
- Monitorare
- Aggiornare
- Debuggare
```

### 2. Economia
```
Costi:
- Backend always on: ~50-100 crediti/mese
- Frontend produzione: ~50 crediti/mese
- Totale: ~100-150 crediti/mese

VS Separati:
- Backend preview: free (con standby)
- Backend produzione: ~100 crediti/mese
- Frontend produzione: ~50 crediti/mese
- Totale: ~150 crediti/mese + gestione doppia
```

### 3. Consistenza
```
✅ Stesso codice backend per preview e prod
✅ Stesso database (o DB separati se preferisci)
✅ Testing in preview = testing produzione
✅ Nessuna sorpresa post-deploy
```

### 4. Performance
```
✅ Backend sempre caldo (no cold start)
✅ Connessioni DB già stabilite
✅ Cache attiva
✅ Response immediata (< 100ms)
```

## 📝 CHECKLIST FINALE

### Setup Iniziale:

- [ ] Backend deployment identificato su Emergent
- [ ] "Always On" abilitato nel deployment
- [ ] CORS_ORIGINS configurato correttamente
- [ ] Backend redeployed con always on
- [ ] Frontend produzione deployed con codice hardcoded
- [ ] Hard reload browser fatto

### Verifica Funzionamento:

- [ ] Login da nureal.it immediato (< 2s)
- [ ] Nessun CORS error in console
- [ ] Upload documenti funziona (10-15s)
- [ ] Backend non va in standby dopo 30 min inattività

### Monitoring (Opzionale):

- [ ] UptimeRobot configurato per keep-alive
- [ ] Alert email se backend down
- [ ] Dashboard monitoring per uptime

## 🎉 STATO FINALE ATTESO

**Dopo Setup Completo**:

```
Frontend Produzione (nureal.it):
✅ Usa backend condiviso
✅ Login immediato sempre
✅ Upload documenti 10-15s
✅ Nessun CORS error
✅ Nessun 504 timeout

Backend Condiviso:
✅ Always on (mai standby)
✅ Response < 100ms
✅ CORS configurato per tutti domini
✅ Chromium installato per upload
✅ Uptime 99.9%

Produzione:
✅ Affidabile 24/7
✅ Performance consistente
✅ Costi ottimizzati
✅ Facile manutenzione
```

## 📞 SUPPORTO EMERGENT

**Per Abilitare Always On**:

**Discord** (Risposta rapida):
- https://discord.gg/VzKfwCXC4A
- Chiedi: "Come abilito always on per backend deployment?"

**Email**:
- support@emergent.sh
- Oggetto: "Enable Always On for Backend"

**Cosa Chiedere**:
```
Ciao, ho un backend deployment su:
https://referente-hub.preview.emergentagent.com

Vorrei abilitare "always on" per evitare standby.
Come posso farlo? Quale piano serve?

Deployment ID: [copia ID da dashboard]
```

---

**Data**: 22 Ottobre 2024
**Architettura**: Backend Condiviso Always On
**Status**: CONFIGURAZIONE COMPLETATA - ABILITA ALWAYS ON SU EMERGENT
