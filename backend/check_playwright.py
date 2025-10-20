#!/usr/bin/env python3
"""
Script per verificare e installare Playwright in produzione
"""

import sys
import subprocess
import asyncio
from playwright.async_api import async_playwright

async def check_playwright():
    """Verifica se Playwright funziona correttamente"""
    print("🔍 Verifica installazione Playwright...")
    
    try:
        # Test 1: Importazione
        print("✅ Playwright libreria importata correttamente")
        
        # Test 2: Avvio Playwright
        print("🔄 Test avvio Playwright...")
        playwright = await async_playwright().start()
        print("✅ Playwright avviato")
        
        # Test 3: Browser Chromium
        print("🔄 Test lancio browser Chromium...")
        browser = await playwright.chromium.launch(headless=True)
        print("✅ Browser Chromium lanciato")
        
        # Test 4: Pagina
        context = await browser.new_context()
        page = await context.new_page()
        print("✅ Pagina browser creata")
        
        # Cleanup
        await browser.close()
        await playwright.stop()
        
        print("\n" + "="*60)
        print("✅ PLAYWRIGHT FUNZIONA CORRETTAMENTE!")
        print("="*60)
        return True
        
    except Exception as e:
        print("\n" + "="*60)
        print(f"❌ ERRORE PLAYWRIGHT: {e}")
        print("="*60)
        print("\n📋 DIAGNOSI:")
        print(f"   Tipo errore: {type(e).__name__}")
        print(f"   Messaggio: {str(e)}")
        
        if "Executable doesn't exist" in str(e) or "Failed to launch" in str(e):
            print("\n🔧 SOLUZIONE:")
            print("   I browser Playwright non sono installati!")
            print("\n   Esegui questi comandi per installarli:")
            print("   1) python -m playwright install chromium")
            print("   2) python -m playwright install-deps chromium")
            print("   3) sudo supervisorctl restart backend")
            print("\n   OPPURE esegui lo script automatico:")
            print("   bash /app/backend/install_playwright.sh")
            
        return False

def install_playwright_browsers():
    """Installa i browser Playwright"""
    print("\n🔧 Installazione browser Playwright...")
    
    try:
        # Installa chromium
        print("📥 Installazione Chromium...")
        result = subprocess.run(
            [sys.executable, "-m", "playwright", "install", "chromium"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print("✅ Chromium installato")
        else:
            print(f"❌ Errore installazione Chromium: {result.stderr}")
            return False
        
        # Installa dipendenze
        print("📥 Installazione dipendenze sistema...")
        result = subprocess.run(
            [sys.executable, "-m", "playwright", "install-deps", "chromium"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print("✅ Dipendenze installate")
        else:
            print(f"⚠️  Avviso dipendenze: {result.stderr}")
            print("   (Potrebbe richiedere permessi sudo)")
        
        print("\n✅ Installazione completata!")
        print("   Riavvia il backend con: sudo supervisorctl restart backend")
        return True
        
    except Exception as e:
        print(f"❌ Errore durante installazione: {e}")
        return False

async def main():
    print("="*60)
    print("🎭 PLAYWRIGHT CHECKER & INSTALLER")
    print("="*60 + "\n")
    
    # Check se funziona
    works = await check_playwright()
    
    if not works:
        print("\n" + "?"*60)
        response = input("\n❓ Vuoi installare automaticamente i browser? (y/n): ")
        
        if response.lower() in ['y', 'yes', 's', 'si']:
            if install_playwright_browsers():
                print("\n🔄 Verifica finale...")
                await asyncio.sleep(2)
                await check_playwright()
    
    print("\n" + "="*60)
    print("Script terminato")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(main())
