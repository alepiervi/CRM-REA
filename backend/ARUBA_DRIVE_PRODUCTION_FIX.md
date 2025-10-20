# 🚨 FIX URGENTE: Aruba Drive Upload in Produzione

## 📋 Problema

I documenti **non vengono caricati su Aruba Drive in produzione (Deploy)** ma funzionano correttamente in preview.

## 🔍 Causa Root

Il sistema usa **Playwright** (browser automation) per caricare i file su Aruba Drive.

**In produzione, i browser Playwright non sono installati**, causando il fallimento dell'upload con conseguente fallback su storage locale.

## ✅ Soluzione Immediata

### Opzione 1: Installazione Automatica (RACCOMANDATA)

Esegui questo comando SSH nella tua istanza di produzione:

```bash
# 1. Connetti via SSH alla tua istanza di produzione
ssh user@your-production-server

# 2. Naviga nella directory backend
cd /app/backend

# 3. Installa i browser Playwright
python -m playwright install chromium

# 4. Installa le dipendenze di sistema (richiede sudo)
sudo python -m playwright install-deps chromium

# 5. Riavvia il backend
sudo supervisorctl restart backend
```

### Opzione 2: Script Automatico

Abbiamo creato uno script che fa tutto automaticamente:

```bash
# Dalla directory /app/backend nella tua istanza di produzione
bash install_playwright.sh
```

### Opzione 3: Verifica e Installazione Interattiva

Usa lo script di verifica che controlla e installa automaticamente:

```bash
cd /app/backend
python check_playwright.py
```

Questo script:
- ✅ Verifica se Playwright funziona
- ✅ Identifica il problema specifico
- ✅ Offre di installare automaticamente i browser
- ✅ Verifica che tutto funzioni dopo l'installazione

## 🧪 Test Post-Installazione

Dopo aver installato Playwright, testa l'upload:

### 1. Verifica Playwright

```bash
cd /app/backend
python check_playwright.py
```

Dovresti vedere:
```
✅ PLAYWRIGHT FUNZIONA CORRETTAMENTE!
```

### 2. Test Upload Documento

1. Accedi all'applicazione in produzione
2. Vai su un cliente
3. Carica un documento PDF
4. Verifica nei log backend:

```bash
sudo tail -f /var/log/supervisor/backend.*.log | grep -i aruba
```

Dovresti vedere:
```
📋 Using Aruba Drive config for commessa: Fastweb
📁 Target Aruba Drive folder: Fastweb/TLS/...
✅ Successfully uploaded to Aruba Drive: ...
```

### 3. Verifica su Aruba Drive

1. Accedi al tuo account Aruba Drive
2. Naviga nella cartella della commessa (es. Fastweb)
3. Verifica che il documento sia stato caricato nella struttura corretta

## 🔧 Troubleshooting

### Problema: "Executable doesn't exist"

**Causa**: Browser Chromium non installato

**Soluzione**:
```bash
python -m playwright install chromium
```

### Problema: "Failed to launch browser"

**Causa**: Mancano dipendenze di sistema

**Soluzione**:
```bash
sudo python -m playwright install-deps chromium
```

### Problema: Permission denied

**Causa**: Mancano permessi per installare dipendenze

**Soluzione**: Usa `sudo` per installare le dipendenze:
```bash
sudo python -m playwright install-deps chromium
```

### Problema: Browser si avvia ma timeout durante upload

**Causa**: Network lento o Aruba Drive non raggiungibile

**Soluzione**:
1. Verifica la connettività da produzione verso Aruba Drive
2. Controlla se ci sono firewall che bloccano
3. Aumenta i timeout nel codice (se necessario)

## 📊 Verifica Stato Attuale

### In Preview (Funziona)
```bash
cd /app/backend
python check_playwright.py
```

### In Produzione (Da Verificare)

Dopo aver fatto SSH sulla tua istanza di produzione:
```bash
cd /app/backend
python check_playwright.py
```

Se vedi errori, segui la procedura di installazione sopra.

## 🎯 Differenze Preview vs Produzione

| Aspetto | Preview | Produzione |
|---------|---------|------------|
| Playwright Library | ✅ Installata | ✅ Installata |
| Browser Chromium | ✅ Installato | ❌ Non installato |
| Dipendenze Sistema | ✅ Presenti | ❌ Mancanti |
| Upload Aruba Drive | ✅ Funziona | ❌ Fallisce |

## 📝 Note Tecniche

### Perché Playwright?

Aruba Drive **non ha API REST pubbliche**. L'unica soluzione per l'upload automatico è usare **browser automation** con Playwright.

### Perché non funziona in produzione?

L'immagine Docker di produzione è **minimal** e non include:
- Browser Chromium
- Dipendenze sistema per browser headless

In preview, questi sono già installati dall'ambiente di sviluppo.

### Storage Fallback

Il sistema ha un **fallback automatico**:
- Se Aruba Drive upload fallisce → salva in locale
- I documenti NON si perdono mai
- Ma NON sono accessibili da Aruba Drive

## 🔐 Sicurezza

Le credenziali Aruba Drive sono configurate **per-commessa** nel database, NON nel file `.env`.

Per verificare la configurazione:
```bash
# Connetti a MongoDB
mongo

# Usa il database
use crm_database

# Verifica commesse con Aruba Drive abilitato
db.commesse.find({"aruba_drive_config.enabled": true}).pretty()
```

## ⚡ Deploy Automatico (Futuro)

Per evitare questo problema nei futuri deploy, aggiungi al tuo Dockerfile di produzione:

```dockerfile
# Installa Playwright e browser
RUN pip install playwright==1.55.0
RUN python -m playwright install chromium
RUN python -m playwright install-deps chromium
```

Oppure aggiungi al tuo script di deployment:

```bash
#!/bin/bash
# deploy.sh

# ... altri comandi ...

# Installa browser Playwright
python -m playwright install chromium
sudo python -m playwright install-deps chromium

# Riavvia servizi
sudo supervisorctl restart all
```

## 📞 Supporto

Se dopo aver seguito questi passaggi il problema persiste:

1. Cattura i log completi:
```bash
sudo tail -n 200 /var/log/supervisor/backend.err.log > aruba_error_log.txt
```

2. Esegui diagnostica:
```bash
cd /app/backend
python check_playwright.py > playwright_diagnostic.txt 2>&1
```

3. Condividi entrambi i file per analisi approfondita

---

**Versione**: 1.0.0  
**Data**: 2025-01-20  
**Urgenza**: 🔴 CRITICA  
**Tempo stimato fix**: 5-10 minuti
