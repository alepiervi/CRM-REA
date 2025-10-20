# 🌱 Script di Seeding Database - Nureal CRM

## Descrizione

Questo script popola il database MongoDB con i dati iniziali necessari per il funzionamento del Nureal CRM, inclusi:

- **Utente Admin** (se non esiste)
- **Commesse** (Fastweb, Fotovoltaico, Telepass)
- **Servizi** (TLS, NEGOZI, IMPIANTI FOTOVOLTAICI, TELEPASS MOBILITY)
- **Tipologie Contratto** (Energia Fastweb, Telefonia Fastweb, HO Mobile, etc.)
- **Segmenti** (Privato e Business per ogni tipologia)
- **Offerte** (Energia, Telefonia, Fotovoltaico, Telepass)

## 📋 Prerequisiti

- MongoDB in esecuzione e accessibile
- File `.env` configurato con `MONGO_URL` e `DB_NAME`
- Python 3.8+ con le librerie necessarie installate

## 🚀 Come Eseguire lo Script

### Metodo 1: Esecuzione Diretta

```bash
cd /app/backend
python seed_database.py
```

### Metodo 2: Esecuzione come Script

```bash
cd /app/backend
chmod +x seed_database.py
./seed_database.py
```

## 📊 Dati Creati

### Commesse

1. **Fastweb**
   - Entity Type: Clienti
   - WhatsApp: ✅ | AI: ❌ | Call Center: ✅
   - Document Management: Clienti Only
   - Servizi: TLS, NEGOZI

2. **Fotovoltaico**
   - Entity Type: Lead
   - WhatsApp: ✅ | AI: ✅ | Call Center: ❌
   - Document Management: Lead Only
   - Servizi: IMPIANTI FOTOVOLTAICI

3. **Telepass**
   - Entity Type: Clienti
   - WhatsApp: ❌ | AI: ❌ | Call Center: ✅
   - Document Management: Clienti Only
   - Servizi: TELEPASS MOBILITY

### Servizi

- **TLS** (Fastweb): Telefonia, Luce e Servizi
- **NEGOZI** (Fastweb): Vendita presso punti vendita fisici
- **IMPIANTI FOTOVOLTAICI** (Fotovoltaico)
- **TELEPASS MOBILITY** (Telepass)

### Tipologie Contratto

Per Fastweb (TLS):
- Energia Fastweb
- Telefonia Fastweb
- HO Mobile

Per Fastweb (NEGOZI):
- Vendita Negozio

Per Fotovoltaico:
- Fotovoltaico Residenziale

Per Telepass:
- Telepass

### Segmenti

Per ogni tipologia contratto vengono creati 2 segmenti:
- **Privato**
- **Business**

### Offerte

#### Energia (2 offerte)
- Energia Casa 100%
- Energia Business Plus

#### Telefonia/Mobile (3 offerte)
- Fastweb Casa Light - 100GB
- Fastweb Casa - 200GB
- HO Mobile 100GB

#### Fotovoltaico (2 offerte)
- Fotovoltaico 3 kW
- Fotovoltaico 6 kW + Accumulo

#### Telepass (2 offerte)
- Telepass Base
- Telepass Plus con OBU

## 🔑 Credenziali di Default

Dopo l'esecuzione dello script, potrai accedere al CRM con:

- **Username**: `admin`
- **Password**: `admin123`

## ⚠️ Note Importanti

### Sicurezza dello Script

Lo script è **idempotente**: se eseguito più volte, non creerà dati duplicati. Controlla l'esistenza dei dati prima di inserirli.

### Comportamento su Dati Esistenti

- Se un utente admin esiste già, verrà utilizzato quello esistente
- Se commesse/servizi/tipologie esistono già, non verranno create nuove (skip)
- Il conteggio finale mostrerà TUTTI i record presenti nel database, non solo quelli nuovi

### Personalizzazione

Per personalizzare i dati di seeding, modifica direttamente il file `seed_database.py`:

- **Linea 97-173**: Definizione commesse
- **Linea 180-233**: Definizione servizi
- **Linea 240-311**: Definizione tipologie contratto
- **Linea 318-351**: Definizione segmenti
- **Linea 358-435**: Definizione offerte

## 🔍 Verifica Post-Seeding

Dopo l'esecuzione, lo script mostrerà un riepilogo:

```
📊 Riepilogo Database:
   👤 Utenti: X
   📋 Commesse: X
   🔧 Servizi: X
   📑 Tipologie Contratto: X
   🏢 Segmenti: X
   💰 Offerte: X
```

### Test Manuale

Puoi verificare il corretto funzionamento accedendo all'applicazione:

1. Effettua login con `admin/admin123`
2. Vai su "Clienti" → "Nuovo Cliente"
3. Verifica che i dropdown della filiera (Commessa → Servizio → Tipologia → Segmento) siano popolati
4. Prova a creare un cliente di test

### Test Automatico

È disponibile uno script di test automatico che verifica il corretto funzionamento post-seeding:

```bash
cd /app/backend
python post_seeding_test.py
```

Questo script testa:
- Login admin
- Disponibilità commesse, servizi, tipologie, segmenti
- Funzionamento cascading filiera
- Creazione di un cliente di test
- Verifica persistenza dati

## 🐛 Troubleshooting

### Errore di Connessione MongoDB

```
❌ Errore durante il seeding: ...
```

**Soluzione**: Verifica che MongoDB sia in esecuzione e che le variabili `MONGO_URL` e `DB_NAME` nel file `.env` siano corrette.

### Password già esistente per admin

Se l'utente admin esiste già con una password diversa, lo script non la modificherà. Per reimpostare la password:

1. Elimina manualmente l'utente admin dal database
2. Ri-esegui lo script

### Database completamente vuoto dopo deployment

Questo era il problema originale: il database di produzione era vuoto dopo il deployment. Lo script di seeding risolve questo problema popolando il database con tutti i dati necessari.

## 📝 Log di Esecuzione

Lo script fornisce output dettagliato durante l'esecuzione:

- ✅ Successo operazione
- ⚠️  Warning (dati già esistenti, operazione saltata)
- ❌ Errore critico

## 🔄 Deployment

Per eseguire lo script in ambiente di produzione:

1. Assicurati che le variabili d'ambiente siano configurate correttamente
2. Esegui lo script PRIMA del primo avvio dell'applicazione
3. Verifica che il seeding sia completato con successo
4. Avvia l'applicazione

## 📧 Supporto

Per problemi o domande, contatta il team di sviluppo.

---

**Versione**: 1.0.0  
**Ultima modifica**: 2025-01-20  
**Autore**: AI Engineer - Emergent Agent
