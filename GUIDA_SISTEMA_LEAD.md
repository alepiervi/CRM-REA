# 📘 Guida Sistema Lead con Unit - Nureal CRM

## 🎯 Panoramica

Il sistema Lead permette di gestire lead provenienti da campagne pubblicitarie social (tramite Zapier) e assegnarli automaticamente agli agenti in base a criteri intelligenti (provincia, carico di lavoro, performance).

---

## 📋 Componenti Principali

### 1. **Unit (Unità Operative)**
Le Unit sono contenitori che raggruppano:
- **Campagne pubblicitarie specifiche**
- **Agenti autorizzati**
- **Status personalizzati** per i lead

**Esempio:** 
- Unit "Social Milano" gestisce campagne Facebook/Instagram per Milano
- Ha 5 agenti assegnati che coprono diverse province lombarde

### 2. **Lead**
Un lead rappresenta un potenziale cliente che:
- Arriva da una campagna pubblicitaria
- Viene assegnato automaticamente a un agente
- Ha uno status dinamico che cambia durante la lavorazione

**Campi principali:**
- **Dati personali**: Nome, Cognome, Telefono, Email, Indirizzo
- **Provenienza**: Campagna, Inserzione, URL, IP
- **Localizzazione**: Provincia, Regione
- **Status**: Status dinamico (es: Nuovo, Contattato, Convertito)
- **Assegnazione**: Agente assegnato, Data assegnazione
- **Performance**: Tempo di gestione in minuti

### 3. **Status Dinamici**
Ogni Unit può avere status personalizzati per tracciare il ciclo di vita del lead:
- **Globali**: Visibili a tutte le Unit (es: "Nuovo", "Chiuso")
- **Specifici Unit**: Solo per una Unit (es: "In attesa documentazione")
- **Configurabili**: Nome, Ordine, Colore

---

## 🔄 Flusso Operativo Completo

### **FASE 1: Configurazione Iniziale (Admin)**

#### 1.1 Creare una Unit
1. Vai su **Gestione Unit** (menu Admin)
2. Clicca **"Nuova Unit"**
3. Compila:
   - **Nome Unit**: Es. "Social Milano"
   - **Commessa**: Seleziona commessa di riferimento
   - **Campagne Autorizzate**: Aggiungi nomi campagne (es. "FB_Milano_2025", "IG_Lombardia")
4. Salva

**✅ Risultato**: La Unit è pronta per ricevere lead dalle campagne specificate.

#### 1.2 Configurare Status Lead
1. Vai su **Gestione Status Lead** (menu Admin)
2. Clicca **"Nuovo Status"**
3. Compila:
   - **Nome**: Es. "In Lavorazione"
   - **Unit**: Seleziona Unit o lascia vuoto per status globale
   - **Ordine**: Numero per ordinamento (0, 10, 20...)
   - **Colore**: Scegli colore identificativo
4. Salva

**Status Consigliati:**
- ✨ Nuovo (globale, colore blu)
- 📞 Contattato (globale, colore giallo)
- 📝 In Lavorazione (per unit, colore arancione)
- ✅ Convertito (globale, colore verde)
- ❌ Non Interessato (globale, colore rosso)

#### 1.3 Configurare Agenti
1. Vai su **Gestione Utenti**
2. Crea o modifica un agente (ruolo: "Agente")
3. Configura:
   - **Unit Autorizzate**: Seleziona le Unit per cui l'agente può ricevere lead
   - **Province Autorizzate**: Aggiungi province (es. Milano, Roma, Napoli)
   - **Referente**: Assegna un Referente che supervisionerà l'agente
4. Salva

**Esempio Configurazione Agente:**
```
Nome: Mario Rossi
Ruolo: Agente
Unit Autorizzate: ["Social Milano", "Social Roma"]
Province: ["Milano", "Monza", "Como"]
Referente: Luca Bianchi (Referente)
```

---

### **FASE 2: Integrazione Zapier**

#### 2.1 Configurare Webhook Zapier
**Endpoint Webhook:** 
```
POST https://tuodominio.com/api/webhook/{unit_id}
```

**Come ottenere unit_id:**
1. Vai su **Gestione Unit**
2. Trova la Unit desiderata
3. L'ID è visibile nella tabella o nell'URL quando modifichi

#### 2.2 Mappare i Campi in Zapier
Nel tuo Zap, configura i campi così:

**Campi Obbligatori:**
```json
{
  "nome": "{{Nome da form}}",
  "cognome": "{{Cognome da form}}",
  "telefono": "{{Telefono da form}}",
  "email": "{{Email da form}}",
  "provincia": "{{Provincia da form}}",
  "campagna": "{{Nome campagna}}",  // IMPORTANTE: Deve corrispondere a una campagna autorizzata nella Unit
  "ip_address": "{{IP utente}}"
}
```

**Campi Opzionali:**
```json
{
  "indirizzo": "{{Indirizzo completo}}",
  "regione": "{{Regione}}",
  "inserzione": "{{Nome inserzione}}",
  "url": "{{URL landing page}}",
  "otp": "{{Codice OTP se presente}}",
  "tipologia_abitazione": "{{Casa/Appartamento/etc}}"
}
```

**⚠️ IMPORTANTE**: 
- Il campo `campagna` deve essere **esattamente** uno dei nomi nelle "Campagne Autorizzate" della Unit
- Il campo `provincia` deve corrispondere a una delle province autorizzate degli agenti

#### 2.3 Testare il Webhook
1. Invia un lead di test da Zapier
2. Controlla nei log del backend: `/var/log/supervisor/backend.out.log`
3. Verifica nella sezione **Lead** che il lead sia stato creato e assegnato

---

### **FASE 3: Assegnazione Automatica (Sistema)**

Quando arriva un nuovo lead via webhook, il sistema:

#### 3.1 Validazione
1. ✅ Verifica che la Unit esista
2. ✅ Verifica che la campagna sia autorizzata per quella Unit
3. ✅ Valida i dati obbligatori (nome, cognome, email, telefono)

#### 3.2 Ricerca Agenti Idonei
Il sistema trova agenti che hanno:
- ✅ Unit autorizzata corrispondente
- ✅ Provincia autorizzata corrispondente
- ✅ Account attivo (`is_active: true`)
- ✅ Ruolo: Agente

#### 3.3 Calcolo Score Intelligente
Per ogni agente idoneo, calcola uno score basato su:

**Formula:**
```
Score = (Lead aperti × 0.7) + (Tempo medio gestione in ore × 0.3)
```

**Componenti:**
- **Lead aperti** (70%): Numero di lead ancora in lavorazione (non chiusi)
- **Tempo medio gestione** (30%): Performance storica dell'agente (minuti → ore)

**Esempio:**
```
Agente A: 5 lead aperti, tempo medio 120 min = Score: 4.1
Agente B: 3 lead aperti, tempo medio 180 min = Score: 3.0 ← Vincitore!
Agente C: 8 lead aperti, tempo medio 90 min = Score: 6.1
```

#### 3.4 Assegnazione
Il lead viene assegnato all'agente con **score più basso** (meno carico + migliore performance).

**Cosa succede se non trova agenti:**
- Lead viene comunque creato
- Campo `assigned_agent_id` rimane vuoto
- Admin può assegnarlo manualmente

---

### **FASE 4: Lavorazione Lead (Agente)**

#### 4.1 Accesso Lead Assegnati
1. L'agente fa login
2. Accede alla sezione **Lead**
3. Vede **SOLO i suoi lead assegnati**

**Filtri Disponibili:**
- 📊 Status
- 📍 Provincia
- 📅 Periodo creazione
- 🎯 Campagna

#### 4.2 Gestione Lead
1. **Visualizzare dettagli**: Clicca su un lead
2. **Aggiornare status**: 
   - Seleziona nuovo status dal dropdown
   - Status disponibili: quelli della Unit + globali
3. **Aggiungere note**: Campo note per commenti
4. **Cambiare esito**: Se usa ancora campo "esito" (legacy)

#### 4.3 Chiusura Lead
Quando un lead viene chiuso (status: "Convertito", "Perso", "Non Interessato"):
- ✅ Sistema registra `closed_at` (data/ora chiusura)
- ✅ Calcola `tempo_gestione_minuti` automaticamente
- ✅ Questo dato viene usato per il calcolo performance futuro

**Esempio:**
```
Lead creato: 2025-01-15 10:00
Lead chiuso: 2025-01-15 12:30
Tempo gestione: 150 minuti
```

---

### **FASE 5: Supervisione (Referente)**

#### 5.1 Dashboard Referente
1. Il Referente fa login
2. Accede alla sezione **Lead**
3. Vede lead di **tutti i suoi agenti** (quelli con `referente_id` impostato)

#### 5.2 Monitoraggio
- **Performance agenti**: Tempo medio gestione
- **Carico lavoro**: Lead aperti per agente
- **Conversioni**: Lead convertiti vs persi
- **Status**: Distribuzione lead per status

---

## 🔧 Configurazioni Avanzate

### Personalizzare Status per Unit Diverse

**Scenario**: Unit "Social Milano" vuole status diversi da "Social Roma"

**Soluzione:**
1. Crea status specifici per "Social Milano":
   - "In attesa callback Milano"
   - "Promo Milano attiva"
2. Crea status specifici per "Social Roma":
   - "In attesa callback Roma"
   - "Promo Roma attiva"
3. Gli agenti vedranno solo gli status della loro Unit + globali

### Gestire Province Sovrapposte

**Scenario**: Milano è coperta da 2 agenti

**Soluzione:**
- Entrambi agenti hanno "Milano" in province autorizzate
- Sistema assegna al meno carico automaticamente
- Distribuzione equa garantita dall'algoritmo

### Cambiare Assegnazione Manualmente

**Scenario**: Lead assegnato a agente in ferie

**Soluzione:**
1. Admin accede al lead
2. Clicca "Modifica"
3. Cambia `assigned_agent_id` manualmente
4. Salva

---

## 📊 Dashboard e Report

### Metriche Disponibili

**Per Agente:**
- Lead assegnati totali
- Lead aperti
- Lead chiusi
- Tempo medio gestione
- Tasso conversione

**Per Unit:**
- Lead ricevuti per campagna
- Performance complessiva
- Distribuzione per status
- Province più attive

**Per Referente:**
- Performance team
- Confronto agenti
- Trend temporali

---

## 🚨 Troubleshooting

### Lead Non Viene Assegnato

**Problema**: Lead creato ma nessun agente assegnato

**Verifica:**
1. ✅ Campagna corrisponde a quelle autorizzate nella Unit?
2. ✅ C'è almeno un agente con quella provincia autorizzata?
3. ✅ Agente è attivo (`is_active: true`)?
4. ✅ Agente ha la Unit autorizzata?

**Soluzione**: Controlla configurazione agenti e Unit

### Lead Non Arriva da Zapier

**Problema**: Webhook non funziona

**Verifica:**
1. ✅ URL webhook corretto con `unit_id` giusto?
2. ✅ Campi obbligatori presenti (nome, cognome, email, telefono)?
3. ✅ Campo `campagna` compilato?
4. ✅ Controlla log backend: `tail -f /var/log/supervisor/backend.err.log`

### Agente Non Vede i Suoi Lead

**Problema**: Lista lead vuota per agente

**Verifica:**
1. ✅ Ruolo utente è "Agente"?
2. ✅ `unit_autorizzate` configurata?
3. ✅ Lead nella Unit giusta?
4. ✅ Lead effettivamente assegnato a questo agente?

---

## 📚 Esempi Pratici

### Esempio Completo: Setup "Unit Social Milano"

**Step 1: Creare Unit**
```
Nome: Social Milano
Commessa: Fastweb
Campagne: ["FB_Milano_Lead_2025", "IG_Milano_Casa"]
```

**Step 2: Creare Status**
```
- Nuovo (globale, blu)
- Contattato (globale, giallo)  
- Preventivo Inviato (Social Milano, arancione)
- Convertito (globale, verde)
- Perso (globale, rosso)
```

**Step 3: Configurare 3 Agenti**
```
Agente 1: Mario Rossi
  - Unit: Social Milano
  - Province: Milano, Monza
  
Agente 2: Luca Bianchi
  - Unit: Social Milano
  - Province: Milano, Como
  
Agente 3: Sara Verdi
  - Unit: Social Milano
  - Province: Varese, Lecco
```

**Step 4: Configurare Zapier**
```
Webhook URL: https://crm.example.com/api/webhook/abc-123-xyz
Mappatura:
  nome → {{Lead Nome}}
  cognome → {{Lead Cognome}}
  telefono → {{Lead Telefono}}
  email → {{Lead Email}}
  provincia → {{Lead Provincia}}
  campagna → "FB_Milano_Lead_2025"
```

**Step 5: Testare**
1. Invia lead di test da Milano
2. Sistema assegna a Mario o Luca (hanno Milano)
3. Sceglie quello con meno carico
4. Agente vede lead nella sua dashboard
5. Lavora il lead e cambia status

---

## ✅ Checklist Pre-Lancio

Prima di andare live con una nuova Unit:

- [ ] Unit creata con nome e commessa
- [ ] Campagne autorizzate aggiunte (match con Zapier)
- [ ] Status personalizzati creati (almeno 5)
- [ ] Agenti configurati con Unit e Province
- [ ] Referente assegnato agli agenti
- [ ] Webhook Zapier configurato con URL corretto
- [ ] Test webhook inviato e lead ricevuto
- [ ] Test assegnazione automatica funzionante
- [ ] Agenti hanno fatto login e vedono dashboard
- [ ] Referente vede lead degli agenti

---

## 🎓 Best Practices

1. **Nomi Campagne Consistenti**: Usa lo stesso nome in Zapier e Unit
2. **Province Standardizzate**: Usa nomi ufficiali (Milano, non MI)
3. **Status Chiari**: Nomi comprensibili (no sigle)
4. **Monitoraggio Regolare**: Controlla distribuzione lead settimanalmente
5. **Aggiorna Province**: Se espandi territorio, aggiungi province agli agenti
6. **Referenti Attivi**: Referente deve supervisionare performance team
7. **Tempo Gestione**: Chiudi lead tempestivamente per migliorare score

---

## 📞 Supporto

Per problemi o domande:
- Controlla questa guida
- Verifica log backend
- Testa con lead manuale prima di usare Zapier
- Usa sezione "Gestione Unit" per debug configurazione

**Fine della Guida** 🎉
