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



// EditClienteModal — estratto da ClienteModals.jsx (refactoring fase 2)

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
                {(() => {
                  const baseRoles = ["admin", "responsabile_commessa", "backoffice_commessa"];
                  const userIsBaseRole = baseRoles.includes(user.role);
                  // NEW (feb 2026): BO Sub Agenzia con privilegio attivo, sulla propria sub agenzia
                  const userIsPrivilegedBoSub = (
                    user.role === "backoffice_sub_agenzia" &&
                    user.bo_sub_agenzia_can_change_status === true &&
                    cliente?.sub_agenzia_id &&
                    cliente.sub_agenzia_id === user.sub_agenzia_id
                  );
                  const canEditStatus = userIsBaseRole || userIsPrivilegedBoSub;
                  return (
                    <>
                      <Label>Status {!canEditStatus && <span className="text-xs text-gray-500">(Solo Admin/Responsabile/Backoffice Commessa o Sub Agenzia autorizzata può modificare)</span>}</Label>
                      <div className="flex items-center gap-2">
                        <Select
                          value={formData.status}
                          onValueChange={(value) => handleChange('status', value)}
                          disabled={!canEditStatus}
                        >
                          <SelectTrigger
                            data-testid="cliente-status-select"
                            className={!canEditStatus ? "opacity-60 cursor-not-allowed flex-1" : "flex-1"}
                          >
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
                    </>
                  );
                })()}
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


export { EditClienteModal };
