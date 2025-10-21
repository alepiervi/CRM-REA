# 🚀 FIX ARUBA DRIVE PER DEPLOY EMERGENT

## 📋 Problema Risolto

I documenti non venivano caricati su Aruba Drive in produzione (Deploy Emergent) perché i browser Playwright non erano installati.

## ✅ Soluzione Implementata

Ho modificato il codice per **installare automaticamente i browser Playwright all'avvio** del server in produzione.

## 🔧 Modifiche Apportate

### 1. **Startup Event in `server.py`**

Aggiunto un evento `@app.on_event("startup")` che:
- ✅ Controlla se Playwright funziona
- ✅ Se NON funziona, installa automaticamente Chromium
- ✅ Installa le dipendenze di sistema (se possibile)
- ✅ Log dettagliati per debugging

**Posizione**: `/app/backend/server.py` righe ~85-138

### 2. **Script Manuale di Installazione**

Creato `/app/install_playwright_browsers.py` che può essere eseguito manualmente per:
- Test se Playwright funziona
- Installazione browser se mancante
- Verifica finale

## 🚀 Come Deployare la Fix

### Step 1: Commit delle Modifiche

```bash
git add backend/server.py
git add install_playwright_browsers.py
git commit -m "Fix: Auto-install Playwright browsers for Aruba Drive in production"
git push origin main
```

### Step 2: Deploy su Emergent

1. Vai sulla piattaforma Emergent
2. Il deploy partirà automaticamente dal push su GitHub
3. Attendi che il deploy sia completato

### Step 3: Verifica Funzionamento

Dopo il deploy, l'applicazione:
1. ✅ Si avvierà normalmente
2. ✅ All'avvio installerà automaticamente Chromium (prima volta ~1-2 minuti)
3. ✅ Aruba Drive upload funzionerà immediatamente

## 📊 Log di Verifica

Per verificare che l'installazione sia avvenuta, controlla i log di produzione:

Dovresti vedere nei log:
```
INFO: 🎭 Checking Playwright browser installation...
INFO: ✅ Playwright browsers already installed and working
```

OPPURE al primo avvio:
```
INFO: 🎭 Checking Playwright browser installation...
WARNING: ⚠️  Playwright browser test failed...
INFO: 📥 Installing Playwright browsers...
INFO: ✅ Playwright Chromium installed successfully
```

## 🧪 Test Upload Documenti

Dopo il deploy:

1. Accedi all'applicazione in produzione
2. Vai su un cliente con commessa che ha Aruba Drive abilitato (es. Fastweb)
3. Carica un documento PDF
4. Verifica nei log che appaia:
   ```
   📋 Using Aruba Drive config for commessa: Fastweb
   📁 Target Aruba Drive folder: ...
   ✅ Successfully uploaded to Aruba Drive: ...
   ```
5. Controlla su Aruba Drive che il documento sia presente

## ⚙️ Configurazione Commesse Aruba Drive

Verifica che le tue commesse abbiano la configurazione Aruba Drive corretta:

```javascript
// In MongoDB (collezione: commesse)
{
  "nome": "Fastweb",
  "aruba_drive_config": {
    "enabled": true,
    "url": "https://drive.aruba.it",  // Il tuo URL Aruba Drive
    "username": "tuo_username",
    "password": "tua_password",
    "root_folder_path": "Fastweb",     // Cartella root su Aruba Drive
    "auto_create_structure": true,     // Crea automaticamente sottocartelle
    "connection_timeout": 30,
    "upload_timeout": 60,
    "retry_attempts": 3
  }
}
```

## 🔄 Comportamento Sistema

### Primo Deploy (Browser non presenti)
1. Server si avvia
2. Startup event rileva che Playwright non funziona
3. **Installa automaticamente Chromium** (~1-2 minuti)
4. Server pronto, Aruba Drive funzionante

### Deploy Successivi (Browser già installati)
1. Server si avvia
2. Startup event verifica che Playwright funzioni
3. **Nessuna installazione necessaria** (~1 secondo)
4. Server pronto immediatamente

### Se Installazione Fallisce
- ⚠️  Log avviso nei server logs
- ✅  Sistema usa fallback storage locale
- ✅  Documenti salvati comunque (solo non su Aruba Drive)
- 📧  Notifica admin del problema

## 🛠️ Troubleshooting

### "Playwright ancora non funziona dopo deploy"

**Possibili cause:**
1. Prima installazione richiede più tempo (attendi 2-3 minuti)
2. Permessi insufficienti per installare dipendenze sistema
3. Ambiente Emergent ha restrizioni speciali

**Soluzione:**
Contatta supporto Emergent su Discord e condividi questo documento: https://discord.gg/VzKfwCXC4A

### "Upload fallisce con timeout"

**Causa:** Connessione lenta verso Aruba Drive

**Soluzione:** Aumenta i timeout nella configurazione commessa:
```javascript
"connection_timeout": 60,  // Da 30 a 60
"upload_timeout": 120,     // Da 60 a 120
```

### "Login Aruba Drive fallisce"

**Causa:** Credenziali errate o cambiate

**Soluzione:** Aggiorna le credenziali nella configurazione commessa

## 📝 File Modificati

```
/app/backend/server.py           ✅ MODIFICATO (startup event)
/app/install_playwright_browsers.py  ✅ NUOVO (script manuale)
/app/DEPLOY_ARUBA_DRIVE_FIX.md      ✅ NUOVO (questo file)
```

## ✅ Checklist Pre-Deploy

- [ ] Commit modifiche su GitHub
- [ ] Push su branch main/master
- [ ] Deploy automatico su Emergent avviato
- [ ] Atteso completamento deploy (3-5 minuti)
- [ ] Verificato log startup Playwright
- [ ] Testato upload documento
- [ ] Verificato documento su Aruba Drive

## 🎯 Risultato Atteso

Dopo questo fix:
- ✅ Upload documenti funziona in **Preview** (come prima)
- ✅ Upload documenti funziona in **Produzione** (NUOVO!)
- ✅ Nessuna azione manuale richiesta
- ✅ Installazione automatica al primo avvio
- ✅ Fallback locale se Aruba Drive non disponibile

## 📞 Supporto

Se hai problemi:
1. Controlla i log di produzione
2. Esegui lo script di test: `python install_playwright_browsers.py`
3. Contatta supporto Emergent: https://discord.gg/VzKfwCXC4A
4. Condividi questo documento e i log

---

**Versione**: 1.0  
**Data Fix**: 2025-01-20  
**Compatibilità**: Emergent Platform Deploy  
**Status**: ✅ READY TO DEPLOY
