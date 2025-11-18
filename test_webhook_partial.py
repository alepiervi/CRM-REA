#!/usr/bin/env python3
"""
Test Zapier Webhook with Partial Data
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend_test import CRMAPITester

if __name__ == "__main__":
    tester = CRMAPITester()
    
    print("🚀 Starting Zapier Webhook Partial Data Test...")
    print(f"🌐 Base URL: {tester.base_url}")
    print("=" * 80)
    
    try:
        result = tester.test_zapier_webhook_partial_data()
        
        # Print summary
        print(f"\n📊 Final Test Results:")
        print(f"   Tests run: {tester.tests_run}")
        print(f"   Tests passed: {tester.tests_passed}")
        if tester.tests_run > 0:
            print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
        else:
            print(f"   Success rate: N/A (no tests run)")
        
        if result:
            print("🎉 ZAPIER WEBHOOK PARTIAL DATA TEST SUCCESSFUL!")
        else:
            print("❌ ZAPIER WEBHOOK PARTIAL DATA TEST FAILED!")
            
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        result = False
    
    exit(0 if result else 1)