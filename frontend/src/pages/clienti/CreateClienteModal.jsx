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
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { Switch } from "../../components/ui/switch";
import { useToast } from "../../hooks/use-toast";
import { Toaster } from "../../components/ui/toaster";
import ClienteCustomFieldsManager from "../../components/ClienteCustomFieldsManager";
import {
  useClienteCustomFields,
  useClienteStatusOptions,
  CustomFieldsSection,
  CustomFieldsViewSection,
  validateRequiredCustomFields,
} from "../../components/CustomFieldsRenderer";
import {
  useClienteLock,
  ClienteLockedScreen,
  useActiveClienteLocks,
} from "../../components/ClienteLock";
import { ClienteNotesHistory } from "../../components/ClienteNotesHistory";
import { PermissionsAudit } from "../../components/PermissionsAudit";
import { PostVendita } from "../../components/PostVendita";
import { PassToPostVenditaButton } from "../../components/PassToPostVenditaButton";
import { PostVenditaStatusDot } from "../../components/PostVenditaStatusDot";
import { ClientePostVenditaSection } from "../../components/ClientePostVenditaSection";
import { MultiSelectFilter } from "../../components/MultiSelectFilter";
import { SpokiAdminConfig } from "../../components/spoki/SpokiAdminConfig";
import { AppointmentsCalendar } from "../../components/spoki/AppointmentsCalendar";
import { AIConversations } from "../../components/spoki/AIConversations";
import { LeadConversationsTab } from "../../components/spoki/LeadConversationsTab";
import { WorkflowFoldersSidebar } from "../../components/workflow/WorkflowFoldersSidebar";
import { WorkflowTestModeDialog } from "../../components/workflow/WorkflowTestModeDialog";
import { TemplatePreviewDialog } from "../../components/workflow/TemplatePreviewDialog";
import { TagsManager } from "../../components/tags/TagsManager";

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
} from "../../lib/appUtils";
import { AuthContext, useAuth, AuthProvider } from "../../context/AuthContext";



// CreateClienteModal — estratto da ClienteModals.jsx (refactoring fase 2)

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


export { CreateClienteModal };
