from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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

class Container(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    unit_id: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ContainerCreate(BaseModel):
    name: str
    unit_id: str

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
    
    # TODO: Send email notification to agent
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
async def get_users(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        users = await db.users.find().to_list(length=None)
    elif current_user.role == UserRole.REFERENTE:
        # Referente can see their agents
        users = await db.users.find({
            "$or": [
                {"id": current_user.id},
                {"referente_id": current_user.id}
            ]
        }).to_list(length=None)
    else:
        # Agents can only see themselves
        users = await db.users.find({"id": current_user.id}).to_list(length=None)
    
    return [User(**user) for user in users]

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
    
    # Apply filters
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
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    stats = {}
    
    if current_user.role == UserRole.ADMIN:
        stats["total_leads"] = await db.leads.count_documents({})
        stats["total_users"] = await db.users.count_documents({})
        stats["total_units"] = await db.units.count_documents({})
        stats["leads_today"] = await db.leads.count_documents({
            "created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
        })
    elif current_user.role == UserRole.REFERENTE:
        agents = await db.users.find({"referente_id": current_user.id}).to_list(length=None)
        agent_ids = [agent["id"] for agent in agents]
        stats["my_agents"] = len(agent_ids)
        stats["total_leads"] = await db.leads.count_documents({"assigned_agent_id": {"$in": agent_ids}})
        stats["leads_today"] = await db.leads.count_documents({
            "assigned_agent_id": {"$in": agent_ids},
            "created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
        })
    else:  # Agent
        stats["my_leads"] = await db.leads.count_documents({"assigned_agent_id": current_user.id})
        stats["leads_today"] = await db.leads.count_documents({
            "assigned_agent_id": current_user.id,
            "created_at": {"$gte": datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
        })
        stats["contacted_leads"] = await db.leads.count_documents({
            "assigned_agent_id": current_user.id,
            "esito": {"$ne": None}
        })
    
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
            "email": "admin@crm.local",
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