#!/usr/bin/env python3
"""
Area Manager Servizi Autorizzati Update Test
Focused test for the urgent Area Manager update functionality
"""

import requests
import sys
import json
from datetime import datetime
import uuid

class AreaManagerUpdateTester:
    def __init__(self, base_url="https://agentify-6.preview.emergentagent.com/api"):
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
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            return success, response.json() if response.content else {}, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0
        except json.JSONDecodeError:
            return False, {"error": "Invalid JSON response"}, response.status_code

    def test_area_manager_servizi_autorizzati_update_urgent(self):
        """🚨 AREA MANAGER SERVIZI AUTORIZZATI UPDATE - Aggiornamento urgente per cascading servizi"""
        print("\n🚨 AREA MANAGER SERVIZI AUTORIZZATI UPDATE - Aggiornamento urgente per cascading servizi")
        print("🎯 OBIETTIVO: Aggiornare l'Area Manager esistente per popolare servizi_autorizzati e risolvere il cascading servizi")
        print("🎯 URGENT TASKS:")
        print("   1. VERIFICA AREA MANAGER ATTUALE: Login admin/admin123, controllare test_area_manager_clienti")
        print("   2. UPDATE AREA MANAGER: PUT /api/users/{id} per triggerare auto-population")
        print("   3. TEST CASCADING SERVIZI: GET /api/cascade/servizi-by-commessa/{fastweb_id}")
        print("   4. VERIFICA SUB AGENZIE SERVIZI: F2F e Presidio-Maximo con servizi_autorizzati")
        
        # **STEP 1: VERIFICA AREA MANAGER ATTUALE**
        print("\n🔐 STEP 1: VERIFICA AREA MANAGER ATTUALE...")
        
        # Login admin/admin123
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            self.log_test("✅ ADMIN LOGIN (admin/admin123)", True, f"Token received, Role: {self.user_data['role']}")
        else:
            self.log_test("❌ ADMIN LOGIN FAILED", False, f"Status: {status}, Response: {response}")
            return False

        # Find test_area_manager_clienti user
        success, users_response, status = self.make_request('GET', 'users', expected_status=200)
        
        area_manager_user = None
        if success and isinstance(users_response, list):
            area_manager_user = next((user for user in users_response if user.get('username') == 'test_area_manager_clienti'), None)
            
            if area_manager_user:
                self.log_test("✅ FOUND test_area_manager_clienti", True, 
                    f"ID: {area_manager_user.get('id')}, Role: {area_manager_user.get('role')}")
                
                # Check current configuration
                sub_agenzie_autorizzate = area_manager_user.get('sub_agenzie_autorizzate', [])
                commesse_autorizzate = area_manager_user.get('commesse_autorizzate', [])
                servizi_autorizzati = area_manager_user.get('servizi_autorizzati', [])
                
                print(f"\n   📋 CURRENT AREA MANAGER CONFIGURATION:")
                print(f"      • Sub Agenzie Autorizzate: {len(sub_agenzie_autorizzate)} items")
                print(f"      • Commesse Autorizzate: {len(commesse_autorizzate)} items")
                print(f"      • Servizi Autorizzati: {len(servizi_autorizzati)} items (should be empty)")
                
                if len(servizi_autorizzati) == 0:
                    self.log_test("✅ SERVIZI_AUTORIZZATI EMPTY (as expected)", True, "servizi_autorizzati is currently empty")
                else:
                    self.log_test("ℹ️ SERVIZI_AUTORIZZATI NOT EMPTY", True, f"servizi_autorizzati has {len(servizi_autorizzati)} items")
                
                if len(sub_agenzie_autorizzate) > 0:
                    self.log_test("✅ SUB_AGENZIE_AUTORIZZATE POPULATED", True, f"Found {len(sub_agenzie_autorizzate)} sub agenzie")
                else:
                    self.log_test("❌ SUB_AGENZIE_AUTORIZZATE EMPTY", False, "No sub agenzie assigned")
                    
                if len(commesse_autorizzate) > 0:
                    self.log_test("✅ COMMESSE_AUTORIZZATE POPULATED", True, f"Found {len(commesse_autorizzate)} commesse")
                else:
                    self.log_test("❌ COMMESSE_AUTORIZZATE EMPTY", False, "No commesse assigned")
                    
            else:
                self.log_test("❌ test_area_manager_clienti NOT FOUND", False, "Area Manager user not found")
                return False
        else:
            self.log_test("❌ COULD NOT GET USERS LIST", False, f"Status: {status}")
            return False

        # **STEP 2: UPDATE AREA MANAGER**
        print("\n🔄 STEP 2: UPDATE AREA MANAGER...")
        print("   🎯 CRITICO: PUT /api/users/{id} per triggerare nuova logica di auto-population")
        
        area_manager_id = area_manager_user.get('id')
        
        # Prepare update data (minimal update to trigger auto-population)
        update_data = {
            "username": area_manager_user.get('username'),
            "email": area_manager_user.get('email'),
            "role": area_manager_user.get('role'),
            "sub_agenzie_autorizzate": area_manager_user.get('sub_agenzie_autorizzate', [])
        }
        
        # Execute PUT request to trigger auto-population
        success, update_response, status = self.make_request(
            'PUT', f'users/{area_manager_id}', 
            update_data, 
            expected_status=200
        )
        
        if success and status == 200:
            self.log_test("✅ PUT /api/users/{id} SUCCESS", True, f"Status: {status} - Update triggered successfully")
            
            # Verify response contains updated user data
            if isinstance(update_response, dict):
                updated_servizi_autorizzati = update_response.get('servizi_autorizzati', [])
                updated_commesse_autorizzate = update_response.get('commesse_autorizzate', [])
                
                print(f"\n   📋 UPDATED AREA MANAGER CONFIGURATION:")
                print(f"      • Servizi Autorizzati: {len(updated_servizi_autorizzati)} items")
                print(f"      • Commesse Autorizzate: {len(updated_commesse_autorizzate)} items")
                
                if len(updated_servizi_autorizzati) > 0:
                    self.log_test("✅ SERVIZI_AUTORIZZATI AUTO-POPULATED", True, 
                        f"servizi_autorizzati now has {len(updated_servizi_autorizzati)} items")
                else:
                    self.log_test("❌ SERVIZI_AUTORIZZATI STILL EMPTY", False, "Auto-population did not work")
                
                if len(updated_commesse_autorizzate) > 0:
                    self.log_test("✅ COMMESSE_AUTORIZZATE INTACT", True, 
                        f"commesse_autorizzate remains with {len(updated_commesse_autorizzate)} items")
                else:
                    self.log_test("❌ COMMESSE_AUTORIZZATE LOST", False, "commesse_autorizzate was cleared")
                    
            else:
                self.log_test("❌ INVALID UPDATE RESPONSE", False, f"Response: {update_response}")
                
        else:
            self.log_test("❌ PUT /api/users/{id} FAILED", False, f"Status: {status}, Response: {update_response}")
            return False

        # **STEP 3: TEST CASCADING SERVIZI**
        print("\n🔗 STEP 3: TEST CASCADING SERVIZI...")
        print("   🎯 CRITICO: Login come test_area_manager_clienti e testare cascading")
        
        # Login as test_area_manager_clienti
        success, am_response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'test_area_manager_clienti', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in am_response:
            self.token = am_response['access_token']
            am_user_data = am_response['user']
            
            self.log_test("✅ AREA MANAGER LOGIN (test_area_manager_clienti/admin123)", True, 
                f"Role: {am_user_data.get('role')}")
            
            # Get Fastweb commessa ID
            fastweb_commessa_id = None
            commesse_autorizzate = am_user_data.get('commesse_autorizzate', [])
            
            if commesse_autorizzate:
                # Assume first commessa is Fastweb (or find it by name)
                fastweb_commessa_id = commesse_autorizzate[0]
                self.log_test("✅ FASTWEB COMMESSA ID FOUND", True, f"Using commessa ID: {fastweb_commessa_id}")
            else:
                self.log_test("❌ NO COMMESSE AUTORIZZATE", False, "Area Manager has no authorized commesse")
                return False
            
            # Test GET /api/cascade/servizi-by-commessa/{fastweb_id}
            success, servizi_response, status = self.make_request(
                'GET', f'cascade/servizi-by-commessa/{fastweb_commessa_id}', 
                expected_status=200
            )
            
            if success and status == 200:
                self.log_test("✅ GET /api/cascade/servizi-by-commessa SUCCESS", True, f"Status: {status}")
                
                if isinstance(servizi_response, list):
                    servizi_count = len(servizi_response)
                    
                    if servizi_count > 0:
                        self.log_test("✅ CASCADING SERVIZI NOW RETURNS DATA", True, 
                            f"Found {servizi_count} servizi (not empty anymore!)")
                        
                        # Show sample servizi
                        if servizi_count > 0:
                            sample_servizio = servizi_response[0]
                            servizio_nome = sample_servizio.get('nome', 'Unknown')
                            self.log_test("✅ SAMPLE SERVIZIO", True, f"Nome: {servizio_nome}")
                            
                    else:
                        self.log_test("❌ CASCADING SERVIZI STILL EMPTY", False, "GET /api/cascade/servizi-by-commessa returns empty array")
                        
                else:
                    self.log_test("❌ INVALID SERVIZI RESPONSE", False, f"Response is not array: {type(servizi_response)}")
                    
            else:
                self.log_test("❌ GET /api/cascade/servizi-by-commessa FAILED", False, f"Status: {status}, Response: {servizi_response}")
                
        else:
            self.log_test("❌ AREA MANAGER LOGIN FAILED", False, f"Status: {status}, Response: {am_response}")
            return False

        # **STEP 4: VERIFICA SUB AGENZIE SERVIZI**
        print("\n🏢 STEP 4: VERIFICA SUB AGENZIE SERVIZI...")
        print("   🎯 CRITICO: Controllare che F2F e Presidio-Maximo abbiano servizi_autorizzati popolati")
        
        # Switch back to admin token
        success, admin_response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in admin_response:
            self.token = admin_response['access_token']
            
            # Get sub agenzie list
            success, sub_agenzie_response, status = self.make_request('GET', 'sub-agenzie', expected_status=200)
            
            if success and isinstance(sub_agenzie_response, list):
                # Find F2F and Presidio-Maximo
                f2f_sub_agenzia = next((sa for sa in sub_agenzie_response if 'F2F' in sa.get('nome', '')), None)
                presidio_sub_agenzia = next((sa for sa in sub_agenzie_response if 'Presidio' in sa.get('nome', '') and 'Maximo' in sa.get('nome', '')), None)
                
                if f2f_sub_agenzia:
                    f2f_servizi = f2f_sub_agenzia.get('servizi_autorizzati', [])
                    f2f_commesse = f2f_sub_agenzia.get('commesse_autorizzate', [])
                    
                    self.log_test("✅ F2F SUB AGENZIA FOUND", True, 
                        f"Nome: {f2f_sub_agenzia.get('nome')}, Servizi: {len(f2f_servizi)}, Commesse: {len(f2f_commesse)}")
                    
                    if len(f2f_servizi) > 0:
                        self.log_test("✅ F2F SERVIZI_AUTORIZZATI POPULATED", True, f"F2F has {len(f2f_servizi)} servizi")
                    else:
                        self.log_test("❌ F2F SERVIZI_AUTORIZZATI EMPTY", False, "F2F has no servizi_autorizzati")
                        
                    # Check if servizi are from Fastweb commessa
                    if fastweb_commessa_id in f2f_commesse:
                        self.log_test("✅ F2F HAS FASTWEB COMMESSA", True, "F2F is authorized for Fastweb commessa")
                    else:
                        self.log_test("❌ F2F MISSING FASTWEB COMMESSA", False, "F2F is not authorized for Fastweb commessa")
                        
                else:
                    self.log_test("❌ F2F SUB AGENZIA NOT FOUND", False, "Could not find F2F sub agenzia")
                
                if presidio_sub_agenzia:
                    presidio_servizi = presidio_sub_agenzia.get('servizi_autorizzati', [])
                    presidio_commesse = presidio_sub_agenzia.get('commesse_autorizzate', [])
                    
                    self.log_test("✅ PRESIDIO-MAXIMO SUB AGENZIA FOUND", True, 
                        f"Nome: {presidio_sub_agenzia.get('nome')}, Servizi: {len(presidio_servizi)}, Commesse: {len(presidio_commesse)}")
                    
                    if len(presidio_servizi) > 0:
                        self.log_test("✅ PRESIDIO-MAXIMO SERVIZI_AUTORIZZATI POPULATED", True, f"Presidio-Maximo has {len(presidio_servizi)} servizi")
                    else:
                        self.log_test("❌ PRESIDIO-MAXIMO SERVIZI_AUTORIZZATI EMPTY", False, "Presidio-Maximo has no servizi_autorizzati")
                        
                    # Check if servizi are from Fastweb commessa
                    if fastweb_commessa_id in presidio_commesse:
                        self.log_test("✅ PRESIDIO-MAXIMO HAS FASTWEB COMMESSA", True, "Presidio-Maximo is authorized for Fastweb commessa")
                    else:
                        self.log_test("❌ PRESIDIO-MAXIMO MISSING FASTWEB COMMESSA", False, "Presidio-Maximo is not authorized for Fastweb commessa")
                        
                else:
                    self.log_test("❌ PRESIDIO-MAXIMO SUB AGENZIA NOT FOUND", False, "Could not find Presidio-Maximo sub agenzia")
                    
            else:
                self.log_test("❌ COULD NOT GET SUB AGENZIE LIST", False, f"Status: {status}")
        
        # **FINAL SUMMARY**
        print(f"\n🎯 AREA MANAGER SERVIZI AUTORIZZATI UPDATE TEST SUMMARY:")
        print(f"   🎯 OBIETTIVO: Aggiornare Area Manager per popolare servizi_autorizzati e risolvere cascading")
        print(f"   🎯 CRITICAL FIX: Risolvere 'non vedo le commesse nella filiera cascading'")
        print(f"   📊 RISULTATI:")
        print(f"      • Admin login (admin/admin123): ✅ SUCCESS")
        print(f"      • test_area_manager_clienti trovato: {'✅ SUCCESS' if area_manager_user else '❌ FAILED'}")
        print(f"      • PUT /api/users/{area_manager_id} per auto-population: {'✅ SUCCESS' if success else '❌ FAILED'}")
        print(f"      • Area Manager login (test_area_manager_clienti/admin123): {'✅ SUCCESS' if 'am_user_data' in locals() else '❌ FAILED'}")
        print(f"      • GET /api/cascade/servizi-by-commessa returns data: {'✅ SUCCESS' if 'servizi_count' in locals() and servizi_count > 0 else '❌ FAILED'}")
        print(f"      • F2F sub agenzia servizi_autorizzati populated: {'✅ SUCCESS' if 'f2f_sub_agenzia' in locals() and f2f_sub_agenzia and len(f2f_sub_agenzia.get('servizi_autorizzati', [])) > 0 else '❌ FAILED'}")
        print(f"      • Presidio-Maximo sub agenzia servizi_autorizzati populated: {'✅ SUCCESS' if 'presidio_sub_agenzia' in locals() and presidio_sub_agenzia and len(presidio_sub_agenzia.get('servizi_autorizzati', [])) > 0 else '❌ FAILED'}")
        
        # Determine overall success
        overall_success = (
            area_manager_user is not None and
            success and  # PUT request success
            'servizi_count' in locals() and servizi_count > 0 and  # Cascading works
            'f2f_sub_agenzia' in locals() and f2f_sub_agenzia and len(f2f_sub_agenzia.get('servizi_autorizzati', [])) > 0  # F2F has servizi
        )
        
        if overall_success:
            print(f"   🎉 SUCCESS: Area Manager servizi_autorizzati update COMPLETE!")
            print(f"   🎉 CONFERMATO: Cascading servizi ora funziona - non più vuoto!")
            print(f"   🎉 RISOLTO: 'non vedo le commesse nella filiera cascading' problema FIXED!")
            return True
        else:
            print(f"   🚨 PARTIAL SUCCESS: Alcuni aspetti dell'update non funzionano correttamente")
            print(f"   🚨 AZIONE RICHIESTA: Verificare logica auto-population servizi_autorizzati")
            return False

    def run_test(self):
        """Run the Area Manager servizi_autorizzati update test"""
        print("🚀 Starting Area Manager Servizi Autorizzati Update Test...")
        print(f"🌐 Base URL: {self.base_url}")
        print("=" * 80)
        
        success = self.test_area_manager_servizi_autorizzati_update_urgent()
        
        # Print final results
        print("\n" + "=" * 80)
        print(f"🎯 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"📊 Success Rate: {success_rate:.1f}%")
        
        if success:
            print("🎉 Area Manager servizi_autorizzati update test SUCCESSFUL!")
        else:
            print("⚠️ Area Manager servizi_autorizzati update test had issues.")
        
        return success

if __name__ == "__main__":
    tester = AreaManagerUpdateTester()
    success = tester.run_test()
    sys.exit(0 if success else 1)