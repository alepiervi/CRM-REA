# 🚨 RISOLUZIONE STANDBY BACKEND - Supporto Emergent

## ✅ SITUAZIONE

**Piano Emergent**: Include "Always On" (no standby)
**Problema Attuale**: Backend va in standby comunque
**Root Cause**: Configurazione deployment non corretta

## 📞 SOLUZIONE DEFINITIVA: Contatta Supporto Emergent

### AZIONE IMMEDIATA

Il deployment `mobil-analytics-1` deve essere configurato come **Production Always On** lato Emergent.

#### Via Discord (RACCOMANDATO - Risposta rapida):

**1. Vai su**: https://discord.gg/VzKfwCXC4A

**2. Canale**: #support

**3. Invia messaggio**:

```
Ciao Emergent team! 👋

Ho un problema con il mio backend deployment che va in standby.

📋 DETTAGLI:
• Deployment ID: mobil-analytics-1
• URL: https://mobil-analytics-1.emergent.host
• Piano: [specifica il tuo - es. Production/Pro]

🐛 PROBLEMA:
Dopo 5-10 minuti di inattività:
• 502 Bad Gateway su tutte le API
• CORS errors (No Access-Control-Allow-Origin)
• Prima richiesta dopo inattività: lenta (5-10s cold start)
• Richieste successive: veloci

Indica che il backend va in STANDBY/SLEEP.

✅ PIANO:
Il mio piano include "always on" ma il deployment va comunque in standby.

🎯 RICHIESTA:
Come posso configurare il deployment per essere sempre attivo 
senza andare mai in standby?

Grazie mille! 🙏
```

**4. Aspetta risposta** (solitamente entro poche ore)

#### Via Email (Alternativa - 24-48h):

```
A: support@emergent.sh
Oggetto: Backend Deployment Standby Issue - Always On Configuration

[Stesso messaggio Discord]
```

### INFORMAZIONI DA FORNIRE SE RICHIESTE

```
1. Deployment URL: https://mobil-analytics-1.emergent.host

2. Account email: [la tua email Emergent]

3. Piano corrente: [Production/Pro/etc]

4. Logs errore (se richiesti):
   - 502 Bad Gateway
   - Network Error
   - CORS policy error

5. Screenshot deployment settings (se richiesti)

6. Comportamento:
   - Backend funziona dopo deploy
   - Dopo 5-10 min inattività: 502 error
   - Prima richiesta post-inattività: cold start (lenta)
   - Successive richieste: veloci
```

## 🔍 VERIFICA CONFIGURAZIONE (Mentre Aspetti)

### STEP 1: Check Deployment Settings

**Emergent Dashboard → Deployment `mobil-analytics-1` → Settings**

**Cerca queste opzioni**:

```
[ ] Always On
[ ] Production Mode
[ ] Keep Alive
[ ] Prevent Sleep
[ ] No Standby
[ ] 24/7 Availability
```

**Stato Corretto**:
```
[x] Always On → ENABLED
[x] Production Mode → ENABLED
[ ] Plan: Production (non Free/Hobby)
```

**Se Vedi OFF o Mancante**:
```
→ Screenshot
→ Invia a supporto
→ Questo è probabilmente il problema
```

### STEP 2: Check Plan Subscription

**Account Settings → Billing/Subscription**

**Verifica**:
```
✅ Plan: Production/Pro (not Free)
✅ Status: Active
✅ Features: Include "Always On" o "No Standby"
✅ Billing: Up to date
```

**Se Piano Non Corretto**:
```
→ Upgrade a Production plan
→ Verifica features includono always on
```

### STEP 3: Check Deployment Type

**Dashboard → Deployment Info**

**Verifica**:
```
✅ Type: Production API (not Preview)
✅ Environment: Production (not Development)
✅ Tier: Production (not Free)
```

**Se Tipo Sbagliato**:
```
→ Deployment creato come Preview/Dev
→ Serve convertire a Production
→ O creare nuovo deployment Production
```

## 🎯 RISPOSTE POSSIBILI DA EMERGENT

### Scenario 1: Settings da Abilitare

**Risposta Emergent**:
```
"Devi abilitare always on nelle settings del deployment"
```

**Azione**:
```
1. Deployment → Settings → Always On → Enable
2. Save
3. Redeploy (se necessario)
4. Test dopo 15 min inattività
5. ✅ Risolto!
```

### Scenario 2: Upgrade Piano Necessario

**Risposta Emergent**:
```
"Il tuo piano attuale non include always on.
Upgrade a Production plan: $XX/mese"
```

**Azione**:
```
1. Valuta costo ($50-100/mese tipico)
2. Se ok → Upgrade plan
3. Abilita always on
4. Redeploy
5. Test
6. ✅ Risolto!
```

### Scenario 3: Configurazione Lato Server

**Risposta Emergent**:
```
"Configureremo always on per te lato server.
Fatto! Prova tra 10 minuti"
```

**Azione**:
```
1. Aspetta 10-15 minuti
2. Test inattività 15 min
3. Login deve essere immediato
4. ✅ Risolto!
```

### Scenario 4: Problema Deployment

**Risposta Emergent**:
```
"Il deployment ha problemi di configurazione.
Serve creare nuovo deployment"
```

**Azione**:
```
1. Crea nuovo deployment production
2. Copia env vars da mobil-analytics-1
3. Deploy codice
4. Update frontend per usare nuovo URL
5. Test
6. ✅ Risolto!
```

### Scenario 5: Health Check Fail

**Risposta Emergent**:
```
"Il deployment fallisce health checks.
Container viene stoppato da Kubernetes"
```

**Azione**:
```
1. Aggiungi endpoint /api/health (già fatto!)
2. Deploy backend con health endpoint
3. Emergent configura health checks
4. Test
5. ✅ Risolto!
```

## 💡 SOLUZIONE TEMPORANEA (Mentre Risolvi)

### Opzione A: Preview Backend + UptimeRobot

**Setup (10 minuti)**:

1. **Frontend usa preview temporaneamente**:
   ```javascript
   // Già modificato nel codice!
   // nureal.it → usa preview backend temporaneo
   return 'https://referente-oversight.preview.emergentagent.com';
   ```

2. **Deploy frontend con fix temporaneo**

3. **Setup UptimeRobot per preview**:
   ```
   URL: https://referente-oversight.preview.emergentagent.com/api/health
   Interval: 5 minutes
   ```

4. **Quando mobil-analytics-1 risolto**:
   ```
   - Revert codice frontend
   - Deploy
   - Test
   ```

**Vantaggi**:
```
✅ App funziona subito
✅ Users non impattati
✅ Tempo per risolvere con Emergent
```

**Svantaggi**:
```
⚠️ Preview potrebbe essere più lento
⚠️ Serve UptimeRobot (gratuito)
⚠️ Soluzione temporanea
```

### Opzione B: Nuovo Deployment Production

**Se Emergent non risponde velocemente**:

1. **Crea nuovo deployment**:
   ```
   Type: Backend API
   Plan: Production
   Name: nureal-backend-v2
   Repository: [tuo]
   Path: /app/backend
   Always On: ENABLED
   ```

2. **Copia env vars** da mobil-analytics-1

3. **Deploy**

4. **Update frontend**:
   ```javascript
   return 'https://nureal-backend-v2.emergent.host';
   ```

5. **Migra database** (se necessario):
   ```bash
   mongodump da mobil-analytics-1 DB
   mongorestore a nureal-backend-v2 DB
   ```

6. **Test completo**

7. **Elimina mobil-analytics-1** (dopo verifica)

## 📊 TESTING POST-FIX

### Test 1: Inattività 15 Minuti

```
1. App funzionante
2. Non usare per 15 minuti
3. Torna su https://nureal.it
4. Login DEVE essere immediato (< 2s)
5. Nessun 502 error
6. Dashboard carica veloce
7. ✅ Always on funziona!
```

### Test 2: Inattività 1 Ora

```
1. Non usare per 1 ora
2. Login immediato?
3. ✅ Conferma always on
```

### Test 3: Overnight (8 ore)

```
1. Lascia app inutilizzata overnight
2. Mattina dopo: login immediato?
3. ✅ Definitivamente always on
```

### Test 4: Monitoring

```
Setup UptimeRobot anche dopo fix:
- Monitoring uptime
- Alert se backend down
- Statistics performance
```

## 🔧 TROUBLESHOOTING POST-FIX

### Backend Ancora in Standby

**Possibili Cause**:

1. **Settings non salvate**:
   ```
   → Verifica sempre on ancora enabled
   → Redeploy
   ```

2. **Cache DNS**:
   ```
   → Aspetta 10-15 min propagazione
   → Flush DNS: ipconfig /flushdns (Windows)
   ```

3. **Deployment non redeployed**:
   ```
   → Redeploy esplicitamente
   → Verifica logs deploy success
   ```

4. **Piano non aggiornato**:
   ```
   → Verifica billing plan updated
   → Contatta supporto se discrepanza
   ```

### 502 Errors Intermittenti

**Possibili Cause**:

1. **Backend crash (non standby)**:
   ```
   → Check logs: out of memory?
   → Upgrade resources
   → Fix bug applicazione
   ```

2. **Database connection issues**:
   ```
   → Verifica MONGO_URL corretto
   → Database sempre raggiungibile?
   → Connection pool configurato?
   ```

3. **Load balancer issues**:
   ```
   → Emergent lato infra
   → Contatta supporto
   ```

## 📝 CHECKLIST RISOLUZIONE

### Fase 1: Contatto Supporto

- [ ] Messaggio inviato Discord #support
- [ ] O email a support@emergent.sh
- [ ] Fornito deployment ID e dettagli
- [ ] Screenshot settings allegati (se richiesti)
- [ ] Attesa risposta (tracking ticket)

### Fase 2: Verifica Settings

- [ ] Check deployment settings always on
- [ ] Check piano subscription attivo
- [ ] Check deployment type production
- [ ] Screenshot configurazione attuale

### Fase 3: Implementazione Fix

- [ ] Segui istruzioni Emergent
- [ ] Abilita always on se richiesto
- [ ] Redeploy se necessario
- [ ] Aspetta propagazione (10-15 min)

### Fase 4: Testing

- [ ] Test inattività 15 minuti
- [ ] Login immediato verificato
- [ ] Nessun 502 error
- [ ] Test inattività 1 ora
- [ ] Test overnight (opzionale)

### Fase 5: Monitoring

- [ ] Setup UptimeRobot monitoring
- [ ] Alert email configurato
- [ ] Dashboard monitoraggio attivo
- [ ] ✅ Problema risolto definitivamente!

## 🎉 STATO FINALE ATTESO

**Dopo Risoluzione con Emergent**:

```
Backend mobil-analytics-1:
✅ Always on configurato correttamente
✅ Mai va in standby
✅ Login immediato sempre (< 2s)
✅ Nessun 502 error mai
✅ Nessun CORS error dopo inattività
✅ Performance consistente 24/7
✅ Uptime 99.9%

Frontend nureal.it:
✅ Usa backend production always on
✅ User experience perfetta
✅ Nessun cold start
✅ Response immediata sempre

Piano:
✅ Production plan con always on
✅ Nessun costo extra workaround
✅ Soluzione nativa Emergent
✅ Supportata ufficialmente
```

## 📞 CONTATTI SUPPORTO EMERGENT

**Discord** (RACCOMANDATO):
- URL: https://discord.gg/VzKfwCXC4A
- Canale: #support
- Response time: Minuti - poche ore
- Live chat con team

**Email**:
- Email: support@emergent.sh
- Response time: 24-48 ore
- Per problemi non urgenti

**Documentation**:
- Docs: https://docs.emergent.sh
- Search: "always on" o "production deployment"
- Guides e tutorials

---

**Data**: 23 Ottobre 2024
**Problema**: Backend standby nonostante piano always on
**Soluzione**: Configurazione deployment con supporto Emergent
**Status**: CONTATTA SUPPORTO - SOLUZIONE TEMPORANEA ATTIVA
