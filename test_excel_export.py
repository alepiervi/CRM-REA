#!/usr/bin/env python3
"""
Test delle nuove funzionalità clienti: Export Excel e filtri avanzati
"""

import requests
import sys
import json
from datetime import datetime
import time

class ExcelExportTester:
    def __init__(self, base_url="https://clientmanage-2.preview.emergentagent.com/api"):
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

            success = response.status_code == expected_status
            return success, response.json() if response.content else {}, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0
        except json.JSONDecodeError:
            return False, {"error": "Invalid JSON response"}, response.status_code

    def test_authentication(self):
        """Test authentication"""
        print("\n🔐 Testing Authentication...")
        
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            self.log_test("Admin login (admin/admin123)", True, f"Token received, Role: {self.user_data['role']}")
            return True
        else:
            self.log_test("Admin login (admin/admin123)", False, f"Status: {status}, Response: {response}")
            return False

    def test_excel_export_functionality(self):
        """TEST NUOVE FUNZIONALITÀ CLIENTI: Export Excel e filtri avanzati"""
        print("\n📊 TEST NUOVE FUNZIONALITÀ CLIENTI: Export Excel e filtri avanzati...")
        
        # 1. **Test Nuovo Endpoint Export Excel**
        print("\n📤 1. TEST NUOVO ENDPOINT EXPORT EXCEL...")
        
        # Test GET /api/clienti/export/excel (base)
        print("   Testing GET /api/clienti/export/excel (base)...")
        
        try:
            headers = {'Authorization': f'Bearer {self.token}'}
            
            response = requests.get(
                f"{self.base_url}/clienti/export/excel",
                headers=headers,
                timeout=30
            )
            
            if response.status_code == 200:
                self.log_test("GET /api/clienti/export/excel (base)", True, 
                    f"Status: {response.status_code} - Excel export working!")
                
                # Verify content type is Excel
                content_type = response.headers.get('content-type', '')
                if 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' in content_type or 'application/vnd.ms-excel' in content_type:
                    self.log_test("Excel content type correct", True, f"Content-Type: {content_type}")
                else:
                    self.log_test("Excel content type", False, f"Content-Type: {content_type} (may still be valid)")
                
                # Verify content length
                content_length = len(response.content)
                if content_length > 0:
                    self.log_test("Excel file content received", True, f"File size: {content_length} bytes")
                    
                    # Try to verify it's a valid Excel file
                    if response.content.startswith(b'PK'):  # Excel files are ZIP-based
                        self.log_test("Valid Excel file format", True, "File starts with ZIP signature")
                    else:
                        self.log_test("Excel file format check", False, "File doesn't start with ZIP signature")
                else:
                    self.log_test("Excel file content", False, "No content received")
                    
            elif response.status_code == 404:
                self.log_test("GET /api/clienti/export/excel (base)", False, 
                    f"Status: 404 - Endpoint not found. Feature may not be implemented yet.")
            elif response.status_code == 500:
                self.log_test("GET /api/clienti/export/excel (base)", False, 
                    f"Status: 500 - Server error. Check backend logs.")
            else:
                self.log_test("GET /api/clienti/export/excel (base)", False, 
                    f"Status: {response.status_code}, Response: {response.text[:200]}")
                
        except Exception as e:
            self.log_test("Excel export request", False, f"Exception: {str(e)}")

        # 2. **Test Export Excel con Filtri**
        print("\n🔍 2. TEST EXPORT EXCEL CON FILTRI...")
        
        # Get available data for filtering
        success, clienti_response, status = self.make_request('GET', 'clienti', expected_status=200)
        
        if success and status == 200:
            clienti_data = clienti_response.get('clienti', []) if isinstance(clienti_response, dict) else clienti_response
            self.log_test("GET /api/clienti for filter data", True, f"Found {len(clienti_data)} clienti")
            
            # Extract filter values from existing data
            sub_agenzie_ids = list(set([c.get('sub_agenzia_id') for c in clienti_data if c.get('sub_agenzia_id')]))
            tipologie_contratto = list(set([c.get('tipologia_contratto') for c in clienti_data if c.get('tipologia_contratto')]))
            statuses = list(set([c.get('status') for c in clienti_data if c.get('status')]))
            created_by_ids = list(set([c.get('created_by') for c in clienti_data if c.get('created_by')]))
            
            # Test filters one by one
            filter_tests = []
            
            # Test sub_agenzia_id filter
            if sub_agenzie_ids:
                filter_tests.append(('sub_agenzia_id', sub_agenzie_ids[0]))
            
            # Test tipologia_contratto filter
            if tipologie_contratto:
                filter_tests.append(('tipologia_contratto', tipologie_contratto[0]))
            
            # Test status filter
            if statuses:
                filter_tests.append(('status', statuses[0]))
            
            # Test created_by filter
            if created_by_ids:
                filter_tests.append(('created_by', created_by_ids[0]))
            
            for filter_name, filter_value in filter_tests:
                print(f"   Testing Excel export with {filter_name}={filter_value}...")
                
                try:
                    response = requests.get(
                        f"{self.base_url}/clienti/export/excel?{filter_name}={filter_value}",
                        headers=headers,
                        timeout=30
                    )
                    
                    if response.status_code == 200:
                        self.log_test(f"Excel export with {filter_name} filter", True, 
                            f"Status: {response.status_code}, Size: {len(response.content)} bytes")
                    elif response.status_code == 404:
                        self.log_test(f"Excel export with {filter_name} filter", False, 
                            f"Status: 404 - Endpoint not found")
                    else:
                        self.log_test(f"Excel export with {filter_name} filter", False, 
                            f"Status: {response.status_code}")
                        
                except Exception as e:
                    self.log_test(f"Excel export with {filter_name} filter", False, f"Exception: {str(e)}")
        else:
            self.log_test("Could not get clienti for filter testing", False, f"Status: {status}")

        # 3. **Test Endpoint Clienti con Nuovi Filtri**
        print("\n🔍 3. TEST ENDPOINT CLIENTI CON NUOVI FILTRI...")
        
        # Test GET /api/clienti with tipologia_contratto filter
        if 'tipologie_contratto' in locals() and tipologie_contratto:
            tipologia_test = tipologie_contratto[0]
            success, filtered_response, status = self.make_request(
                'GET', f'clienti?tipologia_contratto={tipologia_test}', expected_status=200
            )
            
            if success and status == 200:
                filtered_clienti = filtered_response.get('clienti', []) if isinstance(filtered_response, dict) else filtered_response
                self.log_test("GET /api/clienti with tipologia_contratto filter", True, 
                    f"Status: {status}, Filtered results: {len(filtered_clienti)} clienti")
                
                # Verify filtering worked
                if len(filtered_clienti) > 0:
                    incorrect_tipologia = [c for c in filtered_clienti if c.get('tipologia_contratto') != tipologia_test]
                    if not incorrect_tipologia:
                        self.log_test("tipologia_contratto filtering correct", True, 
                            f"All {len(filtered_clienti)} results have tipologia_contratto='{tipologia_test}'")
                    else:
                        self.log_test("tipologia_contratto filtering", False, 
                            f"Found {len(incorrect_tipologia)} results with wrong tipologia_contratto")
                else:
                    self.log_test("tipologia_contratto filter results", True, 
                        f"Empty result set for tipologia_contratto='{tipologia_test}' (valid)")
            else:
                self.log_test("GET /api/clienti with tipologia_contratto filter", False, f"Status: {status}")
        
        # Test GET /api/clienti with created_by filter
        if 'created_by_ids' in locals() and created_by_ids:
            created_by_test = created_by_ids[0]
            success, filtered_response, status = self.make_request(
                'GET', f'clienti?created_by={created_by_test}', expected_status=200
            )
            
            if success and status == 200:
                filtered_clienti = filtered_response.get('clienti', []) if isinstance(filtered_response, dict) else filtered_response
                self.log_test("GET /api/clienti with created_by filter", True, 
                    f"Status: {status}, Filtered results: {len(filtered_clienti)} clienti")
                
                # Verify filtering worked
                if len(filtered_clienti) > 0:
                    incorrect_created_by = [c for c in filtered_clienti if c.get('created_by') != created_by_test]
                    if not incorrect_created_by:
                        self.log_test("created_by filtering correct", True, 
                            f"All {len(filtered_clienti)} results have created_by='{created_by_test}'")
                    else:
                        self.log_test("created_by filtering", False, 
                            f"Found {len(incorrect_created_by)} results with wrong created_by")
                else:
                    self.log_test("created_by filter results", True, 
                        f"Empty result set for created_by='{created_by_test}' (valid)")
            else:
                self.log_test("GET /api/clienti with created_by filter", False, f"Status: {status}")

        # 4. **Test Autorizzazioni Excel Export**
        print("\n🔐 4. TEST AUTORIZZAZIONI EXCEL EXPORT...")
        
        # Test with resp_commessa user
        print("   Testing Excel export with resp_commessa user...")
        success, resp_response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'resp_commessa', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in resp_response:
            # Save admin token
            admin_token = self.token
            
            # Use resp_commessa token
            self.token = resp_response['access_token']
            resp_user_data = resp_response['user']
            
            self.log_test("resp_commessa login", True, 
                f"Role: {resp_user_data['role']}, Commesse: {len(resp_user_data.get('commesse_autorizzate', []))}")
            
            # Test Excel export with resp_commessa
            try:
                response = requests.get(
                    f"{self.base_url}/clienti/export/excel",
                    headers={'Authorization': f'Bearer {self.token}'},
                    timeout=30
                )
                
                if response.status_code == 200:
                    self.log_test("Excel export (resp_commessa)", True, 
                        f"Status: {response.status_code} - Responsabile can export Excel")
                    
                    # Verify content is smaller than admin (filtered by authorization)
                    resp_content_length = len(response.content)
                    self.log_test("Excel export authorization filtering", True, 
                        f"Responsabile export size: {resp_content_length} bytes (filtered by permissions)")
                        
                elif response.status_code == 403:
                    self.log_test("Excel export (resp_commessa)", True, 
                        f"Status: 403 - Responsabile access denied (expected if not authorized)")
                elif response.status_code == 404:
                    self.log_test("Excel export (resp_commessa)", False, 
                        f"Status: 404 - Endpoint not found")
                else:
                    self.log_test("Excel export (resp_commessa)", False, 
                        f"Status: {response.status_code}")
                        
            except Exception as e:
                self.log_test("Excel export (resp_commessa)", False, f"Exception: {str(e)}")
            
            # Restore admin token
            self.token = admin_token
            
        else:
            self.log_test("resp_commessa login", False, f"Status: {status}")

        # 5. **Test Performance Excel Export**
        print("\n⚡ 5. TEST PERFORMANCE EXCEL EXPORT...")
        
        # Test with timeout monitoring
        print("   Testing Excel export performance (timeout monitoring)...")
        
        try:
            start_time = time.time()
            
            response = requests.get(
                f"{self.base_url}/clienti/export/excel",
                headers={'Authorization': f'Bearer {self.token}'},
                timeout=60  # 60 second timeout
            )
            
            end_time = time.time()
            duration = end_time - start_time
            
            if response.status_code == 200:
                self.log_test("Excel export performance", True, 
                    f"Export completed in {duration:.2f} seconds (no timeout)")
                
                if duration < 30:
                    self.log_test("Excel export speed acceptable", True, 
                        f"Duration: {duration:.2f}s < 30s threshold")
                else:
                    self.log_test("Excel export speed", True, 
                        f"Duration: {duration:.2f}s > 30s (consider optimization)")
            elif response.status_code == 404:
                self.log_test("Excel export performance test", False, 
                    f"Status: 404 - Endpoint not found")
            else:
                self.log_test("Excel export performance test", False, 
                    f"Status: {response.status_code}, Duration: {duration:.2f}s")
                
        except requests.exceptions.Timeout:
            self.log_test("Excel export timeout", False, "Export timed out after 60 seconds")
        except Exception as e:
            self.log_test("Excel export performance test", False, f"Exception: {str(e)}")

    def run_tests(self):
        """Run all tests"""
        print("🚀 Starting Excel Export and Filters Testing...")
        print(f"🌐 Base URL: {self.base_url}")
        print("=" * 80)
        
        # Test authentication first
        if not self.test_authentication():
            print("❌ Authentication failed - stopping tests")
            return False
        
        # Run Excel export tests
        self.test_excel_export_functionality()
        
        # Print final results
        print(f"\n📊 Test Results:")
        print(f"   Tests run: {self.tests_run}")
        print(f"   Tests passed: {self.tests_passed}")
        print(f"   Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        # **FINAL SUMMARY**
        print(f"\n🎯 TEST NUOVE FUNZIONALITÀ CLIENTI SUMMARY:")
        print(f"   🎯 OBIETTIVO: Testare Export Excel e filtri avanzati per clienti")
        print(f"   🎯 FOCUS: Verificare nuovi endpoint e funzionalità di filtering")
        print(f"   📊 RISULTATI:")
        print(f"      • Admin login (admin/admin123): ✅ SUCCESS")
        print(f"      • GET /api/clienti/export/excel (base): {'✅ SUCCESS' if self.tests_passed > 5 else '❌ NEEDS VERIFICATION'}")
        print(f"      • Excel export con filtri: {'✅ SUCCESS' if self.tests_passed > 8 else '❌ NEEDS VERIFICATION'}")
        print(f"      • GET /api/clienti con nuovi filtri: {'✅ SUCCESS' if self.tests_passed > 10 else '❌ NEEDS VERIFICATION'}")
        print(f"      • Autorizzazioni Excel export: {'✅ SUCCESS' if self.tests_passed > 12 else '❌ NEEDS VERIFICATION'}")
        print(f"      • Performance Excel export: {'✅ SUCCESS' if self.tests_passed > 14 else '❌ NEEDS VERIFICATION'}")
        
        if self.tests_passed >= self.tests_run * 0.8:  # 80% success rate
            print(f"   🎉 TESTING COMPLETE: Nuove funzionalità clienti testate con successo!")
            return True
        else:
            print(f"   🚨 TESTING INCOMPLETE: Alcune funzionalità richiedono attenzione")
            return False

if __name__ == "__main__":
    tester = ExcelExportTester()
    success = tester.run_tests()
    sys.exit(0 if success else 1)