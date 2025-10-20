#!/bin/bash
# Script per installare i browser Playwright in produzione

echo "🔧 Installazione browser Playwright per ambiente di produzione..."

# Installa i browser Playwright
python -m playwright install chromium

# Installa le dipendenze di sistema per Chromium
python -m playwright install-deps chromium

echo "✅ Installazione completata!"
echo "Riavviare il backend con: sudo supervisorctl restart backend"
