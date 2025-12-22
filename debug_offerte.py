#!/usr/bin/env python3
"""
Debug Offerta Utente con Sotto-Offerte - Verifica Database
"""

import requests
import sys
import json
from datetime import datetime
import uuid

class OffertaDebugTester:
    def __init__(self, base_url="https://role-manager-19.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None

    def log_test(self, name, success, details=""):
        """Log test results"""
        if success:
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

    def test_offerta_utente_sotto_offerte_debug(self):
        """🚨 DEBUG OFFERTA UTENTE CON SOTTO-OFFERTE - Verifica Database"""
        print("\n🚨 DEBUG OFFERTA UTENTE CON SOTTO-OFFERTE - VERIFICA DATABASE")
        print("🎯 CONTESTO: L'utente ha creato un'offerta tramite UI con 2 sotto-offerte, ma il dropdown non appare")
        print("🎯 OBIETTIVO: Verificare cosa è stato effettivamente salvato nel database")
        print("🎯 TEST RICHIESTI:")
        print("   1. Login as admin (username: admin, password: admin123)")
        print("   2. Recupera TUTTE le offerte recenti (GET /api/offerte?skip=0&limit=20)")
        print("   3. Cerca offerte create dall'utente (non 'Test Vodafone Offerta')")
        print("   4. Per ogni offerta dell'utente: verifica has_sub_offerte e sotto-offerte")
        print("   5. Diagnosi del problema")
        
        import time
        start_time = time.time()
        
        # **1. LOGIN AS ADMIN**
        print("\n🔐 1. LOGIN AS ADMIN...")
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            self.log_test("✅ Admin login (admin/admin123)", True, f"Token received, Role: {self.user_data['role']}")
        else:
            self.log_test("❌ Admin login failed", False, f"Status: {status}, Response: {response}")
            return False

        # **2. RECUPERA TUTTE LE OFFERTE RECENTI**
        print("\n📋 2. RECUPERA TUTTE LE OFFERTE RECENTI...")
        success, offerte_response, status = self.make_request('GET', 'offerte?skip=0&limit=20', expected_status=200)
        
        if success and status == 200:
            offerte = offerte_response if isinstance(offerte_response, list) else []
            self.log_test("✅ GET /api/offerte", True, f"Found {len(offerte)} offerte totali")
            
            if len(offerte) == 0:
                self.log_test("❌ No offerte found", False, "Cannot debug without offerte")
                return False
                
            # Ordina per created_at (più recenti prima)
            try:
                offerte_sorted = sorted(offerte, key=lambda x: x.get('created_at', ''), reverse=True)
                self.log_test("✅ Offerte sorted by created_at", True, f"Showing latest 5 offerte")
                
                print(f"\n   📊 ULTIME 5 OFFERTE (ordinate per created_at):")
                for i, offerta in enumerate(offerte_sorted[:5], 1):
                    nome = offerta.get('nome', 'Unknown')
                    offerta_id = offerta.get('id', 'No ID')
                    has_sub_offerte = offerta.get('has_sub_offerte', False)
                    parent_offerta_id = offerta.get('parent_offerta_id', None)
                    created_at = offerta.get('created_at', 'Unknown')
                    
                    print(f"      {i}. {nome}")
                    print(f"         • ID: {offerta_id}")
                    print(f"         • has_sub_offerte: {has_sub_offerte}")
                    print(f"         • parent_offerta_id: {parent_offerta_id}")
                    print(f"         • created_at: {created_at}")
                    
            except Exception as e:
                self.log_test("⚠️ Could not sort offerte", True, f"Using original order: {str(e)}")
                offerte_sorted = offerte
        else:
            self.log_test("❌ GET /api/offerte failed", False, f"Status: {status}")
            return False

        # **3. CERCA OFFERTE CREATE DALL'UTENTE (NON "Test Vodafone Offerta")**
        print("\n🔍 3. CERCA OFFERTE CREATE DALL'UTENTE...")
        
        user_offerte = []
        test_offerte = []
        
        for offerta in offerte_sorted:
            nome = offerta.get('nome', '')
            if 'Test Vodafone Offerta' not in nome:
                user_offerte.append(offerta)
            else:
                test_offerte.append(offerta)
        
        print(f"\n   📊 CLASSIFICAZIONE OFFERTE:")
        print(f"      • Offerte utente (non test): {len(user_offerte)}")
        print(f"      • Offerte test (Test Vodafone): {len(test_offerte)}")
        
        if len(user_offerte) == 0:
            self.log_test("⚠️ No user offerte found", True, "Only test offerte present")
            print(f"   ℹ️ Tutte le offerte sono 'Test Vodafone Offerta' - nessuna offerta utente trovata")
            
            # Show test offerte for reference
            if len(test_offerte) > 0:
                print(f"\n   📋 OFFERTE TEST PRESENTI:")
                for i, offerta in enumerate(test_offerte[:3], 1):
                    nome = offerta.get('nome', 'Unknown')
                    has_sub_offerte = offerta.get('has_sub_offerte', False)
                    parent_offerta_id = offerta.get('parent_offerta_id', None)
                    
                    print(f"      {i}. {nome}")
                    print(f"         • has_sub_offerte: {has_sub_offerte}")
                    print(f"         • parent_offerta_id: {parent_offerta_id}")
        else:
            self.log_test("✅ Found user offerte", True, f"{len(user_offerte)} offerte create dall'utente")
            
            print(f"\n   📋 OFFERTE UTENTE IDENTIFICATE:")
            for i, offerta in enumerate(user_offerte, 1):
                nome = offerta.get('nome', 'Unknown')
                offerta_id = offerta.get('id', 'No ID')
                has_sub_offerte = offerta.get('has_sub_offerte', False)
                parent_offerta_id = offerta.get('parent_offerta_id', None)
                created_at = offerta.get('created_at', 'Unknown')
                
                print(f"      {i}. {nome}")
                print(f"         • ID: {offerta_id}")
                print(f"         • has_sub_offerte: {has_sub_offerte}")
                print(f"         • parent_offerta_id: {parent_offerta_id}")
                print(f"         • created_at: {created_at}")

        # **4. PER OGNI OFFERTA DELL'UTENTE: VERIFICA DETTAGLI**
        print("\n🔍 4. VERIFICA DETTAGLI OGNI OFFERTA UTENTE...")
        
        diagnosi_results = []
        
        for i, offerta in enumerate(user_offerte, 1):
            nome = offerta.get('nome', 'Unknown')
            offerta_id = offerta.get('id', 'No ID')
            has_sub_offerte = offerta.get('has_sub_offerte', False)
            parent_offerta_id = offerta.get('parent_offerta_id', None)
            
            print(f"\n   📋 ANALISI OFFERTA {i}: {nome}")
            print(f"      • ID: {offerta_id}")
            
            # GET /api/offerte/{offerta_id}
            success, detail_response, detail_status = self.make_request(
                'GET', f'offerte/{offerta_id}', 
                expected_status=200
            )
            
            if success and detail_status == 200:
                self.log_test(f"✅ GET /api/offerte/{offerta_id[:8]}...", True, f"Offerta details retrieved")
                
                detail_has_sub_offerte = detail_response.get('has_sub_offerte', False)
                print(f"      • has_sub_offerte (detail): {detail_has_sub_offerte}")
                
                # Verify consistency
                if has_sub_offerte == detail_has_sub_offerte:
                    self.log_test(f"✅ has_sub_offerte consistent", True, f"List and detail both show: {has_sub_offerte}")
                else:
                    self.log_test(f"❌ has_sub_offerte inconsistent", False, f"List: {has_sub_offerte}, Detail: {detail_has_sub_offerte}")
                
            else:
                self.log_test(f"❌ GET /api/offerte/{offerta_id[:8]}... failed", False, f"Status: {detail_status}")
                detail_has_sub_offerte = has_sub_offerte  # Use list value as fallback
            
            # GET /api/offerte/{offerta_id}/sub-offerte
            success, sub_offerte_response, sub_status = self.make_request(
                'GET', f'offerte/{offerta_id}/sub-offerte', 
                expected_status=200
            )
            
            if success and sub_status == 200:
                sub_offerte = sub_offerte_response if isinstance(sub_offerte_response, list) else []
                sub_offerte_count = len(sub_offerte)
                
                self.log_test(f"✅ GET /api/offerte/{offerta_id[:8]}.../sub-offerte", True, f"Found {sub_offerte_count} sotto-offerte")
                
                print(f"      • Sotto-offerte trovate: {sub_offerte_count}")
                
                if sub_offerte_count > 0:
                    print(f"      • Sotto-offerte details:")
                    for j, sub_offerta in enumerate(sub_offerte, 1):
                        sub_nome = sub_offerta.get('nome', 'Unknown')
                        sub_id = sub_offerta.get('id', 'No ID')
                        sub_parent_id = sub_offerta.get('parent_offerta_id', None)
                        
                        print(f"         {j}. {sub_nome}")
                        print(f"            • ID: {sub_id}")
                        print(f"            • parent_offerta_id: {sub_parent_id}")
                        
                        # Verify parent relationship
                        if sub_parent_id == offerta_id:
                            self.log_test(f"✅ Sotto-offerta {j} parent correct", True, f"parent_offerta_id matches")
                        else:
                            self.log_test(f"❌ Sotto-offerta {j} parent incorrect", False, f"Expected: {offerta_id}, Got: {sub_parent_id}")
                
            else:
                self.log_test(f"❌ GET /api/offerte/{offerta_id[:8]}.../sub-offerte failed", False, f"Status: {sub_status}")
                sub_offerte_count = 0
            
            # **DIAGNOSI PER QUESTA OFFERTA**
            diagnosi = {
                'nome': nome,
                'id': offerta_id,
                'has_sub_offerte': detail_has_sub_offerte,
                'sub_offerte_count': sub_offerte_count,
                'issue': None,
                'diagnosis': None
            }
            
            if detail_has_sub_offerte == False and sub_offerte_count == 0:
                diagnosi['issue'] = "NO_SUB_OFFERTE"
                diagnosi['diagnosis'] = "Il checkbox non è stato spuntato o non funziona"
            elif detail_has_sub_offerte == True and sub_offerte_count == 0:
                diagnosi['issue'] = "MISSING_SUB_OFFERTE"
                diagnosi['diagnosis'] = "has_sub_offerte = true ma nessuna sotto-offerta → parent_offerta_id non impostato correttamente"
            elif detail_has_sub_offerte == True and sub_offerte_count > 0:
                diagnosi['issue'] = "WORKING_CORRECTLY"
                diagnosi['diagnosis'] = f"Configurazione corretta: has_sub_offerte = true e {sub_offerte_count} sotto-offerte trovate"
            elif detail_has_sub_offerte is None:
                diagnosi['issue'] = "FIELD_NOT_SAVED"
                diagnosi['diagnosis'] = "Campo has_sub_offerte non salvato (null/undefined)"
            else:
                diagnosi['issue'] = "UNEXPECTED_STATE"
                diagnosi['diagnosis'] = f"Stato inaspettato: has_sub_offerte = {detail_has_sub_offerte}, sotto-offerte = {sub_offerte_count}"
            
            diagnosi_results.append(diagnosi)
            
            print(f"      • DIAGNOSI: {diagnosi['diagnosis']}")

        # **5. DIAGNOSI FINALE**
        print("\n🎯 5. DIAGNOSI FINALE...")
        
        total_time = time.time() - start_time
        
        print(f"\n   📊 SUMMARY DIAGNOSI (Total time: {total_time:.2f}s):")
        print(f"      • Admin login: ✅ SUCCESS")
        print(f"      • Offerte totali trovate: {len(offerte)}")
        print(f"      • Offerte utente (non test): {len(user_offerte)}")
        print(f"      • Offerte test: {len(test_offerte)}")
        
        if len(user_offerte) == 0:
            print(f"\n   🚨 PROBLEMA PRINCIPALE:")
            print(f"      • NESSUNA OFFERTA UTENTE TROVATA")
            print(f"      • Tutte le offerte sono 'Test Vodafone Offerta'")
            print(f"      • L'utente potrebbe non aver salvato correttamente l'offerta")
            print(f"      • O l'offerta potrebbe essere stata eliminata")
            
            self.log_test("🚨 CRITICAL FINDING", False, "No user offerte found - only test offerte present")
            return False
        
        # Analyze diagnosi results
        issues_found = {}
        for diagnosi in diagnosi_results:
            issue_type = diagnosi['issue']
            if issue_type not in issues_found:
                issues_found[issue_type] = []
            issues_found[issue_type].append(diagnosi)
        
        print(f"\n   📋 LISTA COMPLETA OFFERTE UTENTE CON DIAGNOSI:")
        for i, diagnosi in enumerate(diagnosi_results, 1):
            nome = diagnosi['nome']
            issue = diagnosi['issue']
            diagnosis = diagnosi['diagnosis']
            
            if issue == "WORKING_CORRECTLY":
                status_icon = "✅"
            elif issue in ["NO_SUB_OFFERTE", "MISSING_SUB_OFFERTE"]:
                status_icon = "❌"
            else:
                status_icon = "⚠️"
            
            print(f"      {i}. {status_icon} {nome}")
            print(f"         • Problema: {issue}")
            print(f"         • Diagnosi: {diagnosis}")
        
        # Final recommendations
        print(f"\n   🔧 RACCOMANDAZIONI:")
        
        if "NO_SUB_OFFERTE" in issues_found:
            count = len(issues_found["NO_SUB_OFFERTE"])
            print(f"      • {count} offerte con has_sub_offerte = false:")
            print(f"        → Verificare che il checkbox 'Ha sotto-offerte' sia stato spuntato nell'UI")
            print(f"        → Controllare che il frontend invii has_sub_offerte = true nel payload")
        
        if "MISSING_SUB_OFFERTE" in issues_found:
            count = len(issues_found["MISSING_SUB_OFFERTE"])
            print(f"      • {count} offerte con has_sub_offerte = true ma senza sotto-offerte:")
            print(f"        → Verificare che le sotto-offerte abbiano parent_offerta_id corretto")
            print(f"        → Controllare che il salvataggio delle sotto-offerte funzioni")
        
        if "FIELD_NOT_SAVED" in issues_found:
            count = len(issues_found["FIELD_NOT_SAVED"])
            print(f"      • {count} offerte con campo has_sub_offerte non salvato:")
            print(f"        → Problema nel backend: campo non viene salvato nel database")
        
        if "WORKING_CORRECTLY" in issues_found:
            count = len(issues_found["WORKING_CORRECTLY"])
            print(f"      • {count} offerte funzionano correttamente")
            print(f"        → Queste offerte dovrebbero mostrare il dropdown delle sotto-offerte")
        
        # Success determination
        working_count = len(issues_found.get("WORKING_CORRECTLY", []))
        total_user_offerte = len(user_offerte)
        success_rate = (working_count / total_user_offerte) * 100 if total_user_offerte > 0 else 0
        
        print(f"\n   📊 SUCCESS RATE: {working_count}/{total_user_offerte} offerte working correctly ({success_rate:.1f}%)")
        
        if success_rate >= 50:
            print(f"   ✅ DIAGNOSI COMPLETATA: Alcune offerte funzionano, problema identificato per le altre")
            self.log_test("✅ Offerta sotto-offerte debug completed", True, f"Issues identified and diagnosed")
            return True
        else:
            print(f"   🚨 PROBLEMI CRITICI: Nessuna o poche offerte funzionano correttamente")
            self.log_test("🚨 Critical issues found", False, f"Most offerte have problems with sotto-offerte")
            return False


if __name__ == "__main__":
    tester = OffertaDebugTester()
    tester.test_offerta_utente_sotto_offerte_debug()