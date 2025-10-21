#!/usr/bin/env python3
"""
Script per installare i browser Playwright.
Può essere eseguito manualmente o automaticamente all'avvio del server.

Questo script è necessario per il funzionamento di Aruba Drive upload in produzione.
"""

import subprocess
import sys
import asyncio
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

async def test_playwright():
    """Test se Playwright funziona"""
    try:
        from playwright.async_api import async_playwright
        logging.info("🔄 Testing Playwright...")
        
        pw = await async_playwright().start()
        browser = await pw.chromium.launch(headless=True)
        await browser.close()
        await pw.stop()
        
        logging.info("✅ Playwright is working correctly!")
        return True
    except Exception as e:
        logging.warning(f"❌ Playwright test failed: {e}")
        return False

def install_chromium():
    """Installa il browser Chromium per Playwright"""
    try:
        logging.info("📥 Installing Playwright Chromium browser...")
        
        result = subprocess.run(
            [sys.executable, "-m", "playwright", "install", "chromium"],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode == 0:
            logging.info("✅ Chromium installed successfully")
            logging.info(result.stdout)
            return True
        else:
            logging.error(f"❌ Failed to install Chromium: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        logging.error("❌ Installation timed out (>120s)")
        return False
    except Exception as e:
        logging.error(f"❌ Error during installation: {e}")
        return False

def install_deps():
    """Installa le dipendenze di sistema (potrebbe richiedere sudo)"""
    try:
        logging.info("📥 Installing system dependencies...")
        
        result = subprocess.run(
            [sys.executable, "-m", "playwright", "install-deps", "chromium"],
            capture_output=True,
            text=True,
            timeout=180
        )
        
        if result.returncode == 0:
            logging.info("✅ System dependencies installed successfully")
            return True
        else:
            logging.warning(f"⚠️  System dependencies installation had issues: {result.stderr}")
            logging.info("   (This may require sudo, but Playwright might still work)")
            return False
            
    except Exception as e:
        logging.warning(f"⚠️  Could not install system dependencies: {e}")
        logging.info("   (Playwright might still work without them)")
        return False

async def main():
    """Main installation flow"""
    print("=" * 60)
    print("🎭 PLAYWRIGHT BROWSER INSTALLER")
    print("=" * 60)
    print()
    
    # Test current state
    logging.info("Step 1: Testing current Playwright installation...")
    if await test_playwright():
        print()
        print("=" * 60)
        print("✅ Playwright is already working! No action needed.")
        print("=" * 60)
        return
    
    print()
    logging.info("Step 2: Installing Chromium browser...")
    if not install_chromium():
        print()
        print("=" * 60)
        print("❌ Failed to install Chromium browser")
        print("=" * 60)
        sys.exit(1)
    
    print()
    logging.info("Step 3: Installing system dependencies...")
    install_deps()  # Non-critical, ignore failure
    
    print()
    logging.info("Step 4: Final verification...")
    if await test_playwright():
        print()
        print("=" * 60)
        print("✅ SUCCESS! Playwright is now fully installed and working!")
        print("=" * 60)
        print()
        print("🎉 Aruba Drive upload will now work in production")
        print()
        print("Next steps:")
        print("  1. Restart your backend server")
        print("  2. Test document upload to verify Aruba Drive works")
    else:
        print()
        print("=" * 60)
        print("⚠️  Playwright installed but test still failing")
        print("=" * 60)
        print()
        print("This might happen if:")
        print("  - System dependencies are missing (try with sudo)")
        print("  - Running in restricted environment")
        print()
        print("Aruba Drive upload will fallback to local storage")

if __name__ == "__main__":
    asyncio.run(main())
