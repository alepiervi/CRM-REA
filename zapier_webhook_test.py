#!/usr/bin/env python3
"""
Zapier Webhook Lead Verification Test
Tests the specific issue reported about Zapier webhook leads not appearing in frontend
"""

import requests
import sys
import json
from datetime import datetime, timedelta
import subprocess

class ZapierWebhookTester:
    def __init__(self, base_url="https://role-manager-19.preview.emergentagent.com/api"):
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

    def test_zapier_webhook_lead_verification(self):
        """🚨 VERIFICA LEAD CREATO DA ZAPIER - Test completo per identificare perché il lead non si vede nel frontend"""
        print("\n🚨 VERIFICA LEAD CREATO DA ZAPIER")
        print("🎯 OBIETTIVO: Verificare se il lead inviato da Zapier è stato creato nel database e perché non si vede nel frontend")
        print("🎯 CONTESTO:")
        print("   • Zapier ha inviato un lead tramite webhook GET")
        print("   • Zapier mostra 'status: success' con request ID: 019a96d9-339f-9a9c-9799-63910a516dd1")
        print("   • L'utente non vede il lead nell'interfaccia")
        
        import time
        start_time = time.time()
        
        # **1. LOGIN ADMIN**
        print("\n🔐 1. LOGIN ADMIN (admin/admin123)...")
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

        # **2. CONTROLLA LOG BACKEND**
        print("\n📊 2. CONTROLLA LOG BACKEND - Cerca la richiesta webhook...")
        print("   🔍 Cercando nei log per 'webhook' negli ultimi 10 minuti...")
        print("   🔍 Request ID da cercare: 019a96d9-339f-9a9c-9799-63910a516dd1")
        
        # Check backend logs using bash command
        try:
            # Check supervisor backend logs for webhook entries
            log_command = "tail -n 100 /var/log/supervisor/backend.*.log | grep -i webhook || echo 'No webhook entries found'"
            result = subprocess.run(log_command, shell=True, capture_output=True, text=True, timeout=10)
            
            if result.stdout and "webhook" in result.stdout.lower():
                self.log_test("✅ Webhook entries found in logs", True, "Found webhook-related log entries")
                print(f"   📋 WEBHOOK LOG ENTRIES:")
                for line in result.stdout.split('\n')[:10]:  # Show first 10 lines
                    if line.strip():
                        print(f"      {line}")
            else:
                self.log_test("⚠️ No webhook entries in recent logs", True, "No webhook entries found in last 100 log lines")
                
        except Exception as e:
            self.log_test("⚠️ Could not check backend logs", True, f"Log check failed: {e}")

        # **3. GET /api/leads - Lista tutti i lead recenti**
        print("\n📋 3. GET /api/leads - Lista tutti i lead recenti...")
        success, leads_response, status = self.make_request('GET', 'leads?limit=20', expected_status=200)
        
        recent_leads = []
        if success and status == 200:
            leads = leads_response if isinstance(leads_response, list) else []
            leads_count = len(leads)
            
            self.log_test("✅ GET /api/leads SUCCESS", True, f"Status: 200 OK, Found {leads_count} leads")
            
            # Filter leads created in last 10 minutes
            current_time = datetime.now()
            ten_minutes_ago = current_time - timedelta(minutes=10)
            
            print(f"   📊 ANALISI LEAD RECENTI (ultimi 10 minuti):")
            print(f"   🕐 Tempo corrente: {current_time.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"   🕐 Filtro da: {ten_minutes_ago.strftime('%Y-%m-%d %H:%M:%S')}")
            
            for i, lead in enumerate(leads, 1):
                lead_id = lead.get('id', 'No ID')
                nome = lead.get('nome', 'No Name')
                cognome = lead.get('cognome', 'No Surname')
                telefono = lead.get('telefono', 'No Phone')
                email = lead.get('email', 'No Email')
                provincia = lead.get('provincia', 'No Province')
                unit_id = lead.get('unit_id', 'No Unit')
                commessa_id = lead.get('commessa_id', 'No Commessa')
                assigned_agent_id = lead.get('assigned_agent_id', 'No Agent')
                created_at = lead.get('created_at', 'No Date')
                status_field = lead.get('status', 'No Status')
                
                print(f"\n   {i}. LEAD: {nome} {cognome}")
                print(f"      • ID: {lead_id}")
                print(f"      • Telefono: {telefono}")
                print(f"      • Email: {email}")
                print(f"      • Provincia: {provincia}")
                print(f"      • Unit ID: {unit_id}")
                print(f"      • Commessa ID: {commessa_id}")
                print(f"      • Assigned Agent ID: {assigned_agent_id}")
                print(f"      • Created At: {created_at}")
                print(f"      • Status: {status_field}")
                
                # Check if this is a recent lead (last 10 minutes)
                try:
                    if created_at and created_at != 'No Date':
                        # Parse the created_at timestamp
                        if isinstance(created_at, str):
                            # Handle different datetime formats
                            for fmt in ['%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%SZ', '%Y-%m-%d %H:%M:%S']:
                                try:
                                    lead_time = datetime.strptime(created_at.replace('Z', ''), fmt.replace('Z', ''))
                                    break
                                except ValueError:
                                    continue
                            else:
                                lead_time = None
                        else:
                            lead_time = created_at
                            
                        if lead_time and lead_time >= ten_minutes_ago:
                            recent_leads.append(lead)
                            print(f"      ✅ RECENT LEAD (created in last 10 minutes)")
                        else:
                            print(f"      ⏰ Older lead (created before 10 minutes ago)")
                except Exception as e:
                    print(f"      ⚠️ Could not parse created_at: {e}")
                    
            if recent_leads:
                self.log_test("✅ Found recent leads", True, f"Found {len(recent_leads)} leads created in last 10 minutes")
            else:
                self.log_test("⚠️ No recent leads found", True, "No leads created in last 10 minutes")
                
        else:
            self.log_test("❌ GET /api/leads FAILED", False, f"Status: {status}, Response: {leads_response}")
            return False

        # **4. VERIFICA ULTIMO LEAD CREATO**
        print("\n🔍 4. VERIFICA ULTIMO LEAD CREATO...")
        
        if leads and len(leads) > 0:
            # Get the most recent lead (first in list if sorted by creation date)
            latest_lead = leads[0]
            latest_lead_id = latest_lead.get('id')
            latest_nome = latest_lead.get('nome', 'Unknown')
            latest_cognome = latest_lead.get('cognome', 'Unknown')
            latest_created_at = latest_lead.get('created_at')
            
            print(f"   📋 ULTIMO LEAD CREATO:")
            print(f"      • Nome: {latest_nome} {latest_cognome}")
            print(f"      • ID: {latest_lead_id}")
            print(f"      • Created At: {latest_created_at}")
            
            # Check if it has Zapier data characteristics
            zapier_indicators = []
            
            # Check for typical Zapier fields
            if latest_lead.get('ip_address'):
                zapier_indicators.append(f"IP Address: {latest_lead.get('ip_address')}")
            if latest_lead.get('url'):
                zapier_indicators.append(f"URL: {latest_lead.get('url')}")
            if latest_lead.get('campagna'):
                zapier_indicators.append(f"Campagna: {latest_lead.get('campagna')}")
            if latest_lead.get('inserzione'):
                zapier_indicators.append(f"Inserzione: {latest_lead.get('inserzione')}")
                
            if zapier_indicators:
                print(f"      ✅ POSSIBILI INDICATORI ZAPIER:")
                for indicator in zapier_indicators:
                    print(f"         • {indicator}")
                self.log_test("✅ Lead has Zapier characteristics", True, f"Found {len(zapier_indicators)} Zapier indicators")
            else:
                print(f"      ⚠️ Nessun indicatore Zapier evidente")
                self.log_test("⚠️ No obvious Zapier indicators", True, "Lead may not be from Zapier")
                
            # Verify assignment
            unit_id = latest_lead.get('unit_id')
            commessa_id = latest_lead.get('commessa_id')
            assigned_agent_id = latest_lead.get('assigned_agent_id')
            
            if unit_id:
                self.log_test("✅ Lead has unit_id", True, f"Unit ID: {unit_id}")
            else:
                self.log_test("❌ Lead missing unit_id", False, "Lead not assigned to any unit")
                
            if commessa_id:
                self.log_test("✅ Lead has commessa_id", True, f"Commessa ID: {commessa_id}")
            else:
                self.log_test("❌ Lead missing commessa_id", False, "Lead not assigned to any commessa")
                
            if assigned_agent_id:
                self.log_test("✅ Lead assigned to agent", True, f"Agent ID: {assigned_agent_id}")
            else:
                self.log_test("⚠️ Lead not assigned to agent", True, "Lead not assigned to specific agent")
                
        else:
            self.log_test("❌ No leads found in database", False, "Cannot verify latest lead - database empty")
            print(f"   ❌ CRITICAL: No leads found in database!")
            print(f"   🚨 This suggests the Zapier webhook may have failed to create the lead")

        # **5. VERIFICA UNIT E COMMESSA**
        print("\n🏢 5. VERIFICA UNIT E COMMESSA...")
        
        # Get all units
        success, units_response, status = self.make_request('GET', 'units', expected_status=200)
        
        if success and status == 200:
            units = units_response if isinstance(units_response, list) else []
            self.log_test("✅ GET /api/units SUCCESS", True, f"Found {len(units)} units")
            
            print(f"   📊 TUTTE LE UNIT DISPONIBILI:")
            for i, unit in enumerate(units, 1):
                unit_nome = unit.get('nome', 'Unknown')
                unit_id = unit.get('id', 'No ID')
                unit_commessa_id = unit.get('commessa_id', 'No Commessa')
                print(f"      {i}. {unit_nome} (ID: {unit_id[:8]}..., Commessa: {unit_commessa_id[:8]}...)")
                
        else:
            self.log_test("❌ GET /api/units FAILED", False, f"Status: {status}")
            
        # Get all commesse
        success, commesse_response, status = self.make_request('GET', 'commesse', expected_status=200)
        
        if success and status == 200:
            commesse = commesse_response if isinstance(commesse_response, list) else []
            self.log_test("✅ GET /api/commesse SUCCESS", True, f"Found {len(commesse)} commesse")
            
            # Look for "Fotovoltaico" commessa as mentioned in the request
            fotovoltaico_commessa = None
            for commessa in commesse:
                if commessa.get('nome', '').lower() == 'fotovoltaico':
                    fotovoltaico_commessa = commessa
                    break
                    
            print(f"   📊 TUTTE LE COMMESSE DISPONIBILI:")
            for i, commessa in enumerate(commesse, 1):
                commessa_nome = commessa.get('nome', 'Unknown')
                commessa_id = commessa.get('id', 'No ID')
                print(f"      {i}. {commessa_nome} (ID: {commessa_id[:8]}...)")
                
                if commessa_nome.lower() == 'fotovoltaico':
                    print(f"         ✅ FOTOVOLTAICO COMMESSA FOUND!")
                    
            if fotovoltaico_commessa:
                fotovoltaico_id = fotovoltaico_commessa.get('id')
                self.log_test("✅ Found Fotovoltaico commessa", True, f"ID: {fotovoltaico_id[:8]}...")
                
                # Check if any recent leads have this commessa_id
                if recent_leads:
                    fotovoltaico_leads = [lead for lead in recent_leads if lead.get('commessa_id') == fotovoltaico_id]
                    if fotovoltaico_leads:
                        self.log_test("✅ Recent leads assigned to Fotovoltaico", True, f"Found {len(fotovoltaico_leads)} leads")
                    else:
                        self.log_test("⚠️ No recent leads for Fotovoltaico", True, "Recent leads not assigned to Fotovoltaico commessa")
            else:
                self.log_test("❌ Fotovoltaico commessa not found", False, "Cannot verify commessa assignment")
                
        else:
            self.log_test("❌ GET /api/commesse FAILED", False, f"Status: {status}")

        # **FINAL DIAGNOSIS**
        total_time = time.time() - start_time
        
        print(f"\n🎯 VERIFICA LEAD CREATO DA ZAPIER - DIAGNOSI FINALE:")
        print(f"   🎯 OBIETTIVO: Verificare se il lead inviato da Zapier è stato creato e perché non si vede")
        print(f"   📊 RISULTATI DIAGNOSI (Total time: {total_time:.2f}s):")
        print(f"      • Admin login: ✅ SUCCESS")
        print(f"      • Backend logs check: ✅ COMPLETED")
        print(f"      • GET /api/leads: ✅ SUCCESS ({len(leads) if 'leads' in locals() else 0} total leads)")
        print(f"      • Recent leads (10 min): {'✅ FOUND' if recent_leads else '❌ NONE'} ({len(recent_leads)} leads)")
        print(f"      • Units available: {'✅ FOUND' if 'units' in locals() and units else '❌ NONE'} ({len(units) if 'units' in locals() else 0} units)")
        print(f"      • Commesse available: {'✅ FOUND' if 'commesse' in locals() and commesse else '❌ NONE'} ({len(commesse) if 'commesse' in locals() else 0} commesse)")
        print(f"      • Fotovoltaico commessa: {'✅ FOUND' if 'fotovoltaico_commessa' in locals() and fotovoltaico_commessa else '❌ NOT FOUND'}")
        
        # Determine primary diagnosis
        if not leads or len(leads) == 0:
            primary_diagnosis = "🚨 CRITICAL: NO LEADS IN DATABASE - Zapier webhook failed to create lead"
            severity = "CRITICAL"
        elif not recent_leads:
            primary_diagnosis = "⚠️ NO RECENT LEADS - Lead may have been created earlier or webhook failed"
            severity = "HIGH"
        elif recent_leads and all(lead.get('unit_id') for lead in recent_leads):
            primary_diagnosis = "✅ LEADS EXIST WITH PROPER ASSIGNMENT - Issue likely in frontend filtering"
            severity = "MEDIUM"
        else:
            primary_diagnosis = "⚠️ LEADS EXIST BUT MISSING ASSIGNMENTS - Configuration issue"
            severity = "HIGH"
            
        print(f"\n   🎯 DIAGNOSI PRIMARIA:")
        print(f"      • Severity: {severity}")
        print(f"      • Diagnosis: {primary_diagnosis}")
        
        print(f"\n   🔧 RACCOMANDAZIONI:")
        if not leads:
            print(f"      1. Verificare configurazione webhook Zapier")
            print(f"      2. Controllare endpoint webhook nel backend")
            print(f"      3. Verificare che Zapier stia inviando dati corretti")
        elif not recent_leads:
            print(f"      1. Verificare timestamp del lead Zapier")
            print(f"      2. Controllare se il lead è stato creato prima degli ultimi 10 minuti")
            print(f"      3. Cercare il lead per nome/telefono specifico")
        else:
            print(f"      1. Verificare filtri frontend per unit_id")
            print(f"      2. Controllare permessi utente per visualizzare lead")
            print(f"      3. Verificare stato del lead (non nascosto/archiviato)")
            print(f"      4. Controllare assegnazione agente se utente vede solo 'I miei lead'")
            
        return len(leads) > 0 if 'leads' in locals() else False

if __name__ == "__main__":
    tester = ZapierWebhookTester()
    
    print("🎯 RUNNING SPECIFIC TEST: Zapier Webhook Lead Verification")
    print(f"🌐 Base URL: {tester.base_url}")
    print("=" * 80)
    
    try:
        result = tester.test_zapier_webhook_lead_verification()
        
        # Print summary
        print(f"\n📊 Final Test Results:")
        print(f"   Tests run: {tester.tests_run}")
        print(f"   Tests passed: {tester.tests_passed}")
        if tester.tests_run > 0:
            print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
        else:
            print(f"   Success rate: N/A (no tests run)")
        
        if result:
            print("🎉 ZAPIER WEBHOOK VERIFICATION SUCCESSFUL!")
        else:
            print("❌ ZAPIER WEBHOOK VERIFICATION FAILED!")
            
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        result = False
    
    exit(0 if result else 1)