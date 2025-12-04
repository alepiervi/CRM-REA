# 📘 Guida Webhook Zapier per Lead Management

## 🎯 Architettura Implementata: Opzione B (Unit → Commesse)

Il sistema è stato aggiornato per utilizzare un'architettura basata su **Commesse** invece che solo su campagne.

### 📊 Struttura Dati

**Unit (Lead Management):**
```json
{
  "id": "unit-uuid",
  "nome": "AGN",
  "commessa_id": "commessa-principale-uuid",
  "commesse_autorizzate": ["commessa-1-uuid", "commessa-2-uuid"],
  "campagne_autorizzate": ["Campagna A", "Campagna B"],
  "is_active": true
}
```

**Lead:**
```json
{
  "nome": "Mario",
  "cognome": "Rossi",
  "telefono": "+39123456789",
  "email": "mario.rossi@example.com",
  "provincia": "Milano",
  "unit_id": "unit-uuid",
  "commessa_id": "commessa-uuid",
  "campagna": "Campagna A",
  "status": "nuovo"
}
```

---

## 🔗 Configurazione Webhook Zapier

### 1️⃣ Ottieni l'URL del Webhook

Ogni Unit ha un webhook univoco disponibile sia in **GET** che in **POST**:

**GET Webhook (Consigliato per Zapier e redirect URL):**
```
https://tuo-dominio.com/api/webhook/{unit_id}?nome=Mario&cognome=Rossi&telefono=3331234567&email=mario@example.com&provincia=Milano&commessa_id=abc123
```

**POST Webhook (Per integrazioni avanzate):**
```
https://tuo-dominio.com/api/webhook/{unit_id}
```

**Come trovare il `unit_id`:**
1. Vai su "Unit & Sub Agenzie" → tab "Unit"
2. Trova la Unit desiderata (es. "AGN")
3. Copia l'ID della Unit (visibile nella lista o nei dettagli)

**Esempio GET completo:**
```
https://lead2ai-flow.preview.emergentagent.com/api/webhook/251eb0e5-f4b3-4837-9f05-8f8eec6f62d0?nome=Mario&cognome=Rossi&telefono=3331234567&email=mario@example.com&provincia=Milano&commessa_id=abc123-def456&campagna=TestCampaign
```

---

### 2️⃣ Configura Zapier

#### **METODO A: GET Webhook (Più Semplice - Consigliato)**

**Trigger:** Form/Lead da fonte esterna (es. Facebook Lead Ads, Google Forms, ecc.)

**Action:** Webhooks by Zapier → GET Request

**URL:** Costruisci l'URL con i parametri query string:
```
https://tuo-dominio.com/api/webhook/{unit_id}?nome={{nome}}&cognome={{cognome}}&telefono={{telefono}}&email={{email}}&provincia={{provincia}}&commessa_id=ID_COMMESSA&campagna={{campagna}}
```

**Esempio pratico in Zapier:**
```
https://lead2ai-flow.preview.emergentagent.com/api/webhook/251eb0e5-f4b3-4837-9f05-8f8eec6f62d0?nome={{1. Nome}}&cognome={{1. Cognome}}&telefono={{1. Telefono}}&email={{1. Email}}&provincia={{1. Provincia}}&commessa_id=abc123-def456&campagna=Facebook2025
```

**Vantaggi GET:**
- ✅ Nessun header richiesto
- ✅ Nessun body JSON da configurare
- ✅ Facile da testare nel browser
- ✅ Ideale per redirect URL e link diretti

---

#### **METODO B: POST Webhook (Avanzato)**

**Trigger:** Form/Lead da fonte esterna

**Action:** Webhooks by Zapier → POST Request

**URL:** `https://tuo-dominio.com/api/webhook/{unit_id}`

**Method:** POST

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

**Body (JSON):**
```json
{
  "nome": "{{nome_campo_zapier}}",
  "cognome": "{{cognome_campo_zapier}}",
  "telefono": "{{telefono_campo_zapier}}",
  "email": "{{email_campo_zapier}}",
  "provincia": "{{provincia_campo_zapier}}",
  "commessa_id": "ID_DELLA_COMMESSA",
  "campagna": "Nome_Campagna_Opzionale",
  "tipologia_abitazione": "singola",
  "indirizzo": "{{indirizzo_opzionale}}",
  "regione": "{{regione_opzionale}}",
  "privacy_consent": true,
  "marketing_consent": true
}
```

---

### 3️⃣ Campi Obbligatori vs Opzionali

**✅ OBBLIGATORI:**
- `nome` (string)
- `cognome` (string)
- `telefono` (string)
- `email` (string)
- `provincia` (string) - **CRITICO per auto-assegnazione**
- `commessa_id` (string) - **NUOVO! Obbligatorio per associare il lead alla commessa**

**📌 OPZIONALI:**
- `campagna` (string) - Nome campagna per tracking
- `tipologia_abitazione` (enum: "singola", "bifamiliare", "condominio")
- `indirizzo` (string)
- `regione` (string)
- `url` (string) - URL sorgente
- `otp` (string) - Codice OTP se presente
- `inserzione` (string) - ID inserzione pubblicitaria
- `privacy_consent` (boolean, default: false)
- `marketing_consent` (boolean, default: false)
- `custom_fields` (object) - Campi personalizzati aggiuntivi

---

### 4️⃣ Come Ottenere il `commessa_id`

**Opzione A - Da Database (consigliato per sviluppatori):**
1. Vai su MongoDB o usa l'API `/api/commesse`
2. Trova la commessa desiderata (es. "Fotovoltaico")
3. Copia il campo `id`

**Opzione B - Da Frontend:**
1. Vai su "Commesse" nel menu admin
2. Clicca su "Modifica" sulla commessa desiderata
3. L'ID è visibile nell'URL o nei dettagli

**Esempio `commessa_id`:**
```
"abc123-def456-ghi789-jkl012"
```

---

## 🤖 Auto-Assegnazione Lead

Quando un lead arriva tramite webhook:

1. **Validazione Unit:** Verifica che `unit_id` nell'URL esista
2. **Validazione Commessa:** Verifica che `commessa_id` sia tra le commesse autorizzate della Unit
3. **Ricerca Agenti:** Trova agenti con:
   - `role = "agente"`
   - `is_active = true`
   - `unit_id = {unit_id_del_webhook}`
   - `provinces` contiene la `provincia` del lead
4. **Calcolo Score:** Algoritmo di bilanciamento carico:
   - 70% peso su numero lead aperti
   - 30% peso su tempo medio gestione
5. **Assegnazione:** Lead assegnato all'agente con score più basso (meno carico)

---

## ⚠️ Gestione Errori

### Errore 404 - Unit not found
```json
{
  "detail": "Unit not found"
}
```
**Causa:** `unit_id` nell'URL webhook non esiste
**Soluzione:** Verifica l'ID della Unit

### Errore 400 - Commessa not authorized
```json
{
  "detail": "Commessa {commessa_id} not authorized for this unit"
}
```
**Causa:** La `commessa_id` inviata non è tra le `commesse_autorizzate` della Unit
**Soluzione:** 
1. Verifica che la commessa sia associata alla Unit
2. Vai su "Unit & Sub Agenzie" → Modifica Unit → Aggiungi la commessa

### Errore 422 - Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "nome"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```
**Causa:** Campi obbligatori mancanti nel payload
**Soluzione:** Verifica che tutti i campi obbligatori siano presenti

---

## 🧪 Test Webhook

### **Test GET Webhook (Browser o cURL):**

**Nel Browser (più semplice):**
Apri questo URL nel browser (sostituisci con i tuoi dati):
```
https://lead2ai-flow.preview.emergentagent.com/api/webhook/251eb0e5-f4b3-4837-9f05-8f8eec6f62d0?nome=TestNome&cognome=TestCognome&telefono=3331234567&email=test@example.com&provincia=Milano&commessa_id=abc123
```

**Con cURL:**
```bash
curl "https://tuo-dominio.com/api/webhook/251eb0e5-f4b3-4837-9f05-8f8eec6f62d0?nome=Test&cognome=Lead&telefono=3331234567&email=test@example.com&provincia=Milano&commessa_id=abc123&campagna=TestCampaign"
```

---

### **Test POST Webhook (cURL):**

```bash
curl -X POST "https://tuo-dominio.com/api/webhook/251eb0e5-f4b3-4837-9f05-8f8eec6f62d0" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Test",
    "cognome": "Lead",
    "telefono": "+393331234567",
    "email": "test@example.com",
    "provincia": "Milano",
    "commessa_id": "abc123-def456-ghi789-jkl012",
    "campagna": "Test Campaign"
  }'
```

---

**Risposta Attesa (200 OK) per entrambi:**
```json
{
  "success": true,
  "lead_id": "lead-uuid",
  "assigned_agent_id": "agent-uuid-or-null",
  "message": "Lead created and assigned to agent"
}
```

---

## 📋 Checklist Pre-Produzione

Assicurati di aver completato questi passaggi prima di attivare il webhook in produzione:

- [ ] Unit creata con nome descrittivo
- [ ] Commessa principale associata alla Unit
- [ ] Commesse aggiuntive aggiunte a `commesse_autorizzate` (se necessario)
- [ ] Referente creato e associato alla Unit
- [ ] Agenti creati e associati alla Unit
- [ ] Province di copertura configurate per ogni Agente
- [ ] Servizi autorizzati configurati (se necessario)
- [ ] URL webhook testato con payload di esempio
- [ ] Zapier configurato con tutti i campi mappati correttamente
- [ ] Test end-to-end completato (da Zapier a assegnazione Agente)

---

## 🚀 Vantaggi Opzione B (Commesse)

✅ **Tracciabilità:** Ogni lead è associato a una commessa specifica
✅ **Reporting:** Puoi filtrare e analizzare lead per commessa
✅ **Flessibilità:** Una Unit può gestire più commesse contemporaneamente
✅ **Coerenza:** Architettura allineata con sistema Clienti
✅ **Scalabilità:** Facile aggiungere nuove commesse senza modificare il codice
✅ **Sicurezza:** Validazione automatica che il lead appartenga a una commessa autorizzata

---

## 📞 Supporto

Per domande o problemi con il webhook:
1. Verifica i log backend: `/var/log/supervisor/backend.out.log`
2. Controlla errori di validazione nel payload Zapier
3. Testa il webhook manualmente con cURL per isolare il problema
