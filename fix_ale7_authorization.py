#!/usr/bin/env python3
"""
Fix ale7 authorization issue - Sub agenzia not authorized for commessa
"""

import requests
import json

class ALE7AuthorizationFixer:
    def __init__(self, base_url="https://lead2ai-flow.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None

    def login_admin(self):
        """Login as admin to get access token"""
        url = f"{self.base_url}/auth/login"
        data = {'username': 'admin', 'password': 'admin123'}
        
        response = requests.post(url, json=data, timeout=30)
        if response.status_code == 200:
            result = response.json()
            self.token = result['access_token']
            print("✅ Admin login successful")
            return True
        else:
            print(f"❌ Admin login failed: {response.status_code}")
            return False

    def get_headers(self):
        """Get authorization headers"""
        return {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}

    def get_sub_agenzie(self):
        """Get all sub agenzie"""
        url = f"{self.base_url}/sub-agenzie"
        response = requests.get(url, headers=self.get_headers(), timeout=30)
        
        if response.status_code == 200:
            sub_agenzie = response.json()
            print(f"✅ Found {len(sub_agenzie)} sub agenzie")
            return sub_agenzie
        else:
            print(f"❌ Failed to get sub agenzie: {response.status_code}")
            return []

    def get_commesse(self):
        """Get all commesse"""
        url = f"{self.base_url}/commesse"
        response = requests.get(url, headers=self.get_headers(), timeout=30)
        
        if response.status_code == 200:
            commesse = response.json()
            print(f"✅ Found {len(commesse)} commesse")
            return commesse
        else:
            print(f"❌ Failed to get commesse: {response.status_code}")
            return []

    def analyze_ale7_issue(self):
        """Analyze ale7's authorization issue"""
        print("\n🔍 ANALYZING ALE7 AUTHORIZATION ISSUE...")
        
        # Get ale7's current configuration
        ale7_sub_agenzia_id = "9b0b8890-81f6-4cdf-859e-48a8ae6e9856"
        fastweb_commessa_id = "4cb70f28-6278-4d0f-b2b7-65f2b783f3f1"
        
        print(f"   ale7 Sub Agenzia ID: {ale7_sub_agenzia_id}")
        print(f"   Fastweb Commessa ID: {fastweb_commessa_id}")
        
        # Get sub agenzie
        sub_agenzie = self.get_sub_agenzie()
        
        # Find ale7's sub agenzia
        ale7_sub_agenzia = None
        for sa in sub_agenzie:
            if sa['id'] == ale7_sub_agenzia_id:
                ale7_sub_agenzia = sa
                break
        
        if ale7_sub_agenzia:
            print(f"\n📋 ALE7'S SUB AGENZIA DETAILS:")
            print(f"   • ID: {ale7_sub_agenzia['id']}")
            print(f"   • Nome: {ale7_sub_agenzia['nome']}")
            print(f"   • Commesse Autorizzate: {ale7_sub_agenzia.get('commesse_autorizzate', [])}")
            
            # Check if Fastweb commessa is in authorized commesse
            commesse_autorizzate = ale7_sub_agenzia.get('commesse_autorizzate', [])
            if fastweb_commessa_id in commesse_autorizzate:
                print(f"   ✅ Fastweb commessa IS authorized for this sub agenzia")
                return True
            else:
                print(f"   ❌ Fastweb commessa is NOT authorized for this sub agenzia")
                print(f"   🔧 NEED TO ADD: {fastweb_commessa_id} to commesse_autorizzate")
                return False
        else:
            print(f"❌ ale7's sub agenzia not found: {ale7_sub_agenzia_id}")
            return False

    def fix_ale7_authorization(self):
        """Fix ale7's authorization by adding Fastweb commessa to sub agenzia"""
        print("\n🔧 FIXING ALE7 AUTHORIZATION...")
        
        ale7_sub_agenzia_id = "9b0b8890-81f6-4cdf-859e-48a8ae6e9856"
        fastweb_commessa_id = "4cb70f28-6278-4d0f-b2b7-65f2b783f3f1"
        
        # Get current sub agenzia data
        sub_agenzie = self.get_sub_agenzie()
        ale7_sub_agenzia = None
        
        for sa in sub_agenzie:
            if sa['id'] == ale7_sub_agenzia_id:
                ale7_sub_agenzia = sa
                break
        
        if not ale7_sub_agenzia:
            print(f"❌ Cannot find ale7's sub agenzia: {ale7_sub_agenzia_id}")
            return False
        
        # Update commesse_autorizzate to include Fastweb
        current_commesse = ale7_sub_agenzia.get('commesse_autorizzate', [])
        if fastweb_commessa_id not in current_commesse:
            updated_commesse = current_commesse + [fastweb_commessa_id]
            
            # Prepare update data
            update_data = {
                "commesse_autorizzate": updated_commesse
            }
            
            print(f"   📋 UPDATING SUB AGENZIA:")
            print(f"      • Current commesse: {current_commesse}")
            print(f"      • Updated commesse: {updated_commesse}")
            
            # Update sub agenzia
            url = f"{self.base_url}/sub-agenzie/{ale7_sub_agenzia_id}"
            response = requests.put(url, json=update_data, headers=self.get_headers(), timeout=30)
            
            if response.status_code == 200:
                print(f"   ✅ Sub agenzia updated successfully")
                return True
            else:
                print(f"   ❌ Failed to update sub agenzia: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
        else:
            print(f"   ✅ Fastweb commessa already authorized")
            return True

    def test_ale7_client_creation(self):
        """Test ale7 client creation after fix"""
        print("\n🧪 TESTING ALE7 CLIENT CREATION AFTER FIX...")
        
        # Login as ale7
        url = f"{self.base_url}/auth/login"
        data = {'username': 'ale7', 'password': 'admin123'}
        
        response = requests.post(url, json=data, timeout=30)
        if response.status_code != 200:
            print(f"❌ ale7 login failed: {response.status_code}")
            return False
        
        ale7_token = response.json()['access_token']
        ale7_headers = {'Authorization': f'Bearer {ale7_token}', 'Content-Type': 'application/json'}
        
        print("✅ ale7 login successful")
        
        # Prepare client data
        import time
        timestamp = str(int(time.time()))
        
        client_data = {
            "nome": "Test",
            "cognome": f"FixedStore_{timestamp}",
            "telefono": f"+39123456{timestamp[-4:]}",
            "email": f"testfixed_{timestamp}@store.it",
            "commessa_id": "4cb70f28-6278-4d0f-b2b7-65f2b783f3f1",  # Fastweb
            "sub_agenzia_id": "9b0b8890-81f6-4cdf-859e-48a8ae6e9856",  # ale7's sub agenzia
            "tipologia_contratto": "energia_fastweb",
            "segmento": "privato"
        }
        
        # Attempt client creation
        url = f"{self.base_url}/clienti"
        response = requests.post(url, json=client_data, headers=ale7_headers, timeout=30)
        
        if response.status_code in [200, 201]:
            result = response.json()
            client_id = result.get('id', 'N/A')
            print(f"✅ CLIENT CREATION SUCCESS!")
            print(f"   • Client ID: {client_id}")
            print(f"   • Nome: {client_data['nome']} {client_data['cognome']}")
            print(f"   • Status: {response.status_code}")
            return True
        else:
            print(f"❌ CLIENT CREATION FAILED!")
            print(f"   • Status: {response.status_code}")
            print(f"   • Response: {response.text}")
            return False

    def run_complete_fix(self):
        """Run complete fix process"""
        print("🚀 STARTING ALE7 AUTHORIZATION FIX...")
        print("=" * 80)
        
        # Step 1: Login as admin
        if not self.login_admin():
            return False
        
        # Step 2: Analyze the issue
        issue_exists = not self.analyze_ale7_issue()
        
        if issue_exists:
            # Step 3: Fix the authorization
            if not self.fix_ale7_authorization():
                return False
        else:
            print("✅ No authorization issue found")
        
        # Step 4: Test client creation
        success = self.test_ale7_client_creation()
        
        print("\n" + "=" * 80)
        print("🎯 ALE7 AUTHORIZATION FIX SUMMARY")
        print("=" * 80)
        
        if success:
            print("🎉 SUCCESS: ale7 can now create clients!")
            print("🎉 ISSUE RESOLVED: Sub agenzia authorization fixed")
        else:
            print("❌ FAILED: ale7 still cannot create clients")
            print("❌ ISSUE PERSISTS: Additional investigation needed")
        
        return success

if __name__ == "__main__":
    fixer = ALE7AuthorizationFixer()
    success = fixer.run_complete_fix()
    exit(0 if success else 1)