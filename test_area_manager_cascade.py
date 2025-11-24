#!/usr/bin/env python3
"""
Area Manager CASCADE Sub Agenzie Test - Urgent Debug
Tests the specific issue where Area Manager cannot see Sub Agenzie dropdown
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend_test import CRMAPITester

def main():
    """Main function to run the Area Manager CASCADE Sub Agenzie test"""
    print("🚀 Starting Area Manager CASCADE Sub Agenzie Test...")
    print("🎯 As requested in the review: TEST URGENTE Area Manager CASCADE Sub Agenzie")
    
    try:
        tester = CRMAPITester()
        result = tester.test_area_manager_cascade_sub_agenzie_urgent()
        
        print(f"\n📊 Final Test Results:")
        print(f"   Tests run: {tester.tests_run}")
        print(f"   Tests passed: {tester.tests_passed}")
        if tester.tests_run > 0:
            print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
        else:
            print(f"   Success rate: N/A (no tests run)")
        
        if result:
            print("🎉 AREA MANAGER CASCADE SUB AGENZIE TEST SUCCESSFUL!")
            print("✅ Area Manager riceve lista sub agenzie non vuota")
        else:
            print("❌ AREA MANAGER CASCADE SUB AGENZIE TEST FAILED!")
            print("🚨 Area Manager non riceve sub agenzie → identificato root cause esatto")
            
    except Exception as e:
        print(f"❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        result = False
    
    exit(0 if result else 1)

if __name__ == "__main__":
    main()