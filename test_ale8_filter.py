#!/usr/bin/env python3
"""
Test script for ale8 user filter dropdown issue
"""

import requests
import json
import sys

class ALE8FilterTester:
    def __init__(self, base_url="https://clientmanage-2.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None

    def make_request(self, method, endpoint, data=None, expected_status=200, auth_required=True):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            
            try:
                return success, response.json() if response.content else {}, response.status_code
            except json.JSONDecodeError:
                return success, {"error": "Non-JSON response", "content": response.text[:200]}, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0

    def test_ale8_user_filter_dropdown_debug(self):
        """🚨 ANALISI DETTAGLIATA PROBLEMA FILTRO UTENTI PER ale8"""
        print("\n🚨 ANALISI DETTAGLIATA PROBLEMA FILTRO UTENTI PER ale8")
        print("🎯 SETUP:")
        print("   • Backend: https://clientmanage-2.preview.emergentagent.com")
        print("   • User: ale8/admin123")
        print("")
        print("🎯 PROBLEMA CRITICO:")
        print("   • Admin NON appare nel dropdown (ma ha un cliente assegnato)")
        print("   • ale10 appare nel dropdown (ma NON dovrebbe)")
        print("   • ale12 NON appare nel dropdown (ma dovrebbe)")
        print("")
        print("🎯 TEST DA ESEGUIRE:")
        print("   1. Login come ale8")
        print("   2. GET /api/clienti (senza filtro)")
        print("   3. GET /api/clienti/filter-options")
        print("   4. Cerca gli utenti nella collection users")
        print("   5. DIAGNOSI CRITICA del mismatch")
        
        import time
        start_time = time.time()
        
        # **1. Login come ale8**
        print("\n🔐 1. Login come ale8...")
        
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'ale8', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            user_role = self.user_data.get('role')
            user_id = self.user_data.get('id')
            
            print(f"✅ Login ale8/admin123 SUCCESS - Token received, Role: {user_role}, ID: {user_id[:8]}...")
        else:
            print(f"❌ Login ale8 failed - Status: {status}, Response: {response}")
            return False

        # **2. GET /api/clienti (senza filtro)**
        print("\n👥 2. GET /api/clienti (senza filtro)...")
        print("   Per OGNI cliente, mostra:")
        print("   • id (primi 8 char)")
        print("   • nome + cognome")
        print("   • assigned_to (valore completo)")
        print("   • created_by (valore completo)")
        
        success, clienti_response, status = self.make_request('GET', 'clienti', expected_status=200)
        
        all_assigned_to_users = set()
        all_created_by_users = set()
        
        if success and status == 200:
            clienti = clienti_response if isinstance(clienti_response, list) else []
            
            print(f"✅ GET /api/clienti SUCCESS - Status: 200 OK, Found {len(clienti)} clienti visibili a ale8")
            
            print(f"\n   📊 DETTAGLI OGNI CLIENTE:")
            for i, cliente in enumerate(clienti, 1):
                cliente_id = cliente.get('id', 'No ID')[:8]
                nome = cliente.get('nome', 'No Nome')
                cognome = cliente.get('cognome', 'No Cognome')
                assigned_to = cliente.get('assigned_to')
                created_by = cliente.get('created_by')
                
                print(f"      {i}. ID: {cliente_id}... | {nome} {cognome}")
                print(f"         assigned_to: {assigned_to if assigned_to else 'NULL'}")
                print(f"         created_by: {created_by if created_by else 'NULL'}")
                
                if assigned_to:
                    all_assigned_to_users.add(assigned_to)
                if created_by:
                    all_created_by_users.add(created_by)
            
            print(f"\n   📋 LISTA TUTTI I VALORI assigned_to NON NULL:")
            if all_assigned_to_users:
                for i, user_id_val in enumerate(sorted(all_assigned_to_users), 1):
                    print(f"      {i}. {user_id_val}")
            else:
                print(f"      (Nessun assigned_to trovato)")
            
            print(f"\n   📋 LISTA TUTTI I VALORI created_by NON NULL:")
            if all_created_by_users:
                for i, user_id_val in enumerate(sorted(all_created_by_users), 1):
                    print(f"      {i}. {user_id_val}")
            else:
                print(f"      (Nessun created_by trovato)")
            
            all_user_ids = all_assigned_to_users.union(all_created_by_users)
            
            print(f"✅ Clienti analysis complete - assigned_to users: {len(all_assigned_to_users)}, created_by users: {len(all_created_by_users)}, total unique: {len(all_user_ids)}")
                
        else:
            print(f"❌ GET /api/clienti FAILED - Status: {status}")
            return False

        # **3. GET /api/clienti/filter-options**
        print("\n🔍 3. GET /api/clienti/filter-options...")
        print("   Mostra TUTTI gli utenti nel campo 'users'")
        print("   Per ogni utente mostra: label e value")
        
        success, filter_response, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
        
        dropdown_users = []
        dropdown_user_ids = set()
        
        if success and status == 200:
            print(f"✅ GET /api/clienti/filter-options SUCCESS - Status: 200 OK")
            
            users_in_dropdown = filter_response.get('users', [])
            dropdown_users = users_in_dropdown
            
            print(f"\n   📋 TUTTI GLI UTENTI NEL DROPDOWN:")
            print(f"      • Numero totale utenti: {len(users_in_dropdown)}")
            
            if len(users_in_dropdown) > 0:
                for i, user_item in enumerate(users_in_dropdown, 1):
                    if isinstance(user_item, dict):
                        user_label = user_item.get('label', 'No Label')
                        user_value = user_item.get('value', 'No Value')
                        print(f"      {i}. Label: {user_label} | Value: {user_value}")
                        
                        if user_value and user_value != 'No Value':
                            dropdown_user_ids.add(user_value)
                    else:
                        print(f"      {i}. {user_item}")
            else:
                print(f"      (Nessun utente nel dropdown)")
            
            print(f"✅ Dropdown users analysis complete - Found {len(users_in_dropdown)} users in dropdown")
                
        else:
            print(f"❌ GET /api/clienti/filter-options FAILED - Status: {status}")
            return False

        # **4. Cerca gli utenti nella collection users**
        print("\n👤 4. Cerca gli utenti nella collection users...")
        print("   Per ogni user_id trovato nei clienti (assigned_to), cerca nella collection users e mostra username")
        print("   Identifica: admin, ale12, ale10, ale9")
        
        # First login as admin to access users endpoint
        admin_success, admin_response, admin_status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        user_id_to_username = {}
        target_users = {}  # admin, ale12, ale10, ale9
        
        if admin_success and 'access_token' in admin_response:
            temp_token = self.token
            self.token = admin_response['access_token']
            
            # Get all users
            success, users_response, status = self.make_request('GET', 'users', expected_status=200)
            
            if success and status == 200:
                users = users_response if isinstance(users_response, list) else []
                
                print(f"✅ GET /api/users SUCCESS - Found {len(users)} total users")
                
                print(f"\n   📋 MAPPING USER_ID → USERNAME:")
                
                # Create mapping for all users
                for user in users:
                    user_id_val = user.get('id')
                    username = user.get('username')
                    
                    if user_id_val and username:
                        user_id_to_username[user_id_val] = username
                        
                        # Check for target users
                        if username in ['admin', 'ale12', 'ale10', 'ale9']:
                            target_users[username] = {
                                'id': user_id_val,
                                'username': username,
                                'role': user.get('role'),
                                'is_active': user.get('is_active')
                            }
                
                # Show mapping for user_ids found in clienti
                print(f"   📋 USER_IDS TROVATI NEI CLIENTI:")
                for user_id_val in sorted(all_user_ids):
                    username = user_id_to_username.get(user_id_val, 'UNKNOWN USER')
                    print(f"      • {user_id_val} → {username}")
                
                print(f"\n   📋 TARGET USERS (admin, ale12, ale10, ale9):")
                for username in ['admin', 'ale12', 'ale10', 'ale9']:
                    if username in target_users:
                        user_info = target_users[username]
                        print(f"      • {username}: ID={user_info['id'][:8]}..., Role={user_info['role']}, Active={user_info['is_active']}")
                    else:
                        print(f"      • {username}: NOT FOUND")
                
                print(f"✅ Users mapping complete - Mapped {len(user_id_to_username)} users, found {len(target_users)} target users")
            else:
                print(f"❌ GET /api/users FAILED - Status: {status}")
            
            # Restore ale8 token
            self.token = temp_token
        else:
            print(f"❌ Admin login for users lookup failed - Status: {admin_status}")

        # **5. DIAGNOSI CRITICA**
        print("\n🔍 5. DIAGNOSI CRITICA:")
        print("   • Quali user_id sono in assigned_to dei clienti visibili a ale8?")
        print("   • Quali user_id compaiono nel dropdown?")
        print("   • PERCHÉ admin con cliente assigned_to non compare?")
        print("   • PERCHÉ ale10 senza clienti compare?")
        print("   • PERCHÉ ale12 con cliente non compare?")
        
        # Analysis 1: Which user_ids are in assigned_to of clients visible to ale8?
        print(f"\n   📊 ANALISI 1: USER_IDS IN ASSIGNED_TO DEI CLIENTI:")
        print(f"      • Total user_ids in assigned_to: {len(all_assigned_to_users)}")
        for user_id_val in sorted(all_assigned_to_users):
            username = user_id_to_username.get(user_id_val, 'UNKNOWN')
            print(f"         - {user_id_val} ({username})")
        
        # Analysis 2: Which user_ids appear in dropdown?
        print(f"\n   📊 ANALISI 2: USER_IDS NEL DROPDOWN:")
        print(f"      • Total user_ids in dropdown: {len(dropdown_user_ids)}")
        for user_id_val in sorted(dropdown_user_ids):
            username = user_id_to_username.get(user_id_val, 'UNKNOWN')
            print(f"         - {user_id_val} ({username})")
        
        # Analysis 3: Critical questions
        print(f"\n   🚨 DIAGNOSI CRITICA:")
        
        # Find admin user_id
        admin_user_id = target_users.get('admin', {}).get('id')
        ale10_user_id = target_users.get('ale10', {}).get('id')
        ale12_user_id = target_users.get('ale12', {}).get('id')
        
        # Question 1: PERCHÉ admin con cliente assigned_to non compare?
        if admin_user_id:
            admin_in_assigned_to = admin_user_id in all_assigned_to_users
            admin_in_dropdown = admin_user_id in dropdown_user_ids
            
            print(f"      1. ADMIN ANALYSIS:")
            print(f"         • admin user_id: {admin_user_id[:8]}...")
            print(f"         • admin in assigned_to: {'✅ SÌ' if admin_in_assigned_to else '❌ NO'}")
            print(f"         • admin in dropdown: {'✅ SÌ' if admin_in_dropdown else '❌ NO'}")
            
            if admin_in_assigned_to and not admin_in_dropdown:
                print(f"         🚨 PROBLEMA: admin ha cliente assegnato ma NON compare nel dropdown!")
            elif admin_in_dropdown and not admin_in_assigned_to:
                print(f"         ℹ️ admin nel dropdown ma senza clienti assigned_to")
            elif admin_in_assigned_to and admin_in_dropdown:
                print(f"         ✅ admin correttamente nel dropdown (ha clienti)")
            else:
                print(f"         ℹ️ admin non ha clienti e non è nel dropdown (normale)")
        
        # Question 2: PERCHÉ ale10 senza clienti compare?
        if ale10_user_id:
            ale10_in_assigned_to = ale10_user_id in all_assigned_to_users
            ale10_in_created_by = ale10_user_id in all_created_by_users
            ale10_in_dropdown = ale10_user_id in dropdown_user_ids
            
            print(f"      2. ALE10 ANALYSIS:")
            print(f"         • ale10 user_id: {ale10_user_id[:8]}...")
            print(f"         • ale10 in assigned_to: {'✅ SÌ' if ale10_in_assigned_to else '❌ NO'}")
            print(f"         • ale10 in created_by: {'✅ SÌ' if ale10_in_created_by else '❌ NO'}")
            print(f"         • ale10 in dropdown: {'✅ SÌ' if ale10_in_dropdown else '❌ NO'}")
            
            if ale10_in_dropdown and not ale10_in_assigned_to and not ale10_in_created_by:
                print(f"         🚨 PROBLEMA: ale10 nel dropdown ma NON ha clienti!")
            elif ale10_in_dropdown and (ale10_in_assigned_to or ale10_in_created_by):
                print(f"         ✅ ale10 correttamente nel dropdown (ha clienti)")
            else:
                print(f"         ℹ️ ale10 non nel dropdown e non ha clienti (normale)")
        
        # Question 3: PERCHÉ ale12 con cliente non compare?
        if ale12_user_id:
            ale12_in_assigned_to = ale12_user_id in all_assigned_to_users
            ale12_in_created_by = ale12_user_id in all_created_by_users
            ale12_in_dropdown = ale12_user_id in dropdown_user_ids
            
            print(f"      3. ALE12 ANALYSIS:")
            print(f"         • ale12 user_id: {ale12_user_id[:8]}...")
            print(f"         • ale12 in assigned_to: {'✅ SÌ' if ale12_in_assigned_to else '❌ NO'}")
            print(f"         • ale12 in created_by: {'✅ SÌ' if ale12_in_created_by else '❌ NO'}")
            print(f"         • ale12 in dropdown: {'✅ SÌ' if ale12_in_dropdown else '❌ NO'}")
            
            if (ale12_in_assigned_to or ale12_in_created_by) and not ale12_in_dropdown:
                print(f"         🚨 PROBLEMA: ale12 ha clienti ma NON compare nel dropdown!")
            elif ale12_in_dropdown and not ale12_in_assigned_to and not ale12_in_created_by:
                print(f"         ℹ️ ale12 nel dropdown ma senza clienti")
            elif ale12_in_dropdown and (ale12_in_assigned_to or ale12_in_created_by):
                print(f"         ✅ ale12 correttamente nel dropdown (ha clienti)")
            else:
                print(f"         ℹ️ ale12 non ha clienti e non è nel dropdown (normale)")
        
        # Overall mismatch analysis
        missing_from_dropdown = all_user_ids - dropdown_user_ids
        extra_in_dropdown = dropdown_user_ids - all_user_ids
        
        print(f"\n   📊 MISMATCH SUMMARY:")
        print(f"      • User_ids nei clienti ma MANCANTI dal dropdown: {len(missing_from_dropdown)}")
        for user_id_val in sorted(missing_from_dropdown):
            username = user_id_to_username.get(user_id_val, 'UNKNOWN')
            print(f"         - {user_id_val} ({username})")
        
        print(f"      • User_ids nel dropdown ma NON nei clienti: {len(extra_in_dropdown)}")
        for user_id_val in sorted(extra_in_dropdown):
            username = user_id_to_username.get(user_id_val, 'UNKNOWN')
            print(f"         - {user_id_val} ({username})")
        
        # **FINAL DIAGNOSIS**
        total_time = time.time() - start_time
        
        print(f"\n🎯 DIAGNOSI FINALE (Total time: {total_time:.2f}s):")
        print(f"   🎯 OBIETTIVO: Trovare il bug esatto che causa il mismatch tra assigned_to nei clienti e users nel dropdown")
        
        # Count critical issues
        critical_issues = 0
        
        if len(missing_from_dropdown) > 0:
            critical_issues += 1
            print(f"   🚨 ISSUE 1: {len(missing_from_dropdown)} user_ids con clienti MANCANO dal dropdown")
        
        if len(extra_in_dropdown) > 0:
            critical_issues += 1
            print(f"   🚨 ISSUE 2: {len(extra_in_dropdown)} user_ids nel dropdown SENZA clienti")
        
        if critical_issues == 0:
            print(f"   ✅ SUCCESS: Dropdown e clienti sono sincronizzati correttamente")
        else:
            print(f"   🚨 CRITICAL: Trovati {critical_issues} problemi di sincronizzazione")
            print(f"   🔧 ROOT CAUSE: Il backend endpoint /api/clienti/filter-options non include tutti i user_ids dai clienti")
            print(f"   🔧 SOLUTION NEEDED: Fix filter-options logic to include ALL user_ids from assigned_to AND created_by fields")
        
        return critical_issues == 0

if __name__ == "__main__":
    tester = ALE8FilterTester()
    result = tester.test_ale8_user_filter_dropdown_debug()
    
    if result:
        print("\n🎉 TEST COMPLETED SUCCESSFULLY")
    else:
        print("\n🚨 TEST FOUND CRITICAL ISSUES")
    
    sys.exit(0 if result else 1)