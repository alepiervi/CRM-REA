#!/usr/bin/env python3
"""
Test runner specifically for Hierarchical Selectors - Tipologie Contratto
Focus on testing resp_commessa user and contract types endpoints
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend_test import CRMAPITester

def main():
    """Run focused test for hierarchical selectors"""
    print("🎯 STARTING HIERARCHICAL SELECTORS TEST - TIPOLOGIE CONTRATTO FOCUS")
    print("=" * 70)
    
    tester = CRMAPITester()
    
    # Run the specific test for hierarchical selectors
    success = tester.test_responsabile_commessa_hierarchical_selectors()
    
    # Print final results
    print("\n" + "=" * 70)
    print(f"📊 HIERARCHICAL SELECTORS TEST RESULTS:")
    print(f"   Tests run: {tester.tests_run}")
    print(f"   Tests passed: {tester.tests_passed}")
    print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%" if tester.tests_run > 0 else "   Success rate: 0%")
    
    if success:
        print("🎉 HIERARCHICAL SELECTORS TEST COMPLETED SUCCESSFULLY!")
        print("✅ All tipologie contratto endpoints are working correctly")
        return 0
    else:
        print("⚠️ HIERARCHICAL SELECTORS TEST COMPLETED WITH ISSUES")
        print("❌ Some endpoints or expected tipologie are missing")
        return 1

if __name__ == "__main__":
    sys.exit(main())