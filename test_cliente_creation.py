#!/usr/bin/env python3
import requests
import json

BACKEND_URL = "https://crm-workflow-boost.preview.emergentagent.com"

# Login as admin
login_response = requests.post(
    f"{BACKEND_URL}/api/auth/login",
    json={"username": "admin", "password": "admin123"}
)

if login_response.status_code != 200:
    print(f"❌ Login failed: {login_response.status_code}")
    print(login_response.text)
    exit(1)

token = login_response.json()["access_token"]
print(f"✅ Login successful! Token: {token[:20]}...")

headers = {"Authorization": f"Bearer {token}"}

# Get commesse
commesse_response = requests.get(f"{BACKEND_URL}/api/commesse", headers=headers)
if commesse_response.status_code == 200:
    commesse = commesse_response.json()
    print(f"✅ Found {len(commesse)} commesse")
    if commesse:
        commessa_id = commesse[0]["id"]
        print(f"   Using commessa: {commesse[0]['nome']} ({commessa_id})")
else:
    print(f"❌ Failed to get commesse: {commesse_response.status_code}")
    exit(1)

# Get sub agenzie
subagenzie_response = requests.get(f"{BACKEND_URL}/api/sub-agenzie", headers=headers)
if subagenzie_response.status_code == 200:
    subagenzie = subagenzie_response.json()
    print(f"✅ Found {len(subagenzie)} sub agenzie")
    if subagenzie:
        subagenzia_id = subagenzie[0]["id"]
        print(f"   Using sub agenzia: {subagenzie[0]['nome']} ({subagenzia_id})")
else:
    print(f"❌ Failed to get sub agenzie: {subagenzie_response.status_code}")
    exit(1)

# Create test client with minimal data
test_cliente = {
    "nome": "Mario",
    "cognome": "Rossi",
    "email": "mario.rossi@test.it",
    "telefono": "3331234567",
    "codice_fiscale": "RSSMRA80A01H501U",
    "commessa_id": commessa_id,
    "sub_agenzia_id": subagenzia_id,
    "telefono2": "",
    "data_nascita": None,
    "luogo_nascita": "",
    "indirizzo": "Via Roma 1",
    "comune_residenza": "Milano",
    "provincia": "MI",
    "cap": "20100",
    "ragione_sociale": "",
    "partita_iva": "",
    "numero_ordine": "",
    "account": "",
    "tipo_documento": None,
    "numero_documento": "",
    "data_rilascio": None,
    "luogo_rilascio": "",
    "scadenza_documento": None,
    "tecnologia": None,
    "codice_migrazione": "",
    "gestore": "",
    "convergenza": False,
    "convergenza_items": [],
    "codice_pod": "",
    "modalita_pagamento": None,
    "iban": "",
    "intestatario_diverso": "",
    "numero_carta": "",
    "mese_carta": "",
    "anno_carta": "",
    "note": "",
    "note_backoffice": "",
    "servizio_id": None,
    "tipologia_contratto": "energia_fastweb",
    "segmento": "privato",
    "offerta_id": None
}

print("\n📤 Sending POST /api/clienti request...")
print(f"Data: {json.dumps(test_cliente, indent=2)}")

create_response = requests.post(
    f"{BACKEND_URL}/api/clienti",
    headers=headers,
    json=test_cliente
)

print(f"\n📥 Response status: {create_response.status_code}")
print(f"Response body: {create_response.text}")

if create_response.status_code == 422:
    print("\n❌ VALIDATION ERROR 422!")
    try:
        error_detail = create_response.json()
        print("Error details:")
        print(json.dumps(error_detail, indent=2))
    except:
        print("Could not parse error response")
elif create_response.status_code == 200 or create_response.status_code == 201:
    print("\n✅ CLIENT CREATED SUCCESSFULLY!")
    try:
        cliente = create_response.json()
        print(f"Cliente ID: {cliente.get('id', 'N/A')}")
        print(f"Nome: {cliente.get('nome', 'N/A')} {cliente.get('cognome', 'N/A')}")
    except:
        print("Response:", create_response.text[:500])
else:
    print(f"\n⚠️ Unexpected status code: {create_response.status_code}")
