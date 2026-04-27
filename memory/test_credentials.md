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
