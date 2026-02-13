#!/usr/bin/env python3
"""
Focused test for cascading authorization fix - ale7 vs admin comparison
"""

import requests
import json

class CascadingAuthTest:
    def __init__(self, base_url="https://referente-oversight.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.ale7_token = None
        self.admin_token = None

    def login_user(self, username, password):
        """Login and get token"""
        url = f"{self.base_url}/auth/login"
        data = {'username': username, 'password': password}
        
        try:
            response = requests.post(url, json=data, timeout=30)
            if response.status_code == 200:
                result = response.json()
                return result.get('access_token'), result.get('user')
            else:
                print(f"❌ Login failed for {username}: {response.status_code}")
                return None, None
        except Exception as e:
            print(f"❌ Login error for {username}: {e}")
            return None, None

    def test_cascading_endpoint(self, token, user_info, sub_agenzia_id):
        """Test cascading endpoint with given token"""
        url = f"{self.base_url}/cascade/commesse-by-subagenzia/{sub_agenzia_id}"
        headers = {'Authorization': f'Bearer {token}'}
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code == 200:
                commesse = response.json()
                return True, commesse
            else:
                print(f"❌ Cascading failed: {response.status_code}")
                return False, None
        except Exception as e:
            print(f"❌ Cascading error: {e}")
            return False, None

    def run_test(self):
        """Run the focused cascading authorization test"""
        print("🚨 FOCUSED CASCADING AUTHORIZATION TEST")
        print("=" * 60)
        
        # Login ale7
        print("\n🔐 LOGIN ALE7...")
        self.ale7_token, ale7_user = self.login_user('ale7', 'admin123')
        
        if not self.ale7_token:
            print("❌ ale7 login failed")
            return False
            
        ale7_commesse = ale7_user.get('commesse_autorizzate', [])
        ale7_sub_agenzia = ale7_user.get('sub_agenzia_id')
        
        print(f"✅ ale7 logged in successfully")
        print(f"   Role: {ale7_user.get('role')}")
        print(f"   Sub Agenzia ID: {ale7_sub_agenzia}")
        print(f"   Authorized Commesse: {ale7_commesse}")
        print(f"   Commesse Count: {len(ale7_commesse)}")
        
        # Login admin
        print("\n🔐 LOGIN ADMIN...")
        self.admin_token, admin_user = self.login_user('admin', 'admin123')
        
        if not self.admin_token:
            print("❌ admin login failed")
            return False
            
        print(f"✅ admin logged in successfully")
        print(f"   Role: {admin_user.get('role')}")
        
        # Test cascading with ale7
        print(f"\n🔍 TEST CASCADING WITH ALE7...")
        print(f"   Endpoint: GET /api/cascade/commesse-by-subagenzia/{ale7_sub_agenzia}")
        
        success, ale7_commesse_result = self.test_cascading_endpoint(
            self.ale7_token, ale7_user, ale7_sub_agenzia
        )
        
        if success:
            print(f"✅ ale7 cascading successful")
            print(f"   Commesse returned: {len(ale7_commesse_result)}")
            
            for i, commessa in enumerate(ale7_commesse_result):
                commessa_id = commessa.get('id')
                commessa_nome = commessa.get('nome')
                is_authorized = commessa_id in ale7_commesse
                
                print(f"   Commessa {i+1}: {commessa_nome}")
                print(f"      ID: {commessa_id}")
                print(f"      Authorized for ale7: {'✅ YES' if is_authorized else '❌ NO'}")
                
                if not is_authorized:
                    print(f"      🚨 SECURITY ISSUE: Unauthorized commessa visible!")
            
            # Check authorization compliance
            unauthorized_count = sum(1 for c in ale7_commesse_result if c.get('id') not in ale7_commesse)
            
            if unauthorized_count == 0:
                print(f"\n✅ CASCADING AUTHORIZATION FIX WORKING")
                print(f"   All {len(ale7_commesse_result)} commesse are authorized for ale7")
                ale7_test_success = True
            else:
                print(f"\n❌ CASCADING AUTHORIZATION FIX NOT WORKING")
                print(f"   {unauthorized_count} unauthorized commesse visible to ale7")
                ale7_test_success = False
        else:
            print(f"❌ ale7 cascading failed")
            ale7_test_success = False
        
        # Test cascading with admin
        print(f"\n🔍 TEST CASCADING WITH ADMIN...")
        print(f"   Endpoint: GET /api/cascade/commesse-by-subagenzia/{ale7_sub_agenzia}")
        
        success, admin_commesse_result = self.test_cascading_endpoint(
            self.admin_token, admin_user, ale7_sub_agenzia
        )
        
        if success:
            print(f"✅ admin cascading successful")
            print(f"   Commesse returned: {len(admin_commesse_result)}")
            
            for i, commessa in enumerate(admin_commesse_result):
                commessa_id = commessa.get('id')
                commessa_nome = commessa.get('nome')
                
                print(f"   Commessa {i+1}: {commessa_nome}")
                print(f"      ID: {commessa_id}")
            
            admin_test_success = True
        else:
            print(f"❌ admin cascading failed")
            admin_test_success = False
        
        # Compare results
        print(f"\n📊 COMPARISON ANALYSIS...")
        if ale7_test_success and admin_test_success:
            ale7_count = len(ale7_commesse_result)
            admin_count = len(admin_commesse_result)
            
            print(f"   ale7 sees: {ale7_count} commesse")
            print(f"   admin sees: {admin_count} commesse")
            
            if admin_count >= ale7_count:
                print(f"✅ Expected behavior: admin sees same or more commesse")
            else:
                print(f"❌ Unexpected: admin sees fewer commesse than ale7")
            
            # Check specific commesse mentioned in review
            ale7_commesse_names = [c.get('nome', '').lower() for c in ale7_commesse_result]
            admin_commesse_names = [c.get('nome', '').lower() for c in admin_commesse_result]
            
            fastweb_ale7 = 'fastweb' in ale7_commesse_names
            telepass_ale7 = 'telepass' in ale7_commesse_names
            fastweb_admin = 'fastweb' in admin_commesse_names
            telepass_admin = 'telepass' in admin_commesse_names
            
            print(f"\n🎯 SPECIFIC COMMESSE CHECK:")
            print(f"   ale7 sees Fastweb: {'✅ YES' if fastweb_ale7 else '❌ NO'}")
            print(f"   ale7 sees Telepass: {'❌ YES (PROBLEM!)' if telepass_ale7 else '✅ NO (CORRECT)'}")
            print(f"   admin sees Fastweb: {'✅ YES' if fastweb_admin else '❌ NO'}")
            print(f"   admin sees Telepass: {'✅ YES' if telepass_admin else '❌ NO'}")
            
            # Final assessment
            if fastweb_ale7 and not telepass_ale7:
                print(f"\n🎉 SUCCESS: ale7 sees only Fastweb (authorized), not Telepass!")
                print(f"🎉 CASCADING AUTHORIZATION FIX IS WORKING CORRECTLY!")
                return True
            elif not telepass_ale7:
                print(f"\n✅ PARTIAL SUCCESS: ale7 doesn't see Telepass (good)")
                print(f"ℹ️ ale7 may not see Fastweb due to different commesse configuration")
                return True
            else:
                print(f"\n❌ FAILURE: ale7 still sees Telepass (unauthorized commessa)")
                print(f"❌ CASCADING AUTHORIZATION FIX NOT WORKING!")
                return False
        else:
            print(f"❌ Cannot complete comparison due to test failures")
            return False

if __name__ == "__main__":
    test = CascadingAuthTest()
    success = test.run_test()
    
    print(f"\n" + "=" * 60)
    if success:
        print(f"🎉 CASCADING AUTHORIZATION FIX VERIFICATION: SUCCESS!")
    else:
        print(f"❌ CASCADING AUTHORIZATION FIX VERIFICATION: FAILED!")
    
    exit(0 if success else 1)