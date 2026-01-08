#!/usr/bin/env python3
"""
CRM Document Management System - Focused Document Testing
Tests specifically the documents endpoint with filtering parameters
"""

import requests
import sys
import json
from datetime import datetime
import uuid
import tempfile
import os

class DocumentAPITester:
    def __init__(self, base_url="https://client-search-fix-3.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'users': [],
            'units': [],
            'leads': [],
            'documents': []
        }

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        if details and success:
            print(f"   ℹ️  {details}")

    def make_request(self, method, endpoint, data=None, expected_status=200, auth_required=True):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if auth_required and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            return success, response.json() if response.content else {}, response.status_code

        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0
        except json.JSONDecodeError:
            return False, {"error": "Invalid JSON response"}, response.status_code

    def authenticate(self):
        """Authenticate as admin"""
        print("\n🔐 Authenticating...")
        
        success, response, status = self.make_request(
            'POST', 'auth/login', 
            {'username': 'admin', 'password': 'admin123'}, 
            200, auth_required=False
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            self.log_test("Admin authentication", True, f"User role: {self.user_data['role']}")
            return True
        else:
            self.log_test("Admin authentication", False, f"Status: {status}, Response: {response}")
            return False

    def setup_test_data(self):
        """Create test data for document testing"""
        print("\n🏗️  Setting up test data...")
        
        # Create test unit
        unit_data = {
            "name": f"Document Test Unit {datetime.now().strftime('%H%M%S')}",
            "description": "Unit for document testing"
        }
        success, unit_response, status = self.make_request('POST', 'units', unit_data, 200)
        if success:
            unit_id = unit_response['id']
            self.created_resources['units'].append(unit_id)
            self.log_test("Create test unit", True, f"Unit ID: {unit_id}")
        else:
            self.log_test("Create test unit", False, f"Status: {status}")
            return False

        # Create test users with different roles
        # Create referente
        referente_data = {
            "username": f"doc_referente_{datetime.now().strftime('%H%M%S')}",
            "email": f"doc_referente_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "TestPass123!",
            "role": "referente",
            "unit_id": unit_id,
            "provinces": []
        }
        
        success, referente_response, status = self.make_request('POST', 'users', referente_data, 200)
        if success:
            referente_id = referente_response['id']
            self.created_resources['users'].append({
                'id': referente_id, 
                'username': referente_data['username'], 
                'password': referente_data['password'],
                'role': 'referente'
            })
            self.log_test("Create referente user", True, f"Referente ID: {referente_id}")
        else:
            self.log_test("Create referente user", False, f"Status: {status}")
            return False

        # Create agent
        agent_data = {
            "username": f"doc_agent_{datetime.now().strftime('%H%M%S')}",
            "email": f"doc_agent_{datetime.now().strftime('%H%M%S')}@test.com",
            "password": "TestPass123!",
            "role": "agente",
            "unit_id": unit_id,
            "referente_id": referente_id,
            "provinces": ["Roma", "Milano"]
        }
        
        success, agent_response, status = self.make_request('POST', 'users', agent_data, 200)
        if success:
            agent_id = agent_response['id']
            self.created_resources['users'].append({
                'id': agent_id, 
                'username': agent_data['username'], 
                'password': agent_data['password'],
                'role': 'agente'
            })
            self.log_test("Create agent user", True, f"Agent ID: {agent_id}")
        else:
            self.log_test("Create agent user", False, f"Status: {status}")
            return False

        # Create test leads with different names for filtering
        test_leads = [
            {
                "nome": "Mario", "cognome": "Rossi", "telefono": "+39 123 456 7890",
                "email": "mario.rossi@test.com", "provincia": "Roma", 
                "tipologia_abitazione": "appartamento", "campagna": "Test Campaign 1",
                "gruppo": unit_id, "contenitore": "Test Container 1",
                "privacy_consent": True, "marketing_consent": True
            },
            {
                "nome": "Luigi", "cognome": "Bianchi", "telefono": "+39 123 456 7891",
                "email": "luigi.bianchi@test.com", "provincia": "Milano", 
                "tipologia_abitazione": "villa", "campagna": "Test Campaign 2",
                "gruppo": unit_id, "contenitore": "Test Container 2",
                "privacy_consent": True, "marketing_consent": False
            },
            {
                "nome": "Giuseppe", "cognome": "Verdi", "telefono": "+39 123 456 7892",
                "email": "giuseppe.verdi@test.com", "provincia": "Napoli", 
                "tipologia_abitazione": "casa_indipendente", "campagna": "Test Campaign 3",
                "gruppo": unit_id, "contenitore": "Test Container 3",
                "privacy_consent": False, "marketing_consent": True
            }
        ]

        for i, lead_data in enumerate(test_leads):
            success, lead_response, status = self.make_request('POST', 'leads', lead_data, 200, auth_required=False)
            if success:
                lead_id = lead_response['id']
                lead_short_id = lead_response.get('lead_id', lead_id[:8])
                self.created_resources['leads'].append({
                    'id': lead_id,
                    'lead_id': lead_short_id,
                    'nome': lead_data['nome'],
                    'cognome': lead_data['cognome']
                })
                self.log_test(f"Create test lead {i+1}", True, f"Lead: {lead_data['nome']} {lead_data['cognome']}")
            else:
                self.log_test(f"Create test lead {i+1}", False, f"Status: {status}")
                return False

        return True

    def upload_test_documents(self):
        """Upload test documents for each lead"""
        print("\n📄 Uploading test documents...")
        
        for i, lead in enumerate(self.created_resources['leads']):
            # Create a temporary PDF file
            with tempfile.NamedTemporaryFile(mode='w+b', suffix='.pdf', delete=False) as temp_file:
                temp_file.write(f'%PDF-1.4\n%Test document for {lead["nome"]} {lead["cognome"]}\n'.encode())
                temp_file.flush()
                temp_file_path = temp_file.name

            try:
                # Upload document
                url = f"{self.base_url}/documents/upload/{lead['id']}"
                headers = {'Authorization': f'Bearer {self.token}'}
                
                with open(temp_file_path, 'rb') as f:
                    files = {'file': (f'document_{lead["nome"]}_{lead["cognome"]}.pdf', f, 'application/pdf')}
                    data = {'uploaded_by': self.user_data['id']}
                    
                    response = requests.post(url, files=files, data=data, headers=headers, timeout=30)
                    
                    if response.status_code == 200:
                        upload_response = response.json()
                        if upload_response.get('success'):
                            document_id = upload_response['document']['document_id']
                            self.created_resources['documents'].append({
                                'document_id': document_id,
                                'lead_id': lead['id'],
                                'lead_nome': lead['nome'],
                                'lead_cognome': lead['cognome'],
                                'uploaded_by': self.user_data['id']
                            })
                            self.log_test(f"Upload document for {lead['nome']} {lead['cognome']}", True, f"Document ID: {document_id}")
                        else:
                            self.log_test(f"Upload document for {lead['nome']} {lead['cognome']}", False, f"Upload failed: {upload_response}")
                    else:
                        self.log_test(f"Upload document for {lead['nome']} {lead['cognome']}", False, f"Status: {response.status_code}")
                        
            finally:
                # Clean up temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)

    def test_documents_database_check(self):
        """Check if documents exist in the database"""
        print("\n🗄️  Testing Documents Database Check...")
        
        # Get all documents to check if any exist
        success, response, status = self.make_request('GET', 'documents', expected_status=200)
        if success:
            documents = response.get('documents', [])
            total_count = response.get('pagination', {}).get('total', 0)
            
            if total_count > 0:
                self.log_test("Documents exist in database", True, f"Found {total_count} documents in database")
                
                # Check if our test documents are present
                our_docs = [doc for doc in documents if any(d['document_id'] == doc['document_id'] for d in self.created_resources['documents'])]
                self.log_test("Test documents in database", len(our_docs) > 0, f"Found {len(our_docs)} of our test documents")
                
                return True
            else:
                self.log_test("Documents exist in database", False, "No documents found in database")
                return False
        else:
            self.log_test("Documents database check", False, f"Status: {status}")
            return False

    def test_documents_endpoint_basic(self):
        """Test basic GET /api/documents endpoint"""
        print("\n📋 Testing Basic Documents Endpoint...")
        
        success, response, status = self.make_request('GET', 'documents', expected_status=200)
        if success:
            documents = response.get('documents', [])
            pagination = response.get('pagination', {})
            filters_applied = response.get('filters_applied', {})
            
            self.log_test("GET /api/documents basic", True, f"Retrieved {len(documents)} documents")
            self.log_test("Documents response structure", True, f"Pagination: {pagination}, Filters: {filters_applied}")
            
            # Check document structure
            if documents:
                first_doc = documents[0]
                expected_fields = ['id', 'document_id', 'filename', 'size', 'content_type', 'uploaded_by', 'created_at', 'lead']
                missing_fields = [field for field in expected_fields if field not in first_doc]
                
                if not missing_fields:
                    self.log_test("Document structure validation", True, "All expected fields present")
                else:
                    self.log_test("Document structure validation", False, f"Missing fields: {missing_fields}")
                
                # Check lead information in document
                lead_info = first_doc.get('lead', {})
                if lead_info and 'nome' in lead_info and 'cognome' in lead_info:
                    self.log_test("Lead information in document", True, f"Lead: {lead_info.get('nome')} {lead_info.get('cognome')}")
                else:
                    self.log_test("Lead information in document", False, f"Lead info incomplete: {lead_info}")
            
            return True
        else:
            self.log_test("GET /api/documents basic", False, f"Status: {status}")
            return False

    def test_documents_filtering_by_nome(self):
        """Test filtering documents by nome parameter"""
        print("\n🔍 Testing Documents Filtering by Nome...")
        
        # Test filtering by "Mario"
        success, response, status = self.make_request('GET', 'documents?nome=Mario', expected_status=200)
        if success:
            documents = response.get('documents', [])
            filters_applied = response.get('filters_applied', {})
            
            self.log_test("Filter by nome=Mario", True, f"Found {len(documents)} documents")
            
            # Verify all returned documents have leads with nome "Mario"
            mario_docs = [doc for doc in documents if doc.get('lead', {}).get('nome', '').lower() == 'mario']
            if len(mario_docs) == len(documents):
                self.log_test("Nome filter accuracy", True, "All documents match nome filter")
            else:
                self.log_test("Nome filter accuracy", False, f"Only {len(mario_docs)}/{len(documents)} documents match filter")
            
            # Check filters_applied
            if filters_applied.get('nome') == 'Mario':
                self.log_test("Nome filter in response", True, "Filter correctly reflected in response")
            else:
                self.log_test("Nome filter in response", False, f"Expected 'Mario', got {filters_applied.get('nome')}")
        else:
            self.log_test("Filter by nome=Mario", False, f"Status: {status}")

        # Test case-insensitive filtering
        success, response, status = self.make_request('GET', 'documents?nome=mario', expected_status=200)
        if success:
            documents = response.get('documents', [])
            self.log_test("Nome filter case-insensitive", True, f"Found {len(documents)} documents with lowercase 'mario'")
        else:
            self.log_test("Nome filter case-insensitive", False, f"Status: {status}")

    def test_documents_filtering_by_cognome(self):
        """Test filtering documents by cognome parameter"""
        print("\n🔍 Testing Documents Filtering by Cognome...")
        
        # Test filtering by "Rossi"
        success, response, status = self.make_request('GET', 'documents?cognome=Rossi', expected_status=200)
        if success:
            documents = response.get('documents', [])
            filters_applied = response.get('filters_applied', {})
            
            self.log_test("Filter by cognome=Rossi", True, f"Found {len(documents)} documents")
            
            # Verify all returned documents have leads with cognome "Rossi"
            rossi_docs = [doc for doc in documents if doc.get('lead', {}).get('cognome', '').lower() == 'rossi']
            if len(rossi_docs) == len(documents):
                self.log_test("Cognome filter accuracy", True, "All documents match cognome filter")
            else:
                self.log_test("Cognome filter accuracy", False, f"Only {len(rossi_docs)}/{len(documents)} documents match filter")
            
            # Check filters_applied
            if filters_applied.get('cognome') == 'Rossi':
                self.log_test("Cognome filter in response", True, "Filter correctly reflected in response")
            else:
                self.log_test("Cognome filter in response", False, f"Expected 'Rossi', got {filters_applied.get('cognome')}")
        else:
            self.log_test("Filter by cognome=Rossi", False, f"Status: {status}")

    def test_documents_filtering_by_lead_id(self):
        """Test filtering documents by lead_id parameter"""
        print("\n🔍 Testing Documents Filtering by Lead ID...")
        
        if not self.created_resources['leads']:
            self.log_test("Lead ID filter test", False, "No test leads available")
            return
        
        # Get a test lead ID
        test_lead = self.created_resources['leads'][0]
        lead_short_id = test_lead['lead_id']
        
        # Test filtering by lead_id
        success, response, status = self.make_request('GET', f'documents?lead_id={lead_short_id}', expected_status=200)
        if success:
            documents = response.get('documents', [])
            filters_applied = response.get('filters_applied', {})
            
            self.log_test(f"Filter by lead_id={lead_short_id}", True, f"Found {len(documents)} documents")
            
            # Verify all returned documents have the correct lead_id
            matching_docs = [doc for doc in documents if doc.get('lead', {}).get('lead_id', '') == lead_short_id]
            if len(matching_docs) == len(documents):
                self.log_test("Lead ID filter accuracy", True, "All documents match lead_id filter")
            else:
                self.log_test("Lead ID filter accuracy", False, f"Only {len(matching_docs)}/{len(documents)} documents match filter")
            
            # Check filters_applied
            if filters_applied.get('lead_id') == lead_short_id:
                self.log_test("Lead ID filter in response", True, "Filter correctly reflected in response")
            else:
                self.log_test("Lead ID filter in response", False, f"Expected '{lead_short_id}', got {filters_applied.get('lead_id')}")
        else:
            self.log_test(f"Filter by lead_id={lead_short_id}", False, f"Status: {status}")

    def test_documents_filtering_by_uploaded_by(self):
        """Test filtering documents by uploaded_by parameter"""
        print("\n🔍 Testing Documents Filtering by Uploaded By...")
        
        # Test filtering by admin username
        admin_username = self.user_data['username']
        
        success, response, status = self.make_request('GET', f'documents?uploaded_by={admin_username}', expected_status=200)
        if success:
            documents = response.get('documents', [])
            filters_applied = response.get('filters_applied', {})
            
            self.log_test(f"Filter by uploaded_by={admin_username}", True, f"Found {len(documents)} documents")
            
            # Verify all returned documents were uploaded by admin
            admin_docs = [doc for doc in documents if admin_username.lower() in doc.get('uploaded_by', '').lower()]
            if len(admin_docs) == len(documents):
                self.log_test("Uploaded by filter accuracy", True, "All documents match uploaded_by filter")
            else:
                self.log_test("Uploaded by filter accuracy", False, f"Only {len(admin_docs)}/{len(documents)} documents match filter")
            
            # Check filters_applied
            if filters_applied.get('uploaded_by') == admin_username:
                self.log_test("Uploaded by filter in response", True, "Filter correctly reflected in response")
            else:
                self.log_test("Uploaded by filter in response", False, f"Expected '{admin_username}', got {filters_applied.get('uploaded_by')}")
        else:
            self.log_test(f"Filter by uploaded_by={admin_username}", False, f"Status: {status}")

    def test_documents_combined_filters(self):
        """Test combining multiple filters"""
        print("\n🔍 Testing Combined Document Filters...")
        
        # Test combining nome and cognome filters
        success, response, status = self.make_request('GET', 'documents?nome=Mario&cognome=Rossi', expected_status=200)
        if success:
            documents = response.get('documents', [])
            filters_applied = response.get('filters_applied', {})
            
            self.log_test("Combined nome+cognome filter", True, f"Found {len(documents)} documents")
            
            # Verify documents match both filters
            matching_docs = [doc for doc in documents 
                           if doc.get('lead', {}).get('nome', '').lower() == 'mario' 
                           and doc.get('lead', {}).get('cognome', '').lower() == 'rossi']
            
            if len(matching_docs) == len(documents):
                self.log_test("Combined filter accuracy", True, "All documents match both filters")
            else:
                self.log_test("Combined filter accuracy", False, f"Only {len(matching_docs)}/{len(documents)} documents match both filters")
            
            # Check both filters are applied
            if filters_applied.get('nome') == 'Mario' and filters_applied.get('cognome') == 'Rossi':
                self.log_test("Combined filters in response", True, "Both filters correctly reflected")
            else:
                self.log_test("Combined filters in response", False, f"Filters: {filters_applied}")
        else:
            self.log_test("Combined nome+cognome filter", False, f"Status: {status}")

    def test_documents_role_based_access(self):
        """Test role-based access to documents"""
        print("\n🔐 Testing Role-Based Access to Documents...")
        
        # Test as referente
        referente_user = next((u for u in self.created_resources['users'] if u['role'] == 'referente'), None)
        if referente_user:
            # Login as referente
            success, login_response, status = self.make_request(
                'POST', 'auth/login',
                {'username': referente_user['username'], 'password': referente_user['password']},
                200, auth_required=False
            )
            
            if success:
                referente_token = login_response['access_token']
                original_token = self.token
                self.token = referente_token
                
                # Test referente access to documents
                success, response, status = self.make_request('GET', 'documents', expected_status=200)
                if success:
                    documents = response.get('documents', [])
                    self.log_test("Referente access to documents", True, f"Referente can access {len(documents)} documents")
                else:
                    self.log_test("Referente access to documents", False, f"Status: {status}")
                
                # Restore admin token
                self.token = original_token
            else:
                self.log_test("Referente login for document access", False, f"Status: {status}")
        
        # Test as agent
        agent_user = next((u for u in self.created_resources['users'] if u['role'] == 'agente'), None)
        if agent_user:
            # Login as agent
            success, login_response, status = self.make_request(
                'POST', 'auth/login',
                {'username': agent_user['username'], 'password': agent_user['password']},
                200, auth_required=False
            )
            
            if success:
                agent_token = login_response['access_token']
                original_token = self.token
                self.token = agent_token
                
                # Test agent access to documents
                success, response, status = self.make_request('GET', 'documents', expected_status=200)
                if success:
                    documents = response.get('documents', [])
                    self.log_test("Agent access to documents", True, f"Agent can access {len(documents)} documents")
                    
                    # Test agent cannot delete documents
                    if self.created_resources['documents']:
                        doc_id = self.created_resources['documents'][0]['document_id']
                        success, response, status = self.make_request('DELETE', f'documents/{doc_id}', expected_status=403)
                        self.log_test("Agent document deletion restriction", success, "Agent correctly prevented from deleting documents")
                else:
                    self.log_test("Agent access to documents", False, f"Status: {status}")
                
                # Restore admin token
                self.token = original_token
            else:
                self.log_test("Agent login for document access", False, f"Status: {status}")

    def test_lead_document_relationships(self):
        """Test that documents are correctly associated with leads"""
        print("\n🔗 Testing Lead-Document Relationships...")
        
        if not self.created_resources['leads']:
            self.log_test("Lead-document relationship test", False, "No test leads available")
            return
        
        # Test getting documents for a specific lead
        test_lead = self.created_resources['leads'][0]
        lead_id = test_lead['id']
        
        success, response, status = self.make_request('GET', f'documents/lead/{lead_id}', expected_status=200)
        if success:
            lead_info = response.get('lead', {})
            documents = response.get('documents', [])
            
            self.log_test("Get documents for specific lead", True, f"Found {len(documents)} documents for lead {lead_info.get('nome')} {lead_info.get('cognome')}")
            
            # Verify lead information matches
            if lead_info.get('nome') == test_lead['nome'] and lead_info.get('cognome') == test_lead['cognome']:
                self.log_test("Lead information accuracy", True, f"Lead info matches: {lead_info.get('nome')} {lead_info.get('cognome')}")
            else:
                self.log_test("Lead information accuracy", False, f"Expected {test_lead['nome']} {test_lead['cognome']}, got {lead_info.get('nome')} {lead_info.get('cognome')}")
            
            # Verify documents belong to this lead
            if documents:
                for doc in documents:
                    if 'lead' in doc and doc['lead'].get('id') == lead_id:
                        self.log_test(f"Document {doc['document_id']} lead association", True, "Document correctly associated with lead")
                    else:
                        self.log_test(f"Document {doc['document_id']} lead association", False, "Document not properly associated with lead")
        else:
            self.log_test("Get documents for specific lead", False, f"Status: {status}")

    def test_documents_pagination(self):
        """Test document pagination"""
        print("\n📄 Testing Documents Pagination...")
        
        # Test with limit
        success, response, status = self.make_request('GET', 'documents?limit=2', expected_status=200)
        if success:
            documents = response.get('documents', [])
            pagination = response.get('pagination', {})
            
            self.log_test("Documents pagination with limit", True, f"Retrieved {len(documents)} documents with limit=2")
            
            # Check pagination info
            if 'total' in pagination and 'limit' in pagination:
                self.log_test("Pagination info present", True, f"Total: {pagination.get('total')}, Limit: {pagination.get('limit')}")
            else:
                self.log_test("Pagination info present", False, f"Pagination info incomplete: {pagination}")
        else:
            self.log_test("Documents pagination with limit", False, f"Status: {status}")

    def run_document_tests(self):
        """Run all document-specific tests"""
        print("🚀 Starting CRM Document API Testing...")
        print(f"📡 Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Authentication
        if not self.authenticate():
            print("❌ Authentication failed - stopping tests")
            return False
        
        # Setup test data
        if not self.setup_test_data():
            print("❌ Test data setup failed - stopping tests")
            return False
        
        # Upload test documents
        self.upload_test_documents()
        
        # Run document-specific tests
        self.test_documents_database_check()
        self.test_documents_endpoint_basic()
        self.test_documents_filtering_by_nome()
        self.test_documents_filtering_by_cognome()
        self.test_documents_filtering_by_lead_id()
        self.test_documents_filtering_by_uploaded_by()
        self.test_documents_combined_filters()
        self.test_documents_role_based_access()
        self.test_lead_document_relationships()
        self.test_documents_pagination()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Document Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All document tests passed!")
            return True
        else:
            failed = self.tests_run - self.tests_passed
            print(f"⚠️  {failed} document tests failed")
            return False

def main():
    """Main test execution"""
    tester = DocumentAPITester()
    success = tester.run_document_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())