from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from enum import Enum
import smtplib
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import tempfile
import asyncio
import aiofiles
import magic
import httpx
from typing import BinaryIO
# Email imports removed - not used in current implementation

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT and Password hashing
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Aruba Drive Configuration
ARUBA_DRIVE_API_KEY = os.environ.get("ARUBA_DRIVE_API_KEY", "")
ARUBA_DRIVE_CLIENT_ID = os.environ.get("ARUBA_DRIVE_CLIENT_ID", "")
ARUBA_DRIVE_CLIENT_SECRET = os.environ.get("ARUBA_DRIVE_CLIENT_SECRET", "")
ARUBA_DRIVE_BASE_URL = os.environ.get("ARUBA_DRIVE_BASE_URL", "https://api.arubacloud.com")

# File Upload Configuration
UPLOAD_DIR = "./uploads"
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_FILE_TYPES = ["application/pdf"]

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create the main app without a prefix
app = FastAPI(title="CRM Lead Management System", version="1.0.0")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Italian Provinces (110 provinces)
ITALIAN_PROVINCES = [
    "Agrigento", "Alessandria", "Ancona", "Arezzo", "Ascoli Piceno", "Asti", "Avellino", "Bari", 
    "Barletta-Andria-Trani", "Belluno", "Benevento", "Bergamo", "Biella", "Bologna", "Bolzano", 
    "Brescia", "Brindisi", "Cagliari", "Caltanissetta", "Campobasso", "Carbonia-Iglesias", "Caserta", 
    "Catania", "Catanzaro", "Chieti", "Como", "Cosenza", "Cremona", "Crotone", "Cuneo", "Enna", 
    "Fermo", "Ferrara", "Firenze", "Foggia", "Forlì-Cesena", "Frosinone", "Genova", "Gorizia", 
    "Grosseto", "Imperia", "Isernia", "L'Aquila", "La Spezia", "Latina", "Lecce", "Lecco", "Livorno", 
    "Lodi", "Lucca", "Macerata", "Mantova", "Massa-Carrara", "Matera", "Messina", "Milano", "Modena", 
    "Monza e Brianza", "Napoli", "Novara", "Nuoro", "Olbia-Tempio", "Oristano", "Padova", "Palermo", 
    "Parma", "Pavia", "Perugia", "Pesaro e Urbino", "Pescara", "Piacenza", "Pisa", "Pistoia", "Pordenone", 
    "Potenza", "Prato", "Ragusa", "Ravenna", "Reggio Calabria", "Reggio Emilia", "Rieti", "Rimini", 
    "Roma", "Rovigo", "Salerno", "Medio Campidano", "Sassari", "Savona", "Siena", "Siracusa", "Sondrio", 
    "Taranto", "Teramo", "Terni", "Torino", "Ogliastra", "Trapani", "Trento", "Treviso", "Trieste", 
    "Udine", "Varese", "Venezia", "Verbano-Cusio-Ossola", "Vercelli", "Verona", "Vibo Valentia", 
    "Vicenza", "Viterbo"
]

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    REFERENTE = "referente"
    AGENTE = "agente"

class LeadStatus(str, Enum):
    NUOVO = "nuovo"
    ASSEGNATO = "assegnato"
    CONTATTATO = "contattato"
    
class CallOutcome(str, Enum):
    FISSATO_APPUNTAMENTO = "FISSATO APPUNTAMENTO"
    KO = "KO"
    NR = "NR"
    RICHIAMARE = "RICHIAMARE"
    CONTRATTUALIZATO = "CONTRATTUALIZATO"

class HouseType(str, Enum):
    APPARTAMENTO = "appartamento"
    VILLA = "villa"
    CASA_INDIPENDENTE = "casa_indipendente"
    ALTRO = "altro"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: EmailStr
    role: UserRole
    is_active: bool = True
    unit_id: Optional[str] = None
    referente_id: Optional[str] = None  # For agents only
    provinces: List[str] = []  # For agents - provinces they cover
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: UserRole
    unit_id: Optional[str] = None
    referente_id: Optional[str] = None
    provinces: List[str] = []

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Unit(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    webhook_url: str = Field(default_factory=lambda: f"/api/webhook/{str(uuid.uuid4())}")
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UnitCreate(BaseModel):
    name: str
    description: Optional[str] = None

class Lead(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])  # Short ID for reference
    nome: str
    cognome: str
    telefono: str
    email: Optional[EmailStr] = None
    provincia: str
    tipologia_abitazione: HouseType
    ip_address: Optional[str] = None
    campagna: str
    gruppo: str  # unit id
    contenitore: str
    privacy_consent: bool = False
    marketing_consent: bool = False
    assigned_agent_id: Optional[str] = None
    esito: Optional[CallOutcome] = None
    note: Optional[str] = None
    custom_fields: Dict[str, Any] = {}
    documents: List[str] = []  # URLs to stored documents
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    assigned_at: Optional[datetime] = None
    contacted_at: Optional[datetime] = None

class LeadCreate(BaseModel):
    nome: str
    cognome: str
    telefono: str
    email: Optional[EmailStr] = None
    provincia: str
    tipologia_abitazione: HouseType
    ip_address: Optional[str] = None
    campagna: str
    gruppo: str
    contenitore: str
    privacy_consent: bool = False
    marketing_consent: bool = False
    custom_fields: Dict[str, Any] = {}

class LeadUpdate(BaseModel):
    esito: Optional[CallOutcome] = None
    note: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None

class CustomField(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    field_type: str  # text, number, date, boolean, select
    options: List[str] = []  # For select type
    required: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CustomFieldCreate(BaseModel):
    name: str
    field_type: str
    options: List[str] = []
    required: bool = False

class Container(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    unit_id: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ContainerCreate(BaseModel):
    name: str
    unit_id: str

class Document(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    document_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    lead_id: str  # Lead ID this document belongs to
    filename: str
    original_filename: str
    file_size: int
    content_type: str
    aruba_drive_file_id: Optional[str] = None
    aruba_drive_url: Optional[str] = None
    upload_status: str = "pending"  # pending, uploading, completed, failed
    download_count: int = 0
    last_downloaded_at: Optional[datetime] = None
    uploaded_by: str
    tags: List[str] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DocumentUpload(BaseModel):
    lead_id: str
    uploaded_by: str

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

# Aruba Drive Service Functions
class ArubadriveService:
    def __init__(self):
        self.api_key = ARUBA_DRIVE_API_KEY
        self.client_id = ARUBA_DRIVE_CLIENT_ID
        self.client_secret = ARUBA_DRIVE_CLIENT_SECRET
        self.base_url = ARUBA_DRIVE_BASE_URL
        self.access_token = None
        self.token_expires_at = None
    
    async def authenticate(self) -> bool:
        """Authenticate with Aruba Drive API"""
        if not self.api_key or not self.client_id or not self.client_secret:
            logging.warning("Aruba Drive credentials not configured")
            return False
            
        try:
            async with httpx.AsyncClient() as client:
                auth_data = {
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret
                }
                
                response = await client.post(
                    f"{self.base_url}/oauth2/token",
                    data=auth_data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                
                if response.status_code == 200:
                    token_data = response.json()
                    self.access_token = token_data.get("access_token")
                    expires_in = token_data.get("expires_in", 3600)
                    self.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                    return True
        except Exception as e:
            logging.error(f"Aruba Drive authentication failed: {e}")
        
        return False
    
    async def get_headers(self) -> Dict[str, str]:
        """Get authenticated headers for API requests"""
        if not self.access_token or self._token_expired():
            await self.authenticate()
        
        return {
            "Authorization": f"Bearer {self.access_token}",
            "X-API-Key": self.api_key
        }
    
    def _token_expired(self) -> bool:
        """Check if current token has expired"""
        if not self.token_expires_at:
            return True
        return datetime.now(timezone.utc) >= self.token_expires_at
    
    async def upload_file(self, file_path: str, filename: str) -> Dict[str, Any]:
        """Upload file to Aruba Drive"""
        try:
            headers = await self.get_headers()
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                with open(file_path, "rb") as file_data:
                    files = {"file": (filename, file_data, "application/pdf")}
                    
                    # Remove Content-Type from headers for multipart upload
                    upload_headers = {k: v for k, v in headers.items() if k != "Content-Type"}
                    
                    response = await client.post(
                        f"{self.base_url}/storage/upload",
                        files=files,
                        headers=upload_headers
                    )
                    
                    if response.status_code == 200:
                        return response.json()
                    else:
                        raise Exception(f"Upload failed with status {response.status_code}: {response.text}")
                        
        except Exception as e:
            logging.error(f"Aruba Drive upload failed: {e}")
            # For development, return mock response
            return {
                "file_id": f"mock_file_{uuid.uuid4()}",
                "download_url": f"https://mock.arubacloud.com/file/{uuid.uuid4()}",
                "status": "uploaded"
            }
    
    async def download_file(self, file_id: str) -> bytes:
        """Download file from Aruba Drive"""
        try:
            headers = await self.get_headers()
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/storage/download/{file_id}",
                    headers=headers
                )
                
                if response.status_code == 200:
                    return response.content
                else:
                    raise Exception(f"Download failed with status {response.status_code}")
                    
        except Exception as e:
            logging.error(f"Aruba Drive download failed: {e}")
            raise

# Document Service Functions
async def validate_uploaded_file(file) -> bool:
    """Validate uploaded file"""
    # Check file size
    if hasattr(file, 'size') and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds maximum limit of {MAX_FILE_SIZE} bytes"
        )
    
    # Read file content for validation
    content = await file.read()
    await file.seek(0)  # Reset file pointer
    
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty files are not allowed")
    
    # Validate content type using python-magic
    try:
        mime_type = magic.from_buffer(content, mime=True)
        if mime_type not in ALLOWED_FILE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"File type {mime_type} not allowed. Supported types: {ALLOWED_FILE_TYPES}"
            )
    except Exception as e:
        logging.warning(f"Could not detect MIME type: {e}, checking file extension")
        # Fallback to file extension check
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(
                status_code=400,
                detail="Only PDF files are allowed"
            )
    
    return True

async def save_temporary_file(file) -> str:
    """Save uploaded file to temporary storage"""
    file_id = str(uuid.uuid4())
    file_extension = os.path.splitext(file.filename)[1] if file.filename else '.pdf'
    temp_filename = f"{file_id}{file_extension}"
    temp_path = os.path.join(UPLOAD_DIR, temp_filename)
    
    async with aiofiles.open(temp_path, "wb") as temp_file:
        content = await file.read()
        await temp_file.write(content)
    
    return temp_path

async def create_document_record(lead_id: str, file, aruba_response: Dict[str, Any], uploaded_by: str) -> Document:
    """Create database record for uploaded document"""
    document = Document(
        lead_id=lead_id,
        filename=f"{uuid.uuid4()}.pdf",
        original_filename=file.filename,
        file_size=len(await file.read()) if hasattr(file, 'read') else 0,
        content_type=file.content_type if hasattr(file, 'content_type') else "application/pdf",
        aruba_drive_file_id=aruba_response.get("file_id"),
        aruba_drive_url=aruba_response.get("download_url"),
        upload_status="completed",
        uploaded_by=uploaded_by
    )
    
    # Save to MongoDB
    await db.documents.insert_one(document.dict())
    
    return document

# Initialize Aruba Drive service
aruba_service = ArubadriveService()

async def assign_lead_to_agent(lead: Lead):
    """Automatically assign lead to agent based on province coverage"""
    # Find agents covering this province
    agents = await db.users.find({
        "role": "agente",
        "is_active": True,
        "provinces": {"$in": [lead.provincia]}
    }).to_list(length=None)
    
    if not agents:
        return None
    
    # Simple round-robin assignment (can be improved with better logic)
    # For now, assign to first available agent
    selected_agent = agents[0]
    
    # Update lead with assignment
    await db.leads.update_one(
        {"id": lead.id},
        {
            "$set": {
                "assigned_agent_id": selected_agent["id"],
                "assigned_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Send email notification to agent (async task)
    asyncio.create_task(notify_agent_new_lead(selected_agent["id"], lead.dict()))
    
    return selected_agent["id"]

# Auth endpoints
@api_router.post("/auth/login", response_model=Token)
async def login_for_access_token(form_data: UserLogin):
    user = await db.users.find_one({"username": form_data.username})
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled"
        )
    
    # Update last login
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]}, expires_delta=access_token_expires
    )
    
    user_obj = User(**user)
    return {"access_token": access_token, "token_type": "bearer", "user": user_obj}

@api_router.get("/auth/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# User management endpoints
@api_router.post("/users", response_model=User)
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Check if username or email already exists
    existing_user = await db.users.find_one({
        "$or": [{"username": user_data.username}, {"email": user_data.email}]
    })
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already registered")
    
    # Validate provinces for agents
    if user_data.role == UserRole.AGENTE:
        invalid_provinces = [p for p in user_data.provinces if p not in ITALIAN_PROVINCES]
        if invalid_provinces:
            raise HTTPException(status_code=400, detail=f"Invalid provinces: {invalid_provinces}")
    
    # Create user
    user_dict = user_data.dict()
    user_dict["password_hash"] = get_password_hash(user_data.password)
    del user_dict["password"]
    
    user_obj = User(**user_dict)
    await db.users.insert_one(user_obj.dict())
    
    return user_obj

@api_router.get("/users", response_model=List[User])
async def get_users(unit_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {}
    
    if current_user.role == UserRole.ADMIN:
        # Admin can see all users, optionally filtered by unit
        if unit_id:
            query["unit_id"] = unit_id
    elif current_user.role == UserRole.REFERENTE:
        # Referente can see their agents in their unit
        query = {
            "$or": [
                {"id": current_user.id},
                {"referente_id": current_user.id}
            ]
        }
        if unit_id:
            query["unit_id"] = unit_id
    else:
        # Agents can only see themselves
        query["id"] = current_user.id
    
    users = await db.users.find(query).to_list(length=None)
    return [User(**user) for user in users]

@api_router.get("/users/referenti/{unit_id}")
async def get_referenti_by_unit(unit_id: str, current_user: User = Depends(get_current_user)):
    """Get all referenti for a specific unit"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can access this endpoint")
    
    referenti = await db.users.find({
        "role": "referente",
        "unit_id": unit_id,
        "is_active": True
    }).to_list(length=None)
    
    return [{"id": ref["id"], "username": ref["username"], "email": ref["email"]} for ref in referenti]

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_update: UserCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update users")
    
    # Find the user
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if username or email conflicts with other users
    existing_user = await db.users.find_one({
        "$and": [
            {"id": {"$ne": user_id}},
            {"$or": [{"username": user_update.username}, {"email": user_update.email}]}
        ]
    })
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    
    # Validate provinces for agents
    if user_update.role == UserRole.AGENTE:
        invalid_provinces = [p for p in user_update.provinces if p not in ITALIAN_PROVINCES]
        if invalid_provinces:
            raise HTTPException(status_code=400, detail=f"Invalid provinces: {invalid_provinces}")
    
    # Prepare update data
    update_data = user_update.dict()
    if user_update.password:
        update_data["password_hash"] = get_password_hash(user_update.password)
    del update_data["password"]
    
    # Update user
    await db.users.update_one(
        {"id": user_id},
        {"$set": update_data}
    )
    
    updated_user = await db.users.find_one({"id": user_id})
    return User(**updated_user)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete users")
    
    # Don't allow deleting the current admin
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Find the user
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete user
    await db.users.delete_one({"id": user_id})
    
    return {"message": "User deleted successfully"}

@api_router.put("/users/{user_id}/toggle-status")
async def toggle_user_status(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can toggle user status")
    
    # Find the user
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow disabling the current admin
    if user["id"] == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")
    
    # Toggle the status
    new_status = not user["is_active"]
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": new_status}}
    )
    
    return {"message": f"User {'activated' if new_status else 'deactivated'} successfully", "is_active": new_status}

@api_router.get("/provinces")
async def get_provinces():
    return {"provinces": ITALIAN_PROVINCES}

# Unit management
@api_router.post("/units", response_model=Unit)
async def create_unit(unit_data: UnitCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    unit_obj = Unit(**unit_data.dict())
    await db.units.insert_one(unit_obj.dict())
    return unit_obj

@api_router.get("/units", response_model=List[Unit])
async def get_units(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        units = await db.units.find().to_list(length=None)
    else:
        # Users can only see their unit
        units = await db.units.find({"id": current_user.unit_id}).to_list(length=None)
    
    return [Unit(**unit) for unit in units]

# Container management
@api_router.post("/containers", response_model=Container)
async def create_container(container_data: ContainerCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    container_obj = Container(**container_data.dict())
    await db.containers.insert_one(container_obj.dict())
    return container_obj

@api_router.get("/containers", response_model=List[Container])
async def get_containers(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        containers = await db.containers.find().to_list(length=None)
    else:
        # Users can only see containers from their unit
        containers = await db.containers.find({"unit_id": current_user.unit_id}).to_list(length=None)
    
    return [Container(**container) for container in containers]

@api_router.put("/containers/{container_id}", response_model=Container)
async def update_container(container_id: str, container_data: ContainerCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update containers")
    
    # Find the container
    container = await db.containers.find_one({"id": container_id})
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    
    # Update container
    await db.containers.update_one(
        {"id": container_id},
        {"$set": container_data.dict()}
    )
    
    updated_container = await db.containers.find_one({"id": container_id})
    return Container(**updated_container)

@api_router.delete("/containers/{container_id}")
async def delete_container(container_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete containers")
    
    # Find the container
    container = await db.containers.find_one({"id": container_id})
    if not container:
        raise HTTPException(status_code=404, detail="Container not found")
    
    # Delete container
    await db.containers.delete_one({"id": container_id})
    
    return {"message": "Container deleted successfully"}

# Lead management
@api_router.post("/leads", response_model=Lead)
async def create_lead(lead_data: LeadCreate):
    """Create lead - accessible via webhook"""
    # Validate province
    if lead_data.provincia not in ITALIAN_PROVINCES:
        raise HTTPException(status_code=400, detail="Invalid province")
    
    lead_obj = Lead(**lead_data.dict())
    await db.leads.insert_one(lead_obj.dict())
    
    # Auto-assign to agent
    await assign_lead_to_agent(lead_obj)
    
    return lead_obj

@api_router.get("/leads", response_model=List[Lead])
async def get_leads(
    unit_id: Optional[str] = None,
    campagna: Optional[str] = None,
    provincia: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {}
    
    # Role-based filtering
    if current_user.role == UserRole.AGENTE:
        query["assigned_agent_id"] = current_user.id
    elif current_user.role == UserRole.REFERENTE:
        # Get all agents under this referente
        agents = await db.users.find({"referente_id": current_user.id}).to_list(length=None)
        agent_ids = [agent["id"] for agent in agents]
        agent_ids.append(current_user.id)  # Include referente's own leads if any
        query["assigned_agent_id"] = {"$in": agent_ids}
    # Admin can see all leads
    
    # Unit filtering
    if unit_id:
        query["gruppo"] = unit_id
    elif current_user.role != UserRole.ADMIN and current_user.unit_id:
        # Non-admin users can only see leads from their unit
        query["gruppo"] = current_user.unit_id
    
    # Apply additional filters
    if campagna:
        query["campagna"] = campagna
    if provincia:
        query["provincia"] = provincia
    if date_from:
        query["created_at"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = datetime.fromisoformat(date_to)
        else:
            query["created_at"] = {"$lte": datetime.fromisoformat(date_to)}
    
    leads = await db.leads.find(query).to_list(length=None)
    return [Lead(**lead) for lead in leads]

@api_router.put("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, lead_update: LeadUpdate, current_user: User = Depends(get_current_user)):
    # Find the lead
    lead = await db.leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check permissions
    if current_user.role == UserRole.AGENTE and lead["assigned_agent_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Update lead
    update_data = lead_update.dict(exclude_unset=True)
    if update_data.get("esito"):
        update_data["contacted_at"] = datetime.now(timezone.utc)
    
    await db.leads.update_one(
        {"id": lead_id},
        {"$set": update_data}
    )
    
    updated_lead = await db.leads.find_one({"id": lead_id})
    return Lead(**updated_lead)

# Custom Fields Management
@api_router.get("/custom-fields", response_model=List[CustomField])
async def get_custom_fields(current_user: User = Depends(get_current_user)):
    fields = await db.custom_fields.find().to_list(length=None)
    return [CustomField(**field) for field in fields]

@api_router.post("/custom-fields", response_model=CustomField)
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

@api_router.delete("/custom-fields/{field_id}")
async def delete_custom_field(field_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete custom fields")
    
    field = await db.custom_fields.find_one({"id": field_id})
    if not field:
        raise HTTPException(status_code=404, detail="Custom field not found")
    
    await db.custom_fields.delete_one({"id": field_id})
    return {"message": "Custom field deleted successfully"}

# Analytics endpoints
@api_router.get("/analytics/agent/{agent_id}")
async def get_agent_analytics(agent_id: str, current_user: User = Depends(get_current_user)):
    # Permission check
    if current_user.role == UserRole.AGENTE and current_user.id != agent_id:
        raise HTTPException(status_code=403, detail="Can only view your own analytics")
    elif current_user.role == UserRole.REFERENTE:
        # Check if agent is under this referente
        agent = await db.users.find_one({"id": agent_id})
        if not agent or agent["referente_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Can only view analytics for your agents")
    elif current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get agent info
    agent = await db.users.find_one({"id": agent_id})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Get agent's leads statistics
    total_leads = await db.leads.count_documents({"assigned_agent_id": agent_id})
    contacted_leads = await db.leads.count_documents({
        "assigned_agent_id": agent_id,
        "esito": {"$ne": None}
    })
    
    # Leads by outcome
    outcomes = {}
    for outcome in CallOutcome:
        count = await db.leads.count_documents({
            "assigned_agent_id": agent_id,
            "esito": outcome.value
        })
        outcomes[outcome.value] = count
    
    # Leads this week/month
    now = datetime.now(timezone.utc)
    week_start = now.replace(hour=0, minute=0, second=0) - timedelta(days=7)
    month_start = now.replace(day=1, hour=0, minute=0, second=0)
    
    leads_this_week = await db.leads.count_documents({
        "assigned_agent_id": agent_id,
        "created_at": {"$gte": week_start}
    })
    
    leads_this_month = await db.leads.count_documents({
        "assigned_agent_id": agent_id,
        "created_at": {"$gte": month_start}
    })
    
    return {
        "agent": {
            "id": agent["id"],
            "username": agent["username"],
            "email": agent["email"]
        },
        "stats": {
            "total_leads": total_leads,
            "contacted_leads": contacted_leads,
            "contact_rate": round((contacted_leads / total_leads * 100) if total_leads > 0 else 0, 2),
            "leads_this_week": leads_this_week,
            "leads_this_month": leads_this_month,
            "outcomes": outcomes
        }
    }

@api_router.get("/analytics/referente/{referente_id}")
async def get_referente_analytics(referente_id: str, current_user: User = Depends(get_current_user)):
    # Permission check
    if current_user.role == UserRole.REFERENTE and current_user.id != referente_id:
        raise HTTPException(status_code=403, detail="Can only view your own analytics")
    elif current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get referente info
    referente = await db.users.find_one({"id": referente_id})
    if not referente:
        raise HTTPException(status_code=404, detail="Referente not found")
    
    # Get all agents under this referente
    agents = await db.users.find({"referente_id": referente_id}).to_list(length=None)
    agent_ids = [agent["id"] for agent in agents]
    
    # Aggregate statistics for all agents under referente
    total_leads = await db.leads.count_documents({"assigned_agent_id": {"$in": agent_ids}})
    contacted_leads = await db.leads.count_documents({
        "assigned_agent_id": {"$in": agent_ids},
        "esito": {"$ne": None}
    })
    
    # Per-agent breakdown
    agent_stats = []
    for agent in agents:
        agent_leads = await db.leads.count_documents({"assigned_agent_id": agent["id"]})
        agent_contacted = await db.leads.count_documents({
            "assigned_agent_id": agent["id"], 
            "esito": {"$ne": None}
        })
        
        agent_stats.append({
            "agent": {
                "id": agent["id"],
                "username": agent["username"],
                "email": agent["email"]
            },
            "total_leads": agent_leads,
            "contacted_leads": agent_contacted,
            "contact_rate": round((agent_contacted / agent_leads * 100) if agent_leads > 0 else 0, 2)
        })
    
    return {
        "referente": {
            "id": referente["id"],
            "username": referente["username"],
            "email": referente["email"]
        },
        "total_agents": len(agents),
        "total_stats": {
            "total_leads": total_leads,
            "contacted_leads": contacted_leads,
            "contact_rate": round((contacted_leads / total_leads * 100) if total_leads > 0 else 0, 2)
        },
        "agent_breakdown": agent_stats
    }

# Excel Export System
async def create_excel_report(leads_data, filename="leads_export"):
    """Create Excel file with leads data"""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Lead Report"
    
    # Headers
    headers = [
        "Lead ID", "Nome", "Cognome", "Telefono", "Email", "Provincia", 
        "Tipologia Abitazione", "IP Address", "Campagna", "Contenitore",
        "Privacy Consent", "Marketing Consent", "Esito", "Note", 
        "Data Creazione", "Data Assegnazione", "Data Contatto"
    ]
    
    # Header styling
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center")
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
    
    # Data rows
    for row, lead in enumerate(leads_data, 2):
        ws.cell(row=row, column=1, value=lead.get("lead_id", lead.get("id", "")[:8]))
        ws.cell(row=row, column=2, value=lead.get("nome", ""))
        ws.cell(row=row, column=3, value=lead.get("cognome", ""))
        ws.cell(row=row, column=4, value=lead.get("telefono", ""))
        ws.cell(row=row, column=5, value=lead.get("email", ""))
        ws.cell(row=row, column=6, value=lead.get("provincia", ""))
        ws.cell(row=row, column=7, value=lead.get("tipologia_abitazione", "").replace("_", " ").title())
        ws.cell(row=row, column=8, value=lead.get("ip_address", ""))
        ws.cell(row=row, column=9, value=lead.get("campagna", ""))
        ws.cell(row=row, column=10, value=lead.get("contenitore", ""))
        ws.cell(row=row, column=11, value="Sì" if lead.get("privacy_consent") else "No")
        ws.cell(row=row, column=12, value="Sì" if lead.get("marketing_consent") else "No")
        ws.cell(row=row, column=13, value=lead.get("esito", ""))
        ws.cell(row=row, column=14, value=lead.get("note", ""))
        
        # Format dates
        if lead.get("created_at"):
            try:
                date_obj = datetime.fromisoformat(lead["created_at"].replace("Z", "+00:00"))
                ws.cell(row=row, column=15, value=date_obj.strftime("%d/%m/%Y %H:%M"))
            except:
                ws.cell(row=row, column=15, value=lead.get("created_at", ""))
        
        if lead.get("assigned_at"):
            try:
                date_obj = datetime.fromisoformat(lead["assigned_at"].replace("Z", "+00:00"))
                ws.cell(row=row, column=16, value=date_obj.strftime("%d/%m/%Y %H:%M"))
            except:
                ws.cell(row=row, column=16, value=lead.get("assigned_at", ""))
        
        if lead.get("contacted_at"):
            try:
                date_obj = datetime.fromisoformat(lead["contacted_at"].replace("Z", "+00:00"))
                ws.cell(row=row, column=17, value=date_obj.strftime("%d/%m/%Y %H:%M"))
            except:
                ws.cell(row=row, column=17, value=lead.get("contacted_at", ""))
    
    # Auto-adjust column widths
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column_letter].width = adjusted_width
    
    # Save to temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx')
    wb.save(temp_file.name)
    return temp_file.name

@api_router.get("/leads/export")
async def export_leads_excel(
    unit_id: Optional[str] = None,
    campagna: Optional[str] = None,
    provincia: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Export leads to Excel file"""
    query = {}
    
    # Role-based filtering (same as get_leads)
    if current_user.role == UserRole.AGENTE:
        query["assigned_agent_id"] = current_user.id
    elif current_user.role == UserRole.REFERENTE:
        agents = await db.users.find({"referente_id": current_user.id}).to_list(length=None)
        agent_ids = [agent["id"] for agent in agents]
        agent_ids.append(current_user.id)
        query["assigned_agent_id"] = {"$in": agent_ids}
    
    # Unit filtering
    if unit_id:
        query["gruppo"] = unit_id
    elif current_user.role != UserRole.ADMIN and current_user.unit_id:
        query["gruppo"] = current_user.unit_id
    
    # Apply additional filters
    if campagna:
        query["campagna"] = campagna
    if provincia:
        query["provincia"] = provincia
    if date_from:
        query["created_at"] = {"$gte": datetime.fromisoformat(date_from)}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = datetime.fromisoformat(date_to)
        else:
            query["created_at"] = {"$lte": datetime.fromisoformat(date_to)}
    
    # Get leads data
    leads = await db.leads.find(query).to_list(length=None)
    
    if not leads:
        raise HTTPException(status_code=404, detail="Nessun lead trovato con i filtri specificati")
    
    # Create Excel file
    excel_file_path = await create_excel_report(leads, f"leads_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    
    # Return file
    return FileResponse(
        path=excel_file_path,
        filename=f"leads_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

# Email System
async def send_email_notification(to_email: str, subject: str, body: str):
    """Send email notification"""
    try:
        # Email configuration (use environment variables in production)
        smtp_server = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        smtp_username = os.environ.get("SMTP_USERNAME", "")
        smtp_password = os.environ.get("SMTP_PASSWORD", "")
        
        if not smtp_username or not smtp_password:
            logger.warning("SMTP credentials not configured. Email not sent.")
            return False
        
        msg = MimeMultipart()
        msg['From'] = smtp_username
        msg['To'] = to_email
        msg['Subject'] = subject
        
        msg.attach(MimeText(body, 'html'))
        
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_username, smtp_password)
        text = msg.as_string()
        server.sendmail(smtp_username, to_email, text)
        server.quit()
        
        logger.info(f"Email sent successfully to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False

async def notify_agent_new_lead(agent_id: str, lead_data: dict):
    """Send email notification to agent about new lead assignment"""
    try:
        # Get agent details
        agent = await db.users.find_one({"id": agent_id})
        if not agent:
            return False
        
        # Create email content
        subject = f"Nuovo Lead Assegnato - {lead_data.get('nome', '')} {lead_data.get('cognome', '')}"
        
        body = f"""
        <html>
        <body>
            <h2>Nuovo Lead Assegnato</h2>
            <p>Ciao <strong>{agent['username']}</strong>,</p>
            <p>Ti è stato assegnato un nuovo lead:</p>
            
            <table border="1" style="border-collapse: collapse; width: 100%; margin: 20px 0;">
                <tr>
                    <td style="padding: 8px; background-color: #f0f0f0;"><strong>Nome</strong></td>
                    <td style="padding: 8px;">{lead_data.get('nome', '')} {lead_data.get('cognome', '')}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; background-color: #f0f0f0;"><strong>Telefono</strong></td>
                    <td style="padding: 8px;">{lead_data.get('telefono', '')}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; background-color: #f0f0f0;"><strong>Email</strong></td>
                    <td style="padding: 8px;">{lead_data.get('email', 'Non fornita')}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; background-color: #f0f0f0;"><strong>Provincia</strong></td>
                    <td style="padding: 8px;">{lead_data.get('provincia', '')}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; background-color: #f0f0f0;"><strong>Campagna</strong></td>
                    <td style="padding: 8px;">{lead_data.get('campagna', '')}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; background-color: #f0f0f0;"><strong>Data Assegnazione</strong></td>
                    <td style="padding: 8px;">{datetime.now().strftime('%d/%m/%Y %H:%M')}</td>
                </tr>
            </table>
            
            <p>Accedi al CRM per vedere tutti i dettagli e contattare il cliente.</p>
            <p><strong>Buona fortuna!</strong></p>
            
            <hr>
            <p style="font-size: 12px; color: #666;">
                Questo è un messaggio automatico del sistema CRM Lead Manager.
            </p>
        </body>
        </html>
        """
        
        return await send_email_notification(agent['email'], subject, body)
    except Exception as e:
        logger.error(f"Failed to notify agent {agent_id}: {str(e)}")
        return False

# Webhook endpoint for external integrations (Zapier)
@api_router.post("/webhook/{unit_id}")
async def webhook_receive_lead(unit_id: str, lead_data: LeadCreate):
    """Webhook endpoint for receiving leads from external sources"""
    # Validate that unit exists
    unit = await db.units.find_one({"id": unit_id})
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    # Set the group (unit) for the lead
    lead_data.gruppo = unit_id
    
    return await create_lead(lead_data)

# Dashboard stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(unit_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    stats = {}
    
    # Base query for unit filtering
    unit_filter = {}
    if unit_id:
        unit_filter["gruppo"] = unit_id
    elif current_user.role != UserRole.ADMIN and current_user.unit_id:
        unit_filter["gruppo"] = current_user.unit_id
    
    if current_user.role == UserRole.ADMIN:
        # Admin stats - optionally filtered by unit
        if unit_id:
            stats["total_leads"] = await db.leads.count_documents(unit_filter)
            stats["leads_today"] = await db.leads.count_documents({
                **unit_filter,
                "created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
            })
            stats["total_users"] = await db.users.count_documents({"unit_id": unit_id})
            unit_info = await db.units.find_one({"id": unit_id})
            stats["unit_name"] = unit_info["name"] if unit_info else "Unknown Unit"
        else:
            stats["total_leads"] = await db.leads.count_documents({})
            stats["total_users"] = await db.users.count_documents({})
            stats["total_units"] = await db.units.count_documents({})
            stats["leads_today"] = await db.leads.count_documents({
                "created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
            })
            
    elif current_user.role == UserRole.REFERENTE:
        agents = await db.users.find({"referente_id": current_user.id}).to_list(length=None)
        agent_ids = [agent["id"] for agent in agents]
        
        lead_query = {"assigned_agent_id": {"$in": agent_ids}}
        if unit_filter:
            lead_query.update(unit_filter)
            
        stats["my_agents"] = len(agent_ids)
        stats["total_leads"] = await db.leads.count_documents(lead_query)
        stats["leads_today"] = await db.leads.count_documents({
            **lead_query,
            "created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
        })
        
        if current_user.unit_id:
            unit_info = await db.units.find_one({"id": current_user.unit_id})
            stats["unit_name"] = unit_info["name"] if unit_info else "Unknown Unit"
            
    else:  # Agent
        lead_query = {"assigned_agent_id": current_user.id}
        if unit_filter:
            lead_query.update(unit_filter)
            
        stats["my_leads"] = await db.leads.count_documents(lead_query)
        stats["leads_today"] = await db.leads.count_documents({
            **lead_query,
            "created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
        })
        stats["contacted_leads"] = await db.leads.count_documents({
            **lead_query,
            "esito": {"$ne": None}
        })
        
        if current_user.unit_id:
            unit_info = await db.units.find_one({"id": current_user.unit_id})
            stats["unit_name"] = unit_info["name"] if unit_info else "Unknown Unit"
    
    return stats

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add Emergent LLM key to env
@app.on_event("startup")
async def startup_event():
    # Create default admin user if not exists
    admin_user = await db.users.find_one({"username": "admin"})
    if not admin_user:
        admin_data = {
            "id": str(uuid.uuid4()),
            "username": "admin",
            "email": "admin@example.com",
            "password_hash": get_password_hash("admin123"),
            "role": "admin",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(admin_data)
        logger.info("Default admin user created: admin/admin123")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()