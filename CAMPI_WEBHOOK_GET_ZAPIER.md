# 📋 LISTA COMPLETA CAMPI WEBHOOK GET PER ZAPIER

## 🔴 CAMPI OBBLIGATORI

| Campo | Tipo | Esempio | Note |
|-------|------|---------|------|
| `nome` | string | `Mario` | Nome del lead |
| `cognome` | string | `Rossi` | Cognome del lead |
| `telefono` | string | `3331234567` o `+393331234567` | Numero di telefono (con o senza prefisso) |
| `email` | string | `mario.rossi@example.com` | Email valida |

**URL Esempio con solo campi obbligatori:**
```
/api/webhook/{unit_id}?nome=Mario&cognome=Rossi&telefono=3331234567&email=mario@example.com
```

---

## 🟡 CAMPI FORTEMENTE CONSIGLIATI

| Campo | Tipo | Esempio | Note |
|-------|------|---------|------|
| `provincia` | string | `Milano` | **CRITICO!** Necessario per auto-assegnazione agente. Deve corrispondere a una provincia italiana |
| `commessa_id` | string | `abc123-def456` | **IMPORTANTE!** ID della commessa. Il sistema valida che sia autorizzata per la Unit |

**Perché sono importanti:**
- ✅ **provincia**: Senza questo campo, il lead NON verrà assegnato automaticamente a nessun agente
- ✅ **commessa_id**: Permette di tracciare da quale commessa proviene il lead e validare l'autorizzazione

---

## 🟢 CAMPI OPZIONALI - Informazioni Lead

| Campo | Tipo | Esempio | Note |
|-------|------|---------|------|
| `campagna` | string | `Facebook_Ads_2025` | Nome della campagna pubblicitaria per tracking |
| `indirizzo` | string | `Via Roma 123` | Indirizzo completo del lead |
| `regione` | string | `Lombardia` | Regione italiana |
| `tipologia_abitazione` | string | `singola` | Valori: `singola`, `bifamiliare`, `condominio` |
| `url` | string | `https://example.com/source` | URL sorgente da cui proviene il lead |
| `otp` | string | `123456` | Codice OTP se presente |
| `inserzione` | string | `FB_12345` | ID dell'inserzione pubblicitaria |

---

## 🟢 CAMPI OPZIONALI - Consensi Privacy

| Campo | Tipo | Esempio | Note |
|-------|------|---------|------|
| `privacy_consent` | boolean | `true` o `false` | Consenso privacy (default: `false`) |
| `marketing_consent` | boolean | `true` o `false` | Consenso marketing (default: `false`) |

**Come passare i booleani in URL:**
- `privacy_consent=true` → Consenso dato
- `privacy_consent=false` → Consenso non dato
- Se omesso → Default `false`

---

## 📝 TEMPLATE COMPLETO URL ZAPIER

### Template Base (Solo Obbligatori):
```
https://tuo-dominio.com/api/webhook/{UNIT_ID}?nome={{Nome}}&cognome={{Cognome}}&telefono={{Telefono}}&email={{Email}}
```

### Template Consigliato (Con Provincia e Commessa):
```
https://tuo-dominio.com/api/webhook/{UNIT_ID}?nome={{Nome}}&cognome={{Cognome}}&telefono={{Telefono}}&email={{Email}}&provincia={{Provincia}}&commessa_id={COMMESSA_ID}
```

### Template Completo (Tutti i Campi):
```
https://tuo-dominio.com/api/webhook/{UNIT_ID}?nome={{Nome}}&cognome={{Cognome}}&telefono={{Telefono}}&email={{Email}}&provincia={{Provincia}}&commessa_id={COMMESSA_ID}&campagna={{Campagna}}&indirizzo={{Indirizzo}}&regione={{Regione}}&tipologia_abitazione={{TipologiaAbitazione}}&url={{URL}}&otp={{OTP}}&inserzione={{Inserzione}}&privacy_consent={{PrivacyConsent}}&marketing_consent={{MarketingConsent}}
```

---

## 🎯 MAPPATURA CAMPI ZAPIER

### Esempio Pratico: Facebook Lead Ads → CRM

**Campi Facebook Lead Ads → Parametri URL:**

| Campo Form Facebook | Parametro URL | Esempio Zapier |
|---------------------|---------------|----------------|
| Nome completo | `nome` + `cognome` | Dividere con formatter: `{{1. Full Name (First Part)}}` |
| Email | `email` | `{{1. Email}}` |
| Telefono | `telefono` | `{{1. Phone}}` |
| Città/Provincia | `provincia` | `{{1. City}}` |
| Campagna | `campagna` | Hardcoded: `FacebookAds2025` |
| - | `commessa_id` | Hardcoded: `abc123-def456` |

### Esempio: Google Forms → CRM

| Campo Google Form | Parametro URL | Esempio Zapier |
|-------------------|---------------|----------------|
| Qual è il tuo nome? | `nome` | `{{1. Question 1}}` |
| Qual è il tuo cognome? | `cognome` | `{{1. Question 2}}` |
| Email | `email` | `{{1. Question 3}}` |
| Telefono | `telefono` | `{{1. Question 4}}` |
| Provincia | `provincia` | `{{1. Question 5}}` |
| - | `commessa_id` | Hardcoded: `abc123-def456` |

---

## 🔄 ENCODING URL AUTOMATICO

**Zapier gestisce automaticamente l'encoding dei caratteri speciali, ma se crei l'URL manualmente:**

| Carattere | Encoded | Esempio |
|-----------|---------|---------|
| Spazio | `%20` o `+` | `Via Roma` → `Via+Roma` |
| @ | `%40` | `mario@email.com` → `mario%40email.com` |
| + | `%2B` | `+39` → `%2B39` |

**Esempio:**
```
Nome: Mario Rossi
Email: test@email.com
```

**URL Corretto:**
```
?nome=Mario&cognome=Rossi&email=test%40email.com
```

**Oppure (Zapier lo fa automaticamente):**
```
?nome=Mario&cognome=Rossi&email=test@email.com
```

---

## ⚠️ VALIDAZIONI BACKEND

Il sistema valida automaticamente:

1. **Campi Obbligatori:**
   - Se mancano `nome`, `cognome`, `telefono` o `email` → Errore 422

2. **Commessa Autorizzata:**
   - Se `commessa_id` è fornito, verifica che sia in `commesse_autorizzate` della Unit
   - Se non autorizzato → Errore 400

3. **Provincia per Auto-Assegnazione:**
   - Se `provincia` è fornito, cerca agenti con quella provincia
   - Se non trova agenti → Lead creato ma NON assegnato (da assegnare manualmente)

4. **Unit Esistente:**
   - Se `unit_id` nell'URL non esiste → Errore 404

---

## 📊 ESEMPI URL COMPLETI

### Esempio 1: Lead Base
```
https://lead2ai-flow.preview.emergentagent.com/api/webhook/251eb0e5-f4b3-4837-9f05-8f8eec6f62d0?nome=Mario&cognome=Rossi&telefono=3331234567&email=mario@example.com&provincia=Milano&commessa_id=abc123
```

### Esempio 2: Lead Completo con Campagna
```
https://lead2ai-flow.preview.emergentagent.com/api/webhook/251eb0e5-f4b3-4837-9f05-8f8eec6f62d0?nome=Giulia&cognome=Bianchi&telefono=3345678901&email=giulia@example.com&provincia=Roma&commessa_id=abc123&campagna=GoogleAds2025&indirizzo=Via+Milano+45&regione=Lazio&tipologia_abitazione=singola&privacy_consent=true&marketing_consent=true
```

### Esempio 3: Con Zapier Variables
```
https://lead2ai-flow.preview.emergentagent.com/api/webhook/251eb0e5-f4b3-4837-9f05-8f8eec6f62d0?nome={{1. First Name}}&cognome={{1. Last Name}}&telefono={{1. Phone}}&email={{1. Email}}&provincia={{1. City}}&commessa_id=abc123-def456&campagna=FacebookLeads2025
```

---

## ✅ CHECKLIST CONFIGURAZIONE ZAPIER

Prima di attivare il Zap:

- [ ] Ho copiato l'ID della Unit (da "Unit & Sub Agenzie")
- [ ] Ho copiato l'ID della Commessa (da "Commesse")
- [ ] Ho sostituito `{UNIT_ID}` nell'URL con l'ID reale
- [ ] Ho sostituito `{COMMESSA_ID}` con l'ID reale della commessa
- [ ] Ho mappato tutti i campi obbligatori: `nome`, `cognome`, `telefono`, `email`
- [ ] Ho mappato `provincia` per abilitare auto-assegnazione
- [ ] Ho testato l'URL nel browser con dati di esempio
- [ ] Il test ha restituito `"success": true`
- [ ] Ho verificato che il lead sia apparso nel CRM

---

## 🆘 TROUBLESHOOTING

### Errore: "Field required"
**Causa:** Manca un campo obbligatorio
**Soluzione:** Verifica che `nome`, `cognome`, `telefono`, `email` siano tutti presenti nell'URL

### Errore: "Commessa not authorized"
**Causa:** `commessa_id` non è nelle commesse autorizzate della Unit
**Soluzione:** 
1. Vai su "Unit & Sub Agenzie" → Modifica Unit
2. Verifica che la commessa sia selezionata
3. Salva e riprova

### Lead creato ma NON assegnato
**Causa:** Nessun agente disponibile per quella provincia
**Soluzione:**
1. Verifica che `provincia` sia corretta (es: "Milano", non "milan")
2. Vai su "Utenti" → Verifica che ci siano Agenti attivi con quella provincia
3. Assegna manualmente il lead o aggiungi la provincia agli Agenti

### Caratteri strani nell'URL
**Causa:** Encoding non corretto
**Soluzione:** Zapier gestisce automaticamente l'encoding. Se usi URL manuale, usa `encodeURIComponent()` in JavaScript

---

## 📞 SUPPORTO

Per problemi con il webhook:
1. Testa l'URL direttamente nel browser
2. Verifica la risposta JSON
3. Controlla i log backend: `/var/log/supervisor/backend.out.log`
4. Usa il comando:
   ```bash
   tail -f /var/log/supervisor/backend.out.log | grep "webhook"
   ```
