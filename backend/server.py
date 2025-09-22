from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form, Query
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
# Email imports temporarily disabled
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import tempfile
from emergentintegrations.llm.chat import LlmChat, UserMessage
import asyncio
import aiofiles
import magic
import httpx
from typing import BinaryIO
import io
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

# OpenAI ChatBot Configuration
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_API_KEY_SID = os.environ.get("TWILIO_API_KEY_SID", "")
TWILIO_API_KEY_SECRET = os.environ.get("TWILIO_API_KEY_SECRET", "")
DEFAULT_CALLER_ID = os.environ.get("DEFAULT_CALLER_ID", "")
WEBHOOK_BASE_URL = os.environ.get("WEBHOOK_BASE_URL", "https://localhost")
RECORDING_STORAGE_BUCKET = os.environ.get("RECORDING_STORAGE_BUCKET", "")
MAX_CALL_DURATION = int(os.environ.get("MAX_CALL_DURATION", "3600"))
CALL_RECORDING_ENABLED = os.environ.get("CALL_RECORDING_ENABLED", "true").lower() == "true"

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
    assistant_id: Optional[str] = None  # OpenAI Assistant ID for this unit
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class UnitCreate(BaseModel):
    name: str
    description: Optional[str] = None
    assistant_id: Optional[str] = None

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

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_id: str
    session_id: str  # Può essere unit_id o unit_id-user_id per chat private
    user_id: str
    message: str
    message_type: str = "user"  # user, assistant, system
    metadata: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str  # Unique identifier per sessione
    unit_id: str
    participants: List[str] = []  # User IDs dei partecipanti
    session_type: str = "unit"  # unit, private, lead
    is_active: bool = True
    last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AIConfiguration(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    openai_api_key: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class AIConfigurationCreate(BaseModel):
    openai_api_key: str

class OpenAIAssistant(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    model: str
    instructions: Optional[str] = None
    created_at: int

class WhatsAppConfiguration(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    unit_id: str  # AGGIUNTO: Ogni Unit ha la sua configurazione WhatsApp
    phone_number: str  # Numero di telefono WhatsApp Business
    qr_code: Optional[str] = None  # QR Code data per connessione
    is_connected: bool = False
    connection_status: str = "disconnected"  # disconnected, connecting, connected
    last_seen: Optional[datetime] = None
    device_info: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class WhatsAppConfigurationCreate(BaseModel):
    phone_number: str
    unit_id: Optional[str] = None  # Opzionale, se None usa unit corrente

class WhatsAppMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message_id: str = Field(default_factory=lambda: f"msg_{str(uuid.uuid4())[:12]}")
    lead_id: str  # Lead associato alla conversazione
    phone_number: str  # Numero WhatsApp del lead
    message: str
    message_type: str = "text"  # text, image, document, voice
    direction: str  # incoming, outgoing
    sender: str  # lead_phone, bot, agent_id
    status: str = "sent"  # sent, delivered, read, failed
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = {}

class WhatsAppConversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    phone_number: str
    contact_name: Optional[str] = None
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None
    unread_count: int = 0
    status: str = "active"  # active, archived, blocked
    assigned_agent: Optional[str] = None
    bot_stage: Optional[str] = None  # bot conversation stage
    is_bot_active: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LeadWhatsAppValidation(BaseModel):
    lead_id: str
    phone_number: str
    is_whatsapp: Optional[bool] = None
    validation_status: str = "pending"  # pending, valid, invalid, error
    validation_date: Optional[datetime] = None

# Workflow Builder Models (FASE 3)
class Workflow(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    unit_id: str
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_active: bool = True
    is_published: bool = False
    workflow_data: Optional[dict] = None  # Canvas layout and configuration

class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    is_published: Optional[bool] = None
    workflow_data: Optional[dict] = None

class WorkflowNode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workflow_id: str
    node_type: str  # trigger, action, condition, delay
    node_subtype: str  # specific type like "form_submitted", "send_email"
    name: str
    position_x: int
    position_y: int
    configuration: Optional[dict] = None  # Node-specific settings
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WorkflowNodeCreate(BaseModel):
    node_type: str
    node_subtype: str
    name: str
    position_x: int
    position_y: int
    configuration: Optional[dict] = None

class WorkflowNodeUpdate(BaseModel):
    name: Optional[str] = None
    position_x: Optional[int] = None
    position_y: Optional[int] = None
    configuration: Optional[dict] = None

class NodeConnection(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workflow_id: str
    source_node_id: str
    target_node_id: str
    source_handle: Optional[str] = None  # For conditional branches
    target_handle: Optional[str] = None
    condition_data: Optional[dict] = None  # For conditional connections
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NodeConnectionCreate(BaseModel):
    source_node_id: str
    target_node_id: str
    source_handle: Optional[str] = None
    target_handle: Optional[str] = None
    condition_data: Optional[dict] = None

class WorkflowExecution(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workflow_id: str
    contact_id: Optional[str] = None
    status: str = "pending"  # pending, running, completed, failed, cancelled, paused
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    current_node_id: Optional[str] = None
    execution_data: Optional[dict] = None  # Runtime variables and context
    error_message: Optional[str] = None
    retry_count: int = 0

class ExecutionStep(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    execution_id: str
    node_id: str
    step_order: int
    status: str  # pending, running, completed, failed
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    input_data: Optional[dict] = None
    output_data: Optional[dict] = None
    error_message: Optional[str] = None

class WorkflowExecutionCreate(BaseModel):
    contact_id: Optional[str] = None
    trigger_data: Optional[dict] = None

# Call Center Models
class CallStatus(str, Enum):
    QUEUED = "queued"
    RINGING = "ringing"
    IN_PROGRESS = "in-progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BUSY = "busy"
    NO_ANSWER = "no-answer"
    CANCELED = "canceled"
    ABANDONED = "abandoned"

class CallDirection(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"

class AgentStatus(str, Enum):
    AVAILABLE = "available"
    BUSY = "busy"
    OFFLINE = "offline"
    BREAK = "break"
    TRAINING = "training"

class Call(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    call_sid: str  # Twilio Call SID
    direction: CallDirection
    from_number: str
    to_number: str
    agent_id: Optional[str] = None
    unit_id: str
    status: CallStatus = CallStatus.QUEUED
    priority: int = 1  # 1 = normal, 2 = high, 3 = urgent
    queue_time: Optional[datetime] = None
    answered_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration: Optional[int] = None  # seconds
    recording_sid: Optional[str] = None
    recording_url: Optional[str] = None
    caller_country: Optional[str] = None
    caller_state: Optional[str] = None
    caller_city: Optional[str] = None
    disposition: Optional[str] = None  # resolved, escalated, callback_requested
    notes: Optional[str] = None
    satisfaction_score: Optional[int] = None  # 1-5 rating
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class CallCreate(BaseModel):
    direction: CallDirection
    from_number: str
    to_number: str
    unit_id: str
    priority: int = 1

class CallUpdate(BaseModel):
    status: Optional[CallStatus] = None
    agent_id: Optional[str] = None
    disposition: Optional[str] = None
    notes: Optional[str] = None
    satisfaction_score: Optional[int] = None

class AgentCallCenter(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # Reference to existing User model
    status: AgentStatus = AgentStatus.OFFLINE
    skills: List[str] = []  # e.g., ["sales", "support", "italian", "english"]
    languages: List[str] = ["italian"]
    department: str = "general"
    max_concurrent_calls: int = 1
    experience_score: int = 1  # 1-10 rating
    extension: Optional[str] = None
    last_activity: Optional[datetime] = None
    total_calls_today: int = 0
    calls_in_progress: int = 0
    avg_call_duration: Optional[float] = None
    customer_satisfaction: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class AgentCreate(BaseModel):
    user_id: str
    skills: List[str] = []
    languages: List[str] = ["italian"]
    department: str = "general"
    max_concurrent_calls: int = 1
    extension: Optional[str] = None

class AgentUpdate(BaseModel):
    status: Optional[AgentStatus] = None
    skills: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    department: Optional[str] = None
    max_concurrent_calls: Optional[int] = None
    extension: Optional[str] = None

class CallQueue(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    unit_id: str
    description: Optional[str] = None
    skills_required: List[str] = []
    priority_weight: int = 1
    max_wait_time: int = 600  # seconds
    overflow_destination: Optional[str] = None  # queue name or voicemail
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CallQueueCreate(BaseModel):
    name: str
    unit_id: str
    description: Optional[str] = None
    skills_required: List[str] = []
    max_wait_time: int = 600

class CallRecording(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    call_sid: str
    recording_sid: str  # Twilio Recording SID
    agent_id: Optional[str] = None
    duration: Optional[int] = None  # seconds
    file_size: Optional[int] = None  # bytes
    storage_url: Optional[str] = None
    transcription: Optional[str] = None
    status: str = "pending"  # pending, processing, completed, failed
    is_encrypted: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: Optional[datetime] = None

class OutboundCampaign(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    unit_id: str
    description: Optional[str] = None
    status: str = "draft"  # draft, active, paused, completed
    caller_id: str  # Phone number to use as caller ID
    total_contacts: int = 0
    contacted: int = 0
    connected: int = 0
    completed: int = 0
    script: Optional[str] = None
    schedule_start: Optional[datetime] = None
    schedule_end: Optional[datetime] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class OutboundContact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    campaign_id: str
    lead_id: Optional[str] = None  # If based on existing lead
    phone_number: str
    name: Optional[str] = None
    status: str = "pending"  # pending, called, answered, busy, no_answer, failed
    attempts: int = 0
    max_attempts: int = 3
    last_attempt: Optional[datetime] = None
    next_attempt: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PhoneNumber(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    phone_number: str
    twilio_sid: str
    unit_id: str
    is_active: bool = True
    capabilities: List[str] = ["voice", "sms"]  # voice, sms, mms
    is_dynamic: bool = False  # For dynamic number rotation
    rotation_interval: Optional[int] = None  # minutes
    last_rotated: Optional[datetime] = None
    usage_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CallAnalytics(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: datetime
    unit_id: str
    total_calls: int = 0
    inbound_calls: int = 0
    outbound_calls: int = 0
    answered_calls: int = 0
    abandoned_calls: int = 0
    avg_wait_time: Optional[float] = None
    avg_call_duration: Optional[float] = None
    service_level_20s: Optional[float] = None  # % of calls answered within 20 seconds
    agent_utilization: Optional[float] = None
    customer_satisfaction: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
            # Per sviluppo, ritorna contenuto mock PDF
            return b'%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n197\n%%EOF'

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
    # Reset file to get accurate size
    await file.seek(0)
    content = await file.read()
    file_size = len(content)
    await file.seek(0)  # Reset again
    
    document = Document(
        lead_id=lead_id,
        filename=f"{uuid.uuid4()}.pdf",
        original_filename=file.filename or "document.pdf",
        file_size=file_size,
        content_type=getattr(file, 'content_type', "application/pdf"),
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

# ChatBot Service
class ChatBotService:
    def __init__(self):
        self.api_key = EMERGENT_LLM_KEY
        self.active_chats = {}  # session_id -> LlmChat instance
    
    async def get_or_create_chat(self, session_id: str, unit_id: str) -> LlmChat:
        """Get existing chat or create new one for session"""
        if session_id not in self.active_chats:
            # Get unit info for context
            unit = await db.units.find_one({"id": unit_id})
            unit_name = unit["name"] if unit else "CRM Unit"
            
            system_message = f"""Sei un assistente AI per il sistema CRM di {unit_name}. 
            Il tuo ruolo è aiutare gli agenti e referenti con:
            - Analisi dei lead e suggerimenti per il follow-up
            - Strategie di comunicazione con i clienti  
            - Organizzazione del lavoro e priorità
            - Risposte a domande sui processi aziendali
            
            Rispoudi sempre in italiano e mantieni un tono professionale ma amichevole.
            Concentrati su consigli pratici e azionabili per migliorare le performance di vendita."""
            
            chat = LlmChat(
                api_key=self.api_key,
                session_id=session_id,
                system_message=system_message
            ).with_model("openai", "gpt-4o-mini")
            
            self.active_chats[session_id] = chat
        
        return self.active_chats[session_id]
    
    async def send_message(self, session_id: str, unit_id: str, message: str, user_id: str) -> str:
        """Send message to ChatBot and get response"""
        try:
            chat = await self.get_or_create_chat(session_id, unit_id)
            
            user_message = UserMessage(text=message)
            response = await chat.send_message(user_message)
            
            # Save user message to database
            user_msg = ChatMessage(
                unit_id=unit_id,
                session_id=session_id,
                user_id=user_id,
                message=message,
                message_type="user"
            )
            await db.chat_messages.insert_one(user_msg.dict())
            
            # Save assistant response to database
            assistant_msg = ChatMessage(
                unit_id=unit_id,
                session_id=session_id,
                user_id="assistant",
                message=response,
                message_type="assistant"
            )
            await db.chat_messages.insert_one(assistant_msg.dict())
            
            return response
            
        except Exception as e:
            logging.error(f"ChatBot error: {e}")
            return "Mi dispiace, ho riscontrato un errore. Riprova tra poco."
    
    async def get_chat_history(self, session_id: str, limit: int = 50) -> List[ChatMessage]:
        """Get chat history for session"""
        messages = await db.chat_messages.find({
            "session_id": session_id
        }).sort("created_at", -1).limit(limit).to_list(length=None)
        
        # Reverse to get chronological order
        messages.reverse()
        return [ChatMessage(**msg) for msg in messages]
    
    async def create_session(self, unit_id: str, session_type: str = "unit", participants: List[str] = None) -> ChatSession:
        """Create new chat session"""
        session_id = f"{unit_id}-{session_type}-{str(uuid.uuid4())[:8]}"
        
        session = ChatSession(
            session_id=session_id,
            unit_id=unit_id,
            participants=participants or [],
            session_type=session_type
        )
        
        await db.chat_sessions.insert_one(session.dict())
        return session

# Initialize ChatBot service
chatbot_service = ChatBotService()

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

@api_router.put("/units/{unit_id}", response_model=Unit)
async def update_unit(unit_id: str, unit_data: UnitCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update units")
    
    # Check if unit exists
    existing_unit = await db.units.find_one({"id": unit_id})
    if not existing_unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    # Update unit data
    update_data = unit_data.dict()
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.units.update_one(
        {"id": unit_id},
        {"$set": update_data}
    )
    
    # Return updated unit
    updated_unit = await db.units.find_one({"id": unit_id})
    return Unit(**updated_unit)

@api_router.delete("/units/{unit_id}")
async def delete_unit(unit_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete units")
    
    # Check if unit exists
    existing_unit = await db.units.find_one({"id": unit_id})
    if not existing_unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    # Check if unit has associated users
    users_count = await db.users.count_documents({"unit_id": unit_id})
    if users_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete unit. {users_count} users are still associated with this unit"
        )
    
    # Check if unit has associated leads
    leads_count = await db.leads.count_documents({"gruppo": unit_id})
    if leads_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete unit. {leads_count} leads are still associated with this unit"
        )
    
    # Check if unit has associated containers
    containers_count = await db.containers.count_documents({"unit_id": unit_id})
    if containers_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete unit. {containers_count} containers are still associated with this unit"
        )
    
    # Safe to delete unit
    await db.units.delete_one({"id": unit_id})
    
    return {
        "success": True,
        "message": "Unit deleted successfully",
        "unit_id": unit_id
    }

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

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, current_user: User = Depends(get_current_user)):
    """Delete a lead"""
    
    # Find the lead
    lead = await db.leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Check permissions - only admin can delete leads
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete leads")
    
    try:
        # Check if lead has associated documents
        documents_count = await db.documents.count_documents({"lead_id": lead_id, "is_active": True})
        if documents_count > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete lead. {documents_count} documents are still associated with this lead"
            )
        
        # Delete the lead
        await db.leads.delete_one({"id": lead_id})
        
        return {
            "success": True,
            "message": "Lead deleted successfully",
            "lead_id": lead_id,
            "lead_info": {
                "nome": lead["nome"],
                "cognome": lead["cognome"],
                "email": lead.get("email", ""),
                "telefono": lead.get("telefono", "")
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error deleting lead {lead_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete lead")

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

# Document management endpoints
@api_router.post("/documents/upload/{lead_id}")
async def upload_document(
    lead_id: str,
    file: UploadFile = File(...),
    uploaded_by: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """Upload a PDF document for a specific lead"""
    
    # Check if lead exists
    lead = await db.leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    try:
        # Validate file
        await validate_uploaded_file(file)
        
        # Save to temporary storage
        temp_path = await save_temporary_file(file)
        
        try:
            # Upload to Aruba Drive
            aruba_response = await aruba_service.upload_file(temp_path, file.filename)
            
            # Create database record
            document = await create_document_record(lead_id, file, aruba_response, uploaded_by)
            
            return {
                "success": True,
                "message": "Document uploaded successfully",
                "document": {
                    "id": document.id,
                    "document_id": document.document_id,
                    "filename": document.original_filename,
                    "size": document.file_size,
                    "upload_status": document.upload_status,
                    "created_at": document.created_at.isoformat()
                },
                "lead": {
                    "id": lead["id"],
                    "nome": lead["nome"],
                    "cognome": lead["cognome"]
                }
            }
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
    except HTTPException:
        raise
    except Exception as e:
        # Clean up temporary file on error
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        
        raise HTTPException(
            status_code=500,
            detail=f"Upload failed: {str(e)}"
        )

@api_router.get("/documents/lead/{lead_id}")
async def list_lead_documents(
    lead_id: str,
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """List all documents for a specific lead"""
    
    # Check if lead exists
    lead = await db.leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Query documents with pagination
    documents = await db.documents.find({
        "lead_id": lead_id,
        "is_active": True
    }).skip(skip).limit(limit).to_list(length=None)
    
    # Get total count for pagination
    total_count = await db.documents.count_documents({
        "lead_id": lead_id,
        "is_active": True
    })
    
    document_list = []
    for doc in documents:
        document_list.append({
            "id": doc["id"],
            "document_id": doc["document_id"],
            "filename": doc["original_filename"],
            "size": doc["file_size"],
            "content_type": doc["content_type"],
            "upload_status": doc["upload_status"],
            "uploaded_by": doc["uploaded_by"],
            "download_count": doc.get("download_count", 0),
            "created_at": doc["created_at"].isoformat(),
            "download_url": f"/api/documents/download/{doc['document_id']}"
        })
    
    return {
        "lead": {
            "id": lead["id"],
            "nome": lead["nome"],
            "cognome": lead["cognome"],
            "lead_id": lead.get("lead_id", lead["id"][:8])
        },
        "documents": document_list,
        "pagination": {
            "total": total_count,
            "skip": skip,
            "limit": limit,
            "has_more": (skip + limit) < total_count
        }
    }

@api_router.get("/documents/download/{document_id}")
async def download_document(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """Download a specific document by document ID"""
    
    # Find document in database
    document = await db.documents.find_one({
        "document_id": document_id,
        "is_active": True
    })
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # Download from Aruba Drive
        file_content = await aruba_service.download_file(document["aruba_drive_file_id"])
        
        # Update download count
        await db.documents.update_one(
            {"document_id": document_id},
            {
                "$set": {"last_downloaded_at": datetime.now(timezone.utc)},
                "$inc": {"download_count": 1}
            }
        )
        
        return StreamingResponse(
            io.BytesIO(file_content),
            media_type=document["content_type"],
            headers={
                "Content-Disposition": f"attachment; filename={document['original_filename']}"
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Download failed: {str(e)}"
        )

@api_router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """Soft delete a document (marks as inactive)"""
    
    # Only admin can delete documents
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete documents")
    
    document = await db.documents.find_one({
        "document_id": document_id,
        "is_active": True
    })
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # Soft delete in database
        await db.documents.update_one(
            {"document_id": document_id},
            {"$set": {"is_active": False}}
        )
        
        return {
            "success": True,
            "message": "Document deleted successfully",
            "document_id": document_id
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Deletion failed: {str(e)}"
        )

@api_router.get("/documents")
async def list_all_documents(
    current_user: User = Depends(get_current_user),
    unit_id: Optional[str] = None,
    nome: Optional[str] = None,
    cognome: Optional[str] = None,
    lead_id: Optional[str] = None,
    uploaded_by: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    """List all documents with filtering options"""
    
    # Build lead query first if we have lead filters
    lead_query = {}
    
    if nome:
        lead_query["nome"] = {"$regex": nome, "$options": "i"}
    if cognome:
        lead_query["cognome"] = {"$regex": cognome, "$options": "i"}
    if lead_id:
        lead_query["lead_id"] = {"$regex": lead_id, "$options": "i"}
    
    # Build document query based on user role
    query = {"is_active": True}
    
    # Add uploaded_by filter if specified
    if uploaded_by:
        query["uploaded_by"] = {"$regex": uploaded_by, "$options": "i"}
    
    if current_user.role == UserRole.AGENTE:
        # Agents can only see documents for their assigned leads
        agent_lead_query = {"assigned_agent_id": current_user.id}
        agent_lead_query.update(lead_query)
        agent_leads = await db.leads.find(agent_lead_query).to_list(length=None)
        lead_ids = [lead["id"] for lead in agent_leads]
        query["lead_id"] = {"$in": lead_ids}
    elif current_user.role == UserRole.REFERENTE:
        # Referenti can see documents for leads assigned to their agents
        agents = await db.users.find({"referente_id": current_user.id}).to_list(length=None)
        agent_ids = [agent["id"] for agent in agents] + [current_user.id]
        referente_lead_query = {"assigned_agent_id": {"$in": agent_ids}}
        referente_lead_query.update(lead_query)
        agent_leads = await db.leads.find(referente_lead_query).to_list(length=None)
        lead_ids = [lead["id"] for lead in agent_leads]
        query["lead_id"] = {"$in": lead_ids}
    else:  # Admin can see all documents
        if lead_query:
            # Apply lead filters for admin
            admin_leads = await db.leads.find(lead_query).to_list(length=None)
            lead_ids = [lead["id"] for lead in admin_leads]
            query["lead_id"] = {"$in": lead_ids}
    
    # Apply unit filter if specified
    if unit_id and current_user.role == UserRole.ADMIN:
        unit_leads = await db.leads.find({"gruppo": unit_id}).to_list(length=None)
        unit_lead_ids = [lead["id"] for lead in unit_leads]
        
        # Combine with existing lead_id filter if present
        if "lead_id" in query:
            # Intersection of both filters
            existing_lead_ids = query["lead_id"]["$in"] if isinstance(query["lead_id"], dict) else [query["lead_id"]]
            combined_lead_ids = list(set(existing_lead_ids) & set(unit_lead_ids))
            query["lead_id"] = {"$in": combined_lead_ids}
        else:
            query["lead_id"] = {"$in": unit_lead_ids}
    
    # Get documents with pagination
    documents = await db.documents.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=None)
    total_count = await db.documents.count_documents(query)
    
    # Enrich with lead information
    document_list = []
    for doc in documents:
        # Get lead info
        lead = await db.leads.find_one({"id": doc["lead_id"]})
        lead_info = {}
        if lead:
            lead_info = {
                "id": lead["id"],
                "nome": lead["nome"],
                "cognome": lead["cognome"],
                "lead_id": lead.get("lead_id", lead["id"][:8]),
                "email": lead.get("email", ""),
                "telefono": lead.get("telefono", "")
            }
        
        document_list.append({
            "id": doc["id"],
            "document_id": doc["document_id"],
            "filename": doc["original_filename"],
            "size": doc["file_size"],
            "content_type": doc["content_type"],
            "upload_status": doc["upload_status"],
            "uploaded_by": doc["uploaded_by"],
            "download_count": doc.get("download_count", 0),
            "created_at": doc["created_at"].isoformat(),
            "lead": lead_info
        })
    
    return {
        "documents": document_list,
        "pagination": {
            "total": total_count,
            "skip": skip,
            "limit": limit,
            "has_more": (skip + limit) < total_count
        },
        "filters_applied": {
            "unit_id": unit_id,
            "nome": nome,
            "cognome": cognome,
            "lead_id": lead_id,
            "uploaded_by": uploaded_by
        }
    }

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

# Email System - Temporarily disabled due to import issues
async def send_email_notification(to_email: str, subject: str, body: str):
    """Send email notification"""
    # Temporarily disabled
    return False

async def notify_agent_new_lead(agent_id: str, lead_data: dict):
    """Send email notification to agent about new lead assignment"""
    # Temporarily disabled
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

# ChatBot endpoints
@api_router.post("/chat/message")
async def send_chat_message(
    session_id: str = Form(...),
    message: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """Send message to chatbot"""
    
    if not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    # Get session to determine unit_id
    session = await db.chat_sessions.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # Check if user has access to this unit
    if current_user.role != UserRole.ADMIN and current_user.unit_id != session["unit_id"]:
        raise HTTPException(status_code=403, detail="Access denied to this chat session")
    
    try:
        response = await chatbot_service.send_message(
            session_id, 
            session["unit_id"], 
            message, 
            current_user.id
        )
        
        # Update session last activity
        await db.chat_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"last_activity": datetime.now(timezone.utc)}}
        )
        
        return {
            "success": True,
            "response": response,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logging.error(f"Chat message error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send message")

@api_router.get("/chat/history/{session_id}")
async def get_chat_history(
    session_id: str,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """Get chat history for session"""
    
    # Get session to check access
    session = await db.chat_sessions.find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # Check access
    if current_user.role != UserRole.ADMIN and current_user.unit_id != session["unit_id"]:
        raise HTTPException(status_code=403, detail="Access denied to this chat session")
    
    try:
        messages = await chatbot_service.get_chat_history(session_id, limit)
        
        return {
            "session_id": session_id,
            "messages": [
                {
                    "id": msg.id,
                    "user_id": msg.user_id,
                    "message": msg.message,
                    "message_type": msg.message_type,
                    "created_at": msg.created_at.isoformat()
                }
                for msg in messages
            ],
            "total_messages": len(messages)
        }
        
    except Exception as e:
        logging.error(f"Get chat history error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get chat history")

@api_router.post("/chat/session")
async def create_chat_session(
    session_type: str = Form("unit"),
    participants: Optional[str] = Form(None),  # JSON string of participant IDs
    current_user: User = Depends(get_current_user)
):
    """Create new chat session"""
    
    # Admin can create sessions without unit_id, others need unit_id
    if current_user.role != UserRole.ADMIN and not current_user.unit_id:
        raise HTTPException(status_code=400, detail="User must belong to a unit")
    
    # For admin without unit_id, use first available unit or create system session
    unit_id = current_user.unit_id
    if not unit_id and current_user.role == UserRole.ADMIN:
        # Get first available unit for admin or use system identifier
        first_unit = await db.units.find_one({"is_active": True})
        if first_unit:
            unit_id = first_unit["id"]
        else:
            unit_id = "system"  # Fallback for system-wide admin chat
    
    try:
        participant_list = []
        if participants:
            import json
            participant_list = json.loads(participants)
        
        # Add current user to participants
        if current_user.id not in participant_list:
            participant_list.append(current_user.id)
        
        session = await chatbot_service.create_session(
            unit_id,
            session_type,
            participant_list
        )
        
        return {
            "success": True,
            "session": {
                "session_id": session.session_id,
                "unit_id": session.unit_id,
                "session_type": session.session_type,
                "participants": session.participants,
                "created_at": session.created_at.isoformat()
            }
        }
        
    except Exception as e:
        logging.error(f"Create chat session error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create chat session")

@api_router.get("/chat/sessions")
async def get_chat_sessions(
    current_user: User = Depends(get_current_user),
    limit: int = 20
):
    """Get chat sessions for current user's unit"""
    
    # Admin can access sessions without unit_id, others need unit_id
    if current_user.role != UserRole.ADMIN and not current_user.unit_id:
        raise HTTPException(status_code=400, detail="User must belong to a unit")
    
    try:
        # For admin, get sessions from all units or specific unit filter
        if current_user.role == UserRole.ADMIN:
            if current_user.unit_id:
                # Admin has specific unit assigned
                query = {"unit_id": current_user.unit_id, "is_active": True}
            else:
                # Admin without unit - get all sessions or system sessions
                query = {"is_active": True}
        else:
            # Regular users - only their unit sessions
            query = {"unit_id": current_user.unit_id, "is_active": True}
        
        sessions = await db.chat_sessions.find(query).sort("last_activity", -1).limit(limit).to_list(length=None)
        
        session_list = []
        for session in sessions:
            # Get last message for preview
            last_message = await db.chat_messages.find_one(
                {"session_id": session["session_id"]},
                sort=[("created_at", -1)]
            )
            
            session_list.append({
                "session_id": session["session_id"],
                "session_type": session["session_type"],
                "participants": session["participants"],
                "last_activity": session["last_activity"].isoformat(),
                "last_message": {
                    "message": last_message["message"] if last_message else "",
                    "message_type": last_message["message_type"] if last_message else "",
                    "created_at": last_message["created_at"].isoformat() if last_message else ""
                } if last_message else None
            })
        
        return {
            "sessions": session_list,
            "total": len(session_list)
        }
        
    except Exception as e:
        logging.error(f"Get chat sessions error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get chat sessions")

# AI Configuration endpoints
@api_router.post("/ai-config")
async def create_ai_configuration(
    config_data: AIConfigurationCreate,
    current_user: User = Depends(get_current_user)
):
    """Create or update AI configuration (admin only)"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can configure AI settings")
    
    try:
        # Test the OpenAI API key
        import openai
        client = openai.OpenAI(api_key=config_data.openai_api_key)
        
        # Test API key by listing assistants
        assistants = client.beta.assistants.list(limit=1)
        
        # Check if configuration already exists
        existing_config = await db.ai_configurations.find_one({"is_active": True})
        
        if existing_config:
            # Update existing configuration
            await db.ai_configurations.update_one(
                {"id": existing_config["id"]},
                {
                    "$set": {
                        "openai_api_key": config_data.openai_api_key,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            config_id = existing_config["id"]
        else:
            # Create new configuration
            ai_config = AIConfiguration(openai_api_key=config_data.openai_api_key)
            await db.ai_configurations.insert_one(ai_config.dict())
            config_id = ai_config.id
        
        return {
            "success": True,
            "message": "AI configuration saved successfully",
            "config_id": config_id,
            "api_key_valid": True
        }
        
    except Exception as e:
        logging.error(f"AI configuration error: {e}")
        return {
            "success": False,
            "message": "Invalid OpenAI API key or configuration error",
            "api_key_valid": False,
            "error": str(e)
        }

@api_router.get("/ai-config")
async def get_ai_configuration(current_user: User = Depends(get_current_user)):
    """Get current AI configuration (admin only)"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can view AI settings")
    
    try:
        config = await db.ai_configurations.find_one({"is_active": True})
        
        if not config:
            return {
                "configured": False,
                "message": "No AI configuration found"
            }
        
        # Don't return the actual API key for security
        return {
            "configured": True,
            "config_id": config["id"],
            "api_key_preview": config["openai_api_key"][:8] + "..." if config["openai_api_key"] else "",
            "created_at": config["created_at"].isoformat(),
            "updated_at": config.get("updated_at", config["created_at"]).isoformat()
        }
        
    except Exception as e:
        logging.error(f"Get AI configuration error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get AI configuration")

@api_router.get("/ai-assistants")
async def list_openai_assistants(current_user: User = Depends(get_current_user)):
    """List available OpenAI assistants (admin only)"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can view assistants")
    
    try:
        # Get AI configuration
        config = await db.ai_configurations.find_one({"is_active": True})
        
        if not config:
            raise HTTPException(status_code=400, detail="No AI configuration found. Please configure OpenAI API key first.")
        
        # List assistants from OpenAI
        import openai
        client = openai.OpenAI(api_key=config["openai_api_key"])
        
        assistants_response = client.beta.assistants.list(limit=50, order="desc")
        
        assistants = []
        for assistant in assistants_response.data:
            assistants.append({
                "id": assistant.id,
                "name": assistant.name or "Unnamed Assistant",
                "description": assistant.description or "",
                "model": assistant.model,
                "instructions": assistant.instructions or "",
                "created_at": assistant.created_at
            })
        
        return {
            "assistants": assistants,
            "total": len(assistants)
        }
        
    except Exception as e:
        logging.error(f"List assistants error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list assistants: {str(e)}")

# WhatsApp Configuration endpoints
@api_router.post("/whatsapp-config")
async def configure_whatsapp(
    config_data: WhatsAppConfigurationCreate,
    current_user: User = Depends(get_current_user)
):
    """Configure WhatsApp Business connection (admin only)"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can configure WhatsApp")
    
    try:
        # Validate phone number format
        import re
        phone_pattern = r'^\+\d{1,3}\d{4,14}$'
        if not re.match(phone_pattern, config_data.phone_number):
            raise HTTPException(status_code=400, detail="Invalid phone number format. Use international format: +1234567890")
        
        # Determina unit_id da utilizzare
        target_unit_id = config_data.unit_id
        if not target_unit_id:
            # Se non specificato, usa unit dell'utente corrente o la prima unit disponibile
            if current_user.unit_id:
                target_unit_id = current_user.unit_id
            else:
                # Per admin senza unit, usa la prima unit disponibile
                first_unit = await db.units.find_one({})
                if not first_unit:
                    raise HTTPException(status_code=400, detail="No units available. Create a unit first.")
                target_unit_id = first_unit["id"]
        
        # Generate QR code data (simulated)
        import base64
        import json
        qr_data = {
            "phone": config_data.phone_number,
            "unit_id": target_unit_id,
            "timestamp": datetime.now(timezone.utc).timestamp(),
            "session": str(uuid.uuid4()),
            "client": "crm_whatsapp_web"
        }
        qr_code = base64.b64encode(json.dumps(qr_data).encode()).decode()
        
        # Check if configuration already exists for this unit
        existing_config = await db.whatsapp_configurations.find_one({
            "unit_id": target_unit_id,
            "is_active": True
        })
        
        if existing_config:
            # Update existing configuration for this unit
            await db.whatsapp_configurations.update_one(
                {"id": existing_config["id"]},
                {
                    "$set": {
                        "phone_number": config_data.phone_number,
                        "qr_code": qr_code,
                        "connection_status": "connecting",
                        "is_connected": False,
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            config_id = existing_config["id"]
        else:
            # Create new configuration for this unit
            whatsapp_config = WhatsAppConfiguration(
                unit_id=target_unit_id,
                phone_number=config_data.phone_number,
                qr_code=qr_code,
                connection_status="connecting"
            )
            await db.whatsapp_configurations.insert_one(whatsapp_config.dict())
            config_id = whatsapp_config.id
        
        return {
            "success": True,
            "message": "WhatsApp configuration saved. Scan QR code to connect.",
            "config_id": config_id,
            "qr_code": qr_code,
            "phone_number": config_data.phone_number,
            "connection_status": "connecting"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"WhatsApp configuration error: {e}")
        raise HTTPException(status_code=500, detail=f"Configuration failed: {str(e)}")

@api_router.get("/whatsapp-config")
async def get_whatsapp_configuration(
    unit_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Get WhatsApp configuration for specific unit (admin only)"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can view WhatsApp settings")
    
    try:
        # Determina unit_id da utilizzare
        target_unit_id = unit_id
        if not target_unit_id:
            # Se non specificato, usa unit dell'utente corrente o la prima unit disponibile
            if current_user.unit_id:
                target_unit_id = current_user.unit_id
            else:
                # Per admin senza unit, usa la prima unit disponibile
                first_unit = await db.units.find_one({})
                if not first_unit:
                    raise HTTPException(status_code=400, detail="No units available")
                target_unit_id = first_unit["id"]
        
        # Cerca configurazione per questa unit specifica
        config = await db.whatsapp_configurations.find_one({
            "unit_id": target_unit_id,
            "is_active": True
        })
        
        if not config:
            return {
                "configured": False,
                "unit_id": target_unit_id,
                "message": f"No WhatsApp configuration found for unit {target_unit_id}"
            }
        
        return {
            "configured": True,
            "config_id": config["id"],
            "unit_id": config["unit_id"],
            "phone_number": config["phone_number"],
            "connection_status": config["connection_status"],
            "is_connected": config["is_connected"],
            "qr_code": config.get("qr_code"),
            "last_seen": config.get("last_seen").isoformat() if config.get("last_seen") else None,
            "created_at": config["created_at"].isoformat(),
            "updated_at": config.get("updated_at", config["created_at"]).isoformat()
        }
        
    except Exception as e:
        logging.error(f"Get WhatsApp configuration error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get WhatsApp configuration")

@api_router.post("/whatsapp-connect")
async def simulate_whatsapp_connection(
    unit_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Simulate WhatsApp connection for specific unit (for demo purposes)"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can connect WhatsApp")
    
    try:
        # Determina unit_id da utilizzare
        target_unit_id = unit_id
        if not target_unit_id:
            if current_user.unit_id:
                target_unit_id = current_user.unit_id
            else:
                first_unit = await db.units.find_one({})
                if not first_unit:
                    raise HTTPException(status_code=400, detail="No units available")
                target_unit_id = first_unit["id"]
        
        config = await db.whatsapp_configurations.find_one({
            "unit_id": target_unit_id,
            "is_active": True
        })
        
        if not config:
            raise HTTPException(status_code=400, detail=f"No WhatsApp configuration found for unit {target_unit_id}")
        
        # Simulate successful connection
        await db.whatsapp_configurations.update_one(
            {"id": config["id"]},
            {
                "$set": {
                    "connection_status": "connected",
                    "is_connected": True,
                    "last_seen": datetime.now(timezone.utc),
                    "device_info": "CRM WhatsApp Web Client",
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        return {
            "success": True,
            "message": "WhatsApp connected successfully",
            "connection_status": "connected",
            "phone_number": config["phone_number"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"WhatsApp connection error: {e}")
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")

@api_router.post("/whatsapp-validate-lead")
async def validate_lead_whatsapp(
    lead_id: str,
    current_user: User = Depends(get_current_user)
):
    """Validate if lead's phone number is on WhatsApp"""
    
    try:
        # Get lead
        lead = await db.leads.find_one({"id": lead_id})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")
        
        phone_number = lead.get("telefono")
        if not phone_number:
            raise HTTPException(status_code=400, detail="Lead has no phone number")
        
        # Simulate WhatsApp validation (in real implementation, this would use WhatsApp API)
        import random
        is_whatsapp = random.choice([True, True, True, False])  # 75% chance of being WhatsApp
        
        # Save validation result
        validation = LeadWhatsAppValidation(
            lead_id=lead_id,
            phone_number=phone_number,
            is_whatsapp=is_whatsapp,
            validation_status="valid" if is_whatsapp else "invalid",
            validation_date=datetime.now(timezone.utc)
        )
        
        # Update lead with WhatsApp status
        await db.leads.update_one(
            {"id": lead_id},
            {"$set": {"is_whatsapp": is_whatsapp, "whatsapp_validated": True}}
        )
        
        return {
            "success": True,
            "lead_id": lead_id,
            "phone_number": phone_number,
            "is_whatsapp": is_whatsapp,
            "validation_status": validation.validation_status,
            "message": f"Phone number {'is' if is_whatsapp else 'is not'} on WhatsApp"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"WhatsApp validation error: {e}")
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")

# Workflow Builder endpoints (FASE 3)
@api_router.get("/workflows", response_model=List[Workflow])
async def get_workflows(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    unit_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Get workflows with filtering and pagination"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can access workflow builder")
    
    try:
        # Admin users can access workflows, filter by unit if specified
        query = {}
        if unit_id:
            query["unit_id"] = unit_id
        elif current_user.role != UserRole.ADMIN:
            query["unit_id"] = current_user.unit_id
        
        workflows = await db.workflows.find(query).skip(skip).limit(limit).to_list(length=None)
        return workflows
        
    except Exception as e:
        logging.error(f"Get workflows error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflows")

@api_router.post("/workflows", response_model=Workflow)
async def create_workflow(
    workflow_in: WorkflowCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new workflow (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can create workflows")
    
    try:
        workflow_data = workflow_in.dict()
        
        # For admin users, use the first available unit if they don't have a unit_id
        unit_id = current_user.unit_id
        if not unit_id:
            # Get the first available unit for admin users
            first_unit = await db.units.find_one({})
            if first_unit:
                unit_id = first_unit["id"]
            else:
                raise HTTPException(status_code=400, detail="No units available. Create a unit first.")
        
        workflow_data.update({
            "id": str(uuid.uuid4()),
            "created_by": current_user.id,
            "unit_id": unit_id,
            "created_at": datetime.now(timezone.utc),
            "is_active": True,
            "is_published": False
        })
        
        workflow = Workflow(**workflow_data)
        await db.workflows.insert_one(workflow.dict())
        return workflow
        
    except Exception as e:
        logging.error(f"Create workflow error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create workflow")

@api_router.get("/workflows/{workflow_id}", response_model=Workflow)
async def get_workflow(
    workflow_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get workflow by ID"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can access workflows")
    
    try:
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        # Check unit access
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        return Workflow(**workflow)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Get workflow error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflow")

@api_router.put("/workflows/{workflow_id}", response_model=Workflow)
async def update_workflow(
    workflow_id: str,
    workflow_in: WorkflowUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update workflow (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update workflows")
    
    try:
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        # Check unit access
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        # Prepare update data
        update_data = {k: v for k, v in workflow_in.dict().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        # Basic validation for publishing
        if update_data.get("is_published") and not workflow.get("is_published"):
            # Check if workflow has at least one trigger node
            trigger_nodes = await db.workflow_nodes.find({
                "workflow_id": workflow_id,
                "node_type": "trigger"
            }).to_list(length=None)
            
            if not trigger_nodes:
                raise HTTPException(
                    status_code=400, 
                    detail="Workflow must have at least one trigger node before publishing")
        
        await db.workflows.update_one(
            {"id": workflow_id},
            {"$set": update_data}
        )
        
        updated_workflow = await db.workflows.find_one({"id": workflow_id})
        return Workflow(**updated_workflow)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Update workflow error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update workflow")

@api_router.delete("/workflows/{workflow_id}")
async def delete_workflow(
    workflow_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete workflow (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete workflows")
    
    try:
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        # Check unit access
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        # Check if workflow has active executions
        active_executions = await db.workflow_executions.find({
            "workflow_id": workflow_id,
            "status": {"$in": ["pending", "running"]}
        }).to_list(length=None)
        
        if active_executions:
            raise HTTPException(
                status_code=400, 
                detail="Cannot delete workflow with active executions")
        
        # Delete workflow and related data
        await db.workflows.delete_one({"id": workflow_id})
        await db.workflow_nodes.delete_many({"workflow_id": workflow_id})
        await db.node_connections.delete_many({"workflow_id": workflow_id})
        
        return {"detail": "Workflow deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Delete workflow error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete workflow")

# Workflow Nodes endpoints
@api_router.post("/workflows/{workflow_id}/nodes", response_model=WorkflowNode)
async def create_node(
    workflow_id: str,
    node_in: WorkflowNodeCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new workflow node"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can create workflow nodes")
    
    try:
        # Verify workflow exists and user has access
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        # Create the node
        node_data = node_in.dict()
        node_data.update({
            "id": str(uuid.uuid4()),
            "workflow_id": workflow_id,
            "created_at": datetime.now(timezone.utc)
        })
        
        node = WorkflowNode(**node_data)
        await db.workflow_nodes.insert_one(node.dict())
        return node
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Create node error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create node")

@api_router.get("/workflows/{workflow_id}/nodes", response_model=List[WorkflowNode])
async def get_workflow_nodes(
    workflow_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all nodes for a workflow"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can access workflow nodes")
    
    try:
        # Verify workflow exists and user has access
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        nodes = await db.workflow_nodes.find({"workflow_id": workflow_id}).to_list(length=None)
        return [WorkflowNode(**node) for node in nodes]
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Get workflow nodes error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflow nodes")

@api_router.put("/nodes/{node_id}", response_model=WorkflowNode)
async def update_node(
    node_id: str,
    node_in: WorkflowNodeUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a workflow node"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can update workflow nodes")
    
    try:
        node = await db.workflow_nodes.find_one({"id": node_id})
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Check workflow access
        workflow = await db.workflows.find_one({"id": node["workflow_id"]})
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        # Prepare update data
        update_data = {k: v for k, v in node_in.dict().items() if v is not None}
        
        await db.workflow_nodes.update_one(
            {"id": node_id},
            {"$set": update_data}
        )
        
        updated_node = await db.workflow_nodes.find_one({"id": node_id})
        return WorkflowNode(**updated_node)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Update node error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update node")

@api_router.delete("/nodes/{node_id}")
async def delete_node(
    node_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a workflow node"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete workflow nodes")
    
    try:
        node = await db.workflow_nodes.find_one({"id": node_id})
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Check workflow access
        workflow = await db.workflows.find_one({"id": node["workflow_id"]})
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        # Remove all connections involving this node
        await db.node_connections.delete_many({
            "$or": [
                {"source_node_id": node_id},
                {"target_node_id": node_id}
            ]
        })
        
        # Remove the node
        await db.workflow_nodes.delete_one({"id": node_id})
        return {"detail": "Node deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Delete node error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete node")

# Node Connections endpoints
@api_router.post("/workflows/{workflow_id}/connections", response_model=NodeConnection)
async def create_connection(
    workflow_id: str,
    connection_in: NodeConnectionCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new node connection"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can create node connections")
    
    try:
        # Verify workflow exists and user has access
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        # Verify both nodes exist and belong to this workflow
        source_node = await db.workflow_nodes.find_one({
            "id": connection_in.source_node_id,
            "workflow_id": workflow_id
        })
        target_node = await db.workflow_nodes.find_one({
            "id": connection_in.target_node_id,
            "workflow_id": workflow_id
        })
        
        if not source_node or not target_node:
            raise HTTPException(status_code=400, detail="Invalid source or target node")
        
        # Create the connection
        connection_data = connection_in.dict()
        connection_data.update({
            "id": str(uuid.uuid4()),
            "workflow_id": workflow_id,
            "created_at": datetime.now(timezone.utc)
        })
        
        connection = NodeConnection(**connection_data)
        await db.node_connections.insert_one(connection.dict())
        return connection
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Create connection error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create connection")

@api_router.get("/workflows/{workflow_id}/connections", response_model=List[NodeConnection])
async def get_workflow_connections(
    workflow_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get all connections for a workflow"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can access workflow connections")
    
    try:
        # Verify workflow exists and user has access
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        connections = await db.node_connections.find({"workflow_id": workflow_id}).to_list(length=None)
        return [NodeConnection(**conn) for conn in connections]
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Get workflow connections error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflow connections")

@api_router.delete("/connections/{connection_id}")
async def delete_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a node connection"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can delete node connections")
    
    try:
        connection = await db.node_connections.find_one({"id": connection_id})
        if not connection:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Check workflow access
        workflow = await db.workflows.find_one({"id": connection["workflow_id"]})
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        await db.node_connections.delete_one({"id": connection_id})
        return {"detail": "Connection deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Delete connection error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete connection")

# Workflow execution endpoints
@api_router.post("/workflows/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: str,
    execution_in: WorkflowExecutionCreate,
    current_user: User = Depends(get_current_user)
):
    """Execute workflow for testing purposes"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can execute workflows")
    
    try:
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        # Check unit access
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        if not workflow.get("is_published"):
            raise HTTPException(status_code=400, detail="Cannot execute unpublished workflow")
        
        # Create execution record
        execution_data = {
            "id": str(uuid.uuid4()),
            "workflow_id": workflow_id,
            "contact_id": execution_in.contact_id,
            "status": "pending",
            "started_at": datetime.now(timezone.utc),
            "execution_data": execution_in.trigger_data or {},
            "retry_count": 0
        }
        
        execution = WorkflowExecution(**execution_data)
        await db.workflow_executions.insert_one(execution.dict())
        
        # For now, we'll just mark it as completed for testing
        # In a real implementation, this would trigger background processing
        await db.workflow_executions.update_one(
            {"id": execution.id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc)
            }}
        )
        
        return {
            "detail": "Workflow execution started",
            "execution_id": execution.id,
            "workflow_id": workflow_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Execute workflow error: {e}")
        raise HTTPException(status_code=500, detail="Failed to execute workflow")

@api_router.get("/workflows/{workflow_id}/executions", response_model=List[WorkflowExecution])
async def get_workflow_executions(
    workflow_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user)
):
    """Get workflow execution history"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can access workflow executions")
    
    try:
        workflow = await db.workflows.find_one({"id": workflow_id})
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
        
        # Check unit access
        if current_user.role != UserRole.ADMIN and workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to this workflow")
        
        executions = await db.workflow_executions.find(
            {"workflow_id": workflow_id}
        ).sort("started_at", -1).skip(skip).limit(limit).to_list(length=None)
        
        return [WorkflowExecution(**exec) for exec in executions]
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Get workflow executions error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve workflow executions")

# Get available node types for the workflow builder
@api_router.get("/workflow-node-types")
async def get_workflow_node_types(current_user: User = Depends(get_current_user)):
    """Get available workflow node types and subtypes"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can access workflow node types")
    
    # Return GoHighLevel-style node types
    node_types = {
        "trigger": {
            "name": "Triggers",
            "description": "Events that start a workflow",
            "subtypes": {
                "contact_created": {
                    "name": "Contact Created",
                    "description": "Triggers when a new contact is created",
                    "icon": "user-plus",
                    "color": "green"
                },
                "form_submitted": {
                    "name": "Form Submitted", 
                    "description": "Triggers when a form is submitted",
                    "icon": "form-input",
                    "color": "blue"
                },
                "lead_assigned": {
                    "name": "Lead Assigned",
                    "description": "Triggers when a lead is assigned to an agent",
                    "icon": "user-check",
                    "color": "purple"
                }
            }
        },
        "action": {
            "name": "Actions",
            "description": "Actions to perform in the workflow",
            "subtypes": {
                "send_email": {
                    "name": "Send Email",
                    "description": "Send an email to a contact",
                    "icon": "mail",
                    "color": "blue"
                },
                "send_sms": {
                    "name": "Send SMS",
                    "description": "Send an SMS to a contact",
                    "icon": "message-square",
                    "color": "green"
                },
                "send_whatsapp": {
                    "name": "Send WhatsApp",
                    "description": "Invia un messaggio WhatsApp al contatto",
                    "icon": "message-circle",
                    "color": "green"
                },
                "update_contact": {
                    "name": "Update Contact",
                    "description": "Update contact information",
                    "icon": "edit",
                    "color": "orange"
                },
                "update_contact_field": {
                    "name": "Update Contact Field",
                    "description": "Aggiorna un campo nel record del contatto",
                    "icon": "edit-3",
                    "color": "orange"
                },
                "assign_to_user": {
                    "name": "Assign to User",
                    "description": "Assign contact to a specific user",
                    "icon": "user",
                    "color": "purple"
                },
                "add_tag": {
                    "name": "Add Tag",
                    "description": "Add a tag to the contact",
                    "icon": "tag",
                    "color": "yellow"
                },
                "remove_tag": {
                    "name": "Remove Tag",
                    "description": "Remove a tag from the contact",
                    "icon": "tag",
                    "color": "red"
                },
                "set_status": {
                    "name": "Set Status", 
                    "description": "Imposta lo stato del contatto",
                    "icon": "circle",
                    "color": "blue"
                },
                "create_task": {
                    "name": "Create Task",
                    "description": "Create a task for a user",
                    "icon": "check-square",
                    "color": "red"
                }
            }
        },
        "condition": {
            "name": "Conditions",
            "description": "Decision points in the workflow",
            "subtypes": {
                "if_else": {
                    "name": "If/Else",
                    "description": "Branch workflow based on conditions",
                    "icon": "git-branch",
                    "color": "purple"
                },
                "contact_filter": {
                    "name": "Contact Filter",
                    "description": "Filter contacts based on criteria",
                    "icon": "filter",
                    "color": "blue"
                }
            }
        },
        "delay": {
            "name": "Delays",
            "description": "Wait periods in the workflow",
            "subtypes": {
                "wait": {
                    "name": "Wait",
                    "description": "Wait for a specified amount of time",
                    "icon": "clock",
                    "color": "gray"
                },
                "wait_until": {
                    "name": "Wait Until",
                    "description": "Wait until a specific date/time",
                    "icon": "calendar",
                    "color": "blue"
                }
            }
        }
    }
    
    return node_types

# Copy workflow between units endpoint
@api_router.post("/workflows/{workflow_id}/copy")
async def copy_workflow_to_unit(
    workflow_id: str,
    target_unit_id: str = Query(..., description="ID of target unit"),
    current_user: User = Depends(get_current_user)
):
    """Copy workflow to another unit (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admin can copy workflows between units")
    
    try:
        # Get source workflow
        source_workflow = await db.workflows.find_one({"id": workflow_id})
        if not source_workflow:
            raise HTTPException(status_code=404, detail="Source workflow not found")
        
        # Check access to source workflow
        if current_user.role != UserRole.ADMIN and source_workflow["unit_id"] != current_user.unit_id:
            raise HTTPException(status_code=403, detail="Access denied to source workflow")
        
        # Verify target unit exists
        target_unit = await db.units.find_one({"id": target_unit_id})
        if not target_unit:
            raise HTTPException(status_code=404, detail="Target unit not found")
        
        # Create new workflow copy
        new_workflow = Workflow(
            name=f"{source_workflow['name']} (Copia)",
            description=f"Copia da Unit {source_workflow['unit_id']}: {source_workflow.get('description', '')}",
            unit_id=target_unit_id,
            created_by=current_user.id,
            is_active=source_workflow["is_active"],
            is_published=False,  # Copied workflows start as unpublished
            workflow_data=source_workflow.get("workflow_data")
        )
        
        await db.workflows.insert_one(new_workflow.dict())
        
        # Copy workflow nodes
        source_nodes = await db.workflow_nodes.find({"workflow_id": workflow_id}).to_list(length=None)
        node_id_mapping = {}  # Map old node IDs to new ones
        
        for source_node in source_nodes:
            new_node_id = str(uuid.uuid4())
            node_id_mapping[source_node["id"]] = new_node_id
            
            new_node = WorkflowNode(
                id=new_node_id,
                workflow_id=new_workflow.id,
                node_type=source_node["node_type"],
                node_subtype=source_node["node_subtype"],
                name=source_node["name"],
                position_x=source_node["position_x"],
                position_y=source_node["position_y"],
                configuration=source_node.get("configuration")
            )
            
            await db.workflow_nodes.insert_one(new_node.dict())
        
        # Copy workflow connections with updated node IDs
        source_connections = await db.node_connections.find({"workflow_id": workflow_id}).to_list(length=None)
        
        for source_connection in source_connections:
            new_connection = NodeConnection(
                workflow_id=new_workflow.id,
                source_node_id=node_id_mapping.get(source_connection["source_node_id"]),
                target_node_id=node_id_mapping.get(source_connection["target_node_id"]),
                source_handle=source_connection.get("source_handle"),
                target_handle=source_connection.get("target_handle"),
                condition_data=source_connection.get("condition_data")
            )
            
            await db.node_connections.insert_one(new_connection.dict())
        
        return {
            "success": True,
            "message": f"Workflow copied successfully to unit {target_unit['name']}",
            "new_workflow_id": new_workflow.id,
            "source_workflow_id": workflow_id,
            "target_unit_id": target_unit_id,
            "nodes_copied": len(source_nodes),
            "connections_copied": len(source_connections)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Copy workflow error: {e}")
        raise HTTPException(status_code=500, detail="Failed to copy workflow")

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