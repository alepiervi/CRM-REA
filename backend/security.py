"""Autenticazione, JWT e helper di autorizzazione (estratti da server.py - refactoring fase 2)."""
import os
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext

from database import db
from models import *  # noqa: F401,F403

# JWT and Password hashing
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"username": username})
    if user is None:
        raise credentials_exception
    return User(**user)

# Autorizzazioni Gerarchiche Helper Functions
async def get_user_commessa_authorizations(user_id: str) -> List[UserCommessaAuthorization]:
    """Get all commessa authorizations for a user"""
    authorizations = await db.user_commessa_authorizations.find({
        "user_id": user_id,
        "is_active": True
    }).to_list(length=None)
    return [UserCommessaAuthorization(**auth) for auth in authorizations]

async def check_commessa_access(user: User, commessa_id: str, required_permissions: List[str] = None) -> bool:
    """Check if user has access to a specific commessa"""
    # Admin sempre autorizzato
    if user.role == UserRole.ADMIN:
        return True
    
    # Controllo autorizzazioni specifiche per commessa
    authorization = await db.user_commessa_authorizations.find_one({
        "user_id": user.id,
        "commessa_id": commessa_id,
        "is_active": True
    })
    
    if not authorization:
        return False
    
    # Se ci sono permessi specifici richiesti, controllarli
    if required_permissions:
        auth_obj = UserCommessaAuthorization(**authorization)
        for permission in required_permissions:
            if not getattr(auth_obj, permission, False):
                return False
    
    return True

async def get_user_accessible_commesse(user: User) -> List[str]:
    """Get list of commessa IDs accessible to user"""
    if user.role == UserRole.ADMIN:
        # Admin vede tutte le commesse
        commesse = await db.commesse.find({"is_active": True}).to_list(length=None)
        return [c["id"] for c in commesse]
    
    # CRITICAL FIX: Dual check pattern per altri ruoli
    authorized_commesse = []
    
    # Metodo 1: Campo diretto nell'utente (nuova logica)
    if hasattr(user, 'commesse_autorizzate') and user.commesse_autorizzate:
        authorized_commesse.extend(user.commesse_autorizzate)
    
    # Metodo 2: Tabella separata (vecchia logica - fallback)
    authorizations = await db.user_commessa_authorizations.find({
        "user_id": user.id,
        "is_active": True
    }).to_list(length=None)
    authorized_commesse.extend([auth["commessa_id"] for auth in authorizations])
    
    # Rimuovi duplicati e ritorna lista unica
    return list(set(authorized_commesse))

async def get_user_accessible_sub_agenzie(user: User, commessa_id: str) -> List[str]:
    """Get list of sub agenzia IDs accessible to user for a specific commessa"""
    if user.role == UserRole.ADMIN:
        # Admin vede tutte le sub agenzie
        sub_agenzie = await db.sub_agenzie.find({
            "commesse_autorizzate": {"$in": [commessa_id]},
            "is_active": True
        }).to_list(length=None)
        return [sa["id"] for sa in sub_agenzie]
    
    authorization = await db.user_commessa_authorizations.find_one({
        "user_id": user.id,
        "commessa_id": commessa_id,
        "is_active": True
    })
    
    if not authorization:
        return []
    
    auth_obj = UserCommessaAuthorization(**authorization)
    
    # Se può vedere tutte le agenzie (BackOffice Commessa, Responsabile)
    if auth_obj.can_view_all_agencies:
        sub_agenzie = await db.sub_agenzie.find({
            "commesse_autorizzate": {"$in": [commessa_id]},
            "is_active": True
        }).to_list(length=None)
        return [sa["id"] for sa in sub_agenzie]
    
    # Altrimenti solo la sua sub agenzia
    if auth_obj.sub_agenzia_id:
        return [auth_obj.sub_agenzia_id]
    
    return []

async def can_user_access_cliente(user: User, cliente: Cliente) -> bool:
    """Check if user can access (view/upload docs) a specific cliente - NO STATUS CHECK"""
    
    # Admin can always access
    if user.role == UserRole.ADMIN:
        return True
    
    # For roles that don't use authorizations (like store_assist, agente, etc.)
    # They can access their own clients
    if user.role in [UserRole.STORE_ASSIST, UserRole.AGENTE, UserRole.OPERATORE, 
                     UserRole.AGENTE_SPECIALIZZATO, UserRole.RESPONSABILE_STORE, 
                     UserRole.RESPONSABILE_PRESIDI, UserRole.PROMOTER_PRESIDI]:
        return cliente.created_by == user.id
    
    # For BACKOFFICE_COMMESSA: can access all clients in their authorized commesse
    if user.role == UserRole.BACKOFFICE_COMMESSA:
        if hasattr(user, 'commesse_autorizzate') and user.commesse_autorizzate:
            return cliente.commessa_id in user.commesse_autorizzate
        # Fallback to authorization check
        authorization = await db.user_commessa_authorizations.find_one({
            "user_id": user.id,
            "commessa_id": cliente.commessa_id,
            "is_active": True
        })
        return authorization is not None
    
    # For other roles with authorizations - just check if they have access to the commessa
    authorization = await db.user_commessa_authorizations.find_one({
        "user_id": user.id,
        "commessa_id": cliente.commessa_id,
        "is_active": True
    })
    
    if not authorization:
        return False
    
    auth_obj = UserCommessaAuthorization(**authorization)
    
    # If can view all agencies, can access all clients
    if auth_obj.can_view_all_agencies:
        return True
    
    # Otherwise only clients from their sub agenzia
    return auth_obj.sub_agenzia_id == cliente.sub_agenzia_id


async def can_user_access_cliente_notes(user: User, cliente: Cliente) -> bool:
    """Verifica più permissiva di can_user_access_cliente: usata per la visualizzazione/aggiunta
    di note cliente. Un utente può vedere/aggiungere note se è in qualsiasi modo associato al
    cliente (creatore, assegnatario, stessa sub agenzia, autorizzazione commessa).
    """
    if user.role == UserRole.ADMIN:
        return True
    # Creatore o assegnatario sempre autorizzati
    if cliente.created_by == user.id or cliente.assigned_to == user.id:
        return True
    # Stessa sub agenzia (diretta o autorizzata)
    user_sub_ids = set()
    if getattr(user, "sub_agenzia_id", None):
        user_sub_ids.add(user.sub_agenzia_id)
    user_sub_ids.update(getattr(user, "sub_agenzie_autorizzate", None) or [])
    if cliente.sub_agenzia_id and cliente.sub_agenzia_id in user_sub_ids:
        return True
    # Commessa autorizzata
    user_com_ids = set(getattr(user, "commesse_autorizzate", None) or [])
    if cliente.commessa_id and cliente.commessa_id in user_com_ids:
        return True
    # Fallback: legacy authorization table
    if cliente.commessa_id:
        auth = await db.user_commessa_authorizations.find_one({
            "user_id": user.id,
            "commessa_id": cliente.commessa_id,
            "is_active": True,
        })
        if auth:
            return True
    # Fallback finale: usa la regola di accesso base (per compatibilità)
    return await can_user_access_cliente(user, cliente)


async def can_user_delete_cliente(user: User, cliente: Cliente) -> bool:
    """Check if user can delete a specific cliente"""
    
    # NEW: Check if cliente is locked (status "inserito" or "ko")
    # Only BACKOFFICE_COMMESSA can delete locked clients
    if cliente.status and cliente.status.lower() in ["inserito", "ko"]:
        if user.role != UserRole.BACKOFFICE_COMMESSA:
            return False
    
    # Admin can always delete
    if user.role == UserRole.ADMIN:
        return True
    
    # For roles that don't use authorizations (like agente, etc.)
    # They can delete their own clients (unless locked)
    # NOTE: STORE_ASSIST, PROMOTER_PRESIDI and RESPONSABILE_PRESIDI cannot delete clients
    if user.role in [UserRole.STORE_ASSIST, UserRole.PROMOTER_PRESIDI, UserRole.RESPONSABILE_PRESIDI]:
        return False  # These roles cannot delete clients at all
    
    if user.role in [UserRole.AGENTE, UserRole.OPERATORE, 
                     UserRole.AGENTE_SPECIALIZZATO, UserRole.RESPONSABILE_STORE]:
        return cliente.created_by == user.id
    
    # For BACKOFFICE_COMMESSA: can delete all clients in their authorized commesse
    if user.role == UserRole.BACKOFFICE_COMMESSA:
        if hasattr(user, 'commesse_autorizzate') and user.commesse_autorizzate:
            return cliente.commessa_id in user.commesse_autorizzate
        # Fallback to authorization check
        authorization = await db.user_commessa_authorizations.find_one({
            "user_id": user.id,
            "commessa_id": cliente.commessa_id,
            "is_active": True
        })
        return authorization is not None
    
    # For other roles with authorizations - check can_delete_clients permission
    authorization = await db.user_commessa_authorizations.find_one({
        "user_id": user.id,
        "commessa_id": cliente.commessa_id,
        "is_active": True
    })
    
    if not authorization:
        return False
    
    auth_obj = UserCommessaAuthorization(**authorization)
    
    # Must have delete permission
    if not auth_obj.can_delete_clients:
        return False
    
    # If can view all agencies, can delete all clients
    if auth_obj.can_view_all_agencies:
        return True
    
    # Otherwise only clients from their sub agenzia
    return auth_obj.sub_agenzia_id == cliente.sub_agenzia_id


async def can_user_modify_cliente(user: User, cliente: Cliente) -> bool:
    """Check if user can modify a specific cliente"""
    
    # NEW: Check if cliente is locked (status "inserito" or "ko") - lowercase with underscore
    # Only ADMIN, RESPONSABILE_COMMESSA and BACKOFFICE_COMMESSA can modify locked clients
    if cliente.status and cliente.status.lower() in ["inserito", "ko"]:
        if user.role not in [UserRole.ADMIN, UserRole.RESPONSABILE_COMMESSA, UserRole.BACKOFFICE_COMMESSA]:
            return False
    
    if user.role == UserRole.ADMIN:
        return True
    
    # For roles that don't use authorizations (like store_assist, agente, etc.)
    # They can only modify their own clients
    if user.role in [UserRole.STORE_ASSIST, UserRole.AGENTE, UserRole.OPERATORE, 
                     UserRole.AGENTE_SPECIALIZZATO, UserRole.RESPONSABILE_STORE, 
                     UserRole.RESPONSABILE_PRESIDI, UserRole.PROMOTER_PRESIDI]:
        return cliente.created_by == user.id
    
    # For BACKOFFICE_COMMESSA and RESPONSABILE_COMMESSA: can modify all clients in their authorized commesse
    if user.role in [UserRole.BACKOFFICE_COMMESSA, UserRole.RESPONSABILE_COMMESSA]:
        if hasattr(user, 'commesse_autorizzate') and user.commesse_autorizzate:
            return cliente.commessa_id in user.commesse_autorizzate
        # Fallback to authorization check
        authorization = await db.user_commessa_authorizations.find_one({
            "user_id": user.id,
            "commessa_id": cliente.commessa_id,
            "is_active": True
        })
        return authorization is not None
    
    # For other roles with authorizations
    authorization = await db.user_commessa_authorizations.find_one({
        "user_id": user.id,
        "commessa_id": cliente.commessa_id,
        "is_active": True
    })
    
    if not authorization:
        return False
    
    auth_obj = UserCommessaAuthorization(**authorization)
    
    # Deve avere permesso di modifica
    if not auth_obj.can_modify_clients:
        return False
    
    # Se può vedere tutte le agenzie, può modificare tutti i clienti
    if auth_obj.can_view_all_agencies:
        return True
    
    # Altrimenti solo clienti della sua sub agenzia
    return auth_obj.sub_agenzia_id == cliente.sub_agenzia_id

# Document Access Helper Functions
async def can_user_access_document(user: User, document: Document) -> bool:
    """Check if user can access a specific document"""
    if user.role == UserRole.ADMIN:
        return True
    
    # For Lead documents - existing logic
    if document.document_type == DocumentType.LEAD and document.lead_id:
        lead = await db.leads.find_one({"id": document.lead_id})
        if not lead:
            return False
        
        # Check if user has access to the lead's unit
        if user.role == UserRole.REFERENTE:
            return user.unit_id == lead.get("unit_id")
        elif user.role == UserRole.AGENTE:
            return user.id == lead.get("assigned_to") or user.unit_id == lead.get("unit_id")
    
    # For Cliente documents - new authorization logic
    elif document.document_type == DocumentType.CLIENTE and document.cliente_id:
        cliente = await db.clienti.find_one({"id": document.cliente_id})
        if not cliente:
            return False
        
        cliente_obj = Cliente(**cliente)
        
        # Check commessa access first
        if not await check_commessa_access(user, cliente_obj.commessa_id):
            return False
        
        # Check sub agenzia access
        authorization = await db.user_commessa_authorizations.find_one({
            "user_id": user.id,
            "commessa_id": cliente_obj.commessa_id,
            "is_active": True
        })
        
        if not authorization:
            return False
        
        auth_obj = UserCommessaAuthorization(**authorization)
        
        # If can view all agencies (BackOffice Commessa, Responsabile)
        if auth_obj.can_view_all_agencies:
            return True
        
        # Otherwise only own sub agenzia documents
        return auth_obj.sub_agenzia_id == cliente_obj.sub_agenzia_id
    
    return False

async def get_user_accessible_documents(user: User, document_type: Optional[DocumentType] = None) -> List[str]:
    """Get list of document IDs accessible to user"""
    if user.role == UserRole.ADMIN:
        query = {"is_active": True}
        if document_type:
            query["document_type"] = document_type
        documents = await db.documents.find(query).to_list(length=None)
        return [doc["id"] for doc in documents]
    
    accessible_doc_ids = []
    
    # Lead documents access
    if document_type is None or document_type == DocumentType.LEAD:
        if user.role == UserRole.REFERENTE:
            # Can access all leads in their unit
            leads = await db.leads.find({"unit_id": user.unit_id}).to_list(length=None)
            lead_ids = [lead["id"] for lead in leads]
            lead_docs = await db.documents.find({
                "document_type": DocumentType.LEAD,
                "lead_id": {"$in": lead_ids},
                "is_active": True
            }).to_list(length=None)
            accessible_doc_ids.extend([doc["id"] for doc in lead_docs])
            
        elif user.role == UserRole.AGENTE:
            # Can access assigned leads or all leads in unit
            leads = await db.leads.find({
                "$or": [
                    {"assigned_to": user.id},
                    {"unit_id": user.unit_id}
                ]
            }).to_list(length=None)
            lead_ids = [lead["id"] for lead in leads]
            lead_docs = await db.documents.find({
                "document_type": DocumentType.LEAD,
                "lead_id": {"$in": lead_ids},
                "is_active": True
            }).to_list(length=None)
            accessible_doc_ids.extend([doc["id"] for doc in lead_docs])
    
    # Cliente documents access
    if document_type is None or document_type == DocumentType.CLIENTE:
        accessible_commesse = await get_user_accessible_commesse(user)
        
        for commessa_id in accessible_commesse:
            accessible_sub_agenzie = await get_user_accessible_sub_agenzie(user, commessa_id)
            
            if accessible_sub_agenzie:
                # Get clienti for accessible sub agenzie
                clienti = await db.clienti.find({
                    "commessa_id": commessa_id,
                    "sub_agenzia_id": {"$in": accessible_sub_agenzie}
                }).to_list(length=None)
                
                cliente_ids = [cliente["id"] for cliente in clienti]
                
                # Get documents for these clienti
                cliente_docs = await db.documents.find({
                    "document_type": DocumentType.CLIENTE,
                    "cliente_id": {"$in": cliente_ids},
                    "is_active": True
                }).to_list(length=None)
                
                accessible_doc_ids.extend([doc["id"] for doc in cliente_docs])
    
    return accessible_doc_ids

