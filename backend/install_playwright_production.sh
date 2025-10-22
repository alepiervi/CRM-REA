#!/bin/bash
# Script to install Playwright browsers in production
# This runs automatically after deployment

set -e  # Exit on error

echo "🎭 Installing Playwright browsers for production..."

# Install Chromium browser
python -m playwright install chromium

# Install system dependencies (may require sudo, try anyway)
python -m playwright install-deps chromium 2>/dev/null || echo "⚠️  System deps installation skipped (needs sudo)"

echo "✅ Playwright browser installation complete!"
echo "📝 Creating marker file..."

# Create marker file to indicate successful installation
touch /tmp/playwright_installed

echo "🎉 Playwright ready for Aruba Drive uploads!"
