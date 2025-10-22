# 🔍 DEBUG ARUBA DRIVE - ENDPOINT DIAGNOSTICO

## ✅ Ho Aggiunto un Sistema di Debug

Siccome non hai accesso ai log di produzione, ho creato un **endpoint speciale** che ti mostra ESATTAMENTE cosa succede durante l'upload!

## 🎯 Come Usare

### Passo 1: Fai un Test di Upload

1. Vai su `https://nureal.it`
2. Login con il tuo account
3. Vai su un cliente (es. con commessa Fastweb)
4. Carica un documento PDF
5. Attendi che finisca (anche se sembra fallire)

### Passo 2: Controlla il Debug

**Apri nel browser:**
```
https://mobil-analytics-1.emergent.host/api/documents/upload-debug
```

**Vedrai qualcosa tipo:**

```json
{
  "timestamp": "2025-01-20T15:30:45.123Z",
  "success": true,
  "aruba_attempted": true,
  "aruba_success": false,
  "error": "NameError: name 'async_playwright' is not defined",
  "logs": [
    "2025-01-20T15:30:45: 📥 Upload started - entity_type: cliente...",
    "2025-01-20T15:30:45: ✅ Aruba Drive config found: enabled=True",
    "2025-01-20T15:30:45: 🚀 Starting Aruba Drive upload to path: Fastweb/TLS",
    "2025-01-20T15:30:45: ❌ Aruba upload exception: NameError...",
    "2025-01-20T15:30:45: 🔍 Full traceback: ..."
  ]
}
```

## 📊 Interpretazione Risultati

### Campo: `aruba_attempted`

- **`true`** ✅ → Aruba Drive config trovata, upload tentato
- **`false`** ❌ → Nessuna config Aruba Drive, upload saltato

### Campo: `aruba_success`

- **`true`** ✅ → Upload su Aruba Drive RIUSCITO!
- **`false`** ❌ → Upload fallito, usato fallback locale

### Campo: `error`

- **`null`** ✅ → Nessun errore
- **`"..."` ❌ → Messaggio errore specifico (QUESTO È IMPORTANTE!)

### Campo: `logs`

Array di tutti i passaggi dell'upload. Cerca:

**✅ Successo:**
```
✅ Successfully uploaded to Aruba Drive: ...
```

**❌ Problemi:**
```
❌ Aruba Drive upload exception: ...
⚠️ Aruba Drive upload failed: ...
🔍 Full traceback: ...
```

## 🔍 Possibili Errori e Significati

### Errore 1: NameError
```json
"error": "NameError: name 'async_playwright' is not defined"
```
**Significa**: Import di Playwright mancante o errore
**Fix**: Verificare imports in server.py

### Errore 2: Timeout
```json
"error": "TimeoutError: Waiting for selector timed out"
```
**Significa**: Playwright non riesce a trovare elementi su Aruba Drive
**Fix**: Selettori UI cambiati, aumentare timeout

### Errore 3: Executable doesn't exist
```json
"error": "Executable doesn't exist at /path/to/chromium"
```
**Significa**: Browser Chromium non installato
**Fix**: Lazy loading non funziona in produzione

### Errore 4: Permission denied
```json
"error": "PermissionError: [Errno 13] Permission denied"
```
**Significa**: Container non ha permessi per scrivere/eseguire
**Fix**: Problema ambiente Kubernetes

### Errore 5: Network error
```json
"error": "net::ERR_NAME_NOT_RESOLVED"
```
**Significa**: Aruba Drive non raggiungibile da produzione
**Fix**: Firewall/network restrictions

## 🚀 Test Rapido

**Test 1 - Verifica endpoint funziona:**
```
https://mobil-analytics-1.emergent.host/api/documents/upload-debug
```

Dovresti vedere JSON (anche se vuoto prima di upload).

**Test 2 - Upload e poi controlla:**
1. Carica documento
2. Ricarica l'URL sopra
3. Leggi `error` e `logs`

## 📝 Cosa Inviarmi

Dopo aver fatto il test, **copia TUTTO il JSON** dall'endpoint debug e inviamelo.

Esempio:
```json
{
  "timestamp": "...",
  "success": true,
  "aruba_attempted": true,
  "aruba_success": false,
  "error": "IL MESSAGGIO ERRORE QUI",
  "logs": [
    "tutte le righe di log qui"
  ]
}
```

Con questo posso dirti ESATTAMENTE dove fallisce e come fixarlo! 🎯

## 🔒 Sicurezza

Questo endpoint:
- ✅ Richiede autenticazione (devi essere loggato)
- ✅ Non espone dati sensibili (solo log tecnici)
- ✅ Mostra solo l'ULTIMO upload tentato
- ✅ Può essere rimosso dopo il debug

## ⚡ Alternative se Non Funziona

Se per qualche motivo non riesci ad accedere all'endpoint, dimmi:

1. **Quanto tempo impiega l'upload?**
   - <10s → Probabilmente fallback locale immediato
   - 30-60s → Sta provando Aruba Drive
   - >120s → Timeout in corso

2. **Vedi il documento nella lista?**
   - Sì → Upload salvato (local o Aruba)
   - No → Upload completamente fallito

3. **Vedi il documento su Aruba Drive web?**
   - Sì → FUNZIONA! 🎉
   - No → Fallback locale

4. **Messaggio di successo nel frontend?**
   - "Upload completato" → Salvato da qualche parte
   - "Upload fallito" → Errore critico

---

**PROSSIMO STEP: Fai upload e mandami il JSON dall'endpoint debug!** 🚀
