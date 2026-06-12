"""Route: Gestione Units lead — estratte da server.py (refactoring fase 2, giugno 2026)."""
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
# UNIT MANAGEMENT ENDPOINTS - For Lead Units
# ============================================================================

@router.post("/units", response_model=Unit)
async def create_unit(unit: UnitCreate, current_user: User = Depends(get_current_user)):
    """Create a new lead unit - Admin only"""
    # MASSIVE LOGGING FOR DEBUG
    logging.info(f"========== CREATE UNIT REQUEST ==========")
    logging.info(f"User: {current_user.username} (role: {current_user.role})")
    logging.info(f"Unit data received: {unit.dict()}")
    logging.info(f"Unit nome: {unit.nome}")
    logging.info(f"Unit commessa_id: {unit.commessa_id}")
    logging.info(f"Unit campagne: {unit.campagne_autorizzate}")
    logging.info(f"==========================================")
    
    if current_user.role != UserRole.ADMIN:
        logging.error(f"Access denied: {current_user.username} is not admin")
        raise HTTPException(status_code=403, detail="Only admin can create units")
    
    try:
        # Multi-commesse support: validate all commesse exist
        commesse_autorizzate = unit.commesse_autorizzate.copy() if unit.commesse_autorizzate else []
        
        # If legacy commessa_id is provided, add it to commesse_autorizzate
        if unit.commessa_id:
            if unit.commessa_id not in commesse_autorizzate:
                commesse_autorizzate.append(unit.commessa_id)
        
        # Validate that at least one commessa is provided
        if not commesse_autorizzate:
            logging.error("No commesse provided - at least one is required")
            raise HTTPException(status_code=422, detail="At least one commessa is required")
        
        # Check that all commesse exist
        logging.info(f"Validating {len(commesse_autorizzate)} commesse...")
        for commessa_id in commesse_autorizzate:
            commessa = await db["commesse"].find_one({"id": commessa_id})
            if not commessa:
                logging.error(f"Commessa {commessa_id} NOT FOUND")
                raise HTTPException(status_code=404, detail=f"Commessa {commessa_id} not found")
            logging.info(f"✓ Commessa found: {commessa.get('nome', 'N/A')}")
        
        # Create unit with multi-commesse support
        unit_obj = Unit(
            nome=unit.nome,
            commessa_id=commesse_autorizzate[0] if commesse_autorizzate else None,  # First commessa for legacy compatibility
            commesse_autorizzate=commesse_autorizzate,
            campagne_autorizzate=unit.campagne_autorizzate
        )
        
        logging.info(f"Unit object created: {unit_obj.dict()}")
        
        await db["units"].insert_one(unit_obj.dict())
        logging.info(f"✅ Unit SUCCESSFULLY created: {unit_obj.id} by {current_user.username}")
        
        return unit_obj
        
    except HTTPException as he:
        logging.error(f"HTTPException in create_unit: {he.status_code} - {he.detail}")
        raise
    except Exception as e:
        logging.error(f"❌ UNEXPECTED ERROR creating unit: {type(e).__name__}: {str(e)}")
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to create unit: {str(e)}")

@router.get("/units", response_model=List[Unit])
async def get_units(
    commessa_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all units - filtered by role"""
    try:
        query = {}
        
        # Role-based filtering
        if current_user.role == UserRole.ADMIN:
            pass  # Admin sees all
        elif current_user.role == UserRole.REFERENTE:
            # Referente sees units they are authorized for
            if current_user.unit_autorizzate:
                query["id"] = {"$in": current_user.unit_autorizzate}
            else:
                return []
        else:
            # Other roles don't see units
            return []
        
        # Apply filters
        if commessa_id:
            query["commessa_id"] = commessa_id
        if is_active is not None:
            query["is_active"] = is_active
        
        units = await db["units"].find(query).to_list(length=None)
        
        # Filter out units with validation errors
        valid_units = []
        for unit_data in units:
            try:
                unit = Unit(**unit_data)
                valid_units.append(unit)
            except Exception as e:
                logging.warning(f"Skipping unit {unit_data.get('id', 'unknown')} due to validation error: {str(e)}")
                continue
        
        return valid_units
        
    except Exception as e:
        logging.error(f"Error fetching units: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch units")

@router.get("/units/{unit_id}", response_model=Unit)
async def get_unit(unit_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific unit"""
    unit = await db["units"].find_one({"id": unit_id})
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    # Check permissions
    if current_user.role not in [UserRole.ADMIN, UserRole.REFERENTE]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user.role == UserRole.REFERENTE:
        if unit_id not in current_user.unit_autorizzate:
            raise HTTPException(status_code=403, detail="Access denied to this unit")
    
    return Unit(**unit)

@router.put("/units/{unit_id}", response_model=Unit)
async def update_unit(
    unit_id: str, 
    unit_update: UnitUpdate, 
    current_user: User = Depends(get_current_user)
):
    """Update a unit - Admin only"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update units")
    
    unit = await db["units"].find_one({"id": unit_id})
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    try:
        # FIX: Allow None values for fields like assistant_id (to unassign)
        update_dict = unit_update.dict(exclude_unset=True)
        
        if update_dict:
            await db["units"].update_one(
                {"id": unit_id},
                {"$set": update_dict}
            )
        
        updated_unit = await db["units"].find_one({"id": unit_id})
        return Unit(**updated_unit)
        
    except Exception as e:
        logging.error(f"Error updating unit {unit_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update unit")

@router.delete("/units/{unit_id}")
async def delete_unit(unit_id: str, current_user: User = Depends(get_current_user)):
    """Delete a unit - Admin only"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete units")
    
    unit = await db["units"].find_one({"id": unit_id})
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    try:
        # Check if unit has assigned leads
        leads_count = await db["leads"].count_documents({"unit_id": unit_id})
        if leads_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete unit. {leads_count} leads are assigned to this unit"
            )
        
        # Check if unit has agents
        agents_count = await db["users"].count_documents({"unit_autorizzate": unit_id})
        if agents_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete unit. {agents_count} agents are authorized for this unit"
            )
        
        await db["units"].delete_one({"id": unit_id})
        
        return {
            "success": True,
            "message": "Unit deleted successfully",
            "unit_id": unit_id,
            "unit_name": unit.get("nome", "")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting unit {unit_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete unit")

