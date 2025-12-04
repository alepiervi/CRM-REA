# 🌱 Script di Seeding Database - Nureal CRM

## ⚠️ IMPORTANTE: Sistema Dinamico

Il Nureal CRM è un **sistema completamente dinamico**. Lo script di seeding crea **SOLO l'utente admin iniziale**.

**Tutti gli altri dati** (commesse, servizi, tipologie, segmenti, offerte, sub agenzie) **devono essere creati dall'admin tramite l'interfaccia UI**.

## 📋 Cosa Fa lo Script

Lo script di seeding (`seed_database.py`) esegue UNA SOLA operazione:

✅ **Crea l'utente admin** (se non esiste già)
- Username: `admin`
- Password: `admin123`
- Role: `admin`

## ❌ Cosa NON Fa lo Script

Lo script **NON** crea:
- ❌ Commesse
- ❌ Servizi
- ❌ Tipologie Contratto
- ❌ Segmenti
- ❌ Offerte
- ❌ Sub Agenzie
- ❌ Altri utenti

**Questi dati devono essere creati dall'admin tramite l'interfaccia UI.**

## 🚀 Come Usare

### 1. Eseguire lo Script

```bash
cd /app/backend
python seed_database.py
```

### 2. Accedere all'Applicazione

Dopo l'esecuzione dello script:

1. Vai su: `https://crm-workflow-boost.preview.emergentagent.com`
2. Accedi con:
   - **Username**: `admin`
   - **Password**: `admin123`

### 3. Creare i Dati Necessari

Segui questo ordine per creare i dati tramite interfaccia:

#### **Step 1: Creare Commesse**
1. Vai su **Gestione** → **Commesse**
2. Click su **Nuova Commessa**
3. Compila i campi:
   - Nome (es. "Fastweb")
   - Descrizione
   - Descrizione Interna
   - Entity Type (clienti/lead/both)
   - Feature Flags (has_whatsapp, has_ai, has_call_center)
   - Document Management
4. Click **Salva**

#### **Step 2: Creare Servizi per Commessa**
1. Vai su **Gestione** → **Servizi**
2. Click su **Nuovo Servizio**
3. Seleziona la **Commessa** creata
4. Inserisci **Nome** e **Descrizione**
5. Click **Salva**

#### **Step 3: Creare Tipologie Contratto per Servizio**
1. Vai su **Gestione** → **Tipologie Contratto**
2. Click su **Nuova Tipologia**
3. Seleziona il **Servizio** creato
4. Inserisci **Nome** e **Descrizione**
5. Click **Salva**

#### **Step 4: Creare Segmenti per Tipologia**
1. Vai su **Gestione** → **Segmenti**
2. Click su **Nuovo Segmento**
3. Seleziona la **Tipologia Contratto** creata
4. Scegli il **Tipo** (Privato o Business)
5. Click **Salva**
6. **Ripeti** per creare anche l'altro segmento

**Nota**: Puoi anche usare la funzione di **migrazione automatica segmenti** che crea automaticamente Privato e Business per tutte le tipologie.

#### **Step 5: Creare Offerte per Commessa**
1. Vai su **Gestione** → **Offerte**
2. Click su **Nuova Offerta**
3. Seleziona la **Commessa**
4. Inserisci **Nome** e **Descrizione**
5. Click **Salva**

#### **Step 6: Creare Sub Agenzie**
1. Vai su **Gestione** → **Sub Agenzie**
2. Click su **Nuova Sub Agenzia**
3. Inserisci **Nome** e **Descrizione**
4. Seleziona il **Responsabile**
5. Seleziona le **Commesse Autorizzate** (checkbox)
6. Seleziona i **Servizi Autorizzati** (checkbox)
7. Click **Salva**

#### **Step 7: Creare Altri Utenti**
1. Vai su **Gestione** → **Utenti**
2. Click su **Nuovo Utente**
3. Compila i campi richiesti
4. Seleziona il **Ruolo** appropriato
5. Assegna **Commesse** e **Servizi** autorizzati (se necessario)
6. Assegna **Sub Agenzie** autorizzate (per Area Manager)
7. Click **Salva**

#### **Step 8: Creare Clienti**
1. Vai su **Clienti**
2. Click su **Nuovo Cliente**
3. Compila il form seguendo la **filiera cascading**:
   - Sub Agenzia → Commessa → Servizio → Tipologia → Segmento
4. Inserisci i dati del cliente
5. Click **Salva**

## 🎯 Vantaggi del Sistema Dinamico

✅ **Flessibilità Totale**: Ogni installazione può avere la propria struttura dati
✅ **Nessun Dato Hardcoded**: Non ci sono dati pre-popolati che potrebbero non essere rilevanti
✅ **Scalabilità**: Aggiungi nuove commesse, servizi, tipologie quando necessario
✅ **Controllo Completo**: L'admin ha pieno controllo su tutta la struttura dati
✅ **Ambiente Pulito**: Deployment in produzione parte con database pulito (solo admin)

## 📊 Verifica Sistema

Dopo aver creato i dati, verifica che tutto funzioni:

### Test Cascading Filiera

1. Vai su **Clienti** → **Nuovo Cliente**
2. Verifica che i dropdown si popolino in cascata:
   - Seleziona **Sub Agenzia** → vedi le **Commesse** associate
   - Seleziona **Commessa** → vedi i **Servizi** associati
   - Seleziona **Servizio** → vedi le **Tipologie** associate
   - Seleziona **Tipologia** → vedi i **Segmenti** associati
3. Se la filiera funziona correttamente, il sistema è configurato bene

### Test Creazione Cliente

1. Compila tutti i campi del form cliente
2. Click **Salva**
3. Verifica che il cliente venga creato
4. Verifica che il cliente sia visibile nella lista clienti

## 🔍 Troubleshooting

### Problema: Dropdown vuoti nella creazione cliente

**Causa**: Manca qualche dato nella filiera (commessa, servizio, tipologia, segmento)

**Soluzione**: 
1. Verifica che hai creato almeno una commessa
2. Verifica che la commessa abbia almeno un servizio
3. Verifica che il servizio abbia almeno una tipologia
4. Verifica che la tipologia abbia almeno un segmento (Privato o Business)

### Problema: Non posso selezionare una commessa nella creazione cliente

**Causa**: La sub agenzia non ha commesse autorizzate

**Soluzione**:
1. Vai su **Gestione** → **Sub Agenzie**
2. Modifica la sub agenzia
3. Seleziona le **Commesse Autorizzate**
4. Salva

### Problema: Non posso selezionare un servizio

**Causa**: La sub agenzia non ha servizi autorizzati O il servizio non appartiene alla commessa selezionata

**Soluzione**:
1. Vai su **Gestione** → **Sub Agenzie**
2. Modifica la sub agenzia
3. Seleziona i **Servizi Autorizzati**
4. Assicurati che i servizi appartengano alle commesse autorizzate
5. Salva

## 🔄 Reset Database

Se vuoi ricominciare da zero:

1. Elimina tutti i dati tramite interfaccia admin
2. Oppure elimina il database MongoDB e riesegui lo script:

```bash
# Connetti a MongoDB
mongo

# Elimina il database
use crm_database
db.dropDatabase()

# Riesegui lo script di seeding
cd /app/backend
python seed_database.py
```

## 📝 Note Tecniche

### Idempotenza

Lo script è **idempotente**: se eseguito più volte, non crea duplicati dell'utente admin.

### API Endpoints per Creazione Dati

Gli endpoint API usati dall'interfaccia admin per creare i dati sono:

- `POST /api/commesse` - Crea commessa
- `POST /api/servizi` - Crea servizio
- `POST /api/tipologie-contratto` - Crea tipologia
- `POST /api/segmenti` - Crea segmento
- `POST /api/offerte` - Crea offerta
- `POST /api/sub-agenzie` - Crea sub agenzia
- `POST /api/users` - Crea utente

Tutti questi endpoint sono accessibili solo agli utenti con ruolo **admin**.

## 🎓 Best Practices

### Ordine di Creazione Consigliato

1. **Commesse** (le macro-aree di lavoro)
2. **Servizi** (cosa offri per ogni commessa)
3. **Tipologie Contratto** (tipi di contratto per ogni servizio)
4. **Segmenti** (privato/business per ogni tipologia)
5. **Offerte** (prodotti specifici per ogni commessa)
6. **Sub Agenzie** (con autorizzazioni su commesse e servizi)
7. **Utenti** (con ruoli e autorizzazioni appropriate)

### Naming Conventions

- **Commesse**: Nome chiaro e descrittivo (es. "Fastweb", "Fotovoltaico")
- **Servizi**: Sigla o nome breve (es. "TLS", "NEGOZI")
- **Tipologie**: Nome completo descrittivo (es. "Energia Fastweb", "Telefonia Fastweb")
- **Segmenti**: Sempre "Privato" o "Business"
- **Offerte**: Nome commerciale comprensibile (es. "Fastweb Casa 100GB")

---

**Versione**: 2.0.0 (Sistema Dinamico)  
**Ultima modifica**: 2025-01-20  
**Autore**: AI Engineer - Emergent Agent
