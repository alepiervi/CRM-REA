#!/usr/bin/env python3
"""
Test script for mobile_fastweb tipologia contratto preservation fix
"""

import sys
import os
sys.path.append('/app')

from backend_test import CRMAPITester

def main():
    """Run the mobile_fastweb tipologia contratto preservation test"""
    print("🚀 Starting Mobile Fastweb Tipologia Contratto Preservation Test...")
    print("=" * 80)
    
    tester = CRMAPITester()
    
    try:
        # Run the specific test
        result = tester.test_tipologia_contratto_mobile_fastweb_preservation_fix()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"   Tests run: {tester.tests_run}")
        print(f"   Tests passed: {tester.tests_passed}")
        if tester.tests_run > 0:
            print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
        else:
            print(f"   Success rate: N/A (no tests run)")
        
        if result:
            print("🎉 MOBILE FASTWEB TIPOLOGIA CONTRATTO PRESERVATION TEST SUCCESSFUL!")
            return 0
        else:
            print("❌ MOBILE FASTWEB TIPOLOGIA CONTRATTO PRESERVATION TEST FAILED!")
            return 1
            
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit(main())