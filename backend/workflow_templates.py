"""
Workflow Templates - Pre-configured workflows for common scenarios
"""
from datetime import datetime, timezone
from typing import Dict, Any
import uuid


def get_lead_qualification_template(unit_id: str) -> Dict[str, Any]:
    """
    Creates a pre-configured workflow template for Lead Qualification with AI
    
    Workflow Flow:
    1. Lead Created (Trigger)
    2. Assign to Unit
    3. Send WhatsApp Welcome
    4. Wait for Response
    5. Check Positive Response
    6. Start AI Assistant
    7. Update Lead Fields
    
    Args:
        unit_id: ID of the unit to assign this workflow to
        
    Returns:
        Complete workflow configuration ready to be saved
    """
    
    workflow_id = str(uuid.uuid4())
    
    # Define nodes
    nodes = [
        # TRIGGER: Lead Created
        {
            "id": "trigger_lead_created",
            "type": "default",
            "position": {"x": 100, "y": 100},
            "data": {
                "label": "Lead Creato",
                "nodeType": "triggers",
                "nodeSubtype": "lead_created",
                "config": {
                    "name": "Lead Creato",
                    "description": "Si attiva quando un nuovo lead viene creato tramite webhook",
                    "event": "lead_created"
                }
            },
            "style": {
                "background": "#22c55e",
                "color": "white",
                "border": "2px solid #16a34a",
                "borderRadius": "8px",
                "fontSize": "12px",
                "fontWeight": "bold",
                "width": 180,
                "height": 40
            }
        },
        
        # ACTION 1: Assign to Unit
        {
            "id": "action_assign_unit",
            "type": "default",
            "position": {"x": 100, "y": 200},
            "data": {
                "label": "Assegna a Unit",
                "nodeType": "actions",
                "nodeSubtype": "assign_to_unit",
                "config": {
                    "name": "Assegna a Unit",
                    "description": "Assegna il lead alla unit basandosi sul tag/nome unit"
                }
            },
            "style": {
                "background": "#3b82f6",
                "color": "white",
                "border": "2px solid #2563eb",
                "borderRadius": "8px",
                "fontSize": "12px",
                "fontWeight": "bold",
                "width": 180,
                "height": 40
            }
        },
        
        # ACTION 2: Send WhatsApp Welcome
        {
            "id": "action_send_whatsapp",
            "type": "default",
            "position": {"x": 100, "y": 300},
            "data": {
                "label": "Invia WhatsApp Benvenuto",
                "nodeType": "actions",
                "nodeSubtype": "send_whatsapp",
                "config": {
                    "name": "Invia WhatsApp Benvenuto",
                    "description": "Invia messaggio di benvenuto personalizzato via WhatsApp",
                    "message": "Ciao {nome}! Benvenuto in {unit_name}. Sei pronto per iniziare? Rispondi SI per continuare."
                }
            },
            "style": {
                "background": "#3b82f6",
                "color": "white",
                "border": "2px solid #2563eb",
                "borderRadius": "8px",
                "fontSize": "12px",
                "fontWeight": "bold",
                "width": 180,
                "height": 40
            }
        },
        
        # CONDITION: Check Positive Response
        {
            "id": "condition_positive_response",
            "type": "default",
            "position": {"x": 100, "y": 400},
            "data": {
                "label": "Risposta Positiva?",
                "nodeType": "conditions",
                "nodeSubtype": "check_positive_response",
                "config": {
                    "name": "Verifica Risposta Positiva",
                    "description": "Controlla se il lead ha risposto in modo affermativo (SI, OK, CERTO)",
                    "expression": "message contains positive_keywords"
                }
            },
            "style": {
                "background": "#a855f7",
                "color": "white",
                "border": "2px solid #9333ea",
                "borderRadius": "8px",
                "fontSize": "12px",
                "fontWeight": "bold",
                "width": 180,
                "height": 40
            }
        },
        
        # ACTION 3: Start AI Conversation
        {
            "id": "action_start_ai",
            "type": "default",
            "position": {"x": 100, "y": 500},
            "data": {
                "label": "Avvia AI Assistant",
                "nodeType": "actions",
                "nodeSubtype": "start_ai_conversation",
                "config": {
                    "name": "Avvia AI Assistant",
                    "description": "Inizia conversazione con AI Assistant per qualificare il lead"
                }
            },
            "style": {
                "background": "#3b82f6",
                "color": "white",
                "border": "2px solid #2563eb",
                "borderRadius": "8px",
                "fontSize": "12px",
                "fontWeight": "bold",
                "width": 180,
                "height": 40
            }
        },
        
        # ACTION 4: Update Lead Fields
        {
            "id": "action_update_lead",
            "type": "default",
            "position": {"x": 100, "y": 600},
            "data": {
                "label": "Aggiorna Anagrafica",
                "nodeType": "actions",
                "nodeSubtype": "update_lead_field",
                "config": {
                    "name": "Aggiorna Campi Lead",
                    "description": "Estrae informazioni dalla conversazione AI e aggiorna i campi del lead"
                }
            },
            "style": {
                "background": "#3b82f6",
                "color": "white",
                "border": "2px solid #2563eb",
                "borderRadius": "8px",
                "fontSize": "12px",
                "fontWeight": "bold",
                "width": 180,
                "height": 40
            }
        }
    ]
    
    # Define edges (connections)
    edges = [
        {
            "id": "edge_1",
            "source": "trigger_lead_created",
            "target": "action_assign_unit",
            "type": "default"
        },
        {
            "id": "edge_2",
            "source": "action_assign_unit",
            "target": "action_send_whatsapp",
            "type": "default"
        },
        {
            "id": "edge_3",
            "source": "action_send_whatsapp",
            "target": "condition_positive_response",
            "type": "default"
        },
        {
            "id": "edge_4",
            "source": "condition_positive_response",
            "target": "action_start_ai",
            "type": "default",
            "label": "SI"
        },
        {
            "id": "edge_5",
            "source": "action_start_ai",
            "target": "action_update_lead",
            "type": "default"
        }
    ]
    
    # Create complete workflow
    workflow = {
        "id": workflow_id,
        "name": "Lead Qualification AI - Template",
        "description": "Workflow automatico per qualificare lead con AI Assistant e WhatsApp",
        "unit_id": unit_id,
        "trigger_type": "lead_created",
        "is_active": False,  # Inactive by default - user must activate
        "is_published": False,
        "nodes": nodes,
        "edges": edges,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "version": 1,
        "metadata": {
            "template": True,
            "template_name": "lead_qualification_ai",
            "template_version": "1.0"
        }
    }
    
    return workflow


def get_available_templates() -> list:
    """
    Returns list of available workflow templates
    
    Returns:
        List of template metadata
    """
    return [
        {
            "id": "lead_qualification_ai",
            "name": "Lead Qualification AI",
            "description": "Workflow completo per qualificare lead con AI Assistant via WhatsApp",
            "trigger": "lead_created",
            "nodes_count": 6,
            "features": [
                "Auto-assegnazione a Unit",
                "Messaggio WhatsApp benvenuto",
                "Verifica risposta positiva",
                "Conversazione AI Assistant",
                "Aggiornamento automatico campi"
            ]
        }
    ]
