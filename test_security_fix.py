#!/usr/bin/env python3
"""
Security Vulnerability Fix Test - Test the authorization fix for AGENTE_SPECIALIZZATO and OPERATORE
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend_test import CRMAPITester

def main():
    """Run only the security vulnerability fix test"""
    tester = CRMAPITester()
    
    print("🚨 RUNNING SECURITY VULNERABILITY FIX TEST...")
    print("=" * 80)
    
    success = tester.test_security_vulnerability_fix_agent_filters()
    
    if success:
        print("\n🎉 SECURITY VULNERABILITY FIX TEST PASSED!")
        return 0
    else:
        print("\n🚨 SECURITY VULNERABILITY FIX TEST FAILED!")
        return 1

if __name__ == "__main__":
    sys.exit(main())