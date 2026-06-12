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
import { STATUS_CLIENTI } from "../lib/appUtils";
import { CreateClienteModal, ImportClientiModal, ViewClienteModal, EditClienteModal, ClientDocumentsModal } from "./ClienteModals";


// ===================================================================
// Componenti estratti da App.js (refactoring giugno 2026)
// ===================================================================

const ClientiManagement = ({ selectedUnit, selectedCommessa, units, commesse: commesseFromParent, subAgenzie: subAgenzieFromParent, servizi: serviziFromParent }) => {
  const [clienti, setClienti] = useState([]);
  const [allClienti, setAllClienti] = useState([]); // Store all clients for filtering
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClienti, setTotalClienti] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [commesse, setCommesse] = useState(commesseFromParent || []);
  const [subAgenzie, setSubAgenzie] = useState(subAgenzieFromParent || []);
  const [servizi, setServizi] = useState(serviziFromParent || []);
  const [selectedCommessaLocal, setSelectedCommessaLocal] = useState(selectedCommessa || null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false); // NEW: For manual refresh animation
  const [autoRefresh, setAutoRefresh] = useState(true); // NEW: Auto-refresh toggle
  const [lastUpdated, setLastUpdated] = useState(null); // NEW: Last refresh timestamp
  const [showCreateModal, setShowCreateModal] = useState(false);

  // LOCK: fetch active cliente locks and refresh every 10s for badges + window focus
  const { locksByClienteId: activeClienteLocks, refresh: refreshClienteLocks } = useActiveClienteLocks();

  // Fetch all custom statuses (across commesse/tipologie) for the advanced filter dropdown
  const [allCustomStatuses, setAllCustomStatuses] = useState([]);
  // Fetch distinct status values currently used on clienti, so we never miss a status
  const [distinctStatusValues, setDistinctStatusValues] = useState([]);
  useEffect(() => {
    const fetchAllCustomStatuses = async () => {
      try {
        const res = await axios.get(`${API}/cliente-custom-statuses?active_only=true`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setAllCustomStatuses(Array.isArray(res.data) ? res.data : []);
      } catch (_) {
        setAllCustomStatuses([]);
      }
    };
    const fetchDistinctStatuses = async () => {
      try {
        const res = await axios.get(`${API}/clienti/filter-options`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const opts = res.data?.status_values || res.data?.statuses || res.data?.status || [];
        setDistinctStatusValues(Array.isArray(opts) ? opts : []);
      } catch (_) {
        setDistinctStatusValues([]);
      }
    };
    fetchAllCustomStatuses();
    fetchDistinctStatuses();
  }, []);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedClientName, setSelectedClientName] = useState('');
  const [clienteHistory, setClienteHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const searchTimeoutRef = React.useRef(null); // Use ref instead of window variable
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false); // Mobile: collapsed by default
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: '',
    enabled: false
  });
  // New filter states
  const [clientiFilterStatus, setClientiFilterStatus] = useState({ included: [], excluded: [] });
  const [clientiFilterTipologia, setClientiFilterTipologia] = useState({ included: [], excluded: [] });
  const [clientiFilterSubAgenzia, setClientiFilterSubAgenzia] = useState({ included: [], excluded: [] });
  const [clientiFilterCreatedBy, setClientiFilterCreatedBy] = useState({ included: [], excluded: [] });
  // NEW: Additional filter states
  const [clientiFilterServizi, setClientiFilterServizi] = useState({ included: [], excluded: [] });
  const [clientiFilterSegmento, setClientiFilterSegmento] = useState({ included: [], excluded: [] });
  const [clientiFilterCommesse, setClientiFilterCommesse] = useState({ included: [], excluded: [] });
  const [users, setUsers] = useState([]);
  // Dynamic filter options
  const [filterOptions, setFilterOptions] = useState({
    tipologie_contratto: [],
    status_values: [],
    segmenti: [],
    sub_agenzie: [],
    users: [],
    servizi: [],       // NEW: Servizi filter options
    commesse: []       // NEW: Commesse filter options
  });
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Get filtered clients (search & date filter ora gestiti server-side)
  const getFilteredClients = () => {
    return clienti;
  };

  useEffect(() => {
    try {
      // Always fetch commesse and sub agenzie to ensure fresh data
      console.log("📊 ClientiManagement: Inizializzazione - caricando dati...");
      fetchCommesse();
      fetchSubAgenzie();
      fetchUsers();
      fetchFilterOptions();
      fetchClienti();
    } catch (error) {
      console.error("ClientiManagement useEffect error:", error);
      toast({
        title: "Errore",
        description: "Errore durante il caricamento iniziale",
        variant: "destructive",
      });
    }
    
    // Cleanup search timeout on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [selectedUnit, selectedCommessaLocal, clientiFilterSubAgenzia, clientiFilterStatus, clientiFilterTipologia, clientiFilterCreatedBy, clientiFilterServizi, clientiFilterSegmento, clientiFilterCommesse, dateFilter]);

  // Auto-refresh clienti every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return; // Only auto-refresh if enabled

    const intervalId = setInterval(() => {
      fetchClienti(true); // true indica che è un refresh automatico
      refreshClienteLocks(); // 🔒 aggiorna anche i badge lock
    }, 30000); // 30 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [selectedUnit, selectedCommessaLocal, clientiFilterSubAgenzia, clientiFilterStatus, clientiFilterTipologia, clientiFilterCreatedBy, clientiFilterServizi, clientiFilterSegmento, clientiFilterCommesse, dateFilter, autoRefresh]);

  const fetchCommesse = async () => {
    try {
      console.log("🔄 ClientiManagement: Caricando commesse...");
      const response = await axios.get(`${API}/commesse`);
      console.log("✅ ClientiManagement: Commesse caricate:", response.data.length, "elementi");
      setCommesse(response.data);
    } catch (error) {
      console.error("❌ ClientiManagement: Error fetching commesse:", error);
      setCommesse([]);
    }
  };

  const fetchSubAgenzie = async () => {
    try {
      console.log("🔄 ClientiManagement: Caricando sub agenzie...");
      const response = await axios.get(`${API}/sub-agenzie`);
      console.log("✅ ClientiManagement: Sub agenzie caricate:", response.data.length, "elementi");
      setSubAgenzie(response.data);
    } catch (error) {
      console.error("❌ ClientiManagement: Error fetching sub agenzie:", error);
      setSubAgenzie([]);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await axios.get(`${API}/clienti/filter-options`);
      setFilterOptions(response.data);
      console.log("📊 Filter options loaded:", response.data);
    } catch (error) {
      console.error("Error fetching filter options:", error);
      toast({
        title: "Attenzione", 
        description: "Errore nel caricamento opzioni filtri", 
        variant: "destructive"
      });
    }
  };

  const fetchClienti = async (isAutoRefresh = false, page = currentPage, searchValue = null) => {
    try {
      if (!isAutoRefresh) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      // 🔒 Mantieni sincronizzato anche lo stato dei lock col refresh lista
      refreshClienteLocks();
      const params = new URLSearchParams();
      
      // Pagination params
      params.append('page', page.toString());
      params.append('page_size', pageSize.toString());
      
      if (selectedCommessaLocal && selectedCommessaLocal !== 'all') {
        params.append('commessa_id', selectedCommessaLocal);
      }
      // Helper to append multi-value + exclusion filters
      const appendMulti = (paramName, filter) => {
        (filter?.included || []).forEach((v) => params.append(paramName, v));
        (filter?.excluded || []).forEach((v) => params.append(`${paramName}_exclude`, v));
      };
      appendMulti('sub_agenzia_id', clientiFilterSubAgenzia);
      appendMulti('status', clientiFilterStatus);
      appendMulti('tipologia_contratto', clientiFilterTipologia);
      appendMulti('assigned_to', clientiFilterCreatedBy);
      appendMulti('servizio_id', clientiFilterServizi);
      appendMulti('segmento', clientiFilterSegmento);
      appendMulti('commessa_id_filter', clientiFilterCommesse);
      // Date range filter (server-side, deve filtrare l'intero dataset non solo la pagina corrente)
      if (dateFilter?.enabled) {
        if (dateFilter.startDate) params.append('date_from', dateFilter.startDate);
        if (dateFilter.endDate) params.append('date_to', dateFilter.endDate);
      }
      // Use passed searchValue if provided, otherwise use state
      const effectiveSearch = searchValue !== null ? searchValue : searchQuery;
      if (effectiveSearch && effectiveSearch.trim()) {
        params.append('search', effectiveSearch.trim());
      }
      
      const response = await axios.get(`${API}/clienti?${params}`);
      
      // Handle paginated response
      const { clienti: clientiData, total, page: responsePage, page_size, total_pages } = response.data;
      setClienti(clientiData);
      setAllClienti(clientiData); // For local filtering compatibility
      setTotalClienti(total);
      setTotalPages(total_pages);
      setCurrentPage(responsePage);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching clienti:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei clienti",
        variant: "destructive",
      });
    } finally {
      if (!isAutoRefresh) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      fetchClienti(false, newPage);
    }
  };

  const handleManualRefresh = () => {
    fetchClienti(false, 1); // Refresh from page 1
    setCurrentPage(1);
  };

  // Filter clients - now uses server-side filtering
  const filterClienti = (query, type) => {
    // Server-side filtering: reload from page 1 with search param
    setCurrentPage(1);
    fetchClienti(false, 1);
  };

  // Handle search input change - dynamic search with debounce
  const handleSearchChange = (query) => {
    setSearchQuery(query);
    
    // Clear existing timeout using ref
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce search - wait 600ms after user stops typing
    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1);
      // Pass the query directly to avoid React state timing issues
      fetchClientiDirect(query);
    }, 600);
  };
  
  // Direct fetch with explicit search value (avoids state timing issues)
  const fetchClientiDirect = async (searchValue) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      params.append('page', '1');
      params.append('page_size', pageSize.toString());
      
      if (selectedCommessaLocal && selectedCommessaLocal !== 'all') {
        params.append('commessa_id', selectedCommessaLocal);
      }
      const appendMulti2 = (paramName, filter) => {
        (filter?.included || []).forEach((v) => params.append(paramName, v));
        (filter?.excluded || []).forEach((v) => params.append(`${paramName}_exclude`, v));
      };
      appendMulti2('sub_agenzia_id', clientiFilterSubAgenzia);
      appendMulti2('status', clientiFilterStatus);
      appendMulti2('tipologia_contratto', clientiFilterTipologia);
      appendMulti2('assigned_to', clientiFilterCreatedBy);
      appendMulti2('servizio_id', clientiFilterServizi);
      appendMulti2('segmento', clientiFilterSegmento);
      appendMulti2('commessa_id_filter', clientiFilterCommesse);
      if (dateFilter?.enabled) {
        if (dateFilter.startDate) params.append('date_from', dateFilter.startDate);
        if (dateFilter.endDate) params.append('date_to', dateFilter.endDate);
      }

      // Only add search if not empty
      if (searchValue && searchValue.trim()) {
        params.append('search', searchValue.trim());
      }
      
      const response = await axios.get(`${API}/clienti?${params}`);
      const { clienti: clientiData, total, page: responsePage, page_size, total_pages } = response.data;
      
      setClienti(clientiData);
      setAllClienti(clientiData);
      setTotalClienti(total);
      setTotalPages(total_pages);
      setCurrentPage(responsePage);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching clienti:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei clienti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Remove unused functions
  const handleSearchKeyPress = (e) => {
    // No longer needed - search is automatic
  };
  
  const handleSearchClick = () => {
    // No longer needed - search is automatic
  };

  // Handle search type change
  const handleSearchTypeChange = (type) => {
    setSearchType(type);
  };

  const createCliente = async (clienteData) => {
    
    try {
      const response = await axios.post(`${API}/clienti`, clienteData);
      console.log("✅ POST REQUEST SUCCESS:", response);
      
      setClienti([response.data, ...clienti]);
      setAllClienti([response.data, ...allClienti]); // Update all clients too
      
      // Refresh filter options to include new data
      fetchFilterOptions();
      
      toast({
        title: "Successo",
        description: "Cliente creato con successo",
      });
      console.log("✅ CLIENTE CREATION COMPLETED SUCCESSFULLY");
    } catch (error) {
      console.error("❌ ERROR CREATING CLIENTE:", error);
      const details = error.response?.data;
      console.error("❌ Error Details (FULL):", JSON.stringify({
        message: error.message,
        status: error.response?.status,
        data: details
      }, null, 2));
      // Extract human-readable validation errors
      let errorDescription = "Errore nella creazione del cliente";
      if (details?.detail) {
        if (typeof details.detail === 'string') {
          errorDescription = details.detail;
        } else if (Array.isArray(details.detail)) {
          errorDescription = details.detail.map(e => {
            const field = Array.isArray(e.loc) ? e.loc.slice(1).join('.') : '';
            return `${field}: ${e.msg}`;
          }).join(' | ');
        } else {
          errorDescription = JSON.stringify(details.detail);
        }
      }
      toast({
        title: "Errore validazione",
        description: errorDescription.substring(0, 400),
        variant: "destructive",
      });
    }
  };

  const updateCliente = async (clienteId, updateData) => {
    try {
      const response = await axios.put(`${API}/clienti/${clienteId}`, updateData);
      setClienti(clienti.map(cliente => 
        cliente.id === clienteId ? response.data : cliente
      ));
      setAllClienti(allClienti.map(cliente => 
        cliente.id === clienteId ? response.data : cliente
      ));
      
      // Refresh filter options to include new data
      fetchFilterOptions();
      
      toast({
        title: "Successo",
        description: "Cliente aggiornato con successo",
      });
      setShowEditModal(false);
      setSelectedCliente(null);
    } catch (error) {
      console.error("Error updating cliente:", error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento del cliente",
        variant: "destructive",
      });
    }
  };

  const handleViewCliente = (cliente) => {
    setSelectedCliente(cliente);
    setShowViewModal(true);
  };

  const handleEditCliente = (cliente) => {
    setSelectedCliente(cliente);
    setShowEditModal(true);
  };

  const handleViewDocuments = (cliente) => {
    setSelectedClientId(cliente.id);
    setSelectedClientName(`${cliente.nome} ${cliente.cognome}`);
    setShowDocumentsModal(true);
  };

  // Cache per i nomi utenti per evitare chiamate ripetute
  const [userDisplayCache, setUserDisplayCache] = useState({});

  // Funzione helper per ottenere il nome dell'utente
  const getUserDisplayName = (userId) => {
    if (!userId) return "N/A";
    
    // Controlla cache prima
    if (userDisplayCache[userId]) {
      return userDisplayCache[userId];
    }
    
    // Se non in cache, carica async e ritorna placeholder nel frattempo
    loadUserDisplayName(userId);
    return userId.substring(0, 8) + "...";
  };

  // Funzione per caricare nome utente e aggiornare cache
  const loadUserDisplayName = async (userId) => {
    if (userDisplayCache[userId]) return; // Già caricato o in caricamento
    
    try {
      const response = await axios.get(`${API}/users/display-name/${userId}`);
      setUserDisplayCache(prev => ({
        ...prev,
        [userId]: response.data.display_name
      }));
    } catch (error) {
      console.error(`Error loading user display name for ${userId}:`, error);
      setUserDisplayCache(prev => ({
        ...prev,
        [userId]: userId.substring(0, 8) + "..."
      }));
    }
  };

  const handleViewClienteHistory = async (cliente) => {
    setSelectedCliente(cliente);
    setSelectedClientName(`${cliente.nome} ${cliente.cognome}`);
    setLoadingHistory(true);
    setShowHistoryModal(true);
    
    try {
      const response = await axios.get(`${API}/clienti/${cliente.id}/logs`);
      setClienteHistory(response.data.logs || []);
    } catch (error) {
      console.error("Error fetching cliente history:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare la cronologia del cliente",
        variant: "destructive"
      });
      setClienteHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const deleteCliente = async (clienteId) => {
    try {
      await axios.delete(`${API}/clienti/${clienteId}`);
      
      // Remove from both states
      setClienti(clienti.filter(c => c.id !== clienteId));
      setAllClienti(allClienti.filter(c => c.id !== clienteId));
      
      // Refresh filter options after deletion
      fetchFilterOptions();
      
      toast({
        title: "Successo",
        description: "Cliente eliminato con successo",
      });
    } catch (error) {
      console.error("Error deleting cliente:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'eliminazione del cliente",
        variant: "destructive",
      });
    }
  };

  // Filter clients by date range
  const filterClientsByDate = (clientsToFilter) => {
    if (!dateFilter.enabled || (!dateFilter.startDate && !dateFilter.endDate)) {
      return clientsToFilter;
    }

    return clientsToFilter.filter(cliente => {
      if (!cliente.created_at) return true; // Include clients without creation date
      
      const clientDate = new Date(cliente.created_at);
      const start = dateFilter.startDate ? new Date(dateFilter.startDate) : null;
      const end = dateFilter.endDate ? new Date(dateFilter.endDate) : null;
      
      if (start && end) {
        return clientDate >= start && clientDate <= end;
      } else if (start) {
        return clientDate >= start;
      } else if (end) {
        return clientDate <= end;
      }
      
      return true;
    });
  };

  // Export clients to CSV
  const exportClients = async () => {
    if (clienti.length === 0) {
      toast({
        title: "Attenzione",
        description: "Non ci sono clienti da esportare",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    
    try {
      // Build query parameters for backend filtering
      const params = new URLSearchParams();
      
      // Apply ALL current filters to backend request for accurate export (multi + exclude)
      const appendMultiX = (paramName, filter) => {
        (filter?.included || []).forEach((v) => params.append(paramName, v));
        (filter?.excluded || []).forEach((v) => params.append(`${paramName}_exclude`, v));
      };
      appendMultiX('sub_agenzia_id', clientiFilterSubAgenzia);
      appendMultiX('tipologia_contratto', clientiFilterTipologia);
      appendMultiX('status', clientiFilterStatus);
      appendMultiX('assigned_to', clientiFilterCreatedBy);
      appendMultiX('servizio_id', clientiFilterServizi);
      appendMultiX('segmento', clientiFilterSegmento);
      appendMultiX('commessa_id_filter', clientiFilterCommesse);
      
      // NEW: Add search query and search type for name/CF/etc filtering
      if (searchQuery && searchQuery.trim() !== '') {
        params.append('search', searchQuery.trim());
        params.append('search_type', searchType);
      }
      
      // NEW: Add date range filter for creation period
      if (dateFilter.enabled && (dateFilter.startDate || dateFilter.endDate)) {
        if (dateFilter.startDate) {
          params.append('date_from', dateFilter.startDate);
        }
        if (dateFilter.endDate) {
          params.append('date_to', dateFilter.endDate);
        }
      }

      // Call backend Excel export endpoint
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/clienti/export/excel?${params.toString()}`,
        {
          headers: { 
            Authorization: `Bearer ${localStorage.getItem('token')}` 
          },
          responseType: 'blob'
        }
      );

      // Create download link for Excel file
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Generate filename with current date
      const filename = `clienti_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Successo",
        description: `File Excel esportato con successo: ${filename}`,
      });

    } catch (error) {
      console.error('Error exporting clients to Excel:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'esportazione Excel dei clienti",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (selectedCommessa) {
      fetchClienti();
    }
  }, [selectedCommessa]);

  // NOTE: Removed problematic useEffect that was causing search instability
  // The search is now handled directly by handleSearchChange with debounce

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col space-y-3 md:space-y-0 md:flex-row md:justify-between md:items-center">
        <h2 className="text-xl md:text-2xl font-bold">Gestione Clienti</h2>
        
        {/* Mobile: Status info */}
        <div className="flex flex-wrap items-center gap-2 text-sm md:hidden">
          {lastUpdated && (
            <span className="text-gray-500">
              Agg: {lastUpdated.toLocaleTimeString('it-IT')}
            </span>
          )}
          {isRefreshing && (
            <span className="text-blue-600 animate-pulse">Aggiornando...</span>
          )}
        </div>
        
        {/* Desktop: Status info */}
        <div className="hidden md:flex space-x-3 items-center">
          {lastUpdated && (
            <div className="text-sm text-gray-500">
              Ultimo aggiornamento: {lastUpdated.toLocaleTimeString('it-IT')}
            </div>
          )}
          {isRefreshing && (
            <span className="text-sm text-blue-600 animate-pulse">
              Aggiornamento in corso...
            </span>
          )}
        </div>
      </div>
      
      {/* Controls Row - Mobile Responsive */}
      <div className="flex flex-col space-y-3">
        {/* Auto refresh + Manual refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="auto-refresh-clienti"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="auto-refresh-clienti" className="text-sm text-gray-700">
              Auto refresh (30s)
            </label>
          </div>
          
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualRefresh}
            disabled={loading || isRefreshing}
            className="flex items-center space-x-1"
          >
            <Clock className={`w-4 h-4 ${(loading || isRefreshing) ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Aggiorna ora</span>
          </Button>
        </div>
        
        {/* Commessa Select + Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Select 
            value={selectedCommessaLocal || "all"} 
            onValueChange={(value) => setSelectedCommessaLocal(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Seleziona Commessa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le Commesse</SelectItem>
              {commesse.map((commessa) => (
                <SelectItem key={commessa.id} value={commessa.id}>
                  {commessa.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => {
                fetchSubAgenzie();
                setShowCreateModal(true);
              }}
              disabled={!selectedCommessa}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Nuovo Cliente</span>
              <span className="sm:hidden">Nuovo</span>
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                fetchSubAgenzie();
                setShowImportModal(true);
              }}
              disabled={!selectedCommessa}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <Upload className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Importa Clienti</span>
              <span className="sm:hidden">Importa</span>
            </Button>
            <Button
              variant="outline"
              onClick={exportClients}
              disabled={clienti.length === 0 || isExporting}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              {isExporting ? (
                <>
                  <Clock className="w-4 h-4 mr-1 animate-spin" />
                  <span className="hidden sm:inline">Esportando...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Esporta Excel</span>
                  <span className="sm:hidden">Esporta</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Date Filter Section - Mobile Responsive */}
      <div className="bg-gray-50 p-3 md:p-4 rounded-lg border">
        <div className="flex flex-col space-y-3">
          {/* First Row: Checkbox + Total */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="enable-date-filter"
                checked={dateFilter.enabled}
                onChange={(e) => setDateFilter(prev => ({
                  ...prev,
                  enabled: e.target.checked,
                  startDate: e.target.checked ? prev.startDate : '',
                  endDate: e.target.checked ? prev.endDate : ''
                }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="enable-date-filter" className="text-sm font-medium text-gray-700">
                Filtra per data
              </label>
            </div>
            
            {/* Total count - always visible */}
            <div className="text-sm text-gray-600">
              <span className="font-medium">Totale: </span>
              <span className="text-blue-600 font-semibold">{totalClienti}</span>
            </div>
          </div>
          
          {/* Second Row: Date inputs (only when enabled) */}
          {dateFilter.enabled && (
            <>
              {/* Date shortcuts row */}
              <div className="flex flex-wrap items-center gap-2" data-testid="clienti-date-shortcuts">
                <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Scorciatoie:</span>
                {(() => {
                  const toISO = (d) => d.toISOString().split('T')[0];
                  const today = new Date();
                  const todayISO = toISO(today);
                  const last7Start = new Date(today); last7Start.setDate(today.getDate() - 6);
                  const last7ISO = toISO(last7Start);
                  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                  const monthStartISO = toISO(monthStart);
                  const last30Start = new Date(today); last30Start.setDate(today.getDate() - 29);
                  const last30ISO = toISO(last30Start);
                  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

                  const presets = [
                    { id: 'today', label: 'Oggi', from: todayISO, to: todayISO },
                    { id: '7d', label: 'Ultimi 7 giorni', from: last7ISO, to: todayISO },
                    { id: '30d', label: 'Ultimi 30 giorni', from: last30ISO, to: todayISO },
                    { id: 'month', label: 'Mese corrente', from: monthStartISO, to: todayISO },
                    { id: 'last_month', label: 'Mese scorso', from: toISO(lastMonthStart), to: toISO(lastMonthEnd) },
                  ];
                  const apply = (p) => setDateFilter(prev => ({ ...prev, startDate: p.from, endDate: p.to }));
                  const isActive = (p) => dateFilter.startDate === p.from && dateFilter.endDate === p.to;
                  return presets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => apply(p)}
                      data-testid={`clienti-date-preset-${p.id}`}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                        isActive(p)
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ));
                })()}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex items-center space-x-2 flex-1">
                <label className="text-sm text-gray-600 w-8">Dal:</label>
                <input
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => setDateFilter(prev => ({
                    ...prev,
                    startDate: e.target.value
                  }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center space-x-2 flex-1">
                <label className="text-sm text-gray-600 w-8">Al:</label>
                <input
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => setDateFilter(prev => ({
                    ...prev,
                    endDate: e.target.value
                  }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDateFilter(prev => ({
                    ...prev,
                    startDate: '',
                    endDate: ''
                  }));
                }}
                className="w-full sm:w-auto"
              >
                <X className="w-3 h-3 mr-1" />
                Azzera
              </Button>
            </div>
            </>
          )}

          {dateFilter.enabled && (dateFilter.startDate || dateFilter.endDate) && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Filtrati: </span>
              <span className="text-blue-600 font-semibold">
                {totalClienti}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Filters Section - Collapsible on Mobile */}
      <div className="bg-blue-50 p-3 md:p-4 rounded-lg border">
        {/* Mobile: Toggle button */}
        <button 
          className="md:hidden w-full flex items-center justify-between text-left"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          <h3 className="text-base font-semibold text-gray-800">Filtri Avanzati</h3>
          <ChevronDown className={`w-5 h-5 text-gray-600 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
        </button>
        
        {/* Desktop: Always visible title */}
        <h3 className="hidden md:block text-lg font-semibold mb-4 text-gray-800">Filtri Avanzati</h3>
        
        {/* Filters Grid - Hidden on mobile unless expanded, scrollable when open */}
        <div className={`${showAdvancedFilters ? 'block mt-4 max-h-[50vh] overflow-y-auto' : 'hidden'} md:block md:max-h-none md:overflow-visible`}>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 gap-2 md:gap-4">
          {/* Sub Agenzia Filter */}
          <MultiSelectFilter
            label="Sub Agenzia"
            options={(filterOptions.sub_agenzie || []).map((s) => ({ value: s.value, label: s.label }))}
            included={clientiFilterSubAgenzia.included}
            excluded={clientiFilterSubAgenzia.excluded}
            onChange={setClientiFilterSubAgenzia}
            placeholder="Tutte le Sub Agenzie"
            testid="filter-subagenzia"
          />

          {/* Tipologia Contratto Filter */}
          <MultiSelectFilter
            label="Tipologia"
            options={(filterOptions.tipologie_contratto || []).map((t) => ({ value: t.value, label: t.label }))}
            included={clientiFilterTipologia.included}
            excluded={clientiFilterTipologia.excluded}
            onChange={setClientiFilterTipologia}
            placeholder="Tutte le Tipologie"
            testid="filter-tipologia"
          />

          {/* Status Filter */}
          <MultiSelectFilter
            label="Status"
            options={(() => {
              const out = [];
              const seen = new Set();
              for (const st of (STATUS_CLIENTI || [])) {
                if (st?.value && !seen.has(st.value)) { out.push({ value: st.value, label: st.label }); seen.add(st.value); }
              }
              for (const cs of (allCustomStatuses || [])) {
                if (cs?.value && !seen.has(cs.value)) { out.push({ value: cs.value, label: cs.name || cs.value }); seen.add(cs.value); }
              }
              for (const it of (distinctStatusValues || [])) {
                if (it?.value && !seen.has(it.value)) { out.push({ value: it.value, label: it.label || it.value }); seen.add(it.value); }
              }
              return out;
            })()}
            included={clientiFilterStatus.included}
            excluded={clientiFilterStatus.excluded}
            onChange={setClientiFilterStatus}
            placeholder="Tutti gli Status"
            testid="filter-status"
          />

          {/* Created By / Assigned Filter */}
          <MultiSelectFilter
            label="Assegnato"
            options={(filterOptions.users || []).map((u) => ({ value: u.value, label: u.label }))}
            included={clientiFilterCreatedBy.included}
            excluded={clientiFilterCreatedBy.excluded}
            onChange={setClientiFilterCreatedBy}
            placeholder="Tutti gli Utenti"
            testid="filter-assigned"
          />

          {/* Servizi Filter */}
          <MultiSelectFilter
            label="Servizi"
            options={(filterOptions.servizi || []).map((s) => ({ value: s.value, label: s.label }))}
            included={clientiFilterServizi.included}
            excluded={clientiFilterServizi.excluded}
            onChange={setClientiFilterServizi}
            placeholder="Tutti i Servizi"
            testid="filter-servizi"
          />

          {/* Segmento Filter */}
          <MultiSelectFilter
            label="Segmento"
            options={(filterOptions.segmenti || []).map((s) => ({ value: s.value, label: s.label }))}
            included={clientiFilterSegmento.included}
            excluded={clientiFilterSegmento.excluded}
            onChange={setClientiFilterSegmento}
            placeholder="Tutti i Segmenti"
            testid="filter-segmento"
          />

          {/* Commesse Filter */}
          <MultiSelectFilter
            label="Commesse"
            options={(filterOptions.commesse || []).map((c) => ({ value: c.value, label: c.label }))}
            included={clientiFilterCommesse.included}
            excluded={clientiFilterCommesse.excluded}
            onChange={setClientiFilterCommesse}
            placeholder="Tutte le Commesse"
            testid="filter-commesse"
          />
        </div>

        {/* Clear All Filters Button - Inside collapsible section */}
        <div className={`${showAdvancedFilters ? 'flex' : 'hidden'} md:flex mt-3 md:mt-4 justify-end`}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setClientiFilterSubAgenzia({ included: [], excluded: [] });
              setClientiFilterTipologia({ included: [], excluded: [] });
              setClientiFilterStatus({ included: [], excluded: [] });
              setClientiFilterCreatedBy({ included: [], excluded: [] });
              setClientiFilterServizi({ included: [], excluded: [] });
              setClientiFilterSegmento({ included: [], excluded: [] });
              setClientiFilterCommesse({ included: [], excluded: [] });
            }}
          >
            <X className="w-4 h-4 mr-2" />
            Azzera Filtri
          </Button>
        </div>
        </div>
      </div>

      {/* Search Field */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Cerca clienti..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={searchType} onValueChange={handleSearchTypeChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Tipo ricerca" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i campi</SelectItem>
            <SelectItem value="id">ID Cliente</SelectItem>
            <SelectItem value="cognome">Cognome</SelectItem>
            <SelectItem value="codice_fiscale">Codice Fiscale</SelectItem>
            <SelectItem value="partita_iva">Partita IVA</SelectItem>
            <SelectItem value="telefono">Telefono</SelectItem>
            <SelectItem value="email">Email</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero Ordine</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Tipologia Contratto</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Sub Agenzia</TableHead>
                  <TableHead>Assegnato a</TableHead>
                  <TableHead>Data Creazione</TableHead>
                  <TableHead>Nome Completo</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getFilteredClients().map((cliente) => (
                  <TableRow key={cliente.id}>
                    {/* Numero Ordine */}
                    <TableCell>
                      <span className="font-mono text-sm">{cliente.numero_ordine || 'N/A'}</span>
                    </TableCell>
                    {/* Stato */}
                    <TableCell>
                      <span className="inline-flex items-center">
                        <Badge variant={getClienteStatusVariant(cliente.status)}>
                          {formatClienteStatus(cliente.status)}
                        </Badge>
                        <PostVenditaStatusDot cliente={cliente} />
                      </span>
                    </TableCell>
                    {/* Tipologia Contratto */}
                    <TableCell>
                      <span className="text-sm capitalize">
                        {cliente.tipologia_contratto?.replace(/_/g, ' ') || 'N/A'}
                      </span>
                    </TableCell>
                    {/* Segmento */}
                    <TableCell>
                      <span className="text-sm capitalize">
                        {cliente.segmento_nome || cliente.segmento || 'N/A'}
                      </span>
                    </TableCell>
                    {/* Sub Agenzia */}
                    <TableCell>
                      {subAgenzie.find(sa => sa.id === cliente.sub_agenzia_id)?.nome || 'N/A'}
                    </TableCell>
                    {/* Creato da / Assegnato a */}
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <User className="w-3 h-3 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {cliente.assigned_to 
                            ? getUserDisplayName(cliente.assigned_to)
                            : cliente.created_by 
                              ? getUserDisplayName(cliente.created_by) 
                              : 'N/A'}
                        </span>
                      </div>
                    </TableCell>
                    {/* Data Creazione */}
                    <TableCell>
                      {new Date(cliente.created_at).toLocaleDateString('it-IT')}
                    </TableCell>
                    {/* Nome Completo */}
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <FileUser className="w-4 h-4 text-green-600" />
                        <span>{cliente.nome} {cliente.cognome}</span>
                        {activeClienteLocks[cliente.id] && (
                          <span
                            title={`🔒 In lavorazione da ${activeClienteLocks[cliente.id].username}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 rounded-full"
                            data-testid={`cliente-lock-badge-${cliente.id}`}
                          >
                            🔒 {activeClienteLocks[cliente.id].username}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {/* Azioni */}
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewCliente(cliente)}
                          title="Visualizza cliente"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewDocuments(cliente)}
                          title="Gestisci documenti"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewClienteHistory(cliente)}
                          title="Cronologia e Log cliente"
                        >
                          <History className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditCliente(cliente)}
                          title="Modifica cliente"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => {
                            if (confirm(`Eliminare definitivamente il cliente "${cliente.nome} ${cliente.cognome}"?`)) {
                              deleteCliente(cliente.id);
                            }
                          }}
                          title="Elimina cliente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View - Scrollable */}
          <div className="md:hidden max-h-[60vh] overflow-y-auto">
            {getFilteredClients().map((cliente) => (
              <div key={cliente.id} className="border-b border-slate-200 p-4 last:border-b-0">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <FileUser className="w-4 h-4 text-green-600" />
                      <h3 className="font-semibold text-slate-900">
                        {cliente.nome} {cliente.cognome}
                      </h3>
                    </div>
                    <p className="text-sm text-slate-500 font-mono">ID: {cliente.cliente_id}</p>
                  </div>
                  <span className="inline-flex items-center">
                    <Badge 
                      variant={getClienteStatusVariant(cliente.status)}
                      className="text-xs"
                    >
                      {formatClienteStatus(cliente.status)}
                    </Badge>
                    <PostVenditaStatusDot cliente={cliente} />
                  </span>
                </div>
                
                <div className="grid grid-cols-1 gap-2 mb-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-600">{cliente.email || 'N/A'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-600">{cliente.telefono}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Building className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-600">
                      {commesse.find(c => c.id === cliente.commessa_id)?.nome || 'N/A'}
                    </span>
                  </div>
                  {cliente.sub_agenzia_id && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-600">
                        {subAgenzie.find(sa => sa.id === cliente.sub_agenzia_id)?.nome || 'N/A'}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-600">
                      {new Date(cliente.created_at).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  {/* Prima riga: Vista e Documenti */}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleViewCliente(cliente)}
                    className="w-full"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Vista
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleViewDocuments(cliente)}
                    className="w-full"
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    Documenti
                  </Button>
                  
                  {/* Seconda riga: Log e Modifica */}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleViewClienteHistory(cliente)}
                    className="w-full"
                  >
                    <History className="w-4 h-4 mr-1" />
                    Log
                  </Button>
                  
                  {/* Modifica button - hidden for locked status unless admin/responsabile_commessa/backoffice_commessa */}
                  {(user.role === "admin" || user.role === "responsabile_commessa" || user.role === "backoffice_commessa" || (cliente.status !== "inserito" && cliente.status !== "ko")) && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEditCliente(cliente)}
                      className="w-full"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Modifica
                    </Button>
                  )}
                  
                  {/* Placeholder if Edit button is hidden to maintain layout */}
                  {(user.role !== "admin" && user.role !== "responsabile_commessa" && user.role !== "backoffice_commessa" && (cliente.status === "inserito" || cliente.status === "ko")) && (
                    <div className="w-full flex items-center justify-center text-xs text-gray-400 border border-gray-300 rounded px-2 py-2">
                      🔒 Bloccato
                    </div>
                  )}
                  
                  {/* Elimina button - hidden for locked status unless admin/responsabile_commessa/backoffice_commessa */}
                  {(user.role === "admin" || user.role === "responsabile_commessa" || user.role === "backoffice_commessa" || (cliente.status !== "inserito" && cliente.status !== "ko")) && (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => {
                        if (confirm(`Eliminare definitivamente il cliente "${cliente.nome} ${cliente.cognome}"?`)) {
                          deleteCliente(cliente.id);
                        }
                      }}
                      className="w-full col-span-2"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Elimina
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {getFilteredClients().length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {selectedCommessaLocal ? 'Nessun cliente trovato per questa commessa' : 'Seleziona una commessa per vedere i clienti'}
              </p>
            </div>
          )}

          {/* Pagination Controls - Mobile Responsive */}
          {totalPages > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 md:p-4 border-t">
              {/* Info text */}
              <div className="text-sm text-slate-600 text-center sm:text-left">
                <span className="hidden sm:inline">Mostrando </span>{clienti.length} di {totalClienti} 
                <span className="hidden sm:inline"> clienti</span>
                <span className="mx-1">•</span>
                Pag. {currentPage}/{totalPages}
              </div>
              
              {/* Pagination buttons */}
              <div className="flex items-center justify-center gap-1">
                {/* First/Prev - Hidden on mobile, show icons */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="hidden sm:flex"
                >
                  Prima
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <span className="sm:hidden">←</span>
                  <span className="hidden sm:inline">← Prec</span>
                </Button>
                
                {/* Page numbers - Show 3 on mobile, 5 on desktop */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(window.innerWidth < 640 ? 3 : 5, totalPages) }, (_, i) => {
                    let pageNum;
                    const maxPages = window.innerWidth < 640 ? 3 : 5;
                    if (totalPages <= maxPages) {
                      pageNum = i + 1;
                    } else if (currentPage <= Math.ceil(maxPages / 2)) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - Math.floor(maxPages / 2)) {
                      pageNum = totalPages - maxPages + 1 + i;
                    } else {
                      pageNum = currentPage - Math.floor(maxPages / 2) + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-8 sm:w-10 px-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <span className="sm:hidden">→</span>
                  <span className="hidden sm:inline">Succ →</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="hidden sm:flex"
                >
                  Ultima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Cliente Modal */}
      <CreateClienteModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={createCliente}
        commesse={commesse}
        subAgenzie={subAgenzie}
        selectedCommessa={selectedCommessaLocal}
        user={user}
      />

      {/* Import Clienti Modal */}
      <ImportClientiModal 
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          fetchClienti(); // Refresh list after import
        }}
        commesse={commesse}
        subAgenzie={subAgenzie}
        selectedCommessa={selectedCommessaLocal}
      />

      {/* View Cliente Modal */}
      {showViewModal && selectedCliente && (
        <ViewClienteModal 
          cliente={selectedCliente}
          onClose={() => {
            setShowViewModal(false);
            setSelectedCliente(null);
            // 🔒 Rilascio lock in corso lato server: refreshiamo dopo breve delay per aggiornare badge
            setTimeout(() => refreshClienteLocks(), 800);
          }}
          commesse={commesse}
          subAgenzie={subAgenzie}
          servizi={servizi}
        />
      )}

      {/* Edit Cliente Modal */}
      {showEditModal && selectedCliente && (
        <EditClienteModal 
          cliente={selectedCliente}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCliente(null);
            // 🔒 Rilascio lock in corso lato server: refreshiamo dopo breve delay per aggiornare badge
            setTimeout(() => refreshClienteLocks(), 800);
          }}
          onSubmit={(updateData) => updateCliente(selectedCliente.id, updateData)}
          commesse={commesse}
          subAgenzie={subAgenzie}
        />
      )}

      {/* Documents Modal */}
      {showDocumentsModal && (
        <ClientDocumentsModal
          isOpen={showDocumentsModal}
          onClose={() => {
            setShowDocumentsModal(false);
            setSelectedClientId(null);
            setSelectedClientName('');
          }}
          clientId={selectedClientId}
          clientName={selectedClientName}
        />
      )}

      {/* Cliente History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-semibold flex items-center">
                  <History className="w-5 h-5 mr-2 text-blue-600" />
                  Cronologia Cliente
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedClientName} - Tutte le attività e modifiche
                </p>
              </div>
              <Button 
                variant="ghost" 
                onClick={() => {
                  setShowHistoryModal(false);
                  setSelectedCliente(null);
                  setClienteHistory([]);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                    <p className="text-gray-600">Caricamento cronologia...</p>
                  </div>
                </div>
              ) : clienteHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">
                    Nessuna attività registrata
                  </h3>
                  <p className="text-gray-500">
                    Non ci sono ancora log di attività per questo cliente
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-gray-900">
                      {clienteHistory.length} attività trovate
                    </h3>
                    <Badge variant="outline">
                      Ordinamento: più recenti
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    {clienteHistory.map((log, index) => (
                      <div key={log.id || index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <div className={`w-2 h-2 rounded-full ${
                                log.action === 'created' ? 'bg-green-500' :
                                log.action === 'updated' ? 'bg-blue-500' :
                                log.action === 'status_changed' ? 'bg-orange-500' :
                                log.action === 'document_uploaded' ? 'bg-purple-500' :
                                log.action === 'document_deleted' ? 'bg-red-500' :
                                'bg-gray-500'
                              }`} />
                              <span className="font-medium text-gray-900">
                                {log.action === 'created' ? '📋 Creazione' :
                                 log.action === 'updated' ? '✏️ Modifica' :
                                 log.action === 'status_changed' ? '🔄 Cambio Status' :
                                 log.action === 'document_uploaded' ? '📄 Upload Documento' :
                                 log.action === 'document_deleted' ? '🗑️ Eliminazione Documento' :
                                 '🔍 Attività'}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {log.user_role}
                              </Badge>
                            </div>
                            
                            <p className="text-gray-700 mb-2">
                              {log.description}
                            </p>
                            
                            {((log.details && (log.details.old_value || log.details.new_value)) || log.old_value || log.new_value) && (
                              <div className="text-sm text-gray-500 bg-gray-100 rounded p-2">
                                {(log.details?.old_value || log.old_value) && (
                                  <div>
                                    <span className="font-medium">Prima:</span> {log.details?.old_value_display || log.old_value}
                                  </div>
                                )}
                                {(log.details?.new_value || log.new_value) && (
                                  <div>
                                    <span className="font-medium">Dopo:</span> {log.details?.new_value_display || log.new_value}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <details className="mt-2 text-xs text-gray-500">
                                <summary className="cursor-pointer hover:text-gray-700">
                                  Dettagli tecnici
                                </summary>
                                <pre className="mt-1 bg-gray-100 p-2 rounded text-xs overflow-x-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                          
                          <div className="text-right text-sm text-gray-500">
                            <div className="font-medium">
                              {log.user_name}
                            </div>
                            <div>
                              {log.timestamp_display || new Date(log.timestamp).toLocaleString('it-IT')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Modal Components

export { ClientiManagement };
