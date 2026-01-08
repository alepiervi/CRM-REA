# 🔍 COME TROVARE IL TUO BACKEND URL SU EMERGENT

## 📋 Il Problema

Il frontend su `nureal.it` deve sapere quale URL usare per chiamare il backend.

## 🎯 Dove Trovare l'URL Backend

### Metodo 1: Dashboard Emergent (RACCOMANDATO)

1. **Vai su**: https://app.emergent.sh (o il tuo dashboard Emergent)

2. **Login** con il tuo account

3. **Cerca la sezione "Deployments" o "Home"**
   - Dovresti vedere la tua app deployata
   - Cerca il tuo progetto (probabilmente si chiama "nureal-crm" o simile)

4. **Identifica il Backend**
   - Vedrai 2 servizi:
     * **Frontend**: nureal.it (il tuo dominio custom)
     * **Backend**: Un URL Emergent tipo `https://[qualcosa].emergent.host` o `https://client-search-fix-3.preview.emergentagent.com`

5. **Copia l'URL Backend**
   - Click sul servizio backend
   - Cerca "API Endpoint", "Backend URL", o "Service URL"
   - **Copia l'URL completo** (es: `https://abc123.emergent.host`)

### Metodo 2: Environment Variables (se disponibili)

1. Dashboard Emergent → Il tuo progetto
2. Click su "Settings" o "Configuration"
3. Cerca sezione "Environment Variables"
4. Cerca variabili tipo:
   - `BACKEND_URL`
   - `API_URL`
   - `REACT_APP_BACKEND_URL`
5. Il valore dovrebbe essere l'URL backend

### Metodo 3: Test Diretto (verifica che funzioni)

Prova questi URL nel browser o con curl:

```bash
# Test 1: URL che penso sia corretto
curl https://mobil-analytics-1.emergent.host/api/health

# Test 2: URL alternativo trovato nei log
curl https://client-search-fix-3.preview.emergentagent.com/api/health

# Quello che risponde 200 OK o 404 è l'URL giusto
# Se risponde con errore di connessione → URL sbagliato
```

## 🔧 Formati URL Emergent

Il backend Emergent può avere uno di questi formati:

**Formato 1: UUID Preview**
```
https://client-search-fix-3.preview.emergentagent.com
Esempio: https://client-search-fix-3.preview.emergentagent.com
```

**Formato 2: App Name**
```
https://[nome-app].emergent.host
Esempio: https://nureal-crm-api.emergent.host
```

**Formato 3: Custom Subdomain**
```
https://api.[tuo-dominio]
Esempio: https://api.nureal.it
```

## 📱 Cosa Vedere nella Dashboard

Cerca qualcosa tipo:

```
┌─────────────────────────────────────┐
│ Nureal CRM                          │
├─────────────────────────────────────┤
│ Frontend                            │
│ 🌐 https://nureal.it                │
│ Status: Running ✅                   │
├─────────────────────────────────────┤
│ Backend (API)                       │
│ 🔌 https://[IL-TUO-URL-BACKEND]     │ ← QUESTO!
│ Status: Running ✅                   │
└─────────────────────────────────────┘
```

## 🚨 Se Non Trovi l'URL

### Opzione 1: Supporto Emergent

Contatta il supporto Emergent:
- **Discord**: https://discord.gg/VzKfwCXC4A
- **Email**: support@emergent.sh
- Chiedi: "Qual è l'URL del mio backend API deployato?"

### Opzione 2: Usa URL Dinamico (TEMPORANEO)

Posso configurare il frontend per usare un URL relativo che funziona sempre:

```javascript
// App.js
const BACKEND_URL = window.location.protocol + '//' + window.location.host;
```

**MA ATTENZIONE**: Funziona SOLO se frontend e backend sono sullo stesso dominio!

### Opzione 3: Controlla nei Log

Se hai accesso ai log di deploy, cerca righe tipo:
```
✅ Backend deployed to: https://[url-backend]
🌐 API available at: https://[url-backend]/api
```

## ✅ Dopo Aver Trovato l'URL

Dimmi l'URL che hai trovato e io:

1. ✅ Aggiorno il codice frontend
2. ✅ Testo la connessione
3. ✅ Faccio commit e push
4. ✅ Deploy automatico
5. ✅ **TUTTO FUNZIONERÀ!** 🎉

## 📝 Formato della Risposta

Dimmi esattamente:

```
Il mio backend URL è: https://[url-completo]
```

Esempio:
```
Il mio backend URL è: https://abc-123.emergent.host
```

Oppure:
```
Il mio backend URL è: https://client-search-fix-3.preview.emergentagent.com
```

## 🎯 Prossimi Passi

1. **Trova l'URL** seguendo i metodi sopra
2. **Dimmi l'URL** che hai trovato
3. **Io aggiorno** il codice in 2 minuti
4. **Deploy** automatico
5. **Aruba Drive funziona!** ✅

---

**Hai domande? Dimmi dove ti blocchi e ti aiuto passo-passo!**
