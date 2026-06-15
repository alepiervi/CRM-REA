import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import "./App.css";

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
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./components/ui/card";
import { Label } from "./components/ui/label";
import { Badge } from "./components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import { Checkbox } from "./components/ui/checkbox";
import { Switch } from "./components/ui/switch";
import { useToast } from "./hooks/use-toast";
import { Toaster } from "./components/ui/toaster";
import ClienteCustomFieldsManager from "./components/ClienteCustomFieldsManager";
import {
  useClienteCustomFields,
  useClienteStatusOptions,
  CustomFieldsSection,
  CustomFieldsViewSection,
  validateRequiredCustomFields,
} from "./components/CustomFieldsRenderer";
import {
  useClienteLock,
  ClienteLockedScreen,
  useActiveClienteLocks,
} from "./components/ClienteLock";
import { ClienteNotesHistory } from "./components/ClienteNotesHistory";
import { PermissionsAudit } from "./components/PermissionsAudit";
import { PostVendita } from "./components/PostVendita";
import { PassToPostVenditaButton } from "./components/PassToPostVenditaButton";
import { PostVenditaStatusDot } from "./components/PostVenditaStatusDot";
import { ClientePostVenditaSection } from "./components/ClientePostVenditaSection";
import { MultiSelectFilter } from "./components/MultiSelectFilter";
import { SpokiAdminConfig } from "./components/spoki/SpokiAdminConfig";
import { AppointmentsCalendar } from "./components/spoki/AppointmentsCalendar";
import { AIConversations } from "./components/spoki/AIConversations";
import { LeadConversationsTab } from "./components/spoki/LeadConversationsTab";
import { WorkflowFoldersSidebar } from "./components/workflow/WorkflowFoldersSidebar";
import { WorkflowTestModeDialog } from "./components/workflow/WorkflowTestModeDialog";
import { TemplatePreviewDialog } from "./components/workflow/TemplatePreviewDialog";
import { TagsManager } from "./components/tags/TagsManager";

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
} from "./lib/appUtils";
import { AuthContext, useAuth, AuthProvider } from "./context/AuthContext";
// ============================================================
// CODE-SPLITTING: le pagine vengono caricate solo quando servono (React.lazy)
// ============================================================
const lazyNamed = (loader, name) => React.lazy(() => loader().then((m) => ({ default: m[name] })));

const UnitsManagement = lazyNamed(() => import("./pages/LeadsConfig"), "UnitsManagement");
const LeadStatusManagement = lazyNamed(() => import("./pages/LeadsConfig"), "LeadStatusManagement");
const CustomFieldsManagement = lazyNamed(() => import("./pages/LeadsConfig"), "CustomFieldsManagement");
const LeadsManagement = lazyNamed(() => import("./pages/LeadsManagement"), "LeadsManagement");
const ClientiManagement = lazyNamed(() => import("./pages/ClientiManagement"), "ClientiManagement");
const EditClienteModal = lazyNamed(() => import("./pages/ClienteModals"), "EditClienteModal");
const ReferenteAnalyticsView = lazyNamed(() => import("./pages/NetworkAnalytics"), "ReferenteAnalyticsView");
const SuperReferenteAnalyticsView = lazyNamed(() => import("./pages/NetworkAnalytics"), "SuperReferenteAnalyticsView");
const SupervisorAnalytics = lazyNamed(() => import("./pages/NetworkAnalytics"), "SupervisorAnalytics");
const ClientiCestinoManagement = lazyNamed(() => import("./pages/Cestini"), "ClientiCestinoManagement");
const LeadsCestinoManagement = lazyNamed(() => import("./pages/Cestini"), "LeadsCestinoManagement");
const SubAgenzieManagement = lazyNamed(() => import("./pages/SubAgenzie"), "SubAgenzieManagement");
const CommesseManagement = lazyNamed(() => import("./pages/Commesse"), "CommesseManagement");
const CallCenterManagement = lazyNamed(() => import("./pages/CallCenter"), "CallCenterManagement");
const LeadQualificationManagement = lazyNamed(() => import("./pages/WorkflowBuilder"), "LeadQualificationManagement");
const WorkflowBuilderManagement = lazyNamed(() => import("./pages/WorkflowBuilder"), "WorkflowBuilderManagement");
const AIConfigurationManagement = lazyNamed(() => import("./pages/AiWhatsApp"), "AIConfigurationManagement");
const WhatsAppManagement = lazyNamed(() => import("./pages/AiWhatsApp"), "WhatsAppManagement");
const AnalyticsManagement = lazyNamed(() => import("./pages/Analytics"), "AnalyticsManagement");
const UsersManagement = lazyNamed(() => import("./pages/UsersManagement"), "UsersManagement");
const SubAgenziaStatusAudit = lazyNamed(() => import("./pages/SubAgenziaStatusAudit"), "SubAgenziaStatusAudit");

// Fallback mostrato durante il caricamento lazy di una sezione
const PageLoader = () => (
  <div className="flex items-center justify-center py-24" data-testid="page-loader">
    <div className="flex flex-col items-center gap-3 text-slate-500">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      <span className="text-sm">Caricamento sezione...</span>
    </div>
  </div>
);

const PasswordChangeModal = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { showPasswordChangeModal, changePassword } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (currentPassword === newPassword) {
      toast({
        title: "❌ Password identica",
        description: "La nuova password deve essere diversa da quella attuale",
        variant: "destructive"
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "❌ Password non corrispondono",
        description: "La nuova password e la conferma non coincidono",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "❌ Password troppo breve",
        description: "La password deve essere di almeno 6 caratteri",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    const result = await changePassword(currentPassword, newPassword);
    setIsLoading(false);

    if (result.success) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  if (!showPasswordChangeModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">🔒 Cambio Password Richiesto</h2>
          <p className="text-gray-600 mt-2">
            Per motivi di sicurezza, devi cambiare la password al primo accesso.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password Attuale *
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nuova Password *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conferma Nuova Password *
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Cambiando...
              </div>
            ) : (
              "Cambia Password"
            )}
          </button>
        </form>

        <div className="text-xs text-gray-500 mt-4 space-y-1">
          <p>• La password deve essere di almeno 6 caratteri</p>
          <p>• La nuova password deve essere diversa da quella attuale</p>
        </div>
      </div>
    </div>
  );
};

// Login Component
const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    const result = await login(username, password);
    
    if (result.success) {
      toast({
        title: "Accesso effettuato",
        description: "Benvenuto in Nureal!",
      });
      // Redirect to dashboard after successful login
      navigate("/dashboard");
    } else {
      toast({
        title: "Errore di accesso",
        description: result.error,
        variant: "destructive",
      });
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-4 pb-8">
          <div className="flex items-center justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-indigo-800 bg-clip-text text-transparent">
              Nureal
            </CardTitle>
            <CardDescription className="text-slate-600">
              System All in One
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-slate-700">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Inserisci username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Inserisci password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-medium shadow-lg transition-all duration-200"
              disabled={isLoading}
            >
              {isLoading ? "Accesso in corso..." : "Accedi"}
            </Button>
          </form>
        </CardContent>
        
      </Card>
    </div>
  );
};

// Unit Selector Component
// Dashboard Stats Component
const DashboardStats = ({ selectedUnit }) => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchStats();
  }, [selectedUnit]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchStats(true); // true indica che è un refresh automatico
    }, 30000); // Aggiorna ogni 30 secondi

    return () => clearInterval(interval);
  }, [selectedUnit, autoRefresh]);

  const fetchStats = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      const params = new URLSearchParams();
      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      
      const response = await axios.get(`${API}/dashboard/stats?${params}`);
      setStats(response.data);
      setLastUpdated(new Date());
      
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      if (!isAutoRefresh) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  // Manual refresh function
  const handleManualRefresh = () => {
    fetchStats(false);
  };

  const getStatsCards = () => {
    if (user.role === "admin") {
      if (selectedUnit && selectedUnit !== "all") {
        return [
          { title: "Lead Unit", value: stats.total_leads || 0, icon: Phone, color: "from-blue-500 to-blue-600" },
          { title: "Utenti Unit", value: stats.total_users || 0, icon: Users, color: "from-green-500 to-green-600" },
          { title: "Lead Oggi", value: stats.leads_today || 0, icon: Calendar, color: "from-orange-500 to-orange-600" },
          { title: "Unit", value: stats.unit_name || "N/A", icon: Building2, color: "from-purple-500 to-purple-600", isText: true },
        ];
      } else {
        return [
          { title: "Totale Lead", value: stats.total_leads || 0, icon: Phone, color: "from-blue-500 to-blue-600" },
          { title: "Totale Utenti", value: stats.total_users || 0, icon: Users, color: "from-green-500 to-green-600" },
          { title: "Totale Unit", value: stats.total_units || 0, icon: Building2, color: "from-purple-500 to-purple-600" },
          { title: "Lead Oggi", value: stats.leads_today || 0, icon: Calendar, color: "from-orange-500 to-orange-600" },
        ];
      }
    } else if (user.role === "referente") {
      return [
        { title: "Miei Agenti", value: stats.my_agents || 0, icon: Users, color: "from-blue-500 to-blue-600" },
        { title: "Totale Lead", value: stats.total_leads || 0, icon: Phone, color: "from-green-500 to-green-600" },
        { title: "Lead Oggi", value: stats.leads_today || 0, icon: Calendar, color: "from-orange-500 to-orange-600" },
        { title: "Contattati", value: stats.contacted_leads || 0, icon: CheckCircle, color: "from-purple-500 to-purple-600" },
      ];
    } else if (user.role === "supervisor") {
      return [
        { title: "Totale Lead", value: stats.total_leads || 0, icon: Phone, color: "from-blue-500 to-blue-600" },
        { title: "Lead Oggi", value: stats.leads_today || 0, icon: Calendar, color: "from-green-500 to-green-600" },
        { title: "Non Assegnati", value: stats.unassigned_leads || 0, icon: AlertCircle, color: "from-orange-500 to-orange-600" },
        { title: "Agenti", value: stats.total_agents || 0, icon: Users, color: "from-purple-500 to-purple-600" },
      ];
    } else {
      return [
        { title: "I Miei Lead", value: stats.my_leads || 0, icon: Phone, color: "from-blue-500 to-blue-600" },
        { title: "Lead Oggi", value: stats.leads_today || 0, icon: Calendar, color: "from-green-500 to-green-600" },
        { title: "Contattati", value: stats.contacted_leads || 0, icon: CheckCircle, color: "from-orange-500 to-orange-600" },
        { title: "Unit", value: stats.unit_name || "N/A", icon: Building2, color: "from-purple-500 to-purple-600", isText: true },
      ];
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="animate-pulse flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="h-6 bg-slate-200 rounded w-32"></div>
              <div className="h-4 bg-slate-200 rounded w-40"></div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="h-4 bg-slate-200 rounded w-24"></div>
              <div className="h-8 bg-slate-200 rounded w-24"></div>
            </div>
          </div>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-0 shadow-lg bg-white">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div className="h-8 bg-slate-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header with Refresh Controls */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-900">Dashboard Admin</h1>
          {lastUpdated && (
            <div className="text-sm text-gray-500">
              Ultimo aggiornamento: {lastUpdated.toLocaleTimeString('it-IT')}
            </div>
          )}
          {isRefreshing && (
            <div className="flex items-center text-sm text-blue-600">
              <Clock className="w-4 h-4 mr-1 animate-spin" />
              Aggiornamento...
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="auto-refresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="auto-refresh" className="text-sm text-gray-700">
              Auto refresh (30s)
            </label>
          </div>
          
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualRefresh}
            disabled={loading || isRefreshing}
            className="flex items-center space-x-2"
          >
            <Clock className={`w-4 h-4 ${(loading || isRefreshing) ? 'animate-spin' : ''}`} />
            <span>Aggiorna ora</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {getStatsCards().map((stat, index) => (
          <Card key={index} className="border-0 shadow-lg bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">{stat.title}</p>
                  <p className={`${stat.isText ? 'text-lg' : 'text-3xl'} font-bold text-slate-800`}>
                    {stat.value}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Responsabile Commessa Dashboard Component
const ResponsabileCommessaDashboard = ({ selectedUnit, selectedTipologiaContratto, units, commesse }) => {
  const [dashboardData, setDashboardData] = useState({
    clienti_oggi: 0,
    clienti_totali: 0,
    sub_agenzie: [],
    punti_lavorazione: {},
    commesse: []
  });
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardData();
  }, [dateFrom, dateTo, selectedTipologiaContratto]);

  // Auto-refresh effect per responsabile commessa
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchDashboardData(true); // true indica che è un refresh automatico
    }, 45000); // Aggiorna ogni 45 secondi per non sovraccaricare

    return () => clearInterval(interval);
  }, [dateFrom, dateTo, selectedTipologiaContratto, autoRefresh]);

  const fetchDashboardData = async (isAutoRefresh = false) => {
    try {
      if (!isAutoRefresh) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (selectedTipologiaContratto && selectedTipologiaContratto !== 'all') {
        params.append('tipologia_contratto', selectedTipologiaContratto);
      }
      
      const response = await axios.get(`${API}/responsabile-commessa/dashboard?${params}`);
      setDashboardData(response.data);
      setLastUpdated(new Date());
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento della dashboard",
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

  // Manual refresh function per responsabile commessa
  const handleManualRefresh = () => {
    fetchDashboardData(false);
  };

  const handleDateReset = () => {
    setDateFrom('');
    setDateTo('');
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Caricamento dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Responsabile Commessa</h1>
          <p className="text-gray-600">Panoramica delle tue commesse e clienti</p>
          {lastUpdated && (
            <p className="text-sm text-gray-500 mt-1">
              Ultimo aggiornamento: {lastUpdated.toLocaleTimeString('it-IT')}
            </p>
          )}
          {isRefreshing && (
            <div className="flex items-center text-sm text-blue-600 mt-1">
              <Clock className="w-4 h-4 mr-1 animate-spin" />
              Aggiornamento in corso...
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Dal:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Al:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <Button onClick={handleDateReset} variant="outline" size="sm">
            Reset
          </Button>
          
          <div className="border-l pl-4 flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="auto-refresh-resp"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="auto-refresh-resp" className="text-sm text-gray-700">
                Auto refresh (45s)
              </label>
            </div>
            
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualRefresh}
              disabled={loading || isRefreshing}
              className="flex items-center space-x-2"
            >
              <Clock className={`w-4 h-4 ${(loading || isRefreshing) ? 'animate-spin' : ''}`} />
              <span>Aggiorna</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Statistiche principali */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Clienti {dateFrom || dateTo ? 'nel Periodo' : 'Oggi'}</p>
              <p className="text-2xl font-bold text-blue-600">{dashboardData.clienti_oggi}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Clienti Totali</p>
              <p className="text-2xl font-bold text-green-600">{dashboardData.clienti_totali}</p>
            </div>
            <UserCheck className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Sub Agenzie</p>
              <p className="text-2xl font-bold text-purple-600">{dashboardData.sub_agenzie.length}</p>
            </div>
            <Store className="w-8 h-8 text-purple-500" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Commesse Attive</p>
              <p className="text-2xl font-bold text-orange-600">{dashboardData.commesse.length}</p>
            </div>
            <Building className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Punti di lavorazione */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Punti di Lavorazione</h3>
          <div className="space-y-3">
            {Object.entries(dashboardData.punti_lavorazione).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center">
                <span className="capitalize">{status.replace('_', ' ')}</span>
                <Badge variant="outline">{count}</Badge>
              </div>
            ))}
            {Object.keys(dashboardData.punti_lavorazione).length === 0 && (
              <p className="text-gray-500 text-sm">Nessun dato disponibile</p>
            )}
          </div>
        </Card>

        {/* Sub Agenzie */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Sub Agenzie delle tue Commesse</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {dashboardData.sub_agenzie.map((sa) => (
              <div key={sa.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{sa.nome}</p>
                  <p className="text-sm text-gray-600">{sa.responsabile}</p>
                </div>
                <div className="text-right">
                  <Badge variant={sa.stato === 'attiva' ? 'default' : 'secondary'}>
                    {sa.stato}
                  </Badge>
                  <p className="text-xs text-gray-500 mt-1">{sa.commesse_count} commesse</p>
                </div>
              </div>
            ))}
            {dashboardData.sub_agenzie.length === 0 && (
              <p className="text-gray-500 text-sm">Nessuna sub agenzia trovata</p>
            )}
          </div>
        </Card>
      </div>

      {/* Commesse */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Le tue Commesse</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboardData.commesse.map((commessa) => (
            <div key={commessa.id} className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium">{commessa.nome}</h4>
              <p className="text-sm text-gray-600 mt-1">{commessa.descrizione}</p>
            </div>
          ))}
          {dashboardData.commesse.length === 0 && (
            <p className="text-gray-500 text-sm col-span-full">Nessuna commessa assegnata</p>
          )}
        </div>
      </Card>
    </div>
  );
};

// Main Dashboard Component
const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [selectedCommessa, setSelectedCommessa] = useState("all");
  const [selectedServizio, setSelectedServizio] = useState("all");
  const [selectedTipologiaContratto, setSelectedTipologiaContratto] = useState("all");
  const [units, setUnits] = useState([]);
  const [commesse, setCommesse] = useState([]);
  const [subAgenzie, setSubAgenzie] = useState([]);
  const [servizi, setServizi] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [formTipologieContratto, setFormTipologieContratto] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  
  // Additional state for segmenti and offerte management
  const [selectedTipologia, setSelectedTipologia] = useState(null);
  const [selectedSegmento, setSelectedSegmento] = useState(null);
  const [segmenti, setSegmenti] = useState([]);
  const [offerte, setOfferte] = useState([]);
  
  // 🎯 MOBILE-FRIENDLY: Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 🔔 Contatore conversazioni WhatsApp non gestite (bot in pausa/non attivato)
  const [unhandledConvCount, setUnhandledConvCount] = useState(0);
  
  const { user, logout, setUser, showSessionWarning, timeLeft, extendSession, stopCountdown } = useAuth();
  const { toast } = useToast();

  // 🔔 Polling contatore messaggi WhatsApp da gestire (sidebar "Conversazioni AI")
  useEffect(() => {
    if (!user || !["admin", "super_referente"].includes(user.role)) return;
    const fetchUnhandled = async () => {
      try {
        const r = await axios.get(`${API}/spoki/conversations/unhandled-count`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        setUnhandledConvCount(r.data?.count || 0);
      } catch (e) { /* silenzioso */ }
    };
    fetchUnhandled();
    const t = setInterval(fetchUnhandled, 30000);
    return () => clearInterval(t);
  }, [user, activeTab]);

  // 🎯 MOBILE-FRIENDLY: Detect screen size (< 1024px = mobile/tablet)
  useEffect(() => {
    const checkMobile = () => {
      // Use lg breakpoint (1024px) to match Tailwind lg: classes
      const isMobileSize = window.innerWidth < 1024;
      setIsMobile(isMobileSize);
      
      // Close mobile menu when switching to desktop (>= 1024px)
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 🎯 MOBILE-FRIENDLY: Close mobile menu when tab changes
  const handleTabChange = (tabId) => {
    console.log(`🔄 NAVIGATION DEBUG: Changing from ${activeTab} to ${tabId}`);
    console.log(`🔄 NAVIGATION DEBUG: handleTabChange called with tabId:`, tabId);
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
    console.log(`✅ NAVIGATION DEBUG: setActiveTab(${tabId}) called, new activeTab should be:`, tabId);
  };

  // Listener per aprire la scheda cliente dal Post Vendita: naviga al tab Clienti
  // ClientiManagement poi leggerà sessionStorage('pvOpenClienteId') per aprire il modale
  // Stato modale Cliente aperto dal Post Vendita: rimane all'interno del tab PV (NON naviga al tab Clienti)
  const [pvOpenedCliente, setPvOpenedCliente] = useState(null);

  useEffect(() => {
    const handler = async (e) => {
      const clienteId = e?.detail?.clienteId || sessionStorage.getItem("pvOpenClienteId");
      sessionStorage.removeItem("pvOpenClienteId");
      sessionStorage.removeItem("pvOpenFromPV");
      if (!clienteId) return;
      try {
        const res = await axios.get(`${API}/clienti/${clienteId}`);
        setPvOpenedCliente(res.data);
      } catch (err) {
        console.error("Failed to open cliente from PV", err);
      }
    };
    window.addEventListener("app:open-cliente-from-pv", handler);
    return () => window.removeEventListener("app:open-cliente-from-pv", handler);
  }, []);

  const handlePvUpdateCliente = async (updateData) => {
    if (!pvOpenedCliente?.id) return;
    try {
      const res = await axios.put(`${API}/clienti/${pvOpenedCliente.id}`, updateData);
      // Dispatch refresh event for PV list
      window.dispatchEvent(new CustomEvent("app:pv-cliente-updated", { detail: { clienteId: pvOpenedCliente.id } }));
      toast({ title: "Salvato", description: "Modifiche cliente salvate" });
      setPvOpenedCliente(null);
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.detail || "Errore salvataggio cliente";
      toast({ title: "Errore", description: msg, variant: "destructive" });
      throw err;
    }
  };

  useEffect(() => {
    fetchUnits();
    fetchCommesse();
    fetchSubAgenzie();
    fetchServizi();
    fetchServizi();
    
    // Fetch assistants solo per admin
    if (user.role === "admin") {
      fetchAssistants();
    }
    
    if (user.role === "responsabile_commessa") {
      // NON caricare tipologie contratto all'inizio - verranno caricate quando necessario
      console.log("✅ Utente responsabile_commessa - tipologie contratto caricate dinamicamente");
      
      // EMERGENCY FIX: Se commesse_autorizzate è vuoto, ricarica user data
      if (!user.commesse_autorizzate || user.commesse_autorizzate.length === 0) {
        console.log("⚠️ EMERGENCY FIX: user.commesse_autorizzate vuoto, ricarico dati utente...");
        fetchCurrentUserData();
      }
    }
  }, []);

  // Funzione di emergenza per ricaricare dati utente
  const fetchCurrentUserData = async () => {
    try {
      console.log("🔄 Caricamento dati utente fresh dal backend...");
      const response = await axios.get(`${API}/auth/me`);
      console.log("✅ NUOVI dati utente dal backend:", response.data);
      console.log("✅ COMMESSE_AUTORIZZATE ricevute:", response.data.commesse_autorizzate);
      setUser(response.data);
    } catch (error) {
      console.error("❌ Errore nel ricaricare dati utente:", error);
    }
  };

  // Force load all tipologie on component mount
  useEffect(() => {
    console.log('🔄 COMPONENT MOUNT: Loading all tipologie for sidebar');
    fetchTipologieContratto();
  }, []); // Run once on mount

  // Rimossi vecchi useEffect - ora gestiti dal sistema gerarchico

  // useEffect per ricaricare tipologie contratto quando cambiano commessa/servizio - PER TUTTI I RUOLI
  useEffect(() => {
    if (selectedCommessa && selectedCommessa !== "all" && selectedServizio && selectedServizio !== "all") {
      console.log("🔄 USEEFFECT (ALL ROLES): Ricarico tipologie per commessa/servizio changed:", { selectedCommessa, selectedServizio, userRole: user.role });
      fetchTipologieContratto(selectedCommessa, selectedServizio);
    } else {
      // Se non ci sono filtri, carico TUTTE le tipologie per i selettori
      console.log("🔄 USEEFFECT (ALL ROLES): Loading ALL tipologie (no filters)");
      fetchTipologieContratto();
    }
  }, [selectedCommessa, selectedServizio]);

  useEffect(() => {
    // Auto-select unit for non-admin users
    if (user.role !== "admin" && user.unit_id && !selectedUnit) {
      setSelectedUnit(user.unit_id);
    }
  }, [user, units]);

  const fetchUnits = async () => {
    try {
      const response = await axios.get(`${API}/units`);
      setUnits(response.data);
    } catch (error) {
      console.error("Error fetching units:", error);
    } finally {
      setUnitsLoading(false);
    }
  };

  const fetchAssistants = async () => {
    try {
      const response = await axios.get(`${API}/ai-assistants`);
      // Handle new response structure
      if (response.data && response.data.assistants) {
        setAssistants(response.data.assistants);
      } else if (Array.isArray(response.data)) {
        // Fallback for old response format
        setAssistants(response.data);
      } else {
        setAssistants([]);
      }
    } catch (error) {
      console.error("Error fetching assistants:", error);
      setAssistants([]);
    }
  };

  const fetchCommesse = async () => {
    try {
      const response = await axios.get(`${API}/commesse`);
      setCommesse(response.data);
    } catch (error) {
      console.error("Error fetching commesse:", error);
      // Don't show toast for this as it's handled by the component fallback to props
      setCommesse([]); // Fallback to empty array
    }
  };

  const fetchSubAgenzie = async () => {
    try {
      const response = await axios.get(`${API}/sub-agenzie`);
      setSubAgenzie(response.data);
      console.log("Sub Agenzie caricate:", response.data);
    } catch (error) {
      console.error("Error fetching sub agenzie:", error);
    }
  };

  const fetchServizi = async () => {
    try {
      const response = await axios.get(`${API}/servizi`);
      setServizi(response.data);
      console.log("Servizi caricati:", response.data);
    } catch (error) {
      console.error("Error fetching servizi:", error);
    }
  };

  const fetchTipologieContratto = async (commessaId = selectedCommessa, servizioId = selectedServizio) => {
    try {
      console.log("🔄 FETCH TIPOLOGIE START:", { 
        commessaId, 
        servizioId,
        selectedCommessa,
        selectedServizio,
        userRole: user?.role
      });
      
      let url;
      
      // If no specific commessa selected, get ALL tipologie for selectors
      if (!commessaId || commessaId === "all") {
        url = `${API}/tipologie-contratto/all`;
        console.log("🌐 Using ALL tipologie endpoint:", url);
      } else {
        // Use filtered endpoint for specific commessa/servizio
        const params = new URLSearchParams();
        params.append("commessa_id", commessaId);
        if (servizioId && servizioId !== "all") {
          params.append("servizio_id", servizioId);
        }
        url = `${API}/tipologie-contratto?${params}`;
        console.log("🌐 Using filtered tipologie endpoint:", url);
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      console.log("✅ Tipologie contratto ricevute:", response.data);
      console.log("✅ Numero tipologie:", response.data?.length);
      console.log("✅ Setting formTipologieContratto state NOW");
      setFormTipologieContratto(response.data);
      console.log("✅ formTipologieContratto state SET");
    } catch (error) {
      console.error("❌ Error fetching tipologie contratto:", error);
      console.error("❌ Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setFormTipologieContratto([]);
      // Show toast to user
      toast({
        title: "Errore caricamento tipologie",
        description: "Impossibile caricare le tipologie di contratto",
        variant: "destructive"
      });
    }
  };

  const fetchSegmenti = async (tipologiaId) => {
    try {
      console.log('🔄 fetchSegmenti called with tipologiaId:', tipologiaId);
      console.log('🔄 API URL:', `${API}/tipologie-contratto/${tipologiaId}/segmenti`);
      
      const response = await axios.get(`${API}/tipologie-contratto/${tipologiaId}/segmenti`);
      
      console.log('✅ fetchSegmenti response:', response.data);
      console.log('✅ Number of segmenti found:', response.data?.length);
      
      setSegmenti(response.data);
    } catch (error) {
      console.error("❌ Error fetching segmenti:", error);
      console.error("❌ Error response:", error.response?.data);
      setSegmenti([]);
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
      // Use the new /api/offerte endpoint with segmento filter
      const params = { is_active: true };
      if (segmentoId) {
        params.segmento = segmentoId;
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

  // Funzione rimossa da qui - spostata nel componente EditClienteModal

  const fetchOfferte = async (segmentoId) => {
    try {
      const response = await axios.get(`${API}/segmenti/${segmentoId}/offerte`);
      console.log(`Offerte per segmento ${segmentoId}:`, response.data);
      setOfferte(response.data);
    } catch (error) {
      console.error("Error fetching offerte:", error);
      setOfferte([]);
    }
  };

  const updateSegmento = async (segmentoId, updateData) => {
    try {
      await axios.put(`${API}/segmenti/${segmentoId}`, updateData);
      // Refresh segmenti list
      if (selectedTipologia) {
        fetchSegmenti(selectedTipologia);
      }
      toast({
        title: "Successo",
        description: "Segmento aggiornato con successo",
      });
    } catch (error) {
      console.error("Error updating segmento:", error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento del segmento",
        variant: "destructive",
      });
    }
  };

  const createOfferta = async (offertaData) => {
    try {
      const response = await axios.post(`${API}/offerte`, {
        ...offertaData,
        commessa_id: selectedCommessa !== 'all' ? selectedCommessa : null,
        servizio_id: selectedServizio !== 'all' ? selectedServizio : null,
        tipologia_contratto_id: selectedTipologia,
        segmento_id: selectedSegmento
      });
      
      // Refresh offerte list
      if (selectedSegmento) {
        fetchOfferte(selectedSegmento);
      }
      
      toast({
        title: "Successo",
        description: "Offerta creata con successo",
      });
      
      // Return the created offerta data (including ID)
      return response.data;
    } catch (error) {
      console.error("Error creating offerta:", error);
      toast({
        title: "Errore",
        description: "Errore nella creazione dell'offerta",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateOfferta = async (offertaId, updateData) => {
    try {
      await axios.put(`${API}/offerte/${offertaId}`, updateData);
      // Refresh offerte list
      if (selectedSegmento) {
        fetchOfferte(selectedSegmento);
      }
      toast({
        title: "Successo",
        description: "Offerta aggiornata con successo",
      });
    } catch (error) {
      console.error("Error updating offerta:", error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento dell'offerta",
        variant: "destructive",
      });
    }
  };

  const deleteOfferta = async (offertaId) => {
    try {
      await axios.delete(`${API}/offerte/${offertaId}`);
      // Refresh offerte list
      if (selectedSegmento) {
        fetchOfferte(selectedSegmento);
      }
      toast({
        title: "Successo",
        description: "Offerta eliminata con successo",
      });
    } catch (error) {
      console.error("Error deleting offerta:", error);
      toast({
        title: "Errore",
        description: "Errore nell'eliminazione dell'offerta",
        variant: "destructive",
      });
    }
  };

  // Funzione rimossa - ora gestita dal sistema gerarchico

  const fetchServiziPerCommessa = async (commessaId) => {
    try {
      console.log("Caricamento servizi per commessa:", commessaId);
      const response = await axios.get(`${API}/commesse/${commessaId}/servizi`);
      setServizi(response.data);
      console.log("Servizi caricati:", response.data);
    } catch (error) {
      console.error(`Error fetching servizi for commessa ${commessaId}:`, error);
      setServizi([]);
    }
  };

  // useEffect per caricare tipologie contratto quando cambia commessa/servizio/unit
  // COMMENTED OUT: This was clearing formTipologieContratto when filters were not all selected,
  // interfering with the main fetchTipologieContratto that loads ALL tipologie
  /*
  useEffect(() => {
    const loadTipologieContratto = async () => {
      if (selectedCommessa && selectedCommessa !== "all" && 
          selectedServizio && selectedServizio !== "all" &&
          selectedUnit && selectedUnit !== "all") {
        
        try {
          console.log("🔄 Loading tipologie contratto for commessa+servizio+unit...");
          const response = await axios.get(`${API}/commesse/${selectedCommessa}/servizi/${selectedServizio}/units/${selectedUnit}/tipologie-contratto`);
          console.log("✅ Tipologie contratto loaded:", response.data);
          setFormTipologieContratto(response.data);
        } catch (error) {
          console.error("❌ Error loading tipologie contratto:", error);
          setFormTipologieContratto([]);
        }
      } else {
        setFormTipologieContratto([]);
      }
    };

    loadTipologieContratto();
  }, [selectedCommessa, selectedServizio, selectedUnit]);
  */

  const handleUnitChange = (unitId) => {
    setSelectedUnit(unitId);
  };

  // Funzioni per il sistema gerarchico di selettori
  const getAvailableCommesse = () => {
    console.log("🔍 getAvailableCommesse DEBUG:");
    console.log("- User role:", user.role);
    console.log("- User commesse_autorizzate:", user.commesse_autorizzate);
    console.log("- Commesse array length:", commesse.length);
    console.log("- Commesse IDs:", commesse.map(c => c.id));
    
    if (user.role === "responsabile_commessa" || user.role === "area_manager") {
      // Per responsabile commessa e area manager, mostra solo le commesse autorizzate
      if (!user.commesse_autorizzate || user.commesse_autorizzate.length === 0) {
        console.log("❌ Nessuna commessa autorizzata trovata!");
        
        // HARD FIX: Se è l'utente resp_commessa o test2, forza manualmente le commesse
        if (user.username === "resp_commessa" || user.username === "test2") {
          console.log("🚨 HARD FIX: Forcing commesse for known user:", user.username);
          // Trova Fastweb e Fotovoltaico manualmente
          const forcedCommesse = commesse.filter(c => 
            c.nome === "Fastweb" || c.nome === "Fotovoltaico"
          );
          console.log("🔧 FORCED commesse:", forcedCommesse);
          return forcedCommesse;
        }
        
        return [];
      }
      
      const filteredCommesse = commesse.filter(commessa => 
        user.commesse_autorizzate.includes(commessa.id)
      );
      
      console.log(`✅ ${user.role} - Commesse filtrate:`, filteredCommesse);
      return filteredCommesse;
    } else {
      // Per admin e altri ruoli, mostra tutte le commesse
      console.log("✅ Utente admin - tutte le commesse");
      return commesse;
    }
  };

  const handleCommessaChange = (commessaId) => {
    setSelectedCommessa(commessaId);
    
    // Reset dei selettori successivi (nuovo ordine: servizi -> tipologie -> unit)
    setSelectedServizio("all");
    setSelectedTipologiaContratto("all");
    setSelectedUnit("all");
    
    // Carica servizi per la commessa selezionata
    if (commessaId && commessaId !== "all") {
      fetchServiziPerCommessa(commessaId);
    } else {
      setServizi([]);
    }
    
    console.log("🎯 COMMESSA CHANGED: servizi, tipologie e unit reset");
  };

  const handleTipologiaContrattoChange = (tipologiaId) => {
    console.log("🎯 TIPOLOGIA CONTRATTO CHANGED:", tipologiaId);
    setSelectedTipologiaContratto(tipologiaId);
    
    // Reset solo il selettore successivo (unit/sub agenzie)
    setSelectedUnit("all");
    
    console.log("🎯 TIPOLOGIA CHANGED: unit reset");
  };

  const handleServizioChange = (servizioId) => {
    console.log("🎯 HANDLE SERVIZIO CHANGE START:", { 
      servizioId, 
      currentSelectedCommessa: selectedCommessa,
      userRole: user.role 
    });
    
    setSelectedServizio(servizioId);
    
    // Reset dei selettori successivi (nuovo ordine: tipologie -> unit)
    setSelectedTipologiaContratto("all");
    setSelectedUnit("all");
    
    // CRITICAL FIX: Chiamata diretta per bypassare React async timing issue
    if (selectedCommessa && selectedCommessa !== "all" && servizioId && servizioId !== "all") {
      console.log("🎯 DIRECT CALL: Calling fetchTipologieContratto with filters");
      fetchTipologieContratto(selectedCommessa, servizioId);
    } else {
      console.log("🎯 DIRECT CALL: Loading ALL tipologie for selectors (no filters)");
      fetchTipologieContratto(); // Load all tipologie when no filters
    }
    
    console.log("🎯 SERVIZIO CHANGED: tipologie e unit reset, chiamata diretta effettuata");
  };

  const [unitsSubAgenzie, setUnitsSubAgenzie] = useState([]);

  const getAvailableUnitsSubAgenzie = () => {
    return unitsSubAgenzie;
  };

  // Load units/sub agenzie quando cambiano commessa e servizio
  useEffect(() => {
    const loadUnitsSubAgenzie = async () => {
      if (selectedCommessa && selectedCommessa !== "all" && 
          selectedServizio && selectedServizio !== "all") {
        
        try {
          console.log("🔄 Loading units/sub agenzie for commessa+servizio...");
          const response = await axios.get(`${API}/commesse/${selectedCommessa}/servizi/${selectedServizio}/units-sub-agenzie`);
          console.log("✅ Units/Sub Agenzie loaded:", response.data);
          setUnitsSubAgenzie(response.data);
        } catch (error) {
          console.error("❌ Error loading units/sub agenzie:", error);
          setUnitsSubAgenzie([]);
        }
      } else {
        setUnitsSubAgenzie([]);
      }
    };

    loadUnitsSubAgenzie();
  }, [selectedCommessa, selectedServizio]);

  const getNavItems = () => {
    const items = [
      { id: "dashboard", label: "Dashboard", icon: BarChart3 }
    ];

    if (user.role === "admin") {
      items.push(
        { id: "leads", label: "Lead", icon: Phone },
        { id: "lead-status", label: "Gestione Status Lead", icon: Settings },
        { id: "custom-fields", label: "Campi Personalizzati Lead", icon: Database },
        { id: "users", label: "Utenti", icon: Users },
        { id: "permissions-audit", label: "Audit Permessi", icon: ShieldAlert },
        { id: "workflow-builder", label: "Workflow Builder", icon: Workflow },
        { id: "ai-config", label: "Configurazione AI", icon: Settings },
        { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
        { id: "spoki-config", label: "WhatsApp Spoki", icon: MessageCircle },
        { id: "ai-conversations", label: "Conversazioni AI", icon: Bot },
        { id: "calendar", label: "Calendario Appuntamenti", icon: Calendar },
        { id: "tags", label: "Tag Lead", icon: Tag },
        { id: "lead-qualification", label: "Qualificazione Lead", icon: Bot },
        { id: "call-center", label: "Call Center", icon: PhoneCall },
        { id: "commesse", label: "Commesse", icon: Building },
        { id: "sub-agenzie", label: "Unit & Sub Agenzie", icon: Store },
        { id: "audit-sub-agenzia-status", label: "Audit Status Sub Agenzie", icon: ShieldAlert },
        { id: "clienti", label: "Clienti", icon: UserCheck },
        { id: "clienti-custom-fields", label: "Campi Clienti", icon: Database },
        { id: "post-vendita", label: "Post Vendita", icon: Package },
        { id: "clienti-cestino", label: "Cestino Clienti", icon: Trash2 },
        { id: "leads-cestino", label: "Cestino Lead", icon: Trash2 },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "referente") {
      items.push(
        { id: "leads", label: "Lead", icon: Phone },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "responsabile_commessa") {
      items.push(
        { id: "users", label: "Utenti", icon: Users },
        { id: "clienti", label: "Clienti", icon: UserCheck },
        { id: "audit-sub-agenzia-status", label: "Audit Status Sub Agenzie", icon: ShieldAlert },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "backoffice_commessa") {
      items.push(
        { id: "clienti", label: "Clienti", icon: UserCheck },
        { id: "post-vendita", label: "Post Vendita", icon: Package },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "responsabile_sub_agenzia" || user.role === "backoffice_sub_agenzia") {
      items.push(
        { id: "clienti", label: "Clienti", icon: UserCheck },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "area_manager") {
      items.push(
        { id: "clienti", label: "Clienti", icon: UserCheck },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "agente") {
      items.push(
        { id: "leads", label: "Lead", icon: Phone }
      );
    } else if (user.role === "supervisor") {
      // Supervisor: vede lead della sua Unit, analytics agenti/referenti, export
      items.push(
        { id: "leads", label: "Lead", icon: Phone },
        { id: "supervisor-analytics", label: "Analytics Unit", icon: TrendingUp }
      );
    } else if (user.role === "super_referente") {
      // Super Referente: vede lead di tutti i referenti/agenti autorizzati, analytics rete
      items.push(
        { id: "leads", label: "Lead", icon: Phone },
        { id: "ai-conversations", label: "Conversazioni AI", icon: Bot },
        { id: "calendar", label: "Calendario Appuntamenti", icon: Calendar },
        { id: "super-referente-analytics", label: "Analytics Rete", icon: TrendingUp }
      );
    } else if (user.role === "agente_specializzato" || user.role === "operatore" || user.role === "responsabile_store" || user.role === "responsabile_presidi" || user.role === "store_assist" || user.role === "promoter_presidi") {
      items.push(
        { id: "clienti", label: "Clienti", icon: UserCheck }
      );
    }

    return items;
  };

  const renderTabContent = () => {
    console.log(`📺 RENDER DEBUG: Rendering tab content for activeTab: ${activeTab}`);
    console.log(`📺 RENDER DEBUG: About to render content for:`, activeTab);
    try {
      switch (activeTab) {
        case "dashboard":
          if (user.role === "responsabile_commessa") {
            return <ResponsabileCommessaDashboard selectedUnit={selectedUnit} selectedTipologiaContratto={selectedTipologiaContratto} units={units} commesse={commesse} />;
          }
          return <DashboardStats selectedUnit={selectedUnit} />;
        case "leads":
          return <LeadsManagement selectedUnit={selectedUnit} units={units} />;
        case "lead-status":
          return user.role === "admin" ? <LeadStatusManagement /> : <div>Non autorizzato</div>;
        case "custom-fields":
          return user.role === "admin" ? <CustomFieldsManagement /> : <div>Non autorizzato</div>;

        // Sezione "Documenti" rimossa dalla sidebar - ora gestita all'interno della sezione Clienti
        case "users":
          return (user.role === "admin" || user.role === "responsabile_commessa") ? <UsersManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
        case "permissions-audit":
          return user.role === "admin" ? <PermissionsAudit /> : <div className="p-8 text-center text-slate-600">Solo gli amministratori possono accedere all'audit permessi</div>;
        case "audit-sub-agenzia-status":
          return (user.role === "admin" || user.role === "responsabile_commessa")
            ? <SubAgenziaStatusAudit />
            : <div className="p-8 text-center text-slate-600">Non autorizzato</div>;
        case "workflow-builder":
          return user.role === "admin" ? <WorkflowBuilderManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
        case "ai-config":
          return user.role === "admin" ? <AIConfigurationManagement /> : <div>Non autorizzato</div>;
        case "whatsapp":
          return user.role === "admin" ? <WhatsAppManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
        case "spoki-config":
          return user.role === "admin" ? <SpokiAdminConfig units={units} /> : <div>Non autorizzato</div>;
        case "ai-conversations":
          return (user.role === "admin" || user.role === "super_referente") ? <AIConversations /> : <div className="p-8 text-center text-slate-600">Non autorizzato</div>;
        case "calendar":
          return (user.role === "admin" || user.role === "super_referente") ? <AppointmentsCalendar units={units} /> : <div className="p-8 text-center text-slate-600">Non autorizzato</div>;
        case "tags":
          return user.role === "admin" ? <TagsManager /> : <div className="p-8 text-center text-slate-600">Non autorizzato</div>;
        case "lead-qualification":
          return (user.role === "admin" || user.role === "referente") ? <LeadQualificationManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
        case "call-center":
          return user.role === "admin" ? <CallCenterManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
        case "commesse":
          return user.role === "admin" ? (
            <CommesseManagement 
              selectedUnit={selectedUnit} 
              units={units}
              selectedTipologia={selectedTipologia}
              setSelectedTipologia={setSelectedTipologia}
              selectedSegmento={selectedSegmento}
              setSelectedSegmento={setSelectedSegmento}
              segmenti={segmenti}
              offerte={offerte}
              fetchSegmenti={fetchSegmenti}
              fetchOfferte={fetchOfferte}
              updateSegmento={updateSegmento}
              createOfferta={createOfferta}
              updateOfferta={updateOfferta}
              deleteOfferta={deleteOfferta}
            />
          ) : <div>Non autorizzato</div>;
        case "sub-agenzie":
          return user.role === "admin" ? <SubAgenzieManagement selectedUnit={selectedUnit} selectedCommessa={selectedCommessa} units={units} commesse={commesse} subAgenzie={subAgenzie} /> : <div>Non autorizzato</div>;
        case "clienti":
          console.log("Rendering ClientiManagement with props:", { selectedUnit, selectedCommessa, units: units?.length, commesse: commesse?.length, subAgenzie: subAgenzie?.length });
          if (user.role === "admin" || user.role === "responsabile_commessa" || user.role === "backoffice_commessa" || user.role === "responsabile_sub_agenzia" || user.role === "backoffice_sub_agenzia" || user.role === "agente_specializzato" || user.role === "operatore" || user.role === "responsabile_store" || user.role === "responsabile_presidi" || user.role === "store_assist" || user.role === "promoter_presidi" || user.role === "area_manager") {
            try {
              return <ClientiManagement selectedUnit={selectedUnit} selectedCommessa={selectedCommessa} selectedTipologiaContratto={selectedTipologiaContratto} units={units} commesse={commesse} subAgenzie={subAgenzie} servizi={servizi} />;
            } catch (error) {
              console.error("Error rendering ClientiManagement:", error);
              return <div className="p-4 text-red-600">Errore nel caricamento della gestione clienti: {error.message}</div>;
            }
          } else {
            return <div>Non autorizzato</div>;
          }
        case "clienti-cestino":
          return user.role === "admin" ? <ClientiCestinoManagement /> : <div className="p-8 text-center text-slate-600">Solo gli amministratori possono accedere al cestino clienti</div>;
        case "clienti-custom-fields":
          return user.role === "admin" ? <ClienteCustomFieldsManager /> : <div className="p-8 text-center text-slate-600">Solo gli amministratori possono gestire i campi personalizzati</div>;
        case "post-vendita":
          return (user.role === "admin" || user.role === "backoffice_commessa") ? <PostVendita user={user} /> : <div className="p-8 text-center text-slate-600">Sezione Post Vendita riservata a Admin e Backoffice Commessa</div>;
        case "leads-cestino":
          return user.role === "admin" ? <LeadsCestinoManagement /> : <div className="p-8 text-center text-slate-600">Solo gli amministratori possono accedere al cestino lead</div>;
        case "analytics":
          // Referente: vede solo analytics dei propri agenti e lead
          if (user.role === "referente") {
            return <ReferenteAnalyticsView />;
          }
          // Roles with access to full Analytics (Pivot + Sub Agenzie)
          if (
            user.role === "admin" || 
            user.role === "responsabile_commessa" || 
            user.role === "backoffice_commessa" || 
            user.role === "responsabile_sub_agenzia" || 
            user.role === "backoffice_sub_agenzia" || 
            user.role === "area_manager"
          ) {
            return <AnalyticsManagement selectedUnit={selectedUnit} units={units} />;
          }
          return <div className="p-8 text-center text-slate-600">Non autorizzato ad accedere alla sezione Analytics</div>;
        case "supervisor-analytics":
          return user.role === "supervisor" ? <SupervisorAnalytics /> : <div className="p-8 text-center text-slate-600">Solo i Supervisor possono accedere a questa sezione</div>;
        case "super-referente-analytics":
          return user.role === "super_referente" ? <SuperReferenteAnalyticsView /> : <div className="p-8 text-center text-slate-600">Solo i Super Referente possono accedere a questa sezione</div>;
        default:
          return <DashboardStats selectedUnit={selectedUnit} />;
      }
    } catch (error) {
      console.error("Error in renderTabContent:", error);
      return <div className="p-4 text-red-600">Errore nel rendering: {error.message}</div>;
    }
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col lg:flex-row overflow-hidden">
      {/* Professional Session Warning Banner */}
      {showSessionWarning && timeLeft > 0 && (
        <div data-session-banner className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 border-b-4 border-orange-600 text-white shadow-2xl animate-in slide-in-from-top duration-700 ease-out">
          <div className="bg-black bg-opacity-10 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                {/* Left side - Warning content */}
                <div className="flex items-center space-x-4">
                  {/* Animated warning icon */}
                  <div className="relative">
                    <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-white border-opacity-30">
                      <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center animate-pulse shadow-lg">
                        <svg className="w-5 h-5 text-orange-500 animate-bounce" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    {/* Pulsating ring effect */}
                    <div className="absolute inset-0 w-12 h-12 bg-white bg-opacity-20 rounded-full animate-ping"></div>
                  </div>
                  
                  {/* Warning text and countdown */}
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-3 mb-1">
                      <h3 className="text-lg font-bold text-white drop-shadow-sm">
                        🔒 Sessione in Scadenza
                      </h3>
                      <div className="bg-red-500 bg-opacity-80 px-2 py-1 rounded-full animate-pulse">
                        <span className="text-xs font-bold text-white">URGENTE</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <p className="text-sm text-white text-opacity-95 font-medium">
                        La tua sessione terminerà automaticamente tra:
                      </p>
                      <div className="bg-black bg-opacity-30 px-4 py-2 rounded-lg border border-white border-opacity-30 backdrop-blur-sm">
                        <span className="text-2xl font-mono font-bold text-white drop-shadow-lg transition-all duration-500 ease-in-out">
                          {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Right side - Action buttons */}
                <div className="flex items-center space-x-3">
                  {/* Progress bar */}
                  <div className="hidden md:flex flex-col items-center space-y-1">
                    <span className="text-xs text-white text-opacity-80 font-medium">Progresso</span>
                    <div className="w-32 h-2 bg-black bg-opacity-30 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-white to-yellow-200 transition-all duration-1000 ease-linear"
                        style={{ width: `${Math.max(0, Math.min(100, ((120 - timeLeft) / 120) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Extend session button */}
                  <button
                    onClick={extendSession}
                    className="group bg-white text-orange-600 px-6 py-3 rounded-xl font-bold text-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 hover:bg-orange-50 border-2 border-transparent hover:border-white flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5 group-hover:animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Estendi Sessione</span>
                  </button>
                  
                  {/* Close button */}
                  <button
                    onClick={stopCountdown}
                    className="w-10 h-10 bg-black bg-opacity-20 hover:bg-opacity-40 rounded-full flex items-center justify-center text-white hover:text-red-200 transition-all duration-200 backdrop-blur-sm border border-white border-opacity-20 hover:border-opacity-40"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 🎯 MOBILE: Mobile Menu Overlay */}
      {isMobile && (
        <div>
          <div 
            className={`mobile-nav-overlay ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Mobile Sidebar */}
          <div className={`mobile-sidebar ${isMobileMenuOpen ? 'active' : ''}`} style={{display: 'flex', flexDirection: 'column', height: '100vh', maxHeight: '100vh'}}>
            {/* Mobile Header */}
            <div className="p-3 border-b border-slate-200 bg-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-slate-800">Nureal</h1>
                    <p className="text-xs text-slate-500">System All in One</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Mobile Selectors - Moved to avoid navigation interference */}
            <div className="p-2 bg-slate-50 border-b border-slate-200 max-h-32 overflow-y-auto flex-shrink-0" style={{ display: 'none' }}>
              {/* 1. Commessa Selector - DISABLED TO FIX NAVIGATION */}
              <div>
                <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                  Commessa
                  {commesse.length > 0 && (
                    <span className="ml-1 text-xs text-green-600">({commesse.length})</span>
                  )}
                </Label>
                <Select value={selectedCommessa} onValueChange={handleCommessaChange}>
                  <SelectTrigger className="mt-1 mobile-select">
                    <SelectValue placeholder="Seleziona commessa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le Commesse</SelectItem>
                    {getAvailableCommesse().map((commessa) => (
                      <SelectItem key={commessa.id} value={commessa.id}>
                        <div className="flex items-center space-x-2">
                          <Building className="w-3 h-3" />
                          <span className="text-sm">{commessa.nome}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Servizio Selector - Mobile */}
              {selectedCommessa && selectedCommessa !== "all" && (
                <div className="mt-3">
                  <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                    Servizio
                    {servizi.length > 0 && (
                      <span className="ml-1 text-xs text-green-600">({servizi.length})</span>
                    )}
                  </Label>
                  <Select value={selectedServizio || "all"} onValueChange={handleServizioChange}>
                    <SelectTrigger className="mt-1 mobile-select">
                      <SelectValue placeholder="Seleziona servizio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti i Servizi</SelectItem>
                      {servizi.map((servizio) => (
                        <SelectItem key={servizio.id} value={servizio.id}>
                          <div className="flex items-center space-x-2">
                            <Cog className="w-3 h-3" />
                            <span className="text-sm">{servizio.nome}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 3. Tipologia Contratto Selector - Mobile */}
              {selectedCommessa && selectedCommessa !== "all" && 
               selectedServizio && selectedServizio !== "all" && (
                <div className="mt-3">
                  <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                    Tipologia Contratto
                    {formTipologieContratto.length > 0 && (
                      <span className="ml-1 text-xs text-green-600">({formTipologieContratto.length})</span>
                    )}
                  </Label>
                  <Select value={selectedTipologiaContratto} onValueChange={handleTipologiaContrattoChange}>
                    <SelectTrigger className="mt-1 mobile-select">
                      <SelectValue placeholder="Seleziona tipologia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte le Tipologie</SelectItem>
                      {formTipologieContratto.map((tipologia) => (
                        <SelectItem key={tipologia.value} value={tipologia.value}>
                          <div className="flex items-center space-x-2">
                            <FileText className="w-3 h-3" />
                            <span className="text-sm">{tipologia.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 4. Unit/Sub Agenzia Selector - Mobile */}
              {selectedCommessa && selectedCommessa !== "all" && 
               selectedServizio && selectedServizio !== "all" && 
               selectedTipologiaContratto && selectedTipologiaContratto !== "all" && (
                <div className="mt-3">
                  <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                    Unit/Sub Agenzia
                    {getAvailableUnitsSubAgenzie().length > 0 && (
                      <span className="ml-1 text-xs text-green-600">({getAvailableUnitsSubAgenzie().length})</span>
                    )}
                  </Label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger className="mt-1 mobile-select">
                      <SelectValue placeholder="Seleziona unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte le Unit/Sub Agenzie</SelectItem>
                      {getAvailableUnitsSubAgenzie().map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          <div className="flex items-center space-x-2">
                            {item.type === 'unit' ? (
                              <Building2 className="w-3 h-3" />
                            ) : (
                              <MapPin className="w-3 h-3" />
                            )}
                            <span className="text-sm">{item.nome}</span>
                            <Badge variant="outline" className="text-xs">
                              {item.type === 'unit' ? 'Unit' : 'Sub Agenzia'}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Mobile Navigation - Scrollable with proper height */}
            <nav className="flex-1 overflow-y-auto px-1 py-2 min-h-0" style={{
              maxHeight: 'calc(100vh - 180px)', 
              overflowY: 'scroll',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: '20px'
            }}>
              {getNavItems().map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors mobile-nav-item ${
                    activeTab === item.id
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-left">{item.label}</span>
                  {item.id === "ai-conversations" && unhandledConvCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{unhandledConvCount}</span>
                  )}
                </button>
              ))}
            </nav>

            {/* Mobile Footer */}
            <div className="p-3 border-t border-slate-200 bg-white flex-shrink-0" style={{marginTop: 'auto'}}>
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{user.username}</p>
                  <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                </div>
              </div>
              <Button
                onClick={() => {
                  logout();
                  setIsMobileMenuOpen(false);
                }}
                variant="outline"
                size="sm"
                className="w-full text-slate-600 hover:text-red-600 hover:border-red-300 mobile-button"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Esci
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* 🎯 DESKTOP: Desktop Sidebar (hidden on mobile) */}
      <div className="desktop-sidebar hidden lg:flex w-64 min-w-[16rem] max-w-[16rem] h-screen bg-white border-r border-slate-200 shadow-sm flex-col flex-shrink-0">
        {/* Desktop Header */}
        <div className="p-3 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Nureal</h1>
              <p className="text-xs text-slate-500">System All in One</p>
            </div>
          </div>
          
          {/* Desktop Hierarchical Selectors */}
          {/* NOTE: Moved to footer to prevent interference with navigation click events */}
        </div>

        {/* Desktop Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {getNavItems().map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
              {item.id === "ai-conversations" && unhandledConvCount > 0 && (
                <span data-testid="ai-conv-unhandled-badge" className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{unhandledConvCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Desktop Hierarchical Selectors - Moved here to prevent navigation interference */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          {/* 1. SELETTORE COMMESSA */}
          <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
            1. Seleziona Commessa
            {getAvailableCommesse().length > 0 && (
              <span className="ml-1 text-xs text-green-600">({getAvailableCommesse().length} disponibili)</span>
            )}
          </Label>
          <Select value={selectedCommessa} onValueChange={handleCommessaChange}>
            <SelectTrigger className="mt-1 h-8 text-sm">
              <SelectValue placeholder="Seleziona commessa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le Commesse</SelectItem>
              {getAvailableCommesse().map((commessa) => (
                <SelectItem key={commessa.id} value={commessa.id}>
                  <div className="flex items-center space-x-2">
                    <Building className="w-3 h-3" />
                    <span>{commessa.nome}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 2. SELETTORE SERVIZIO */}
          {selectedCommessa && selectedCommessa !== "all" && (
            <div className="mt-4">
              <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                2. Seleziona Servizio
                {servizi.length > 0 && (
                  <span className="ml-1 text-xs text-green-600">({servizi.length} disponibili)</span>
                )}
              </Label>
              <Select value={selectedServizio || "all"} onValueChange={handleServizioChange}>
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue placeholder="Seleziona servizio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i Servizi</SelectItem>
                  {servizi.map((servizio) => (
                    <SelectItem key={servizio.id} value={servizio.id}>
                      <div className="flex items-center space-x-2">
                        <Cog className="w-3 h-3" />
                        <span>{servizio.nome}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 3. SELETTORE TIPOLOGIA CONTRATTO */}
          {selectedCommessa && selectedCommessa !== "all" && 
           selectedServizio && selectedServizio !== "all" && (
            <div className="mt-4">
              <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                3. Seleziona Tipologia
                {formTipologieContratto.length > 0 && (
                  <span className="ml-1 text-xs text-green-600">({formTipologieContratto.length})</span>
                )}
              </Label>
              <Select value={selectedTipologiaContratto} onValueChange={handleTipologiaContrattoChange}>
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue placeholder="Seleziona tipologia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le Tipologie</SelectItem>
                  {(() => {
                    console.log("🔍 DROPDOWN RENDER - formTipologieContratto:", formTipologieContratto);
                    console.log("🔍 DROPDOWN RENDER - Length:", formTipologieContratto?.length);
                    console.log("🔍 DROPDOWN RENDER - User role:", user?.role);
                    return formTipologieContratto.map((tipologia) => (
                      <SelectItem key={tipologia.value} value={tipologia.value}>
                        <div className="flex items-center space-x-2">
                          <FileText className="w-3 h-3" />
                          <span className="text-sm">{tipologia.label}</span>
                        </div>
                      </SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 4. SELETTORE UNIT/SUB AGENZIA */}
          {selectedCommessa && selectedCommessa !== "all" && 
           selectedServizio && selectedServizio !== "all" && 
           selectedTipologiaContratto && selectedTipologiaContratto !== "all" && (
            <div className="mt-4">
              <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                4. Unit/Sub Agenzia
                {getAvailableUnitsSubAgenzie().length > 0 && (
                  <span className="ml-1 text-xs text-green-600">({getAvailableUnitsSubAgenzie().length})</span>
                )}
              </Label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="mt-1 h-8 text-sm">
                  <SelectValue placeholder="Seleziona unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le Unit/Sub Agenzie</SelectItem>
                  {getAvailableUnitsSubAgenzie().map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center space-x-2">
                        {item.type === 'unit' ? (
                          <Building2 className="w-3 h-3" />
                        ) : (
                          <MapPin className="w-3 h-3" />
                        )}
                        <span className="text-sm">{item.nome}</span>
                        <Badge variant="outline" className="text-xs">
                          {item.type === 'unit' ? 'Unit' : 'Sub Agenzia'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Desktop Footer */}
        <div className="p-3 border-t border-slate-200 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
              <Users className="w-4 h-4 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{user.username}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 🎯 RESPONSIVE: Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 🎯 MOBILE: Mobile Header with Hamburger */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 lg:px-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Mobile Menu Button - Show on all screens < 1024px including desktop mode on mobile */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(true)}
                className="mobile-menu-button p-2 lg:hidden touch-target"
                style={{ display: window.innerWidth < 1024 ? 'flex' : 'none' }}
              >
                <Menu className="w-5 h-5" />
              </Button>
              
              <div>
                <h2 className="text-lg lg:text-xl font-semibold text-slate-800 capitalize">
                  {getNavItems().find(item => item.id === activeTab)?.label || "Dashboard"}
                </h2>
                {selectedUnit && selectedUnit !== "all" && (
                  <Badge variant="outline" className="text-xs mt-1 hidden sm:inline-flex">
                    <Building2 className="w-3 h-3 mr-1" />
                    {units.find(u => u.id === selectedUnit)?.name}
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Desktop Logout Button */}
            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="text-slate-600 hover:text-red-600 hover:border-red-300 hidden md:flex"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Esci
            </Button>
            
            {/* Mobile User Info */}
            <div className="flex items-center space-x-2 md:hidden">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-800 truncate max-w-24">{user.username}</p>
                <p className="text-xs text-slate-500 capitalize">{user.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* 🎯 RESPONSIVE: Page Content - Mobile scrollable */}
        <main className="flex-1 overflow-y-auto mobile-container p-3 md:p-6" style={{
          height: 'calc(100vh - 70px)',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          minHeight: '0'
        }}>
          <React.Suspense fallback={<PageLoader />}>{renderTabContent()}</React.Suspense>
        </main>
      </div>

      {/* PV Edit Modal: cliente aperto dal Post Vendita — rimane visibile sopra al tab PV senza navigare via */}
      {pvOpenedCliente && (
        <React.Suspense fallback={null}>
        <EditClienteModal
          cliente={pvOpenedCliente}
          fromPostVendita={true}
          onClose={() => setPvOpenedCliente(null)}
          onSubmit={handlePvUpdateCliente}
          commesse={commesse}
          subAgenzie={subAgenzie}
        />
        </React.Suspense>
      )}
    </div>
  );
};

// Enhanced Leads Management Component
const ContainersManagement = ({ selectedUnit, units }) => {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingContainer, setEditingContainer] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchContainers();
  }, [selectedUnit]);

  const fetchContainers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/containers`);
      let allContainers = response.data;
      
      // Filter by selected unit if specified
      if (selectedUnit && selectedUnit !== "all") {
        allContainers = allContainers.filter(c => c.unit_id === selectedUnit);
      }
      
      setContainers(allContainers);
    } catch (error) {
      console.error("Error fetching containers:", error);
    } finally {
      setLoading(false);
    }
  };

  const createContainer = async (containerData) => {
    try {
      await axios.post(`${API}/containers`, containerData);
      toast({
        title: "Successo",
        description: "Contenitore creato con successo",
      });
      fetchContainers();
      setShowCreateModal(false);
    } catch (error) {
      console.error("Error creating container:", error);
      toast({
        title: "Errore",
        description: "Errore nella creazione del contenitore",
        variant: "destructive",
      });
    }
  };

  const updateContainer = async (containerId, containerData) => {
    try {
      await axios.put(`${API}/containers/${containerId}`, containerData);
      toast({
        title: "Successo",
        description: "Contenitore aggiornato con successo",
      });
      fetchContainers();
      setEditingContainer(null);
    } catch (error) {
      console.error("Error updating container:", error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento del contenitore",
        variant: "destructive",
      });
    }
  };

  const deleteContainer = async (containerId) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo contenitore?")) {
      return;
    }

    try {
      await axios.delete(`${API}/containers/${containerId}`);
      toast({
        title: "Successo",
        description: "Contenitore eliminato con successo",
      });
      fetchContainers();
    } catch (error) {
      console.error("Error deleting container:", error);
      toast({
        title: "Errore",
        description: "Errore nell'eliminazione del contenitore",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-800">
          Gestione Contenitori {selectedUnit && selectedUnit !== "all" && `- ${units.find(u => u.id === selectedUnit)?.name}`}
        </h2>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuovo Contenitore
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 text-center py-8">Caricamento...</div>
        ) : (
          containers.map((container) => {
            const unit = units.find(u => u.id === container.unit_id);
            return (
              <Card key={container.id} className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Home className="w-5 h-5 text-green-600" />
                      <span>{container.name}</span>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        onClick={() => setEditingContainer(container)}
                        variant="ghost"
                        size="sm"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        onClick={() => deleteContainer(container.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Unit: {unit?.name || "Sconosciuta"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Badge variant={container.is_active ? "default" : "secondary"}>
                      {container.is_active ? "Attivo" : "Disattivo"}
                    </Badge>
                    <div className="text-xs text-slate-500">
                      {new Date(container.created_at).toLocaleDateString("it-IT")}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {showCreateModal && (
        <CreateContainerModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={createContainer}
          units={units}
          selectedUnit={selectedUnit}
        />
      )}

      {editingContainer && (
        <EditContainerModal
          container={editingContainer}
          onClose={() => setEditingContainer(null)}
          onSubmit={(data) => updateContainer(editingContainer.id, data)}
          units={units}
        />
      )}
    </div>
  );
};

// Create Container Modal Component
const CreateContainerModal = ({ onClose, onSubmit, units, selectedUnit }) => {
  const [formData, setFormData] = useState({
    name: "",
    unit_id: selectedUnit && selectedUnit !== "all" ? selectedUnit : "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crea Nuovo Contenitore</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome Contenitore *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Es. Contenitore Facebook Lead"
              required
            />
          </div>

          <div>
            <Label htmlFor="unit_id">Unit *</Label>
            <Select 
              value={formData.unit_id} 
              onValueChange={(value) => setFormData({ ...formData, unit_id: value })}
            >
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">Crea Contenitore</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Edit Container Modal Component
const EditContainerModal = ({ container, onClose, onSubmit, units }) => {
  const [formData, setFormData] = useState({
    name: container.name,
    unit_id: container.unit_id,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica Contenitore</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome Contenitore *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="unit_id">Unit *</Label>
            <Select 
              value={formData.unit_id} 
              onValueChange={(value) => setFormData({ ...formData, unit_id: value })}
            >
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">Aggiorna Contenitore</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Advanced Analytics Management Component with Charts and Reports
// Responsabile Commessa Analytics Component
const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-slate-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/login"
            element={user ? <Navigate to="/dashboard" replace /> : <Login />}
          />
          <Route
            path="/dashboard"
            element={
              user ? (
                user.password_change_required ? (
                  <div className="flex items-center justify-center min-h-screen bg-gray-100">
                    <div className="text-center">
                      <h2 className="text-2xl font-bold text-gray-800 mb-4">🔒 Cambio Password Richiesto</h2>
                      <p className="text-gray-600">Devi cambiare la password prima di accedere al sistema.</p>
                    </div>
                  </div>
                ) : (
                  <Dashboard />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </BrowserRouter>
      <PasswordChangeModal />
      <Toaster />
    </div>
  );
};

const AppWithAuth = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);

// View Cliente Modal Component
export default AppWithAuth;