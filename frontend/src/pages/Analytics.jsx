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


// ===================================================================
// Componenti estratti da App.js (refactoring giugno 2026)
// ===================================================================

const ResponsabileCommessaAnalytics = ({ selectedUnit, selectedTipologiaContratto, units, commesse }) => {
  const [analyticsData, setAnalyticsData] = useState({
    sub_agenzie_analytics: [],
    conversioni: {}
  });
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedCommessa, setSelectedCommessa] = useState('all');
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateFrom, dateTo, selectedCommessa, selectedTipologiaContratto]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (selectedCommessa && selectedCommessa !== 'all') {
        params.append('commessa_id', selectedCommessa);
      }
      if (selectedTipologiaContratto && selectedTipologiaContratto !== 'all') {
        params.append('tipologia_contratto', selectedTipologiaContratto);
      }
      
      const response = await axios.get(`${API}/responsabile-commessa/analytics?${params}`);
      setAnalyticsData(response.data);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (selectedCommessa && selectedCommessa !== 'all') {
        params.append('commessa_id', selectedCommessa);
      }
      if (selectedTipologiaContratto && selectedTipologiaContratto !== 'all') {
        params.append('tipologia_contratto', selectedTipologiaContratto);
      }

      const response = await axios.get(`${API}/responsabile-commessa/analytics/export?${params}`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics_responsabile_commessa_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Export completato con successo');
    } catch (error) {
      console.error('Error exporting analytics:', error);
      toast.error('Errore durante l\'export');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Caricamento analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Clienti - Responsabile Commessa</h1>
          <p className="text-gray-600">Analisi performance delle tue commesse e sub agenzie</p>
        </div>
        
        <Button onClick={handleExport} className="flex items-center space-x-2">
          <Download className="w-4 h-4" />
          <span>Esporta Excel</span>
        </Button>
      </div>

      {/* Filtri */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-sm font-medium">Dal:</Label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Al:</Label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Commessa:</Label>
            <Select value={selectedCommessa} onValueChange={setSelectedCommessa}>
              <SelectTrigger>
                <SelectValue placeholder="Tutte le commesse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le Commesse</SelectItem>
                {user.commesse_autorizzate?.map((commessaId) => {
                  const commessa = commesse.find(c => c.id === commessaId);
                  return commessa ? (
                    <SelectItem key={commessa.id} value={commessa.id}>
                      {commessa.nome}
                    </SelectItem>
                  ) : null;
                }) || []}
                {(!user.commesse_autorizzate || user.commesse_autorizzate.length === 0) && (
                  <SelectItem value="none" disabled>Nessuna commessa autorizzata</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button 
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setSelectedCommessa('all');
              }} 
              variant="outline"
              className="w-full"
            >
              Reset Filtri
            </Button>
          </div>
        </div>
      </div>

      {/* Conversioni Generali */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Riepilogo Generale</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{analyticsData.conversioni.totale_clienti || 0}</p>
            <p className="text-sm text-gray-600">Clienti Totali</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{analyticsData.conversioni.totale_completati || 0}</p>
            <p className="text-sm text-gray-600">Clienti Completati</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">{analyticsData.conversioni.conversion_rate_generale || 0}%</p>
            <p className="text-sm text-gray-600">Tasso Conversione</p>
          </div>
        </div>
      </Card>

      {/* Analytics per Sub Agenzia */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Performance per Sub Agenzia</h3>
        {analyticsData.sub_agenzie_analytics.length > 0 ? (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Sub Agenzia</th>
                      <th className="text-center py-2">Clienti Totali</th>
                      <th className="text-center py-2">Completati</th>
                      <th className="text-center py-2">In Lavorazione</th>
                      <th className="text-center py-2">Tasso Conversione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.sub_agenzie_analytics.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2">{item.nome}</td>
                        <td className="text-center py-2">{item.totale_clienti}</td>
                        <td className="text-center py-2">
                          <Badge variant="default">{item.completati}</Badge>
                        </td>
                        <td className="text-center py-2">
                          <Badge variant="secondary">{item.in_lavorazione}</Badge>
                        </td>
                        <td className="text-center py-2">
                          <Badge variant={item.conversion_rate >= 50 ? "default" : "secondary"}>
                            {item.conversion_rate}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {analyticsData.sub_agenzie_analytics.map((item, index) => (
                <div key={index} className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <h3 className="font-semibold text-slate-900">{item.nome}</h3>
                    </div>
                    <Badge variant={item.conversion_rate >= 50 ? "default" : "secondary"} className="text-xs">
                      {item.conversion_rate}%
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                      <div className="flex items-center space-x-2">
                        <Users className="w-3 h-3 text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">Clienti Totali</span>
                      </div>
                      <span className="font-semibold text-slate-900">{item.totale_clienti}</span>
                    </div>
                    
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-green-400" />
                        <span className="text-sm font-medium text-green-600">Completati</span>
                      </div>
                      <Badge variant="default" className="text-xs">{item.completati}</Badge>
                    </div>
                    
                    <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-3 h-3 text-orange-400" />
                        <span className="text-sm font-medium text-orange-600">In Lavorazione</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{item.in_lavorazione}</Badge>
                    </div>
                    
                    <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                      <div className="flex items-center space-x-2">
                        <Target className="w-3 h-3 text-blue-400" />
                        <span className="text-sm font-medium text-blue-600">Tasso Conversione</span>
                      </div>
                      <Badge variant={item.conversion_rate >= 50 ? "default" : "secondary"} className="text-xs">
                        {item.conversion_rate}%
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Nessun dato disponibile per le analytics</p>
        )}
      </Card>
    </div>
  );
};


const AnalyticsManagement = ({ selectedUnit, units }) => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedReferente, setSelectedReferente] = useState("");
  const [agents, setAgents] = useState([]);
  const [referenti, setReferenti] = useState([]);
  const [commesse, setCommesse] = useState([]);
  const [subAgenzie, setSubAgenzie] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  
  // Analytics date filters
  const [analyticsDateRange, setAnalyticsDateRange] = useState({
    date_from: "",
    date_to: ""
  });
  
  // NEW: Pivot Analytics States
  const [pivotFilters, setPivotFilters] = useState({
    sub_agenzia_ids: [],
    status_values: [],
    tipologia_contratto_values: [],
    segmento_values: [],
    offerta_ids: [],
    created_by_ids: [],
    convergenza: null,
    data_da: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    data_a: format(new Date(), 'yyyy-MM-dd')
  });
  const [pivotData, setPivotData] = useState(null);
  const [pivotLoading, setPivotLoading] = useState(false);
  
  // NEW: Sub Agenzie Analytics States
  const [subAgenzieData, setSubAgenzieData] = useState([]);
  const [subAgenzieLoading, setSubAgenzieLoading] = useState(false);
  
  // NEW: Filter Options
  const [filterOptions, setFilterOptions] = useState({
    offerte: [],
    users: []
  });
  
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Set default tab based on role
  const getDefaultTab = () => {
    if (user.role === "admin" || user.role === "referente") {
      return "dashboard";
    }
    // For roles that manage only clients (no dashboard access)
    return "pivot";
  };
  
  const [activeTab, setActiveTab] = useState(getDefaultTab());

  useEffect(() => {
    if (user.role === "admin" || user.role === "referente") {
      fetchUsers();
      fetchCommesse();
      fetchSubAgenzie();
    }
    if (activeTab === "dashboard") {
      fetchDashboardData();
    }
  }, [selectedUnit, activeTab, dateRange]);

  // NEW: Load initial data for filters
  useEffect(() => {
    fetchSubAgenzie();
    fetchFilterOptions();
  }, []);

  // NEW: Load pivot data automatically when tab opens (once)
  useEffect(() => {
    if (activeTab === "pivot" && !pivotData) {
      fetchPivotAnalytics();
    }
  }, [activeTab]);

  // NEW: Load sub agenzie data when tab changes
  useEffect(() => {
    if (activeTab === "sub-agenzie" && subAgenzieData.length === 0) {
      fetchSubAgenzieAnalytics();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      
      const response = await axios.get(`${API}/users?${params}`);
      const users = response.data;
      
      setAgents(users.filter(u => u.role === "agente"));
      setReferenti(users.filter(u => u.role === "referente"));
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchCommesse = async () => {
    try {
      const response = await axios.get(`${API}/commesse`);
      setCommesse(response.data);
    } catch (error) {
      console.error("Error fetching commesse:", error);
    }
  };

  const fetchSubAgenzie = async () => {
    try {
      const response = await axios.get(`${API}/sub-agenzie`);
      setSubAgenzie(response.data);
    } catch (error) {
      console.error("Error fetching sub agenzie:", error);
    }
  };


  // NEW: Fetch Pivot Analytics
  const fetchPivotAnalytics = async () => {
    try {
      setPivotLoading(true);
      const params = new URLSearchParams();
      
      if (pivotFilters.sub_agenzia_ids.length > 0) {
        params.append('sub_agenzia_ids', pivotFilters.sub_agenzia_ids.join(','));
      }
      if (pivotFilters.status_values.length > 0) {
        params.append('status_values', pivotFilters.status_values.join(','));
      }
      if (pivotFilters.tipologia_contratto_values.length > 0) {
        params.append('tipologia_contratto_values', pivotFilters.tipologia_contratto_values.join(','));
      }
      if (pivotFilters.segmento_values.length > 0) {
        params.append('segmento_values', pivotFilters.segmento_values.join(','));
      }
      if (pivotFilters.offerta_ids.length > 0) {
        params.append('offerta_ids', pivotFilters.offerta_ids.join(','));
      }
      if (pivotFilters.created_by_ids.length > 0) {
        params.append('created_by_ids', pivotFilters.created_by_ids.join(','));
      }
      if (pivotFilters.convergenza !== null) {
        params.append('convergenza', pivotFilters.convergenza);
      }
      if (pivotFilters.data_da) {
        params.append('data_da', pivotFilters.data_da);
      }
      if (pivotFilters.data_a) {
        params.append('data_a', pivotFilters.data_a);
      }
      
      const response = await axios.get(`${API}/analytics/pivot?${params}`);
      setPivotData(response.data);
      setPivotLoading(false);
    } catch (error) {
      console.error("Error fetching pivot analytics:", error);
      setPivotLoading(false);
    }
  };

  // NEW: Fetch Sub Agenzie Analytics
  const fetchSubAgenzieAnalytics = async () => {
    try {
      setSubAgenzieLoading(true);
      const params = new URLSearchParams();
      
      if (pivotFilters.data_da) {
        params.append('data_da', pivotFilters.data_da);
      }
      if (pivotFilters.data_a) {
        params.append('data_a', pivotFilters.data_a);
      }
      
      const response = await axios.get(`${API}/analytics/sub-agenzie?${params}`);
      
      // Ensure each item has the required properties with defaults
      const sanitizedData = Array.isArray(response.data) ? response.data.map(sa => ({
        ...sa,
        status_breakdown: sa.status_breakdown || {},
        top_creators: sa.top_creators || []
      })) : [];
      
      setSubAgenzieData(sanitizedData);
      setSubAgenzieLoading(false);
    } catch (error) {
      console.error("Error fetching sub agenzie analytics:", error);
      setSubAgenzieData([]);
      setSubAgenzieLoading(false);
    }
  };

  // NEW: Fetch Filter Options
  const fetchFilterOptions = async () => {
    try {
      const [offerteRes, usersRes] = await Promise.all([
        axios.get(`${API}/offerte`),
        axios.get(`${API}/users`)
      ]);
      
      setFilterOptions({
        offerte: offerteRes.data,
        users: usersRes.data
      });
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  // NEW: Export Pivot to Excel
  const exportPivotAnalytics = async () => {
    try {
      const params = new URLSearchParams();
      
      if (pivotFilters.sub_agenzia_ids.length > 0) {
        params.append('sub_agenzia_ids', pivotFilters.sub_agenzia_ids.join(','));
      }
      if (pivotFilters.status_values.length > 0) {
        params.append('status_values', pivotFilters.status_values.join(','));
      }
      if (pivotFilters.tipologia_contratto_values.length > 0) {
        params.append('tipologia_contratto_values', pivotFilters.tipologia_contratto_values.join(','));
      }
      if (pivotFilters.segmento_values.length > 0) {
        params.append('segmento_values', pivotFilters.segmento_values.join(','));
      }
      if (pivotFilters.offerta_ids.length > 0) {
        params.append('offerta_ids', pivotFilters.offerta_ids.join(','));
      }
      if (pivotFilters.created_by_ids.length > 0) {
        params.append('created_by_ids', pivotFilters.created_by_ids.join(','));
      }
      if (pivotFilters.convergenza !== null) {
        params.append('convergenza', pivotFilters.convergenza);
      }
      if (pivotFilters.data_da) {
        params.append('data_da', pivotFilters.data_da);
      }
      if (pivotFilters.data_a) {
        params.append('data_a', pivotFilters.data_a);
      }
      
      const response = await axios.get(`${API}/analytics/pivot/export?${params}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `pivot_analytics_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast({
        title: "Successo",
        description: "Export completato con successo"
      });
    } catch (error) {
      console.error("Error exporting pivot:", error);
      toast({
        title: "Errore",
        description: "Errore nell'export dei dati",
        variant: "destructive"
      });
    }
  };

  // NEW: Export lista clienti filtrati (Pivot)
  const exportPivotClientiList = async () => {
    try {
      const params = new URLSearchParams();
      
      if (pivotFilters.sub_agenzia_ids.length > 0) {
        params.append('sub_agenzia_ids', pivotFilters.sub_agenzia_ids.join(','));
      }
      if (pivotFilters.status_values.length > 0) {
        params.append('status_values', pivotFilters.status_values.join(','));
      }
      if (pivotFilters.tipologia_contratto_values.length > 0) {
        params.append('tipologia_contratto_values', pivotFilters.tipologia_contratto_values.join(','));
      }
      if (pivotFilters.segmento_values.length > 0) {
        params.append('segmento_values', pivotFilters.segmento_values.join(','));
      }
      if (pivotFilters.offerta_ids.length > 0) {
        params.append('offerta_ids', pivotFilters.offerta_ids.join(','));
      }
      if (pivotFilters.created_by_ids.length > 0) {
        params.append('created_by_ids', pivotFilters.created_by_ids.join(','));
      }
      if (pivotFilters.convergenza !== null) {
        params.append('convergenza', pivotFilters.convergenza);
      }
      if (pivotFilters.data_da) {
        params.append('data_da', pivotFilters.data_da);
      }
      if (pivotFilters.data_a) {
        params.append('data_a', pivotFilters.data_a);
      }
      
      const response = await axios.get(`${API}/analytics/pivot/export-clienti?${params}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `clienti_pivot_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast({
        title: "Successo",
        description: "Export lista clienti completato con successo"
      });
    } catch (error) {
      console.error("Error exporting pivot clienti:", error);
      toast({
        title: "Errore",
        description: "Errore nell'export della lista clienti",
        variant: "destructive"
      });
    }
  };


  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      params.append('date_from', dateRange.startDate);
      params.append('date_to', dateRange.endDate);

      // Fetch multiple analytics endpoints
      const [leadsRes, usersRes, commesseRes] = await Promise.all([
        axios.get(`${API}/leads?${params}&limit=10000`),
        axios.get(`${API}/users?${params}`),
        axios.get(`${API}/commesse`)
      ]);

      // Handle paginated response - leads endpoint returns {leads: [], total: N, ...}
      const leadsData = leadsRes.data;
      const leads = Array.isArray(leadsData) ? leadsData : (leadsData.leads || []);
      const users = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data.users || usersRes.data || []);

      // Process dashboard metrics
      const totalLeads = leads.length;
      const totalUsers = users.length;
      const totalCommesse = commesseRes.data.length;
      const totalClients = await axios.get(`${API}/clienti`).then(res => res.data.length).catch(() => 0);

      // Calculate conversion rates and esiti breakdown
      const esitoBreakdown = leads.reduce((acc, lead) => {
        const esito = lead.esito || 'Non Impostato';
        acc[esito] = (acc[esito] || 0) + 1;
        return acc;
      }, {});

      // Generate chart data - leads per day
      const leadsPerDay = leads.reduce((acc, lead) => {
        const date = format(parseISO(lead.created_at || new Date().toISOString()), 'yyyy-MM-dd');
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      const chartDataArray = Object.entries(leadsPerDay)
        .map(([date, count]) => ({
          date: format(parseISO(date + 'T00:00:00'), 'dd/MM', { locale: it }),
          leads: count,
          fullDate: date
        }))
        .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
        .slice(-14); // Last 14 days

      // Performance by agents
      const agentPerformance = users
        .filter(u => u.role === 'agente')
        .map(agent => {
          const agentLeads = leads.filter(l => l.agent_id === agent.id);
          return {
            name: agent.username,
            leads: agentLeads.length,
            conversions: agentLeads.filter(l => ['Interessato', 'Venduto', 'Completato'].includes(l.esito)).length
          };
        })
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 10);

      setDashboardData({
        totalLeads,
        totalUsers,
        totalCommesse,
        totalClients,
        esitoBreakdown,
        agentPerformance,
        conversionRate: totalLeads > 0 ? Math.round((Object.entries(esitoBreakdown).filter(([esito]) => 
          ['Interessato', 'Venduto', 'Completato'].includes(esito)
        ).reduce((sum, [, count]) => sum + count, 0) / totalLeads) * 100) : 0
      });

      setChartData(chartDataArray);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei dati dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentAnalytics = async (agentId) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (analyticsDateRange.date_from) params.append('date_from', analyticsDateRange.date_from);
      if (analyticsDateRange.date_to) params.append('date_to', analyticsDateRange.date_to);
      
      const url = params.toString() 
        ? `${API}/analytics/agent/${agentId}?${params.toString()}`
        : `${API}/analytics/agent/${agentId}`;
      
      const response = await axios.get(url);
      setAnalyticsData(response.data);
    } catch (error) {
      console.error("Error fetching agent analytics:", error);
      toast({ title: "Errore", description: "Errore nel caricamento analytics agente", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchReferenteAnalytics = async (referenteId) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (analyticsDateRange.date_from) params.append('date_from', analyticsDateRange.date_from);
      if (analyticsDateRange.date_to) params.append('date_to', analyticsDateRange.date_to);
      
      const url = params.toString() 
        ? `${API}/analytics/referente/${referenteId}?${params.toString()}`
        : `${API}/analytics/referente/${referenteId}`;
      
      const response = await axios.get(url);
      setAnalyticsData(response.data);
    } catch (error) {
      console.error("Error fetching referente analytics:", error);
      toast({ title: "Errore", description: "Errore nel caricamento analytics referente", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Export functions
  const exportLeads = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedUnit && selectedUnit !== "all") params.append('unit_id', selectedUnit);
      params.append('date_from', dateRange.startDate);
      params.append('date_to', dateRange.endDate);
      
      const response = await axios.get(`${API}/leads/export?${params}`, {
        responseType: 'blob'
      });
      
      downloadFile(response.data, `leads_export_${format(new Date(), 'yyyyMMdd')}.xlsx`);
      toast({ title: "Successo", description: "Export Leads completato" });
    } catch (error) {
      console.error("Error exporting leads:", error);
      toast({ title: "Errore", description: "Errore nell'export dei leads", variant: "destructive" });
    }
  };

  const exportClienti = async () => {
    try {
      // Build query parameters based on current filters
      const params = {};
      if (selectedUnit && selectedUnit !== "all") params.unit_id = selectedUnit;
      params.date_from = dateRange.startDate;
      params.date_to = dateRange.endDate;
      
      // Call new Excel export endpoint
      const response = await axios.get(`${API}/clienti/export/excel`, {
        params,
        responseType: 'blob'  // Important for file download
      });
      
      // Create download link for Excel file
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clienti_export_${format(new Date(), 'yyyyMMdd')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({ title: "Successo", description: "Export Clienti Excel completato" });
    } catch (error) {
      console.error("Error exporting clienti:", error);
      toast({ title: "Errore", description: "Errore nell'export Excel dei clienti", variant: "destructive" });
    }
  };

  const exportAnalytics = async () => {
    try {
      if (!dashboardData) return;
      
      const reportData = {
        generated_at: new Date().toISOString(),
        date_range: dateRange,
        unit: selectedUnit || 'all',
        summary: {
          total_leads: dashboardData.totalLeads,
          total_users: dashboardData.totalUsers,
          total_commesse: dashboardData.totalCommesse,
          total_clients: dashboardData.totalClients,
          conversion_rate: dashboardData.conversionRate + '%'
        },
        esito_breakdown: dashboardData.esitoBreakdown,
        agent_performance: dashboardData.agentPerformance,
        chart_data: chartData
      };
      
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      downloadFile(blob, `analytics_report_${format(new Date(), 'yyyyMMdd')}.json`);
      
      toast({ title: "Successo", description: "Export Analytics completato" });
    } catch (error) {
      console.error("Error exporting analytics:", error);
      toast({ title: "Errore", description: "Errore nell'export analytics", variant: "destructive" });
    }
  };

  const downloadFile = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Charts color schemes
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];



  // NEW: Render Pivot Analytics
  const renderPivot = () => {
    return (
      <div className="p-6 space-y-6">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
          <h2 className="text-3xl font-bold mb-2">📊 Pivot Analytics Personalizzate</h2>
          <p className="text-blue-100">Analizza i dati dei clienti con filtri avanzati e visualizzazioni interattive</p>
        </div>

        {/* Filtri Section */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gray-50">
            <CardTitle className="flex items-center gap-2">
              🔍 Filtri di Ricerca
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Range Date */}
              <div>
                <Label className="text-base font-semibold mb-3 block">📅 Periodo di Analisi</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-600">Data Inizio</Label>
                    <Input
                      type="date"
                      value={pivotFilters.data_da}
                      onChange={(e) => setPivotFilters({...pivotFilters, data_da: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Data Fine</Label>
                    <Input
                      type="date"
                      value={pivotFilters.data_a}
                      onChange={(e) => setPivotFilters({...pivotFilters, data_a: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Sub Agenzia - Checkboxes */}
              <div>
                <Label className="text-base font-semibold mb-3 block">🏢 Sub Agenzie</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto p-3 bg-gray-50 rounded-lg">
                  {subAgenzie.map(sa => (
                    <label key={sa.id} className="flex items-center space-x-2 cursor-pointer hover:bg-white p-2 rounded">
                      <input
                        type="checkbox"
                        checked={pivotFilters.sub_agenzia_ids.includes(sa.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPivotFilters({
                              ...pivotFilters,
                              sub_agenzia_ids: [...pivotFilters.sub_agenzia_ids, sa.id]
                            });
                          } else {
                            setPivotFilters({
                              ...pivotFilters,
                              sub_agenzia_ids: pivotFilters.sub_agenzia_ids.filter(id => id !== sa.id)
                            });
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{sa.nome}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Status - Checkboxes */}
              <div>
                <Label className="text-base font-semibold mb-3 block">📊 Status</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto p-3 bg-gray-50 rounded-lg">
                  {STATUS_CLIENTI.map(s => (
                    <label key={s.value} className="flex items-center space-x-2 cursor-pointer hover:bg-white p-2 rounded">
                      <input
                        type="checkbox"
                        checked={pivotFilters.status_values.includes(s.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPivotFilters({
                              ...pivotFilters,
                              status_values: [...pivotFilters.status_values, s.value]
                            });
                          } else {
                            setPivotFilters({
                              ...pivotFilters,
                              status_values: pivotFilters.status_values.filter(v => v !== s.value)
                            });
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Convergenza */}
              <div>
                <Label className="text-base font-semibold mb-3 block">📱 Convergenza</Label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="convergenza"
                      checked={pivotFilters.convergenza === null}
                      onChange={() => setPivotFilters({...pivotFilters, convergenza: null})}
                      className="border-gray-300"
                    />
                    <span className="text-sm">Tutti</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="convergenza"
                      checked={pivotFilters.convergenza === true}
                      onChange={() => setPivotFilters({...pivotFilters, convergenza: true})}
                      className="border-gray-300"
                    />
                    <span className="text-sm">Sì</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="convergenza"
                      checked={pivotFilters.convergenza === false}
                      onChange={() => setPivotFilters({...pivotFilters, convergenza: false})}
                      className="border-gray-300"
                    />
                    <span className="text-sm">No</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <Button 
                  onClick={fetchPivotAnalytics} 
                  disabled={pivotLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {pivotLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Caricamento...
                    </>
                  ) : (
                    <>
                      🔄 Aggiorna Dati
                    </>
                  )}
                </Button>
                <Button 
                  onClick={exportPivotAnalytics} 
                  variant="outline"
                  className="border-green-600 text-green-600 hover:bg-green-50"
                >
                  📥 Export Statistiche
                </Button>
                <Button 
                  onClick={exportPivotClientiList} 
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  📋 Export Lista Clienti
                </Button>
                <Button
                  onClick={() => {
                    setPivotFilters({
                      sub_agenzia_ids: [],
                      status_values: [],
                      tipologia_contratto_values: [],
                      segmento_values: [],
                      offerta_ids: [],
                      created_by_ids: [],
                      convergenza: null,
                      data_da: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
                      data_a: format(new Date(), 'yyyy-MM-dd')
                    });
                    setPivotData(null);
                  }}
                  variant="outline"
                  className="border-red-600 text-red-600 hover:bg-red-50"
                >
                  🔄 Reset Filtri
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {pivotLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Risultati */}
        {!pivotLoading && pivotData && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                  <CardTitle className="text-lg">📊 Totale Clienti</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <p className="text-4xl font-bold text-blue-600">{pivotData.total_clienti}</p>
                  <p className="text-sm text-gray-500 mt-2">Nel periodo selezionato</p>
                </CardContent>
              </Card>

              <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                  <CardTitle className="text-lg">📅 Periodo Precedente</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <p className="text-4xl font-bold text-purple-600">{pivotData.previous_period_count}</p>
                  <p className="text-sm text-gray-500 mt-2">Stesso periodo prima</p>
                </CardContent>
              </Card>

              <Card className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className={`bg-gradient-to-br ${pivotData.trend_percentage >= 0 ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'} text-white`}>
                  <CardTitle className="text-lg">📈 Trend</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <p className={`text-4xl font-bold ${pivotData.trend_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {pivotData.trend_percentage > 0 ? '+' : ''}{pivotData.trend_percentage}%
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    {pivotData.trend_percentage >= 0 ? '↗ In crescita' : '↘ In calo'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Breakdown Tables */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(pivotData.breakdown).map(([category, data]) => (
                <Card key={category} className="shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <CardTitle className="capitalize text-lg">
                      {category === 'sub_agenzia' && '🏢 '}{category === 'status' && '📊 '}
                      {category === 'tipologia_contratto' && '📑 '}{category === 'segmento' && '🎯 '}
                      {category === 'offerta' && '📦 '}{category === 'created_by' && '👤 '}
                      {category === 'convergenza' && '📱 '}
                      {category.replace('_', ' ')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b-2 border-gray-200">
                            <th className="text-left p-3 text-sm font-semibold text-gray-700">Nome</th>
                            <th className="text-right p-3 text-sm font-semibold text-gray-700">Conteggio</th>
                            <th className="text-right p-3 text-sm font-semibold text-gray-700">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(data.counts).sort((a, b) => b[1] - a[1]).map(([key, count]) => (
                            <tr key={key} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                              <td className="p-3 text-sm font-medium text-gray-800">{key}</td>
                              <td className="text-right p-3 text-sm">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {count}
                                </span>
                              </td>
                              <td className="text-right p-3 text-sm font-semibold text-gray-700">
                                {data.percentages[key]}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!pivotLoading && !pivotData && (
          <Card className="shadow-lg">
            <CardContent className="py-12">
              <div className="text-center text-gray-500">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-semibold mb-2">Nessun dato disponibile</h3>
                <p className="text-sm">Seleziona i filtri e clicca su "Aggiorna Dati" per visualizzare le statistiche</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // NEW: Render Sub Agenzie Analytics
  const renderSubAgenzie = () => {
    return (
      <div className="p-6 space-y-6">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
          <h2 className="text-3xl font-bold mb-2">🏢 Analytics per Sub Agenzia</h2>
          <p className="text-blue-100">Analisi comparativa delle performance di ogni sub agenzia</p>
        </div>

        {/* Filtri Section */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gray-50">
            <CardTitle className="flex items-center gap-2">
              📅 Periodo di Analisi
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Label className="text-sm text-gray-600 mb-2 block">Data Inizio</Label>
                <Input
                  type="date"
                  value={pivotFilters.data_da}
                  onChange={(e) => setPivotFilters({...pivotFilters, data_da: e.target.value})}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-sm text-gray-600 mb-2 block">Data Fine</Label>
                <Input
                  type="date"
                  value={pivotFilters.data_a}
                  onChange={(e) => setPivotFilters({...pivotFilters, data_a: e.target.value})}
                  className="w-full"
                />
              </div>
              <Button 
                onClick={fetchSubAgenzieAnalytics} 
                disabled={subAgenzieLoading}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {subAgenzieLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Caricamento...
                  </>
                ) : (
                  <>🔄 Aggiorna Dati</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Cards per ogni sub agenzia */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {subAgenzieData.map(sa => (
            <Card key={sa.sub_agenzia_id} className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  🏢 {sa.sub_agenzia_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                  <p className="text-sm text-gray-600 mb-1">Totale Clienti</p>
                  <p className="text-3xl font-bold text-blue-600">{sa.total_clienti}</p>
                </div>
                
                <div className="border-t pt-4">
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                    📊 Breakdown Status:
                  </p>
                  <div className="space-y-2">
                    {sa.status_breakdown && Object.entries(sa.status_breakdown).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                        <span className="text-sm font-medium">{status}</span>
                        <span className="font-bold text-blue-600">{count}</span>
                      </div>
                    ))}
                    {!sa.status_breakdown && (
                      <p className="text-sm text-gray-500 italic">Nessun dato disponibile</p>
                    )}
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                    🏆 Top Creatori:
                  </p>
                  <div className="space-y-2">
                    {sa.top_creators && sa.top_creators.length > 0 && sa.top_creators.map((creator, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
                        <span className="text-sm font-medium">👤 {creator.name}</span>
                        <span className="font-bold text-green-600">{creator.count}</span>
                      </div>
                    ))}
                    {(!sa.top_creators || sa.top_creators.length === 0) && (
                      <p className="text-sm text-gray-500 italic">Nessun creatore disponibile</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Tabella Comparativa */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gray-50">
            <CardTitle className="flex items-center gap-2">
              📊 Tabella Comparativa Sub Agenzie
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                    <th className="text-left p-3 font-bold text-gray-700">Sub Agenzia</th>
                    <th className="text-right p-3 font-bold text-gray-700">Totale Clienti</th>
                    <th className="text-right p-3 font-bold text-gray-700">Top Creator</th>
                  </tr>
                </thead>
                <tbody>
                  {subAgenzieData.map((sa, idx) => (
                    <tr key={sa.sub_agenzia_id} className={`border-b hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="p-3 font-medium">🏢 {sa.sub_agenzia_name}</td>
                      <td className="text-right p-3">
                        <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
                          {sa.total_clienti}
                        </span>
                      </td>
                      <td className="text-right p-3">
                        {sa.top_creators && sa.top_creators[0]?.name ? (
                          <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                            👤 {sa.top_creators[0].name} ({sa.top_creators[0].count})
                          </span>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderDashboard = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!dashboardData) return null;

    return (
      <div>
        {/* 📱 MOBILE VIEW */}
        <div className="md:hidden p-4 space-y-6 bg-slate-50 min-h-screen">
          {/* Mobile Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg">
            <h2 className="text-xl font-bold mb-2">📊 Analytics</h2>
            <p className="text-blue-100 text-base">Reports & Performance</p>
          </div>

          {/* Mobile Export Button */}
          <Card className="bg-white shadow-md border-2 border-slate-200">
            <CardContent className="p-4">
              <Button 
                onClick={exportAnalytics}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 text-base"
              >
                <Download className="w-5 h-5 mr-2" />
                Esporta Dati Excel
              </Button>
            </CardContent>
          </Card>

          {/* Mobile Stats - Enhanced */}
          <div className="space-y-4">
            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 border-none shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/90 text-base font-medium mb-1">📈 Totale Lead</p>
                    <p className="text-3xl font-bold text-white">{dashboardData.totalLeads}</p>
                    <p className="text-blue-100 text-sm">Lead generati nel periodo</p>
                  </div>
                  <div className="bg-white/20 rounded-full p-3">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-green-500 to-green-600 border-none shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/90 text-base font-medium mb-1">👥 Totale Clienti</p>
                    <p className="text-3xl font-bold text-white">{dashboardData.totalClients}</p>
                    <p className="text-green-100 text-sm">Clienti acquisiti</p>
                  </div>
                  <div className="bg-white/20 rounded-full p-3">
                    <Building2 className="h-8 w-8 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-500 to-purple-600 border-none shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/90 text-base font-medium mb-1">🎯 Tasso Conversione</p>
                    <p className="text-3xl font-bold text-white">{dashboardData.conversionRate}%</p>
                    <p className="text-purple-100 text-sm">Lead convertiti</p>
                  </div>
                  <div className="bg-white/20 rounded-full p-3">
                    <Target className="h-8 w-8 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-orange-500 to-orange-600 border-none shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/90 text-base font-medium mb-1">💼 Commesse Attive</p>
                    <p className="text-3xl font-bold text-white">{dashboardData.totalCommesse}</p>
                    <p className="text-orange-100 text-sm">Progetti in corso</p>
                  </div>
                  <div className="bg-white/20 rounded-full p-3">
                    <Briefcase className="h-8 w-8 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mobile Date Range Filters */}
          <Card className="bg-white shadow-md border-2 border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-slate-800">📅 Filtri Periodo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-base font-semibold text-slate-700 mb-2 block">Data Inizio:</Label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full p-3 border-2 border-slate-300 rounded-lg text-base font-medium"
                />
              </div>
              <div>
                <Label className="text-base font-semibold text-slate-700 mb-2 block">Data Fine:</Label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full p-3 border-2 border-slate-300 rounded-lg text-base font-medium"
                />
              </div>
            </CardContent>
          </Card>

          {/* Mobile Charts - Enhanced */}
          <Card className="bg-white shadow-md border-2 border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-slate-800">📈 Andamento Lead</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="leads" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-md border-2 border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold text-slate-800">📊 Distribuzione Esiti</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={Object.entries(dashboardData.esitoBreakdown).map(([esito, count]) => ({
                      name: esito,
                      value: count
                    }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {Object.entries(dashboardData.esitoBreakdown).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Mobile Performance Chart */}
          {dashboardData.agentPerformance.length > 0 && (
            <Card className="bg-white shadow-md border-2 border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold text-slate-800">🏆 Top 5 Agenti</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.agentPerformance.slice(0, 5)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="leads" fill="#3B82F6" name="Lead" />
                    <Bar dataKey="conversions" fill="#10B981" name="Conversioni" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Mobile Bottom Spacing */}
          <div className="pb-6"></div>
        </div>

        {/* 🖥️ DESKTOP VIEW */}
        <div className="hidden md:block p-6 space-y-6">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
            <h2 className="text-3xl font-bold mb-2">📊 Dashboard Overview</h2>
            <p className="text-blue-100">Panoramica completa delle performance e analytics del sistema</p>
          </div>

          {/* Desktop Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">Totale Lead</CardTitle>
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{dashboardData.totalLeads}</div>
                <p className="text-xs text-gray-500 mt-1">Lead generati nel periodo</p>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-green-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">Totale Clienti</CardTitle>
                <div className="bg-green-100 p-2 rounded-lg">
                  <Building2 className="h-5 w-5 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{dashboardData.totalClients}</div>
                <p className="text-xs text-gray-500 mt-1">Clienti acquisiti</p>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-purple-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">Tasso Conversione</CardTitle>
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Target className="h-5 w-5 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">{dashboardData.conversionRate}%</div>
                <p className="text-xs text-gray-500 mt-1">Lead convertiti</p>
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow border-l-4 border-orange-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-gray-700">Commesse Attive</CardTitle>
                <div className="bg-orange-100 p-2 rounded-lg">
                  <Briefcase className="h-5 w-5 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{dashboardData.totalCommesse}</div>
                <p className="text-xs text-gray-500 mt-1">Progetti in corso</p>
              </CardContent>
            </Card>
          </div>

          {/* Desktop Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Line Chart - Leads Trend */}
            <Card className="shadow-lg">
              <CardHeader className="bg-gray-50">
                <CardTitle className="flex items-center gap-2">
                  📈 Andamento Lead (Ultimi 14 giorni)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="leads" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie Chart - Esiti Breakdown */}
            <Card className="shadow-lg">
              <CardHeader className="bg-gray-50">
                <CardTitle className="flex items-center gap-2">
                  📊 Distribuzione Esiti
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(dashboardData.esitoBreakdown).map(([esito, count]) => ({
                        name: esito,
                        value: count
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {Object.entries(dashboardData.esitoBreakdown).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Desktop Performance Chart */}
          {dashboardData.agentPerformance.length > 0 && (
            <Card className="shadow-lg">
              <CardHeader className="bg-gray-50">
                <CardTitle className="flex items-center gap-2">
                  🏆 Performance Agenti (Top 10)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={dashboardData.agentPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="leads" fill="#3B82F6" name="Lead Totali" />
                    <Bar dataKey="conversions" fill="#10B981" name="Conversioni" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  };

  const renderAgentAnalytics = () => {
    if (!analyticsData || !analyticsData.stats) return null;

    const { agent, stats } = analyticsData;

    return (
      <div className="space-y-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span>Analytics per {agent.username}</span>
            </CardTitle>
            <CardDescription>{agent.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.total_leads}</p>
                <p className="text-sm text-slate-600">Totale Lead</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.contacted_leads}</p>
                <p className="text-sm text-slate-600">Contattati</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{stats.contact_rate}%</p>
                <p className="text-sm text-slate-600">Tasso Contatti</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{stats.leads_this_week}</p>
                <p className="text-sm text-slate-600">Questa Settimana</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-indigo-600">{stats.leads_this_month}</p>
                <p className="text-sm text-slate-600">Questo Mese</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Distribuzione Esiti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(stats.outcomes).map(([outcome, count]) => (
                <div key={outcome} className="text-center p-4 bg-slate-50 rounded-lg">
                  <p className="text-xl font-bold">{count}</p>
                  <p className="text-xs text-slate-600">{outcome}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderReferenteAnalytics = () => {
    if (!analyticsData || !analyticsData.total_stats) return null;

    const { referente, total_stats, agent_breakdown, outcomes } = analyticsData;

    return (
      <div className="space-y-6">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>Analytics per Referente {referente.username}</span>
            </CardTitle>
            <CardDescription>{referente.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{total_stats.total_leads}</p>
                <p className="text-sm text-slate-600">Totale Lead</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{total_stats.contacted_leads}</p>
                <p className="text-sm text-slate-600">Contattati</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-600">{total_stats.contact_rate}%</p>
                <p className="text-sm text-slate-600">Tasso Contatti</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Distribuzione Esiti */}
        {outcomes && Object.keys(outcomes).length > 0 && (
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Distribuzione Esiti</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {Object.entries(outcomes).map(([outcome, count]) => (
                  <div key={outcome} className="text-center p-4 bg-slate-50 rounded-lg">
                    <p className="text-xl font-bold">{count}</p>
                    <p className="text-xs text-slate-600">{outcome}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Performance Agenti</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white z-10">Agente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Totale Lead</TableHead>
                    <TableHead>Contattati</TableHead>
                    <TableHead>Tasso Contatti</TableHead>
                    {/* Dynamic columns for each outcome status */}
                    {outcomes && Object.keys(outcomes).length > 0 && 
                      Object.keys(outcomes).map((outcome) => (
                        <TableHead key={outcome} className="text-center">{outcome}</TableHead>
                      ))
                    }
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agent_breakdown.map((agentData) => (
                    <TableRow key={agentData.agent.id}>
                      <TableCell className="font-medium sticky left-0 bg-white z-10">{agentData.agent.username}</TableCell>
                      <TableCell>{agentData.agent.email}</TableCell>
                      <TableCell>{agentData.total_leads}</TableCell>
                      <TableCell>{agentData.contacted_leads}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={agentData.contact_rate >= 50 ? "default" : "secondary"}
                          className={agentData.contact_rate >= 50 ? "bg-green-100 text-green-800" : ""}
                        >
                          {agentData.contact_rate}%
                        </Badge>
                      </TableCell>
                      {/* Dynamic cells for each outcome status */}
                      {outcomes && Object.keys(outcomes).length > 0 && 
                        Object.keys(outcomes).map((outcome) => (
                          <TableCell key={outcome} className="text-center">
                            {agentData.outcomes && agentData.outcomes[outcome] ? agentData.outcomes[outcome] : 0}
                          </TableCell>
                        ))
                      }
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 🖥️ DESKTOP ONLY: Header with Filters and Export Buttons */}
      <div className="hidden md:flex justify-between items-center p-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Reports & Analytics</h1>
          <p className="text-slate-600 mt-1">Analisi performance e reportistica completa</p>
        </div>
        <div className="flex items-center space-x-2">
          {/* Date Range Picker */}
          <div className="flex items-center space-x-2">
            <Input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-auto"
            />
            <span className="text-slate-500">-</span>
            <Input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-auto"
            />
          </div>
          
          {/* Export Buttons */}
          <Button onClick={exportLeads} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export Leads
          </Button>
          <Button onClick={exportClienti} variant="outline" size="sm">
            <FileUser className="w-4 h-4 mr-2" />
            Export Clienti
          </Button>
          <Button onClick={exportAnalytics} variant="outline" size="sm">
            <BarChart3 className="w-4 h-4 mr-2" />
            Export Analytics
          </Button>
        </div>
      </div>

      {/* Tabs Navigation - Enhanced for Mobile */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* MOBILE TABS */}
        <div className="md:hidden mb-6">
          <div className="bg-white rounded-xl p-1 shadow-lg border-2 border-slate-200">
            <div className="grid grid-cols-1 gap-2">
              {/* Dashboard Overview - Only for Admin and Referente */}
              {(user.role === "admin" || user.role === "referente") && (
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`py-4 px-4 rounded-lg font-semibold text-base transition-all ${
                    activeTab === "dashboard" 
                      ? "bg-blue-600 text-white shadow-md" 
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  📊 Dashboard Overview
                </button>
              )}
              
              {user.role === "admin" && (
                <>
                  <button
                    onClick={() => setActiveTab("agents")}
                    className={`py-4 px-4 rounded-lg font-semibold text-base transition-all ${
                      activeTab === "agents" 
                        ? "bg-green-600 text-white shadow-md" 
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    👥 Analytics Agenti
                  </button>
                  <button
                    onClick={() => setActiveTab("referenti")}
                    className={`py-4 px-4 rounded-lg font-semibold text-base transition-all ${
                      activeTab === "referenti" 
                        ? "bg-purple-600 text-white shadow-md" 
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    🎯 Analytics Referenti
                  </button>
                </>
              )}
              
              <button
                onClick={() => setActiveTab("pivot")}
                className={`py-4 px-4 rounded-lg font-semibold text-base transition-all ${
                  activeTab === "pivot" 
                    ? "bg-indigo-600 text-white shadow-md" 
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                🔍 Pivot Analytics
              </button>
              
              <button
                onClick={() => setActiveTab("sub-agenzie")}
                className={`py-4 px-4 rounded-lg font-semibold text-base transition-all ${
                  activeTab === "sub-agenzie" 
                    ? "bg-teal-600 text-white shadow-md" 
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                🏢 Sub Agenzie
              </button>
            </div>
          </div>
        </div>

        {/* DESKTOP TABS */}
        {user.role === "admin" ? (
          <TabsList className="hidden md:grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="dashboard" className="text-base font-semibold">
              📊 Dashboard Overview
            </TabsTrigger>
            <TabsTrigger value="agents" className="text-base font-semibold">
              👥 Analytics Agenti
            </TabsTrigger>
            <TabsTrigger value="referenti" className="text-base font-semibold">
              🎯 Analytics Referenti
            </TabsTrigger>
            <TabsTrigger value="pivot" className="text-base font-semibold">
              🔍 Pivot Analytics
            </TabsTrigger>
            <TabsTrigger value="sub-agenzie" className="text-base font-semibold">
              🏢 Sub Agenzie
            </TabsTrigger>
          </TabsList>
        ) : user.role === "referente" ? (
          <TabsList className="hidden md:grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="dashboard" className="text-base font-semibold">
              📊 Dashboard Overview
            </TabsTrigger>
            <TabsTrigger value="pivot" className="text-base font-semibold">
              🔍 Pivot Analytics
            </TabsTrigger>
            <TabsTrigger value="sub-agenzie" className="text-base font-semibold">
              🏢 Sub Agenzie
            </TabsTrigger>
          </TabsList>
        ) : (
          <TabsList className="hidden md:grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="pivot" className="text-base font-semibold">
              🔍 Pivot Analytics
            </TabsTrigger>
            <TabsTrigger value="sub-agenzie" className="text-base font-semibold">
              🏢 Sub Agenzie
            </TabsTrigger>
          </TabsList>
        )}

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {renderDashboard()}
        </TabsContent>

        {/* Agents Tab - Only for Admin */}
        {user.role === "admin" && (
          <TabsContent value="agents" className="space-y-6">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-lg p-6 text-white">
              <h2 className="text-3xl font-bold mb-2">👥 Analytics Agenti</h2>
              <p className="text-green-100">Analisi dettagliate delle performance individuali degli agenti</p>
            </div>

            <Card className="shadow-lg">
              <CardHeader className="bg-gray-50">
                <CardTitle className="flex items-center gap-2">
                  🔍 Seleziona Agente per Analytics Dettagliate
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <Select value={selectedAgent} onValueChange={(value) => {
                  setSelectedAgent(value);
                  if (value) fetchAgentAnalytics(value);
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleziona agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        👤 {agent.username} ({agent.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Date Filters */}
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Data Inizio</label>
                    <Input
                      type="date"
                      value={analyticsDateRange.date_from}
                      onChange={(e) => setAnalyticsDateRange(prev => ({ ...prev, date_from: e.target.value }))}
                      className="w-full"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Data Fine</label>
                    <Input
                      type="date"
                      value={analyticsDateRange.date_to}
                      onChange={(e) => setAnalyticsDateRange(prev => ({ ...prev, date_to: e.target.value }))}
                      className="w-full"
                    />
                  </div>
                  <div className="pt-6 flex space-x-2">
                    <Button 
                      onClick={() => {
                        if (selectedAgent) fetchAgentAnalytics(selectedAgent);
                      }}
                      disabled={!selectedAgent}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Applica Filtri
                    </Button>
                    <Button 
                      onClick={() => {
                        setAnalyticsDateRange({ date_from: "", date_to: "" });
                        if (selectedAgent) {
                          // Temporarily clear filters then refetch
                          setTimeout(() => fetchAgentAnalytics(selectedAgent), 100);
                        }
                      }}
                      disabled={!selectedAgent}
                      variant="outline"
                      className="border-slate-300 hover:bg-slate-100"
                    >
                      Azzera Filtri
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {loading ? (
              <Card className="shadow-lg">
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                  <p className="mt-4 text-slate-600">Caricamento analytics agente...</p>
                </CardContent>
              </Card>
            ) : analyticsData && selectedAgent ? (
              renderAgentAnalytics()
            ) : (
              <Card className="shadow-lg border-l-4 border-green-500">
                <CardContent className="p-12 text-center">
                  <Users className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <p className="text-xl font-semibold text-slate-700 mb-2">Seleziona un agente</p>
                  <p className="text-slate-500">Scegli un agente dal menu a tendina per visualizzare le analytics dettagliate</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Referenti Tab - Only for Admin */}
        {user.role === "admin" && (
          <TabsContent value="referenti" className="space-y-6">
          {user.role === "admin" ? (
            <>
              {/* Header Section */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-6 text-white">
                <h2 className="text-3xl font-bold mb-2">🎯 Analytics Referenti</h2>
                <p className="text-purple-100">Monitoraggio delle performance dei referenti e dei loro team</p>
              </div>

              <Card className="shadow-lg">
                <CardHeader className="bg-gray-50">
                  <CardTitle className="flex items-center gap-2">
                    🔍 Seleziona Referente per Analytics Dettagliate
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <Select value={selectedReferente} onValueChange={(value) => {
                    setSelectedReferente(value);
                    if (value) fetchReferenteAnalytics(value);
                  }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleziona referente" />
                    </SelectTrigger>
                    <SelectContent>
                      {referenti.map((referente) => (
                        <SelectItem key={referente.id} value={referente.id}>
                          👤 {referente.username} ({referente.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {/* Date Filters */}
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Data Inizio</label>
                      <Input
                        type="date"
                        value={analyticsDateRange.date_from}
                        onChange={(e) => setAnalyticsDateRange(prev => ({ ...prev, date_from: e.target.value }))}
                        className="w-full"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-slate-700 mb-1 block">Data Fine</label>
                      <Input
                        type="date"
                        value={analyticsDateRange.date_to}
                        onChange={(e) => setAnalyticsDateRange(prev => ({ ...prev, date_to: e.target.value }))}
                        className="w-full"
                      />
                    </div>
                    <div className="pt-6 flex space-x-2">
                      <Button 
                        onClick={() => {
                          if (selectedReferente) fetchReferenteAnalytics(selectedReferente);
                        }}
                        disabled={!selectedReferente}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        Applica Filtri
                      </Button>
                      <Button 
                        onClick={() => {
                          setAnalyticsDateRange({ date_from: "", date_to: "" });
                          if (selectedReferente) {
                            // Temporarily clear filters then refetch
                            setTimeout(() => fetchReferenteAnalytics(selectedReferente), 100);
                          }
                        }}
                        disabled={!selectedReferente}
                        variant="outline"
                        className="border-slate-300 hover:bg-slate-100"
                      >
                        Azzera Filtri
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {loading ? (
                <Card className="shadow-lg">
                  <CardContent className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-4 text-slate-600">Caricamento analytics referente...</p>
                  </CardContent>
                </Card>
              ) : analyticsData && selectedReferente ? (
                renderReferenteAnalytics()
              ) : (
                <Card className="shadow-lg border-l-4 border-purple-500">
                  <CardContent className="p-12 text-center">
                    <Users2 className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                    <p className="text-xl font-semibold text-slate-700 mb-2">Seleziona un referente</p>
                    <p className="text-slate-500">Scegli un referente dal menu a tendina per visualizzare le analytics del team</p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="shadow-lg border-l-4 border-red-500">
              <CardContent className="p-12 text-center">
                <ShieldCheck className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <p className="text-xl font-semibold text-slate-700 mb-2">Accesso Limitato</p>
                <p className="text-slate-500">Solo gli amministratori possono visualizzare le analytics dei referenti</p>
              </CardContent>
            </Card>
          )}
          </TabsContent>
        )}

        
        {/* Pivot Analytics Tab */}
        <TabsContent value="pivot" className="space-y-6">
          {renderPivot()}
        </TabsContent>

        {/* Sub Agenzie Analytics Tab */}
        <TabsContent value="sub-agenzie" className="space-y-6">
          {renderSubAgenzie()}
        </TabsContent>

      </Tabs>
    </div>
  );
};

// Documents Management Component with Role-Based Access Control

export { ResponsabileCommessaAnalytics, AnalyticsManagement };
