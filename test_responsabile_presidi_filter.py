#!/usr/bin/env python3
"""
Test specifico per il filtro "Utente Assegnato" migliorato per RESPONSABILE_PRESIDI
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend_test import CRMAPITester

def main():
    """Run the specific RESPONSABILE_PRESIDI filter test"""
    print("🎯 RUNNING RESPONSABILE_PRESIDI ASSIGNED_TO FILTER TEST")
    print("=" * 80)
    
    # Initialize tester
    tester = CRMAPITester()
    
    # Run the specific test
    success = tester.test_responsabile_presidi_assigned_to_filter_enhanced()
    
    # Print final results
    print("\n" + "=" * 80)
    print(f"📊 Test Results:")
    print(f"   Tests run: {tester.tests_run}")
    print(f"   Tests passed: {tester.tests_passed}")
    print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if success:
        print("🎉 RESPONSABILE_PRESIDI FILTER TEST SUCCESSFUL!")
        return 0
    else:
        print("❌ RESPONSABILE_PRESIDI FILTER TEST FAILED!")
        return 1

if __name__ == "__main__":
    exit_code = main()
    print(f"Exit code: {exit_code}")
    sys.exit(exit_code)