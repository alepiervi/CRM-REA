#!/usr/bin/env python3
"""
Simulate what Agente Specializzato and Operatore would see in filter-options
by checking their clienti and expected tipologie
"""

import requests
import json

class AgenteFilterSimulation:
    def __init__(self):
        self.base_url = "https://lead2ai-flow.preview.emergentagent.com/api"
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
    
    def get_all_clienti(self):
        """Get all clienti to analyze"""
        headers = {'Authorization': f'Bearer {self.token}'}
        response = requests.get(f"{self.base_url}/clienti", headers=headers)
        
        if response.status_code != 200:
            print(f"❌ Failed to get clienti: {response.status_code}")
            return []
            
        return response.json()
    
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
    
    def simulate_user_filter_options(self, user, all_clienti):
        """Simulate what filter-options would return for this user"""
        username = user.get('username', 'Unknown')
        role = user.get('role', 'Unknown')
        user_id = user.get('id', 'Unknown')
        
        print(f"\n🔍 Simulating filter-options for: {username} (role: {role})")
        
        # Find clienti created by this user (for agente_specializzato, operatore, agente)
        user_clienti = []
        for cliente in all_clienti:
            if cliente.get('created_by') == user_id:
                user_clienti.append(cliente)
        
        print(f"   • Clienti created by user: {len(user_clienti)}")
        
        if len(user_clienti) > 0:
            print(f"   📊 User's clienti:")
            for i, cliente in enumerate(user_clienti[:3], 1):  # Show first 3
                nome = cliente.get('nome', 'Unknown')
                cognome = cliente.get('cognome', 'Unknown')
                tipologia = cliente.get('tipologia_contratto', 'Unknown')
                print(f"      {i}. {nome} {cognome} (tipologia: {tipologia})")
            
            if len(user_clienti) > 3:
                print(f"      ... and {len(user_clienti) - 3} more")
        
        # Extract unique tipologie from user's clienti
        user_tipologie = set()
        for cliente in user_clienti:
            tipologia = cliente.get('tipologia_contratto')
            if tipologia:
                user_tipologie.add(tipologia)
        
        user_tipologie = list(user_tipologie)
        print(f"   • Expected tipologie in filter: {len(user_tipologie)}")
        
        if len(user_tipologie) > 0:
            print(f"   • Expected tipologie: {user_tipologie}")
        else:
            print(f"   • Expected tipologie: [] (empty - user has no clienti)")
        
        # Determine expected behavior
        if len(user_clienti) == 0:
            expected_tipologie_count = 0
            expected_behavior = "Should see 0 tipologie (no clienti)"
        else:
            expected_tipologie_count = len(user_tipologie)
            expected_behavior = f"Should see {expected_tipologie_count} tipologie from own clienti"
        
        print(f"   🎯 Expected behavior: {expected_behavior}")
        
        return {
            'username': username,
            'role': role,
            'clienti_count': len(user_clienti),
            'expected_tipologie_count': expected_tipologie_count,
            'expected_tipologie': user_tipologie,
            'expected_behavior': expected_behavior
        }
    
    def run_simulation(self):
        """Run the complete simulation"""
        print("🚨 SIMULATION: What Agente Specializzato e Operatore should see in filter-options")
        print("="*80)
        
        if not self.login_admin():
            return False
            
        # Get all clienti
        all_clienti = self.get_all_clienti()
        print(f"\n📊 Total clienti in system: {len(all_clienti)}")
        
        # Get target users
        target_roles = ['agente_specializzato', 'operatore', 'agente']
        users = self.get_users_by_role(target_roles)
        
        print(f"📊 Found {len(users)} users with target roles")
        
        if len(users) == 0:
            print("❌ No users found with target roles")
            return False
        
        # Simulate each user
        simulation_results = []
        
        for user in users:
            result = self.simulate_user_filter_options(user, all_clienti)
            simulation_results.append(result)
        
        # Analysis
        print(f"\n🎯 SIMULATION ANALYSIS:")
        print(f"="*50)
        
        users_with_no_clienti = [r for r in simulation_results if r['clienti_count'] == 0]
        users_with_clienti = [r for r in simulation_results if r['clienti_count'] > 0]
        
        print(f"   • Users with 0 clienti: {len(users_with_no_clienti)}")
        print(f"   • Users with >0 clienti: {len(users_with_clienti)}")
        
        if len(users_with_no_clienti) > 0:
            print(f"\n   📊 Users with 0 clienti (should see 0 tipologie):")
            for result in users_with_no_clienti:
                print(f"      • {result['username']} ({result['role']}): {result['expected_behavior']}")
        
        if len(users_with_clienti) > 0:
            print(f"\n   📊 Users with clienti (should see their tipologie):")
            for result in users_with_clienti:
                print(f"      • {result['username']} ({result['role']}): {result['expected_behavior']}")
                print(f"        Tipologie: {result['expected_tipologie']}")
        
        # Critical test scenario
        print(f"\n🎯 CRITICAL TEST SCENARIO:")
        print(f"   If any user with 0 clienti sees 38 tipologie → BUG CONFIRMED")
        print(f"   If any user with 0 clienti sees 0 tipologie → WORKING CORRECTLY")
        
        # Recommendations
        print(f"\n💡 TESTING RECOMMENDATIONS:")
        
        if len(users_with_no_clienti) > 0:
            print(f"   1. **PRIORITY TEST**: Users with 0 clienti")
            for result in users_with_no_clienti:
                print(f"      • Test {result['username']}: Should see 0 tipologie in filter-options")
        
        if len(users_with_clienti) > 0:
            print(f"   2. **SECONDARY TEST**: Users with clienti")
            for result in users_with_clienti:
                print(f"      • Test {result['username']}: Should see {result['expected_tipologie_count']} tipologie")
        
        print(f"\n🎯 CONCLUSION:")
        if len(users_with_no_clienti) > 0:
            print(f"   🎯 FOCUS: Test users with 0 clienti - they are most likely to show the bug")
            print(f"   🎯 If they see 38 tipologie instead of 0 → Same bug as Responsabile Store")
        else:
            print(f"   ✅ All users have clienti - less likely to show the bug")
            print(f"   ✅ But still test to ensure they see only their own tipologie")
        
        return True

if __name__ == "__main__":
    simulator = AgenteFilterSimulation()
    simulator.run_simulation()