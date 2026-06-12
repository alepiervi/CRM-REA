"""Route: Status lead dinamici per unit — estratte da server.py (refactoring fase 2, giugno 2026)."""
import asyncio
import io
import json
import logging
import re
import uuid
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Dict, Any

from fastapi import (
    APIRouter, HTTPException, Depends, Query, Body, Request,
    UploadFile, File, Form, status,
)
from fastapi.responses import StreamingResponse, JSONResponse

from database import db
from security import (
    get_current_user, get_password_hash, verify_password,
    check_commessa_access, get_user_accessible_commesse, get_user_accessible_sub_agenzie,
    can_user_access_cliente, can_user_access_cliente_notes, can_user_delete_cliente,
    can_user_modify_cliente,
)
from models import *  # noqa: F401,F403

router = APIRouter()
logger = logging.getLogger(__name__)

# ============================================================================
# LEAD STATUS MANAGEMENT ENDPOINTS - Dynamic status for units
# ============================================================================

@router.post("/lead-status", response_model=LeadStatusModel)
async def create_lead_status(
    status: LeadStatusCreate, 
    current_user: User = Depends(get_current_user)
):
    """Create a new lead status - Admin only"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can create lead statuses")
    
    try:
        # If unit_id is specified, check if unit exists
        if status.unit_id:
            unit = await db["units"].find_one({"id": status.unit_id})
            if not unit:
                raise HTTPException(status_code=404, detail="Unit not found")
        
        status_obj = LeadStatusModel(
            nome=status.nome,
            unit_id=status.unit_id,
            ordine=status.ordine,
            colore=status.colore
        )
        
        await db["lead_status"].insert_one(status_obj.dict())
        logging.info(f"Lead status created: {status_obj.id} by {current_user.username}")
        
        return status_obj
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error creating lead status: {e}")
        raise HTTPException(status_code=500, detail="Failed to create lead status")

@router.get("/lead-status", response_model=List[LeadStatusModel])
async def get_lead_statuses(
    unit_id: Optional[str] = None,
    show_all: bool = False,  # NEW: Se True, mostra tutti gli status (globali + per unit)
    include_used: bool = False,  # NEW: Se True, include anche esiti usati nei lead ma non configurati
    current_user: User = Depends(get_current_user)
):
    """Get lead statuses - filtered by unit or all"""
    try:
        query = {"is_active": True}
        
        if show_all:
            # Mostra TUTTI gli status (globali e per qualsiasi unit) - per la gestione admin
            pass  # Nessun filtro aggiuntivo
        elif unit_id:
            # Get statuses for specific unit + global statuses (unit_id is None or doesn't exist)
            query["$or"] = [
                {"unit_id": unit_id},
                {"unit_id": None},
                {"unit_id": {"$exists": False}},
                {"unit_id": ""}  # Also check for empty string
            ]
        else:
            # Get only global statuses if no unit specified
            query["$or"] = [
                {"unit_id": None},
                {"unit_id": {"$exists": False}},
                {"unit_id": ""}
            ]
        
        statuses = await db["lead_status"].find(query).sort("ordine", 1).to_list(length=None)
        
        # Ensure _id is excluded and handle None values
        result = []
        configured_names = set()
        for status in statuses:
            status_dict = {k: v for k, v in status.items() if k != "_id"}
            result.append(LeadStatusModel(**status_dict))
            configured_names.add(status.get("nome", ""))
        
        # NEW: Include esiti actually used in leads but not configured
        if include_used:
            # Get unique esiti from leads
            pipeline = [
                {"$match": {"is_deleted": {"$ne": True}}},
                {"$group": {"_id": "$esito"}},
                {"$match": {"_id": {"$ne": None, "$ne": ""}}}
            ]
            unique_esiti = await db["leads"].aggregate(pipeline).to_list(length=None)
            
            for item in unique_esiti:
                esito_name = item["_id"]
                if esito_name and esito_name not in configured_names:
                    # Create a virtual status for this esito
                    result.append(LeadStatusModel(
                        id=f"auto_{esito_name}",
                        nome=esito_name,
                        ordine=999,
                        colore="#6b7280",  # Gray color for unconfigured
                        is_active=True,
                        unit_id=None
                    ))
        
        return result
        
    except Exception as e:
        logging.error(f"Error fetching lead statuses: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch lead statuses")

@router.put("/lead-status/{status_id}", response_model=LeadStatusModel)
async def update_lead_status(
    status_id: str,
    status_update: LeadStatusUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a lead status - Admin only"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update lead statuses")
    
    status = await db["lead_status"].find_one({"id": status_id})
    if not status:
        raise HTTPException(status_code=404, detail="Lead status not found")
    
    try:
        update_dict = {k: v for k, v in status_update.dict(exclude_unset=True).items() if v is not None}
        
        if update_dict:
            await db["lead_status"].update_one(
                {"id": status_id},
                {"$set": update_dict}
            )
        
        updated_status = await db["lead_status"].find_one({"id": status_id})
        return LeadStatusModel(**updated_status)
        
    except Exception as e:
        logging.error(f"Error updating lead status {status_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update lead status")

@router.delete("/lead-status/{status_id}")
async def delete_lead_status(status_id: str, current_user: User = Depends(get_current_user)):
    """Delete a lead status - Admin only"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete lead statuses")
    
    status = await db["lead_status"].find_one({"id": status_id})
    if not status:
        raise HTTPException(status_code=404, detail="Lead status not found")
    
    try:
        # Check if status is in use
        leads_count = await db["leads"].count_documents({"status": status["nome"]})
        if leads_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete status. {leads_count} leads are using this status"
            )
        
        await db["lead_status"].delete_one({"id": status_id})
        
        return {
            "success": True,
            "message": "Lead status deleted successfully",
            "status_id": status_id,
            "status_name": status.get("nome", "")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting lead status {status_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete lead status")

# Custom Fields Management
@router.get("/custom-fields", response_model=List[CustomField])
async def get_custom_fields(current_user: User = Depends(get_current_user)):
    fields = await db.custom_fields.find().to_list(length=None)
    return [CustomField(**field) for field in fields]

@router.post("/custom-fields", response_model=CustomField)
async def create_custom_field(field_data: CustomFieldCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can create custom fields")
    
    # Check if field name already exists
    existing_field = await db.custom_fields.find_one({"name": field_data.name})
    if existing_field:
        raise HTTPException(status_code=400, detail="Field name already exists")
    
    field_obj = CustomField(**field_data.dict())
    await db.custom_fields.insert_one(field_obj.dict())
    return field_obj

@router.delete("/custom-fields/{field_id}")
async def delete_custom_field(field_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete custom fields")
    
    field = await db.custom_fields.find_one({"id": field_id})
    if not field:
        raise HTTPException(status_code=404, detail="Custom field not found")
    
    await db.custom_fields.delete_one({"id": field_id})
    return {"message": "Custom field deleted successfully"}


