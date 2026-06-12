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

const LeadsManagement = ({ selectedUnit, units }) => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false); // NEW: For manual refresh animation
  const [autoRefresh, setAutoRefresh] = useState(true); // NEW: Auto-refresh toggle
  const [lastUpdated, setLastUpdated] = useState(null); // NEW: Last refresh timestamp
  const [selectedLead, setSelectedLead] = useState(null);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [leadEditData, setLeadEditData] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [leadStatuses, setLeadStatuses] = useState([]); // NEW: Dynamic statuses (filtered by unit)
  const [allLeadStatusColors, setAllLeadStatusColors] = useState({}); // Map: nome -> colore (tutti gli stati)
  const [selectedLeadStatuses, setSelectedLeadStatuses] = useState([]); // Status per il lead selezionato (basato sulla sua unit)
  const [users, setUsers] = useState([]); // NEW: Users for agent names
  const [showFilters, setShowFilters] = useState(false); // Mobile: filters collapsed
  const [leadHistory, setLeadHistory] = useState([]); // NEW: Lead change history (admin only)
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showLeadHistoryModal, setShowLeadHistoryModal] = useState(false); // Modal storico lead
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 50;
  
  const [filters, setFilters] = useState({
    unit_id: "", // NEW: Unit filter
    campagna: "",
    provincia: "",
    status: "", // NEW: Status filter
    date_from: "",
    date_to: "",
    assigned_agent_id: "", // NEW: Agent filter
    search: "", // NEW: Search by name/phone
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 when filters change
    fetchLeads(false, 1);
    fetchCustomFields();
    fetchLeadStatuses(); // NEW: Fetch dynamic statuses
    fetchAllLeadStatusColors(); // Fetch ALL status colors for badge rendering
    fetchUsers(); // NEW: Fetch users for agent names
    // Carica cache tag (label + colore) per render rapido dei chip nella colonna Tag
    axios.get(`${API}/lead-tags`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(r => {
        const cache = {};
        (r.data || []).forEach(t => { cache[t.name] = { label: t.label || t.name, color: t.color || "#64748b" }; });
        window.__leadTagsCache = cache;
      })
      .catch(() => { window.__leadTagsCache = {}; });
  }, [selectedUnit, filters]);

  // Auto-refresh leads every 30 seconds to show new leads from Zapier
  useEffect(() => {
    if (!autoRefresh) return; // Only auto-refresh if enabled

    const intervalId = setInterval(() => {
      fetchLeads(true, currentPage); // true indica che è un refresh automatico
    }, 30000); // 30 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [selectedUnit, filters, autoRefresh, currentPage]); // Re-create interval when filters or autoRefresh change

  const fetchLeads = async (isAutoRefresh = false, page = currentPage) => {
    try {
      if (!isAutoRefresh) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      
      // Add pagination parameters
      params.append('page', page);
      params.append('page_size', pageSize);
      
      const response = await axios.get(`${API}/leads?${params}`);
      
      // Handle paginated response
      setLeads(response.data.leads || []);
      setTotalLeads(response.data.total || 0);
      setTotalPages(response.data.total_pages || 1);
      setCurrentPage(response.data.page || 1);
      
      setLastUpdated(new Date()); // Update timestamp after successful fetch
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei lead",
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
      fetchLeads(false, newPage);
    }
  };

  const handleManualRefresh = () => {
    fetchLeads(false, currentPage); // Manual refresh
  };

  const fetchCustomFields = async () => {
    try {
      const response = await axios.get(`${API}/custom-fields`);
      setCustomFields(response.data);
    } catch (error) {
      console.error("Error fetching custom fields:", error);
    }
  };

  // NEW: Fetch dynamic lead statuses
  const fetchLeadStatuses = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      params.append('include_used', 'true'); // Include anche esiti usati nei lead ma non configurati
      const response = await axios.get(`${API}/lead-status?${params}`);
      setLeadStatuses(response.data);
    } catch (error) {
      console.error("Error fetching lead statuses:", error);
    }
  };

  // Fetch ALL lead status colors (for badge rendering regardless of selected unit)
  const fetchAllLeadStatusColors = async () => {
    try {
      const response = await axios.get(`${API}/lead-status?show_all=true&include_used=true`);
      const colorMap = {};
      response.data.forEach(status => {
        // Use the first color found for each status name
        if (!colorMap[status.nome] && status.colore) {
          colorMap[status.nome] = status.colore;
        }
      });
      setAllLeadStatusColors(colorMap);
    } catch (error) {
      console.error("Error fetching all lead status colors:", error);
    }
  };

  // NEW: Fetch users for agent names
  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  // NEW: Get agent name from ID
  const getAgentName = (agentId) => {
    if (!agentId) return "Non assegnato";
    const agent = users.find(u => u.id === agentId);
    return agent ? agent.username : "Agente sconosciuto";
  };

  // NEW: Open lead detail with agent name
  const openLeadDetail = async (lead) => {
    const leadWithAgentName = {
      ...lead,
      assigned_agent_name: getAgentName(lead.assigned_agent_id)
    };
    setSelectedLead(leadWithAgentName);
    setLeadHistory([]); // Clear previous history
    
    // Carica gli status specifici per la unit del lead
    try {
      const params = new URLSearchParams();
      if (lead.unit_id) {
        params.append('unit_id', lead.unit_id);
      }
      const response = await axios.get(`${API}/lead-status?${params}`);
      setSelectedLeadStatuses(response.data);
    } catch (error) {
      console.error("Error fetching lead-specific statuses:", error);
      // Fallback agli status generici
      setSelectedLeadStatuses(leadStatuses);
    }
    
    setLeadEditData({
      // Campi che possono essere vuoti da Zapier e quindi modificabili
      nome: lead.nome || "",
      cognome: lead.cognome || "",
      telefono: lead.telefono || "",
      email: lead.email || "",
      provincia: lead.provincia || "",
      campagna: lead.campagna || "",
      // Altri campi editabili
      tipologia_abitazione: lead.tipologia_abitazione || "",
      indirizzo: lead.indirizzo || "",
      regione: lead.regione || "",
      url: lead.url || "",
      otp: lead.otp || "",
      inserzione: lead.inserzione || "",
      privacy_consent: lead.privacy_consent || false,
      marketing_consent: lead.marketing_consent || false,
      esito: lead.esito || "Nuovo",  // Default to "Nuovo" if empty
      note: lead.note || "",
      assigned_agent_id: lead.assigned_agent_id || "",  // For Admin reassignment
      custom_fields: lead.custom_fields || {}  // Campi personalizzati
    });
    setIsEditingLead(false);
  };

  // Fetch lead history (Admin only)
  const fetchLeadHistory = async (leadId) => {
    if (user.role !== "admin") return;
    
    setLoadingHistory(true);
    try {
      const response = await axios.get(`${API}/leads/${leadId}/history`);
      setLeadHistory(response.data.history || []);
    } catch (error) {
      console.error("Error fetching lead history:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare lo storico del lead",
        variant: "destructive"
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  // NEW: Save lead edits
  const handleSaveLead = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API}/leads/${selectedLead.id}`, leadEditData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      toast({
        title: "Successo",
        description: "Lead aggiornato con successo",
      });
      setIsEditingLead(false);
      fetchLeads(); // Refresh list
      setSelectedLead(null);
    } catch (error) {
      console.error("Error updating lead:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'aggiornamento del lead",
        variant: "destructive",
      });
    }
  };

  const updateLead = async (leadId, esito, note, customFields, status) => { // NEW: Added status parameter
    try {
      const updateData = { esito, note, custom_fields: customFields };
      if (status) updateData.status = status; // NEW: Include status if provided
      
      await axios.put(`${API}/leads/${leadId}`, updateData);
      toast({
        title: "Successo",
        description: "Lead aggiornato con successo",
      });
      fetchLeads();
      setSelectedLead(null);
    } catch (error) {
      console.error("Error updating lead:", error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento del lead",
        variant: "destructive",
      });
    }
  };

  const deleteLead = async (leadId, leadName) => {
    if (!window.confirm(`Sei sicuro di voler eliminare il lead "${leadName}"?\n\nQuesta azione non può essere annullata e eliminerà tutti i dati associati al lead.`)) {
      return;
    }

    try {
      await axios.delete(`${API}/leads/${leadId}`);
      toast({
        title: "Successo",
        description: "Lead eliminato con successo",
      });
      fetchLeads();
      // Close modal if the deleted lead was selected
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(null);
      }
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'eliminazione del lead",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (esito) => {
    // If no esito, default to "Nuovo"
    const statusName = esito || "Nuovo";
    
    // First try to get color from allLeadStatusColors (includes all statuses)
    let statusColor = allLeadStatusColors[statusName];
    
    // If not found in global colors, try from current leadStatuses
    if (!statusColor) {
      const statusConfig = leadStatuses.find(status => status.nome === statusName);
      statusColor = statusConfig?.colore;
    }
    
    if (statusColor) {
      // Use the configured color
      return (
        <Badge 
          style={{ 
            backgroundColor: statusColor,
            color: '#fff',
            border: 'none'
          }}
        >
          {statusName}
        </Badge>
      );
    }
    
    // Fallback to default gray if no color configured
    return (
      <Badge className="bg-gray-100 text-gray-800 border-0">
        {statusName}
      </Badge>
    );
  };

  const exportToExcel = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      
      const response = await axios.get(`${API}/leads/export?${params}`, {
        responseType: 'blob'
      });
      
      // Create blob URL and trigger download
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `leads_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Successo",
        description: "Export Excel completato",
      });
    } catch (error) {
      console.error("Error exporting leads:", error);
      toast({
        title: "Errore",
        description: "Errore nell'export dei lead",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col space-y-3 md:space-y-0 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl md:text-3xl font-bold text-slate-800">Gestione Lead</h2>
        
        {/* Mobile: Compact controls */}
        <div className="flex flex-col space-y-2">
          {/* Status row */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {lastUpdated && (
              <span className="text-gray-500">
                Agg: {lastUpdated.toLocaleTimeString('it-IT')}
              </span>
            )}
            {isRefreshing && (
              <span className="text-blue-600 animate-pulse">Aggiornando...</span>
            )}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="auto-refresh-leads"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="auto-refresh-leads" className="text-sm text-gray-700">
                Auto (30s)
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
              <span className="hidden sm:inline">Aggiorna</span>
            </Button>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportToExcel} size="sm" className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none">
              <Download className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Esporta Excel</span>
              <span className="sm:hidden">Esporta</span>
            </Button>
            <Button onClick={() => setShowCreateModal(true)} size="sm" className="flex-1 sm:flex-none">
              <Plus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Nuovo Lead</span>
              <span className="sm:hidden">Nuovo</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Filters - Collapsible on Mobile */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b p-3 md:p-6">
          <div className="flex items-center justify-between">
            <button 
              className="flex items-center gap-2 md:cursor-default"
              onClick={() => setShowFilters(!showFilters)}
            >
              <div className="p-1.5 md:p-2 bg-blue-100 rounded-lg">
                <Search className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              </div>
              <CardTitle className="text-base md:text-xl font-bold text-slate-800">Filtri</CardTitle>
              <ChevronDown className={`w-5 h-5 text-gray-600 md:hidden transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilters({
                unit_id: "",
                campagna: "",
                provincia: "",
                status: "",
                date_from: "",
                date_to: "",
                assigned_agent_id: "",
                search: "",
              })}
              className="text-slate-600 hover:text-slate-900"
            >
              <X className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Azzera</span>
            </Button>
          </div>
        </CardHeader>
        
        {/* Mobile: Show only search by default, expand for more filters */}
        <CardContent className="p-3 md:p-6">
          {/* Search Bar - Always visible */}
          <div className="mb-4 md:mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 md:w-5 md:h-5" />
              <Input
                placeholder="Cerca per nome, telefono..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10 pr-4 h-10 md:h-12 text-sm md:text-base border-2 border-slate-200 focus:border-blue-400 rounded-xl shadow-sm"
              />
              {filters.search && (
                <button
                  onClick={() => setFilters({ ...filters, search: "" })}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Advanced Filters - Hidden on mobile unless expanded, scrollable */}
          <div className={`${showFilters ? 'block max-h-[40vh] overflow-y-auto' : 'hidden'} md:block md:max-h-none md:overflow-visible`}>
            {/* Divider */}
            <div className="border-t border-slate-200 mb-3 md:mb-6"></div>
          
            {/* Filter Grid - 2 columns on mobile */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
            {/* Unit Filter - Solo per Admin */}
            {user?.role === "admin" && (
              <div className="space-y-1">
                <Label className="text-xs md:text-sm font-medium text-slate-700 flex items-center gap-1">
                  <Building2 className="w-3 h-3 md:w-4 md:h-4 text-purple-500" />
                  Unit
                </Label>
                <Select
                  value={filters.unit_id || "all"}
                  onValueChange={(value) => setFilters({ ...filters, unit_id: value === "all" ? "" : value })}
                >
                  <SelectTrigger className="h-9 text-sm border-slate-200 focus:border-blue-400 rounded-lg">
                    <SelectValue placeholder="Tutte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le Unit</SelectItem>
                    {units && units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Campagna */}
            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-slate-700 flex items-center gap-1">
                <FolderOpen className="w-3 h-3 md:w-4 md:h-4 text-amber-500" />
                Campagna
              </Label>
              <Select
                value={filters.campagna || "all"}
                onValueChange={(value) => setFilters({ ...filters, campagna: value === "all" ? "" : value })}
              >
                <SelectTrigger className="h-9 text-sm border-slate-200 focus:border-blue-400 rounded-lg">
                  <SelectValue placeholder="Tutte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le campagne</SelectItem>
                  {[...new Set(leads.map(l => l.campagna).filter(c => c && c.trim()))].sort().map((campagna) => (
                    <SelectItem key={campagna} value={campagna}>
                      {campagna}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Provincia */}
            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-slate-700 flex items-center gap-1">
                <MapPin className="w-3 h-3 md:w-4 md:h-4 text-green-500" />
                Provincia
              </Label>
              <div className="relative">
                <Input
                  placeholder="Provincia..."
                  value={filters.provincia}
                  onChange={(e) => setFilters({ ...filters, provincia: e.target.value })}
                  className="h-9 text-sm pl-3 border-slate-200 focus:border-blue-400 rounded-lg"
                />
                {filters.provincia && (
                  <button
                    onClick={() => setFilters({ ...filters, provincia: "" })}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-slate-700 flex items-center gap-1">
                <BarChart3 className="w-3 h-3 md:w-4 md:h-4 text-purple-500" />
                Stato
              </Label>
              <div className="relative">
                <select
                  className="w-full h-9 border border-slate-200 rounded-lg px-2 pl-8 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white appearance-none"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <option value="">Tutti</option>
                  {leadStatuses.map((status) => (
                    <option key={status.id} value={status.nome}>
                      {status.nome}
                    </option>
                  ))}
                </select>
                {/* Color indicator */}
                <div 
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-slate-300"
                  style={{ 
                    backgroundColor: filters.status 
                      ? (leadStatuses.find(s => s.nome === filters.status)?.colore || '#6b7280')
                      : '#e5e7eb'
                  }}
                />
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Agente */}
            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-slate-700 flex items-center gap-1">
                <Users className="w-3 h-3 md:w-4 md:h-4 text-blue-500" />
                Agente
              </Label>
              <select
                className="w-full h-9 border border-slate-200 rounded-lg px-2 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white"
                value={filters.assigned_agent_id}
                onChange={(e) => setFilters({ ...filters, assigned_agent_id: e.target.value })}
              >
                <option value="">Tutti</option>
                <option value="unassigned">Non assegnati</option>
                {users.filter(u => u.role === "agente").map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.username}
                  </option>
                ))}
              </select>
            </div>

            {/* Da Data */}
            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-slate-700 flex items-center gap-1">
                <Calendar className="w-3 h-3 md:w-4 md:h-4 text-teal-500" />
                Da
              </Label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                className="h-9 text-sm border-slate-200 focus:border-blue-400 rounded-lg"
              />
            </div>

            {/* A Data */}
            <div className="space-y-1">
              <Label className="text-xs md:text-sm font-medium text-slate-700 flex items-center gap-1">
                <Calendar className="w-3 h-3 md:w-4 md:h-4 text-teal-500" />
                A
              </Label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                className="h-9 text-sm border-slate-200 focus:border-blue-400 rounded-lg"
              />
            </div>
          </div>

          {/* Active Filters Summary */}
          {(filters.search || filters.campagna || filters.provincia || filters.status || filters.assigned_agent_id || filters.date_from || filters.date_to) && (
            <div className="mt-4 md:mt-6 p-3 md:p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Attivi:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {filters.search && (
                      <span className="px-2 py-1 bg-white border border-blue-300 rounded-md text-xs text-blue-700">
                        🔍 "{filters.search}"
                      </span>
                    )}
                    {filters.campagna && (
                      <span className="px-2 py-1 bg-white border border-blue-300 rounded-md text-xs text-blue-700">
                        📁 {filters.campagna}
                      </span>
                    )}
                    {filters.provincia && (
                      <span className="px-2 py-1 bg-white border border-blue-300 rounded-md text-xs text-blue-700">
                        📍 {filters.provincia}
                      </span>
                    )}
                    {filters.status && (
                      <span className="px-2 py-1 bg-white border border-blue-300 rounded-md text-xs text-blue-700">
                        📊 {filters.status}
                      </span>
                    )}
                    {filters.unit_id && (
                      <span className="px-2 py-1 bg-white border border-purple-300 rounded-md text-xs text-purple-700">
                        🏢 {units?.find(u => u.id === filters.unit_id)?.nome || filters.unit_id}
                      </span>
                    )}
                    {filters.assigned_agent_id && (
                      <span className="px-2 py-1 bg-white border border-blue-300 rounded-md text-xs text-blue-700">
                        👤 {filters.assigned_agent_id === "unassigned" ? "Non assegnati" : users.find(u => u.id === filters.assigned_agent_id)?.username}
                      </span>
                    )}
                    {filters.date_from && (
                      <span className="px-2 py-1 bg-white border border-blue-300 rounded-md text-xs text-blue-700">
                        📅 Da: {filters.date_from}
                      </span>
                    )}
                    {filters.date_to && (
                      <span className="px-2 py-1 bg-white border border-blue-300 rounded-md text-xs text-blue-700">
                        📅 A: {filters.date_to}
                      </span>
                    )}
                  </div>
              </div>
            </div>
          )}
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">Caricamento...</div>
          ) : (
            <div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID Lead</TableHead>
                      <TableHead>Nome</TableHead>
                      {/* Colonna Unit - Solo per Admin */}
                      {user?.role === "admin" && (
                        <TableHead>Unit</TableHead>
                      )}
                      <TableHead>Provincia</TableHead>
                      <TableHead>Campagna</TableHead>
                      {/* Colonna Assegnato a - Per Admin, Referente, Supervisor e Super Referente */}
                      {(user?.role === "admin" || user?.role === "referente" || user?.role === "supervisor" || user?.role === "super_referente") && (
                        <TableHead>Assegnato a</TableHead>
                      )}
                      <TableHead>Stato</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-mono text-sm">
                          {lead.lead_id || lead.id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {lead.nome} {lead.cognome}
                        </TableCell>
                        {/* Cella Unit - Solo per Admin */}
                        {user?.role === "admin" && (
                          <TableCell>
                            <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-medium">
                              {lead.unit_nome || "N/A"}
                            </span>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{lead.provincia}</span> 
                          </div>
                        </TableCell>
                        <TableCell>{lead.campagna}</TableCell>
                        {/* Cella Assegnato a - Per Admin, Referente, Supervisor e Super Referente */}
                        {(user?.role === "admin" || user?.role === "referente" || user?.role === "supervisor" || user?.role === "super_referente") && (
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <Users className="w-3 h-3 text-slate-400" />
                              <span className={lead.assigned_agent_id ? "text-green-700 text-sm" : "text-slate-500 text-sm"}>
                                {getAgentName(lead.assigned_agent_id)}
                              </span>
                            </div>
                          </TableCell>
                        )}
                        <TableCell>{getStatusBadge(lead.esito)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[180px]" data-testid={`lead-tags-${lead.id}`}>
                            {(lead.tags || []).slice(0, 3).map((t) => {
                              const meta = (window.__leadTagsCache || {})[t] || { color: "#64748b", label: t };
                              return (
                                <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-medium border" style={{ background: `${meta.color}1a`, borderColor: meta.color, color: meta.color }}>
                                  {meta.label || t}
                                </span>
                              );
                            })}
                            {(lead.tags || []).length > 3 && (
                              <span className="text-[10px] text-slate-500">+{lead.tags.length - 3}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{new Date(lead.created_at).toLocaleDateString("it-IT")}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            <Button
                              onClick={() => openLeadDetail(lead)}
                              variant="ghost"
                              size="sm"
                              title="Visualizza dettagli"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {user.role === "admin" && (
                              <Button
                                onClick={() => deleteLead(lead.id, `${lead.nome} ${lead.cognome}`)}
                                variant="destructive"
                                size="sm"
                                title="Elimina lead"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View - Scrollable */}
              <div className="md:hidden max-h-[60vh] overflow-y-auto">
                {leads.map((lead) => (
                  <div key={lead.id} className="border-b border-slate-200 p-4 last:border-b-0">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Users className="w-4 h-4 text-blue-600" />
                          <h3 className="font-semibold text-slate-900">
                            {lead.nome} {lead.cognome}
                          </h3>
                        </div>
                        <p className="text-sm text-slate-500 font-mono">
                          ID: {lead.lead_id || lead.id.slice(0, 8)}
                        </p>
                      </div>
                      {getStatusBadge(lead.esito)}
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2 mb-3 text-sm">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-600">{lead.provincia}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Tag className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-600">{lead.campagna}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-600">
                          {new Date(lead.created_at).toLocaleDateString("it-IT")}
                        </span>
                      </div>
                      {/* Assegnato a - Per Admin, Referente, Supervisor e Super Referente */}
                      {(user?.role === "admin" || user?.role === "referente" || user?.role === "supervisor" || user?.role === "super_referente") && (
                        <div className="flex items-center space-x-2">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span className={lead.assigned_agent_id ? "text-green-700 font-medium" : "text-slate-500"}>
                            {getAgentName(lead.assigned_agent_id)}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 mt-3">
                      <Button
                        onClick={() => openLeadDetail(lead)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Vedi
                      </Button>
                      {user.role === "admin" && (
                        <Button
                          onClick={() => deleteLead(lead.id, `${lead.nome} ${lead.cognome}`)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 md:p-4 bg-white rounded-lg shadow border">
          {/* Info text */}
          <div className="text-sm text-slate-600 text-center sm:text-left">
            <span className="hidden sm:inline">Mostrando </span>{leads.length} di {totalLeads} 
            <span className="hidden sm:inline"> lead</span>
            <span className="mx-1">•</span>
            Pag. {currentPage}/{totalPages}
          </div>
          
          {/* Pagination buttons */}
          <div className="flex items-center justify-center gap-1">
            {/* First/Prev */}
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
            
            {/* Page numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
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

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Dettaglio Lead: {selectedLead.nome} {selectedLead.cognome}</CardTitle>
              <div className="flex space-x-2">
                {!isEditingLead && (
                  <Button onClick={() => setIsEditingLead(true)} variant="outline" size="sm">
                    <Edit className="w-4 h-4 mr-2" />
                    Modifica
                  </Button>
                )}
                <Button onClick={() => { setSelectedLead(null); setIsEditingLead(false); }} variant="ghost" size="sm">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sezione Dati Principali - Bloccati se arrivano da Zapier */}
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Dati Anagrafici</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Nome */}
                  <div>
                    <Label htmlFor="nome" className="flex items-center">
                      Nome
                      {selectedLead.nome && <Lock className="w-3 h-3 ml-1 text-slate-400" title="Campo bloccato: dato da Zapier" />}
                    </Label>
                    {selectedLead.nome ? (
                      <div className="p-2 bg-slate-50 rounded text-sm">{selectedLead.nome}</div>
                    ) : isEditingLead ? (
                      <Input
                        id="nome"
                        value={leadEditData.nome || ""}
                        onChange={(e) => setLeadEditData({...leadEditData, nome: e.target.value})}
                        placeholder="Inserisci nome"
                      />
                    ) : (
                      <p className="text-sm text-slate-400 italic">Non disponibile</p>
                    )}
                  </div>

                  {/* Cognome */}
                  <div>
                    <Label htmlFor="cognome" className="flex items-center">
                      Cognome
                      {selectedLead.cognome && <Lock className="w-3 h-3 ml-1 text-slate-400" title="Campo bloccato: dato da Zapier" />}
                    </Label>
                    {selectedLead.cognome ? (
                      <div className="p-2 bg-slate-50 rounded text-sm">{selectedLead.cognome}</div>
                    ) : isEditingLead ? (
                      <Input
                        id="cognome"
                        value={leadEditData.cognome || ""}
                        onChange={(e) => setLeadEditData({...leadEditData, cognome: e.target.value})}
                        placeholder="Inserisci cognome"
                      />
                    ) : (
                      <p className="text-sm text-slate-400 italic">Non disponibile</p>
                    )}
                  </div>

                  {/* Telefono */}
                  <div>
                    <Label htmlFor="telefono" className="flex items-center">
                      Telefono
                      {selectedLead.telefono && <Lock className="w-3 h-3 ml-1 text-slate-400" title="Campo bloccato: dato da Zapier" />}
                    </Label>
                    {selectedLead.telefono ? (
                      <div className="p-2 bg-slate-50 rounded text-sm">{selectedLead.telefono}</div>
                    ) : isEditingLead ? (
                      <Input
                        id="telefono"
                        value={leadEditData.telefono || ""}
                        onChange={(e) => setLeadEditData({...leadEditData, telefono: e.target.value})}
                        placeholder="Inserisci telefono"
                      />
                    ) : (
                      <p className="text-sm text-slate-400 italic">Non disponibile</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <Label htmlFor="email" className="flex items-center">
                      Email
                      {selectedLead.email && <Lock className="w-3 h-3 ml-1 text-slate-400" title="Campo bloccato: dato da Zapier" />}
                    </Label>
                    {selectedLead.email ? (
                      <div className="p-2 bg-slate-50 rounded text-sm">{selectedLead.email}</div>
                    ) : isEditingLead ? (
                      <Input
                        id="email"
                        value={leadEditData.email || ""}
                        onChange={(e) => setLeadEditData({...leadEditData, email: e.target.value})}
                        placeholder="Inserisci email"
                      />
                    ) : (
                      <p className="text-sm text-slate-400 italic">Non disponibile</p>
                    )}
                  </div>

                  {/* Provincia */}
                  <div>
                    <Label htmlFor="provincia" className="flex items-center">
                      Provincia
                      {selectedLead.provincia && <Lock className="w-3 h-3 ml-1 text-slate-400" title="Campo bloccato: dato da Zapier" />}
                    </Label>
                    {selectedLead.provincia ? (
                      <div className="p-2 bg-slate-50 rounded text-sm">{selectedLead.provincia}</div>
                    ) : isEditingLead ? (
                      <Input
                        id="provincia"
                        value={leadEditData.provincia || ""}
                        onChange={(e) => setLeadEditData({...leadEditData, provincia: e.target.value})}
                        placeholder="Inserisci provincia"
                      />
                    ) : (
                      <p className="text-sm text-slate-400 italic">Non disponibile</p>
                    )}
                  </div>

                  {/* Campagna */}
                  <div>
                    <Label htmlFor="campagna" className="flex items-center">
                      Campagna
                      {selectedLead.campagna && <Lock className="w-3 h-3 ml-1 text-slate-400" title="Campo bloccato: dato da Zapier" />}
                    </Label>
                    {selectedLead.campagna ? (
                      <div className="p-2 bg-slate-50 rounded text-sm">{selectedLead.campagna}</div>
                    ) : isEditingLead ? (
                      <Input
                        id="campagna"
                        value={leadEditData.campagna || ""}
                        onChange={(e) => setLeadEditData({...leadEditData, campagna: e.target.value})}
                        placeholder="Inserisci campagna"
                      />
                    ) : (
                      <p className="text-sm text-slate-400 italic">Non disponibile</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Sezione Dati Modificabili */}
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Informazioni Aggiuntive</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tipologia">Tipologia Abitazione</Label>
                    {isEditingLead ? (
                      <Input
                        id="tipologia"
                        value={leadEditData.tipologia_abitazione}
                        onChange={(e) => setLeadEditData({...leadEditData, tipologia_abitazione: e.target.value})}
                        placeholder="Es: Appartamento, Villa, Casa indipendente..."
                      />
                    ) : (
                      <p className="text-sm">{selectedLead.tipologia_abitazione || "N/A"}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="indirizzo">Indirizzo</Label>
                    {isEditingLead ? (
                      <Input
                        id="indirizzo"
                        value={leadEditData.indirizzo}
                        onChange={(e) => setLeadEditData({...leadEditData, indirizzo: e.target.value})}
                      />
                    ) : (
                      <p className="text-sm">{selectedLead.indirizzo || "N/A"}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="regione">Regione</Label>
                    {isEditingLead ? (
                      <Input
                        id="regione"
                        value={leadEditData.regione}
                        onChange={(e) => setLeadEditData({...leadEditData, regione: e.target.value})}
                      />
                    ) : (
                      <p className="text-sm">{selectedLead.regione || "N/A"}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="url">URL Sorgente</Label>
                    {isEditingLead ? (
                      <Input
                        id="url"
                        value={leadEditData.url}
                        onChange={(e) => setLeadEditData({...leadEditData, url: e.target.value})}
                      />
                    ) : (
                      <p className="text-sm">{selectedLead.url || "N/A"}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="otp">OTP</Label>
                    {isEditingLead ? (
                      <Input
                        id="otp"
                        value={leadEditData.otp}
                        onChange={(e) => setLeadEditData({...leadEditData, otp: e.target.value})}
                      />
                    ) : (
                      <p className="text-sm">{selectedLead.otp || "N/A"}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="inserzione">Inserzione</Label>
                    {isEditingLead ? (
                      <Input
                        id="inserzione"
                        value={leadEditData.inserzione}
                        onChange={(e) => setLeadEditData({...leadEditData, inserzione: e.target.value})}
                      />
                    ) : (
                      <p className="text-sm">{selectedLead.inserzione || "N/A"}</p>
                    )}
                  </div>

                  {/* Campi Personalizzati - esclusi quelli già presenti come campi standard */}
                  {customFields && customFields.filter(field => 
                    !['tipologia abitazione', 'tipologia_abitazione'].includes(field.name.toLowerCase())
                  ).map((field) => {
                    const fieldValue = selectedLead.custom_fields?.[field.id] || "";
                    const hasValue = fieldValue !== "" && fieldValue !== null && fieldValue !== undefined;
                    
                    return (
                      <div key={field.id}>
                        <Label className="flex items-center">
                          {field.name}
                          {hasValue && <Lock className="w-3 h-3 ml-1 text-slate-400" title="Campo bloccato: dato da Zapier" />}
                        </Label>
                        {hasValue ? (
                          <div className="p-2 bg-slate-50 rounded text-sm">
                            {field.field_type === "boolean" 
                              ? (fieldValue === "true" || fieldValue === true ? "Sì" : "No")
                              : fieldValue}
                          </div>
                        ) : isEditingLead ? (
                          field.field_type === "select" ? (
                            <Select
                              value={leadEditData.custom_fields?.[field.id] || ""}
                              onValueChange={(value) => setLeadEditData({
                                ...leadEditData,
                                custom_fields: {
                                  ...leadEditData.custom_fields,
                                  [field.id]: value
                                }
                              })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={`Seleziona ${field.name}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {(field.options || []).map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.field_type === "boolean" ? (
                            <div className="flex items-center space-x-2 mt-1">
                              <Checkbox
                                checked={leadEditData.custom_fields?.[field.id] === "true" || leadEditData.custom_fields?.[field.id] === true}
                                onCheckedChange={(checked) => setLeadEditData({
                                  ...leadEditData,
                                  custom_fields: {
                                    ...leadEditData.custom_fields,
                                    [field.id]: checked.toString()
                                  }
                                })}
                              />
                              <span className="text-sm text-slate-600">Sì</span>
                            </div>
                          ) : field.field_type === "date" ? (
                            <Input
                              type="date"
                              value={leadEditData.custom_fields?.[field.id] || ""}
                              onChange={(e) => setLeadEditData({
                                ...leadEditData,
                                custom_fields: {
                                  ...leadEditData.custom_fields,
                                  [field.id]: e.target.value
                                }
                              })}
                            />
                          ) : field.field_type === "number" ? (
                            <Input
                              type="number"
                              value={leadEditData.custom_fields?.[field.id] || ""}
                              onChange={(e) => setLeadEditData({
                                ...leadEditData,
                                custom_fields: {
                                  ...leadEditData.custom_fields,
                                  [field.id]: e.target.value
                                }
                              })}
                              placeholder={`Inserisci ${field.name}`}
                            />
                          ) : (
                            <Input
                              value={leadEditData.custom_fields?.[field.id] || ""}
                              onChange={(e) => setLeadEditData({
                                ...leadEditData,
                                custom_fields: {
                                  ...leadEditData.custom_fields,
                                  [field.id]: e.target.value
                                }
                              })}
                              placeholder={`Inserisci ${field.name}`}
                            />
                          )
                        ) : (
                          <p className="text-sm text-slate-400 italic">Non disponibile</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Consensi Privacy - Bloccati se arrivano da Zapier */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {/* Privacy Consent */}
                  <div>
                    <Label className="flex items-center mb-2">
                      Consenso Privacy
                      {selectedLead.privacy_consent !== null && selectedLead.privacy_consent !== undefined && <Lock className="w-3 h-3 ml-1 text-slate-400" title="Campo bloccato: dato da Zapier" />}
                    </Label>
                    {selectedLead.privacy_consent !== null && selectedLead.privacy_consent !== undefined ? (
                      <div className="p-2 bg-slate-50 rounded text-sm flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedLead.privacy_consent}
                          disabled
                          className="w-4 h-4 mr-2"
                        />
                        {selectedLead.privacy_consent ? "Consenso dato" : "Consenso non dato"}
                      </div>
                    ) : isEditingLead ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="privacy_consent"
                          checked={leadEditData.privacy_consent || false}
                          onChange={(e) => setLeadEditData({...leadEditData, privacy_consent: e.target.checked})}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="privacy_consent" className="cursor-pointer">Consenso dato</Label>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Non disponibile</p>
                    )}
                  </div>

                  {/* Marketing Consent */}
                  <div>
                    <Label className="flex items-center mb-2">
                      Consenso Marketing
                      {selectedLead.marketing_consent !== null && selectedLead.marketing_consent !== undefined && <Lock className="w-3 h-3 ml-1 text-slate-400" title="Campo bloccato: dato da Zapier" />}
                    </Label>
                    {selectedLead.marketing_consent !== null && selectedLead.marketing_consent !== undefined ? (
                      <div className="p-2 bg-slate-50 rounded text-sm flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedLead.marketing_consent}
                          disabled
                          className="w-4 h-4 mr-2"
                        />
                        {selectedLead.marketing_consent ? "Consenso dato" : "Consenso non dato"}
                      </div>
                    ) : isEditingLead ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="marketing_consent"
                          checked={leadEditData.marketing_consent || false}
                          onChange={(e) => setLeadEditData({...leadEditData, marketing_consent: e.target.checked})}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="marketing_consent" className="cursor-pointer">Consenso dato</Label>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">Non disponibile</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Sezione Note e Stato */}
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-3">Lavorazione Lead</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="stato">Stato Lead</Label>
                    {isEditingLead ? (
                      <Select
                        value={leadEditData.esito}
                        onValueChange={(value) => setLeadEditData({...leadEditData, esito: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona stato" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedLeadStatuses.map(status => (
                            <SelectItem key={status.id} value={status.nome}>
                              <div className="flex items-center gap-2">
                                {status.colore && (
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{backgroundColor: status.colore}}
                                  />
                                )}
                                {status.nome}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-2">
                        {getStatusBadge(selectedLead.esito)}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="note">Note</Label>
                    {isEditingLead ? (
                      <textarea
                        id="note"
                        value={leadEditData.note}
                        onChange={(e) => setLeadEditData({...leadEditData, note: e.target.value})}
                        className="w-full p-2 border rounded-md"
                        rows="4"
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{selectedLead.note || "Nessuna nota"}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Assegnato a - Admin, Referente, Supervisor e Super Referente */}
              {(user?.role === "admin" || user?.role === "referente" || user?.role === "supervisor" || user?.role === "super_referente") && (
                <div>
                  <Label className="text-sm font-medium text-slate-600">Assegnato a</Label>
                  
                  {/* Admin and Supervisor can reassign leads, others can only view */}
                  {(user?.role === "admin" || user?.role === "supervisor") && isEditingLead ? (
                    <div>
                      <Select 
                        value={leadEditData.assigned_agent_id || "unassigned"}
                        onValueChange={(value) => {
                          const newValue = value === "unassigned" ? "" : value;
                          setLeadEditData({...leadEditData, assigned_agent_id: newValue});
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Seleziona agente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Non assegnato</SelectItem>
                          {(() => {
                            const availableAgents = users.filter(u => {
                              // Filter only agents (NOT referenti)
                              if (u.role !== "agente") return false;
                              
                              // Use provinciaMatches helper for flexible matching
                              return provinciaMatches(u.provinces, selectedLead.provincia);
                            });
                            
                            if (availableAgents.length === 0) {
                              return (
                                <SelectItem value="no-agents" disabled>
                                  Nessun agente disponibile per {selectedLead.provincia || "questa provincia"}
                                </SelectItem>
                              );
                            }
                            
                            return availableAgents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.username}
                              </SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                      {selectedLead.provincia && (
                        <p className="text-xs text-slate-500 mt-1">
                          📍 Mostrando solo agenti che coprono: <span className="font-medium">{selectedLead.provincia}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 mt-1">
                      <Users className="w-4 h-4 text-slate-400" />
                      <p className={selectedLead.assigned_agent_id ? "text-green-700 font-medium" : "text-slate-500"}>
                        {selectedLead.assigned_agent_name || "Non assegnato"}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="flex space-x-2">
                <Button onClick={() => { setSelectedLead(null); setIsEditingLead(false); }} variant="outline">
                  Chiudi
                </Button>
                {/* Storico Button - Solo Admin */}
                {user.role === "admin" && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowLeadHistoryModal(true);
                      fetchLeadHistory(selectedLead.id);
                    }}
                  >
                    <History className="w-4 h-4 mr-2" />
                    Storico
                  </Button>
                )}
              </div>
              {isEditingLead && (
                <div className="flex space-x-2">
                  <Button onClick={() => { setIsEditingLead(false); setLeadEditData({...selectedLead}); }} variant="outline">
                    Annulla
                  </Button>
                  <Button onClick={handleSaveLead}>
                    <Save className="w-4 h-4 mr-2" />
                    Salva Modifiche
                  </Button>
                </div>
              )}
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Lead History Modal - Admin Only */}
      {showLeadHistoryModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-semibold flex items-center">
                  <History className="w-5 h-5 mr-2 text-blue-600" />
                  Cronologia Lead
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedLead.nome} {selectedLead.cognome} - Tutte le modifiche
                </p>
              </div>
              <Button 
                variant="ghost" 
                onClick={() => {
                  setShowLeadHistoryModal(false);
                  setLeadHistory([]);
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
              ) : leadHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">
                    Nessuna modifica registrata
                  </h3>
                  <p className="text-gray-500">
                    Non ci sono ancora log di modifiche per questo lead
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-gray-900">
                      {leadHistory.length} modifiche trovate
                    </h3>
                    <Badge variant="outline">
                      Ordinamento: più recenti
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    {leadHistory.map((entry, index) => (
                      <div key={entry.id || index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              <span className="font-medium text-gray-900">
                                ✏️ Modifica
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {entry.username}
                              </Badge>
                            </div>
                            
                            <div className="space-y-2">
                              {Object.entries(entry.changes || {}).map(([field, change]) => (
                                <div key={field} className="text-sm text-gray-500 bg-gray-100 rounded p-2">
                                  <span className="font-medium text-gray-700">{field}</span>
                                  <div className="mt-1 flex flex-col sm:flex-row sm:items-center gap-1">
                                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">
                                      Prima: {change.old !== null && change.old !== undefined ? String(change.old).substring(0, 100) : 'vuoto'}
                                    </span>
                                    <span className="hidden sm:inline text-gray-400">→</span>
                                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">
                                      Dopo: {change.new !== null && change.new !== undefined ? String(change.new).substring(0, 100) : 'vuoto'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="text-right text-xs text-gray-500 ml-4">
                            <div>{new Date(entry.timestamp).toLocaleDateString('it-IT')}</div>
                            <div>{new Date(entry.timestamp).toLocaleTimeString('it-IT')}</div>
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

      {/* Create Lead Modal */}
      {showCreateModal && (
        <CreateLeadModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            fetchLeads();
            setShowCreateModal(false);
          }}
          units={units}
          customFields={customFields}
        />
      )}
    </div>
  );
};

// Enhanced Lead Detail Modal Component with Custom Fields


// ============================================================================
// UNITS MANAGEMENT COMPONENT - For managing lead units
// ============================================================================

const LeadDetailModal = ({ lead, onClose, onUpdate, customFields }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [esito, setEsito] = useState(lead.esito || "");
  const [note, setNote] = useState(lead.note || "");
  const [customFieldValues, setCustomFieldValues] = useState(lead.custom_fields || {});
  const [editableData, setEditableData] = useState({
    tipologia_abitazione: lead.tipologia_abitazione || "",
    indirizzo: lead.indirizzo || "",
    regione: lead.regione || "",
    url: lead.url || "",
    otp: lead.otp || "",
    inserzione: lead.inserzione || "",
    privacy_consent: lead.privacy_consent || false,
    marketing_consent: lead.marketing_consent || false,
  });

  const handleSave = () => {
    const updateData = {
      esito,
      note,
      custom_fields: customFieldValues,
      ...editableData
    };
    onUpdate(lead.id, updateData);
    setIsEditing(false);
  };

  const esitoOptions = [
    "FISSATO APPUNTAMENTO",
    "KO",
    "NR", 
    "RICHIAMARE",
    "CONTRATTUALIZATO"
  ];

  const renderCustomField = (field) => {
    const value = customFieldValues[field.id] || "";
    
    switch (field.field_type) {
      case "text":
        return (
          <Input
            value={value}
            onChange={(e) => setCustomFieldValues({
              ...customFieldValues,
              [field.id]: e.target.value
            })}
            placeholder={`Inserisci ${field.name}`}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => setCustomFieldValues({
              ...customFieldValues,
              [field.id]: e.target.value
            })}
            placeholder={`Inserisci ${field.name}`}
          />
        );
      case "date":
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => setCustomFieldValues({
              ...customFieldValues,
              [field.id]: e.target.value
            })}
          />
        );
      case "boolean":
        return (
          <Checkbox
            checked={value === "true"}
            onCheckedChange={(checked) => setCustomFieldValues({
              ...customFieldValues,
              [field.id]: checked.toString()
            })}
          />
        );
      case "select":
        return (
          <Select 
            value={value} 
            onValueChange={(newValue) => setCustomFieldValues({
              ...customFieldValues,
              [field.id]: newValue
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Seleziona ${field.name}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={!!lead} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Dettagli Lead #{lead.lead_id || lead.id.slice(0, 8)}</span>
          </DialogTitle>
          <DialogDescription>
            Visualizza e modifica le informazioni del lead
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="anagrafica" className="w-full">
          <TabsList>
            <TabsTrigger value="anagrafica" data-testid="lead-tab-anagrafica">Anagrafica</TabsTrigger>
            <TabsTrigger value="whatsapp" data-testid="lead-tab-whatsapp">
              <MessageCircle className="w-4 h-4 mr-1" /> Conversazione WhatsApp
            </TabsTrigger>
          </TabsList>
          <TabsContent value="whatsapp" className="mt-3">
            <LeadConversationsTab leadId={lead.id} />
          </TabsContent>
          <TabsContent value="anagrafica" className="mt-3">

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-600">Nome Completo</Label>
              <p className="text-lg font-semibold">{lead.nome} {lead.cognome}</p>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-slate-600">Telefono</Label>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-slate-400" />
                <p>{lead.telefono}</p>
              </div>
            </div>

            {lead.email && (
              <div>
                <Label className="text-sm font-medium text-slate-600">Email</Label>
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <p>{lead.email}</p>
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium text-slate-600">Provincia</Label>
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <p>{lead.provincia}</p>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-600">Tipologia Abitazione</Label>
              <p className="capitalize">{lead.tipologia_abitazione?.replace("_", " ")}</p>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-600">IP Address</Label>
              <p className="font-mono text-sm bg-slate-100 px-2 py-1 rounded">
                {lead.ip_address || "Non disponibile"}
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-600">Lead ID</Label>
              <p className="font-mono text-sm bg-blue-50 px-2 py-1 rounded text-blue-700">
                #{lead.lead_id || lead.id.slice(0, 8)}
              </p>
            </div>

            {/* Assegnato a - Per Admin, Referente, Supervisor e Super Referente */}
            {(user?.role === "admin" || user?.role === "referente" || user?.role === "supervisor" || user?.role === "super_referente") && (
              <div>
                <Label className="text-sm font-medium text-slate-600">Assegnato a</Label>
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <p className={lead.assigned_agent_id ? "text-green-700 font-medium" : "text-slate-500"}>
                    {lead.assigned_agent_name || "Non assegnato"}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-600">Privacy Consent</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                    lead.privacy_consent ? 'bg-green-500 border-green-500' : 'border-slate-300'
                  }`}>
                    {lead.privacy_consent && (
                      <CheckCircle className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span className="text-sm">{lead.privacy_consent ? 'Accettato' : 'Non accettato'}</span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Marketing Consent</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${
                    lead.marketing_consent ? 'bg-green-500 border-green-500' : 'border-slate-300'
                  }`}>
                    {lead.marketing_consent && (
                      <CheckCircle className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span className="text-sm">{lead.marketing_consent ? 'Accettato' : 'Non accettato'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-600">Campagna</Label>
              <p>{lead.campagna}</p>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-600">Data Creazione</Label>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <p>{new Date(lead.created_at).toLocaleString("it-IT")}</p>
              </div>
            </div>

            <div>
              <Label htmlFor="esito">Esito *</Label>
              <Select value={esito} onValueChange={setEsito}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona esito" />
                </SelectTrigger>
                <SelectContent>
                  {esitoOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                placeholder="Aggiungi note per questo lead..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
              />
            </div>

            {/* Custom Fields */}
            {customFields.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium text-slate-600">Campi Personalizzati</Label>
                {customFields.map((field) => (
                  <div key={field.id}>
                    <Label className="text-sm">{field.name}</Label>
                    {renderCustomField(field)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            Salva Modifiche
          </Button>
        </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// Create Lead Modal Component

const CreateLeadModal = ({ onClose, onSuccess, units, customFields }) => {
  const [formData, setFormData] = useState({
    nome: "",
    cognome: "",
    telefono: "",
    email: "",
    provincia: "",
    campagna: "",
    gruppo: "",
    privacy_consent: false,
    marketing_consent: false,
    custom_fields: {}
  });
  const [containers, setContainers] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [servizi, setServizi] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchProvinces();
    fetchContainers();
  }, []);

  const fetchProvinces = async () => {
    try {
      const response = await axios.get(`${API}/provinces`);
      setProvinces(response.data.provinces);
    } catch (error) {
      console.error("Error fetching provinces:", error);
    }
  };

  const fetchContainers = async () => {
    try {
      const response = await axios.get(`${API}/containers`);
      setContainers(response.data);
    } catch (error) {
      console.error("Error fetching containers:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await axios.post(`${API}/leads`, formData);
      toast({
        title: "Successo",
        description: "Lead creato con successo",
      });
      onSuccess();
    } catch (error) {
      console.error("Error creating lead:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nella creazione del lead",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderCustomField = (field) => {
    const value = formData.custom_fields[field.id] || "";
    
    switch (field.field_type) {
      case "text":
        return (
          <Input
            value={value}
            onChange={(e) => setFormData({
              ...formData,
              custom_fields: {
                ...formData.custom_fields,
                [field.id]: e.target.value
              }
            })}
            placeholder={`Inserisci ${field.name}`}
            required={field.required}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => setFormData({
              ...formData,
              custom_fields: {
                ...formData.custom_fields,
                [field.id]: e.target.value
              }
            })}
            placeholder={`Inserisci ${field.name}`}
            required={field.required}
          />
        );
      case "date":
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => setFormData({
              ...formData,
              custom_fields: {
                ...formData.custom_fields,
                [field.id]: e.target.value
              }
            })}
            required={field.required}
          />
        );
      case "boolean":
        return (
          <Checkbox
            checked={value === "true"}
            onCheckedChange={(checked) => setFormData({
              ...formData,
              custom_fields: {
                ...formData.custom_fields,
                [field.id]: checked.toString()
              }
            })}
          />
        );
      case "select":
        return (
          <Select 
            value={value} 
            onValueChange={(newValue) => setFormData({
              ...formData,
              custom_fields: {
                ...formData.custom_fields,
                [field.id]: newValue
              }
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Seleziona ${field.name}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crea Nuovo Lead</DialogTitle>
          <DialogDescription>
            Inserisci tutte le informazioni del nuovo lead
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cognome">Cognome *</Label>
                  <Input
                    id="cognome"
                    value={formData.cognome}
                    onChange={(e) => setFormData({ ...formData, cognome: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="telefono">Telefono *</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="provincia">Provincia *</Label>
                  <Select value={formData.provincia} onValueChange={(value) => setFormData({ ...formData, provincia: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona provincia" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map((provincia) => (
                        <SelectItem key={provincia} value={provincia}>
                          {provincia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Rimuovo il campo IP dalla creazione manuale */}
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="campagna">Campagna *</Label>
                <Input
                  id="campagna"
                  value={formData.campagna}
                  onChange={(e) => setFormData({ ...formData, campagna: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="gruppo">Unit *</Label>
                <Select value={formData.gruppo} onValueChange={(value) => setFormData({ ...formData, gruppo: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.nome || unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="privacy_consent"
                    checked={formData.privacy_consent}
                    onCheckedChange={(checked) => setFormData({ ...formData, privacy_consent: checked })}
                  />
                  <Label htmlFor="privacy_consent">Consenso Privacy</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="marketing_consent"
                    checked={formData.marketing_consent}
                    onCheckedChange={(checked) => setFormData({ ...formData, marketing_consent: checked })}
                  />
                  <Label htmlFor="marketing_consent">Consenso Marketing</Label>
                </div>
              </div>

              {/* Custom Fields */}
              {customFields.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-slate-600">Campi Personalizzati</Label>
                  {customFields.map((field) => (
                    <div key={field.id}>
                      <Label className="text-sm">
                        {field.name} {field.required && "*"}
                      </Label>
                      {renderCustomField(field)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creazione..." : "Crea Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Enhanced Users Management Component with Edit/Delete

export { LeadsManagement, LeadDetailModal, CreateLeadModal };
