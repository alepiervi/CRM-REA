#!/usr/bin/env python3
"""
Script di seeding per il database MongoDB del Nureal CRM.
Popola il database con dati iniziali: Commesse, Servizi, Tipologie, Segmenti, Offerte e Utente Admin.
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
    print("   Commesse, servizi, tipologie, etc. devono essere creati dall'admin tramite interfaccia.\n")
    
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
        # 2. CREAZIONE COMMESSE
        # ============================================
        print("\n📝 Creazione commesse...")
        
        commesse = []
        
        # Commessa 1: Fastweb
        commessa_fastweb_id = str(uuid.uuid4())
        commessa_fastweb = {
            "id": commessa_fastweb_id,
            "nome": "Fastweb",
            "descrizione": "Gestione clienti Fastweb - Telefonia, Internet e Energia",
            "descrizione_interna": "Commessa principale per tutti i servizi Fastweb: telefonia fissa/mobile, fibra, energia elettrica e gas",
            "webhook_zapier": f"https://hooks.zapier.com/hooks/catch/{uuid.uuid4().hex[:8]}/{uuid.uuid4().hex[:8]}/",
            "entity_type": "clienti",
            "has_whatsapp": True,
            "has_ai": False,
            "has_call_center": True,
            "document_management": "clienti_only",
            "aruba_drive_config": None,
            "is_active": True,
            "responsabile_id": admin_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": None
        }
        commesse.append(commessa_fastweb)
        
        # Commessa 2: Fotovoltaico
        commessa_fotovoltaico_id = str(uuid.uuid4())
        commessa_fotovoltaico = {
            "id": commessa_fotovoltaico_id,
            "nome": "Fotovoltaico",
            "descrizione": "Gestione lead e vendita impianti fotovoltaici",
            "descrizione_interna": "Commessa dedicata alla generazione e qualificazione lead per impianti fotovoltaici residenziali e industriali",
            "webhook_zapier": f"https://hooks.zapier.com/hooks/catch/{uuid.uuid4().hex[:8]}/{uuid.uuid4().hex[:8]}/",
            "entity_type": "lead",
            "has_whatsapp": True,
            "has_ai": True,
            "has_call_center": False,
            "document_management": "lead_only",
            "aruba_drive_config": None,
            "is_active": True,
            "responsabile_id": admin_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": None
        }
        commesse.append(commessa_fotovoltaico)
        
        # Commessa 3: Telepass
        commessa_telepass_id = str(uuid.uuid4())
        commessa_telepass = {
            "id": commessa_telepass_id,
            "nome": "Telepass",
            "descrizione": "Gestione servizi Telepass e soluzioni mobilità",
            "descrizione_interna": "Vendita dispositivi Telepass, servizi OBU e soluzioni di pagamento per la mobilità",
            "webhook_zapier": f"https://hooks.zapier.com/hooks/catch/{uuid.uuid4().hex[:8]}/{uuid.uuid4().hex[:8]}/",
            "entity_type": "clienti",
            "has_whatsapp": False,
            "has_ai": False,
            "has_call_center": True,
            "document_management": "clienti_only",
            "aruba_drive_config": None,
            "is_active": True,
            "responsabile_id": admin_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": None
        }
        commesse.append(commessa_telepass)
        
        # Inserisci commesse
        existing_commesse = await db.commesse.count_documents({})
        if existing_commesse > 0:
            print(f"⚠️  Trovate {existing_commesse} commesse già esistenti. Skip inserimento.")
        else:
            await db.commesse.insert_many(commesse)
            print(f"✅ Create {len(commesse)} commesse:")
            print(f"   - Fastweb (ID: {commessa_fastweb_id})")
            print(f"   - Fotovoltaico (ID: {commessa_fotovoltaico_id})")
            print(f"   - Telepass (ID: {commessa_telepass_id})")
        
        # ============================================
        # 3. CREAZIONE SERVIZI
        # ============================================
        print("\n📝 Creazione servizi...")
        
        servizi = []
        
        # Servizi Fastweb
        servizio_tls_id = str(uuid.uuid4())
        servizio_tls = {
            "id": servizio_tls_id,
            "commessa_id": commessa_fastweb_id,
            "nome": "TLS",
            "descrizione": "Telefonia, Luce e Servizi Fastweb",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        }
        servizi.append(servizio_tls)
        
        servizio_negozi_id = str(uuid.uuid4())
        servizio_negozi = {
            "id": servizio_negozi_id,
            "commessa_id": commessa_fastweb_id,
            "nome": "NEGOZI",
            "descrizione": "Vendita Fastweb presso punti vendita fisici",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        }
        servizi.append(servizio_negozi)
        
        # Servizi Fotovoltaico
        servizio_fotovoltaico_id = str(uuid.uuid4())
        servizio_fotovoltaico = {
            "id": servizio_fotovoltaico_id,
            "commessa_id": commessa_fotovoltaico_id,
            "nome": "IMPIANTI FOTOVOLTAICI",
            "descrizione": "Vendita e installazione impianti fotovoltaici",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        }
        servizi.append(servizio_fotovoltaico)
        
        # Servizi Telepass
        servizio_telepass_id = str(uuid.uuid4())
        servizio_telepass = {
            "id": servizio_telepass_id,
            "commessa_id": commessa_telepass_id,
            "nome": "TELEPASS MOBILITY",
            "descrizione": "Dispositivi Telepass e servizi OBU",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        }
        servizi.append(servizio_telepass)
        
        # Inserisci servizi
        existing_servizi = await db.servizi.count_documents({})
        if existing_servizi > 0:
            print(f"⚠️  Trovati {existing_servizi} servizi già esistenti. Skip inserimento.")
        else:
            await db.servizi.insert_many(servizi)
            print(f"✅ Creati {len(servizi)} servizi:")
            print(f"   - TLS (Fastweb, ID: {servizio_tls_id})")
            print(f"   - NEGOZI (Fastweb, ID: {servizio_negozi_id})")
            print(f"   - IMPIANTI FOTOVOLTAICI (Fotovoltaico, ID: {servizio_fotovoltaico_id})")
            print(f"   - TELEPASS MOBILITY (Telepass, ID: {servizio_telepass_id})")
        
        # ============================================
        # 4. CREAZIONE TIPOLOGIE CONTRATTO
        # ============================================
        print("\n📝 Creazione tipologie contratto...")
        
        tipologie = []
        
        # Tipologie per TLS (Fastweb)
        tipologia_energia_fastweb_id = str(uuid.uuid4())
        tipologia_energia_fastweb = {
            "id": tipologia_energia_fastweb_id,
            "nome": "Energia Fastweb",
            "descrizione": "Contratti luce e gas Fastweb",
            "servizio_id": servizio_tls_id,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": None,
            "created_by": admin_id
        }
        tipologie.append(tipologia_energia_fastweb)
        
        tipologia_telefonia_fastweb_id = str(uuid.uuid4())
        tipologia_telefonia_fastweb = {
            "id": tipologia_telefonia_fastweb_id,
            "nome": "Telefonia Fastweb",
            "descrizione": "Contratti telefonia fissa e mobile Fastweb",
            "servizio_id": servizio_tls_id,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": None,
            "created_by": admin_id
        }
        tipologie.append(tipologia_telefonia_fastweb)
        
        tipologia_ho_mobile_id = str(uuid.uuid4())
        tipologia_ho_mobile = {
            "id": tipologia_ho_mobile_id,
            "nome": "HO Mobile",
            "descrizione": "Contratti mobile HO (brand Fastweb)",
            "servizio_id": servizio_tls_id,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": None,
            "created_by": admin_id
        }
        tipologie.append(tipologia_ho_mobile)
        
        # Tipologie per NEGOZI (Fastweb)
        tipologia_negozi_id = str(uuid.uuid4())
        tipologia_negozi = {
            "id": tipologia_negozi_id,
            "nome": "Vendita Negozio",
            "descrizione": "Contratti venduti presso punti vendita fisici",
            "servizio_id": servizio_negozi_id,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": None,
            "created_by": admin_id
        }
        tipologie.append(tipologia_negozi)
        
        # Tipologie per Fotovoltaico
        tipologia_fotovoltaico_res_id = str(uuid.uuid4())
        tipologia_fotovoltaico_res = {
            "id": tipologia_fotovoltaico_res_id,
            "nome": "Fotovoltaico Residenziale",
            "descrizione": "Impianti fotovoltaici per abitazioni private",
            "servizio_id": servizio_fotovoltaico_id,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": None,
            "created_by": admin_id
        }
        tipologie.append(tipologia_fotovoltaico_res)
        
        # Tipologie per Telepass
        tipologia_telepass_id = str(uuid.uuid4())
        tipologia_telepass = {
            "id": tipologia_telepass_id,
            "nome": "Telepass",
            "descrizione": "Attivazione dispositivi Telepass e OBU",
            "servizio_id": servizio_telepass_id,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": None,
            "created_by": admin_id
        }
        tipologie.append(tipologia_telepass)
        
        # Inserisci tipologie
        existing_tipologie = await db.tipologie_contratto.count_documents({})
        if existing_tipologie > 0:
            print(f"⚠️  Trovate {existing_tipologie} tipologie già esistenti. Skip inserimento.")
        else:
            await db.tipologie_contratto.insert_many(tipologie)
            print(f"✅ Create {len(tipologie)} tipologie contratto:")
            print(f"   - Energia Fastweb (TLS)")
            print(f"   - Telefonia Fastweb (TLS)")
            print(f"   - HO Mobile (TLS)")
            print(f"   - Vendita Negozio (NEGOZI)")
            print(f"   - Fotovoltaico Residenziale (IMPIANTI FOTOVOLTAICI)")
            print(f"   - Telepass (TELEPASS MOBILITY)")
        
        # ============================================
        # 5. CREAZIONE SEGMENTI
        # ============================================
        print("\n📝 Creazione segmenti...")
        
        segmenti = []
        
        # Per ogni tipologia, crea segmento Privato e Business
        tipologie_ids = [
            (tipologia_energia_fastweb_id, "Energia Fastweb"),
            (tipologia_telefonia_fastweb_id, "Telefonia Fastweb"),
            (tipologia_ho_mobile_id, "HO Mobile"),
            (tipologia_negozi_id, "Vendita Negozio"),
            (tipologia_fotovoltaico_res_id, "Fotovoltaico Residenziale"),
            (tipologia_telepass_id, "Telepass")
        ]
        
        for tipologia_id, tipologia_nome in tipologie_ids:
            # Segmento Privato
            segmento_privato = {
                "id": str(uuid.uuid4()),
                "tipo": "privato",
                "nome": "Privato",
                "tipologia_contratto_id": tipologia_id,
                "aruba_config": None,
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": None
            }
            segmenti.append(segmento_privato)
            
            # Segmento Business
            segmento_business = {
                "id": str(uuid.uuid4()),
                "tipo": "business",
                "nome": "Business",
                "tipologia_contratto_id": tipologia_id,
                "aruba_config": None,
                "is_active": True,
                "created_at": datetime.now(timezone.utc),
                "updated_at": None
            }
            segmenti.append(segmento_business)
        
        # Inserisci segmenti
        existing_segmenti = await db.segmenti.count_documents({})
        if existing_segmenti > 0:
            print(f"⚠️  Trovati {existing_segmenti} segmenti già esistenti. Skip inserimento.")
        else:
            await db.segmenti.insert_many(segmenti)
            print(f"✅ Creati {len(segmenti)} segmenti (Privato e Business per ogni tipologia)")
        
        # ============================================
        # 6. CREAZIONE OFFERTE
        # ============================================
        print("\n📝 Creazione offerte...")
        
        offerte = []
        
        # Offerte Energia Fastweb
        offerte_energia = [
            {
                "id": str(uuid.uuid4()),
                "nome": "Energia Casa 100%",
                "descrizione": "Offerta luce e gas per la casa - 100% energia verde",
                "commessa_id": commessa_fastweb_id,
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "Energia Business Plus",
                "descrizione": "Offerta luce e gas per aziende con sconti volume",
                "commessa_id": commessa_fastweb_id,
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            }
        ]
        offerte.extend(offerte_energia)
        
        # Offerte Telefonia/Internet
        offerte_telefonia = [
            {
                "id": str(uuid.uuid4()),
                "nome": "Fastweb Casa Light - 100GB",
                "descrizione": "Internet casa fibra 100GB",
                "commessa_id": commessa_fastweb_id,
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "Fastweb Casa - 200GB",
                "descrizione": "Internet casa fibra 200GB + chiamate illimitate",
                "commessa_id": commessa_fastweb_id,
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "HO Mobile 100GB",
                "descrizione": "Offerta mobile 100GB a 9.99€/mese",
                "commessa_id": commessa_fastweb_id,
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            }
        ]
        offerte.extend(offerte_telefonia)
        
        # Offerte Fotovoltaico
        offerte_fotovoltaico = [
            {
                "id": str(uuid.uuid4()),
                "nome": "Fotovoltaico 3 kW",
                "descrizione": "Impianto fotovoltaico 3 kW per uso domestico",
                "commessa_id": commessa_fotovoltaico_id,
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "Fotovoltaico 6 kW + Accumulo",
                "descrizione": "Impianto fotovoltaico 6 kW con batteria di accumulo",
                "commessa_id": commessa_fotovoltaico_id,
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            }
        ]
        offerte.extend(offerte_fotovoltaico)
        
        # Offerte Telepass
        offerte_telepass = [
            {
                "id": str(uuid.uuid4()),
                "nome": "Telepass Base",
                "descrizione": "Dispositivo Telepass standard",
                "commessa_id": commessa_telepass_id,
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "nome": "Telepass Plus con OBU",
                "descrizione": "Telepass Plus con dispositivo OBU per servizi avanzati",
                "commessa_id": commessa_telepass_id,
                "is_active": True,
                "created_at": datetime.now(timezone.utc)
            }
        ]
        offerte.extend(offerte_telepass)
        
        # Inserisci offerte
        existing_offerte = await db.offerte.count_documents({})
        if existing_offerte > 0:
            print(f"⚠️  Trovate {existing_offerte} offerte già esistenti. Skip inserimento.")
        else:
            await db.offerte.insert_many(offerte)
            print(f"✅ Create {len(offerte)} offerte:")
            print(f"   - {len(offerte_energia)} offerte Energia")
            print(f"   - {len(offerte_telefonia)} offerte Telefonia/Mobile")
            print(f"   - {len(offerte_fotovoltaico)} offerte Fotovoltaico")
            print(f"   - {len(offerte_telepass)} offerte Telepass")
        
        # ============================================
        # 7. VERIFICA FINALE
        # ============================================
        print("\n🔍 Verifica finale del database...")
        
        count_users = await db.users.count_documents({})
        count_commesse = await db.commesse.count_documents({})
        count_servizi = await db.servizi.count_documents({})
        count_tipologie = await db.tipologie_contratto.count_documents({})
        count_segmenti = await db.segmenti.count_documents({})
        count_offerte = await db.offerte.count_documents({})
        
        print(f"\n📊 Riepilogo Database:")
        print(f"   👤 Utenti: {count_users}")
        print(f"   📋 Commesse: {count_commesse}")
        print(f"   🔧 Servizi: {count_servizi}")
        print(f"   📑 Tipologie Contratto: {count_tipologie}")
        print(f"   🏢 Segmenti: {count_segmenti}")
        print(f"   💰 Offerte: {count_offerte}")
        
        print("\n✅ Seeding completato con successo!")
        print("\n🔑 Credenziali di accesso:")
        print("   Username: admin")
        print("   Password: admin123")
        
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
    print("🌱 NUREAL CRM - SCRIPT DI SEEDING DATABASE")
    print("=" * 80)
    
    asyncio.run(seed_database())
    
    print("\n" + "=" * 80)
    print("✅ SEEDING TERMINATO")
    print("=" * 80)
