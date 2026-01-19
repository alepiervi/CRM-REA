#!/usr/bin/env python3
"""
Test script to find the exact Unit AGN ID for Zapier webhook configuration
"""

import requests
import json
import sys

def test_trova_id_unit_agn():
    """Find the exact Unit AGN ID for Zapier webhook configuration"""
    base_url = "https://agentify-6.preview.emergentagent.com/api"
    
    print("🎯 TROVA ID CORRETTO UNIT AGN - ZAPIER WEBHOOK CONFIGURATION")
    print("🎯 OBIETTIVO: Trovare l'ID esatto della Unit 'AGN' per configurare il webhook Zapier")
    print("🎯 FOCUS CRITICO: Devo fornire l'ID ESATTO della Unit AGN, copiabile e pronto per Zapier")
    
    # **1. LOGIN ADMIN**
    print("\n🔐 1. LOGIN ADMIN (admin/admin123)...")
    
    try:
        login_response = requests.post(
            f"{base_url}/auth/login",
            json={'username': 'admin', 'password': 'admin123'},
            timeout=30
        )
        
        if login_response.status_code == 200:
            login_data = login_response.json()
            token = login_data.get('access_token')
            user_data = login_data.get('user')
            print(f"✅ Admin login (admin/admin123) - SUCCESS: Token received, Role: {user_data.get('role')}")
        else:
            print(f"❌ Admin login failed - Status: {login_response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False

    # **2. GET /api/units - Lista tutte le Unit**
    print("\n📋 2. GET /api/units - Lista tutte le Unit disponibili...")
    
    try:
        headers = {'Authorization': f'Bearer {token}'}
        units_response = requests.get(f"{base_url}/units", headers=headers, timeout=30)
        
        if units_response.status_code == 200:
            units = units_response.json()
            units_count = len(units)
            print(f"✅ GET /api/units SUCCESS - Status: 200 OK, Found {units_count} total units")
            
            print(f"\n   📊 TUTTE LE UNIT DISPONIBILI:")
            print(f"   {'#':<3} {'NOME':<20} {'ID COMPLETO':<40} {'COMMESSA_ID':<40} {'ACTIVE':<8}")
            print(f"   {'-'*3:<3} {'-'*20:<20} {'-'*40:<40} {'-'*40:<40} {'-'*8:<8}")
            
            unit_agn = None
            
            for i, unit in enumerate(units, 1):
                nome = unit.get('nome', 'Unknown')
                unit_id = unit.get('id', 'No ID')
                commessa_id = unit.get('commessa_id', 'No Commessa')
                is_active = unit.get('is_active', False)
                
                print(f"   {i:<3} {nome:<20} {unit_id:<40} {commessa_id[:40]:<40} {str(is_active):<8}")
                
                # Check if this is the AGN unit
                if nome.upper() == 'AGN':
                    unit_agn = unit
                    print(f"   🎯 >>> UNIT AGN TROVATA! <<<")
                    
            if unit_agn:
                agn_id = unit_agn.get('id')
                agn_nome = unit_agn.get('nome')
                agn_commessa_id = unit_agn.get('commessa_id')
                agn_commesse_autorizzate = unit_agn.get('commesse_autorizzate', [])
                agn_is_active = unit_agn.get('is_active', False)
                
                print(f"\n   🎯 DETTAGLI UNIT AGN:")
                print(f"      • Nome: {agn_nome}")
                print(f"      • ID COMPLETO E PRECISO: {agn_id}")
                print(f"      • Commessa ID: {agn_commessa_id}")
                print(f"      • Commesse Autorizzate: {len(agn_commesse_autorizzate)} items")
                print(f"      • Is Active: {agn_is_active}")
                
                if agn_is_active:
                    print(f"✅ Unit AGN è ATTIVA - is_active: {agn_is_active}")
                else:
                    print(f"⚠️ Unit AGN NON è attiva - is_active: {agn_is_active}")
                    
            else:
                print(f"❌ UNIT AGN NON TROVATA - Nessuna unit con nome 'AGN' trovata nel database")
                print(f"   🚨 CRITICAL: Unit 'AGN' non esiste nel database!")
                return False
                
        else:
            print(f"❌ GET /api/units FAILED - Status: {units_response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Units request error: {e}")
        return False

    # **3. GET /api/commesse - Trova commessa Fotovoltaico**
    print("\n🏢 3. GET /api/commesse - Trova commessa 'Fotovoltaico'...")
    
    try:
        commesse_response = requests.get(f"{base_url}/commesse", headers=headers, timeout=30)
        
        if commesse_response.status_code == 200:
            commesse = commesse_response.json()
            commesse_count = len(commesse)
            print(f"✅ GET /api/commesse SUCCESS - Status: 200 OK, Found {commesse_count} total commesse")
            
            print(f"\n   📊 TUTTE LE COMMESSE DISPONIBILI:")
            print(f"   {'#':<3} {'NOME':<20} {'ID COMPLETO':<40} {'ACTIVE':<8}")
            print(f"   {'-'*3:<3} {'-'*20:<20} {'-'*40:<40} {'-'*8:<8}")
            
            commessa_fotovoltaico = None
            
            for i, commessa in enumerate(commesse, 1):
                nome = commessa.get('nome', 'Unknown')
                commessa_id = commessa.get('id', 'No ID')
                is_active = commessa.get('is_active', False)
                
                print(f"   {i:<3} {nome:<20} {commessa_id:<40} {str(is_active):<8}")
                
                # Check if this is the Fotovoltaico commessa
                if nome.upper() == 'FOTOVOLTAICO':
                    commessa_fotovoltaico = commessa
                    print(f"   🎯 >>> COMMESSA FOTOVOLTAICO TROVATA! <<<")
                    
            if commessa_fotovoltaico:
                fotovoltaico_id = commessa_fotovoltaico.get('id')
                fotovoltaico_nome = commessa_fotovoltaico.get('nome')
                fotovoltaico_is_active = commessa_fotovoltaico.get('is_active', False)
                
                print(f"\n   🎯 DETTAGLI COMMESSA FOTOVOLTAICO:")
                print(f"      • Nome: {fotovoltaico_nome}")
                print(f"      • ID COMPLETO E PRECISO: {fotovoltaico_id}")
                print(f"      • Is Active: {fotovoltaico_is_active}")
                
                if fotovoltaico_is_active:
                    print(f"✅ Commessa Fotovoltaico è ATTIVA - is_active: {fotovoltaico_is_active}")
                else:
                    print(f"⚠️ Commessa Fotovoltaico NON è attiva - is_active: {fotovoltaico_is_active}")
                    
            else:
                print(f"❌ COMMESSA FOTOVOLTAICO NON TROVATA - Nessuna commessa con nome 'Fotovoltaico' trovata nel database")
                print(f"   ⚠️ WARNING: Commessa 'Fotovoltaico' non esiste nel database!")
                
        else:
            print(f"❌ GET /api/commesse FAILED - Status: {commesse_response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Commesse request error: {e}")
        return False

    # **4. VERIFICA AUTORIZZAZIONI UNIT AGN**
    print("\n🔐 4. VERIFICA AUTORIZZAZIONI UNIT AGN...")
    
    if unit_agn and commessa_fotovoltaico:
        agn_commesse_autorizzate = unit_agn.get('commesse_autorizzate', [])
        fotovoltaico_id = commessa_fotovoltaico.get('id')
        
        print(f"   📋 VERIFICA AUTORIZZAZIONI:")
        print(f"      • Unit AGN commesse autorizzate: {len(agn_commesse_autorizzate)} items")
        print(f"      • Commessa Fotovoltaico ID: {fotovoltaico_id}")
        
        if fotovoltaico_id in agn_commesse_autorizzate:
            print(f"✅ Unit AGN autorizzata per Fotovoltaico - Commessa Fotovoltaico è nelle commesse autorizzate")
        else:
            print(f"⚠️ Unit AGN NON autorizzata per Fotovoltaico - Commessa Fotovoltaico NON è nelle commesse autorizzate")
            print(f"      🔧 RACCOMANDAZIONE: Aggiungere commessa Fotovoltaico alle commesse autorizzate della Unit AGN")
            
    # **5. COSTRUISCI URL WEBHOOK CORRETTO**
    print("\n🔗 5. COSTRUISCI URL WEBHOOK CORRETTO...")
    
    if unit_agn:
        agn_id = unit_agn.get('id')
        base_webhook_url = "https://agentify-6.preview.emergentagent.com/api/webhook"
        webhook_url = f"{base_webhook_url}/{agn_id}"
        
        print(f"\n   🎯 URL WEBHOOK COMPLETO PRONTO PER ZAPIER:")
        print(f"   📋 Base URL: {base_webhook_url}")
        print(f"   📋 Unit AGN ID: {agn_id}")
        print(f"   🔗 URL WEBHOOK FINALE: {webhook_url}")
        
        # Provide copy-paste ready information
        print(f"\n   📋 INFORMAZIONI PRONTE PER ZAPIER:")
        print(f"   ┌─────────────────────────────────────────────────────────────────────────────────────────┐")
        print(f"   │ UNIT AGN ID (da copiare):                                                               │")
        print(f"   │ {agn_id:<87} │")
        print(f"   │                                                                                         │")
        print(f"   │ WEBHOOK URL COMPLETO (da copiare):                                                      │")
        print(f"   │ {webhook_url:<87} │")
        print(f"   └─────────────────────────────────────────────────────────────────────────────────────────┘")
        
    else:
        print(f"❌ Impossibile costruire webhook URL - Unit AGN non trovata")
        return False

    # **FINAL SUMMARY**
    print(f"\n🎯 TROVA ID CORRETTO UNIT AGN - SUMMARY:")
    print(f"   🎯 OBIETTIVO: Trovare l'ID esatto della Unit 'AGN' per configurare il webhook Zapier")
    print(f"   📊 RISULTATI:")
    print(f"      • Admin login (admin/admin123): ✅ SUCCESS")
    print(f"      • GET /api/units: ✅ SUCCESS ({units_count} units found)")
    print(f"      • Unit AGN identificata: {'✅ SUCCESS' if unit_agn else '❌ FAILED'}")
    print(f"      • GET /api/commesse: ✅ SUCCESS ({commesse_count} commesse found)")
    print(f"      • Commessa Fotovoltaico identificata: {'✅ SUCCESS' if commessa_fotovoltaico else '⚠️ NOT FOUND'}")
    print(f"      • URL Webhook costruito: {'✅ SUCCESS' if unit_agn else '❌ FAILED'}")
    
    if unit_agn:
        agn_id = unit_agn.get('id')
        agn_is_active = unit_agn.get('is_active', False)
        webhook_url = f"https://agentify-6.preview.emergentagent.com/api/webhook/{agn_id}"
        
        print(f"\n   🎉 SUCCESS: ID Unit AGN trovato e webhook URL costruito!")
        print(f"   📋 INFORMAZIONI FINALI:")
        print(f"      • Unit AGN Nome: AGN")
        print(f"      • Unit AGN ID: {agn_id}")
        print(f"      • Unit AGN Attiva: {agn_is_active}")
        print(f"      • Webhook URL: {webhook_url}")
        
        if commessa_fotovoltaico:
            fotovoltaico_id = commessa_fotovoltaico.get('id')
            print(f"      • Commessa Fotovoltaico ID: {fotovoltaico_id}")
            
        print(f"\n   🔗 READY FOR ZAPIER: L'URL webhook è pronto per essere configurato in Zapier!")
        return True
    else:
        print(f"\n   🚨 FAILURE: Unit AGN non trovata nel database!")
        print(f"   🔧 RACCOMANDAZIONI:")
        print(f"      • Verificare che esista una Unit con nome 'AGN'")
        print(f"      • Creare la Unit AGN se non esiste")
        print(f"      • Assicurarsi che la Unit AGN sia attiva")
        return False

if __name__ == "__main__":
    try:
        result = test_trova_id_unit_agn()
        if result:
            print("\n🎉 TEST COMPLETED SUCCESSFULLY!")
        else:
            print("\n❌ TEST FAILED!")
        sys.exit(0 if result else 1)
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)