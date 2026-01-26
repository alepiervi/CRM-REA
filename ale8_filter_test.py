#!/usr/bin/env python3
"""
Debug del filtro "Utente Assegnato" per ale8 (RESPONSABILE_PRESIDI)
"""

import requests
import sys
import json
from datetime import datetime
import uuid
import time

class Ale8FilterTester:
    def __init__(self, base_url="https://lead-manager-56.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        if details and success:
            print(f"   ℹ️  {details}")

    def make_request(self, method, endpoint, data=None, expected_status=200, auth_required=True, timeout=30):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=timeout)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=timeout)

            success = response.status_code == expected_status
            
            # Try to parse JSON
            try:
                return success, response.json() if response.content else {}, response.status_code
            except json.JSONDecodeError:
                return success, {"error": "Non-JSON response", "content": response.text[:200]}, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0

    def test_ale8_assigned_to_filter_debug(self):
        """🚨 DEBUG FILTRO 'UTENTE ASSEGNATO' PER ale8 (RESPONSABILE_PRESIDI)"""
        print("\n🚨 DEBUG FILTRO 'UTENTE ASSEGNATO' PER ale8 (RESPONSABILE_PRESIDI)")
        print("🎯 PROBLEMA RIPORTATO:")
        print("   1. Nel dropdown filtro non vede gli utenti presenti nei clienti")
        print("   2. Quando filtra, non funziona (non filtra i clienti)")
        print("")
        print("🎯 SETUP:")
        print("   • Backend: https://lead-manager-56.preview.emergentagent.com")
        print("   • User: ale8/admin123")
        print("")
        
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
            
            self.log_test("✅ Login ale8/admin123", True, 
                f"Token received, Role: {user_role}, ID: {user_id[:8]}...")
        else:
            self.log_test("❌ Login ale8 failed", False, 
                f"Status: {status}, Response: {response}")
            return False

        # **2. Get Clienti senza filtro**
        print("\n👥 2. Get Clienti senza filtro...")
        
        success, clienti_response, status = self.make_request('GET', 'clienti', expected_status=200)
        
        total_clienti_count = 0
        all_assigned_to_users = set()
        all_created_by_users = set()
        
        if success and status == 200:
            clienti = clienti_response if isinstance(clienti_response, list) else []
            total_clienti_count = len(clienti)
            
            self.log_test("✅ GET /api/clienti", True, 
                f"Status: 200 OK, Found {total_clienti_count} total clienti")
            
            # Salva il numero totale
            print(f"\n   📊 ANALISI CLIENTI:")
            print(f"      • Numero totale clienti: {total_clienti_count}")
            
            # Estrai TUTTI i valori di assigned_to E created_by dai clienti
            print(f"      • Estrazione user_id da assigned_to e created_by...")
            
            for cliente in clienti:
                assigned_to = cliente.get('assigned_to')
                created_by = cliente.get('created_by')
                
                if assigned_to:
                    all_assigned_to_users.add(assigned_to)
                if created_by:
                    all_created_by_users.add(created_by)
            
            # Mostra lista completa degli user_id trovati
            print(f"\n   📋 LISTA COMPLETA USER_ID TROVATI:")
            print(f"      • assigned_to user_ids: {len(all_assigned_to_users)} unique")
            for i, user_id_val in enumerate(sorted(all_assigned_to_users), 1):
                print(f"         {i}. {user_id_val}")
            
            print(f"      • created_by user_ids: {len(all_created_by_users)} unique")
            for i, user_id_val in enumerate(sorted(all_created_by_users), 1):
                print(f"         {i}. {user_id_val}")
            
            # Combine all user_ids
            all_user_ids = all_assigned_to_users.union(all_created_by_users)
            print(f"      • TOTAL unique user_ids nei clienti: {len(all_user_ids)}")
            
            self.log_test("✅ User_ids extraction complete", True, 
                f"assigned_to: {len(all_assigned_to_users)}, created_by: {len(all_created_by_users)}, total: {len(all_user_ids)}")
                
        else:
            self.log_test("❌ GET /api/clienti FAILED", False, f"Status: {status}")
            return False

        # **3. Get Filter Options**
        print("\n🔍 3. Get Filter Options...")
        
        success, filter_response, status = self.make_request('GET', 'clienti/filter-options', expected_status=200)
        
        dropdown_users = []
        missing_from_dropdown = set()
        
        if success and status == 200:
            self.log_test("✅ GET /api/clienti/filter-options", True, f"Status: 200 OK")
            
            # Estrai la lista "users" dal response
            users_in_dropdown = filter_response.get('users', [])
            dropdown_users = users_in_dropdown
            
            print(f"\n   📋 DROPDOWN USERS ANALYSIS:")
            print(f"      • users field present: {'✅' if 'users' in filter_response else '❌'}")
            print(f"      • Number of users in dropdown: {len(users_in_dropdown)}")
            
            # Mostra TUTTI gli utenti nel dropdown
            print(f"\n   📋 LISTA COMPLETA UTENTI NEL DROPDOWN:")
            if len(users_in_dropdown) > 0:
                for i, user_item in enumerate(users_in_dropdown, 1):
                    if isinstance(user_item, dict):
                        user_label = user_item.get('label', user_item.get('username', 'Unknown'))
                        user_value = user_item.get('value', user_item.get('id', 'No ID'))
                        print(f"         {i}. {user_label} (value: {user_value})")
                    else:
                        print(f"         {i}. {user_item}")
            else:
                print(f"         (Nessun utente nel dropdown)")
            
            self.log_test("✅ Dropdown users extracted", True, 
                f"Found {len(users_in_dropdown)} users in dropdown")
                
            # **Confronta con gli user_id dei clienti**
            print(f"\n   🔍 CONFRONTO DROPDOWN vs CLIENTI USER_IDS:")
            
            # Extract user_ids from dropdown
            dropdown_user_ids = set()
            for user_item in dropdown_users:
                if isinstance(user_item, dict):
                    user_value = user_item.get('value', user_item.get('id'))
                    if user_value:
                        dropdown_user_ids.add(user_value)
            
            print(f"      • User_ids nel dropdown: {len(dropdown_user_ids)}")
            print(f"      • User_ids nei clienti: {len(all_user_ids)}")
            
            # Find missing user_ids
            missing_from_dropdown = all_user_ids - dropdown_user_ids
            extra_in_dropdown = dropdown_user_ids - all_user_ids
            
            print(f"      • User_ids mancanti nel dropdown: {len(missing_from_dropdown)}")
            if missing_from_dropdown:
                for missing_id in sorted(missing_from_dropdown):
                    print(f"         - {missing_id}")
            
            print(f"      • User_ids extra nel dropdown: {len(extra_in_dropdown)}")
            if extra_in_dropdown:
                for extra_id in sorted(extra_in_dropdown):
                    print(f"         - {extra_id}")
            
            if len(missing_from_dropdown) == 0:
                self.log_test("✅ All client user_ids in dropdown", True, 
                    "Dropdown contains all user_ids from clienti")
            else:
                self.log_test("❌ Some client user_ids missing from dropdown", False, 
                    f"{len(missing_from_dropdown)} user_ids missing from dropdown")
                
        else:
            self.log_test("❌ GET /api/clienti/filter-options FAILED", False, f"Status: {status}")
            return False

        # **4. Test Filtro con un user_id presente**
        print("\n🎯 4. Test Filtro con un user_id presente...")
        
        # Scegli un user_id che esiste nei clienti
        test_user_id = None
        if len(all_user_ids) > 0:
            test_user_id = list(all_user_ids)[0]
            print(f"   🎯 Scelto user_id che esiste nei clienti: {test_user_id}")
        else:
            self.log_test("❌ No user_ids found in clienti", False, 
                "Cannot test filter without user_ids in clienti")
            return False
        
        # GET /api/clienti?assigned_to={user_id}
        filter_endpoint = f'clienti?assigned_to={test_user_id}'
        success, filtered_response, status = self.make_request('GET', filter_endpoint, expected_status=200)
        
        filtered_count = 0
        if success and status == 200:
            filtered_clienti = filtered_response if isinstance(filtered_response, list) else []
            filtered_count = len(filtered_clienti)
            
            self.log_test("✅ GET /api/clienti?assigned_to={user_id}", True, 
                f"Status: 200 OK, Found {filtered_count} filtered clienti")
            
            # Conta i risultati
            print(f"\n   📊 RISULTATO FILTRO:")
            print(f"      • Clienti senza filtro: {total_clienti_count}")
            print(f"      • Clienti con filtro assigned_to={test_user_id}: {filtered_count}")
            print(f"      • Filtro riduce il numero: {'✅ SÌ' if filtered_count < total_clienti_count else '❌ NO'}")
            
            # Verifica se il filtro riduce il numero di clienti
            if filtered_count < total_clienti_count:
                self.log_test("✅ Filter working correctly", True, 
                    f"Filter reduces results from {total_clienti_count} → {filtered_count} clienti")
            elif filtered_count == total_clienti_count:
                self.log_test("❌ Filter not working", False, 
                    f"Filter returns same number of clienti ({filtered_count})")
            else:
                self.log_test("❌ Filter error", False, 
                    f"Filter returns more clienti than total ({filtered_count} > {total_clienti_count})")
                
        else:
            self.log_test("❌ GET /api/clienti?assigned_to={user_id} FAILED", False, f"Status: {status}")
            return False

        # **SUMMARY**
        total_time = time.time() - start_time
        
        print(f"\n🎯 DEBUG FILTRO 'UTENTE ASSEGNATO' - SUMMARY:")
        print(f"   📊 RISULTATI (Total time: {total_time:.2f}s):")
        print(f"      • Login ale8: ✅ SUCCESS")
        print(f"      • GET /api/clienti (no filter): ✅ SUCCESS ({total_clienti_count} clienti)")
        print(f"      • User_ids nei clienti: {len(all_user_ids)} unique")
        print(f"      • GET /api/clienti/filter-options: ✅ SUCCESS")
        print(f"      • Users nel dropdown: {len(dropdown_users)}")
        print(f"      • User_ids mancanti nel dropdown: {len(missing_from_dropdown)}")
        print(f"      • Test filtro assigned_to: ✅ SUCCESS ({filtered_count} risultati)")
        print(f"      • Filtro funziona: {'✅ SÌ' if filtered_count < total_clienti_count else '❌ NO'}")
        
        print(f"\n   🎯 DIAGNOSI PROBLEMI:")
        
        # Problema 1: Dropdown non mostra utenti
        if len(dropdown_users) == 0:
            print(f"      🚨 PROBLEMA 1: Dropdown vuoto - nessun utente nel dropdown")
        elif len(missing_from_dropdown) > 0:
            print(f"      🚨 PROBLEMA 1: Dropdown incompleto - {len(missing_from_dropdown)} utenti mancanti")
        else:
            print(f"      ✅ PROBLEMA 1: Dropdown OK - tutti gli utenti presenti")
        
        # Problema 2: Filtro non funziona
        if filtered_count == total_clienti_count:
            print(f"      🚨 PROBLEMA 2: Filtro non funziona - restituisce tutti i clienti")
        elif filtered_count < total_clienti_count:
            print(f"      ✅ PROBLEMA 2: Filtro funziona - riduce i risultati")
        else:
            print(f"      🚨 PROBLEMA 2: Filtro errore - restituisce più clienti del totale")
        
        print(f"\n   💡 RACCOMANDAZIONI:")
        if len(dropdown_users) == 0:
            print(f"      • Verificare endpoint /api/clienti/filter-options per RESPONSABILE_PRESIDI")
            print(f"      • Controllare logica di estrazione users da clienti")
        if len(missing_from_dropdown) > 0:
            print(f"      • Verificare che tutti i user_id (assigned_to + created_by) siano inclusi")
        if filtered_count == total_clienti_count:
            print(f"      • Verificare logica filtro assigned_to nel backend")
            print(f"      • Controllare query MongoDB per RESPONSABILE_PRESIDI")
        
        # Determine overall success
        overall_success = (
            total_clienti_count > 0 and
            len(dropdown_users) > 0 and
            filtered_count < total_clienti_count
        )
        
        return overall_success

if __name__ == "__main__":
    tester = Ale8FilterTester()
    
    print("🎯 RUNNING SPECIFIC TEST: ale8 Assigned To Filter Debug")
    print("🎯 Testing Responsabile Presidi Assigned To Filter Issue")
    print(f"🌐 Base URL: {tester.base_url}")
    print("=" * 80)
    
    # Run the specific test
    success = tester.test_ale8_assigned_to_filter_debug()
    
    print("\n" + "=" * 80)
    if success:
        print("🎉 ale8 Assigned To Filter Debug - SUCCESS!")
    else:
        print("❌ ale8 Assigned To Filter Debug - FAILED!")
    print("=" * 80)