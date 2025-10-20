#!/usr/bin/env python3
"""
Script di seeding per il database MongoDB del Nureal CRM.
Crea SOLO l'utente admin iniziale.
Tutto il resto (commesse, servizi, tipologie, etc.) deve essere creato dall'admin tramite interfaccia.
"""

import asyncio
import os
import sys
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timezone
import uuid
from passlib.context import CryptContext

# Setup path e environment
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']


async def seed_database():
    """Crea SOLO l'utente admin iniziale. Tutto il resto deve essere creato dall'admin tramite interfaccia."""
    
    print("🌱 Avvio seeding del database...")
    print(f"📊 Database: {db_name}")
    print(f"🔗 MongoDB URL: {mongo_url[:30]}...")
    print("\n⚠️  NOTA: Questo script crea SOLO l'utente admin.")
    print("   Commesse, servizi, tipologie, sub agenzie, offerte, etc.")
    print("   devono essere creati dall'admin tramite interfaccia UI.\n")
    
    # Connetti al database
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Verifica connessione
        await client.admin.command('ping')
        print("✅ Connessione al database riuscita!")
        
        # ============================================
        # CREAZIONE UTENTE ADMIN
        # ============================================
        print("\n📝 Creazione utente admin...")
        
        # Verifica se admin esiste già
        existing_admin = await db.users.find_one({"username": "admin"})
        
        if existing_admin:
            print("⚠️  Utente admin già esistente. Skip.")
            admin_id = existing_admin["id"]
            print(f"   ID: {admin_id}")
        else:
            admin_id = str(uuid.uuid4())
            admin_user = {
                "id": admin_id,
                "username": "admin",
                "email": "admin@nureal.it",
                "password_hash": pwd_context.hash("admin123"),
                "role": "admin",
                "is_active": True,
                "commesse_autorizzate": [],
                "servizi_autorizzati": [],
                "sub_agenzie_autorizzate": [],
                "entity_management": "both",
                "password_last_changed": datetime.now(timezone.utc),
                "created_at": datetime.now(timezone.utc)
            }
            
            await db.users.insert_one(admin_user)
            print(f"✅ Utente admin creato con ID: {admin_id}")
            print("   Username: admin")
            print("   Password: admin123")
        
        # ============================================
        # VERIFICA FINALE
        # ============================================
        print("\n🔍 Verifica finale del database...")
        
        count_users = await db.users.count_documents({})
        count_commesse = await db.commesse.count_documents({})
        count_servizi = await db.servizi.count_documents({})
        count_sub_agenzie = await db.sub_agenzie.count_documents({})
        count_tipologie = await db.tipologie_contratto.count_documents({})
        count_segmenti = await db.segmenti.count_documents({})
        count_offerte = await db.offerte.count_documents({})
        
        print(f"\n📊 Stato Database:")
        print(f"   👤 Utenti: {count_users}")
        print(f"   📋 Commesse: {count_commesse}")
        print(f"   🔧 Servizi: {count_servizi}")
        print(f"   🏢 Sub Agenzie: {count_sub_agenzie}")
        print(f"   📑 Tipologie Contratto: {count_tipologie}")
        print(f"   🎯 Segmenti: {count_segmenti}")
        print(f"   💰 Offerte: {count_offerte}")
        
        print("\n✅ Seeding completato con successo!")
        print("\n🔑 Credenziali di accesso:")
        print("   Username: admin")
        print("   Password: admin123")
        
        print("\n📝 PROSSIMI PASSI:")
        print("   1. Accedi all'applicazione con le credenziali admin")
        print("   2. Vai su 'Gestione' → 'Commesse' e crea le commesse necessarie")
        print("   3. Per ogni commessa, crea i servizi associati")
        print("   4. Per ogni servizio, crea le tipologie contratto")
        print("   5. Per ogni tipologia, crea i segmenti (Privato/Business)")
        print("   6. Crea le offerte per ogni commessa")
        print("   7. Crea le sub agenzie e assegna commesse/servizi autorizzati")
        print("   8. Crea gli utenti e assegna i ruoli appropriati")
        
    except Exception as e:
        print(f"\n❌ Errore durante il seeding: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    finally:
        client.close()
        print("\n🔒 Connessione al database chiusa.")


if __name__ == "__main__":
    print("=" * 80)
    print("🌱 NUREAL CRM - SCRIPT DI SEEDING DATABASE (SOLO ADMIN)")
    print("=" * 80)
    
    asyncio.run(seed_database())
    
    print("\n" + "=" * 80)
    print("✅ SEEDING TERMINATO")
    print("=" * 80)
