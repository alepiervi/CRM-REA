# Test Credentials CRM Nureal

## Admin principale
- **username**: `admin`
- **password**: `admin123`

## Utente di test per il sistema di Lock Cliente (creato 27 Feb 2026)
- **username**: `lock_tester`
- **password**: `test12345`
- **role**: admin
- Usato per validare il flusso lucchetto su anagrafica Cliente (utente A acquisisce lock, utente B vede 409 / ClienteLockedScreen, admin può forzare sblocco)
- NOTA: il flag `password_change_required` è stato rimosso dal DB per permettere il login UI diretto senza dialog di cambio password

## Modulo Segnalatori (creati per test sezione Segnalatori)
- **segnalatore_test** / `test12345` — role `segnalatore`, commessa Fastweb, servizio TLS
- **bo_segn_test** / `test12345` — role `backoffice_commessa`, commessa Fastweb (tutti i servizi)
- **bo_segn_test2** / `test12345` — role `backoffice_commessa`, commessa Fastweb (per test presa in carico)
- **visualizzatore_test** / `test12345` — role `visualizzatore` (sola lettura di tutte le segnalazioni)
