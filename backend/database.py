"""Connessione MongoDB condivisa (estratta da server.py - refactoring fase 2)."""
import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection with robust error handling for production
try:
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'crm_database')  # FIXED: Use correct default database name
    
    if not mongo_url:
        # Fallback for local development
        mongo_url = "mongodb://localhost:27017"
        logging.warning("⚠️ MONGO_URL not set, using localhost fallback")
    
    logging.info(f"🔗 Connecting to MongoDB: {mongo_url[:50]}...")
    logging.info(f"📊 Database: {db_name}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    logging.info("✅ MongoDB client initialized successfully")
except Exception as e:
    logging.error(f"❌ Failed to initialize MongoDB client: {e}")
    raise RuntimeError(f"MongoDB initialization failed: {e}")
