#!/usr/bin/env python3
"""
Test veloce del filtro assigned_to per RESPONSABILE_PRESIDI
"""

import requests
import json
import sys

def test_responsabile_presidi_assigned_to_filter():
    """Test veloce del filtro assigned_to per RESPONSABILE_PRESIDI"""
    base_url = "https://referente-hub.preview.emergentagent.com/api"
    
    print("🚨 TEST VELOCE FILTRO ASSIGNED_TO PER RESPONSABILE_PRESIDI")
    print("🎯 OBIETTIVO: Capire perché il filtro assigned_to 'non funziona' - restituisce 0 risultati o non filtra?")
    print("")
    print("🎯 SETUP:")
    print("   • Backend: https://referente-hub.preview.emergentagent.com")
    print("   • Credenziali: ale8/admin123 (RESPONSABILE_PRESIDI)")
    print("")
    
    # **FASE 1: Login Admin per verificare utente RESPONSABILE_PRESIDI**
    print("🔐 FASE 1: Login Admin per verificare utente RESPONSABILE_PRESIDI...")
    
    try:
        response = requests.post(f"{base_url}/auth/login", 
                               json={'username': 'admin', 'password': 'admin123'},
                               timeout=30)
        
        if response.status_code == 200:
            admin_data = response.json()
            admin_token = admin_data['access_token']
            print(f"✅ Admin login SUCCESS - Role: {admin_data['user']['role']}")
        else:
            print(f"❌ Admin login FAILED - Status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Admin login ERROR: {e}")
        return False

    # Verify RESPONSABILE_PRESIDI user exists
    try:
        headers = {'Authorization': f'Bearer {admin_token}'}
        response = requests.get(f"{base_url}/users", headers=headers, timeout=30)
        
        if response.status_code == 200:
            users = response.json()
            responsabile_presidi_user = None
            
            for user in users:
                if user.get('username') == 'ale8' and user.get('role') == 'responsabile_presidi':
                    responsabile_presidi_user = user
                    break
            
            if responsabile_presidi_user:
                user_id = responsabile_presidi_user.get('id')
                print(f"✅ RESPONSABILE_PRESIDI user found - Username: ale8, Role: responsabile_presidi, ID: {user_id[:8]}...")
            else:
                print("❌ RESPONSABILE_PRESIDI user not found - User 'ale8' with role 'responsabile_presidi' not found")
                return False
        else:
            print(f"❌ GET /api/users FAILED - Status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/users ERROR: {e}")
        return False

    # **FASE 2: Login come RESPONSABILE_PRESIDI (ale8)**
    print("\n🔐 FASE 2: Login come RESPONSABILE_PRESIDI (ale8/admin123)...")
    
    try:
        response = requests.post(f"{base_url}/auth/login", 
                               json={'username': 'ale8', 'password': 'admin123'},
                               timeout=30)
        
        if response.status_code == 200:
            user_data = response.json()
            token = user_data['access_token']
            user_role = user_data['user']['role']
            user_id = user_data['user']['id']
            
            print(f"✅ RESPONSABILE_PRESIDI login SUCCESS - Role: {user_role}, ID: {user_id[:8]}...")
            
            if user_role != 'responsabile_presidi':
                print(f"⚠️ User role verification - Expected 'responsabile_presidi', got '{user_role}' - continuing test")
        else:
            print(f"❌ RESPONSABILE_PRESIDI login FAILED - Status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ RESPONSABILE_PRESIDI login ERROR: {e}")
        return False

    # **FASE 3: GET /api/clienti (senza filtro)**
    print("\n👥 FASE 3: GET /api/clienti (senza filtro) - conta i clienti totali...")
    
    try:
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(f"{base_url}/clienti", headers=headers, timeout=30)
        
        if response.status_code == 200:
            clienti = response.json()
            total_clienti_count = len(clienti)
            
            print(f"✅ GET /api/clienti (no filter) SUCCESS - Found {total_clienti_count} total clienti")
            
            # Extract assigned_to user_ids and sample clienti
            assigned_to_users = set()
            sample_clienti = []
            
            print(f"\n   📊 ANALISI CLIENTI TOTALI:")
            print(f"      • Total clienti visible to RESPONSABILE_PRESIDI: {total_clienti_count}")
            
            for i, cliente in enumerate(clienti):
                assigned_to = cliente.get('assigned_to')
                if assigned_to:
                    assigned_to_users.add(assigned_to)
                
                # Keep first few clienti as samples
                if i < 3:
                    sample_clienti.append({
                        'id': cliente.get('id', 'No ID')[:8] + '...',
                        'nome': cliente.get('nome', 'No Name'),
                        'cognome': cliente.get('cognome', 'No Surname'),
                        'assigned_to': assigned_to[:8] + '...' if assigned_to else 'None'
                    })
            
            print(f"      • Unique assigned_to user_ids found: {len(assigned_to_users)}")
            print(f"      • Sample clienti:")
            for i, sample in enumerate(sample_clienti, 1):
                print(f"         {i}. {sample['nome']} {sample['cognome']} (ID: {sample['id']}, assigned_to: {sample['assigned_to']})")
            
            if len(assigned_to_users) > 0:
                print(f"✅ Found assigned_to user_ids - Found {len(assigned_to_users)} unique user_ids in assigned_to field")
            else:
                print(f"⚠️ No assigned_to user_ids found - All clienti have assigned_to = null - will test with existing user_id")
                
        else:
            print(f"❌ GET /api/clienti (no filter) FAILED - Status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/clienti ERROR: {e}")
        return False

    # **FASE 4: GET /api/clienti?assigned_to={user_id}**
    print("\n🔍 FASE 4: GET /api/clienti?assigned_to={user_id} - verifica risultati filtrati...")
    
    # Choose a user_id to test with
    test_user_id = None
    if len(assigned_to_users) > 0:
        test_user_id = list(assigned_to_users)[0]
        print(f"   🎯 Using assigned_to user_id from existing clienti: {test_user_id[:8]}...")
    else:
        # Use the current user's ID if no assigned_to found
        test_user_id = user_id
        print(f"   🎯 Using current user's ID (no assigned_to found): {test_user_id[:8]}...")
    
    # Test the assigned_to filter
    try:
        headers = {'Authorization': f'Bearer {token}'}
        response = requests.get(f"{base_url}/clienti?assigned_to={test_user_id}", headers=headers, timeout=30)
        
        if response.status_code == 200:
            filtered_clienti = response.json()
            filtered_clienti_count = len(filtered_clienti)
            
            print(f"✅ GET /api/clienti?assigned_to={{user_id}} SUCCESS - Found {filtered_clienti_count} filtered clienti")
            
            print(f"\n   📊 RISULTATI FILTRO:")
            print(f"      • Clienti senza filtro: {total_clienti_count}")
            print(f"      • Clienti con filtro assigned_to={test_user_id[:8]}...: {filtered_clienti_count}")
            print(f"      • Filtro applicato: {'✅ SÌ' if filtered_clienti_count != total_clienti_count else '❌ NO (stesso numero)'}")
            
            # Verify all filtered clients have correct assigned_to
            if filtered_clienti_count > 0:
                correct_assigned_to = 0
                wrong_assigned_to = 0
                
                print(f"      • Verifica assigned_to nei clienti filtrati:")
                for i, cliente in enumerate(filtered_clienti[:3]):  # Check first 3
                    cliente_assigned_to = cliente.get('assigned_to')
                    cliente_nome = cliente.get('nome', 'Unknown')
                    cliente_id = cliente.get('id', 'No ID')[:8] + '...'
                    
                    if cliente_assigned_to == test_user_id:
                        correct_assigned_to += 1
                        print(f"         {i+1}. ✅ {cliente_nome} (ID: {cliente_id}) - assigned_to: {cliente_assigned_to[:8]}...")
                    else:
                        wrong_assigned_to += 1
                        print(f"         {i+1}. ❌ {cliente_nome} (ID: {cliente_id}) - assigned_to: {cliente_assigned_to[:8] if cliente_assigned_to else 'None'}...")
                
                if wrong_assigned_to == 0:
                    print(f"✅ All filtered clients have correct assigned_to - All {filtered_clienti_count} clients have assigned_to = {test_user_id[:8]}...")
                else:
                    print(f"❌ Some filtered clients have wrong assigned_to - {wrong_assigned_to} clients have different assigned_to")
            else:
                print(f"      • No clienti returned by filter")
                
        else:
            print(f"❌ GET /api/clienti?assigned_to={{user_id}} FAILED - Status: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ GET /api/clienti?assigned_to={{user_id}} ERROR: {e}")
        return False

    # **FASE 5: Verifica comportamento del filtro**
    print("\n🎯 FASE 5: Verifica comportamento del filtro...")
    
    filter_behavior = "UNKNOWN"
    filter_working = False
    
    if filtered_clienti_count == 0 and total_clienti_count > 0:
        if len(assigned_to_users) > 0:
            filter_behavior = "PROBLEMA: Restituisce 0 risultati quando dovrebbe restituire alcuni"
            print(f"   🚨 PROBLEMA IDENTIFICATO: Il filtro restituisce 0 risultati")
            print(f"   🚨 DETTAGLI: Esistono clienti con assigned_to, ma il filtro non li trova")
            print(f"   🚨 POSSIBILE CAUSA: Filtro non implementato correttamente o query errata")
        else:
            filter_behavior = "OK: Restituisce 0 risultati perché nessun cliente ha assigned_to"
            print(f"   ✅ COMPORTAMENTO CORRETTO: Nessun cliente ha assigned_to = {test_user_id[:8]}...")
            filter_working = True
    elif filtered_clienti_count == total_clienti_count:
        filter_behavior = "PROBLEMA: Restituisce tutti i clienti invece di filtrare"
        print(f"   🚨 PROBLEMA IDENTIFICATO: Il filtro non viene applicato")
        print(f"   🚨 DETTAGLI: Stesso numero di clienti con e senza filtro")
        print(f"   🚨 POSSIBILE CAUSA: Filtro ignorato dal backend")
    elif filtered_clienti_count > 0 and filtered_clienti_count < total_clienti_count:
        filter_behavior = "OK: Filtra correttamente"
        print(f"   ✅ FILTRO FUNZIONA CORRETTAMENTE")
        print(f"   ✅ DETTAGLI: Riduce i clienti da {total_clienti_count} a {filtered_clienti_count}")
        filter_working = True
    else:
        filter_behavior = f"ANOMALO: {filtered_clienti_count} filtrati vs {total_clienti_count} totali"
        print(f"   ⚠️ COMPORTAMENTO ANOMALO: Risultati inaspettati")

    # **REPORT FINALE**
    print(f"\n📋 REPORT FINALE - TEST FILTRO ASSIGNED_TO RESPONSABILE_PRESIDI:")
    print(f"   🎯 OBIETTIVO: Capire perché il filtro assigned_to 'non funziona'")
    print(f"   📊 RISULTATI:")
    print(f"      • Login RESPONSABILE_PRESIDI (ale8): ✅ SUCCESS")
    print(f"      • Numero clienti senza filtro: {total_clienti_count}")
    print(f"      • Numero clienti con filtro: {filtered_clienti_count}")
    print(f"      • User_id testato: {test_user_id[:8]}...")
    print(f"      • Unique assigned_to user_ids trovati: {len(assigned_to_users)}")
    print(f"      • Comportamento filtro: {filter_behavior}")
    
    print(f"\n   📋 ESEMPIO CLIENTE E ASSIGNED_TO:")
    if len(sample_clienti) > 0:
        sample = sample_clienti[0]
        print(f"      • Cliente: {sample['nome']} {sample['cognome']}")
        print(f"      • ID: {sample['id']}")
        print(f"      • assigned_to: {sample['assigned_to']}")
    else:
        print(f"      • Nessun cliente disponibile per esempio")
    
    print(f"\n   🎯 DIAGNOSI:")
    if filter_working:
        print(f"      • ✅ Il filtro assigned_to FUNZIONA CORRETTAMENTE")
        print(f"      • ✅ Applica il filtro e restituisce risultati appropriati")
        print(f"      • ✅ Non ci sono problemi tecnici con il filtro")
    else:
        if filtered_clienti_count == 0 and len(assigned_to_users) > 0:
            print(f"      • 🚨 PROBLEMA: Il filtro restituisce 0 risultati quando dovrebbe restituire alcuni")
            print(f"      • 🚨 CAUSA PROBABILE: Query MongoDB non trova match o filtro non implementato")
            print(f"      • 🔧 SOLUZIONE: Verificare implementazione filtro assigned_to nel backend")
        elif filtered_clienti_count == total_clienti_count:
            print(f"      • 🚨 PROBLEMA: Il filtro viene ignorato")
            print(f"      • 🚨 CAUSA PROBABILE: Parametro assigned_to non processato dal backend")
            print(f"      • 🔧 SOLUZIONE: Verificare che il parametro assigned_to sia gestito nell'endpoint")
    
    return filter_working

if __name__ == "__main__":
    print("🚀 Starting RESPONSABILE_PRESIDI assigned_to filter test...")
    
    try:
        success = test_responsabile_presidi_assigned_to_filter()
        
        if success:
            print("\n🎉 RESPONSABILE_PRESIDI ASSIGNED_TO FILTER TEST SUCCESSFUL!")
        else:
            print("\n🚨 RESPONSABILE_PRESIDI ASSIGNED_TO FILTER TEST FAILED!")
            
        sys.exit(0 if success else 1)
        
    except Exception as e:
        print(f"\n❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)