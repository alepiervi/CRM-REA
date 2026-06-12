import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";

// React Flow imports for drag-and-drop workflow builder
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Charts and date utilities
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

// Shadcn components
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Switch } from "../components/ui/switch";
import { useToast } from "../hooks/use-toast";
import { Toaster } from "../components/ui/toaster";
import ClienteCustomFieldsManager from "../components/ClienteCustomFieldsManager";
import {
  useClienteCustomFields,
  useClienteStatusOptions,
  CustomFieldsSection,
  CustomFieldsViewSection,
  validateRequiredCustomFields,
} from "../components/CustomFieldsRenderer";
import {
  useClienteLock,
  ClienteLockedScreen,
  useActiveClienteLocks,
} from "../components/ClienteLock";
import { ClienteNotesHistory } from "../components/ClienteNotesHistory";
import { PermissionsAudit } from "../components/PermissionsAudit";
import { PostVendita } from "../components/PostVendita";
import { PassToPostVenditaButton } from "../components/PassToPostVenditaButton";
import { PostVenditaStatusDot } from "../components/PostVenditaStatusDot";
import { ClientePostVenditaSection } from "../components/ClientePostVenditaSection";
import { MultiSelectFilter } from "../components/MultiSelectFilter";
import { SpokiAdminConfig } from "../components/spoki/SpokiAdminConfig";
import { AppointmentsCalendar } from "../components/spoki/AppointmentsCalendar";
import { AIConversations } from "../components/spoki/AIConversations";
import { LeadConversationsTab } from "../components/spoki/LeadConversationsTab";
import { WorkflowFoldersSidebar } from "../components/workflow/WorkflowFoldersSidebar";
import { WorkflowTestModeDialog } from "../components/workflow/WorkflowTestModeDialog";
import { TemplatePreviewDialog } from "../components/workflow/TemplatePreviewDialog";
import { TagsManager } from "../components/tags/TagsManager";

// Lucide icons
import { 
  Users, 
  User,
  Building2, 
  Phone, 
  Mail, 
  Calendar, 
  FlaskConical,
  CheckSquare,
  GitBranch,
  CornerDownRight,
  MessageSquare,
  BarChart3, 
  Settings,
  Database,
  LogOut, 
  Plus,
  PlusIcon,
  UserPlus,
  Eye,
  EyeOff,
  Search,
  Download,
  Cog,
  MapPin,
  Home,
  Clock,
  CheckCircle,
  XCircle,
  Tag,
  AlertCircle,
  Menu,
  Power,
  PowerOff,
  ChevronDown,
  ChevronUp,
  Edit,
  Edit2,
  Trash2,
  Save,
  Upload,
  FileText,
  TrendingUp,
  Target,
  MessageCircle,
  Send,
  Copy,
  PenTool,
  X,
  Workflow,
  ArrowLeft,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Headphones,
  Activity,
  Bot,
  Timer,
  Award,
  Clock4,
  UserCheck,
  UserX,
  Radio,
  PlayCircle,
  StopCircle,
  Volume2,
  Building,
  Store,
  ShieldCheck,
  ShieldAlert,
  Package,
  Users2,
  Briefcase,
  Settings2,
  FileUser,
  FileSpreadsheet,
  CheckCircle2,
  Progress,
  Star,
  History,
  Zap,
  CreditCard,
  Smartphone,
  FolderOpen,
  Lock,
  Filter,
  RefreshCw,
  Archive,
  RotateCcw
} from "lucide-react";

// Utilities e Auth estratti in moduli dedicati (refactoring giugno 2026)
import {
  BACKEND_URL,
  API,
  PROVINCE_ITALIANE,
  formatDate,
  normalizeProvinceName,
  provinciaMatches,
  formatClienteStatus,
  getClienteStatusVariant,
} from "../lib/appUtils";
import { AuthContext, useAuth, AuthProvider } from "../context/AuthContext";


// ===================================================================
// Componenti estratti da App.js (refactoring giugno 2026)
// ===================================================================

const CreateClienteModal = ({ isOpen, onClose, onSubmit, commesse, subAgenzie, selectedCommessa, user }) => {
  const { toast } = useToast();
  
  // NEW: Custom fields hook state
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [selectedCommessaForCF, setSelectedCommessaForCF] = useState('');
  const [selectedTipologiaForCF, setSelectedTipologiaForCF] = useState('');
  const { fields: customFields, sections: customSections } = useClienteCustomFields(selectedCommessaForCF, selectedTipologiaForCF);
  
  // ENUM MAPPING FUNCTIONS - Convert UUID or display values to backend enum format
  const mapTipologiaContratto = (uuidOrDisplayValue) => {
    // First, check if it's a UUID - if so, convert to display name using cascadeTipologie
    let displayValue = uuidOrDisplayValue;
    
    // If it looks like a UUID (contains hyphens), find the display name
    if (typeof uuidOrDisplayValue === 'string' && uuidOrDisplayValue.includes('-')) {
      const tipologia = cascadeTipologie?.find(t => t.id === uuidOrDisplayValue);
      if (tipologia) {
        displayValue = tipologia.nome;
        console.log(`🔄 UUID → Display: ${uuidOrDisplayValue} → ${displayValue}`);
      }
    }
    
    // Clean the display value and convert to backend enum
    const cleanDisplayValue = (displayValue || '').toString().trim();
    
    const mappings = {
      'Telefonia Fissa': 'telefonia_fastweb',
      'Energia': 'energia_fastweb', 
      'Ho Mobile': 'ho_mobile',
      'Telepass': 'telepass',
      'telepass_premium': 'telepass_premium',
      'telepass_basic': 'telepass_basic',
      'fotovoltaico_residenziale': 'fotovoltaico_residenziale',
      'fotovoltaico_aziendale': 'fotovoltaico_aziendale',
      'manutenzione_premium': 'manutenzione_premium',
      'manutenzione_standard': 'manutenzione_standard'
    };
    
    // Try exact match first, then case insensitive
    let enumValue = mappings[cleanDisplayValue];
    if (!enumValue) {
      // Case insensitive fallback
      const key = Object.keys(mappings).find(k => k.toLowerCase() === cleanDisplayValue.toLowerCase());
      enumValue = key ? mappings[key] : cleanDisplayValue.toLowerCase().replace(/\s+/g, '_');
    }
    
    console.log(`🎯 ENUM MAPPING: Display "${cleanDisplayValue}" → Enum: "${enumValue}"`);
    return enumValue;
  };

  const mapSegmento = (uuidOrDisplayValue) => {
    // First, check if it's a UUID - if so, convert to display name using cascadeSegmenti
    let displayValue = uuidOrDisplayValue;
    
    // If it looks like a UUID (contains hyphens), find the display name
    if (typeof uuidOrDisplayValue === 'string' && uuidOrDisplayValue.includes('-')) {
      const segmento = cascadeSegmenti?.find(s => s.id === uuidOrDisplayValue);
      if (segmento) {
        displayValue = segmento.nome;
        console.log(`🎯 ENUM MAPPING: UUID ${uuidOrDisplayValue} → Display: "${displayValue}"`);
      }
    }
    
    // Now convert display name to backend enum
    const mappings = {
      'Privato': 'privato',           // FIXED: Privato → privato
      'Business': 'business'          // Only Privato and Business supported
    };
    
    const enumValue = mappings[displayValue] || displayValue;
    console.log(`🎯 ENUM MAPPING: Display "${displayValue}" → Enum: "${enumValue}"`);
    return enumValue;
  };

  // STEP MANAGEMENT for cascading flow
  const [currentStep, setCurrentStep] = useState('initial'); // initial, filiera, cliente
  const [showClientForm, setShowClientForm] = useState(false);
  
  // SELECTION DATA for cascading
  const [selectedData, setSelectedData] = useState({
    sub_agenzia_id: '',
    commessa_id: (selectedCommessa && selectedCommessa !== 'all') ? selectedCommessa : '',
    servizio_id: '',
    tipologia_contratto: '',
    segmento: '',
    offerta_id: ''
  });

  // CASCADING DATA ARRAYS - ALWAYS INITIALIZE AS ARRAYS
  const [cascadeSubAgenzie, setCascadeSubAgenzie] = useState([]);
  const [cascadeCommesse, setCascadeCommesse] = useState([]);
  const [cascadeServizi, setCascadeServizi] = useState([]);
  const [cascadeTipologie, setCascadeTipologie] = useState([]);
  const [cascadeSegmenti, setCascadeSegmenti] = useState([]);
  const [cascadeOfferte, setCascadeOfferte] = useState([]);
  const [cascadeSubOfferte, setCascadeSubOfferte] = useState([]);  // NEW: Sub-offerte
  
  // NEW: Copy from existing client functionality
  const [showCopySearch, setShowCopySearch] = useState(false);
  const [copySearchTerm, setCopySearchTerm] = useState('');
  const [copySearchResults, setCopySearchResults] = useState([]);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  
  // Search for clients to copy from
  const searchClientsForCopy = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      setCopySearchResults([]);
      return;
    }
    
    setIsSearchingClients(true);
    try {
      const response = await axios.get(`${API}/clienti`, {
        params: { search: searchTerm, page_size: 10 }
      });
      setCopySearchResults(response.data.clienti || []);
    } catch (error) {
      console.error("Error searching clients:", error);
      setCopySearchResults([]);
    } finally {
      setIsSearchingClients(false);
    }
  };
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (copySearchTerm) {
        searchClientsForCopy(copySearchTerm);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [copySearchTerm]);
  
  // Copy client data to form (ANAGRAFICA COMPLETA + Contatti + Documento + Pagamento)
  // Copies: all identity/contact/payment/document fields
  // Explicitly EXCLUDED: contract-specific fields (ICCID, POD, tecnologia, ecc.), note, uploaded files
  const copyClientData = (cliente) => {
    console.log("📋 Copying client data:", cliente);

    // Confirm overwrite if user already typed something in copy-target fields
    const hasData = !!(
      formData.nome ||
      formData.cognome ||
      formData.ragione_sociale ||
      formData.codice_fiscale ||
      formData.partita_iva ||
      formData.telefono ||
      formData.email ||
      formData.indirizzo ||
      formData.modalita_pagamento ||
      formData.iban ||
      formData.tipo_documento ||
      formData.numero_documento
    );
    if (hasData) {
      const ok = window.confirm(
        "I campi già compilati (anagrafica, contatti, modalità di pagamento, documento) verranno sovrascritti con i dati del cliente selezionato. Continuare?"
      );
      if (!ok) return;
    }

    // Copy anagrafica completa + contatti + pagamento + documento
    setFormData(prev => ({
      ...prev,
      // Anagrafica
      ragione_sociale: cliente.ragione_sociale || '',
      cognome: cliente.cognome || '',
      nome: cliente.nome || '',
      data_nascita: cliente.data_nascita || '',
      luogo_nascita: cliente.luogo_nascita || '',
      comune_residenza: cliente.comune_residenza || '',
      provincia: cliente.provincia || '',
      cap: cliente.cap || '',
      indirizzo: cliente.indirizzo || '',
      indirizzo_attivazione: cliente.indirizzo_attivazione || '',
      comune_attivazione: cliente.comune_attivazione || '',
      provincia_attivazione: cliente.provincia_attivazione || '',
      cap_attivazione: cliente.cap_attivazione || '',
      codice_fiscale: cliente.codice_fiscale || '',
      partita_iva: cliente.partita_iva || '',
      // Contatti
      telefono: cliente.telefono || '',
      telefono2: cliente.telefono2 || '',
      email: cliente.email || '',
      // Modalità di pagamento
      modalita_pagamento: cliente.modalita_pagamento || '',
      iban: cliente.iban || '',
      intestatario_diverso: cliente.intestatario_diverso || '',
      numero_carta: cliente.numero_carta || '',
      mese_carta: cliente.mese_carta || '',
      anno_carta: cliente.anno_carta || '',
      // Documento
      tipo_documento: cliente.tipo_documento || '',
      numero_documento: cliente.numero_documento || '',
      data_rilascio: cliente.data_rilascio || '',
      luogo_rilascio: cliente.luogo_rilascio || '',
      scadenza_documento: cliente.scadenza_documento || '',
    }));

    // Close search and show success message
    setShowCopySearch(false);
    setCopySearchTerm('');
    setCopySearchResults([]);

    toast({
      title: "Dati copiati",
      description: `Anagrafica completa, contatti, modalità pagamento e documento di ${cliente.nome || ''} ${cliente.cognome || cliente.ragione_sociale || ''} copiati.`,
    });
  };
  
  // DEBUG: Log when cascade data changes
  useEffect(() => {
    console.log("🔄 Cascade data updated:", {
      tipologie: cascadeTipologie.length,
      segmenti: cascadeSegmenti.length,
      offerte: cascadeOfferte.length
    });
  }, [cascadeTipologie, cascadeSegmenti, cascadeOfferte]);
  
  // Reset cascade data when modal closes
  useEffect(() => {
    if (!isOpen) {
      console.log("🔄 Modal closed, resetting cascade data");
      setCascadeSegmenti([]);
      setCascadeOfferte([]);
      setCascadeSubOfferte([]);
      setCustomFieldValues({});
    }
  }, [isOpen]);

  // NEW: Sync custom-fields commessa/tipologia with selectedData
  useEffect(() => {
    setSelectedCommessaForCF(selectedData.commessa_id || '');
    setSelectedTipologiaForCF(selectedData.tipologia_contratto || '');
  }, [selectedData.commessa_id, selectedData.tipologia_contratto]);

  // CLIENT FORM DATA (shown after offerta selection)
  const [formData, setFormData] = useState({
    // Campi base sempre presenti
    numero_ordine: '',
    account: '',
    ragione_sociale: '', // Solo se Business
    cognome: '', // Obbligatorio
    nome: '', // Obbligatorio
    data_nascita: '',
    luogo_nascita: '',
    comune_residenza: '',
    provincia: '', // Sigla provincia
    cap: '',
    indirizzo: '',
    indirizzo_attivazione: '',
    comune_attivazione: '',
    provincia_attivazione: '',
    cap_attivazione: '',
    email: '',
    telefono: '', // Obbligatorio
    telefono2: '',
    partita_iva: '', // Solo se Business
    codice_fiscale: '', // Obbligatorio
    
    // Documento
    tipo_documento: '',
    numero_documento: '',
    data_rilascio: '',
    luogo_rilascio: '',
    scadenza_documento: '',
    
    // Campi specifici Telefonia Fissa
    tecnologia: '',
    codice_migrazione: '',
    numero_portabilita: '',
    gestore: '',
    convergenza: false,
    convergenza_items: [{
      numero_cellulare: '',
      iccid: '',
      operatore: ''
    }],
    
    // Campi specifici Energia Fastweb
    codice_pod: '',
    energia_tipologia: '',
    energia_consumo_annuo: '',
    energia_potenza_contatore: '',
    energia_potenza_impegnata: '',
    energia_fornitore_attuale: '',
    energia_vecchio_intestatario_nome: '',
    energia_vecchio_intestatario_cognome: '',
    energia_vecchio_intestatario_cf: '',
    
    // Modalità pagamento
    modalita_pagamento: '',
    iban: '',
    intestatario_diverso: '',
    numero_carta: '',
    mese_carta: '',
    anno_carta: '',
    
    // Note
    note: '',
    
    // Campo Area Manager
    sub_agenzia_id: ''
  });

  // State per gestire i campi convergenza multipli
  const [convergenzaItems, setConvergenzaItems] = useState([{
    numero_cellulare: '',
    iccid: '',
    operatore: '',
    offerta_sim: ''
  }]);

  // State per gestire i campi mobile multipli
  const [mobileItems, setMobileItems] = useState([{
    telefono_da_portare: '',
    iccid: '',
    operatore: '',
    titolare_diverso: ''
  }]);

  // Costanti per i dropdown
  const PROVINCE_ITALIANE = [
    "AG", "AL", "AN", "AO", "AR", "AP", "AT", "AV", "BA", "BT", "BL", "BN", "BG", "BI", "BO", "BZ", 
    "BS", "BR", "CA", "CL", "CB", "CI", "CE", "CT", "CZ", "CH", "CO", "CS", "CR", "KR", "CN", 
    "EN", "FM", "FE", "FI", "FG", "FC", "FR", "GE", "GO", "GR", "IM", "IS", "SP", "AQ", "LT", 
    "LE", "LC", "LI", "LO", "LU", "MC", "MN", "MS", "MT", "VS", "ME", "MI", "MO", "MB", "NA", 
    "NO", "NU", "OG", "OT", "OR", "PD", "PA", "PR", "PV", "PG", "PU", "PE", "PC", "PI", "PT", 
    "PN", "PZ", "PO", "RG", "RA", "RC", "RE", "RI", "RN", "RM", "RO", "SA", "SS", "SV", "SI", 
    "SR", "SO", "TA", "TE", "TR", "TO", "TP", "TN", "TV", "TS", "UD", "VA", "VE", "VB", "VC", 
    "VR", "VV", "VI", "VT"
  ];

  const TIPI_DOCUMENTO = [
    { value: 'carta_identita', label: "Carta d'identità" },
    { value: 'patente', label: 'Patente' },
    { value: 'passaporto', label: 'Passaporto' }
  ];

  const TECNOLOGIE = [
    { value: 'fibra', label: 'FIBRA' },
    { value: 'ngn_gpon', label: 'NGN GPON' },
    { value: 'vula', label: 'VULA' },
    { value: 'svula', label: 'SVULA' },
    { value: 'bs_nga', label: 'BS_NGA' },
    { value: 'bs_gpon', label: 'BS_GPON' },
    { value: 'adsl', label: 'ADSL' },
    { value: 'adsl_ws', label: 'ADSL_WS' },
    { value: 'fwa', label: 'FWA' }
  ];

  const MODALITA_PAGAMENTO = [
    { value: 'iban', label: 'IBAN' },
    { value: 'carta_credito', label: 'Carta di Credito' }
  ];

  // Helper functions per campi condizionali
  const isBusinessSegment = () => {
    const segmentoId = selectedData.segmento;
    const segmento = cascadeSegmenti.find(s => s.id === segmentoId);
    return segmento?.nome?.toLowerCase() === 'business';
  };

  const isTelefoniaFastweb = () => {
    const tipologiaId = selectedData.tipologia_contratto;
    const tipologia = cascadeTipologie.find(t => t.id === tipologiaId);
    
    if (!tipologia) return false;
    
    // Riconoscimento per tipologie legate alla telefonia
    const nome = tipologia.nome?.toLowerCase() || '';
    console.log("🔍 isTelefoniaFastweb DEBUG:", {
      tipologiaId,
      tipologia_nome: tipologia.nome,
      nome_lower: nome,
      result: nome.includes('telefonia') || nome.includes('mobile')
    });
    
    return nome.includes('telefonia') || 
           nome.includes('mobile') ||
           nome.includes('sim') ||
           nome.includes('voce') ||
           nome.includes('dati');
  };

  const isEnergiaFastweb = () => {
    const tipologiaId = selectedData.tipologia_contratto;
    const tipologia = cascadeTipologie.find(t => t.id === tipologiaId);
    
    if (!tipologia) return false;
    
    // Riconoscimento per tipologie legate all'energia/fotovoltaico
    const nome = tipologia.nome?.toLowerCase() || '';
    console.log("🔍 isEnergiaFastweb DEBUG:", {
      tipologiaId,
      tipologia_nome: tipologia.nome,
      nome_lower: nome,
      result: nome.includes('energia')
    });
    
    return nome.includes('energia') || 
           nome.includes('fotovoltaico') || 
           nome.includes('solare') || 
           nome.includes('pod') ||
           nome.includes('luce') ||
           nome.includes('gas');
  };

  // Funzione per verificare se la tipologia contratto contiene "Mobile"
  const isMobile = () => {
    const tipologiaId = selectedData.tipologia_contratto;
    if (!tipologiaId) return false;
    
    const tipologia = cascadeTipologie.find(t => t.id === tipologiaId);
    if (!tipologia) return false;
    
    const nome = tipologia.nome?.toLowerCase() || '';
    console.log("📱 isMobile DEBUG:", {
      tipologiaId,
      tipologia_nome: tipologia.nome,
      nome_lower: nome,
      result: nome.includes('mobile')
    });
    
    return nome.includes('mobile');
  };

  // Funzione per verificare se la tipologia contratto contiene "Ho Mobile"
  const isHoMobile = () => {
    const tipologiaId = selectedData.tipologia_contratto;
    if (!tipologiaId) return false;
    
    const tipologia = cascadeTipologie.find(t => t.id === tipologiaId);
    if (!tipologia) return false;
    
    const nome = tipologia.nome?.toLowerCase() || '';
    console.log("📱 isHoMobile DEBUG:", {
      tipologiaId,
      tipologia_nome: tipologia.nome,
      nome_lower: nome,
      result: nome.includes('ho mobile')
    });
    
    return nome.includes('ho mobile');
  };

  // Funzione per verificare se la tipologia contratto contiene "Telepass"
  const isTelepass = () => {
    const tipologiaId = selectedData.tipologia_contratto;
    if (!tipologiaId) return false;
    
    const tipologia = cascadeTipologie.find(t => t.id === tipologiaId);
    if (!tipologia) return false;
    
    const nome = tipologia.nome?.toLowerCase() || '';
    console.log("🚗 isTelepass DEBUG:", {
      tipologiaId,
      tipologia_nome: tipologia.nome,
      nome_lower: nome,
      result: nome.includes('telepass')
    });
    
    return nome.includes('telepass');
  };

  // Funzioni per gestire i campi convergenza multipli
  const addConvergenzaItem = () => {
    setConvergenzaItems([...convergenzaItems, {
      numero_cellulare: '',
      iccid: '',
      operatore: '',
      offerta_sim: ''
    }]);
  };

  const removeConvergenzaItem = (index) => {
    if (convergenzaItems.length > 1) {
      setConvergenzaItems(convergenzaItems.filter((_, i) => i !== index));
    }
  };

  const updateConvergenzaItem = (index, field, value) => {
    const updated = convergenzaItems.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    );
    setConvergenzaItems(updated);
  };

  // Funzioni per gestire i campi mobile multipli
  const addMobileItem = () => {
    setMobileItems([...mobileItems, {
      telefono_da_portare: '',
      iccid: '',
      operatore: '',
      titolare_diverso: ''
    }]);
  };

  const removeMobileItem = (index) => {
    if (mobileItems.length > 1) {
      setMobileItems(mobileItems.filter((_, i) => i !== index));
    }
  };

  const updateMobileItem = (index, field, value) => {
    const updated = mobileItems.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    );
    setMobileItems(updated);
  };

  // LEGACY STATES (keep for compatibility)
  const [servizi, setServizi] = useState([]);
  const [createTipologieContratto, setCreateTipologieContratto] = useState([]);
  const [segmenti, setSegmenti] = useState([]);

  // Determine user role and initialize flow
  useEffect(() => {
    if (!isOpen) return;
    
    console.log("👤 User role:", user?.role);
    console.log("📋 Available data:", {
      commesse: commesse?.length || 0,
      subAgenzie: subAgenzie?.length || 0,
      selectedCommessa
    });
    
    // Reset states when modal opens
    setCurrentStep('initial');
    setShowClientForm(false);
    setSelectedData({
      sub_agenzia_id: '',
      commessa_id: (selectedCommessa && selectedCommessa !== 'all') ? selectedCommessa : '',
      servizio_id: '',
      tipologia_contratto: '',
      segmento: '',
      offerta_id: ''
    });
    
    // Initialize based on user role
    initializeFlowByRole();
    
  }, [isOpen, user, selectedCommessa]);

  const initializeFlowByRole = () => {
    if (!user) return;
    
    if (user?.role === 'sub_agenzia') {
      // SUB AGENZIA FLOW: Start with commesse selection
      console.log("🏢 Sub Agenzia Flow: Starting with commesse selection");
      const commesseArray = Array.isArray(commesse) ? commesse : [];
      setCascadeCommesse(commesseArray);
      
      // If commessa is pre-selected, load servizi immediately
      if (selectedCommessa && selectedCommessa !== 'all') {
        handleCommessaSelect(selectedCommessa);
      }
    } else if (user?.role === 'responsabile_commessa' || user?.role === 'backoffice_commessa') {
      // RESPONSABILE/BACKOFFICE COMMESSA: Start with sub agenzia selection first
      console.log("👔 Responsabile/Backoffice Commessa Flow: Starting with sub agenzia selection");
      setCascadeCommesse([]); // Will be loaded after sub agenzia selection
      // Fetch authorized sub agenzie for this user
      fetchCascadeSubAgenzie();
    } else if (user?.role === 'responsabile_sub_agenzia' || user?.role === 'backoffice_sub_agenzia' || user?.role === 'agente_specializzato' || user?.role === 'operatore' || user?.role === 'responsabile_store' || user?.role === 'responsabile_presidi' || user?.role === 'store_assist' || user?.role === 'promoter_presidi' || user?.role === 'area_manager' || user?.role === 'admin') {
      // SUB AGENZIA ROLES + AGENTI + ADMIN: Start with sub agenzia selection
      console.log("👔 Sub Agenzia Flow + Agenti + Admin: Starting with sub agenzia selection");
      setCascadeCommesse([]); // Will be loaded after sub agenzia selection
      // Fetch sub agenzie for this user (Admin sees ALL, others see authorized)
      fetchCascadeSubAgenzie();
    } else {
      // FALLBACK: Default to empty arrays
      console.log("⚠️ Unknown user role, initializing empty arrays");
      setCascadeCommesse([]);
      setCascadeServizi([]);
      setCascadeTipologie([]);
      setCascadeSegmenti([]);  
      setCascadeOfferte([]);
    }
  };

  // ===== FETCH FUNCTIONS =====
  
  const fetchAreaManagerCommesse = async () => {
    try {
      console.log("🚨 AREA MANAGER DEBUG: START fetchAreaManagerCommesse");
      console.log("🚨 User role:", user?.role);
      console.log("🚨 User commesse_autorizzate:", user?.commesse_autorizzate);
      
      // CRITICAL: Use user.commesse_autorizzate directly as fallback
      if (user?.commesse_autorizzate && user.commesse_autorizzate.length > 0) {
        console.log("🚨 AREA MANAGER CRITICAL FIX: Using user.commesse_autorizzate directly");
        
        // Get all commesse from backend and filter by user authorized
        const allCommesseResponse = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/commesse`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        const allCommesse = allCommesseResponse.data || [];
        const authorizedCommesse = allCommesse.filter(commessa => 
          user.commesse_autorizzate.includes(commessa.id)
        );
        
        console.log("🚨 AREA MANAGER CRITICAL FIX: Authorized commesse:", authorizedCommesse);
        setCascadeCommesse(authorizedCommesse);
        
        // Also set sub agenzie for completeness
        const subAgenzieResponse = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/cascade/sub-agenzie`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setCascadeSubAgenzie(subAgenzieResponse.data || []);
        
        return; // Exit early with direct method
      }
      
      console.log("🌍 AREA MANAGER: Fetching all authorized sub agenzie and their commesse");
      
      // First fetch authorized sub agenzie
      const subAgenzieResponse = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/cascade/sub-agenzie`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      const authorizedSubAgenzie = subAgenzieResponse.data || [];
      console.log("🌍 AREA MANAGER: Got authorized sub agenzie:", authorizedSubAgenzie);
      setCascadeSubAgenzie(authorizedSubAgenzie);
      
      // Now fetch commesse from each sub agenzia
      const allCommesse = [];
      const commesseMap = new Map(); // To avoid duplicates
      
      for (const subAgenzia of authorizedSubAgenzie) {
        try {
          console.log(`🌍 AREA MANAGER: Fetching commesse for sub agenzia ${subAgenzia.nome} (${subAgenzia.id})`);
          const commesseResponse = await axios.get(
            `${process.env.REACT_APP_BACKEND_URL}/api/cascade/commesse-by-subagenzia/${subAgenzia.id}`, 
            {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            }
          );
          
          const subAgenziaCommesse = commesseResponse.data || [];
          console.log(`🌍 AREA MANAGER: Got ${subAgenziaCommesse.length} commesse for ${subAgenzia.nome}`);
          
          // Add commesse to map to avoid duplicates
          subAgenziaCommesse.forEach(commessa => {
            if (commessa && commessa.id && !commesseMap.has(commessa.id)) {
              commesseMap.set(commessa.id, commessa);
            }
          });
        } catch (error) {
          console.error(`❌ AREA MANAGER: Error fetching commesse for sub agenzia ${subAgenzia.id}:`, error);
        }
      }
      
      // Convert map to array
      const uniqueCommesse = Array.from(commesseMap.values());
      console.log(`🌍 AREA MANAGER: Total unique commesse found: ${uniqueCommesse.length}`);
      setCascadeCommesse(uniqueCommesse);
      
    } catch (error) {
      console.error("❌ AREA MANAGER: Error in fetchAreaManagerCommesse:", error);
      setCascadeSubAgenzie([]);
      setCascadeCommesse([]);
    }
  };

  const fetchCascadeSubAgenzie = async () => {
    try {
      console.log("🔄 FETCHING: Sub Agenzie cascade");
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/cascade/sub-agenzie`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      console.log("✅ FETCHED Sub Agenzie:", response.data);
      setCascadeSubAgenzie(response.data || []);
    } catch (error) {
      console.error("❌ ERROR fetching sub agenzie:", error);
      setCascadeSubAgenzie([]);
    }
  };

  // ===== CASCADE HANDLERS =====
  
  const handleSubAgenziaSelect = async (subAgenziaId) => {
    console.log("🏢 Sub Agenzia selected:", subAgenziaId);
    setSelectedData(prev => ({ ...prev, sub_agenzia_id: subAgenziaId }));
    
    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error("❌ No JWT token found for cascade API call");
        return;
      }
      
      // Load commesse autorizzate for this sub agenzia
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cascade/commesse-by-subagenzia/${subAgenziaId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ CASCADE API Error: ${response.status} ${response.statusText}`);
        return;
      }
      
      const commesse = await response.json();
      console.log("✅ CASCADE: Commesse loaded successfully:", commesse);
      console.log("✅ CASCADE DEBUG: Commesse array:", Array.isArray(commesse));
      console.log("✅ CASCADE DEBUG: First commessa object:", commesse[0]);
      setCascadeCommesse(Array.isArray(commesse) ? commesse : []);
      
      // Reset downstream selections
      setCascadeServizi([]);
      setCascadeTipologie([]);
      setCascadeSegmenti([]);
      setCascadeOfferte([]);
      setSelectedData(prev => ({ 
        ...prev, 
        commessa_id: '', 
        servizio_id: '', 
        tipologia_contratto: '', 
        segmento: '', 
        offerta_id: '' 
      }));
    } catch (error) {
      console.error("Error loading commesse:", error);
    }
  };

  const handleCommessaSelect = async (commessaId) => {
    console.log("📋 Commessa selected:", commessaId);
    setSelectedData(prev => ({ ...prev, commessa_id: commessaId }));
    
    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error("❌ No JWT token found for cascade API call");
        return;
      }
      
      // Load servizi filtered by BOTH sub_agenzia AND commessa
      const subAgenziaId = selectedData.sub_agenzia_id;
      if (!subAgenziaId) {
        console.error("❌ No sub_agenzia_id found - cannot load servizi");
        return;
      }
      
      // Add commessa_id as query parameter to filter servizi by both sub_agenzia and commessa
      const url = `${process.env.REACT_APP_BACKEND_URL}/api/cascade/servizi-by-sub-agenzia/${subAgenziaId}?commessa_id=${commessaId}`;
      console.log("🔍 CASCADE: Loading servizi filtered by sub_agenzia AND commessa");
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ CASCADE API Error: ${response.status} ${response.statusText}`);
        return;
      }
      
      const servizi = await response.json();
      console.log("✅ CASCADE: Servizi loaded successfully (filtered by sub_agenzia + commessa):", servizi);
      setCascadeServizi(Array.isArray(servizi) ? servizi : []);
      
      // Reset downstream selections
      setCascadeTipologie([]);
      setCascadeSegmenti([]);
      setCascadeOfferte([]);
      setSelectedData(prev => ({ 
        ...prev, 
        servizio_id: '', 
        tipologia_contratto: '', 
        segmento: '', 
        offerta_id: '' 
      }));
    } catch (error) {
      console.error("Error loading servizi:", error);
    }
  };

  const handleServizioSelect = async (servizioId) => {
    console.log("⚙️ Servizio selected:", servizioId);
    setSelectedData(prev => ({ ...prev, servizio_id: servizioId }));
    
    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error("❌ No JWT token found for cascade API call");
        return;
      }
      
      // Load tipologie autorizzate for this servizio, optionally filtered by sub_agenzia
      const subAgenziaId = selectedData.sub_agenzia_id;
      const url = subAgenziaId 
        ? `${process.env.REACT_APP_BACKEND_URL}/api/cascade/tipologie-by-servizio/${servizioId}?sub_agenzia_id=${subAgenziaId}`
        : `${process.env.REACT_APP_BACKEND_URL}/api/cascade/tipologie-by-servizio/${servizioId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ CASCADE API Error: ${response.status} ${response.statusText}`);
        return;
      }
      
      const tipologie = await response.json();
      console.log("✅ CASCADE: Tipologie loaded successfully:", tipologie);
      setCascadeTipologie(tipologie);
      
      // Reset downstream selections
      setCascadeSegmenti([]);
      setCascadeOfferte([]);
      setSelectedData(prev => ({ 
        ...prev, 
        tipologia_contratto: '', 
        segmento: '', 
        offerta_id: '' 
      }));
    } catch (error) {
      console.error("Error loading tipologie:", error);
    }
  };

  const handleTipologiaSelect = async (tipologiaId) => {
    console.log("📝 Tipologia selected:", tipologiaId);
    console.log("📋 Current selectedData:", selectedData);
    setSelectedData(prev => ({ ...prev, tipologia_contratto: tipologiaId }));
    
    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error("❌ No JWT token found for cascade API call");
        return;
      }
      
      const url = `${process.env.REACT_APP_BACKEND_URL}/api/cascade/segmenti-by-tipologia/${tipologiaId}`;
      console.log("🔄 Loading segmenti from:", url);
      
      // Load segmenti for this tipologia
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ CASCADE API Error: ${response.status} ${response.statusText}`);
        console.error("Response body:", await response.text());
        return;
      }
      
      const segmenti = await response.json();
      console.log("✅ CASCADE: Segmenti loaded successfully:", segmenti.length, segmenti);
      setCascadeSegmenti(segmenti);
      
      // AUTO-DETECT: Detect conditional sections when tipologia changes
      await autoDetectConditionalSections();
      
      // Reset downstream selections
      setCascadeOfferte([]);
      setSelectedData(prev => ({ ...prev, segmento: '', offerta_id: '' }));
    } catch (error) {
      console.error("Error loading segmenti:", error);
    }
  };

  const handleSegmentoSelect = async (segmentoId) => {
    console.log("🎯 Segmento selected:", segmentoId);
    setSelectedData(prev => ({ ...prev, segmento: segmentoId }));
    
    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error("❌ No JWT token found for cascade API call");
        return;
      }
      
      // Build URL with all parameters
      const url = `${process.env.REACT_APP_BACKEND_URL}/api/cascade/offerte-by-filiera?commessa_id=${selectedData.commessa_id}&servizio_id=${selectedData.servizio_id}&tipologia_id=${selectedData.tipologia_contratto}&segmento_id=${segmentoId}`;
      console.log("🔄 Loading offerte from:", url);
      console.log("📋 Parameters:", {
        commessa_id: selectedData.commessa_id,
        servizio_id: selectedData.servizio_id,
        tipologia_id: selectedData.tipologia_contratto,
        segmento_id: segmentoId
      });
      
      // Load offerte based on entire selection chain
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ API Error: ${response.status} ${response.statusText}`);
        setCascadeOfferte([]);
        return;
      }
      
      const offerte = await response.json();
      console.log("✅ Offerte loaded:", offerte.length, offerte);
      setCascadeOfferte(offerte);
      
      // AUTO-DETECT: Detect conditional sections based on tipologia_contratto
      await autoDetectConditionalSections();
      
      setSelectedData(prev => ({ ...prev, offerta_id: '' }));
    } catch (error) {
      console.error("❌ Error loading offerte:", error);
      setCascadeOfferte([]);
    }
  };
  
  // NEW: Auto-detect conditional sections when tipologia or segmento changes
  const autoDetectConditionalSections = async () => {
    const userRole = user?.role;
    
    // Only admins and responsabile_commessa and backoffice_commessa can trigger auto-detection
    if (!['admin', 'responsabile_commessa', 'backoffice_commessa'].includes(userRole)) {
      return;
    }
    
    // Get the selected tipologia contratto name
    const tipologiaId = selectedData.tipologia_contratto;
    if (!tipologiaId) return;
    
    // Find tipologia details from available options (use cascadeTipologie instead of allTipologieContratto)
    const tipologiaObj = cascadeTipologie.find(t => t.id === tipologiaId || t.value === tipologiaId);
    const tipologiaName = tipologiaObj?.nome || tipologiaObj?.label || '';
    const tipologiaValue = tipologiaObj?.value || '';
    
    console.log("🔍 AUTO-DETECT: Checking conditional sections for:", tipologiaName);
    
    // Check if it's Energia Fastweb
    const isEnergia = tipologiaName.toLowerCase().includes('energia') || 
                      tipologiaValue.toLowerCase().includes('energia');
    
    // Check if it's Telefonia Fastweb
    const isTelefonia = tipologiaName.toLowerCase().includes('telefonia') || 
                        tipologiaValue.toLowerCase().includes('telefonia');
    
    // Check if it's Telepass
    const isTelepass = tipologiaName.toLowerCase().includes('telepass') || 
                       tipologiaValue.toLowerCase().includes('telepass');
    
    if (isEnergia) {
      console.log("✅ AUTO-DETECT: Energia section detected - Setting default codice_pod field");
      // Ensure the field exists (will be shown in UI)
      setSelectedData(prev => ({
        ...prev,
        codice_pod: prev.codice_pod || ''
      }));
    }
    
    if (isTelefonia) {
      console.log("✅ AUTO-DETECT: Telefonia section detected");
      // Telefonia might have additional fields in the future
    }
    
    if (isTelepass) {
      console.log("✅ AUTO-DETECT: Telepass section detected - Setting default OBU field");
      setSelectedData(prev => ({
        ...prev,
        obu: prev.obu || ''
      }));
    }
  };

  const handleOffertaSelect = async (offertaId) => {
    console.log("🎁 Offerta selected:", offertaId);
    setSelectedData(prev => ({ ...prev, offerta_id: offertaId, sub_offerta_id: '' }));
    
    // Load sub-offerte if available
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/offerte/${offertaId}/sub-offerte`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const subOfferte = await response.json();
        console.log("📦 Sub-offerte loaded:", subOfferte.length);
        setCascadeSubOfferte(subOfferte);
        
        // If has sub-offerte, don't show client form yet
        if (subOfferte.length > 0) {
          setShowClientForm(false);
          setCurrentStep('sub_offerta');
          return;
        }
      }
    } catch (error) {
      console.error("Error loading sub-offerte:", error);
    }
    
    // Show client form if no sub-offerte
    setCascadeSubOfferte([]);
    setShowClientForm(true);
    setCurrentStep('cliente');
  };

  useEffect(() => {
    fetchSegmenti();
  }, []);

  useEffect(() => {
    if (formData.servizio_id) {
      fetchCreateTipologieContratto(formData.commessa_id, formData.servizio_id);
    }
  }, [formData.servizio_id, formData.commessa_id]);

  const fetchServizi = async (commessaId) => {
    try {
      const response = await axios.get(`${API}/commesse/${commessaId}/servizi`);
      setServizi(response.data);
    } catch (error) {
      console.error("Error fetching servizi:", error);
      setServizi([]);
    }
  };

  const fetchCreateTipologieContratto = async (commessaId, servizioId) => {
    try {
      const response = await axios.get(`${API}/tipologie-contratto?commessa_id=${commessaId}&servizio_id=${servizioId}`);
      setCreateTipologieContratto(response.data);
    } catch (error) {
      console.error("Error fetching tipologie contratto:", error);
      setCreateTipologieContratto([]);
    }
  };

  const fetchSegmenti = async () => {
    try {
      console.log("🔄 Loading segmenti...");
      const response = await axios.get(`${API}/segmenti`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setSegmenti(response.data);
      console.log("✅ Segmenti loaded:", response.data.length, response.data);
    } catch (error) {
      console.error("❌ Error fetching segmenti:", error);
      setSegmenti([]);
    }
  };

  const handleCommessaChange = (commessaId) => {
    setFormData(prev => ({
      ...prev, 
      commessa_id: commessaId,
      servizio_id: '',
      tipologia_contratto: '',
      segmento: ''
    }));
    fetchServizi(commessaId);
    setCreateTipologieContratto([]);
  };

  const handleServizioChange = (servizioId) => {
    setFormData(prev => ({
      ...prev,
      servizio_id: servizioId,
      tipologia_contratto: '',
      segmento: ''
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    console.log("🎯 CASCADING SUBMIT TRIGGERED");
    console.log("Selected data:", selectedData);
    console.log("Form data:", formData);
    
    // Validazione ICCID obbligatorio per "Ho Mobile"
    if (isHoMobile()) {
      // Verifica che ci sia almeno un item mobile con ICCID compilato
      const hasValidIccid = mobileItems.some(item => item.iccid && item.iccid.trim() !== '');
      if (!hasValidIccid) {
        toast({
          title: "Campo obbligatorio",
          description: "Per i contratti Ho Mobile, il campo ICCID è obbligatorio. Inserisci almeno un ICCID nella sezione Mobile.",
          variant: "destructive"
        });
        return;
      }
    }
    
    // POD non è più obbligatorio per Energia (richiesta utente)
    
    // Validazione campi personalizzati obbligatori
    const missingCustomFields = validateRequiredCustomFields(customFields, customFieldValues);
    if (missingCustomFields.length > 0) {
      toast({
        title: "Campi personalizzati obbligatori",
        description: `Compila: ${missingCustomFields.join(', ')}`,
        variant: "destructive"
      });
      return;
    }
    
    // Helper per convertire le date in formato MongoDB compatibile
    const formatDateForBackend = (dateValue) => {
      if (!dateValue) return null;
      if (typeof dateValue === 'string') {
        // Se è già una stringa, assicuriamoci che sia in formato YYYY-MM-DD
        return dateValue.split('T')[0]; // Rimuove eventuali parti time
      }
      return null;
    };

    // Create clean form data with cascading selections + ALL client data
    const cleanFormData = {
      // Client personal data (basic)
      nome: formData.nome,
      cognome: formData.cognome,
      email: formData.email || null,
      telefono: formData.telefono,
      telefono2: formData.telefono2 || '', // Map telefono2 -> telefono2 for backend  
      data_nascita: formatDateForBackend(formData.data_nascita),
      luogo_nascita: formData.luogo_nascita || '',
      codice_fiscale: formData.codice_fiscale || '', // Campo richiesto
      
      // Address data  
      indirizzo: formData.indirizzo,
      comune_residenza: formData.comune_residenza || '', // Map comune_residenza -> comune_residenza for backend
      provincia: formData.provincia,
      cap: formData.cap,
      
      // Business data
      ragione_sociale: formData.ragione_sociale || '',
      partita_iva: formData.partita_iva || '',
      
      // Additional fields
      numero_ordine: formData.numero_ordine || '',
      account: formData.account || '',
      
      // Document data
      tipo_documento: formData.tipo_documento || null, // FIX: Send null instead of empty string for enum fields
      numero_documento: formData.numero_documento || '',
      data_rilascio: formatDateForBackend(formData.data_rilascio),
      luogo_rilascio: formData.luogo_rilascio || '',
      scadenza_documento: formatDateForBackend(formData.scadenza_documento),
      
      // Telefonia Fissa conditional fields
      tecnologia: formData.tecnologia || null, // FIX: Send null instead of empty string for enum fields
      codice_migrazione: formData.codice_migrazione || '',
      gestore: formData.gestore || '',
      numero_portabilita: formData.numero_portabilita || '', // NEW: Numero Portabilità field
      convergenza: Boolean(formData.convergenza),
      convergenza_items: formData.convergenza ? convergenzaItems : [],
      mobile_items: isMobile() ? mobileItems : [],
      
      // Energia Fastweb conditional fields
      codice_pod: formData.codice_pod || '',
      energia_tipologia: formData.energia_tipologia || null,
      energia_consumo_annuo: formData.energia_consumo_annuo || '',
      energia_potenza_contatore: formData.energia_potenza_contatore || '',
      energia_potenza_impegnata: formData.energia_potenza_impegnata || '',
      energia_fornitore_attuale: formData.energia_fornitore_attuale || '',
      energia_vecchio_intestatario_nome: formData.energia_vecchio_intestatario_nome || '',
      energia_vecchio_intestatario_cognome: formData.energia_vecchio_intestatario_cognome || '',
      energia_vecchio_intestatario_cf: formData.energia_vecchio_intestatario_cf || '',
      
      // Telepass conditional fields
      obu: formData.obu || '',
      
      // Payment data
      modalita_pagamento: formData.modalita_pagamento || null, // FIX: Send null instead of empty string for enum fields
      iban: formData.iban || '',
      intestatario_diverso: formData.intestatario_diverso || '',
      numero_carta: formData.numero_carta || '',
      mese_carta: formData.mese_carta || '',
      anno_carta: formData.anno_carta || '',
      
      // Notes
      note: formData.note || '',
      note_backoffice: formData.note_backoffice || '',
      
      // Custom fields (dati_aggiuntivi) - per (commessa + tipologia)
      dati_aggiuntivi: customFieldValues || {},
      
      // Cascading selection data - Area Manager uses form selection
      sub_agenzia_id: user?.role === 'area_manager' ? formData.sub_agenzia_id : selectedData.sub_agenzia_id,
      commessa_id: selectedData.commessa_id,
      servizio_id: selectedData.servizio_id,
      // FIX: salva il nome tipologia esattamente come definita nella tipologia
      // user-created (es. "ENERGIA"), non più mappato a enum legacy "energia_fastweb"
      tipologia_contratto: cascadeTipologie?.find(t => t.id === selectedData.tipologia_contratto)?.nome
        || selectedData.tipologia_contratto,
      tipologia_contratto_id: selectedData.tipologia_contratto,  // ADDED: Save UUID for filtering
      // FIX: salva il segmento come nome esatto definito nel segmento user-created
      // (es. "Privato", "Business" o custom), non più mappato a enum legacy lowercase.
      segmento: cascadeSegmenti?.find(s => s.id === selectedData.segmento)?.nome
        || selectedData.segmento,
      offerta_id: selectedData.offerta_id,
      sub_offerta_id: selectedData.sub_offerta_id || null,  // NEW: Sub-offerta ID
      
      // Additional metadata for tracking
      selection_flow: user?.role === 'sub_agenzia' ? 'sub_agenzia_flow' : 'responsabile_flow',
      created_via: 'cascading_modal'
    };
    
    console.log("🎯 CLEAN CASCADING FORM DATA:", {
      total_fields: Object.keys(cleanFormData).length,
      required_fields: {
        nome: cleanFormData.nome,
        cognome: cleanFormData.cognome, 
        codice_fiscale: cleanFormData.codice_fiscale,
        telefono: cleanFormData.telefono
      },
      cascading_data: {
        sub_agenzia_id: cleanFormData.sub_agenzia_id,
        commessa_id: cleanFormData.commessa_id,
        servizio_id: cleanFormData.servizio_id,
        tipologia_contratto: cleanFormData.tipologia_contratto,
        segmento: cleanFormData.segmento,
        offerta_id: cleanFormData.offerta_id,
        sub_offerta_id: cleanFormData.sub_offerta_id  // NEW: Log sub-offerta
      },
      selectedData_offerta: selectedData.offerta_id,
      full_data: cleanFormData
    });
    console.log("🔍 DEBUG selectedData before submit:", {
      selectedData: selectedData,
      offerta_id: selectedData.offerta_id,
      has_offerta: Boolean(selectedData.offerta_id)
    });
    
    console.log("📱 CONVERGENZA DATA BEING SENT:", {
      convergenza: cleanFormData.convergenza,
      convergenza_items_count: cleanFormData.convergenza_items.length,
      convergenza_items: cleanFormData.convergenza_items
    });
    
    console.log("🎯 CALLING onSubmit FUNCTION...");
    
    // FIX: Close modal immediately before async operation
    onClose();
    
    // Call the onSubmit function passed from parent
    onSubmit(cleanFormData);
    
    console.log("🎯 ONSUBMIT CALLED - RESETTING ALL FORMS");
    
    // Reset all form data after submit
    setFormData({
      nome: '', cognome: '', email: '', telefono: '', cellulare: '', 
      data_nascita: '', luogo_nascita: '', codice_fiscale: '', 
      indirizzo: '', comune: '', provincia: '', cap: '', 
      ragione_sociale: '', partita_iva: '', numero_ordine: '', account: '',
      tipo_documento: '', numero_documento: '', data_rilascio: '', 
      luogo_rilascio: '', scadenza_documento: '',
      tecnologia: '', codice_migrazione: '', gestore: '', numero_portabilita: '', convergenza: false,
      convergenza_items: [], 
      codice_pod: '', energia_tipologia: '', energia_consumo_annuo: '',
      energia_potenza_contatore: '', energia_potenza_impegnata: '',
      energia_fornitore_attuale: '',
      energia_vecchio_intestatario_nome: '', energia_vecchio_intestatario_cognome: '', energia_vecchio_intestatario_cf: '',
      obu: '',
      modalita_pagamento: '', iban: '', intestatario_diverso: '', 
      numero_carta: '', mese_carta: '', anno_carta: '',
      note: '', note_backoffice: ''
    });
    
    setSelectedData({
      sub_agenzia_id: '',
      commessa_id: '',
      servizio_id: '',
      tipologia_contratto: '',
      segmento: '',
      offerta_id: ''
    });
    
    setShowClientForm(false);
    setCurrentStep('initial');
    
    console.log("🎯 CLOSING MODAL");
    onClose();
  };

  const availableSubAgenzie = formData.commessa_id && formData.commessa_id !== ''
    ? subAgenzie.filter(sa => sa.commesse_autorizzate?.includes(formData.commessa_id))
    : subAgenzie;  // Se nessuna commessa selezionata o commessa vuota, mostra tutte le sub agenzie
  
  // 🔍 DEBUG: Log available sub agenzie after filtering
  useEffect(() => {
    console.log("🔍 availableSubAgenzie dopo filtro:", availableSubAgenzie.length, "elementi");
    console.log("🔍 formData.commessa_id:", formData.commessa_id);
    if (availableSubAgenzie.length > 0) {
      console.log("🔍 Primo availableSubAgenzia:", JSON.stringify(availableSubAgenzie[0], null, 2));
    }
  }, [formData.commessa_id, subAgenzie]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-blue-600">
            {showClientForm ? "📝 Compila Scheda Cliente" : "🎯 Selezione Prodotto/Offerta"}
          </DialogTitle>
          <DialogDescription className="text-lg">
            {showClientForm 
              ? "Inserisci i dati del cliente per completare la creazione."
              : "Segui il percorso guidato per selezionare il prodotto/offerta più adatto."
            }
          </DialogDescription>
        </DialogHeader>

        {/* CASCADING SELECTION FLOW */}
        {!showClientForm && (
          <div className="space-y-6">
            
            {/* STEP INDICATOR */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-2">Percorso Guidato Selezione</h3>
              <div className="flex flex-wrap gap-2 text-sm">
                {user?.role === 'sub_agenzia' || user?.sub_agenzia_id ? (
                  <>
                    <span className={`px-3 py-1 rounded-full ${selectedData.commessa_id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      1. Commessa
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.servizio_id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      2. Servizio
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.tipologia_contratto ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      3. Tipologia
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.segmento ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      4. Segmento
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.offerta_id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      5. Offerta
                    </span>
                  </>
                ) : (
                  <>
                    <span className={`px-3 py-1 rounded-full ${selectedData.sub_agenzia_id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      1. Sub Agenzia
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.commessa_id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      2. Commessa
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.servizio_id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      3. Servizio
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.tipologia_contratto ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      4. Tipologia
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.segmento ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      5. Segmento
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.offerta_id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      6. Offerta
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* SUB AGENZIA SELECTION (for Responsabili/Backoffice/Agenti/Area Manager) */}
              {(user?.role === 'responsabile_commessa' || user?.role === 'backoffice_commessa' || user?.role === 'responsabile_sub_agenzia' || user?.role === 'backoffice_sub_agenzia' || user?.role === 'agente_specializzato' || user?.role === 'operatore' || user?.role === 'responsabile_store' || user?.role === 'responsabile_presidi' || user?.role === 'store_assist' || user?.role === 'promoter_presidi' || user?.role === 'area_manager' || user?.role === 'admin') && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-700">🏢 Sub Agenzia</Label>
                  <select 
                    value={selectedData.sub_agenzia_id} 
                    onChange={(e) => handleSubAgenziaSelect(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seleziona Sub Agenzia...</option>
                    {Array.isArray(cascadeSubAgenzie) && cascadeSubAgenzie.map(sa => (
                      <option key={sa.id} value={sa.id}>{sa.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* COMMESSA SELECTION */}
              <div className="space-y-2">
                <Label className="text-base font-semibold text-gray-700">📋 Commessa</Label>
                <select 
                  value={selectedData.commessa_id} 
                  onChange={(e) => handleCommessaSelect(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  disabled={!Array.isArray(cascadeCommesse) || (!cascadeCommesse.length && (user?.role === 'responsabile_commessa' || user?.role === 'backoffice_commessa' || user?.role === 'responsabile_sub_agenzia' || user?.role === 'backoffice_sub_agenzia' || user?.role === 'agente_specializzato' || user?.role === 'operatore' || user?.role === 'responsabile_store' || user?.role === 'responsabile_presidi' || user?.role === 'store_assist' || user?.role === 'promoter_presidi'))}
                >
                  <option value="">Seleziona Commessa...</option>
                  {/* AREA MANAGER CRITICAL FIX: Use user.commesse_autorizzate as fallback */}
                  {user?.role === 'area_manager' && (!Array.isArray(cascadeCommesse) || cascadeCommesse.length === 0) && Array.isArray(user?.commesse_autorizzate) ? (
                    // Fallback: Show commesse directly from user authorization if cascade failed
                    commesse.filter(c => user.commesse_autorizzate.includes(c.id)).map(commessa => (
                      <option key={commessa?.id || Math.random()} value={commessa?.id}>{commessa?.nome || 'Nome non disponibile'}</option>
                    ))
                  ) : (
                    // Normal cascade logic for all other cases
                    Array.isArray(cascadeCommesse) && cascadeCommesse.map(commessa => (
                      <option key={commessa?.id || Math.random()} value={commessa?.id}>{commessa?.nome || 'Nome non disponibile'}</option>
                    ))
                  )}
                </select>
              </div>

              {/* SERVIZIO SELECTION */}
              {selectedData.commessa_id && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-700">⚙️ Servizio</Label>
                  <select 
                    value={selectedData.servizio_id} 
                    onChange={(e) => handleServizioSelect(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seleziona Servizio...</option>
                    {Array.isArray(cascadeServizi) && cascadeServizi.map(servizio => (
                      <option key={servizio?.id || Math.random()} value={servizio?.id}>{servizio?.nome || 'Nome non disponibile'}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* TIPOLOGIA CONTRATTO SELECTION */}
              {selectedData.servizio_id && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-700">📝 Tipologia Contratto</Label>
                  <select 
                    value={selectedData.tipologia_contratto} 
                    onChange={(e) => handleTipologiaSelect(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seleziona Tipologia...</option>
                    {Array.isArray(cascadeTipologie) && cascadeTipologie.map(tipologia => (
                      <option key={tipologia?.id || Math.random()} value={tipologia?.id}>{tipologia?.nome || 'Nome non disponibile'}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* SEGMENTO SELECTION */}
              {selectedData.tipologia_contratto && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-700">🎯 Segmento</Label>
                  <select 
                    value={selectedData.segmento} 
                    onChange={(e) => handleSegmentoSelect(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seleziona Segmento...</option>
                    {Array.isArray(cascadeSegmenti) && cascadeSegmenti.map(segmento => (
                      <option key={segmento?.id || Math.random()} value={segmento?.id}>{segmento?.nome || 'Nome non disponibile'}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* OFFERTA SELECTION */}
              {selectedData.segmento && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-700">💡 Offerta</Label>
                  {console.log("🎨 Rendering offerte dropdown. cascadeOfferte:", cascadeOfferte)}
                  
                  <select 
                    value={selectedData.offerta_id || ''} 
                    onChange={(e) => {
                      handleOffertaSelect(e.target.value);
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seleziona Offerta...</option>
                    {Array.isArray(cascadeOfferte) && cascadeOfferte.length > 0 ? 
                      cascadeOfferte.map(offerta => (
                        <option key={offerta?.id || Math.random()} value={offerta?.id}>
                          {offerta?.nome || 'Nome non disponibile'}
                        </option>
                      )) : 
                      <option value="" disabled>
                        {cascadeOfferte === null ? 'Caricamento...' : 
                         Array.isArray(cascadeOfferte) ? 'Nessuna offerta disponibile per questa combinazione' : 
                         'Errore nel caricamento offerte'}
                      </option>
                    }
                  </select>
                  {cascadeOfferte.length === 0 && (
                    <p className="text-sm text-amber-600 mt-1">
                      ⚠️ Nessuna offerta trovata. Verifica console (F12) per dettagli.
                    </p>
                  )}
                </div>
              )}
              
              {/* NEW: SUB-OFFERTA SELECTION */}
              {selectedData.offerta_id && cascadeSubOfferte.length > 0 && (
                <div className="space-y-2 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <Label className="text-base font-semibold text-blue-900">📦 Sotto-Offerta</Label>
                  <p className="text-xs text-blue-700 mb-2">Seleziona una variante per l'offerta scelta</p>
                  <select 
                    value={selectedData.sub_offerta_id || ''} 
                    onChange={(e) => {
                      setSelectedData(prev => ({ ...prev, sub_offerta_id: e.target.value }));
                      setShowClientForm(true);
                      setCurrentStep('cliente');
                    }}
                    className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seleziona Sotto-Offerta...</option>
                    {cascadeSubOfferte.map(subOff => (
                      <option key={subOff.id} value={subOff.id}>
                        {subOff.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            </div>

            {/* SELECTION SUMMARY */}
            {Object.values(selectedData).some(val => val) && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">Riepilogo Selezione</h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-blue-700">
                  {selectedData.sub_agenzia_id && <div><strong>Sub Agenzia:</strong> {subAgenzie?.find(sa => sa.id === selectedData.sub_agenzia_id)?.nome}</div>}
                  {selectedData.commessa_id && <div><strong>Commessa:</strong> {cascadeCommesse?.find(c => c.id === selectedData.commessa_id)?.nome}</div>}
                  {selectedData.servizio_id && <div><strong>Servizio:</strong> {cascadeServizi?.find(s => s.id === selectedData.servizio_id)?.nome}</div>}
                  {selectedData.tipologia_contratto && <div><strong>Tipologia:</strong> {cascadeTipologie?.find(t => t.id === selectedData.tipologia_contratto)?.nome}</div>}
                  {selectedData.segmento && <div><strong>Segmento:</strong> {cascadeSegmenti?.find(s => s.id === selectedData.segmento)?.nome}</div>}
                  {selectedData.offerta_id && <div><strong>Offerta:</strong> {cascadeOfferte?.find(o => o.id === selectedData.offerta_id)?.nome}</div>}
                  {selectedData.sub_offerta_id && <div><strong>Sotto-Offerta:</strong> {cascadeSubOfferte?.find(so => so.id === selectedData.sub_offerta_id)?.nome}</div>}
                </div>
              </div>
            )}

          </div>
        )}

        {/* CLIENT FORM (shown after offerta selection) */}
        {showClientForm && (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* SELECTED OFFERTA SUMMARY */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-6">
              <h4 className="font-semibold text-green-800 mb-3">✅ Filiera Cascading Selezionata</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {selectedData.sub_agenzia_id && (
                  <div className="bg-white p-2 rounded border border-green-200">
                    <span className="font-semibold text-gray-600">Sub Agenzia:</span>
                    <div className="text-green-700 font-medium">{subAgenzie?.find(sa => sa.id === selectedData.sub_agenzia_id)?.nome}</div>
                  </div>
                )}
                {selectedData.commessa_id && (
                  <div className="bg-white p-2 rounded border border-green-200">
                    <span className="font-semibold text-gray-600">Commessa:</span>
                    <div className="text-green-700 font-medium">{cascadeCommesse?.find(c => c.id === selectedData.commessa_id)?.nome}</div>
                  </div>
                )}
                {selectedData.servizio_id && (
                  <div className="bg-white p-2 rounded border border-green-200">
                    <span className="font-semibold text-gray-600">Servizio:</span>
                    <div className="text-green-700 font-medium">{cascadeServizi?.find(s => s.id === selectedData.servizio_id)?.nome}</div>
                  </div>
                )}
                {selectedData.tipologia_contratto && (
                  <div className="bg-white p-2 rounded border border-green-200">
                    <span className="font-semibold text-gray-600">Tipologia:</span>
                    <div className="text-green-700 font-medium">{cascadeTipologie?.find(t => t.id === selectedData.tipologia_contratto)?.nome}</div>
                  </div>
                )}
                {selectedData.segmento && (
                  <div className="bg-white p-2 rounded border border-green-200">
                    <span className="font-semibold text-gray-600">Segmento:</span>
                    <div className="text-green-700 font-medium">{cascadeSegmenti?.find(s => s.id === selectedData.segmento)?.nome}</div>
                  </div>
                )}
                {selectedData.offerta_id && (
                  <div className="bg-white p-2 rounded border border-green-200">
                    <span className="font-semibold text-gray-600">Offerta:</span>
                    <div className="text-green-700 font-medium">{cascadeOfferte?.find(o => o.id === selectedData.offerta_id)?.nome}</div>
                  </div>
                )}
                {selectedData.sub_offerta_id && (
                  <div className="bg-blue-100 p-3 rounded border-2 border-blue-400 md:col-span-2">
                    <span className="font-semibold text-blue-900">📦 Sotto-Offerta:</span>
                    <div className="text-blue-800 font-bold text-base">{cascadeSubOfferte?.find(so => so.id === selectedData.sub_offerta_id)?.nome}</div>
                  </div>
                )}
              </div>
            </div>

          {/* COPY FROM EXISTING CLIENT (anagrafica base) */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6" data-testid="copy-client-section">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="font-semibold text-amber-900">📋 Copia da anagrafica esistente</h4>
                <p className="text-xs text-amber-800 mt-1">
                  Precompila anagrafica completa (nome, cognome, ragione sociale, CF, P.IVA, indirizzo), contatti (telefono, email), modalità di pagamento e documento d'identità partendo da un cliente già presente.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCopySearch(v => !v)}
                className="border-amber-300 text-amber-900 hover:bg-amber-100"
                data-testid="toggle-copy-client-search-btn"
              >
                {showCopySearch ? 'Chiudi ricerca' : 'Cerca cliente da copiare'}
              </Button>
            </div>

            {showCopySearch && (
              <div className="mt-3" data-testid="copy-client-search-panel">
                <Input
                  type="text"
                  placeholder="Cerca per nome, cognome, codice fiscale, P.IVA, telefono, email..."
                  value={copySearchTerm}
                  onChange={(e) => setCopySearchTerm(e.target.value)}
                  className="w-full"
                  data-testid="copy-client-search-input"
                  autoFocus
                />

                {isSearchingClients && (
                  <div className="mt-2 text-sm text-amber-800" data-testid="copy-client-searching">
                    Ricerca in corso...
                  </div>
                )}

                {!isSearchingClients && copySearchTerm.length >= 2 && copySearchResults.length === 0 && (
                  <div className="mt-2 text-sm text-gray-600" data-testid="copy-client-no-results">
                    Nessun cliente trovato per "{copySearchTerm}".
                  </div>
                )}

                {copySearchTerm.length > 0 && copySearchTerm.length < 2 && (
                  <div className="mt-2 text-xs text-gray-500">
                    Digita almeno 2 caratteri per avviare la ricerca.
                  </div>
                )}

                {copySearchResults.length > 0 && (
                  <div
                    className="mt-2 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg divide-y"
                    data-testid="copy-client-results-list"
                  >
                    {copySearchResults.map((cliente) => (
                      <button
                        type="button"
                        key={cliente.id}
                        onClick={() => copyClientData(cliente)}
                        className="w-full text-left px-3 py-2 hover:bg-amber-50 focus:bg-amber-100 focus:outline-none"
                        data-testid={`copy-client-result-${cliente.id}`}
                      >
                        <div className="font-medium text-gray-900">
                          {cliente.ragione_sociale
                            ? cliente.ragione_sociale
                            : `${cliente.nome || ''} ${cliente.cognome || ''}`.trim() || '—'}
                        </div>
                        <div className="text-xs text-gray-600">
                          {[cliente.codice_fiscale, cliente.partita_iva, cliente.telefono, cliente.email]
                            .filter(Boolean)
                            .join(' • ')}
                        </div>
                        {(cliente.indirizzo || cliente.comune_residenza || cliente.provincia) && (
                          <div className="text-xs text-gray-500">
                            {[cliente.indirizzo, cliente.comune_residenza, cliente.provincia, cliente.cap]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AREA MANAGER: Campo Sub Agenzia all'inizio */}
          {user?.role === 'area_manager' && (
            <div>
              <Label htmlFor="sub_agenzia_id" className="text-base font-semibold">Sub Agenzia *</Label>
              <select 
                id="sub_agenzia_id"
                value={formData.sub_agenzia_id || ''} 
                onChange={(e) => setFormData({...formData, sub_agenzia_id: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">Seleziona Sub Agenzia...</option>
                {user?.sub_agenzie_autorizzate?.map(subAgenziaId => {
                  const subAgenzia = cascadeSubAgenzie.find(sa => sa.id === subAgenziaId);
                  return subAgenzia ? (
                    <option key={subAgenzia.id} value={subAgenzia.id}>
                      {subAgenzia.nome}
                    </option>
                  ) : null;
                })}
              </select>
              <p className="text-sm text-gray-600 mt-1">
                Seleziona a quale sub agenzia assegnare questo cliente
              </p>
            </div>
          )}
          
          {/* ===== NUOVA STRUTTURA COMPLETA SCHEDA CLIENTE ===== */}
          
          {/* CAMPI BASE SEMPRE PRESENTI */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Informazioni Base</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="numero_ordine">Numero Ordine</Label>
                <Input
                  id="numero_ordine"
                  value={formData.numero_ordine}
                  onChange={(e) => setFormData({...formData, numero_ordine: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="account">Account</Label>
                <Input
                  id="account"
                  value={formData.account}
                  onChange={(e) => setFormData({...formData, account: e.target.value})}
                />
              </div>
              {isBusinessSegment() && (
                <div>
                  <Label htmlFor="ragione_sociale">Ragione Sociale *</Label>
                  <Input
                    id="ragione_sociale"
                    value={formData.ragione_sociale}
                    onChange={(e) => setFormData({...formData, ragione_sociale: e.target.value})}
                    required
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cognome">Cognome *</Label>
                <Input
                  id="cognome"
                  value={formData.cognome}
                  onChange={(e) => setFormData({...formData, cognome: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="data_nascita">Nato/a</Label>
                <Input
                  id="data_nascita"
                  type="date"
                  value={formData.data_nascita}
                  onChange={(e) => setFormData({...formData, data_nascita: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="luogo_nascita">A</Label>
                <Input
                  id="luogo_nascita"
                  value={formData.luogo_nascita}
                  onChange={(e) => setFormData({...formData, luogo_nascita: e.target.value})}
                />
              </div>
            </div>

            {/* SEZIONE INDIRIZZO RESIDENZA */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">🏠 Indirizzo Residenza</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="indirizzo">Indirizzo Residenza</Label>
                  <Input
                    id="indirizzo"
                    value={formData.indirizzo}
                    onChange={(e) => setFormData({...formData, indirizzo: e.target.value})}
                    placeholder="Via/Piazza, numero civico"
                  />
                </div>
                <div>
                  <Label htmlFor="comune_residenza">Comune Residenza</Label>
                  <Input
                    id="comune_residenza"
                    value={formData.comune_residenza}
                    onChange={(e) => setFormData({...formData, comune_residenza: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="provincia">Provincia</Label>
                    <select
                      id="provincia"
                      value={formData.provincia}
                      onChange={(e) => setFormData({...formData, provincia: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Prov.</option>
                      {PROVINCE_ITALIANE.map(prov => (
                        <option key={prov} value={prov}>{prov}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="cap">CAP</Label>
                    <Input id="cap" value={formData.cap} onChange={(e) => setFormData({...formData, cap: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>

            {/* SEZIONE INDIRIZZO ATTIVAZIONE */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">📍 Indirizzo Attivazione (se diverso dalla residenza)</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="indirizzo_attivazione">Indirizzo Attivazione</Label>
                  <Input
                    id="indirizzo_attivazione"
                    value={formData.indirizzo_attivazione}
                    onChange={(e) => setFormData({...formData, indirizzo_attivazione: e.target.value})}
                    placeholder="Via/Piazza per l'attivazione"
                    data-testid="create-cliente-indirizzo-attivazione-input"
                  />
                </div>
                <div>
                  <Label htmlFor="comune_attivazione">Comune Attivazione</Label>
                  <Input
                    id="comune_attivazione"
                    value={formData.comune_attivazione}
                    onChange={(e) => setFormData({...formData, comune_attivazione: e.target.value})}
                    data-testid="create-cliente-comune-attivazione-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="provincia_attivazione">Prov. Att.</Label>
                    <select
                      id="provincia_attivazione"
                      value={formData.provincia_attivazione}
                      onChange={(e) => setFormData({...formData, provincia_attivazione: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                      data-testid="create-cliente-provincia-attivazione-select"
                    >
                      <option value="">Prov.</option>
                      {PROVINCE_ITALIANE.map(prov => (
                        <option key={prov} value={prov}>{prov}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="cap_attivazione">CAP Att.</Label>
                    <Input
                      id="cap_attivazione"
                      value={formData.cap_attivazione}
                      onChange={(e) => setFormData({...formData, cap_attivazione: e.target.value})}
                      data-testid="create-cliente-cap-attivazione-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="telefono">Cellulare *</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="telefono2">Telefono 2</Label>
                <Input
                  id="telefono2"
                  value={formData.telefono2}
                  onChange={(e) => setFormData({...formData, telefono2: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isBusinessSegment() && (
                <div>
                  <Label htmlFor="partita_iva">Partita Iva *</Label>
                  <Input
                    id="partita_iva"
                    value={formData.partita_iva}
                    onChange={(e) => setFormData({...formData, partita_iva: e.target.value})}
                    required
                  />
                </div>
              )}
              <div>
                <Label htmlFor="codice_fiscale">Codice Fiscale *</Label>
                <Input
                  id="codice_fiscale"
                  value={formData.codice_fiscale}
                  onChange={(e) => setFormData({...formData, codice_fiscale: e.target.value})}
                  required
                />
              </div>
            </div>
          </div>

          {/* SEZIONE DOCUMENTO */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Documento</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="tipo_documento">Tipo Documento</Label>
                <select
                  id="tipo_documento"
                  value={formData.tipo_documento}
                  onChange={(e) => setFormData({...formData, tipo_documento: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Seleziona Tipo...</option>
                  {TIPI_DOCUMENTO.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="numero_documento">Numero documento</Label>
                <Input
                  id="numero_documento"
                  value={formData.numero_documento}
                  onChange={(e) => setFormData({...formData, numero_documento: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="data_rilascio">Data rilascio</Label>
                <Input
                  id="data_rilascio"
                  type="date"
                  value={formData.data_rilascio}
                  onChange={(e) => setFormData({...formData, data_rilascio: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="luogo_rilascio">Luogo Rilascio</Label>
                <Input
                  id="luogo_rilascio"
                  value={formData.luogo_rilascio}
                  onChange={(e) => setFormData({...formData, luogo_rilascio: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="scadenza_documento">Scadenza</Label>
                <Input
                  id="scadenza_documento"
                  type="date"
                  value={formData.scadenza_documento}
                  onChange={(e) => setFormData({...formData, scadenza_documento: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* SEZIONE TELEFONIA FISSA */}
          {(() => {
            const showTelefoniaSection = isTelefoniaFastweb() && !isMobile() && !isTelepass();
            console.log("🔍 RENDER CHECK - Telefonia Fissa section:", showTelefoniaSection, {
              isTelefonia: isTelefoniaFastweb(),
              isMobile: isMobile(),
              isTelepass: isTelepass(),
              shouldShow: showTelefoniaSection
            });
            return showTelefoniaSection;
          })() && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">📞 Telefonia Fissa</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="tecnologia">Tecnologia</Label>
                  <select
                    id="tecnologia"
                    value={formData.tecnologia}
                    onChange={(e) => setFormData({...formData, tecnologia: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seleziona Tecnologia...</option>
                    {TECNOLOGIE.map(tech => (
                      <option key={tech.value} value={tech.value}>{tech.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="codice_migrazione">Codice Migrazione</Label>
                  <Input
                    id="codice_migrazione"
                    value={formData.codice_migrazione}
                    onChange={(e) => setFormData({...formData, codice_migrazione: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="numero_portabilita">Numero Portabilità</Label>
                  <Input
                    id="numero_portabilita"
                    value={formData.numero_portabilita}
                    onChange={(e) => setFormData({...formData, numero_portabilita: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="gestore">Gestore</Label>
                  <Input
                    id="gestore"
                    value={formData.gestore}
                    onChange={(e) => setFormData({...formData, gestore: e.target.value})}
                  />
                </div>
              </div>

              {/* CONVERGENZA */}
              <div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="convergenza"
                    checked={formData.convergenza}
                    onChange={(e) => setFormData({...formData, convergenza: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="convergenza">Convergenza</Label>
                </div>

                {formData.convergenza && (
                  <div className="mt-4 space-y-3">
                    {convergenzaItems.map((item, index) => (
                      <div key={index} className="border p-4 rounded-lg bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>Numero Cellulare</Label>
                            <Input
                              value={item.numero_cellulare}
                              onChange={(e) => updateConvergenzaItem(index, 'numero_cellulare', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>ICCID</Label>
                            <Input
                              value={item.iccid}
                              onChange={(e) => updateConvergenzaItem(index, 'iccid', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Operatore</Label>
                            <Input
                              value={item.operatore}
                              onChange={(e) => updateConvergenzaItem(index, 'operatore', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Offerta SIM</Label>
                            <Input
                              value={item.offerta_sim}
                              onChange={(e) => updateConvergenzaItem(index, 'offerta_sim', e.target.value)}
                              placeholder="Nome offerta SIM"
                            />
                          </div>
                        </div>
                        <div className="flex justify-between mt-2">
                          <Button
                            type="button"
                            onClick={addConvergenzaItem}
                            variant="outline"
                            size="sm"
                            className="text-green-600"
                          >
                            + Aggiungi
                          </Button>
                          {convergenzaItems.length > 1 && (
                            <Button
                              type="button"
                              onClick={() => removeConvergenzaItem(index)}
                              variant="outline"
                              size="sm"
                              className="text-red-600"
                            >
                              Rimuovi
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SEZIONE ENERGIA FASTWEB */}
          {(() => {
            const showEnergiaSection = isEnergiaFastweb() && !isTelepass();
            console.log("🔍 RENDER CHECK - Energia Fastweb section:", showEnergiaSection);
            return showEnergiaSection;
          })() && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">⚡ Energia</h3>
              
              {/* Tipologia Dropdown */}
              <div>
                <Label htmlFor="energia_tipologia">Tipologia</Label>
                <select
                  id="energia_tipologia"
                  value={formData.energia_tipologia}
                  onChange={(e) => setFormData({...formData, energia_tipologia: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleziona Tipologia...</option>
                  <option value="Switch">Switch</option>
                  <option value="Switch con voltura">Switch con voltura</option>
                  <option value="Subentro">Subentro</option>
                  <option value="Nuovo Allaccio">Nuovo Allaccio</option>
                </select>
              </div>

              {/* POD */}
              <div>
                <div>
                  <Label htmlFor="codice_pod">Codice POD</Label>
                  <Input
                    id="codice_pod"
                    value={formData.codice_pod}
                    onChange={(e) => setFormData({...formData, codice_pod: e.target.value})}
                  />
                </div>
              </div>

              {/* Altri campi */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="energia_consumo_annuo">Consumo Annuo</Label>
                  <Input
                    id="energia_consumo_annuo"
                    value={formData.energia_consumo_annuo}
                    onChange={(e) => setFormData({...formData, energia_consumo_annuo: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="energia_potenza_contatore">Potenza del Contatore</Label>
                  <Input
                    id="energia_potenza_contatore"
                    value={formData.energia_potenza_contatore}
                    onChange={(e) => setFormData({...formData, energia_potenza_contatore: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="energia_potenza_impegnata">Potenza Impegnata</Label>
                  <Input
                    id="energia_potenza_impegnata"
                    value={formData.energia_potenza_impegnata}
                    onChange={(e) => setFormData({...formData, energia_potenza_impegnata: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="energia_fornitore_attuale">Fornitore Attuale</Label>
                  <Input
                    id="energia_fornitore_attuale"
                    value={formData.energia_fornitore_attuale}
                    onChange={(e) => setFormData({...formData, energia_fornitore_attuale: e.target.value})}
                    placeholder="Es: Enel, Eni, A2A, Iren..."
                    data-testid="create-cliente-fornitore-attuale-input"
                  />
                </div>
              </div>

              {/* Campi condizionali per "Switch con voltura" */}
              {formData.energia_tipologia === 'Switch con voltura' && (
                <div className="space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-semibold text-blue-900">Dati Vecchio Intestatario</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="energia_vecchio_intestatario_nome">Nome</Label>
                      <Input
                        id="energia_vecchio_intestatario_nome"
                        value={formData.energia_vecchio_intestatario_nome}
                        onChange={(e) => setFormData({...formData, energia_vecchio_intestatario_nome: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="energia_vecchio_intestatario_cognome">Cognome</Label>
                      <Input
                        id="energia_vecchio_intestatario_cognome"
                        value={formData.energia_vecchio_intestatario_cognome}
                        onChange={(e) => setFormData({...formData, energia_vecchio_intestatario_cognome: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="energia_vecchio_intestatario_cf">Codice Fiscale</Label>
                      <Input
                        id="energia_vecchio_intestatario_cf"
                        value={formData.energia_vecchio_intestatario_cf}
                        onChange={(e) => setFormData({...formData, energia_vecchio_intestatario_cf: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SEZIONE DATI MOBILE */}
          {(() => {
            const showMobileSection = isMobile() && !isTelepass();
            console.log("🔍 RENDER CHECK - Mobile section:", showMobileSection);
            return showMobileSection;
          })() && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">📱 Dati Mobile</h3>
              
              <div className="space-y-4">
                {mobileItems.map((item, index) => (
                  <div key={index} className="p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-semibold text-gray-700 mb-3">SIM #{index + 1}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Telefono da Portare</Label>
                        <Input
                          value={item.telefono_da_portare}
                          onChange={(e) => updateMobileItem(index, 'telefono_da_portare', e.target.value)}
                          placeholder="Numero di telefono"
                        />
                      </div>
                      <div>
                        <Label>ICCID {isHoMobile() && <span className="text-red-500">*</span>}</Label>
                        <Input
                          value={item.iccid}
                          onChange={(e) => updateMobileItem(index, 'iccid', e.target.value)}
                          placeholder="Codice ICCID"
                          className={isHoMobile() && !item.iccid ? "border-red-300" : ""}
                        />
                        {isHoMobile() && !item.iccid && (
                          <p className="text-xs text-red-500 mt-1">ICCID obbligatorio per Ho Mobile</p>
                        )}
                      </div>
                      <div>
                        <Label>Operatore</Label>
                        <Input
                          value={item.operatore}
                          onChange={(e) => updateMobileItem(index, 'operatore', e.target.value)}
                          placeholder="Nome operatore"
                        />
                      </div>
                      <div>
                        <Label>Titolare se Diverso</Label>
                        <Input
                          value={item.titolare_diverso}
                          onChange={(e) => updateMobileItem(index, 'titolare_diverso', e.target.value)}
                          placeholder="Nome titolare"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between mt-2">
                      <Button
                        type="button"
                        onClick={addMobileItem}
                        variant="outline"
                        size="sm"
                        className="text-green-600"
                      >
                        + Aggiungi SIM
                      </Button>
                      {mobileItems.length > 1 && (
                        <Button
                          type="button"
                          onClick={() => removeMobileItem(index)}
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                        >
                          Rimuovi
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SEZIONE TELEPASS */}
          {(() => {
            const showTelepassSection = isTelepass();
            console.log("🔍 RENDER CHECK - Telepass section:", showTelepassSection);
            return showTelepassSection;
          })() && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">🚗 Telepass</h3>
              
              <div>
                <Label htmlFor="obu">OBU</Label>
                <Input
                  id="obu"
                  value={formData.obu}
                  onChange={(e) => setFormData({...formData, obu: e.target.value})}
                  placeholder="Inserisci codice OBU"
                />
              </div>
            </div>
          )}

          {/* SEZIONE MODALITÀ PAGAMENTO */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">💳 Modalità Pagamento</h3>
            
            <div>
              <Label htmlFor="modalita_pagamento">Modalità pagamento</Label>
              <select
                id="modalita_pagamento"
                value={formData.modalita_pagamento}
                onChange={(e) => setFormData({...formData, modalita_pagamento: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Seleziona Modalità...</option>
                {MODALITA_PAGAMENTO.map(modalita => (
                  <option key={modalita.value} value={modalita.value}>{modalita.label}</option>
                ))}
              </select>
            </div>

            {formData.modalita_pagamento === 'iban' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="iban">IBAN</Label>
                  <Input
                    id="iban"
                    value={formData.iban}
                    onChange={(e) => setFormData({...formData, iban: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="intestatario_diverso">Intestatario se diverso</Label>
                  <Input
                    id="intestatario_diverso"
                    value={formData.intestatario_diverso}
                    onChange={(e) => setFormData({...formData, intestatario_diverso: e.target.value})}
                  />
                </div>
              </div>
            )}

            {formData.modalita_pagamento === 'carta_credito' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="numero_carta">Numero Carta</Label>
                  <Input
                    id="numero_carta"
                    value={formData.numero_carta}
                    onChange={(e) => setFormData({...formData, numero_carta: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="mese_carta">Mese</Label>
                  <select
                    id="mese_carta"
                    value={formData.mese_carta}
                    onChange={(e) => setFormData({...formData, mese_carta: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Mese...</option>
                    {Array.from({length: 12}, (_, i) => (
                      <option key={i+1} value={String(i+1).padStart(2, '0')}>
                        {String(i+1).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="anno_carta">Anno</Label>
                  <select
                    id="anno_carta"
                    value={formData.anno_carta}
                    onChange={(e) => setFormData({...formData, anno_carta: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Anno...</option>
                    {Array.from({length: 10}, (_, i) => {
                      const year = new Date().getFullYear() + i;
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* SEZIONE CAMPI PERSONALIZZATI (dinamici per commessa + tipologia) */}
          <CustomFieldsSection
            fields={customFields}
            sections={customSections}
            values={customFieldValues}
            onChangeField={(name, value) => setCustomFieldValues(prev => ({ ...prev, [name]: value }))}
          />

          {/* SEZIONE NOTE */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">📝 Note</h3>
            
            <div>
              <Label htmlFor="note">Note</Label>
              <textarea
                id="note"
                rows={3}
                value={formData.note}
                onChange={(e) => setFormData({...formData, note: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Note aggiuntive..."
              />
            </div>
          </div>
            
          <DialogFooter className="mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowClientForm(false)}
              className="mr-2"
            >
              ← Torna alla Selezione
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700">
              ✅ Crea Cliente
            </Button>
          </DialogFooter>
          </form>
        )}

        {/* FOOTER BUTTONS for cascading flow */}
        {!showClientForm && (
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button 
              type="button" 
              disabled={!selectedData.offerta_id}
              onClick={() => setShowClientForm(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Continua → Scheda Cliente
            </Button>
          </DialogFooter>
        )}

      </DialogContent>
    </Dialog>
  );
};

// Import Clienti Modal Component

const ImportClientiModal = ({ isOpen, onClose, commesse, subAgenzie, selectedCommessa }) => {
  const [step, setStep] = useState(1); // 1: Upload, 2: Mapping, 3: Import
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mappings, setMappings] = useState([]);
  const [config, setConfig] = useState({
    commessa_id: selectedCommessa || '',
    sub_agenzia_id: '',
    skip_header: true,
    skip_duplicates: true,
    validate_phone: true,
    validate_email: true
  });
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const { toast } = useToast();

  // Campo mappings disponibili
  const availableFields = [
    { key: 'nome', label: 'Nome *', required: true },
    { key: 'cognome', label: 'Cognome *', required: true },
    { key: 'telefono', label: 'Telefono *', required: true },
    { key: 'email', label: 'Email', required: false },
    { key: 'indirizzo', label: 'Indirizzo', required: false },
    { key: 'citta', label: 'Città', required: false },
    { key: 'provincia', label: 'Provincia', required: false },
    { key: 'cap', label: 'CAP', required: false },
    { key: 'codice_fiscale', label: 'Codice Fiscale', required: false },
    { key: 'partita_iva', label: 'Partita IVA', required: false },
    { key: 'note', label: 'Note', required: false }
  ];

  useEffect(() => {
    if (selectedCommessa) {
      setConfig(prev => ({ ...prev, commessa_id: selectedCommessa }));
    }
  }, [selectedCommessa]);

  const handleFileUpload = async (uploadedFile) => {
    if (!uploadedFile) return;

    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(uploadedFile.type) && 
        !uploadedFile.name.toLowerCase().match(/\.(csv|xls|xlsx)$/)) {
      toast({
        title: "Formato non supportato",
        description: "Sono supportati solo file CSV, XLS e XLSX",
        variant: "destructive",
      });
      return;
    }

    setFile(uploadedFile);
    
    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      
      const response = await axios.post(`${API}/clienti/import/preview`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setPreview(response.data);
      
      // Initialize mappings with smart matching
      const initialMappings = availableFields.map(field => {
        const matchingHeader = response.data.headers.find(header => 
          header.toLowerCase().includes(field.key) || 
          field.key.includes(header.toLowerCase()) ||
          (field.key === 'nome' && header.toLowerCase().includes('name')) ||
          (field.key === 'telefono' && (header.toLowerCase().includes('phone') || header.toLowerCase().includes('tel'))) ||
          (field.key === 'email' && header.toLowerCase().includes('mail'))
        );
        
        return {
          csv_field: matchingHeader || '',
          client_field: field.key,
          required: field.required,
          example_value: matchingHeader ? response.data.sample_data[0]?.[response.data.headers.indexOf(matchingHeader)] || '' : ''
        };
      });
      
      setMappings(initialMappings);
      setStep(2);
      
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento del file",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!file || !config.commessa_id || !config.sub_agenzia_id) {
      toast({
        title: "Configurazione incompleta",
        description: "Seleziona commessa e sub agenzia",
        variant: "destructive",
      });
      return;
    }

    // Validate required mappings
    const requiredFields = ['nome', 'cognome', 'telefono'];
    const mappedFields = mappings.filter(m => m.csv_field !== '').map(m => m.client_field);
    const missingRequired = requiredFields.filter(field => !mappedFields.includes(field));
    
    if (missingRequired.length > 0) {
      toast({
        title: "Campi obbligatori mancanti",
        description: `Mappa i campi: ${missingRequired.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const importConfig = {
        ...config,
        field_mappings: mappings.filter(m => m.csv_field !== '')
      };
      
      formData.append('config', JSON.stringify(importConfig));
      
      const response = await axios.post(`${API}/clienti/import/execute`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setImportResult(response.data);
      setStep(3);
      
      toast({
        title: "Importazione completata",
        description: `${response.data.successful} clienti importati con successo`,
      });
      
    } catch (error) {
      console.error("Error importing:", error);
      toast({
        title: "Errore importazione",
        description: error.response?.data?.detail || "Errore durante l'importazione",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async (fileType) => {
    try {
      const response = await axios.get(`${API}/clienti/import/template/${fileType}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `template_clienti.${fileType}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error("Error downloading template:", error);
      toast({
        title: "Errore",
        description: "Errore nel download del template",
        variant: "destructive",
      });
    }
  };

  const resetModal = () => {
    setStep(1);
    setFile(null);
    setPreview(null);
    setMappings([]);
    setImportResult(null);
    setConfig({
      commessa_id: selectedCommessa || '',
      sub_agenzia_id: '',
      skip_header: true,
      skip_duplicates: true,
      validate_phone: true,
      validate_email: true
    });
  };

  const availableSubAgenzie = config.commessa_id && config.commessa_id !== ''
    ? subAgenzie.filter(sa => sa.commesse_autorizzate?.includes(config.commessa_id))
    : subAgenzie;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        resetModal();
        onClose();
      }
    }}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Upload className="w-5 h-5" />
            <span>Importa Clienti - Step {step}/3</span>
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload File */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Template Download */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Scarica Template</h3>
              <p className="text-sm text-blue-700 mb-3">
                Usa i nostri template per formattare correttamente i dati
              </p>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => downloadTemplate('csv')}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Template CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadTemplate('xlsx')}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Template Excel
                </Button>
              </div>
            </div>

            {/* File Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={(e) => handleFileUpload(e.target.files[0])}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Carica file clienti
                </p>
                <p className="text-sm text-gray-600">
                  Supportati: CSV, XLS, XLSX (max 10MB)
                </p>
                <Button variant="outline" className="mt-4">
                  Seleziona File
                </Button>
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Field Mapping */}
        {step === 2 && preview && (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Anteprima File</h3>
              <p className="text-sm text-gray-600">
                {preview.total_rows} righe trovate in {file.name} ({preview.file_type.toUpperCase()})
              </p>
            </div>

            {/* Configuration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Commessa *</Label>
                <Select 
                  value={config.commessa_id || "none"} 
                  onValueChange={(value) => setConfig({
                    ...config, 
                    commessa_id: value === "none" ? "" : value, 
                    sub_agenzia_id: ''
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona Commessa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seleziona Commessa</SelectItem>
                    {commesse.map((commessa) => (
                      <SelectItem key={commessa.id} value={commessa.id}>
                        {commessa.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Sub Agenzia *</Label>
                <Select 
                  value={config.sub_agenzia_id || "none"} 
                  onValueChange={(value) => setConfig({
                    ...config, 
                    sub_agenzia_id: value === "none" ? "" : value
                  })}
                  disabled={!config.commessa_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona Sub Agenzia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seleziona Sub Agenzia</SelectItem>
                    {availableSubAgenzie.map((subAgenzia) => (
                      <SelectItem key={subAgenzia.id} value={subAgenzia.id}>
                        {subAgenzia.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Field Mappings */}
            <div>
              <h3 className="font-medium mb-4">Mappatura Campi</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {mappings.map((mapping, index) => {
                  const field = availableFields.find(f => f.key === mapping.client_field);
                  return (
                    <div key={mapping.client_field} className="grid grid-cols-3 gap-4 items-center p-3 border rounded">
                      <div>
                        <Label className={field.required ? "text-red-600" : ""}>
                          {field.label}
                        </Label>
                      </div>
                      <div>
                        <Select 
                          value={mapping.csv_field || "none"}
                          onValueChange={(value) => {
                            const newMappings = [...mappings];
                            newMappings[index].csv_field = value === "none" ? "" : value;
                            if (value !== "none") {
                              const sampleIndex = preview.headers.indexOf(value);
                              newMappings[index].example_value = preview.sample_data[0]?.[sampleIndex] || '';
                            }
                            setMappings(newMappings);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona colonna CSV" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">-- Non mappare --</SelectItem>
                            {preview.headers.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="text-sm text-gray-600">
                        {mapping.example_value && (
                          <span>Es: {mapping.example_value}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={config.skip_duplicates}
                  onChange={(e) => setConfig({...config, skip_duplicates: e.target.checked})}
                />
                <span className="text-sm">Salta duplicati (stesso telefono)</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={config.validate_phone}
                  onChange={(e) => setConfig({...config, validate_phone: e.target.checked})}
                />
                <span className="text-sm">Valida numeri di telefono</span>
              </label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>
                Indietro
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : null}
                Avvia Importazione
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && importResult && (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Importazione Completata</h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">{importResult.successful}</div>
                <div className="text-sm text-green-700">Successo</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded">
                <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
                <div className="text-sm text-red-700">Errori</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded">
                <div className="text-2xl font-bold text-blue-600">{importResult.total_processed}</div>
                <div className="text-sm text-blue-700">Totale</div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div>
                <h4 className="font-medium text-red-600 mb-2">Errori Riscontrati:</h4>
                <div className="max-h-48 overflow-y-auto bg-red-50 p-3 rounded text-sm">
                  {importResult.errors.map((error, index) => (
                    <div key={index} className="text-red-700">{error}</div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={() => {
                resetModal();
                onClose();
              }}>
                Chiudi
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Main App Component

const ViewClienteModal = ({ cliente, onClose, commesse, subAgenzie, servizi }) => {
  const { user } = useAuth();
  const [offertaInfo, setOffertaInfo] = useState(null);
  const [subOffertaInfo, setSubOffertaInfo] = useState(null);  // NEW: Sub-offerta info
  const [servizioInfo, setServizioInfo] = useState(null);  // NEW: Servizio info
  const [assignedUserInfo, setAssignedUserInfo] = useState(null);  // NEW: Assigned user info
  const [simUsersInfo, setSimUsersInfo] = useState({});  // NEW: Cache for SIM assigned users
  
  // NEW: Custom fields for View
  const { fields: customFields, sections: customSections } = useClienteCustomFields(
    cliente?.commessa_id,
    cliente?.tipologia_contratto_id
  );

  // LOCK: acquire lock on mount (blocks other users from opening)
  const {
    loading: lockLoading,
    lockStatus,
    forceRelease: forceReleaseLock,
  } = useClienteLock(cliente?.id, !!cliente?.id);
  
  if (!cliente) return null;
  
  // NEW: Function to get user display name from cache or fetch
  const getUserDisplayName = (userId) => {
    if (!userId) return "N/A";
    if (simUsersInfo[userId]) {
      return simUsersInfo[userId];
    }
    return "Caricamento...";
  };
  
  const getCommessaName = (id) => commesse.find(c => c.id === id)?.nome || 'Non specificato';
  const getSubAgenziaName = (id) => subAgenzie.find(s => s.id === id)?.nome || 'Non specificato';
  const getServizioName = (id) => {
    // Try to get from fetched info first, then from array, then fallback
    if (servizioInfo && servizioInfo.id === id) {
      return servizioInfo.nome;
    }
    return servizi.find(s => s.id === id)?.nome || 'Non specificato';
  };

  // Fetch offerta info when component mounts
  useEffect(() => {
    const fetchOfferta = async () => {
      if (cliente.offerta_id) {
        try {
          const response = await axios.get(`${API}/offerte/${cliente.offerta_id}`);
          setOffertaInfo(response.data);
        } catch (error) {
          console.error("Error fetching offerta:", error);
        }
      }
    };
    fetchOfferta();
  }, [cliente.offerta_id]);
  
  // NEW: Fetch sub-offerta info when component mounts
  useEffect(() => {
    const fetchSubOfferta = async () => {
      if (cliente.sub_offerta_id) {
        try {
          const response = await axios.get(`${API}/offerte/${cliente.sub_offerta_id}`);
          setSubOffertaInfo(response.data);
        } catch (error) {
          console.error("Error fetching sub-offerta:", error);
        }
      }
    };
    fetchSubOfferta();
  }, [cliente.sub_offerta_id]);
  
  // NEW: Fetch servizio info when component mounts
  useEffect(() => {
    const fetchServizio = async () => {
      if (cliente.servizio_id) {
        try {
          const response = await axios.get(`${API}/servizi/${cliente.servizio_id}`);
          setServizioInfo(response.data);
        } catch (error) {
          console.error("Error fetching servizio:", error);
        }
      }
    };
    fetchServizio();
  }, [cliente.servizio_id]);

  // NEW: Fetch assigned user info when component mounts
  useEffect(() => {
    const fetchAssignedUser = async () => {
      if (cliente.assigned_to) {
        try {
          const response = await axios.get(`${API}/users/display-name/${cliente.assigned_to}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          setAssignedUserInfo(response.data);
        } catch (error) {
          console.error("Error fetching assigned user:", error);
        }
      }
    };
    fetchAssignedUser();
  }, [cliente.assigned_to]);

  // NEW: Fetch users info for SIM convergenza
  useEffect(() => {
    const fetchSimUsers = async () => {
      if (cliente.convergenza_items && cliente.convergenza_items.length > 0) {
        const userIds = cliente.convergenza_items
          .map(sim => sim.assigned_user_id)
          .filter(id => id && !simUsersInfo[id]); // Only fetch if not already cached
        
        if (userIds.length === 0) return;
        
        const newUsersInfo = { ...simUsersInfo };
        
        for (const userId of userIds) {
          try {
            const response = await axios.get(`${API}/users/display-name/${userId}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            newUsersInfo[userId] = response.data.display_name;
          } catch (error) {
            console.error(`Error fetching user ${userId}:`, error);
            newUsersInfo[userId] = 'Utente non trovato';
          }
        }
        
        setSimUsersInfo(newUsersInfo);
      }
    };
    fetchSimUsers();
  }, [cliente.convergenza_items]);

  // Helper per verificare se mostrare sezioni condizionali
  const isTelefoniaFastweb = () => {
    const tipologia = cliente.tipologia_contratto?.toLowerCase() || '';
    return tipologia.includes('telefonia') && !tipologia.includes('mobile');
  };

  const isMobile = () => {
    const tipologia = cliente.tipologia_contratto?.toLowerCase() || '';
    return tipologia.includes('mobile');
  };

  const isEnergiaFastweb = () => {
    const tipologia = cliente.tipologia_contratto?.toLowerCase() || '';
    return tipologia.includes('energia') || cliente.codice_pod;
  };

  const isTelepass = () => {
    const tipologia = cliente.tipologia_contratto?.toLowerCase() || '';
    return tipologia.includes('telepass') || cliente.obu;
  };

  // If locked by another user, show the locked screen instead of the full anagrafica
  if (lockStatus && lockStatus.owned_by_me === false) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-lg w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <span className="truncate">Anagrafica: {cliente.nome} {cliente.cognome}</span>
            </DialogTitle>
          </DialogHeader>
          <ClienteLockedScreen
            lockStatus={lockStatus}
            isAdmin={user?.role === 'admin'}
            onForceRelease={forceReleaseLock}
            onClose={onClose}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <span className="truncate">Anagrafica: {cliente.nome} {cliente.cognome}</span>
            </DialogTitle>
            {/* Close button - visible on mobile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="flex-shrink-0 h-10 w-10 p-0 rounded-full hover:bg-slate-100 md:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <DialogDescription className="hidden sm:block">
            Visualizzazione completa di tutti i dati anagrafici del cliente
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* Dati Anagrafici */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <User className="w-4 h-4 mr-2" />
                Dati Anagrafici
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cliente.segmento === 'business' && (
                <div>
                  <Label className="text-sm font-medium text-slate-600">Ragione Sociale</Label>
                  <p className="text-sm">{cliente.ragione_sociale || 'Non specificato'}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Cognome</Label>
                  <p className="text-sm">{cliente.cognome || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Nome</Label>
                  <p className="text-sm">{cliente.nome || 'Non specificato'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Data di Nascita</Label>
                  <p className="text-sm">{cliente.data_nascita || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Luogo di Nascita</Label>
                  <p className="text-sm">{cliente.luogo_nascita || 'Non specificato'}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Codice Fiscale</Label>
                <p className="text-sm font-mono">{cliente.codice_fiscale || 'Non specificato'}</p>
              </div>
              {cliente.segmento === 'business' && (
                <div>
                  <Label className="text-sm font-medium text-slate-600">Partita IVA</Label>
                  <p className="text-sm font-mono">{cliente.partita_iva || 'Non specificato'}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Indirizzo Residenza */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Indirizzo Residenza
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-slate-600">Indirizzo</Label>
                <p className="text-sm" data-testid="view-cliente-indirizzo">{cliente.indirizzo || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Comune</Label>
                <p className="text-sm">{cliente.comune_residenza || 'Non specificato'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Provincia</Label>
                  <p className="text-sm">{cliente.provincia || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">CAP</Label>
                  <p className="text-sm">{cliente.cap || 'Non specificato'}</p>
                </div>
              </div>
              {(cliente.indirizzo_attivazione || cliente.comune_attivazione || cliente.provincia_attivazione || cliente.cap_attivazione) && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                  <Label className="text-sm font-semibold text-amber-700">📍 Indirizzo Attivazione / Installazione</Label>
                  {cliente.indirizzo_attivazione && (
                    <div>
                      <Label className="text-xs font-medium text-slate-600">Indirizzo</Label>
                      <p className="text-sm" data-testid="view-cliente-indirizzo-attivazione">{cliente.indirizzo_attivazione}</p>
                    </div>
                  )}
                  {cliente.comune_attivazione && (
                    <div>
                      <Label className="text-xs font-medium text-slate-600">Comune</Label>
                      <p className="text-sm" data-testid="view-cliente-comune-attivazione">{cliente.comune_attivazione}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {cliente.provincia_attivazione && (
                      <div>
                        <Label className="text-xs font-medium text-slate-600">Provincia</Label>
                        <p className="text-sm" data-testid="view-cliente-provincia-attivazione">{cliente.provincia_attivazione}</p>
                      </div>
                    )}
                    {cliente.cap_attivazione && (
                      <div>
                        <Label className="text-xs font-medium text-slate-600">CAP</Label>
                        <p className="text-sm" data-testid="view-cliente-cap-attivazione">{cliente.cap_attivazione}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contatti */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Phone className="w-4 h-4 mr-2" />
                Contatti
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-slate-600">Email</Label>
                <p className="text-sm">{cliente.email || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Cellulare</Label>
                <p className="text-sm">{cliente.telefono || 'Non specificato'}</p>
              </div>
              {cliente.telefono2 && (
                <div>
                  <Label className="text-sm font-medium text-slate-600">Telefono 2</Label>
                  <p className="text-sm">{cliente.telefono2}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Documento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-slate-600">Tipo Documento</Label>
                <p className="text-sm uppercase">{cliente.tipo_documento || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Numero Documento</Label>
                <p className="text-sm font-mono">{cliente.numero_documento || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Rilasciato Il</Label>
                <p className="text-sm">{cliente.data_rilascio || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Da (Luogo Rilascio)</Label>
                <p className="text-sm">{cliente.luogo_rilascio || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Scadenza</Label>
                <p className="text-sm">{cliente.scadenza_documento || 'Non specificato'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Dati Organizzativi */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Building className="w-4 h-4 mr-2" />
                Dati Organizzativi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Numero Ordine</Label>
                  <p className="text-sm font-mono">{cliente.numero_ordine || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Account</Label>
                  <p className="text-sm">{cliente.account || 'Non specificato'}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Sub Agenzia</Label>
                <p className="text-sm">{getSubAgenziaName(cliente.sub_agenzia_id)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Commessa</Label>
                <p className="text-sm">{getCommessaName(cliente.commessa_id)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Servizio</Label>
                <p className="text-sm">{getServizioName(cliente.servizio_id)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Tipologia Contratto</Label>
                <p className="text-sm capitalize">
                  {cliente.tipologia_contratto?.replace(/_/g, ' ') || 'Non specificato'}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Segmento</Label>
                <p className="text-sm capitalize">
                  {cliente.segmento_nome || cliente.segmento || 'Non specificato'}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Offerta</Label>
                <p className="text-sm">{offertaInfo?.nome || cliente.offerta_id || 'Non specificato'}</p>
              </div>
              {/* NEW: Sub-Offerta */}
              {cliente.sub_offerta_id && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <Label className="text-sm font-semibold text-blue-900">📦 Sotto-Offerta</Label>
                  <p className="text-sm font-medium text-blue-800">
                    {subOffertaInfo?.nome || cliente.sub_offerta_id}
                  </p>
                  {subOffertaInfo?.descrizione && (
                    <p className="text-xs text-blue-700 mt-1">{subOffertaInfo.descrizione}</p>
                  )}
                </div>
              )}
              <div>
                <Label className="text-sm font-medium text-slate-600">Status</Label>
                <span className="inline-flex items-center">
                  <Badge variant={getClienteStatusVariant(cliente.status)}>
                    {formatClienteStatus(cliente.status)}
                  </Badge>
                  <PostVenditaStatusDot cliente={cliente} size="md" />
                </span>
              </div>
              
              {/* NEW: Assigned User */}
              {cliente.assigned_to && (
                <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                  <Label className="text-sm font-semibold text-purple-900">👤 Assegnato a</Label>
                  <p className="text-sm font-medium text-purple-800">
                    {assignedUserInfo?.display_name || cliente.assigned_to}
                  </p>
                  {assignedUserInfo?.username && (
                    <p className="text-xs text-purple-700 mt-1">
                      Username: {assignedUserInfo.username} | Ruolo: {assignedUserInfo.role}
                    </p>
                  )}
                </div>
              )}
              
              <div>
                <Label className="text-sm font-medium text-slate-600">Data Creazione</Label>
                <p className="text-sm">{new Date(cliente.created_at).toLocaleDateString('it-IT')}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sezione Telefonia Fissa - mostrata se commessa è Telefonia o se ci sono dati telefonia */}
        {(isTelefoniaFastweb() || cliente.tecnologia || cliente.codice_migrazione || cliente.gestore || cliente.numero_portabilita || cliente.convergenza) && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Phone className="w-4 h-4 mr-2" />
                Telefonia Fissa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Tecnologia</Label>
                  <p className="text-sm uppercase">{cliente.tecnologia || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Codice Migrazione</Label>
                  <p className="text-sm">{cliente.codice_migrazione || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Numero Portabilità</Label>
                  <p className="text-sm">{cliente.numero_portabilita || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Gestore</Label>
                  <p className="text-sm">{cliente.gestore || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Convergenza</Label>
                  <p className="text-sm">{cliente.convergenza ? 'Attiva' : 'Non attiva'}</p>
                </div>
              </div>

              {/* SIM Convergenza */}
              {cliente.convergenza && cliente.convergenza_items && cliente.convergenza_items.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-2">SIM Associate alla Convergenza</h4>
                  <div className="space-y-2">
                    {cliente.convergenza_items.map((sim, index) => (
                      <div key={index} className="p-3 border rounded bg-gray-50">
                        <h5 className="font-semibold mb-2">SIM #{index + 1}</h5>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <strong>Numero Cellulare:</strong> {sim.numero_cellulare || 'Non specificato'}
                          </div>
                          <div>
                            <strong>ICCID:</strong> {sim.iccid || 'Non specificato'}
                          </div>
                          <div>
                            <strong>Operatore:</strong> {sim.operatore || 'Non specificato'}
                          </div>
                          <div>
                            <strong>Offerta SIM:</strong> {sim.offerta_sim || 'Non specificato'}
                          </div>
                          {sim.assigned_user_id && (
                            <div className="col-span-2 bg-purple-50 p-2 rounded border-l-4 border-purple-400 mt-2">
                              <strong className="text-purple-800">👤 Utente Assegnato:</strong>{' '}
                              <span className="text-purple-900">
                                {getUserDisplayName(sim.assigned_user_id)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sezione Dati Mobile - Condizionale */}
        {isMobile() && cliente.mobile_items && cliente.mobile_items.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Smartphone className="w-4 h-4 mr-2" />
                Dati Mobile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {cliente.mobile_items.map((mobile, index) => (
                  <div key={index} className="p-3 border rounded bg-gray-50">
                    <h5 className="font-semibold mb-2">SIM #{index + 1}</h5>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <strong>Telefono da Portare:</strong> {mobile.telefono_da_portare || 'Non specificato'}
                      </div>
                      <div>
                        <strong>ICCID:</strong> {mobile.iccid || 'Non specificato'}
                      </div>
                      <div>
                        <strong>Operatore:</strong> {mobile.operatore || 'Non specificato'}
                      </div>
                      <div>
                        <strong>Titolare se Diverso:</strong> {mobile.titolare_diverso || 'Non specificato'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sezione Energia - mostrata se commessa è Energia Fastweb o se ci sono dati energia */}
        {((isEnergiaFastweb() && !isTelepass()) || cliente.codice_pod || cliente.energia_tipologia || cliente.energia_consumo_annuo || cliente.energia_potenza_contatore || cliente.energia_potenza_impegnata || cliente.energia_fornitore_attuale) && !isTelepass() && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Zap className="w-4 h-4 mr-2" />
                Energia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Tipologia</Label>
                  <p className="text-sm">{cliente.energia_tipologia || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Codice POD</Label>
                  <p className="text-sm font-mono">{cliente.codice_pod || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Consumo Annuo</Label>
                  <p className="text-sm">{cliente.energia_consumo_annuo || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Potenza Contatore</Label>
                  <p className="text-sm">{cliente.energia_potenza_contatore || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Potenza Impegnata</Label>
                  <p className="text-sm">{cliente.energia_potenza_impegnata || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Fornitore Attuale</Label>
                  <p className="text-sm" data-testid="view-cliente-fornitore-attuale">{cliente.energia_fornitore_attuale || 'Non specificato'}</p>
                </div>
              </div>
              {/* Vecchio intestatario - solo se popolato (Switch con voltura) */}
              {(cliente.energia_vecchio_intestatario_nome || cliente.energia_vecchio_intestatario_cognome || cliente.energia_vecchio_intestatario_cf) && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Vecchio Intestatario (Switch con voltura)</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-600">Nome</Label>
                      <p className="text-sm">{cliente.energia_vecchio_intestatario_nome || 'Non specificato'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-600">Cognome</Label>
                      <p className="text-sm">{cliente.energia_vecchio_intestatario_cognome || 'Non specificato'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-600">Codice Fiscale</Label>
                      <p className="text-sm font-mono">{cliente.energia_vecchio_intestatario_cf || 'Non specificato'}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sezione Telepass - mostrata se commessa è Telepass o se OBU è compilato */}
        {(isTelepass() || cliente.obu) && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Zap className="w-4 h-4 mr-2" />
                Telepass
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label className="text-sm font-medium text-slate-600">OBU</Label>
                <p className="text-sm font-mono">{cliente.obu || 'Non specificato'}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modalità Pagamento */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <CreditCard className="w-4 h-4 mr-2" />
              Modalità Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-600">Modalità Pagamento</Label>
                <p className="text-sm uppercase">{cliente.modalita_pagamento || 'Non specificato'}</p>
              </div>
              {cliente.modalita_pagamento === 'iban' && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">IBAN</Label>
                    <p className="text-sm font-mono">{cliente.iban || 'Non specificato'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Intestatario se Diverso</Label>
                    <p className="text-sm">{cliente.intestatario_diverso || 'Non specificato'}</p>
                  </div>
                </>
              )}
              {cliente.modalita_pagamento === 'carta_credito' && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Numero Carta</Label>
                    <p className="text-sm font-mono">{cliente.numero_carta || 'Non specificato'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Intestatario Carta</Label>
                    <p className="text-sm">{cliente.intestatario_carta || 'Non specificato'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">CVV</Label>
                    <p className="text-sm">{cliente.cvv_carta || 'Non specificato'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Mese Scadenza</Label>
                    <p className="text-sm">{cliente.mese_carta || 'Non specificato'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Anno Scadenza</Label>
                    <p className="text-sm">{cliente.anno_carta || 'Non specificato'}</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Campi Personalizzati - dinamici in base a (commessa + tipologia) */}
        <div className="mt-4">
          <CustomFieldsViewSection
            fields={customFields}
            sections={customSections}
            values={cliente?.dati_aggiuntivi || {}}
          />
        </div>

        {/* Sezione Post Vendita - evoluzione visibile a tutti gli utenti con accesso al cliente */}
        <div className="mt-4">
          <ClientePostVenditaSection clienteId={cliente?.id} clienteSnapshot={cliente} />
        </div>

        {/* Storico Note - immutabile, read-only in view */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Storico Note
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ClienteNotesHistory
                clienteId={cliente?.id}
                tipo="cliente"
                title="Note Cliente"
                accentColor="blue"
                readOnly={true}
                emptyMessage="Nessuna nota cliente presente."
              />
              <ClienteNotesHistory
                clienteId={cliente?.id}
                tipo="backoffice"
                title="Note Back Office"
                accentColor="orange"
                readOnly={true}
                emptyMessage="Nessuna nota back office presente."
              />
            </div>
          </CardContent>
        </Card>

        <DialogFooter className="mt-6 sticky bottom-0 bg-white pt-4 border-t md:border-t-0 md:pt-0 md:static">
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:justify-between">
            <PassToPostVenditaButton cliente={cliente} userRole={user?.role} />
            <Button onClick={onClose} className="w-full md:w-auto">Chiudi</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
// Duplicate ImportClientiModal removed - using the full version above

// Edit Cliente Modal Component  

const EditClienteModal = ({ cliente, onClose, onSubmit, commesse, subAgenzie, fromPostVendita = false }) => {
  const { user } = useAuth();
  const { toast: editToast } = useToast();
  
  // NEW: Custom fields for Edit
  const [customFieldValues, setCustomFieldValues] = useState(cliente?.dati_aggiuntivi || {});
  const { fields: customFields, sections: customSections } = useClienteCustomFields(
    cliente?.commessa_id,
    cliente?.tipologia_contratto_id
  );
  // NEW: Combined standard + custom statuses
  const { options: statusOptions } = useClienteStatusOptions(
    cliente?.commessa_id,
    cliente?.tipologia_contratto_id
  );

  // LOCK: acquire lock on mount (blocks other users from editing)
  const { lockStatus, forceRelease: forceReleaseLock } = useClienteLock(
    cliente?.id,
    !!cliente?.id
  );
  
  // Helper function to check if user can assign clients
  const canAssignClients = () => {
    if (!user) return false;
    const allowedRoles = ['admin', 'responsabile_commessa', 'backoffice_commessa'];
    return allowedRoles.includes(user.role);
  };
  
  // Helper function to check if user can edit restricted fields (convergenza, mobile items, payment)
  const canEditRestrictedFields = () => {
    if (!user) return false;
    return user.role === 'backoffice_commessa' || user.role === 'admin';
  };
  
  // Helper function to check if user can edit note_backoffice field
  const canEditNoteBackoffice = () => {
    if (!user) return false;
    return user.role === 'backoffice_commessa' || user.role === 'admin';
  };
  
  // Array delle tecnologie - stesso del form di creazione
  const TECNOLOGIE = [
    { value: 'fibra', label: 'FIBRA' },
    { value: 'ngn_gpon', label: 'NGN GPON' },
    { value: 'vula', label: 'VULA' },
    { value: 'svula', label: 'SVULA' },
    { value: 'bs_nga', label: 'BS_NGA' },
    { value: 'bs_gpon', label: 'BS_GPON' },
    { value: 'adsl', label: 'ADSL' },
    { value: 'adsl_ws', label: 'ADSL_WS' },
    { value: 'fwa', label: 'FWA' }
  ];

  // Helper per formattare le date per input[type="date"]
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    
    try {
      // Se è già una data in formato YYYY-MM-DD, restituiscila così
      if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateString;
      }
      
      // Altrimenti converte da ISO string o altro formato
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error("Error formatting date:", dateString, error);
      return '';
    }
  };

  const [formData, setFormData] = useState({
    // Dati base
    nome: cliente?.nome || '',
    cognome: cliente?.cognome || '',
    email: cliente?.email || '',
    telefono: cliente?.telefono || '',
    cellulare: cliente?.telefono2 || '',
    data_nascita: formatDateForInput(cliente?.data_nascita),
    luogo_nascita: cliente?.luogo_nascita || '',
    codice_fiscale: cliente?.codice_fiscale || '',
    provincia: cliente?.provincia || '',
    comune_residenza: cliente?.comune_residenza || '',
    indirizzo: cliente?.indirizzo || '',
    indirizzo_attivazione: cliente?.indirizzo_attivazione || '',
    comune_attivazione: cliente?.comune_attivazione || '',
    provincia_attivazione: cliente?.provincia_attivazione || '',
    cap_attivazione: cliente?.cap_attivazione || '',
    cap: cliente?.cap || '',
    
    // Campi aggiuntivi mancanti
    numero_ordine: cliente?.numero_ordine || '',
    account: cliente?.account || '',
    
    // Dati Business
    ragione_sociale: cliente?.ragione_sociale || '',
    partita_iva: cliente?.partita_iva || '',
    
    // Documento
    tipo_documento: cliente?.tipo_documento || '',
    numero_documento: cliente?.numero_documento || '',
    data_rilascio: formatDateForInput(cliente?.data_rilascio),
    luogo_rilascio: cliente?.luogo_rilascio || '',
    scadenza_documento: formatDateForInput(cliente?.scadenza_documento),
    
    // Campi Telefonia Fissa
    tecnologia: cliente?.tecnologia || '',
    codice_migrazione: cliente?.codice_migrazione || '',
    numero_portabilita: cliente?.numero_portabilita || '',
    gestore: cliente?.gestore || '',
    convergenza: cliente?.convergenza || false,
    convergenza_items: cliente?.convergenza_items || [],
    
    // Campi Dati Mobile
    mobile_items: cliente?.mobile_items || [],
    
    // Campi Energia Fastweb
    codice_pod: cliente?.codice_pod || '',
    energia_tipologia: cliente?.energia_tipologia || '',
    energia_consumo_annuo: cliente?.energia_consumo_annuo || '',
    energia_potenza_contatore: cliente?.energia_potenza_contatore || '',
    energia_potenza_impegnata: cliente?.energia_potenza_impegnata || '',
    energia_fornitore_attuale: cliente?.energia_fornitore_attuale || '',
    energia_vecchio_intestatario_nome: cliente?.energia_vecchio_intestatario_nome || '',
    energia_vecchio_intestatario_cognome: cliente?.energia_vecchio_intestatario_cognome || '',
    energia_vecchio_intestatario_cf: cliente?.energia_vecchio_intestatario_cf || '',
    
    // Campi Telepass
    obu: cliente?.obu || '',
    
    // Modalità Pagamento
    modalita_pagamento: cliente?.modalita_pagamento || '',
    iban: cliente?.iban || '',
    intestatario_diverso: cliente?.intestatario_diverso || '',
    numero_carta: cliente?.numero_carta || '',
    mese_carta: cliente?.mese_carta || '',
    anno_carta: cliente?.anno_carta || '',
    
    // Campi NON modificabili (solo visualizzazione)
    commessa_id: cliente?.commessa_id || '',
    sub_agenzia_id: cliente?.sub_agenzia_id || '',
    servizio_id: cliente?.servizio_id || '',
    tipologia_contratto: cliente?.tipologia_contratto || '',
    segmento: cliente?.segmento || '',
    offerta_id: cliente?.offerta_id || '',
    sub_offerta_id: cliente?.sub_offerta_id || '',  // NEW: Sub-offerta
    
    // Note e Status
    status: cliente?.status || 'da_inserire',
    note: cliente?.note || '',
    note_backoffice: cliente?.note_backoffice || ''
  });

  const [servizi, setServizi] = useState([]);
  const [editTipologieContratto, setEditTipologieContratto] = useState([]);
  const [segmenti, setSegmenti] = useState([]);
  const [offertaInfo, setOffertaInfo] = useState(null);
  const [subOfferte, setSubOfferte] = useState([]);  // NEW: Sub-offerte list
  const [servizioInfo, setServizioInfo] = useState(null);  // NEW: Servizio info
  const [isLoadingTipologie, setIsLoadingTipologie] = useState(true);
  const [isLoadingOfferta, setIsLoadingOfferta] = useState(false);
  const [availableOfferte, setAvailableOfferte] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);  // NEW: Users list for assignment
  const [assignedUserInfo, setAssignedUserInfo] = useState(null);  // NEW: Assigned user info
  const [selectedAssignedUser, setSelectedAssignedUser] = useState(cliente?.assigned_to || '');  // NEW: Selected user for assignment
  const [simUsersInfo, setSimUsersInfo] = useState({});  // NEW: Cache for SIM assigned users display names
  const [renderTrigger, setRenderTrigger] = useState(0);  // NEW: Force re-render when tipologia/segmento changes

  // Definizione di tutte le funzioni PRIMA del useEffect
  const fetchServizi = async (commessaId) => {
    try {
      const response = await axios.get(`${API}/cascade/servizi-by-commessa/${commessaId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setServizi(response.data);
    } catch (error) {
      console.error("Error fetching servizi:", error);
      setServizi([]);
    }
  };

  const fetchSegmenti = async (tipologiaId) => {
    if (!tipologiaId) {
      console.warn("⚠️ fetchSegmenti called without tipologiaId");
      setSegmenti([]);
      return;
    }
    try {
      console.log("🔄 Loading segmenti for tipologia:", tipologiaId);
      const response = await axios.get(`${API}/cascade/segmenti-by-tipologia/${tipologiaId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setSegmenti(response.data);
      console.log("✅ Segmenti loaded:", response.data.length, response.data);
    } catch (error) {
      console.error("❌ Error fetching segmenti:", error);
      setSegmenti([]);
    }
  };

  const fetchTipologieByServizio = async (servizioId) => {
    try {
      setIsLoadingTipologie(true);
      console.log("🔄 Loading tipologie for servizio:", servizioId);
      const response = await axios.get(`${API}/cascade/tipologie-by-servizio/${servizioId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setEditTipologieContratto(response.data);
      console.log("✅ Tipologie loaded:", response.data.length);
    } catch (error) {
      console.error("❌ Error fetching tipologie:", error);
      setEditTipologieContratto([]);
    } finally {
      setIsLoadingTipologie(false);
    }
  };

  const fetchAvailableOfferte = async (servizioId, tipologiaId, segmentoId) => {
    try {
      console.log("🔄 Loading offerte for:", { servizioId, tipologiaId, segmentoId, commessaId: cliente.commessa_id });
      const url = `${API}/cascade/offerte-by-filiera?commessa_id=${cliente.commessa_id}&servizio_id=${servizioId}&tipologia_id=${tipologiaId}&segmento_id=${segmentoId}`;
      console.log("📡 API URL:", url);
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      setAvailableOfferte(response.data);
      console.log("✅ Offerte loaded:", response.data.length, response.data);
    } catch (error) {
      console.error("❌ Error fetching offerte:", error.response?.data || error.message);
      setAvailableOfferte([]);
    }
  };

  const fetchOffertaInfo = async (offertaId) => {
    try {
      setIsLoadingOfferta(true);
      console.log("🔄 Loading offerta info for ID:", offertaId);
      const response = await axios.get(`${API}/offerte/${offertaId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setOffertaInfo(response.data);
    } catch (error) {
      console.error("❌ Error fetching offerta info:", error);
      setOffertaInfo(null);
    } finally {
      setIsLoadingOfferta(false);
    }
  };

  const fetchOfferteBySegmento = async (segmentoId) => {
    try {
      // Use the new /api/offerte endpoint with full filiera filters
      const params = { is_active: true };
      
      if (segmentoId) {
        params.segmento = segmentoId;
      }
      
      // Add filiera parameters from cliente data - USE UUIDs not enums!
      if (cliente?.commessa_id) {
        params.commessa_id = cliente.commessa_id;
      }
      if (cliente?.servizio_id) {
        params.servizio_id = cliente.servizio_id;
      }
      // For tipologia, we need to get the UUID, not the enum string
      // The cliente might have tipologia_contratto_id or we need to find it from tipologia_contratto
      if (cliente?.tipologia_contratto_id) {
        params.tipologia_contratto_id = cliente.tipologia_contratto_id;
      }
      
      const response = await axios.get(`${API}/offerte`, {
        params: params,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setAvailableOfferte(response.data);
    } catch (error) {
      console.error("❌ Error fetching offerte:", error);
      setAvailableOfferte([]);
    }
  };

  const fetchSubOfferte = async (offertaId) => {
    try {
      console.log("📦 Loading sub-offerte for offerta:", offertaId);
      const response = await axios.get(`${API}/offerte/${offertaId}/sub-offerte`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setSubOfferte(response.data);
      console.log("✅ Sub-offerte loaded:", response.data.length);
    } catch (error) {
      console.error("❌ Error fetching sub-offerte:", error);
      setSubOfferte([]);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      console.log("👥 Loading available users for assignment...");
      console.log("📋 Cliente info for filtering:", {
        commessa_id: cliente.commessa_id,
        sub_agenzia_id: cliente.sub_agenzia_id,
        servizio_id: cliente.servizio_id
      });
      
      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      console.log("📊 Total users fetched:", response.data.length);
      
      // Filter users based on cliente's commessa/sub_agenzia and servizio
      const filteredUsers = response.data.filter(user => {
        // Admin can always be assigned
        if (user.role === 'admin') {
          console.log(`✅ User ${user.username} (admin) - INCLUDED`);
          return true;
        }
        
        // Check if user has access to cliente's commessa OR sub_agenzia
        let hasCommessaOrSubAgenziaAccess = false;
        
        // Check commesse_autorizzate
        if (user.commesse_autorizzate && Array.isArray(user.commesse_autorizzate)) {
          if (user.commesse_autorizzate.includes(cliente.commessa_id)) {
            hasCommessaOrSubAgenziaAccess = true;
            console.log(`✅ User ${user.username} - has commessa ${cliente.commessa_id}`);
          }
        }
        
        // Check sub_agenzie_autorizzate (if user doesn't have commessa access)
        if (!hasCommessaOrSubAgenziaAccess && cliente.sub_agenzia_id) {
          if (user.sub_agenzie_autorizzate && Array.isArray(user.sub_agenzie_autorizzate)) {
            if (user.sub_agenzie_autorizzate.includes(cliente.sub_agenzia_id)) {
              hasCommessaOrSubAgenziaAccess = true;
              console.log(`✅ User ${user.username} - has sub_agenzia ${cliente.sub_agenzia_id}`);
            }
          }
        }
        
        if (!hasCommessaOrSubAgenziaAccess) {
          console.log(`❌ User ${user.username} - NO access to commessa or sub_agenzia`);
          return false;
        }
        
        // Check if user has access to cliente's servizio (if cliente has one)
        if (cliente.servizio_id) {
          if (!user.servizi_autorizzati || !Array.isArray(user.servizi_autorizzati)) {
            console.log(`❌ User ${user.username} - NO servizi_autorizzati`);
            return false;
          }
          
          if (!user.servizi_autorizzati.includes(cliente.servizio_id)) {
            console.log(`❌ User ${user.username} - servizio ${cliente.servizio_id} NOT in [${user.servizi_autorizzati.join(', ')}]`);
            return false;
          }
        }
        
        console.log(`✅ User ${user.username} - INCLUDED (has access to commessa/sub_agenzia and servizio)`);
        return true;
      });
      
      setAvailableUsers(filteredUsers);
      console.log("✅ Available users loaded and filtered:", filteredUsers.length, "of", response.data.length);
      console.log("👥 Filtered users:", filteredUsers.map(u => u.username).join(', '));
    } catch (error) {
      console.error("❌ Error fetching available users:", error);
      setAvailableUsers([]);
    }
  };

  const fetchAssignedUserInfo = async (userId) => {
    if (!userId) {
      setAssignedUserInfo(null);
      return;
    }
    try {
      console.log("👤 Loading assigned user info for ID:", userId);
      const response = await axios.get(`${API}/users/display-name/${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setAssignedUserInfo(response.data);
      console.log("✅ Assigned user info loaded:", response.data);
    } catch (error) {
      console.error("❌ Error fetching assigned user info:", error);
      setAssignedUserInfo(null);
    }
  };
  
  // NEW: Function to get user display name from cache
  const getUserDisplayName = (userId) => {
    if (!userId) return "N/A";
    if (simUsersInfo[userId]) {
      return simUsersInfo[userId];
    }
    return "Caricamento...";
  };

  const handleAssignUser = async (newUserId) => {
    if (!newUserId || newUserId === selectedAssignedUser) {
      return;  // No change
    }

    try {
      console.log("🔄 Assigning client to user:", newUserId);
      const response = await axios.put(
        `${API}/clienti/${cliente.id}/assign?assigned_to=${newUserId}`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );
      
      setSelectedAssignedUser(newUserId);
      await fetchAssignedUserInfo(newUserId);
      console.log("✅ Client assigned successfully");
      
      // Show success message
      alert(`Cliente assegnato con successo!`);
    } catch (error) {
      console.error("❌ Error assigning client:", error);
      alert(`Errore nell'assegnazione del client: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // NEW: If offerta_id changes, load sub-offerte
    if (field === 'offerta_id' && value) {
      fetchSubOfferte(value);
    }
  };

  // Funzioni per rilevare i campi condizionali basati sui dati CORRENTI del form - AGGIORNATE DINAMICAMENTE
  const isEditEnergiaFastweb = () => {
    try {
      // Usa formData.tipologia_contratto (valore corrente) invece di cliente.tipologia_contratto
      const currentTipologiaId = formData.tipologia_contratto;
      
      // Trova la tipologia corrente per ottenere il nome
      if (Array.isArray(editTipologieContratto) && editTipologieContratto.length > 0 && currentTipologiaId) {
        const tipologia = editTipologieContratto.find(t => t && t.id === currentTipologiaId);
        const tipologiaName = (tipologia?.nome || '').toLowerCase();
        const isEnergia = tipologiaName.includes('energia') || 
                         tipologiaName.includes('fotovoltaico') || 
                         tipologiaName.includes('solare') || 
                         tipologiaName.includes('pod') ||
                         tipologiaName.includes('luce') ||
                         tipologiaName.includes('gas');
        console.log("🔍 isEditEnergiaFastweb: Dynamic check:", {tipologiaName, isEnergia});
        return isEnergia;
      }
      
      return false;
    } catch (error) {
      console.error("❌ Error in isEditEnergiaFastweb:", error);
      return false;
    }
  };

  const isEditMobile = () => {
    try {
      // Usa formData.tipologia_contratto (valore corrente) invece di cliente.tipologia_contratto
      const currentTipologiaId = formData.tipologia_contratto;
      
      // Trova la tipologia corrente per ottenere il nome
      if (Array.isArray(editTipologieContratto) && editTipologieContratto.length > 0 && currentTipologiaId) {
        const tipologia = editTipologieContratto.find(t => t && t.id === currentTipologiaId);
        const tipologiaName = (tipologia?.nome || '').toLowerCase();
        const isMobile = tipologiaName.includes('mobile');
        console.log("🔍 isEditMobile: Dynamic check:", {tipologiaName, isMobile});
        return isMobile;
      }
      
      return false;
    } catch (error) {
      console.error("❌ Error in isEditMobile:", error);
      return false;
    }
  };

  const isEditTelepass = () => {
    try {
      // Usa formData.tipologia_contratto (valore corrente) invece di cliente.tipologia_contratto
      const currentTipologiaId = formData.tipologia_contratto;
      
      // Trova la tipologia corrente per ottenere il nome
      if (Array.isArray(editTipologieContratto) && editTipologieContratto.length > 0 && currentTipologiaId) {
        const tipologia = editTipologieContratto.find(t => t && t.id === currentTipologiaId);
        const tipologiaName = (tipologia?.nome || '').toLowerCase();
        const isTelepass = tipologiaName.includes('telepass');
        console.log("🚗 isEditTelepass: Dynamic check:", {tipologiaName, isTelepass});
        return isTelepass;
      }
      
      return false;
    } catch (error) {
      console.error("❌ Error in isEditTelepass:", error);
      return false;
    }
  };

  const isEditTelefoniaFastweb = () => {
    try {
      // Usa formData.tipologia_contratto (valore corrente) invece di cliente.tipologia_contratto
      const currentTipologiaId = formData.tipologia_contratto;
      
      // Trova la tipologia corrente per ottenere il nome
      if (Array.isArray(editTipologieContratto) && editTipologieContratto.length > 0 && currentTipologiaId) {
        const tipologia = editTipologieContratto.find(t => t && t.id === currentTipologiaId);
        const tipologiaName = (tipologia?.nome || '').toLowerCase();
        const isTelefonia = tipologiaName.includes('telefonia') || 
                           tipologiaName.includes('mobile') ||
                           tipologiaName.includes('sim') ||
                           tipologiaName.includes('voce') ||
                           tipologiaName.includes('dati');
        console.log("🔍 isEditTelefoniaFastweb: Dynamic check:", {tipologiaName, isTelefonia});
        return isTelefonia;
      }
      
      return false;
    } catch (error) {
      console.error("❌ Error in isEditTelefoniaFastweb:", error);
      return false;
    }
  };

  const isEditBusinessSegment = () => {
    try {
      // Usa formData.segmento (valore corrente) invece di cliente.segmento
      const currentSegmentoId = formData.segmento;
      
      // Trova il segmento corrente per ottenere il tipo
      if (Array.isArray(segmenti) && segmenti.length > 0 && currentSegmentoId) {
        const segmento = segmenti.find(s => s && s.id === currentSegmentoId);
        const segmentoTipo = (segmento?.tipo || '').toLowerCase();
        const isBusiness = segmentoTipo === 'business';
        console.log("🔍 isEditBusinessSegment: Dynamic check:", {segmentoTipo, isBusiness});
        return isBusiness;
      }
      
      return false;
    } catch (error) {
      console.error("❌ Error in isEditBusinessSegment:", error);
      return false;
    }
  };

  useEffect(() => {
    // Carica servizi basandosi sulla commessa del cliente
    if (formData.commessa_id) {
      fetchServizi(formData.commessa_id);
    }
    
    // Carica info offerta corrente del cliente
    if (cliente?.offerta_id) {
      fetchOffertaInfo(cliente.offerta_id);
    }
    
    // Carica tipologie contratto per risolvere i nomi
    if (formData.servizio_id) {
      fetchTipologieByServizio(formData.servizio_id);
    }
    
    // NON caricare segmenti e offerte qui - aspetta che tipologie siano caricate
    // I segmenti dipendono dalla tipologia, vedi useEffect separato sotto
  }, []);

  // Trigger re-render quando i dati vengono caricati
  useEffect(() => {
    if (!isLoadingTipologie) {
      console.log("🔄 Tipologie loaded, re-evaluating conditional sections");
      // Force re-evaluation by updating a dummy state if needed
      // The conditional functions will be called again during render
    }
  }, [isLoadingTipologie, editTipologieContratto]);

  // NEW: Load segmenti when tipologie are ready
  useEffect(() => {
    // Wait for tipologie to be loaded
    if (!isLoadingTipologie && editTipologieContratto.length > 0) {
      // Helper: normalize string for comparison (remove spaces/underscores, lowercase)
      const normalize = (str) => (str || '').toLowerCase().replace(/[_\s]/g, '');
      
      // Find UUID for tipologia (cliente might store UUID or nome/enum)
      const tipologiaByUUID = editTipologieContratto.find(t => t.id === cliente?.tipologia_contratto);
      const tipologiaByNome = editTipologieContratto.find(t => 
        normalize(t.nome) === normalize(cliente?.tipologia_contratto)
      );
      const tipologiaUUID = tipologiaByUUID?.id || tipologiaByNome?.id || cliente?.tipologia_contratto;
      
      console.log("🔍 Resolved tipologia UUID:", {
        cliente_value: cliente?.tipologia_contratto,
        resolved_uuid: tipologiaUUID,
        found_by: tipologiaByUUID ? 'UUID' : tipologiaByNome ? 'nome' : 'fallback'
      });
      
      // Update formData with correct UUID so dropdown shows selected value
      if (tipologiaUUID && tipologiaUUID !== formData.tipologia_contratto) {
        console.log("✏️ Updating formData.tipologia_contratto:", tipologiaUUID);
        setFormData(prev => ({
          ...prev,
          tipologia_contratto: tipologiaUUID
        }));
      }
      
      // Load segmenti for this tipologia
      if (tipologiaUUID) {
        fetchSegmenti(tipologiaUUID);
      }
    }
  }, [isLoadingTipologie, editTipologieContratto]);

  // NEW: Load offerte when both tipologie and segmenti are ready
  useEffect(() => {
    if (!isLoadingTipologie && editTipologieContratto.length > 0 && segmenti.length > 0) {
      // Helper: normalize string for comparison
      const normalize = (str) => (str || '').toLowerCase().replace(/[_\s]/g, '');
      
      // Find UUID for tipologia
      const tipologiaByUUID = editTipologieContratto.find(t => t.id === cliente?.tipologia_contratto);
      const tipologiaByNome = editTipologieContratto.find(t => 
        normalize(t.nome) === normalize(cliente?.tipologia_contratto)
      );
      const tipologiaUUID = tipologiaByUUID?.id || tipologiaByNome?.id || cliente?.tipologia_contratto;
      
      // Find UUID for segmento (cliente might store UUID or tipo)
      const segmentoByUUID = segmenti.find(s => s.id === cliente?.segmento);
      const segmentoByTipo = segmenti.find(s => s.tipo === cliente?.segmento);
      const segmentoByNome = segmenti.find(s => normalize(s.nome) === normalize(cliente?.segmento));
      const segmentoUUID = segmentoByUUID?.id || segmentoByTipo?.id || segmentoByNome?.id || cliente?.segmento;
      
      console.log("🔍 Resolving IDs for offerte query:", {
        tipologia_cliente: cliente?.tipologia_contratto,
        tipologia_uuid: tipologiaUUID,
        segmento_cliente: cliente?.segmento,
        segmento_uuid: segmentoUUID,
        segmento_found_by: segmentoByUUID ? 'UUID' : segmentoByTipo ? 'tipo' : segmentoByNome ? 'nome' : 'fallback'
      });
      
      // Update formData with correct UUIDs so dropdowns show selected values
      let needsUpdate = false;
      const updates = {};
      
      if (segmentoUUID && segmentoUUID !== formData.segmento) {
        console.log("✏️ Updating formData.segmento:", segmentoUUID);
        updates.segmento = segmentoUUID;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        setFormData(prev => ({
          ...prev,
          ...updates
        }));
      }
      
      // Now load offerte with correct UUIDs
      if (formData.servizio_id && tipologiaUUID && segmentoUUID) {
        console.log("🔄 Loading initial offerte for cliente:", {
          servizio: formData.servizio_id,
          tipologia: tipologiaUUID,
          segmento: segmentoUUID
        });
        fetchAvailableOfferte(formData.servizio_id, tipologiaUUID, segmentoUUID);
      }
    }
  }, [isLoadingTipologie, editTipologieContratto, segmenti]);

  // NEW: Load sub-offerte when component mounts if cliente has offerta_id
  useEffect(() => {
    if (cliente?.offerta_id) {
      fetchSubOfferte(cliente.offerta_id);
    }
  }, [cliente?.offerta_id]);
  
  // NEW: Load servizio info when component mounts
  useEffect(() => {
    const fetchServizio = async () => {
      if (cliente?.servizio_id) {
        try {
          const response = await axios.get(`${API}/servizi/${cliente.servizio_id}`);
          setServizioInfo(response.data);
        } catch (error) {
          console.error("Error fetching servizio:", error);
        }
      }
    };
    fetchServizio();
  }, [cliente?.servizio_id]);

  // NEW: Load available users for assignment when component mounts
  useEffect(() => {
    fetchAvailableUsers();
  }, []);

  // NEW: Load assigned user info when component mounts or assigned_to changes
  useEffect(() => {
    if (cliente?.assigned_to) {
      fetchAssignedUserInfo(cliente.assigned_to);
    }
  }, [cliente?.assigned_to]);
  
  // NEW: Load SIM assigned users info
  useEffect(() => {
    const fetchSimUsers = async () => {
      if (cliente?.convergenza_items && cliente.convergenza_items.length > 0) {
        const userIds = cliente.convergenza_items
          .map(sim => sim.assigned_user_id)
          .filter(id => id && !simUsersInfo[id]); // Only fetch if not already cached
        
        if (userIds.length === 0) return;
        
        const newUsersInfo = { ...simUsersInfo };
        
        for (const userId of userIds) {
          try {
            const response = await axios.get(`${API}/users/display-name/${userId}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            newUsersInfo[userId] = response.data.display_name;
          } catch (error) {
            console.error(`Error fetching SIM user ${userId}:`, error);
            newUsersInfo[userId] = 'Utente non trovato';
          }
        }
        
        setSimUsersInfo(newUsersInfo);
      }
    };
    fetchSimUsers();
  }, [cliente?.convergenza_items]);

  // Funzioni duplicate rimosse - ora definite prima del useEffect

  // Funzioni per gestire i campi modificabili (i dati organizzativi non sono più modificabili)

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validazione campi personalizzati obbligatori
    const missingCustomFields = validateRequiredCustomFields(customFields, customFieldValues);
    if (missingCustomFields.length > 0) {
      editToast({
        title: "Campi personalizzati obbligatori",
        description: `Compila: ${missingCustomFields.join(', ')}`,
        variant: "destructive"
      });
      return;
    }
    
    // Mappa i campi frontend ai nomi backend
    const backendData = {
      ...formData,
      telefono2: formData.cellulare,  // Mappa cellulare -> telefono2
      // FIX: Convert empty strings to null for enum fields
      tipo_documento: formData.tipo_documento || null,
      tecnologia: formData.tecnologia || null,
      modalita_pagamento: formData.modalita_pagamento || null,
      // NEW: Include custom fields values
      dati_aggiuntivi: customFieldValues || {}
    };
    
    // Rimuovi i campi frontend che non devono essere inviati al backend
    delete backendData.cellulare;
    
    console.log("🔄 Submitting edit cliente data:", {
      frontend_data: formData,
      backend_data: backendData
    });
    
    // FIX: Close modal immediately before async operation
    onClose();
    
    onSubmit(backendData);
  };

  // handleChange già definito sopra

  // Debug: Verifica che il componente arrivi al render finale
  console.log("🎯 EditClienteModal: RENDERING COMPLETE - All functions defined, ready to render JSX");

  // If locked by another user, show the locked screen instead of the edit form
  if (lockStatus && lockStatus.owned_by_me === false) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-lg w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Edit className="w-5 h-5 text-blue-600" />
              <span className="truncate">Modifica: {cliente?.nome} {cliente?.cognome}</span>
            </DialogTitle>
          </DialogHeader>
          <ClienteLockedScreen
            lockStatus={lockStatus}
            isAdmin={user?.role === 'admin'}
            onForceRelease={forceReleaseLock}
            onClose={onClose}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center space-x-2">
              <Edit className="w-5 h-5 text-blue-600" />
              <span className="truncate">Modifica: {cliente?.nome} {cliente?.cognome}</span>
            </DialogTitle>
            {/* Close button - visible on mobile */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="flex-shrink-0 h-10 w-10 p-0 rounded-full hover:bg-slate-100 md:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <DialogDescription className="hidden sm:block">
            Modifica i dati anagrafici del cliente. I campi contrassegnati con * sono obbligatori.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Dati Personali */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">👤 Dati Personali</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => handleChange('nome', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cognome">Cognome *</Label>
                  <Input
                    id="cognome"
                    value={formData.cognome}
                    onChange={(e) => handleChange('cognome', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="telefono">Cellulare</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) => handleChange('telefono', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="cellulare">Telefono 2</Label>
                  <Input
                    id="cellulare"
                    value={formData.cellulare}
                    onChange={(e) => handleChange('cellulare', e.target.value)}
                    placeholder="Numero telefono cellulare"
                  />
                </div>
                <div>
                  <Label htmlFor="data_nascita">Nato/a</Label>
                  <Input
                    id="data_nascita"
                    type="date"
                    value={formData.data_nascita}
                    onChange={(e) => handleChange('data_nascita', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="luogo_nascita">A</Label>
                  <Input
                    id="luogo_nascita"
                    value={formData.luogo_nascita}
                    onChange={(e) => handleChange('luogo_nascita', e.target.value)}
                    placeholder="Luogo di nascita"
                  />
                </div>
                <div>
                  <Label htmlFor="codice_fiscale">Codice Fiscale *</Label>
                  <Input
                    id="codice_fiscale"
                    value={formData.codice_fiscale}
                    onChange={(e) => handleChange('codice_fiscale', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="numero_ordine">Numero Ordine</Label>
                  <Input
                    id="numero_ordine"
                    value={formData.numero_ordine}
                    onChange={(e) => handleChange('numero_ordine', e.target.value)}
                    placeholder="Inserisci numero ordine"
                  />
                </div>
                <div>
                  <Label htmlFor="account">Account</Label>
                  <Input
                    id="account"
                    value={formData.account}
                    onChange={(e) => handleChange('account', e.target.value)}
                    placeholder="Inserisci account"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Indirizzo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🏠 Indirizzi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* SEZIONE INDIRIZZO RESIDENZA */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">🏠 Indirizzo Residenza</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="indirizzo">Indirizzo Residenza</Label>
                    <Input
                      id="indirizzo"
                      value={formData.indirizzo || ''}
                      onChange={(e) => handleChange('indirizzo', e.target.value)}
                      placeholder="Via/Piazza, numero civico"
                      data-testid="edit-cliente-indirizzo-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="comune_residenza">Comune Residenza</Label>
                    <Input
                      id="comune_residenza"
                      value={formData.comune_residenza || ''}
                      onChange={(e) => handleChange('comune_residenza', e.target.value)}
                      placeholder="Inserisci comune"
                      data-testid="edit-cliente-comune-residenza-input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="provincia">Provincia</Label>
                      <select
                        id="provincia"
                        value={formData.provincia || ''}
                        onChange={(e) => handleChange('provincia', e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        data-testid="edit-cliente-provincia-select"
                      >
                        <option value="">Prov.</option>
                        {PROVINCE_ITALIANE.map(prov => (
                          <option key={prov} value={prov}>{prov}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="cap">CAP</Label>
                      <Input
                        id="cap"
                        value={formData.cap || ''}
                        onChange={(e) => handleChange('cap', e.target.value)}
                        placeholder="00000"
                        data-testid="edit-cliente-cap-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SEZIONE INDIRIZZO ATTIVAZIONE */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">📍 Indirizzo Attivazione (se diverso dalla residenza)</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="indirizzo_attivazione">Indirizzo Attivazione</Label>
                    <Input
                      id="indirizzo_attivazione"
                      value={formData.indirizzo_attivazione || ''}
                      onChange={(e) => handleChange('indirizzo_attivazione', e.target.value)}
                      placeholder="Via/Piazza per l'attivazione"
                      data-testid="edit-cliente-indirizzo-attivazione-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="comune_attivazione">Comune Attivazione</Label>
                    <Input
                      id="comune_attivazione"
                      value={formData.comune_attivazione || ''}
                      onChange={(e) => handleChange('comune_attivazione', e.target.value)}
                      data-testid="edit-cliente-comune-attivazione-input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="provincia_attivazione">Prov. Att.</Label>
                      <select
                        id="provincia_attivazione"
                        value={formData.provincia_attivazione || ''}
                        onChange={(e) => handleChange('provincia_attivazione', e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                        data-testid="edit-cliente-provincia-attivazione-select"
                      >
                        <option value="">Prov.</option>
                        {PROVINCE_ITALIANE.map(prov => (
                          <option key={prov} value={prov}>{prov}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="cap_attivazione">CAP Att.</Label>
                      <Input
                        id="cap_attivazione"
                        value={formData.cap_attivazione || ''}
                        onChange={(e) => handleChange('cap_attivazione', e.target.value)}
                        placeholder="00000"
                        data-testid="edit-cliente-cap-attivazione-input"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* LEGACY_PROVINCE_BLOCK_REMOVED */}
          <Card style={{display: 'none'}}>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="provincia_legacy">Provincia</Label>
                  <select
                    id="provincia_legacy"
                    value={formData.provincia || ''}
                    onChange={(e) => handleChange('provincia', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seleziona provincia</option>
                    <option value="AG">AG - Agrigento</option>
                    <option value="AL">AL - Alessandria</option>
                    <option value="AN">AN - Ancona</option>
                    <option value="AO">AO - Aosta</option>
                    <option value="AR">AR - Arezzo</option>
                    <option value="AP">AP - Ascoli Piceno</option>
                    <option value="AT">AT - Asti</option>
                    <option value="AV">AV - Avellino</option>
                    <option value="BA">BA - Bari</option>
                    <option value="BT">BT - Barletta-Andria-Trani</option>
                    <option value="BL">BL - Belluno</option>
                    <option value="BN">BN - Benevento</option>
                    <option value="BG">BG - Bergamo</option>
                    <option value="BI">BI - Biella</option>
                    <option value="BO">BO - Bologna</option>
                    <option value="BZ">BZ - Bolzano</option>
                    <option value="BS">BS - Brescia</option>
                    <option value="BR">BR - Brindisi</option>
                    <option value="CA">CA - Cagliari</option>
                    <option value="CL">CL - Caltanissetta</option>
                    <option value="CB">CB - Campobasso</option>
                    <option value="CE">CE - Caserta</option>
                    <option value="CT">CT - Catania</option>
                    <option value="CZ">CZ - Catanzaro</option>
                    <option value="CH">CH - Chieti</option>
                    <option value="CO">CO - Como</option>
                    <option value="CS">CS - Cosenza</option>
                    <option value="CR">CR - Cremona</option>
                    <option value="KR">KR - Crotone</option>
                    <option value="CN">CN - Cuneo</option>
                    <option value="EN">EN - Enna</option>
                    <option value="FM">FM - Fermo</option>
                    <option value="FE">FE - Ferrara</option>
                    <option value="FI">FI - Firenze</option>
                    <option value="FG">FG - Foggia</option>
                    <option value="FC">FC - Forlì-Cesena</option>
                    <option value="FR">FR - Frosinone</option>
                    <option value="GE">GE - Genova</option>
                    <option value="GO">GO - Gorizia</option>
                    <option value="GR">GR - Grosseto</option>
                    <option value="IM">IM - Imperia</option>
                    <option value="IS">IS - Isernia</option>
                    <option value="AQ">AQ - L'Aquila</option>
                    <option value="SP">SP - La Spezia</option>
                    <option value="LT">LT - Latina</option>
                    <option value="LE">LE - Lecce</option>
                    <option value="LC">LC - Lecco</option>
                    <option value="LI">LI - Livorno</option>
                    <option value="LO">LO - Lodi</option>
                    <option value="LU">LU - Lucca</option>
                    <option value="MC">MC - Macerata</option>
                    <option value="MN">MN - Mantova</option>
                    <option value="MS">MS - Massa-Carrara</option>
                    <option value="MT">MT - Matera</option>
                    <option value="ME">ME - Messina</option>
                    <option value="MI">MI - Milano</option>
                    <option value="MO">MO - Modena</option>
                    <option value="MB">MB - Monza e Brianza</option>
                    <option value="NA">NA - Napoli</option>
                    <option value="NO">NO - Novara</option>
                    <option value="NU">NU - Nuoro</option>
                    <option value="OR">OR - Oristano</option>
                    <option value="PD">PD - Padova</option>
                    <option value="PA">PA - Palermo</option>
                    <option value="PR">PR - Parma</option>
                    <option value="PV">PV - Pavia</option>
                    <option value="PG">PG - Perugia</option>
                    <option value="PU">PU - Pesaro e Urbino</option>
                    <option value="PE">PE - Pescara</option>
                    <option value="PC">PC - Piacenza</option>
                    <option value="PI">PI - Pisa</option>
                    <option value="PT">PT - Pistoia</option>
                    <option value="PN">PN - Pordenone</option>
                    <option value="PZ">PZ - Potenza</option>
                    <option value="PO">PO - Prato</option>
                    <option value="RG">RG - Ragusa</option>
                    <option value="RA">RA - Ravenna</option>
                    <option value="RC">RC - Reggio Calabria</option>
                    <option value="RE">RE - Reggio Emilia</option>
                    <option value="RI">RI - Rieti</option>
                    <option value="RN">RN - Rimini</option>
                    <option value="RM">RM - Roma</option>
                    <option value="RO">RO - Rovigo</option>
                    <option value="SA">SA - Salerno</option>
                    <option value="SS">SS - Sassari</option>
                    <option value="SV">SV - Savona</option>
                    <option value="SI">SI - Siena</option>
                    <option value="SR">SR - Siracusa</option>
                    <option value="SO">SO - Sondrio</option>
                    <option value="SU">SU - Sud Sardegna</option>
                    <option value="TA">TA - Taranto</option>
                    <option value="TE">TE - Teramo</option>
                    <option value="TR">TR - Terni</option>
                    <option value="TO">TO - Torino</option>
                    <option value="TP">TP - Trapani</option>
                    <option value="TN">TN - Trento</option>
                    <option value="TV">TV - Treviso</option>
                    <option value="TS">TS - Trieste</option>
                    <option value="UD">UD - Udine</option>
                    <option value="VA">VA - Varese</option>
                    <option value="VE">VE - Venezia</option>
                    <option value="VB">VB - Verbano-Cusio-Ossola</option>
                    <option value="VC">VC - Vercelli</option>
                    <option value="VR">VR - Verona</option>
                    <option value="VV">VV - Vibo Valentia</option>
                    <option value="VI">VI - Vicenza</option>
                    <option value="VT">VT - Viterbo</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dati Organizzativi (NON MODIFICABILI) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dati Organizzativi <span className="text-sm text-gray-500">(Non modificabili)</span></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Commessa</Label>
                  <p className="text-sm p-2 bg-gray-50 border rounded">
                    {commesse.find(c => c.id === cliente?.commessa_id)?.nome || 'Non disponibile'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Sub Agenzia</Label>
                  {user && ['admin', 'responsabile_commessa', 'backoffice_commessa'].includes(user.role) ? (
                    <select
                      value={formData.sub_agenzia_id || cliente?.sub_agenzia_id || ''}
                      onChange={(e) => handleChange('sub_agenzia_id', e.target.value)}
                      className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      data-testid="edit-cliente-sub-agenzia-select"
                    >
                      <option value="">Seleziona Sub Agenzia</option>
                      {Array.isArray(subAgenzie) && subAgenzie
                        .filter(sa => !cliente?.commessa_id || (sa.commesse_autorizzate || []).includes(cliente.commessa_id))
                        .map(sa => (
                          <option key={sa.id} value={sa.id}>{sa.nome}</option>
                        ))
                      }
                    </select>
                  ) : (
                    <p className="text-sm p-2 bg-gray-50 border rounded">
                      {subAgenzie.find(sa => sa.id === cliente?.sub_agenzia_id)?.nome || 'Non disponibile'}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Servizio</Label>
                  <p className="text-sm p-2 bg-gray-50 border rounded">
                    {servizioInfo?.nome || (Array.isArray(servizi) && servizi.find(s => s?.id === cliente?.servizio_id)?.nome) || 'Non disponibile'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Tipologia Contratto</Label>
                  {user && ['admin', 'responsabile_commessa', 'backoffice_commessa'].includes(user.role) ? (
                    <select
                      value={formData.tipologia_contratto || ""}
                      onChange={(e) => {
                        const newTipologiaId = e.target.value;
                        handleChange('tipologia_contratto', newTipologiaId);
                        
                        // Load segmenti for new tipologia
                        if (newTipologiaId) {
                          fetchSegmenti(newTipologiaId);
                        } else {
                          setSegmenti([]);
                        }
                        
                        // Clear segmento and offerte when tipologia changes
                        handleChange('segmento', '');
                        setAvailableOfferte([]);
                        
                        // Force re-render to update conditional sections
                        setRenderTrigger(prev => prev + 1);
                      }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Seleziona tipologia</option>
                      {editTipologieContratto && editTipologieContratto.length > 0 ? (
                        editTipologieContratto.map((tip) => (
                          <option key={tip.id} value={tip.id}>
                            {tip.nome}
                          </option>
                        ))
                      ) : (
                        <option disabled>Caricamento tipologie...</option>
                      )}
                    </select>
                  ) : (
                    <p className="text-sm p-2 bg-gray-50 border rounded">
                      {editTipologieContratto?.find(t => t.id === cliente?.tipologia_contratto)?.nome || cliente?.tipologia_contratto || 'Non disponibile'}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Segmento</Label>
                  {user && ['admin', 'responsabile_commessa', 'backoffice_commessa'].includes(user.role) ? (
                    <select
                      value={formData.segmento || ""}
                      onChange={(e) => {
                        handleChange('segmento', e.target.value);
                        // Reload offerte when segmento changes
                        if (e.target.value && formData.tipologia_contratto) {
                          fetchAvailableOfferte(formData.servizio_id, formData.tipologia_contratto, e.target.value);
                        }
                        
                        // Force re-render to update conditional sections (Business fields)
                        setRenderTrigger(prev => prev + 1);
                      }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Seleziona segmento</option>
                      {segmenti && segmenti.length > 0 ? (
                        segmenti.map((seg) => (
                          <option key={seg.id} value={seg.id}>
                            {seg.nome}
                          </option>
                        ))
                      ) : (
                        <option disabled>Caricamento segmenti...</option>
                      )}
                    </select>
                  ) : (
                    <p className="text-sm p-2 bg-gray-50 border rounded">
                      {segmenti?.find(s => s.id === cliente?.segmento || s.tipo === cliente?.segmento)?.nome || cliente?.segmento || 'Non disponibile'}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="offerta_id">Offerta</Label>
                  <select
                    id="offerta_id"
                    value={formData.offerta_id || ""}
                    onChange={(e) => {
                      handleChange('offerta_id', e.target.value);
                      if (e.target.value) {
                        fetchOffertaInfo(e.target.value);
                      } else {
                        setOffertaInfo(null);
                      }
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seleziona offerta</option>
                    {availableOfferte && availableOfferte.length > 0 ? (
                      availableOfferte.map((offerta) => (
                        <option key={offerta.id} value={offerta.id}>
                          {offerta.nome}
                        </option>
                      ))
                    ) : (
                      <option disabled>Caricamento offerte...</option>
                    )}
                  </select>
                  
                  {/* Mostra dettagli offerta selezionata */}
                  {isLoadingOfferta ? (
                    <p className="text-xs text-yellow-600 mt-1">🔄 Caricamento dettagli offerta...</p>
                  ) : offertaInfo ? (
                    <div className="text-xs bg-blue-50 border border-blue-200 rounded mt-2 p-2">
                      <p><strong>Offerta:</strong> {offertaInfo.nome}</p>
                      {offertaInfo.descrizione && (
                        <p><strong>Descrizione:</strong> {offertaInfo.descrizione}</p>
                      )}
                      <p><strong>ID:</strong> {offertaInfo.id}</p>
                    </div>
                  ) : formData.offerta_id && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ Offerta selezionata ma dettagli non disponibili</p>
                  )}
                </div>
                
                {/* NEW: Sub-Offerta Dropdown (show if offerta has sub-offerte) */}
                {subOfferte.length > 0 && (
                  <div className="md:col-span-2">
                    <Label htmlFor="sub_offerta_id" className="text-blue-900 font-semibold">📦 Sotto-Offerta</Label>
                    <select
                      id="sub_offerta_id"
                      value={formData.sub_offerta_id || ""}
                      onChange={(e) => handleChange('sub_offerta_id', e.target.value)}
                      className="w-full p-3 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-blue-50"
                    >
                      <option value="">Nessuna sotto-offerta</option>
                      {subOfferte.map((subOff) => (
                        <option key={subOff.id} value={subOff.id}>
                          {subOff.nome}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-blue-700 mt-1">
                      Seleziona una variante specifica per questa offerta
                    </p>
                  </div>
                )}
                
                {/* NEW: Client Assignment - Assegna Cliente a Utente (only for authorized roles) */}
                {canAssignClients() && (
                  <div className="md:col-span-2">
                    <Label htmlFor="assigned_to" className="text-purple-900 font-semibold">👤 Assegnato a Utente</Label>
                    <select
                      id="assigned_to"
                      value={selectedAssignedUser || ""}
                      onChange={(e) => handleAssignUser(e.target.value)}
                      className="w-full p-3 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-purple-50"
                    >
                      <option value="">Nessun utente assegnato</option>
                      {availableUsers && availableUsers.length > 0 ? (
                        availableUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.nome && user.cognome 
                              ? `${user.nome} ${user.cognome} (${user.username})` 
                              : user.username}
                          </option>
                        ))
                      ) : (
                        <option disabled>Caricamento utenti...</option>
                      )}
                    </select>
                    
                    {/* Mostra info utente attualmente assegnato */}
                    {assignedUserInfo && (
                      <div className="text-xs bg-purple-50 border border-purple-200 rounded mt-2 p-2">
                        <p><strong>Attualmente assegnato a:</strong> {assignedUserInfo.display_name}</p>
                        <p><strong>Username:</strong> {assignedUserInfo.username}</p>
                        <p><strong>Ruolo:</strong> {assignedUserInfo.role}</p>
                      </div>
                    )}
                    
                    <p className="text-xs text-purple-700 mt-1">
                      Assegna questo cliente a un utente specifico per la gestione
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Dati Fiscali - Mostra campi in base al segmento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                💼 Dati Fiscali 
                <span className="text-sm text-gray-500 ml-2">
                  ({isEditBusinessSegment() ? 'Business' : 'Privato'})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ragione Sociale - Solo per Business */}
                {isEditBusinessSegment() && (
                  <div>
                    <Label htmlFor="ragione_sociale">Ragione Sociale *</Label>
                    <Input
                      id="ragione_sociale"
                      value={formData.ragione_sociale}
                      onChange={(e) => handleChange('ragione_sociale', e.target.value)}
                      className="border-blue-200 focus:border-blue-500"
                    />
                  </div>
                )}
                
                {/* Partita IVA - Solo per Business */}
                {isEditBusinessSegment() && (
                  <div>
                    <Label htmlFor="partita_iva">Partita IVA *</Label>
                    <Input
                      id="partita_iva"
                      value={formData.partita_iva}
                      onChange={(e) => handleChange('partita_iva', e.target.value)}
                      className="border-blue-200 focus:border-blue-500"
                    />
                  </div>
                )}
                
                {/* Messaggio informativo per segmento rilevato */}
                <div className="md:col-span-2">
                  <div className={`p-3 rounded-lg text-sm ${
                    isEditBusinessSegment() 
                      ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                      : 'bg-green-50 text-green-800 border border-green-200'
                  }`}>
                    <strong>Segmento rilevato:</strong> {isEditBusinessSegment() ? 'Business' : 'Privato'}
                    {isEditBusinessSegment() ? ' - Campi aziendali disponibili' : ' - Solo dati personali'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📄 Documento Identità</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tipo_documento">Tipo Documento</Label>
                  <select
                    id="tipo_documento"
                    value={formData.tipo_documento}
                    onChange={(e) => handleChange('tipo_documento', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seleziona tipo documento</option>
                    <option value="carta_identita">Carta d'Identità</option>
                    <option value="patente">Patente</option>
                    <option value="passaporto">Passaporto</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="numero_documento">Numero Documento</Label>
                  <Input
                    id="numero_documento"
                    value={formData.numero_documento}
                    onChange={(e) => handleChange('numero_documento', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="data_rilascio">Data Rilascio</Label>
                  <Input
                    id="data_rilascio"
                    type="date"
                    value={formData.data_rilascio}
                    onChange={(e) => handleChange('data_rilascio', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="luogo_rilascio">Luogo Rilascio</Label>
                  <Input
                    id="luogo_rilascio"
                    value={formData.luogo_rilascio}
                    onChange={(e) => handleChange('luogo_rilascio', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="scadenza_documento">Scadenza</Label>
                  <Input
                    id="scadenza_documento"
                    type="date"
                    value={formData.scadenza_documento}
                    onChange={(e) => handleChange('scadenza_documento', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SEZIONE TELEFONIA FISSA */}
          {isEditTelefoniaFastweb() && !isEditMobile() && !isEditTelepass() && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📞 Telefonia Fissa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="tecnologia">Tecnologia</Label>
                    <select
                      id="tecnologia"
                      value={formData.tecnologia}
                      onChange={(e) => handleChange('tecnologia', e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Seleziona Tecnologia...</option>
                      {TECNOLOGIE.map(tech => (
                        <option key={tech.value} value={tech.value}>{tech.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="codice_migrazione">Codice Migrazione</Label>
                    <Input
                      id="codice_migrazione"
                      value={formData.codice_migrazione}
                      onChange={(e) => handleChange('codice_migrazione', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="numero_portabilita">Numero Portabilità</Label>
                    <Input
                      id="numero_portabilita"
                      value={formData.numero_portabilita}
                      onChange={(e) => handleChange('numero_portabilita', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="gestore">Gestore Attuale</Label>
                    <Input
                      id="gestore"
                      value={formData.gestore}
                      onChange={(e) => handleChange('gestore', e.target.value)}
                      placeholder="es. TIM, Vodafone, WindTre..."
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="convergenza"
                      checked={formData.convergenza}
                      onChange={(e) => handleChange('convergenza', e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <Label htmlFor="convergenza" className="font-medium">Convergenza (Fisso + Mobile)</Label>
                  </div>
                  
                  {/* Mostra SIM associate se convergenza è attiva */}
                  {formData.convergenza && (
                    <div className="ml-6 p-3 bg-blue-50 border border-blue-200 rounded">
                      <h4 className="text-sm font-semibold text-blue-800 mb-2">📱 SIM Associate alla Convergenza</h4>
                      
                      {canEditRestrictedFields() ? (
                        /* EDITABLE MODE - Only for Backoffice Commessa */
                        <div className="space-y-3">
                          {formData.convergenza_items && formData.convergenza_items.length > 0 ? (
                            formData.convergenza_items.map((item, index) => (
                              <div key={index} className="bg-white p-3 rounded border">
                                <div className="flex justify-between items-center mb-2">
                                  <h5 className="font-semibold text-gray-700">SIM #{index + 1}</h5>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      const newItems = formData.convergenza_items.filter((_, i) => i !== index);
                                      handleChange('convergenza_items', newItems);
                                    }}
                                  >
                                    Rimuovi
                                  </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <Label>Numero Cellulare</Label>
                                    <Input
                                      value={item.numero_cellulare || ''}
                                      onChange={(e) => {
                                        const newItems = [...formData.convergenza_items];
                                        newItems[index].numero_cellulare = e.target.value;
                                        handleChange('convergenza_items', newItems);
                                      }}
                                      placeholder="Numero cellulare"
                                    />
                                  </div>
                                  <div>
                                    <Label>ICCID</Label>
                                    <Input
                                      value={item.iccid || ''}
                                      onChange={(e) => {
                                        const newItems = [...formData.convergenza_items];
                                        newItems[index].iccid = e.target.value;
                                        handleChange('convergenza_items', newItems);
                                      }}
                                      placeholder="ICCID"
                                    />
                                  </div>
                                  <div>
                                    <Label>Operatore</Label>
                                    <Input
                                      value={item.operatore || ''}
                                      onChange={(e) => {
                                        const newItems = [...formData.convergenza_items];
                                        newItems[index].operatore = e.target.value;
                                        handleChange('convergenza_items', newItems);
                                      }}
                                      placeholder="Operatore"
                                    />
                                  </div>
                                  <div>
                                    <Label>Offerta SIM</Label>
                                    <Input
                                      value={item.offerta_sim || ''}
                                      onChange={(e) => {
                                        const newItems = [...formData.convergenza_items];
                                        newItems[index].offerta_sim = e.target.value;
                                        handleChange('convergenza_items', newItems);
                                      }}
                                      placeholder="Nome offerta SIM"
                                    />
                                  </div>
                                  {/* NEW: Utente Assegnato per questa SIM */}
                                  <div className="md:col-span-2">
                                    <Label className="text-purple-800 font-semibold">👤 Utente Assegnato a questa SIM</Label>
                                    <select
                                      value={item.assigned_user_id || ''}
                                      onChange={(e) => {
                                        const newItems = [...formData.convergenza_items];
                                        newItems[index].assigned_user_id = e.target.value;
                                        handleChange('convergenza_items', newItems);
                                      }}
                                      className="w-full p-2 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-purple-50"
                                    >
                                      <option value="">Nessun utente assegnato</option>
                                      {availableUsers && availableUsers.length > 0 ? (
                                        availableUsers.map((user) => (
                                          <option key={user.id} value={user.id}>
                                            {user.nome && user.cognome 
                                              ? `${user.nome} ${user.cognome} (${user.username})` 
                                              : user.username}
                                          </option>
                                        ))
                                      ) : (
                                        <option disabled>Nessun utente disponibile</option>
                                      )}
                                    </select>
                                    {item.assigned_user_id && (
                                      <p className="text-xs text-purple-700 mt-1">
                                        ℹ️ Questo utente è responsabile di questa specifica SIM
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-blue-600">Nessuna SIM associata</p>
                          )}
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newItems = [
                                ...(formData.convergenza_items || []),
                                { numero_cellulare: '', iccid: '', operatore: '', offerta_sim: '', assigned_user_id: '' }
                              ];
                              handleChange('convergenza_items', newItems);
                            }}
                          >
                            + Aggiungi SIM
                          </Button>
                        </div>
                      ) : (
                        /* READ-ONLY MODE - For other roles */
                        <>
                          {console.log("🔍 DEBUG CONVERGENZA ITEMS:", {
                            has_convergenza_items: Boolean(cliente?.convergenza_items),
                            items_count: cliente?.convergenza_items?.length || 0,
                            items_data: cliente?.convergenza_items
                          })}
                          {cliente?.convergenza_items && cliente.convergenza_items.length > 0 ? (
                            <div className="space-y-2">
                              {cliente.convergenza_items.map((sim, index) => (
                                <div key={index} className="bg-white p-2 rounded border text-sm">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <strong>Numero:</strong> {sim.numero_cellulare || 'Non specificato'}
                                    </div>
                                    <div>
                                      <strong>ICCID:</strong> {sim.iccid || 'Non specificato'}
                                    </div>
                                    <div>
                                      <strong>Operatore:</strong> {sim.operatore || 'Non specificato'}
                                    </div>
                                    <div>
                                      <strong>Offerta SIM:</strong> {sim.offerta_sim || 'Non specificato'}
                                    </div>
                                    {sim.assigned_user_id && (
                                      <div className="col-span-2 bg-purple-50 p-2 rounded border-l-4 border-purple-400">
                                        <strong className="text-purple-800">👤 Utente Assegnato:</strong>{' '}
                                        <span className="text-purple-900">
                                          {getUserDisplayName(sim.assigned_user_id)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-blue-600">Nessuna SIM associata trovata</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Informazioni sulla convergenza */}
                  <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    <strong>Info:</strong> La convergenza combina servizi fissi (internet/telefono) e mobili (SIM) in un'unica offerta.
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SEZIONE ENERGIA FASTWEB */}
          {isEditEnergiaFastweb() && !isEditTelepass() && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">⚡ Energia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tipologia Dropdown */}
                <div>
                  <Label htmlFor="energia_tipologia">Tipologia</Label>
                  <select
                    id="energia_tipologia"
                    value={formData.energia_tipologia}
                    onChange={(e) => handleChange('energia_tipologia', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleziona Tipologia...</option>
                    <option value="Switch">Switch</option>
                    <option value="Switch con voltura">Switch con voltura</option>
                    <option value="Subentro">Subentro</option>
                    <option value="Nuovo Allaccio">Nuovo Allaccio</option>
                  </select>
                </div>

                {/* POD */}
                <div>
                  <div>
                    <Label htmlFor="codice_pod">Codice POD</Label>
                    <Input
                      id="codice_pod"
                      value={formData.codice_pod}
                      onChange={(e) => handleChange('codice_pod', e.target.value)}
                    />
                  </div>
                </div>

                {/* Altri campi */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="energia_consumo_annuo">Consumo Annuo</Label>
                    <Input
                      id="energia_consumo_annuo"
                      value={formData.energia_consumo_annuo}
                      onChange={(e) => handleChange('energia_consumo_annuo', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="energia_potenza_contatore">Potenza del Contatore</Label>
                    <Input
                      id="energia_potenza_contatore"
                      value={formData.energia_potenza_contatore}
                      onChange={(e) => handleChange('energia_potenza_contatore', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="energia_potenza_impegnata">Potenza Impegnata</Label>
                  <Input
                    id="energia_potenza_impegnata"
                    value={formData.energia_potenza_impegnata}
                    onChange={(e) => handleChange('energia_potenza_impegnata', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="energia_fornitore_attuale">Fornitore Attuale</Label>
                  <Input
                    id="energia_fornitore_attuale"
                    value={formData.energia_fornitore_attuale || ''}
                    onChange={(e) => handleChange('energia_fornitore_attuale', e.target.value)}
                    placeholder="Es: Enel, Eni, A2A, Iren..."
                    data-testid="edit-cliente-fornitore-attuale-input"
                  />
                </div>

                {/* Campi condizionali per "Switch con voltura" */}
                {formData.energia_tipologia === 'Switch con voltura' && (
                  <div className="space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="text-sm font-semibold text-blue-900">Dati Vecchio Intestatario</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="energia_vecchio_intestatario_nome">Nome</Label>
                        <Input
                          id="energia_vecchio_intestatario_nome"
                          value={formData.energia_vecchio_intestatario_nome}
                          onChange={(e) => handleChange('energia_vecchio_intestatario_nome', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="energia_vecchio_intestatario_cognome">Cognome</Label>
                        <Input
                          id="energia_vecchio_intestatario_cognome"
                          value={formData.energia_vecchio_intestatario_cognome}
                          onChange={(e) => handleChange('energia_vecchio_intestatario_cognome', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="energia_vecchio_intestatario_cf">Codice Fiscale</Label>
                        <Input
                          id="energia_vecchio_intestatario_cf"
                          value={formData.energia_vecchio_intestatario_cf}
                          onChange={(e) => handleChange('energia_vecchio_intestatario_cf', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* SEZIONE DATI MOBILE */}
          {isEditMobile() && !isEditTelepass() && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📱 Dati Mobile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-2">SIM Associate</h4>
                  
                  {canEditRestrictedFields() ? (
                    /* EDITABLE MODE - Only for Backoffice Commessa */
                    <div className="space-y-3">
                      {formData.mobile_items && formData.mobile_items.length > 0 ? (
                        formData.mobile_items.map((mobile, index) => (
                          <div key={index} className="bg-white p-3 rounded border">
                            <div className="flex justify-between items-center mb-2">
                              <h5 className="font-semibold text-gray-700">SIM #{index + 1}</h5>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  const newItems = formData.mobile_items.filter((_, i) => i !== index);
                                  handleChange('mobile_items', newItems);
                                }}
                              >
                                Rimuovi
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <Label>Telefono da Portare</Label>
                                <Input
                                  value={mobile.telefono_da_portare || ''}
                                  onChange={(e) => {
                                    const newItems = [...formData.mobile_items];
                                    newItems[index].telefono_da_portare = e.target.value;
                                    handleChange('mobile_items', newItems);
                                  }}
                                  placeholder="Numero da portare"
                                />
                              </div>
                              <div>
                                <Label>ICCID</Label>
                                <Input
                                  value={mobile.iccid || ''}
                                  onChange={(e) => {
                                    const newItems = [...formData.mobile_items];
                                    newItems[index].iccid = e.target.value;
                                    handleChange('mobile_items', newItems);
                                  }}
                                  placeholder="ICCID"
                                />
                              </div>
                              <div>
                                <Label>Operatore</Label>
                                <Input
                                  value={mobile.operatore || ''}
                                  onChange={(e) => {
                                    const newItems = [...formData.mobile_items];
                                    newItems[index].operatore = e.target.value;
                                    handleChange('mobile_items', newItems);
                                  }}
                                  placeholder="Operatore attuale"
                                />
                              </div>
                              <div>
                                <Label>Titolare se Diverso</Label>
                                <Input
                                  value={mobile.titolare_diverso || ''}
                                  onChange={(e) => {
                                    const newItems = [...formData.mobile_items];
                                    newItems[index].titolare_diverso = e.target.value;
                                    handleChange('mobile_items', newItems);
                                  }}
                                  placeholder="Nome titolare"
                                />
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-blue-600">Nessuna SIM associata</p>
                      )}
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newItems = [
                            ...(formData.mobile_items || []),
                            { telefono_da_portare: '', iccid: '', operatore: '', titolare_diverso: '' }
                          ];
                          handleChange('mobile_items', newItems);
                        }}
                      >
                        + Aggiungi SIM
                      </Button>
                    </div>
                  ) : (
                    /* READ-ONLY MODE - For other roles */
                    <>
                      {cliente?.mobile_items && cliente.mobile_items.length > 0 ? (
                        <div className="space-y-2">
                          {cliente.mobile_items.map((mobile, index) => (
                            <div key={index} className="bg-white p-3 rounded border text-sm">
                              <h5 className="font-semibold text-gray-700 mb-2">SIM #{index + 1}</h5>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <strong>Telefono da Portare:</strong> {mobile.telefono_da_portare || 'Non specificato'}
                                </div>
                                <div>
                                  <strong>ICCID:</strong> {mobile.iccid || 'Non specificato'}
                                </div>
                                <div>
                                  <strong>Operatore:</strong> {mobile.operatore || 'Non specificato'}
                                </div>
                                <div>
                                  <strong>Titolare se Diverso:</strong> {mobile.titolare_diverso || 'Non specificato'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-blue-600">Nessuna SIM associata trovata</p>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* SEZIONE TELEPASS */}
          {isEditTelepass() && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">🚗 Telepass</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="obu">OBU</Label>
                  <Input
                    id="obu"
                    value={formData.obu}
                    onChange={(e) => handleChange('obu', e.target.value)}
                    placeholder="Inserisci codice OBU"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* SEZIONE MODALITÀ PAGAMENTO */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">💳 Modalità Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Modalità Pagamento</Label>
                  {canEditRestrictedFields() ? (
                    /* EDITABLE - Only for Backoffice Commessa */
                    <select
                      value={formData.modalita_pagamento || ''}
                      onChange={(e) => handleChange('modalita_pagamento', e.target.value)}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Seleziona modalità pagamento</option>
                      <option value="iban">💰 IBAN (Bonifico Bancario)</option>
                      <option value="carta_credito">💳 Carta di Credito</option>
                    </select>
                  ) : (
                    /* READ-ONLY - For other roles */
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                      <strong>
                        {formData.modalita_pagamento === 'iban' ? '💰 IBAN (Bonifico Bancario)' : 
                         formData.modalita_pagamento === 'carta_credito' ? '💳 Carta di Credito' : 
                         '❌ Nessuna modalità selezionata'}
                      </strong>
                    </div>
                  )}
                </div>
                
                {/* Campi IBAN - Solo se modalità selezionata */}
                {formData.modalita_pagamento === 'iban' && canEditRestrictedFields() && (
                  <>
                    <div>
                      <Label htmlFor="iban">IBAN</Label>
                      <Input
                        id="iban"
                        value={formData.iban}
                        onChange={(e) => handleChange('iban', e.target.value)}
                        placeholder="IT00 0000 0000 0000 0000 0000 000"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <Label htmlFor="intestatario_diverso">Intestatario se diverso</Label>
                      <Input
                        id="intestatario_diverso"
                        value={formData.intestatario_diverso}
                        onChange={(e) => handleChange('intestatario_diverso', e.target.value)}
                        placeholder="Nome e Cognome intestatario (se diverso dal cliente)"
                      />
                    </div>
                  </>
                )}
                
                {/* IBAN READ-ONLY for other roles */}
                {formData.modalita_pagamento === 'iban' && !canEditRestrictedFields() && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm space-y-2">
                    <div>
                      <strong>IBAN:</strong> {formData.iban || 'Non specificato'}
                    </div>
                    {formData.intestatario_diverso && (
                      <div>
                        <strong>Intestatario:</strong> {formData.intestatario_diverso}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Campi Carta di Credito - Solo se modalità selezionata */}
                {formData.modalita_pagamento === 'carta_credito' && canEditRestrictedFields() && (
                  <>
                    <div>
                      <Label htmlFor="numero_carta">Numero Carta di Credito</Label>
                      <Input
                        id="numero_carta"
                        type="text"
                        value={formData.numero_carta}
                        onChange={(e) => handleChange('numero_carta', e.target.value)}
                        placeholder="1234 5678 9012 3456"
                        className="font-mono bg-blue-50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="mese_carta">Mese</Label>
                        <select
                          id="mese_carta"
                          value={formData.mese_carta}
                          onChange={(e) => handleChange('mese_carta', e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">Mese</option>
                          <option value="01">01 - Gennaio</option>
                          <option value="02">02 - Febbraio</option>
                          <option value="03">03 - Marzo</option>
                          <option value="04">04 - Aprile</option>
                          <option value="05">05 - Maggio</option>
                          <option value="06">06 - Giugno</option>
                          <option value="07">07 - Luglio</option>
                          <option value="08">08 - Agosto</option>
                          <option value="09">09 - Settembre</option>
                          <option value="10">10 - Ottobre</option>
                          <option value="11">11 - Novembre</option>
                          <option value="12">12 - Dicembre</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="anno_carta">Anno</Label>
                        <select
                          id="anno_carta"
                          value={formData.anno_carta}
                          onChange={(e) => handleChange('anno_carta', e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">Anno</option>
                          {Array.from({length: 20}, (_, i) => {
                            const year = new Date().getFullYear() + i;
                            return <option key={year} value={year}>{year}</option>;
                          })}
                        </select>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Carta di Credito READ-ONLY for other roles */}
                {formData.modalita_pagamento === 'carta_credito' && !canEditRestrictedFields() && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm space-y-2">
                    <div>
                      <strong>Numero Carta:</strong> {formData.numero_carta ? `**** **** **** ${formData.numero_carta.slice(-4)}` : 'Non specificato'}
                    </div>
                    <div>
                      <strong>Scadenza:</strong> {formData.mese_carta && formData.anno_carta ? `${formData.mese_carta}/${formData.anno_carta}` : 'Non specificata'}
                    </div>
                  </div>
                )}
                
                {/* Messaggio se nessuna modalità selezionata */}
                {!formData.modalita_pagamento && (
                  <div className="text-center p-4 text-gray-600 bg-gray-50 rounded">
                    Nessuna modalità di pagamento è stata selezionata durante la creazione del cliente
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📊 Status Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label>Status {(user.role !== "admin" && user.role !== "responsabile_commessa" && user.role !== "backoffice_commessa") && <span className="text-xs text-gray-500">(Solo Admin/Responsabile/Backoffice Commessa può modificare)</span>}</Label>
                <div className="flex items-center gap-2">
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => handleChange('status', value)}
                    disabled={user.role !== "admin" && user.role !== "responsabile_commessa" && user.role !== "backoffice_commessa"}
                  >
                    <SelectTrigger className={(user.role !== "admin" && user.role !== "responsabile_commessa" && user.role !== "backoffice_commessa") ? "opacity-60 cursor-not-allowed flex-1" : "flex-1"}>
                      <SelectValue placeholder="Seleziona status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} data-testid={`status-option-${opt.value}`}>
                          {opt.icon ? `${opt.icon} ` : ''}{opt.name}{!opt.is_standard && ' ⭐'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <PostVenditaStatusDot cliente={cliente} size="md" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SEZIONE CAMPI PERSONALIZZATI (dinamici per commessa + tipologia) */}
          <CustomFieldsSection
            fields={customFields}
            sections={customSections}
            values={customFieldValues}
            onChangeField={(name, value) => setCustomFieldValues(prev => ({ ...prev, [name]: value }))}
          />

          {/* Sezione Post Vendita - evoluzione visibile a tutti gli utenti con accesso al cliente */}
          <ClientePostVenditaSection clienteId={cliente?.id} clienteSnapshot={cliente} />

          {/* Note Post Vendita - SOLO quando il modale è aperto dal tab Post Vendita.
              Visibile solo ad admin/backoffice_commessa, storico immutabile. NON appare nella scheda cliente normale. */}
          {fromPostVendita && cliente?.id && (user?.role === "admin" || user?.role === "backoffice_commessa") && (
            <ClienteNotesHistory
              clienteId={cliente.id}
              tipo="post_vendita"
              title="Note Post Vendita"
              canAdd={true}
              accentColor="indigo"
              emptyMessage="Nessuna nota post vendita ancora presente."
            />
          )}

          {/* Note - Storico immutabile */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📝 Storico Note</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <ClienteNotesHistory
                  clienteId={cliente?.id}
                  tipo="cliente"
                  title="Note Cliente"
                  accentColor="blue"
                  canAdd={true}
                  emptyMessage="Nessuna nota cliente presente. Aggiungi la prima qui sopra."
                />
                <ClienteNotesHistory
                  clienteId={cliente?.id}
                  tipo="backoffice"
                  title="Note Back Office"
                  accentColor="orange"
                  canAdd={canEditNoteBackoffice()}
                  emptyMessage="Nessuna nota back office presente."
                />
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:justify-between">
              <PassToPostVenditaButton cliente={cliente} userRole={user?.role} />
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Annulla
                </Button>
                <Button type="submit">
                  Salva Modifiche
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Aruba Drive Configuration Modal

const ArubaDriveConfigModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  editingConfig 
}) => {
  const [formData, setFormData] = useState({
    name: "",
    url: "https://da6z2a.arubadrive.com/login?clear=1",
    username: "",
    password: "",
    is_active: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (editingConfig) {
      setFormData({
        name: editingConfig.name || "",
        url: editingConfig.url || "https://da6z2a.arubadrive.com/login?clear=1",
        username: editingConfig.username || "",
        password: "", // Non pre-compilare password per sicurezza
        is_active: editingConfig.is_active || false
      });
    } else {
      // Reset per nuova configurazione
      setFormData({
        name: "",
        url: "https://da6z2a.arubadrive.com/login?clear=1",
        username: "",
        password: "",
        is_active: false
      });
    }
  }, [editingConfig, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.url || !formData.username || (!editingConfig && !formData.password)) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const dataToSave = { ...formData };
      // Se stiamo modificando e password è vuota, non includerla nell'update
      if (editingConfig && !formData.password) {
        delete dataToSave.password;
      }

      await onSave(dataToSave);
      onClose();
    } catch (error) {
      console.error("Error saving config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {editingConfig ? "Modifica" : "Nuova"} Configurazione Aruba Drive
          </CardTitle>
          <p className="text-sm text-gray-600">
            Configura l'accesso al tuo account Aruba Drive
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome Configurazione *</Label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="es. Account Principale"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <Label htmlFor="url">URL Aruba Drive *</Label>
              <input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({...formData, url: e.target.value})}
                placeholder="https://da6z2a.arubadrive.com/login?clear=1"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <Label htmlFor="username">Username *</Label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                placeholder="Il tuo username Aruba Drive"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <Label htmlFor="password">
                Password {editingConfig ? "(lascia vuoto per mantenere)" : "*"}
              </Label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="La tua password Aruba Drive"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required={!editingConfig}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
              />
              <Label htmlFor="is_active" className="cursor-pointer">Imposta come configurazione attiva</Label>
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
              <p><strong>Note:</strong></p>
              <p>• Solo una configurazione può essere attiva alla volta</p>
              <p>• La configurazione attiva verrà usata per gli upload automatici</p>
              <p>• Puoi testare la connessione dopo aver salvato</p>
            </div>

            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {editingConfig ? "Aggiorna" : "Salva"}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1"
              >
                Annulla
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// Rimuovo il componente ClientiManagement duplicato - esiste già alla riga 11995

// Componente avanzato per gestire documenti multipli del cliente (stesse funzioni della sezione Documenti)

const ClientDocumentsModal = ({ isOpen, onClose, clientId, clientName }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && clientId) {
      fetchClientDocuments();
    }
  }, [isOpen, clientId]);

  const fetchClientDocuments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/documents/client/${clientId}`);
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error("Error fetching client documents:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei documenti",
        variant: "destructive",
      });
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      setSelectedFiles(prev => [...prev, ...droppedFiles]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleMultipleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "Errore", 
        description: "Seleziona almeno un file da caricare",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    const uploadResults = [];
    
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      try {
        // Update progress
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { status: 'uploading', progress: 0 }
        }));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('entity_type', 'clienti');
        formData.append('entity_id', clientId);
        formData.append('uploaded_by', user?.id || 'current_user');

        const response = await axios.post(`${API}/documents/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(prev => ({
              ...prev,
              [file.name]: { status: 'uploading', progress: percentCompleted }
            }));
          }
        });

        // Mark as completed
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { status: 'completed', progress: 100 }
        }));

        uploadResults.push({ success: true, filename: file.name, data: response.data });
        
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { 
            status: 'error', 
            progress: 0, 
            error: error.response?.data?.detail || "Errore nel caricamento"
          }
        }));

        uploadResults.push({ success: false, filename: file.name, error: error.message });
      }
    }

    // Summary toast
    const successCount = uploadResults.filter(r => r.success).length;
    const errorCount = uploadResults.filter(r => !r.success).length;
    
    if (successCount > 0) {
      toast({
        title: "Upload Completato",
        description: `${successCount} file caricati su Aruba Drive con successo${errorCount > 0 ? `, ${errorCount} errori` : ''}`,
      });
    }
    
    if (errorCount > 0 && successCount === 0) {
      // Get the first error message for details
      const firstError = uploadResults.find(r => !r.success);
      const errorDetail = firstError?.error || "Errore di connessione";
      
      toast({
        title: "Errore Upload - Server Aruba",
        description: `Il documento NON è stato salvato. ${errorDetail}`,
        variant: "destructive",
      });
    } else if (errorCount > 0) {
      toast({
        title: "Upload Parziale",
        description: `${successCount} file caricati, ${errorCount} falliti. I file falliti NON sono stati salvati.`,
        variant: "destructive",
      });
    }

    // Reset
    setTimeout(() => {
      setSelectedFiles([]);
      setUploadProgress({});
      setUploading(false);
      fetchClientDocuments();
    }, 2000);
  };

  const handleDownload = async (documentId, filename) => {
    try {
      const response = await axios.get(`${API}/documents/download/${documentId}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Download Completato",
        description: `File ${filename} scaricato con successo`,
      });
      
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({
        title: "Errore Download",
        description: error.response?.data?.detail || "Errore nel download del documento",
        variant: "destructive",
      });
    }
  };
  const handleView = async (documentId, filename) => {
    try {
      // Use authenticated request (same as download but for viewing)
      const response = await axios.get(`${API}/documents/${documentId}/view`, {
        responseType: 'blob', // Get file as blob
      });

      // Create blob URL and open in new tab for viewing
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/pdf' 
      });
      const url = window.URL.createObjectURL(blob);
      
      // Open in new tab for viewing
      const newWindow = window.open(url, '_blank');
      
      // Clean up blob URL after a delay to ensure it loads
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 5000);
      
    } catch (error) {
      console.error("Error viewing document:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nella visualizzazione del documento",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDocument = async (documentId, filename) => {
    if (!confirm(`Rimuovere il documento "${filename}" dalla lista? (Il file rimarrà su Aruba Drive)`)) {
      return;
    }

    try {
      await axios.delete(`${API}/documents/${documentId}`);
      toast({
        title: "Documento Rimosso",
        description: `${filename} rimosso dalla lista (file conservato su Aruba Drive)`,
      });
      fetchClientDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        title: "Errore",
        description: "Errore nella rimozione del documento",
        variant: "destructive",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[95vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 sm:p-6 z-10">
          <DialogHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center space-x-3 text-lg sm:text-xl">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-slate-900 truncate">Documenti Cliente</h2>
                  <p className="text-sm text-slate-600 truncate">{clientName}</p>
                </div>
              </DialogTitle>
              {/* Close button - always visible on mobile */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="flex-shrink-0 h-10 w-10 p-0 rounded-full hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <DialogDescription className="text-sm text-slate-500 leading-relaxed hidden sm:block">
              Gestisci documenti per questo cliente. I file vengono organizzati automaticamente su Aruba Drive.
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <div className="p-4 sm:p-6 space-y-6">
          {/* Multi-File Upload Section - Responsive */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="border-b border-slate-200 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Upload className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Carica Documenti</h3>
                    <p className="text-sm text-slate-600">Upload multipli supportati</p>
                  </div>
                </div>
                {selectedFiles.length > 0 && (
                  <Badge variant="secondary" className="self-start sm:self-center">
                    {selectedFiles.length} file selezionati
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="p-4 sm:p-6">
              <div className="space-y-4">
                {/* Responsive Drag & Drop Area */}
                <div
                  className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all duration-200 ${
                    dragActive
                      ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                      : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="space-y-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                      <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-base sm:text-lg font-medium text-slate-700">
                        Trascina file qui o clicca per selezionare
                      </p>
                      <p className="text-xs sm:text-sm text-slate-500">
                        PDF • DOC • XLS • IMG • ZIP • Massimo 10 MB per file
                      </p>
                    </div>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-input-multi"
                    />
                    <label
                      htmlFor="file-input-multi"
                      className="inline-flex items-center px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white text-sm sm:text-base font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Seleziona File
                    </label>
                  </div>
                </div>

                {/* Selected Files List - Mobile Optimized */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-slate-700 text-sm sm:text-base">
                        File Selezionati ({selectedFiles.length})
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedFiles([])}
                        disabled={uploading}
                        className="text-xs"
                      >
                        Rimuovi Tutti
                      </Button>
                    </div>
                    
                    <div className="max-h-40 sm:max-h-48 overflow-y-auto space-y-2">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <div className="flex items-start justify-between space-x-3">
                            <div className="flex items-start space-x-3 min-w-0 flex-1">
                              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || 'Documento'}
                                </p>
                                
                                {/* Progress Bar - Mobile Friendly */}
                                {uploadProgress[file.name] && (
                                  <div className="mt-2 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-slate-600">
                                        {uploadProgress[file.name].status === 'uploading' && 'Caricamento...'}
                                        {uploadProgress[file.name].status === 'completed' && 'Salvato su Aruba Drive'}
                                        {uploadProgress[file.name].status === 'error' && (
                                          <span className="text-red-600 font-medium">
                                            NON salvato - {uploadProgress[file.name].error || 'Errore server Aruba'}
                                          </span>
                                        )}
                                      </span>
                                      {uploadProgress[file.name].status === 'uploading' && (
                                        <span className="text-xs text-slate-500">
                                          {uploadProgress[file.name].progress}%
                                        </span>
                                      )}
                                    </div>
                                    {uploadProgress[file.name].status === 'uploading' && (
                                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                                        <div 
                                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                                          style={{ width: `${uploadProgress[file.name].progress}%` }}
                                        ></div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Status Icon & Remove Button */}
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              {uploadProgress[file.name] && (
                                <>
                                  {uploadProgress[file.name].status === 'completed' && (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  )}
                                  {uploadProgress[file.name].status === 'error' && (
                                    <XCircle className="w-4 h-4 text-red-600" />
                                  )}
                                  {uploadProgress[file.name].status === 'uploading' && (
                                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                  )}
                                </>
                              )}
                              
                              {!uploading && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeFile(index)}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Upload Button - Prominent */}
                    <div className="pt-3 border-t border-slate-200">
                      <Button
                        onClick={handleMultipleUpload}
                        disabled={uploading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3"
                      >
                        {uploading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                            Caricamento su Aruba Drive...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Carica {selectedFiles.length} File su Aruba Drive
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Documents List - Mobile Optimized */}
          <Card className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="border-b border-slate-200 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Documenti Cliente</h3>
                    <p className="text-sm text-slate-600">{documents.length} file caricati</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchClientDocuments}
                  disabled={loading}
                  className="self-start sm:self-center"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-600 mr-2" />
                  ) : (
                    <>
                      <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Aggiorna
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <CardContent className="p-4 sm:p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  <p className="text-slate-500 mt-3">Caricamento documenti...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">
                    Nessun documento caricato
                  </h3>
                  <p className="text-slate-500 max-w-sm mx-auto">
                    Usa la sezione di caricamento sopra per aggiungere i primi documenti per questo cliente
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden lg:block">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">File</th>
                            <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Tipo</th>
                            <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Dimensione</th>
                            <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Cloud Storage</th>
                            <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Data</th>
                            <th className="text-center py-3 px-4 font-semibold text-slate-700 text-sm">Azioni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {documents.map((doc, index) => (
                            <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="py-4 px-4">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <span className="font-medium text-slate-900 text-sm">{doc.filename}</span>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <Badge variant="secondary" className="text-xs">
                                  {doc.file_type?.split('/')[1]?.toUpperCase() || 'DOC'}
                                </Badge>
                              </td>
                              <td className="py-4 px-4 text-sm text-slate-600">
                                {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(1)} MB` : 'N/A'}
                              </td>
                              <td className="py-4 px-4">
                                {doc.cloud_path || doc.aruba_drive_path ? (
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="text-xs text-slate-600 max-w-xs truncate" title={doc.cloud_path || doc.aruba_drive_path}>
                                      {doc.storage_type === 'nextcloud' && '☁️ '}
                                      {doc.cloud_path || doc.aruba_drive_path}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                    <span className="text-xs text-slate-600">📁 Solo locale</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-4 text-sm text-slate-600">
                                {new Date(doc.created_at).toLocaleDateString('it-IT', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: '2-digit'
                                })}
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex items-center justify-center space-x-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleView(doc.id, doc.filename)}
                                    className="h-8 w-8 p-0"
                                    title="Visualizza documento"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDownload(doc.id, doc.filename)}
                                    className="h-8 w-8 p-0"
                                    title="Scarica documento"
                                  >
                                    <Download className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                                    className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-200"
                                    title="Rimuovi dalla lista"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {/* Mobile/Tablet Card View */}
                  <div className="lg:hidden space-y-3">
                    {documents.map((doc, index) => (
                      <div key={doc.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <div className="space-y-3">
                          {/* File Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 min-w-0 flex-1">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <FileText className="w-5 h-5 text-blue-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-medium text-slate-900 text-sm truncate">{doc.filename}</h4>
                                <div className="flex items-center space-x-3 mt-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {doc.file_type?.split('/')[1]?.toUpperCase() || 'DOC'}
                                  </Badge>
                                  <span className="text-xs text-slate-500">
                                    {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(1)} MB` : 'N/A'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleView(doc.id, doc.filename)}
                                className="h-8 w-8 p-0"
                                title="Visualizza"
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownload(doc.id, doc.filename)}
                                className="h-8 w-8 p-0"
                                title="Scarica"
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                                className="h-8 w-8 p-0 hover:bg-red-50"
                                title="Elimina"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          
                          {/* File Details */}
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              {doc.aruba_drive_path ? (
                                <>
                                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                                  <span className="text-xs text-slate-600 truncate">
                                    Aruba Drive: {doc.aruba_drive_path.split('/').slice(-2).join('/')}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <div className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0"></div>
                                  <span className="text-xs text-slate-600">Solo archiviazione locale</span>
                                </>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              Caricato il {new Date(doc.created_at).toLocaleDateString('it-IT', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Footer with Close button - sticky on mobile */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 md:hidden">
          <Button onClick={onClose} className="w-full">
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};


export { CreateClienteModal, ImportClientiModal, ViewClienteModal, EditClienteModal, ArubaDriveConfigModal, ClientDocumentsModal };
