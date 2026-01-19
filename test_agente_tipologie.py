#!/usr/bin/env python3
"""
Quick test to check Agente Specializzato and Operatore tipologie issue
"""

import requests
import json

class QuickTipologieTest:
    def __init__(self):
        self.base_url = "https://agentify-6.preview.emergentagent.com/api"
        self.token = None
        
    def login_admin(self):
        """Login as admin"""
        response = requests.post(f"{self.base_url}/auth/login", 
                               json={'username': 'admin', 'password': 'admin123'})
        if response.status_code == 200:
            data = response.json()
            self.token = data['access_token']
            print("✅ Admin login successful")
            return True
        else:
            print(f"❌ Admin login failed: {response.status_code}")
            return False
    
    def get_users_by_role(self, target_roles):
        """Get users by specific roles"""
        headers = {'Authorization': f'Bearer {self.token}'}
        response = requests.get(f"{self.base_url}/users", headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Failed to get users: {response.status_code}")
            return []
            
        users = response.json()
        target_users = []
        
        for user in users:
            if user.get('role') in target_roles and user.get('is_active', False):
                target_users.append(user)
                
        return target_users
    
    def test_user_tipologie_issue(self, user):
        """Test if a user has the tipologie issue"""
        username = user.get('username', 'Unknown')
        role = user.get('role', 'Unknown')
        tipologie_autorizzate = user.get('tipologie_autorizzate', [])
        
        print(f"\n🔍 Testing user: {username} (role: {role})")
        print(f"   • tipologie_autorizzate: {len(tipologie_autorizzate)} items")
        
        if len(tipologie_autorizzate) > 0:
            print(f"   • Sample tipologie_autorizzate: {tipologie_autorizzate[:3]}")
            
            # Check if they look like UUIDs
            uuid_count = 0
            for tip in tipologie_autorizzate:
                if isinstance(tip, str) and '-' in tip and len(tip) > 20:
                    uuid_count += 1
            
            if uuid_count > 0:
                print(f"   🚨 BUG DETECTED: {uuid_count} UUID tipologie found!")
                print(f"   🚨 This user has the same issue as Responsabile Store")
                return True
            else:
                print(f"   ✅ tipologie_autorizzate contains strings, not UUIDs")
                return False
        else:
            print(f"   ✅ tipologie_autorizzate is empty (correct for this role)")
            return False
    
    def run_test(self):
        """Run the complete test"""
        print("🚨 QUICK TEST: Agente Specializzato e Operatore Tipologie UUID Problem")
        print("="*70)
        
        if not self.login_admin():
            return False
            
        # Get target users
        target_roles = ['agente_specializzato', 'operatore', 'agente']
        users = self.get_users_by_role(target_roles)
        
        print(f"\n📊 Found {len(users)} users with target roles:")
        for user in users:
            print(f"   • {user.get('username')} (role: {user.get('role')})")
        
        if len(users) == 0:
            print("❌ No users found with target roles")
            return False
        
        # Test each user
        bug_found = False
        bug_users = []
        
        for user in users:
            has_bug = self.test_user_tipologie_issue(user)
            if has_bug:
                bug_found = True
                bug_users.append(user.get('username'))
        
        # Summary
        print(f"\n🎯 SUMMARY:")
        print(f"   • Total users tested: {len(users)}")
        print(f"   • Users with bug: {len(bug_users)}")
        
        if bug_found:
            print(f"   🚨 BUG CONFIRMED in users: {', '.join(bug_users)}")
            print(f"   🚨 Same issue as Responsabile Store: tipologie_autorizzate populated with UUIDs")
            print(f"   🔧 SOLUTION: Clear tipologie_autorizzate for these users")
            return False
        else:
            print(f"   ✅ NO BUG DETECTED: All users have correct tipologie_autorizzate")
            print(f"   ✅ These roles appear to be working correctly")
            return True

if __name__ == "__main__":
    tester = QuickTipologieTest()
    result = tester.run_test()
    
    if result:
        print("\n🎉 TEST PASSED: No tipologie UUID problem detected")
    else:
        print("\n❌ TEST FAILED: Tipologie UUID problem confirmed")