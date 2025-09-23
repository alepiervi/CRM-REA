import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import { useToast } from "./hooks/use-toast";
import { Toaster } from "./components/ui/toaster";

// Lucide icons
import { 
  Users, 
  Building2, 
  Phone, 
  Mail, 
  Calendar, 
  BarChart3, 
  Settings, 
  LogOut, 
  Plus,
  UserPlus,
  Eye,
  Search,
  Download,
  MapPin,
  Home,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Menu,
  Power,
  PowerOff,
  ChevronDown,
  Edit,
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
  Users2,
  Settings2,
  FileUser,
  FileSpreadsheet,
  CheckCircle2,
  Progress
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext();

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Axios interceptor per gestire automaticamente i token scaduti
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
          // Token scaduto o non valido, forza logout
          logout();
        }
        return Promise.reject(error);
      }
    );

    // Cleanup dell'interceptor quando il componente viene smontato
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error("Error fetching user:", error);
      // Se il token è scaduto o non valido, rimuovi tutto e forza login
      if (error.response?.status === 401 || error.response?.status === 403) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      // Validazione input
      if (!username || !password) {
        return { 
          success: false, 
          error: "Username e password sono obbligatori" 
        };
      }

      const response = await axios.post(`${API}/auth/login`, {
        username,
        password,
      });
      
      const { access_token, user: userData } = response.data;
      
      // Validazione risposta
      if (!access_token || !userData) {
        return { 
          success: false, 
          error: "Risposta del server non valida" 
        };
      }
      
      setToken(access_token);
      setUser(userData);
      localStorage.setItem("token", access_token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
      
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      
      let errorMessage = "Errore durante il login";
      
      if (error.response) {
        // Errori dal server
        switch (error.response.status) {
          case 401:
            errorMessage = "Username o password non validi";
            break;
          case 403:
            errorMessage = "Account non autorizzato";
            break;
          case 500:
            errorMessage = "Errore interno del server";
            break;
          default:
            errorMessage = error.response.data?.detail || "Errore di autenticazione";
        }
      } else if (error.request) {
        // Errori di rete
        errorMessage = "Impossibile connettersi al server";
      }
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
  };

  const checkAuth = async () => {
    if (!token) return false;
    
    try {
      await axios.get(`${API}/auth/me`);
      return true;
    } catch (error) {
      logout();
      return false;
    }
  };

  return (
    <AuthContext.Provider 
      value={{ user, token, loading, login, logout, checkAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Login Component
const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    const result = await login(username, password);
    
    if (result.success) {
      toast({
        title: "Accesso effettuato",
        description: "Benvenuto nel CRM!",
      });
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
              CRM Lead Manager
            </CardTitle>
            <CardDescription className="text-slate-600">
              Sistema di gestione lead e smistamento
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
  const { user } = useAuth();

  useEffect(() => {
    fetchStats();
  }, [selectedUnit]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      
      const response = await axios.get(`${API}/dashboard/stats?${params}`);
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
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
        { title: "Unit", value: stats.unit_name || "N/A", icon: Building2, color: "from-purple-500 to-purple-600", isText: true },
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
  );
};

// Main Dashboard Component
const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [units, setUnits] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const { user, logout } = useAuth();

  useEffect(() => {
    fetchUnits();
    fetchAssistants();
  }, []);

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
      setAssistants(response.data.assistants || []);
    } catch (error) {
      console.error("Error fetching assistants:", error);
      setAssistants([]); // Set empty array on error
    }
  };

  const handleUnitChange = (unitId) => {
    setSelectedUnit(unitId);
  };

  const getNavItems = () => {
    const items = [
      { id: "dashboard", label: "Dashboard", icon: BarChart3 },
      { id: "leads", label: "Lead", icon: Phone },
      { id: "documents", label: "Documenti", icon: FileText },
      { id: "chat", label: "Chat AI", icon: MessageCircle },
    ];

    if (user.role === "admin") {
      items.push(
        { id: "users", label: "Utenti", icon: Users },
        { id: "units", label: "Unit", icon: Building2 },
        { id: "containers", label: "Contenitori", icon: Home },
        { id: "workflow-builder", label: "Workflow Builder", icon: Workflow },
        { id: "ai-config", label: "Configurazione AI", icon: Settings },
        { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
        { id: "call-center", label: "Call Center", icon: PhoneCall },
        { id: "commesse", label: "Commesse", icon: Building },
        { id: "sub-agenzie", label: "Sub Agenzie", icon: Store },
        { id: "clienti", label: "Clienti", icon: UserCheck },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "referente") {
      items.push(
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    }

    return items;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardStats selectedUnit={selectedUnit} />;
      case "leads":
        return <LeadsManagement selectedUnit={selectedUnit} units={units} />;
      case "documents":
        return <DocumentsManagement selectedUnit={selectedUnit} units={units} />;
      case "chat":
        return <ChatManagement selectedUnit={selectedUnit} units={units} />;
      case "users":
        return user.role === "admin" ? <UsersManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
      case "units":
        return user.role === "admin" ? <UnitsManagement selectedUnit={selectedUnit} assistants={assistants} /> : <div>Non autorizzato</div>;
      case "containers":
        return user.role === "admin" ? <ContainersManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
      case "workflow-builder":
        return user.role === "admin" ? <WorkflowBuilderManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
      case "ai-config":
        return user.role === "admin" ? <AIConfigurationManagement /> : <div>Non autorizzato</div>;
      case "whatsapp":
        return user.role === "admin" ? <WhatsAppManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
      case "call-center":
        return user.role === "admin" ? <CallCenterManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
      case "commesse":
        return user.role === "admin" ? <CommesseManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
      case "sub-agenzie":
        return user.role === "admin" ? <SubAgenzieManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
      case "clienti":
        return <ClientiManagement selectedUnit={selectedUnit} units={units} />;
      case "analytics":
        return <AnalyticsManagement selectedUnit={selectedUnit} units={units} />;
      default:
        return <DashboardStats selectedUnit={selectedUnit} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 shadow-sm">
        {/* Sidebar Header with Unit Selector */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">CRM System</h1>
              <p className="text-xs text-slate-500">Gestione Lead Avanzata</p>
            </div>
          </div>
          
          {/* Unit Selector */}
          <div>
            <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Unit Attiva</Label>
            <Select value={selectedUnit} onValueChange={handleUnitChange}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleziona unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le Unit</SelectItem>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    <div className="flex items-center space-x-2">
                      <Building2 className="w-3 h-3" />
                      <span>{unit.name}</span>
                      {!unit.is_active && (
                        <Badge variant="secondary" className="text-xs">Inattiva</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-4 space-y-1">
          {getNavItems().map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="absolute bottom-0 left-0 right-0 w-64 p-4 border-t border-slate-200 bg-white">
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Header - Only Logout */}
        <header className="bg-white border-b border-slate-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold text-slate-800 capitalize">
                {getNavItems().find(item => item.id === activeTab)?.label || "Dashboard"}
              </h2>
              {selectedUnit && selectedUnit !== "all" && (
                <Badge variant="outline" className="text-xs">
                  <Building2 className="w-3 h-3 mr-1" />
                  {units.find(u => u.id === selectedUnit)?.name}
                </Badge>
              )}
            </div>
            
            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="text-slate-600 hover:text-red-600 hover:border-red-300"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Esci
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
};

// Enhanced Leads Management Component
const LeadsManagement = ({ selectedUnit, units }) => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [filters, setFilters] = useState({
    campagna: "",
    provincia: "",
    date_from: "",
    date_to: "",
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchLeads();
    fetchCustomFields();
  }, [selectedUnit, filters]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      
      const response = await axios.get(`${API}/leads?${params}`);
      setLeads(response.data);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei lead",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomFields = async () => {
    try {
      const response = await axios.get(`${API}/custom-fields`);
      setCustomFields(response.data);
    } catch (error) {
      console.error("Error fetching custom fields:", error);
    }
  };

  const updateLead = async (leadId, esito, note, customFields) => {
    try {
      await axios.put(`${API}/leads/${leadId}`, { esito, note, custom_fields: customFields });
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
    if (!esito) return <Badge variant="secondary">Nuovo</Badge>;
    
    const statusColors = {
      "FISSATO APPUNTAMENTO": "bg-green-100 text-green-800",
      "KO": "bg-red-100 text-red-800",
      "NR": "bg-yellow-100 text-yellow-800",
      "RICHIAMARE": "bg-blue-100 text-blue-800",
      "CONTRATTUALIZATO": "bg-purple-100 text-purple-800",
    };

    return (
      <Badge className={`${statusColors[esito] || "bg-gray-100 text-gray-800"} border-0`}>
        {esito}
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-800">Gestione Lead</h2>
        <div className="flex space-x-2">
          <div className="flex space-x-2">
            <Button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700">
              <Download className="w-4 h-4 mr-2" />
              Esporta Excel
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Lead  
            </Button>
          </div>
          <Button onClick={fetchLeads} variant="outline" size="sm">
            <Search className="w-4 h-4 mr-2" />
            Aggiorna
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Filtri di Ricerca</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Campagna</Label>
              <Input
                placeholder="Nome campagna"
                value={filters.campagna}
                onChange={(e) => setFilters({ ...filters, campagna: e.target.value })}
              />
            </div>
            <div>
              <Label>Provincia</Label>
              <Input
                placeholder="Nome provincia"
                value={filters.provincia}
                onChange={(e) => setFilters({ ...filters, provincia: e.target.value })}
              />
            </div>
            <div>
              <Label>Da Data</Label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              />
            </div>
            <div>
              <Label>A Data</Label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">Caricamento...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Lead</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead>Provincia</TableHead>
                  <TableHead>Campagna</TableHead>
                  <TableHead>Stato</TableHead>
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
                    <TableCell>{lead.telefono}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{lead.provincia}</span> 
                      </div>
                    </TableCell>
                    <TableCell>{lead.campagna}</TableCell>
                    <TableCell>{getStatusBadge(lead.esito)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(lead.created_at).toLocaleDateString("it-IT")}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          onClick={() => setSelectedLead(lead)}
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
          )}
        </CardContent>
      </Card>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={updateLead}
          customFields={customFields}
        />
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
const LeadDetailModal = ({ lead, onClose, onUpdate, customFields }) => {
  const [esito, setEsito] = useState(lead.esito || "");
  const [note, setNote] = useState(lead.note || "");
  const [customFieldValues, setCustomFieldValues] = useState(lead.custom_fields || {});

  const handleSave = () => {
    onUpdate(lead.id, esito, note, customFieldValues);
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Dettagli Lead #{lead.lead_id || lead.id.slice(0, 8)}</span>
          </DialogTitle>
          <DialogDescription>
            Visualizza e modifica le informazioni del lead
          </DialogDescription>
        </DialogHeader>

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
    tipologia_abitazione: "",
    campagna: "",
    gruppo: "",
    contenitore: "",
    privacy_consent: false,
    marketing_consent: false,
    custom_fields: {}
  });
  const [containers, setContainers] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crea Nuovo Lead</DialogTitle>
          <DialogDescription>
            Inserisci tutte le informazioni del nuovo lead
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
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
                <div>
                  <Label htmlFor="tipologia_abitazione">Tipologia Abitazione *</Label>
                  <Select value={formData.tipologia_abitazione} onValueChange={(value) => setFormData({ ...formData, tipologia_abitazione: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipologia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="appartamento">Appartamento</SelectItem>
                      <SelectItem value="villa">Villa</SelectItem>
                      <SelectItem value="casa_indipendente">Casa Indipendente</SelectItem>
                      <SelectItem value="altro">Altro</SelectItem>
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
                        {unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="contenitore">Contenitore *</Label>
                <Select value={formData.contenitore} onValueChange={(value) => setFormData({ ...formData, contenitore: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona contenitore" />
                  </SelectTrigger>
                  <SelectContent>
                    {containers.map((container) => (
                      <SelectItem key={container.id} value={container.id}>
                        {container.name}
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
const UsersManagement = ({ selectedUnit, units }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [provinces, setProvinces] = useState([]);
  const [referenti, setReferenti] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchProvinces();
    if (selectedUnit && selectedUnit !== "all") {
      fetchReferenti(selectedUnit);
    }
  }, [selectedUnit]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      
      const response = await axios.get(`${API}/users?${params}`);
      setUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProvinces = async () => {
    try {
      const response = await axios.get(`${API}/provinces`);
      setProvinces(response.data.provinces);
    } catch (error) {
      console.error("Error fetching provinces:", error);
    }
  };

  const fetchReferenti = async (unitId) => {
    try {
      const response = await axios.get(`${API}/users/referenti/${unitId}`);
      setReferenti(response.data);
    } catch (error) {
      console.error("Error fetching referenti:", error);
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      await axios.put(`${API}/users/${userId}/toggle-status`);
      toast({
        title: "Successo",
        description: `Utente ${currentStatus ? 'disattivato' : 'attivato'} con successo`,
      });
      fetchUsers();
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'aggiornamento dello stato utente",
        variant: "destructive",
      });
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo utente?")) {
      return;
    }

    try {
      await axios.delete(`${API}/users/${userId}`);
      toast({
        title: "Successo",
        description: "Utente eliminato con successo",
      });
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'eliminazione dell'utente",
        variant: "destructive",
      });
    }
  };

  const getRoleBadge = (role) => {
    const roleColors = {
      admin: "bg-red-100 text-red-800",
      referente: "bg-blue-100 text-blue-800", 
      agente: "bg-green-100 text-green-800",
    };

    return (
      <Badge className={`${roleColors[role] || "bg-gray-100 text-gray-800"} border-0 capitalize`}>
        {role}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-800">
          Gestione Utenti {selectedUnit && selectedUnit !== "all" && `- ${units.find(u => u.id === selectedUnit)?.name}`}
        </h2>
        <Button onClick={() => setShowCreateModal(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Nuovo Utente
        </Button>
      </div>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">Caricamento...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Ruolo</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Province</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Ultimo Accesso</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      {user.unit_id ? units.find(u => u.id === user.unit_id)?.name || "N/A" : "N/A"}
                    </TableCell>
                    <TableCell>
                      {user.provinces?.length > 0 ? (
                        <div className="text-xs">
                          {user.provinces.slice(0, 2).join(", ")}
                          {user.provinces.length > 2 && ` (+${user.provinces.length - 2})`}
                        </div>
                      ) : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? "Attivo" : "Disattivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.last_login ? 
                        new Date(user.last_login).toLocaleDateString("it-IT") : 
                        "Mai"
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          onClick={() => setEditingUser(user)}
                          variant="ghost"
                          size="sm"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={() => toggleUserStatus(user.id, user.is_active)}
                          variant={user.is_active ? "destructive" : "default"}
                          size="sm"
                        >
                          {user.is_active ? (
                            <PowerOff className="w-3 h-3" />
                          ) : (
                            <Power className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          onClick={() => deleteUser(user.id)}
                          variant="destructive"
                          size="sm"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            fetchUsers();
            setShowCreateModal(false);
          }}
          provinces={provinces}
          units={units}
          referenti={referenti}
          selectedUnit={selectedUnit}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            fetchUsers();
            setEditingUser(null);
          }}
          provinces={provinces}
          units={units}
          referenti={referenti}
        />
      )}
    </div>
  );
};

// Enhanced Create User Modal Component with Referenti
const CreateUserModal = ({ onClose, onSuccess, provinces, units, referenti, selectedUnit }) => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "",
    unit_id: selectedUnit && selectedUnit !== "all" ? selectedUnit : "",
    referente_id: "",
    provinces: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await axios.post(`${API}/users`, formData);
      toast({
        title: "Successo",
        description: "Utente creato con successo",
      });
      onSuccess();
    } catch (error) {
      console.error("Error creating user:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nella creazione dell'utente",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProvinceChange = (province, checked) => {
    if (checked) {
      setFormData({
        ...formData,
        provinces: [...formData.provinces, province],
      });
    } else {
      setFormData({
        ...formData,
        provinces: formData.provinces.filter((p) => p !== province),
      });
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crea Nuovo Utente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="role">Ruolo *</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona ruolo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="referente">Referente</SelectItem>
                  <SelectItem value="agente">Agente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="unit_id">Unit</Label>
            <Select value={formData.unit_id} onValueChange={(value) => setFormData({ ...formData, unit_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona unit" />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.role === "agente" && (
            <>
              {referenti.length > 0 && (
                <div>
                  <Label htmlFor="referente_id">Referente *</Label>
                  <Select value={formData.referente_id} onValueChange={(value) => setFormData({ ...formData, referente_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona referente" />
                    </SelectTrigger>
                    <SelectContent>
                      {referenti.map((referente) => (
                        <SelectItem key={referente.id} value={referente.id}>
                          {referente.username} ({referente.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Province di Copertura *</Label>
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-3 gap-2">
                    {provinces.map((province) => (
                      <div key={province} className="flex items-center space-x-2">
                        <Checkbox
                          id={province}
                          checked={formData.provinces.includes(province)}
                          onCheckedChange={(checked) => handleProvinceChange(province, checked)}
                        />
                        <Label htmlFor={province} className="text-sm">
                          {province}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Selezionate: {formData.provinces.length} province
                </p>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creazione..." : "Crea Utente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Edit User Modal Component
const EditUserModal = ({ user, onClose, onSuccess, provinces, units, referenti }) => {
  const [formData, setFormData] = useState({
    username: user.username,
    email: user.email,
    password: "",
    role: user.role,
    unit_id: user.unit_id || "",
    referente_id: user.referente_id || "",
    provinces: user.provinces || [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await axios.put(`${API}/users/${user.id}`, formData);
      toast({
        title: "Successo",
        description: "Utente aggiornato con successo",
      });
      onSuccess();
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'aggiornamento dell'utente",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProvinceChange = (province, checked) => {
    if (checked) {
      setFormData({
        ...formData,
        provinces: [...formData.provinces, province],
      });
    } else {
      setFormData({
        ...formData,
        provinces: formData.provinces.filter((p) => p !== province),
      });
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Utente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="password">Nuova Password (lascia vuoto per non modificare)</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="role">Ruolo *</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona ruolo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="referente">Referente</SelectItem>
                  <SelectItem value="agente">Agente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="unit_id">Unit</Label>
            <Select value={formData.unit_id} onValueChange={(value) => setFormData({ ...formData, unit_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona unit" />
              </SelectTrigger>
              <SelectContent>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.role === "agente" && (
            <>
              {referenti.length > 0 && (
                <div>
                  <Label htmlFor="referente_id">Referente</Label>
                  <Select value={formData.referente_id} onValueChange={(value) => setFormData({ ...formData, referente_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona referente" />
                    </SelectTrigger>
                    <SelectContent>
                      {referenti.map((referente) => (
                        <SelectItem key={referente.id} value={referente.id}>
                          {referente.username} ({referente.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Province di Copertura</Label>
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-3 gap-2">
                    {provinces.map((province) => (
                      <div key={province} className="flex items-center space-x-2">
                        <Checkbox
                          id={province}
                          checked={formData.provinces.includes(province)}
                          onCheckedChange={(checked) => handleProvinceChange(province, checked)}
                        />
                        <Label htmlFor={province} className="text-sm">
                          {province}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Selezionate: {formData.provinces.length} province
                </p>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Aggiornamento..." : "Aggiorna Utente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Enhanced Units Management Component
const UnitsManagement = ({ selectedUnit, assistants }) => {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUnitForEdit, setSelectedUnitForEdit] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const response = await axios.get(`${API}/units`);
      setUnits(response.data);
    } catch (error) {
      console.error("Error fetching units:", error);
    } finally {
      setLoading(false);
    }
  };

  const createUnit = async (unitData) => {
    try {
      await axios.post(`${API}/units`, unitData);
      toast({
        title: "Successo",
        description: "Unit creata con successo",
      });
      fetchUnits();
      setShowCreateModal(false);
    } catch (error) {
      console.error("Error creating unit:", error);
      toast({
        title: "Errore",
        description: "Errore nella creazione della unit",
        variant: "destructive",
      });
    }
  };

  const updateUnit = async (unitId, unitData) => {
    try {
      await axios.put(`${API}/units/${unitId}`, unitData);
      toast({
        title: "Successo",
        description: "Unit aggiornata con successo",
      });
      fetchUnits();
      setShowEditModal(false);
      setSelectedUnitForEdit(null);
    } catch (error) {
      console.error("Error updating unit:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'aggiornamento della unit",
        variant: "destructive",
      });
    }
  };

  const deleteUnit = async (unitId, unitName) => {
    if (!window.confirm(`Sei sicuro di voler eliminare la unit "${unitName}"?\n\nQuesta azione non può essere annullata.`)) {
      return;
    }

    try {
      await axios.delete(`${API}/units/${unitId}`);
      toast({
        title: "Successo",
        description: "Unit eliminata con successo",
      });
      fetchUnits();
    } catch (error) {
      console.error("Error deleting unit:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'eliminazione della unit",
        variant: "destructive",
      });
    }
  };

  const handleEditUnit = (unit) => {
    setSelectedUnitForEdit(unit);
    setShowEditModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-800">Gestione Unit</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuova Unit
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 text-center py-8">Caricamento...</div>
        ) : (
          units.map((unit) => (
            <Card key={unit.id} className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <span>{unit.name}</span>
                </CardTitle>
                <CardDescription>{unit.description || "Nessuna descrizione"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-600">Webhook URL</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded flex-1 truncate">
                        {BACKEND_URL}{unit.webhook_url}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(`${BACKEND_URL}${unit.webhook_url}`);
                          toast({ title: "Copiato negli appunti!" });
                        }}
                      >
                        Copia
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge variant={unit.is_active ? "default" : "secondary"}>
                        {unit.is_active ? "Attiva" : "Disattiva"}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(unit.created_at).toLocaleDateString("it-IT")}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex space-x-2 pt-3 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditUnit(unit)}
                      className="flex-1"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Modifica
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteUnit(unit.id, unit.name)}
                      className="flex-1"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Elimina
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {showCreateModal && (
        <CreateUnitModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={createUnit}
          assistants={assistants}
        />
      )}

      {showEditModal && selectedUnitForEdit && (
        <EditUnitModal
          unit={selectedUnitForEdit}
          assistants={assistants}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUnitForEdit(null);
          }}
          onSubmit={(unitData) => updateUnit(selectedUnitForEdit.id, unitData)}
        />
      )}
    </div>
  );
};

// Create Unit Modal Component
const CreateUnitModal = ({ onClose, onSubmit, assistants = [] }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    assistant_id: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crea Nueva Unit</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome Unit *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Es. Unit Nord Italia"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrizione della unit"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="assistant">Assistente AI (Opzionale)</Label>
            <Select
              value={formData.assistant_id}
              onValueChange={(value) => setFormData({ ...formData, assistant_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona un assistente (vuoto = nessun bot)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nessun assistente</SelectItem>
                {assistants.map((assistant) => (
                  <SelectItem key={assistant.id} value={assistant.id}>
                    {assistant.name} ({assistant.model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              Se lasci vuoto, i lead si smisteranno automaticamente agli agenti senza bot
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">Crea Unit</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Edit Unit Modal Component  
const EditUnitModal = ({ unit, assistants = [], onClose, onSubmit }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: unit.name || "",
    description: unit.description || "",
    assistant_id: unit.assistant_id || "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica Unit</DialogTitle>
          <DialogDescription>
            Modifica i dati della unit "{unit.name}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Nome Unit *</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Es. Unit Nord Italia"
              required
            />
          </div>

          <div>
            <Label htmlFor="edit-description">Descrizione</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrizione della unit"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="edit-assistant">Assistente AI (Opzionale)</Label>
            <Select
              value={formData.assistant_id}
              onValueChange={(value) => setFormData({ ...formData, assistant_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona un assistente (vuoto = nessun bot)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nessun assistente</SelectItem>
                {assistants.map((assistant) => (
                  <SelectItem key={assistant.id} value={assistant.id}>
                    {assistant.name} ({assistant.model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              {formData.assistant_id ? "Bot attivo per questa unit" : "Nessun bot configurato - lead vanno direttamente agli agenti"}
            </p>
          </div>

          {/* Unit Info Display */}
          <div className="bg-slate-50 p-3 rounded-lg space-y-2">
            <div>
              <Label className="text-xs font-medium text-slate-600">Webhook URL (Read-only)</Label>
              <div className="flex items-center space-x-2 mt-1">
                <code className="text-xs bg-white px-2 py-1 rounded flex-1 border">
                  {BACKEND_URL}{unit.webhook_url}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${BACKEND_URL}${unit.webhook_url}`);
                    toast({ title: "URL copiato negli appunti!" });
                  }}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <Label className="text-slate-600">Stato</Label>
                <div className="mt-1">
                  <Badge variant={unit.is_active ? "default" : "secondary"}>
                    {unit.is_active ? "Attiva" : "Disattiva"}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-slate-600">Creata il</Label>
                <div className="mt-1">{new Date(unit.created_at).toLocaleDateString("it-IT")}</div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">
              <Save className="w-4 h-4 mr-2" />
              Salva Modifiche
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Enhanced Containers Management Component with Edit/Delete
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
                    {unit.name}
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
                    {unit.name}
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

// Analytics Management Component
const AnalyticsManagement = ({ selectedUnit, units }) => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedReferente, setSelectedReferente] = useState("");
  const [agents, setAgents] = useState([]);
  const [referenti, setReferenti] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user.role === "admin" || user.role === "referente") {
      fetchUsers();
    }
  }, [selectedUnit]);

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

  const fetchAgentAnalytics = async (agentId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/analytics/agent/${agentId}`);
      setAnalyticsData(response.data);
    } catch (error) {
      console.error("Error fetching agent analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferenteAnalytics = async (referenteId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/analytics/referente/${referenteId}`);
      setAnalyticsData(response.data);
    } catch (error) {
      console.error("Error fetching referente analytics:", error);
    } finally {
      setLoading(false);
    }
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

    const { referente, total_stats, agent_breakdown } = analyticsData;

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

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Performance Agenti</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Totale Lead</TableHead>
                  <TableHead>Contattati</TableHead>
                  <TableHead>Tasso Contatti</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agent_breakdown.map((agentData) => (
                  <TableRow key={agentData.agent.id}>
                    <TableCell className="font-medium">{agentData.agent.username}</TableCell>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-800">Analytics e Statistiche</h2>
      </div>

      {/* Selection Controls */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Seleziona Vista Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(user.role === "admin" || user.role === "referente") && (
              <div>
                <Label>Analytics per Agente</Label>
                <Select value={selectedAgent} onValueChange={(value) => {
                  setSelectedAgent(value);
                  setSelectedReferente("");
                  if (value) fetchAgentAnalytics(value);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.username} ({agent.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {user.role === "admin" && (
              <div>
                <Label>Analytics per Referente</Label>
                <Select value={selectedReferente} onValueChange={(value) => {
                  setSelectedReferente(value);
                  setSelectedAgent("");
                  if (value) fetchReferenteAnalytics(value);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona referente" />
                  </SelectTrigger>
                  <SelectContent>
                    {referenti.map((referente) => (
                      <SelectItem key={referente.id} value={referente.id}>
                        {referente.username} ({referente.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analytics Results */}
      {loading ? (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Caricamento analytics...</p>
          </CardContent>
        </Card>
      ) : analyticsData ? (
        selectedAgent ? renderAgentAnalytics() : renderReferenteAnalytics()
      ) : (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <BarChart3 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">Seleziona un agente o referente per visualizzare le analytics</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Documents Management Component
const DocumentsManagement = ({ selectedUnit, units }) => {
  const [activeTab, setActiveTab] = useState("lead"); // "lead" or "cliente"
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [commesse, setCommesse] = useState([]);
  const [subAgenzie, setSubAgenzie] = useState([]);
  const [filters, setFilters] = useState({
    entity_id: "",
    nome: "",
    cognome: "",
    commessa_id: "",
    sub_agenzia_id: "",
    uploaded_by: "",
    date_from: "",
    date_to: "",
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchDocuments();
    fetchCommesse();
    fetchSubAgenzie();
  }, [selectedUnit, filters, activeTab]);

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

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      // Add document type filter
      params.append('document_type', activeTab);
      
      // Add all filter parameters
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim()) {
          params.append(key, value.trim());
        }
      });
      
      // Add unit filter if selected (only for lead documents)
      if (selectedUnit && selectedUnit !== "all" && activeTab === "lead") {
        params.append('unit_id', selectedUnit);
      }
      
      console.log("Fetching documents with params:", params.toString());
      
      const response = await axios.get(`${API}/documents?${params}`);
      console.log("Documents response:", response.data);
      
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei documenti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (documentId, filename) => {
    try {
      const response = await axios.get(`${API}/documents/download/${documentId}`, {
        responseType: 'blob'
      });
      
      // Create blob URL and trigger download
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Successo",
        description: "Download completato",
      });
      
      // Refresh documents to update download count
      fetchDocuments();
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({
        title: "Errore",
        description: "Errore nel download del documento",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo documento?")) {
      return;
    }

    try {
      await axios.delete(`${API}/documents/${documentId}`);
      toast({
        title: "Successo",
        description: "Documento eliminato con successo",
      });
      fetchDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'eliminazione del documento",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-800">
          Gestione Documenti {selectedUnit && selectedUnit !== "all" && `- ${units.find(u => u.id === selectedUnit)?.name}`}
        </h2>
        <Button onClick={() => setShowUploadModal(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Carica Documento
        </Button>
      </div>

      {/* Document Type Tabs */}
      <div className="flex space-x-1 bg-slate-100 rounded-lg p-1">
        <Button
          variant={activeTab === "lead" ? "default" : "ghost"}
          onClick={() => setActiveTab("lead")}
          className="flex items-center space-x-2"
        >
          <FileUser className="w-4 h-4" />
          <span>Documenti Lead</span>
        </Button>
        <Button
          variant={activeTab === "cliente" ? "default" : "ghost"}
          onClick={() => setActiveTab("cliente")}
          className="flex items-center space-x-2"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Documenti Clienti</span>
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <Label>{activeTab === "lead" ? "Lead ID" : "Cliente ID"}</Label>
              <Input
                placeholder={`Filtra per ${activeTab === "lead" ? "Lead ID" : "Cliente ID"}`}
                value={filters.entity_id}
                onChange={(e) => setFilters({ ...filters, entity_id: e.target.value })}
              />
            </div>
            <div>
              <Label>Nome</Label>
              <Input
                placeholder="Filtra per nome"
                value={filters.nome}
                onChange={(e) => setFilters({ ...filters, nome: e.target.value })}
              />
            </div>
            <div>
              <Label>Cognome</Label>
              <Input
                placeholder="Filtra per cognome"
                value={filters.cognome}
                onChange={(e) => setFilters({ ...filters, cognome: e.target.value })}
              />
            </div>
            
            {/* Cliente-specific filters */}
            {activeTab === "cliente" && (
              <>
                <div>
                  <Label>Commessa</Label>
                  <Select
                    value={filters.commessa_id || "all"}
                    onValueChange={(value) => setFilters({ 
                      ...filters, 
                      commessa_id: value === "all" ? "" : value,
                      sub_agenzia_id: "" // Reset sub agenzia when commessa changes
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tutte le Commesse" />
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
                </div>
                <div>
                  <Label>Sub Agenzia</Label>
                  <Select
                    value={filters.sub_agenzia_id || "all"}
                    onValueChange={(value) => setFilters({ 
                      ...filters, 
                      sub_agenzia_id: value === "all" ? "" : value 
                    })}
                    disabled={!filters.commessa_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tutte le Sub Agenzie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte le Sub Agenzie</SelectItem>
                      {subAgenzie
                        .filter(sa => !filters.commessa_id || sa.commesse_autorizzate.includes(filters.commessa_id))
                        .map((subAgenzia) => (
                          <SelectItem key={subAgenzia.id} value={subAgenzia.id}>
                            {subAgenzia.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            <div>
              <Label>Caricato da</Label>
              <Input
                placeholder="Filtra per utente"
                value={filters.uploaded_by}
                onChange={(e) => setFilters({ ...filters, uploaded_by: e.target.value })}
              />
            </div>
            <div>
              <Label>Data da</Label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
              />
            </div>
            <div>
              <Label>Data a</Label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-between items-center mt-4">
            <div className="flex space-x-2">
              <Button
                onClick={() => setFilters({
                  entity_id: "",
                  nome: "",
                  cognome: "",
                  commessa_id: "",
                  sub_agenzia_id: "",
                  uploaded_by: "",
                  date_from: "",
                  date_to: "",
                })}
                variant="outline"
                size="sm"
              >
                <X className="w-4 h-4 mr-2" />
                Pulisci Filtri
              </Button>
              <Button
                onClick={fetchDocuments}
                variant="default"
                size="sm"
              >
                <Search className="w-4 h-4 mr-2" />
                Cerca
              </Button>
            </div>
            <div className="text-sm text-slate-500">
              {documents.length} documenti trovati
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">Caricamento...</div>
          ) : documents.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Nessun documento trovato</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome File</TableHead>
                  <TableHead>{activeTab === "lead" ? "Lead" : "Cliente"}</TableHead>
                  <TableHead>Tipo</TableHead>
                  {activeTab === "cliente" && <TableHead>Commessa/Agenzia</TableHead>}
                  <TableHead>Dimensione</TableHead>
                  <TableHead>Caricato da</TableHead>
                  <TableHead>Data Caricamento</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span>{doc.filename}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {doc.entity ? (
                        <div>
                          <div className="font-medium">{doc.entity.nome} {doc.entity.cognome}</div>
                          <div className="text-xs text-slate-500">
                            ID: {doc.entity.type === "lead" ? doc.entity.lead_id : doc.entity.cliente_id}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Entità non trovata</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={doc.document_type === "lead" ? "default" : "secondary"}>
                        {doc.document_type === "lead" ? "Lead" : "Cliente"}
                      </Badge>
                    </TableCell>
                    {activeTab === "cliente" && (
                      <TableCell>
                        {doc.entity?.commessa && doc.entity?.sub_agenzia ? (
                          <div>
                            <div className="text-sm font-medium">{doc.entity.commessa}</div>
                            <div className="text-xs text-slate-500">{doc.entity.sub_agenzia}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell>{formatFileSize(doc.size)}</TableCell>
                    <TableCell>{doc.uploaded_by}</TableCell>
                    <TableCell>
                      {new Date(doc.created_at).toLocaleDateString("it-IT")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {doc.download_count} volte
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          onClick={() => handleDownload(doc.document_id, doc.filename)}
                          variant="ghost"
                          size="sm"
                          title="Download"
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={() => setSelectedDocument(doc)}
                          variant="ghost"
                          size="sm"
                          title="Dettagli"
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
                        {user.role === "admin" && (
                          <Button
                            onClick={() => handleDelete(doc.document_id)}
                            variant="destructive"
                            size="sm"
                            title="Elimina"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      {showUploadModal && (
        <DocumentUploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            fetchDocuments();
            setShowUploadModal(false);
          }}
          units={units}
          selectedUnit={selectedUnit}
          documentType={activeTab}
        />
      )}

      {/* Document Details Modal */}
      {selectedDocument && (
        <DocumentDetailsModal
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
};

// Document Upload Modal Component
const DocumentUploadModal = ({ onClose, onSuccess, units, selectedUnit, documentType = "lead" }) => {
  const [selectedEntity, setSelectedEntity] = useState("");
  const [entities, setEntities] = useState([]);
  const [commesse, setCommesse] = useState([]);
  const [selectedCommessa, setSelectedCommessa] = useState("");
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (documentType === "lead") {
      fetchLeads();
    } else {
      fetchCommesse();
    }
  }, [selectedUnit, documentType, selectedCommessa]);

  const fetchLeads = async () => {
    try {
      setEntitiesLoading(true);
      const params = new URLSearchParams();
      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      
      const response = await axios.get(`${API}/leads?${params}`);
      setEntities(response.data);
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setEntitiesLoading(false);
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

  const fetchClienti = async () => {
    if (!selectedCommessa) return;
    
    try {
      setEntitiesLoading(true);
      const params = new URLSearchParams();
      params.append('commessa_id', selectedCommessa);
      
      const response = await axios.get(`${API}/clienti?${params}`);
      setEntities(response.data);
    } catch (error) {
      console.error("Error fetching clienti:", error);
    } finally {
      setEntitiesLoading(false);
    }
  };

  useEffect(() => {
    if (documentType === "cliente" && selectedCommessa) {
      fetchClienti();
    }
  }, [selectedCommessa]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedEntity || !file) {
      toast({
        title: "Errore",
        description: `Seleziona un ${documentType === "lead" ? "lead" : "cliente"} e un file PDF`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('document_type', documentType);
      formData.append('entity_id', selectedEntity);
      formData.append('file', file);
      formData.append('uploaded_by', user.username);

      await axios.post(`${API}/documents/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast({
        title: "Successo",
        description: "Documento caricato con successo",
      });
      onSuccess();
    } catch (error) {
      console.error("Error uploading document:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nel caricamento del documento",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast({
          title: "Errore",
          description: "Solo file PDF sono consentiti",
          variant: "destructive",
        });
        return;
      }
      
      if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "Errore",
          description: "Il file non può essere più grande di 10MB",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Carica Documento {documentType === "lead" ? "Lead" : "Cliente"}</DialogTitle>
          <DialogDescription>
            Carica un documento PDF per un {documentType === "lead" ? "lead" : "cliente"} specifico
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {documentType === "cliente" && (
            <div>
              <Label htmlFor="commessa">Commessa *</Label>
              <Select value={selectedCommessa || "none"} onValueChange={(value) => {
                setSelectedCommessa(value === "none" ? "" : value);
                setSelectedEntity(""); // Reset selected entity
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona commessa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seleziona commessa</SelectItem>
                  {commesse.map((commessa) => (
                    <SelectItem key={commessa.id} value={commessa.id}>
                      {commessa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div>
            <Label htmlFor="entity">{documentType === "lead" ? "Lead" : "Cliente"} *</Label>
            <Select 
              value={selectedEntity || "none"} 
              onValueChange={(value) => setSelectedEntity(value === "none" ? "" : value)}
              disabled={documentType === "cliente" && !selectedCommessa}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Seleziona ${documentType === "lead" ? "lead" : "cliente"}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  Seleziona {documentType === "lead" ? "lead" : "cliente"}
                </SelectItem>
                {entitiesLoading ? (
                  <SelectItem value="loading" disabled>Caricamento...</SelectItem>
                ) : (
                  entities.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.nome} {entity.cognome}
                      {entity.email && ` - ${entity.email}`}
                      {documentType === "cliente" && entity.cliente_id && ` (ID: ${entity.cliente_id})`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="file">File PDF *</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              required
            />
            {file && (
              <p className="text-sm text-slate-600 mt-1">
                File selezionato: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading || !selectedEntity || !file}>
              {isLoading ? "Caricamento..." : "Carica Documento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Document Details Modal Component
const DocumentDetailsModal = ({ document, onClose, onDownload }) => {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dettagli Documento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-slate-600">Nome File</Label>
            <p className="text-lg font-semibold">{document.filename}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-600">Dimensione</Label>
              <p>{(document.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-600">Tipo</Label>
              <p>{document.content_type}</p>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-600">Lead Associato</Label>
            {document.lead ? (
              <p>{document.lead.nome} {document.lead.cognome}</p>
            ) : (
              <p className="text-slate-400">Lead non trovato</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-slate-600">Caricato da</Label>
              <p>{document.uploaded_by}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-600">Download</Label>
              <p>{document.download_count} volte</p>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-600">Data Caricamento</Label>
            <p>{new Date(document.created_at).toLocaleString("it-IT")}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Chiudi
          </Button>
          <Button onClick={() => onDownload(document.document_id, document.filename)}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Chat Management Component  
const ChatManagement = ({ selectedUnit, units }) => {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (selectedUnit && selectedUnit !== "all") {
      fetchSessions();
    }
  }, [selectedUnit]);

  useEffect(() => {
    if (activeSession) {
      fetchMessages(activeSession.session_id);
    }
  }, [activeSession]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/chat/sessions`);
      setSessions(response.data.sessions || []);
      
      // Auto-select first session or create new one if none exist
      if (response.data.sessions.length > 0) {
        setActiveSession(response.data.sessions[0]);
      } else {
        await createNewSession();
      }
    } catch (error) {
      console.error("Error fetching chat sessions:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle sessioni chat",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createNewSession = async () => {
    try {
      const formData = new FormData();
      formData.append('session_type', 'unit');
      
      const response = await axios.post(`${API}/chat/session`, formData);
      
      if (response.data.success) {
        const newSession = response.data.session;
        setSessions(prev => [newSession, ...prev]);
        setActiveSession(newSession);
        toast({
          title: "Successo",
          description: "Nuova sessione chat creata",
        });
      }
    } catch (error) {
      console.error("Error creating chat session:", error);
      toast({
        title: "Errore",
        description: "Errore nella creazione della sessione chat",
        variant: "destructive",
      });
    }
  };

  const fetchMessages = async (sessionId) => {
    try {
      const response = await axios.get(`${API}/chat/history/${sessionId}`);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei messaggi",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeSession || sending) return;

    try {
      setSending(true);
      const formData = new FormData();
      formData.append('session_id', activeSession.session_id);
      formData.append('message', newMessage.trim());

      const response = await axios.post(`${API}/chat/message`, formData);
      
      if (response.data.success) {
        // Refresh messages to show both user message and AI response
        await fetchMessages(activeSession.session_id);
        setNewMessage("");
        
        // Update session in the list
        setSessions(prev => prev.map(s => 
          s.session_id === activeSession.session_id 
            ? { ...s, last_activity: new Date().toISOString() }
            : s
        ));
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Errore",
        description: "Errore nell'invio del messaggio",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString("it-IT", {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Caricamento chat...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-800">
          Chat AI Assistant {selectedUnit && selectedUnit !== "all" && `- ${units.find(u => u.id === selectedUnit)?.name}`}
        </h2>
        <Button onClick={createNewSession}>
          <MessageCircle className="w-4 h-4 mr-2" />
          Nuova Sessione
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[600px]">
        {/* Sessions Sidebar */}
        <div className="col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg">Sessioni Chat</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {sessions.map((session) => (
                  <div
                    key={session.session_id}
                    onClick={() => setActiveSession(session)}
                    className={`p-3 cursor-pointer hover:bg-slate-50 border-b ${
                      activeSession?.session_id === session.session_id 
                        ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                        : ''
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <MessageCircle className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-sm">
                        Sessione {session.session_type}
                      </span>
                    </div>
                    {session.last_message && (
                      <div className="text-xs text-slate-500 mt-1 truncate">
                        {session.last_message.message.slice(0, 50)}...
                      </div>
                    )}
                    <div className="text-xs text-slate-400 mt-1">
                      {formatTimestamp(session.last_activity)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chat Interface */}
        <div className="col-span-9">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <MessageCircle className="w-5 h-5" />
                {activeSession ? (
                  <span>Chat Assistant - Sessione {activeSession.session_type}</span>
                ) : (
                  <span>Seleziona una sessione</span>
                )}
              </CardTitle>
            </CardHeader>

            {activeSession ? (
              <>
                {/* Messages Area */}
                <CardContent className="flex-1 overflow-y-auto max-h-[400px]">
                  <div className="space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center text-slate-500 py-8">
                        <MessageCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                        <p>Inizia una conversazione con l'assistente AI!</p>
                        <p className="text-sm mt-1">Chiedi consigli sui lead, strategie di vendita o organizzazione del lavoro.</p>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.message_type === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] p-3 rounded-lg ${
                              message.message_type === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            <div className="break-words">{message.message}</div>
                            <div
                              className={`text-xs mt-1 ${
                                message.message_type === 'user' ? 'text-blue-100' : 'text-slate-500'
                              }`}
                            >
                              {formatTimestamp(message.created_at)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    {sending && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 text-slate-800 p-3 rounded-lg">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>

                {/* Message Input */}
                <div className="p-4 border-t">
                  <div className="flex space-x-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Scrivi il tuo messaggio..."
                      disabled={sending}
                      className="flex-1"
                    />
                    <Button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="px-4"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Premi Invio per inviare, Shift+Invio per andare a capo
                  </div>
                </div>
              </>
            ) : (
              <CardContent className="flex-1 flex items-center justify-center">
                <div className="text-center text-slate-500">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg">Nessuna sessione selezionata</p>
                  <p className="text-sm">Crea una nuova sessione per iniziare</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* Help Info */}
      <Card className="border-0 shadow-sm bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-2">Come usare l'assistente AI</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• <strong>Analisi Lead:</strong> "Analizza questo lead: [nome cliente] interessato a [prodotto]"</p>
                <p>• <strong>Strategie:</strong> "Come posso ricontattare un cliente che non risponde?"</p>
                <p>• <strong>Organizzazione:</strong> "Come posso organizzare meglio i miei follow-up?"</p>
                <p>• <strong>Performance:</strong> "Suggerimenti per migliorare il mio tasso di conversione"</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// AI Configuration Management Component
const AIConfigurationManagement = () => {
  const [config, setConfig] = useState(null);
  const [assistants, setAssistants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAIConfig();
  }, []);

  const fetchAIConfig = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/ai-config`);
      setConfig(response.data);
      
      // If configured, fetch assistants
      if (response.data.configured) {
        await fetchAssistants();
      }
    } catch (error) {
      console.error("Error fetching AI config:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssistants = async () => {
    try {
      const response = await axios.get(`${API}/ai-assistants`);
      setAssistants(response.data.assistants || []);
    } catch (error) {
      console.error("Error fetching assistants:", error);
      setAssistants([]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Caricamento configurazione AI...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-800">Configurazione AI</h2>
        <Button onClick={() => setShowConfigModal(true)}>
          <Settings className="w-4 h-4 mr-2" />
          {config?.configured ? "Modifica Configurazione" : "Configura OpenAI"}
        </Button>
      </div>

      {/* Configuration Status */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Stato Configurazione</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {config?.configured ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-green-700 font-medium">OpenAI configurato correttamente</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-600">API Key</Label>
                  <p className="font-mono text-sm bg-slate-50 p-2 rounded">
                    {config.api_key_preview}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Configurato il</Label>
                  <p className="text-sm">
                    {new Date(config.created_at).toLocaleDateString("it-IT")}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <span className="text-amber-700 font-medium">OpenAI non configurato</span>
              </div>
              <p className="text-slate-600">
                Configura la tua API key OpenAI per abilitare gli assistenti AI personalizzati per le Unit.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assistants List */}
      {config?.configured && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5" />
              <span>Assistenti Disponibili ({assistants.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assistants.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500">Nessun assistente trovato</p>
                <p className="text-sm text-slate-400 mt-1">
                  Crea degli assistenti nel tuo account OpenAI per vederli qui
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assistants.map((assistant) => (
                  <Card key={assistant.id} className="border border-slate-200">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-slate-800">{assistant.name}</h4>
                          <p className="text-xs text-slate-500 font-mono">{assistant.id}</p>
                        </div>
                        
                        {assistant.description && (
                          <p className="text-sm text-slate-600 line-clamp-2">
                            {assistant.description}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between text-xs">
                          <Badge variant="outline">{assistant.model}</Badge>
                          <span className="text-slate-400">
                            {new Date(assistant.created_at * 1000).toLocaleDateString("it-IT")}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Configuration Modal */}
      {showConfigModal && (
        <AIConfigModal
          onClose={() => setShowConfigModal(false)}
          onSuccess={() => {
            fetchAIConfig();
            setShowConfigModal(false);
          }}
          existingConfig={config}
        />
      )}
    </div>
  );
};

// AI Configuration Modal Component
const AIConfigModal = ({ onClose, onSuccess, existingConfig }) => {
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci una API key OpenAI valida",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/ai-config`, {
        openai_api_key: apiKey.trim()
      });

      if (response.data.success) {
        toast({
          title: "Successo",
          description: "Configurazione AI salvata con successo",
        });
        onSuccess();
      } else {
        toast({
          title: "Errore",
          description: response.data.message || "Configurazione fallida",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error saving AI config:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nel salvataggio della configurazione",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existingConfig?.configured ? "Modifica" : "Configura"} OpenAI
          </DialogTitle>
          <DialogDescription>
            Inserisci la tua API key OpenAI per abilitare gli assistenti AI
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="api-key">API Key OpenAI *</Label>
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              La tua API key sarà crittografata e utilizzata solo per recuperare i tuoi assistenti OpenAI
            </p>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Come ottenere la API Key:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Vai su platform.openai.com</li>
                  <li>Accedi al tuo account OpenAI</li>
                  <li>Vai su "API keys" nel menu</li>
                  <li>Clicca "Create new secret key"</li>
                  <li>Copia la chiave qui</li>
                </ol>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Validazione..." : "Salva Configurazione"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// WhatsApp Management Component
const WhatsAppManagement = ({ selectedUnit, units }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchWhatsAppConfig();
  }, [selectedUnit]); // Ricarica quando cambia l'unit

  const fetchWhatsAppConfig = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      // Passa unit_id come parametro
      const params = new URLSearchParams();
      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      
      const response = await axios.get(`${API}/whatsapp-config?${params}`);
      setConfig(response.data);
    } catch (error) {
      console.error("Error fetching WhatsApp config:", error);
    } finally {
      if (showLoading) {
        setLoading(false);  
      }
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      
      // Passa unit_id come parametro
      const params = new URLSearchParams();
      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      
      const response = await axios.post(`${API}/whatsapp-connect?${params}`);
      
      if (response.data.success) {
        toast({
          title: "Successo",
          description: "WhatsApp connesso con successo",
        });
        await fetchWhatsAppConfig(false); // Non mostrare loading
        setShowQRModal(false);
      }
    } catch (error) {
      console.error("Error connecting WhatsApp:", error);
      toast({
        title: "Errore",
        description: "Errore nella connessione WhatsApp",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const getStatusBadge = (status, isConnected) => {
    if (isConnected) {
      return <Badge className="bg-green-500">Connesso</Badge>;
    }
    
    switch (status) {
      case "connecting":
        return <Badge className="bg-yellow-500">Connessione in corso</Badge>;
      case "connected":
        return <Badge className="bg-green-500">Connesso</Badge>;
      default:
        return <Badge variant="destructive">Disconnesso</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Caricamento configurazione WhatsApp...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Gestione WhatsApp</h2>
          {selectedUnit && selectedUnit !== "all" && (
            <p className="text-sm text-slate-600 mt-1">
              Unit: {units?.find(u => u.id === selectedUnit)?.name || selectedUnit}
            </p>
          )}
        </div>
        <div className="flex space-x-2">
          {config?.configured && !config.is_connected && (
            <Button onClick={() => setShowQRModal(true)} className="bg-green-600 hover:bg-green-700">
              <MessageCircle className="w-4 h-4 mr-2" />
              Connetti WhatsApp
            </Button>
          )}
          <Button onClick={() => setShowConfigModal(true)}>
            <Settings className="w-4 h-4 mr-2" />
            {config?.configured ? "Modifica Configurazione" : "Configura Numero"}
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageCircle className="w-5 h-5" />
            <span>Stato WhatsApp Business</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {config?.configured ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{config.phone_number}</h3>
                    <p className="text-sm text-slate-500">Numero WhatsApp Business</p>
                  </div>
                </div>
                {getStatusBadge(config.connection_status, config.is_connected)}
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Stato Connessione</Label>
                  <p className="text-sm">{config.connection_status}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Ultima Attività</Label>
                  <p className="text-sm">
                    {config.last_seen ? new Date(config.last_seen).toLocaleString("it-IT") : "Mai connesso"}
                  </p>
                </div>
              </div>

              {config.is_connected && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-800 font-medium">WhatsApp Business Connesso</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    Il sistema può ora inviare e ricevere messaggi WhatsApp per i lead
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <span className="text-amber-700 font-medium">WhatsApp non configurato</span>
              </div>
              <p className="text-slate-600">
                Configura il tuo numero WhatsApp Business per abilitare la comunicazione automatica con i lead.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp Features */}
      {config?.configured && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lead Validation */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5" />
                <span>Validazione Lead</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-4">
                Valida automaticamente se i numeri dei lead sono su WhatsApp
              </p>
              <LeadWhatsAppValidator />
            </CardContent>
          </Card>

          {/* Chat Overview */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageCircle className="w-5 h-5" />
                <span>Conversazioni Attive</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500">Nessuna conversazione attiva</p>
                <p className="text-sm text-slate-400 mt-1">
                  Le conversazioni WhatsApp appariranno qui
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Configuration Modal */}
      {showConfigModal && (
        <WhatsAppConfigModal
          onClose={() => setShowConfigModal(false)}
          onSuccess={() => {
            fetchWhatsAppConfig(false); // Non mostrare loading
            setShowConfigModal(false);
          }}
          existingConfig={config}
          selectedUnit={selectedUnit}
        />
      )}

      {/* QR Code Modal */}
      {showQRModal && config?.qr_code && (
        <WhatsAppQRModal
          qrCode={config.qr_code}
          phoneNumber={config.phone_number}
          onClose={() => setShowQRModal(false)}
          onConnect={handleConnect}
          connecting={connecting}
        />
      )}
    </div>
  );
};

// WhatsApp Configuration Modal Component
const WhatsAppConfigModal = ({ onClose, onSuccess, existingConfig, selectedUnit }) => {
  const [phoneNumber, setPhoneNumber] = useState(existingConfig?.phone_number || "");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci un numero di telefono valido",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Remove all spaces and non-digit characters except + from phone number
      const cleanPhoneNumber = phoneNumber.trim().replace(/\s+/g, '').replace(/[^\d+]/g, '');
      
      const requestData = {
        phone_number: cleanPhoneNumber
      };
      
      // Aggiungi unit_id se specificato
      if (selectedUnit && selectedUnit !== "all") {
        requestData.unit_id = selectedUnit;
      }
      
      const response = await axios.post(`${API}/whatsapp-config`, requestData);

      if (response.data.success) {
        toast({
          title: "Successo",
          description: "Configurazione WhatsApp salvata con successo",
        });
        onSuccess();
      }
    } catch (error) {
      console.error("Error saving WhatsApp config:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nel salvataggio della configurazione",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existingConfig?.configured ? "Modifica" : "Configura"} WhatsApp Business
          </DialogTitle>
          <DialogDescription>
            Inserisci il numero di telefono WhatsApp Business
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="phone-number">Numero WhatsApp Business *</Label>
            <Input
              id="phone-number"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+39 123 456 7890"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Usa il formato internazionale (es: +39 per Italia)
            </p>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Requisiti:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Numero WhatsApp Business verificato</li>
                  <li>Formato internazionale (+prefisso numero)</li>
                  <li>Disponibile per connessione Web</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvataggio..." : "Salva Configurazione"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// WhatsApp QR Code Modal Component
const WhatsAppQRModal = ({ qrCode, phoneNumber, onClose, onConnect, connecting }) => {
  const [qrImageUrl, setQrImageUrl] = useState(null);
  
  useEffect(() => {
    const generateQRCode = async () => {
      try {
        // Importa QRCode dinamicamente
        const QRCode = (await import('qrcode')).default;
        
        // Decodifica il QR code base64 dal backend
        const qrData = atob(qrCode);
        
        // Genera il QR code come URL immagine
        const qrUrl = await QRCode.toDataURL(qrData, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
        
        setQrImageUrl(qrUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
        // Fallback: usa il qrCode direttamente
        setQrImageUrl(null);
      }
    };
    
    if (qrCode) {
      generateQRCode();
    }
  }, [qrCode]);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connetti WhatsApp Web</DialogTitle>
          <DialogDescription>
            Scansiona il QR code con WhatsApp per connettere il numero {phoneNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="w-64 h-64 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center">
              {qrImageUrl ? (
                <img 
                  src={qrImageUrl} 
                  alt="WhatsApp QR Code" 
                  className="w-full h-full object-contain p-4"
                />
              ) : (
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                  <p className="text-sm text-slate-500">Generazione QR Code...</p>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mt-2"></div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-green-50 p-3 rounded-lg">
            <div className="flex items-start space-x-2">
              <MessageCircle className="w-4 h-4 text-green-600 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-medium mb-1">Come connettere:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Apri WhatsApp sul telefono</li>
                  <li>Vai su Menu → WhatsApp Web</li>
                  <li>Scansiona questo QR code</li>
                  <li>Click "Connetti" quando pronto</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={onConnect} disabled={connecting} className="bg-green-600 hover:bg-green-700">
            {connecting ? "Connessione..." : "Connetti"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Lead WhatsApp Validator Component
const LeadWhatsAppValidator = () => {
  const [leads, setLeads] = useState([]);
  const [validating, setValidating] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchRecentLeads();
  }, []);

  const fetchRecentLeads = async () => {
    try {
      const response = await axios.get(`${API}/leads?limit=5`);
      setLeads(response.data);
    } catch (error) {
      console.error("Error fetching leads:", error);
    }
  };

  const validateLead = async (leadId) => {
    try {
      setValidating(leadId);
      const response = await axios.post(`${API}/whatsapp-validate-lead?lead_id=${leadId}`);
      
      if (response.data.success) {
        toast({
          title: response.data.message,
          description: `Lead: ${response.data.phone_number}`,
        });
        fetchRecentLeads(); // Refresh leads to show updated status
      }
    } catch (error) {
      console.error("Error validating lead:", error);
      toast({
        title: "Errore",
        description: "Errore nella validazione del lead",
        variant: "destructive",
      });
    } finally {
      setValidating(null);
    }
  };

  return (
    <div className="space-y-3">
      {leads.slice(0, 3).map((lead) => (
        <div key={lead.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div>
            <p className="font-medium text-sm">{lead.nome} {lead.cognome}</p>
            <p className="text-xs text-slate-500">{lead.telefono}</p>
          </div>
          <div className="flex items-center space-x-2">
            {lead.whatsapp_validated ? (
              <Badge variant={lead.is_whatsapp ? "default" : "destructive"}>
                {lead.is_whatsapp ? "WhatsApp" : "No WhatsApp"}
              </Badge>
            ) : (
              <Button
                onClick={() => validateLead(lead.id)}
                disabled={validating === lead.id}
                size="sm"
                variant="outline"
              >
                {validating === lead.id ? "..." : "Valida"}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// Workflow Builder Management Component (FASE 3)
const WorkflowBuilderManagement = ({ selectedUnit, units }) => {
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState("list"); // list, builder
  const { toast } = useToast();

  useEffect(() => {
    fetchWorkflows();
  }, [selectedUnit]);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      
      const response = await axios.get(`${API}/workflows?${params}`);
      setWorkflows(response.data);
    } catch (error) {
      console.error("Error fetching workflows:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei workflow",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = async (workflowData) => {
    try {
      const response = await axios.post(`${API}/workflows`, workflowData);
      setWorkflows([...workflows, response.data]);
      toast({
        title: "Successo",
        description: "Workflow creato con successo",
      });
      setShowCreateModal(false);
    } catch (error) {
      console.error("Error creating workflow:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nella creazione del workflow",
        variant: "destructive",
      });
    }
  };

  const handleEditWorkflow = (workflow) => {
    setSelectedWorkflow(workflow);
    setActiveView("builder");
  };

  const handleCopyWorkflow = async (workflowId, targetUnitId) => {
    try {
      const response = await axios.post(`${API}/workflows/${workflowId}/copy?target_unit_id=${targetUnitId}`);
      
      toast({
        title: "Successo",
        description: response.data.message,
      });
      
      // Refresh workflows list
      fetchWorkflows();
    } catch (error) {
      console.error("Error copying workflow:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nella copia del workflow",
        variant: "destructive",
      });
    }
  };

  const handleDeleteWorkflow = async (workflowId) => {
    if (!window.confirm("Sei sicuro di voler eliminare questo workflow?")) {
      return;
    }

    try {
      await axios.delete(`${API}/workflows/${workflowId}`);
      setWorkflows(workflows.filter(w => w.id !== workflowId));
      toast({
        title: "Successo",
        description: "Workflow eliminato con successo",
      });
    } catch (error) {
      console.error("Error deleting workflow:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'eliminazione del workflow",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-slate-600">Caricamento workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Workflow Builder</h1>
          <p className="text-slate-600">Crea e gestisci workflow automatizzati per il tuo CRM</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {activeView === "builder" && (
            <Button
              onClick={() => {
                setActiveView("list");
                setSelectedWorkflow(null);
              }}
              variant="outline"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Torna alla Lista
            </Button>
          )}
          
          {activeView === "list" && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Workflow
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {activeView === "list" ? (
        <WorkflowsList 
          workflows={workflows}
          units={units}
          selectedUnit={selectedUnit}
          onEdit={handleEditWorkflow}
          onDelete={handleDeleteWorkflow}
          onCopy={handleCopyWorkflow}
        />
      ) : (
        <WorkflowCanvas 
          workflow={selectedWorkflow}
          onBack={() => {
            setActiveView("list");
            setSelectedWorkflow(null);
          }}
          onSave={fetchWorkflows}
        />
      )}

      {/* Create Workflow Modal */}
      {showCreateModal && (
        <CreateWorkflowModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateWorkflow}
        />
      )}
    </div>
  );
};

// Workflow List Component
const WorkflowsList = ({ workflows, units, selectedUnit, onEdit, onDelete, onCopy }) => {
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [workflowToCopy, setWorkflowToCopy] = useState(null);

  const handleCopyClick = (workflow) => {
    setWorkflowToCopy(workflow);
    setShowCopyModal(true);
  };
  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">I Tuoi Workflow</h2>
        
        {workflows.length === 0 ? (
          <div className="text-center py-12">
            <Workflow className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 mb-2">Nessun workflow trovato</p>
            <p className="text-slate-500 text-sm">Crea il tuo primo workflow per automatizzare i processi del CRM</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {workflows.map((workflow) => (
              <div key={workflow.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Workflow className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-800">{workflow.name}</h3>
                        <p className="text-sm text-slate-600">{workflow.description}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant={workflow.is_published ? "default" : "outline"}>
                      {workflow.is_published ? "Pubblicato" : "Bozza"}
                    </Badge>
                    
                    <Badge variant={workflow.is_active ? "default" : "secondary"}>
                      {workflow.is_active ? "Attivo" : "Inattivo"}
                    </Badge>
                    
                    <div className="flex items-center space-x-1">
                      <Button
                        onClick={() => onEdit(workflow)}
                        size="sm"
                        variant="outline"
                        title="Modifica workflow"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        onClick={() => handleCopyClick(workflow)}
                        size="sm"
                        variant="outline"
                        title="Copia in altra Unit"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        onClick={() => onDelete(workflow.id)}
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3 flex items-center text-xs text-slate-500">
                  <Calendar className="w-3 h-3 mr-1" />
                  Creato il {new Date(workflow.created_at).toLocaleDateString('it-IT')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Copy Workflow Modal */}
      {showCopyModal && workflowToCopy && (
        <CopyWorkflowModal
          workflow={workflowToCopy}
          units={units}
          currentUnitId={selectedUnit}
          onClose={() => {
            setShowCopyModal(false);
            setWorkflowToCopy(null);
          }}
          onCopy={(targetUnitId) => {
            onCopy(workflowToCopy.id, targetUnitId);
            setShowCopyModal(false);
            setWorkflowToCopy(null);
          }}
        />
      )}
    </div>
  );
};

// Copy Workflow Modal
const CopyWorkflowModal = ({ workflow, units, currentUnitId, onClose, onCopy }) => {
  const [selectedTargetUnit, setSelectedTargetUnit] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Filter out current unit from available targets
  const availableUnits = units.filter(unit => unit.id !== currentUnitId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedTargetUnit) {
      toast({
        title: "Errore", 
        description: "Seleziona una Unit di destinazione",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      await onCopy(selectedTargetUnit);
    } catch (error) {
      // Error handled in parent component
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copia Workflow</DialogTitle>
          <DialogDescription>
            Copia "{workflow.name}" in un'altra Unit
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="target-unit">Unit di Destinazione</Label>
            <Select value={selectedTargetUnit} onValueChange={setSelectedTargetUnit}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona Unit..." />
              </SelectTrigger>
              <SelectContent>
                {availableUnits.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {availableUnits.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Nessuna altra Unit disponibile per la copia
              </p>
            )}
          </div>
          
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Nota:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Il workflow copiato sarà in stato "Bozza"</li>
                  <li>Tutti i nodi e connessioni verranno copiati</li>
                  <li>Potrai modificarlo nella Unit di destinazione</li>
                </ul>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || availableUnits.length === 0}
            >
              {isLoading ? "Copia in corso..." : "Copia Workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Create Workflow Modal
const CreateWorkflowModal = ({ onClose, onSuccess }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Errore",
        description: "Il nome del workflow è obbligatorio",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      await onSuccess({
        name: name.trim(),
        description: description.trim()
      });
    } catch (error) {
      // Error is handled in parent component
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crea Nuovo Workflow</DialogTitle>
          <DialogDescription>
            Crea un nuovo workflow per automatizzare i processi del tuo CRM
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome Workflow</Label>
            <Input
              id="name"
              type="text"
              placeholder="es. Benvenuto Nuovo Cliente"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="description">Descrizione (opzionale)</Label>
            <Textarea
              id="description"
              placeholder="Descrivi cosa fa questo workflow..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creazione..." : "Crea Workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Workflow Canvas Component with React Flow
const WorkflowCanvas = ({ workflow, onBack, onSave }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [nodeTypes, setNodeTypes] = useState({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch available node types from backend
  useEffect(() => {
    fetchNodeTypes();
  }, []);

  const fetchNodeTypes = async () => {
    try {
      const response = await axios.get(`${API}/workflow-node-types`);
      setNodeTypes(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching node types:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei tipi di nodi",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  // Handle connecting nodes
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  // Add new node to canvas
  const addNode = (nodeType, nodeSubtype, nodeName, color) => {
    const id = `${nodeType}_${Date.now()}`;
    const newNode = {
      id,
      type: 'default',
      position: { 
        x: Math.random() * 400 + 100, 
        y: Math.random() * 400 + 100 
      },
      data: { 
        label: nodeName,
        nodeType: nodeType,
        nodeSubtype: nodeSubtype
      },
      style: {
        background: getNodeColor(color),
        color: 'white',
        border: `2px solid ${getNodeColorDark(color)}`,
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 'bold',
        width: 180,
        height: 40
      }
    };
    
    setNodes((nds) => nds.concat(newNode));
  };

  // Get node background color
  const getNodeColor = (color) => {
    const colors = {
      green: '#10b981',
      blue: '#3b82f6',
      purple: '#8b5cf6',
      orange: '#f59e0b',
      yellow: '#eab308',
      red: '#ef4444',
      gray: '#6b7280'
    };
    return colors[color] || '#6b7280';
  };

  // Get node border color (darker)
  const getNodeColorDark = (color) => {
    const colors = {
      green: '#059669',
      blue: '#2563eb',
      purple: '#7c3aed',
      orange: '#d97706',
      yellow: '#ca8a04',
      red: '#dc2626',
      gray: '#4b5563'
    };
    return colors[color] || '#4b5563';
  };

  // Save workflow
  const handleSave = async () => {
    try {
      const workflowData = {
        workflow_data: {
          nodes: nodes,
          edges: edges,
          viewport: { x: 0, y: 0, zoom: 1 }
        }
      };

      await axios.put(`${API}/workflows/${workflow.id}`, workflowData);
      
      toast({
        title: "Successo",
        description: "Workflow salvato con successo",
      });
      
      onSave();
    } catch (error) {
      console.error("Error saving workflow:", error);
      toast({
        title: "Errore",
        description: "Errore nel salvataggio del workflow",
        variant: "destructive",
      });
    }
  };

  // Publish workflow
  const handlePublish = async () => {
    try {
      // Check if workflow has at least one trigger node
      const triggerNodes = nodes.filter(node => node.data.nodeType === 'trigger');
      if (triggerNodes.length === 0) {
        toast({
          title: "Errore",
          description: "Il workflow deve avere almeno un nodo Trigger per essere pubblicato",
          variant: "destructive",
        });
        return;
      }

      await axios.put(`${API}/workflows/${workflow.id}`, {
        is_published: true,
        workflow_data: {
          nodes: nodes,
          edges: edges,
          viewport: { x: 0, y: 0, zoom: 1 }
        }
      });
      
      toast({
        title: "Successo",
        description: "Workflow pubblicato con successo",
      });
      
      onSave();
    } catch (error) {
      console.error("Error publishing workflow:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nella pubblicazione del workflow",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 h-[600px] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-slate-600">Caricamento editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 h-[600px]">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div>
          <h2 className="text-lg font-semibold">{workflow?.name || "Nuovo Workflow"}</h2>
          <p className="text-sm text-slate-600">Trascina i nodi dalla sidebar nel canvas</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Salva
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handlePublish}>
            <Target className="w-4 h-4 mr-2" />
            Pubblica
          </Button>
        </div>
      </div>
      
      <div className="flex h-[calc(100%-73px)]">
        {/* Sidebar con nodi disponibili */}
        <div className="w-64 border-r border-slate-200 p-4 bg-slate-50 overflow-y-auto max-h-full">
          <h3 className="font-medium text-slate-700 mb-3 sticky top-0 bg-slate-50 pb-2">Nodi Disponibili</h3>
          
          {Object.entries(nodeTypes).map(([categoryKey, category]) => (
            <div key={categoryKey} className="mb-4">
              <h4 className="text-sm font-medium text-slate-600 mb-2">{category.name}</h4>
              <div className="space-y-2">
                {Object.entries(category.subtypes).map(([subtypeKey, subtype]) => {
                  const bgColorClass = `bg-${subtype.color}-50`;
                  const borderColorClass = `border-${subtype.color}-200`;
                  const hoverColorClass = `hover:bg-${subtype.color}-100`;
                  const dotColorClass = `bg-${subtype.color}-500`;
                  const textColorClass = `text-${subtype.color}-600`;
                  
                  return (
                    <div
                      key={subtypeKey}
                      className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                        subtype.color === 'green' ? 'bg-green-50 border-green-200 hover:bg-green-100' :
                        subtype.color === 'blue' ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' :
                        subtype.color === 'purple' ? 'bg-purple-50 border-purple-200 hover:bg-purple-100' :
                        subtype.color === 'orange' ? 'bg-orange-50 border-orange-200 hover:bg-orange-100' :
                        subtype.color === 'yellow' ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' :
                        subtype.color === 'red' ? 'bg-red-50 border-red-200 hover:bg-red-100' :
                        'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                      onClick={() => addNode(categoryKey, subtypeKey, subtype.name, subtype.color)}
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${
                          subtype.color === 'green' ? 'bg-green-500' :
                          subtype.color === 'blue' ? 'bg-blue-500' :
                          subtype.color === 'purple' ? 'bg-purple-500' :
                          subtype.color === 'orange' ? 'bg-orange-500' :
                          subtype.color === 'yellow' ? 'bg-yellow-500' :
                          subtype.color === 'red' ? 'bg-red-500' :
                          'bg-gray-500'
                        }`}></div>
                        <span className="text-sm font-medium">{subtype.name}</span>
                      </div>
                      <p className={`text-xs mt-1 ${
                        subtype.color === 'green' ? 'text-green-600' :
                        subtype.color === 'blue' ? 'text-blue-600' :
                        subtype.color === 'purple' ? 'text-purple-600' :
                        subtype.color === 'orange' ? 'text-orange-600' :
                        subtype.color === 'yellow' ? 'text-yellow-600' :
                        subtype.color === 'red' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>{subtype.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        
        {/* Canvas area with React Flow */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            style={{ width: '100%', height: '100%' }}
          >
            <Controls />
            <MiniMap />
            <Background variant="dots" gap={20} size={1} />
            
            {nodes.length === 0 && (
              <Panel position="center" className="bg-white p-4 rounded-lg shadow-lg border border-slate-200">
                <div className="text-center">
                  <Workflow className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-600 font-medium">Canvas Vuoto</p>
                  <p className="text-slate-500 text-sm">Clicca sui nodi nella sidebar per aggiungerli</p>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>
    </div>
  );
};

// Call Center Management Component
const CallCenterManagement = ({ selectedUnit, units }) => {
  const [activeView, setActiveView] = useState("dashboard"); // dashboard, agents, calls, analytics
  const [agents, setAgents] = useState([]);
  const [calls, setCalls] = useState([]);
  const [dashboardData, setDashboardData] = useState({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboardData();
    fetchAgents();
    fetchCalls();
  }, [selectedUnit]);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API}/call-center/analytics/dashboard`);
      setDashboardData(response.data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      // Mock data per sviluppo
      setDashboardData({
        active_calls: 5,
        available_agents: 8,
        calls_today: 127,
        answered_today: 115,
        abandoned_today: 12,
        answer_rate: 90.6,
        abandonment_rate: 9.4,
        avg_wait_time: 35.2
      });
    }
  };

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/call-center/agents`);
      setAgents(response.data);
    } catch (error) {
      console.error("Error fetching agents:", error);
      // Mock data per sviluppo
      setAgents([
        {
          id: "1",
          user_id: "user1",
          status: "available",
          skills: ["sales", "italian"],
          languages: ["italian", "english"],
          department: "sales",
          extension: "101",
          calls_in_progress: 0,
          total_calls_today: 23
        },
        {
          id: "2", 
          user_id: "user2",
          status: "busy",
          skills: ["support", "italian"],
          languages: ["italian"],
          department: "support",
          extension: "102",
          calls_in_progress: 1,
          total_calls_today: 18
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCalls = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      params.append('limit', '50');
      
      const response = await axios.get(`${API}/call-center/calls?${params}`);
      setCalls(response.data);
    } catch (error) {
      console.error("Error fetching calls:", error);
      // Mock data per sviluppo
      setCalls([
        {
          id: "1",
          call_sid: "CA123456789",
          direction: "inbound",
          from_number: "+393471234567",
          to_number: "+390612345678",
          status: "completed",
          agent_id: "user1",
          duration: 180,
          created_at: new Date().toISOString(),
          answered_at: new Date(Date.now() - 200000).toISOString(),
          ended_at: new Date(Date.now() - 20000).toISOString()
        }
      ]);
    }
  };

  const makeOutboundCall = async (phoneNumber) => {
    try {
      setLoading(true);
      const response = await axios.post(`${API}/call-center/calls/outbound`, {
        to_number: phoneNumber,
        from_number: "+390612345678" // Default caller ID
      });
      
      toast({
        title: "Chiamata Iniziata",
        description: `Chiamata verso ${phoneNumber} avviata con successo`,
      });
      
      // Refresh calls list
      fetchCalls();
      
    } catch (error) {
      console.error("Error making outbound call:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'avvio della chiamata",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateAgentStatus = async (agentId, newStatus) => {
    try {
      await axios.put(`${API}/call-center/agents/${agentId}/status`, {
        status: newStatus
      });
      
      toast({
        title: "Stato Aggiornato",
        description: `Stato agente aggiornato a ${newStatus}`,
      });
      
      fetchAgents();
      
    } catch (error) {
      console.error("Error updating agent status:", error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento dello stato",
        variant: "destructive",
      });
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <PhoneCall className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Chiamate Attive</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.active_calls || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Agenti Disponibili</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.available_agents || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Chiamate Oggi</p>
                <p className="text-2xl font-bold text-gray-900">{dashboardData.calls_today || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock4 className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Tempo Attesa Medio</p>
                <p className="text-2xl font-bold text-gray-900">{Math.round(dashboardData.avg_wait_time || 0)}s</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Metriche Prestazioni
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tasso di Risposta</span>
                <span className="text-lg font-semibold text-green-600">
                  {Math.round(dashboardData.answer_rate || 0)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tasso di Abbandono</span>
                <span className="text-lg font-semibold text-red-600">
                  {Math.round(dashboardData.abandonment_rate || 0)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Chiamate Risposte</span>
                <span className="text-lg font-semibold">{dashboardData.answered_today || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PhoneOutgoing className="w-5 h-5 mr-2" />
              Controlli Chiamate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <OutboundCallForm onCall={makeOutboundCall} loading={loading} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderAgents = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Gestione Agenti</h3>
        <Button onClick={() => {/* TODO: Add agent modal */}}>
          <UserPlus className="w-4 h-4 mr-2" />
          Nuovo Agente
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agente</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Dipartimento</TableHead>
                <TableHead>Chiamate Oggi</TableHead>
                <TableHead>Interno</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Headphones className="w-4 h-4" />
                      <span>Agente {agent.user_id}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        agent.status === "available" ? "default" :
                        agent.status === "busy" ? "destructive" : "secondary"
                      }
                    >
                      {agent.status === "available" ? "Disponibile" :
                       agent.status === "busy" ? "Occupato" : "Offline"}
                    </Badge>
                  </TableCell>
                  <TableCell>{agent.department}</TableCell>
                  <TableCell>{agent.total_calls_today}</TableCell>
                  <TableCell>{agent.extension}</TableCell>
                  <TableCell>
                    <Select
                      value={agent.status}
                      onValueChange={(value) => updateAgentStatus(agent.user_id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Disponibile</SelectItem>
                        <SelectItem value="busy">Occupato</SelectItem>
                        <SelectItem value="break">Pausa</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const renderCalls = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Registro Chiamate</h3>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={fetchCalls}>
            <Activity className="w-4 h-4 mr-2" />
            Aggiorna
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Direzione</TableHead>
                <TableHead>Numero</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Durata</TableHead>
                <TableHead>Data/Ora</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((call) => (
                <TableRow key={call.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {call.direction === "inbound" ? (
                        <PhoneIncoming className="w-4 h-4 text-green-600" />
                      ) : (
                        <PhoneOutgoing className="w-4 h-4 text-blue-600" />
                      )}
                      <span className="capitalize">{call.direction}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {call.direction === "inbound" ? call.from_number : call.to_number}
                  </TableCell>
                  <TableCell>{call.agent_id || "N/A"}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        call.status === "completed" ? "default" :
                        call.status === "failed" ? "destructive" : "secondary"
                      }
                    >
                      {call.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}` : "N/A"}
                  </TableCell>
                  <TableCell>
                    {new Date(call.created_at).toLocaleString('it-IT')}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {call.recording_url && (
                        <Button variant="outline" size="sm">
                          <Volume2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-slate-100 rounded-lg p-1">
        <Button
          variant={activeView === "dashboard" ? "default" : "ghost"}
          onClick={() => setActiveView("dashboard")}
          className="flex items-center space-x-2"
        >
          <BarChart3 className="w-4 h-4" />
          <span>Dashboard</span>
        </Button>
        <Button
          variant={activeView === "agents" ? "default" : "ghost"}
          onClick={() => setActiveView("agents")}
          className="flex items-center space-x-2"
        >
          <Headphones className="w-4 h-4" />
          <span>Agenti</span>
        </Button>
        <Button
          variant={activeView === "calls" ? "default" : "ghost"}
          onClick={() => setActiveView("calls")}
          className="flex items-center space-x-2"
        >
          <PhoneCall className="w-4 h-4" />
          <span>Chiamate</span>
        </Button>
      </div>

      {/* Content */}
      {activeView === "dashboard" && renderDashboard()}
      {activeView === "agents" && renderAgents()}
      {activeView === "calls" && renderCalls()}
    </div>
  );
};

// Outbound Call Form Component
const OutboundCallForm = ({ onCall, loading }) => {
  const [phoneNumber, setPhoneNumber] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (phoneNumber.trim()) {
      onCall(phoneNumber);
      setPhoneNumber("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="phone">Numero da Chiamare</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+39 123 456 7890"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
        ) : (
          <PhoneCall className="w-4 h-4 mr-2" />
        )}
        Avvia Chiamata
      </Button>
    </form>
  );
};

// Commesse Management Component
const CommesseManagement = ({ selectedUnit, units }) => {
  const [commesse, setCommesse] = useState([]);
  const [servizi, setServizi] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCommessa, setSelectedCommessa] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCommesse();
  }, [selectedUnit]);

  const fetchCommesse = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/commesse`);
      setCommesse(response.data);
    } catch (error) {
      console.error("Error fetching commesse:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle commesse",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchServizi = async (commessaId) => {
    try {
      const response = await axios.get(`${API}/commesse/${commessaId}/servizi`);
      console.log(`Servizi per commessa ${commessaId}:`, response.data);
      setServizi(response.data);
    } catch (error) {
      console.error("Error fetching servizi:", error);
      setServizi([]); // Reset servizi on error
    }
  };

  const createCommessa = async (commessaData) => {
    try {
      const response = await axios.post(`${API}/commesse`, commessaData);
      setCommesse([...commesse, response.data]);
      toast({
        title: "Successo",
        description: "Commessa creata con successo",
      });
    } catch (error) {
      console.error("Error creating commessa:", error);
      toast({
        title: "Errore",
        description: "Errore nella creazione della commessa",
        variant: "destructive",
      });
    }
  };

  const createServizio = async (servizioData) => {
    try {
      const response = await axios.post(`${API}/servizi`, servizioData);
      setServizi([...servizi, response.data]);
      toast({
        title: "Successo",
        description: "Servizio creato con successo",
      });
    } catch (error) {
      console.error("Error creating servizio:", error);
      toast({
        title: "Errore",
        description: "Errore nella creazione del servizio",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestione Commesse</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuova Commessa
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista Commesse */}
        <Card>
          <CardHeader>
            <CardTitle>Commesse Attive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {commesse.map((commessa) => (
                <div 
                  key={commessa.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedCommessa?.id === commessa.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    if (selectedCommessa?.id !== commessa.id) {
                      setServizi([]); // Reset servizi
                      setSelectedCommessa(commessa);
                      fetchServizi(commessa.id);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Building className="w-5 h-5 text-blue-600" />
                      <div>
                        <h3 className="font-medium">{commessa.nome}</h3>
                        {commessa.descrizione && (
                          <p className="text-sm text-gray-600">{commessa.descrizione}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={commessa.is_active ? "default" : "secondary"}>
                      {commessa.is_active ? "Attiva" : "Inattiva"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dettagli Commessa e Servizi */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedCommessa ? `Servizi - ${selectedCommessa.nome}` : 'Seleziona una Commessa'}
            </CardTitle>
            {selectedCommessa && (
              <Button 
                size="sm" 
                onClick={() => {
                  const nomeServizio = prompt("Nome del nuovo servizio:");
                  if (nomeServizio) {
                    createServizio({
                      commessa_id: selectedCommessa.id,
                      nome: nomeServizio
                    });
                  }
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Servizio
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {selectedCommessa ? (
              <div className="space-y-3">
                {servizi.map((servizio) => (
                  <div key={servizio.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Settings2 className="w-4 h-4 text-green-600" />
                        <span className="font-medium">{servizio.nome}</span>
                      </div>
                      <Badge variant={servizio.is_active ? "default" : "secondary"}>
                        {servizio.is_active ? "Attivo" : "Inattivo"}
                      </Badge>
                    </div>
                    {servizio.descrizione && (
                      <p className="text-sm text-gray-600 mt-1">{servizio.descrizione}</p>
                    )}
                  </div>
                ))}
                {servizi.length === 0 && (
                  <p className="text-gray-500 text-center py-4">
                    Nessun servizio configurato per questa commessa
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Seleziona una commessa per vedere i servizi
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Commessa Modal */}
      <CreateCommessaModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={createCommessa}
      />
    </div>
  );
};

// Sub Agenzie Management Component
const SubAgenzieManagement = ({ selectedUnit, units }) => {
  const [subAgenzie, setSubAgenzie] = useState([]);
  const [commesse, setCommesse] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSubAgenzie();
    fetchCommesse();
  }, [selectedUnit]);

  const fetchSubAgenzie = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/sub-agenzie`);
      setSubAgenzie(response.data);
    } catch (error) {
      console.error("Error fetching sub agenzie:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle sub agenzie",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  const createSubAgenzia = async (subAgenziaData) => {
    try {
      const response = await axios.post(`${API}/sub-agenzie`, subAgenziaData);
      setSubAgenzie([...subAgenzie, response.data]);
      toast({
        title: "Successo",
        description: "Sub Agenzia creata con successo",
      });
    } catch (error) {
      console.error("Error creating sub agenzia:", error);
      toast({
        title: "Errore",
        description: "Errore nella creazione della sub agenzia",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestione Sub Agenzie</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuova Sub Agenzia
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Responsabile</TableHead>
                <TableHead>Commesse Autorizzate</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Data Creazione</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subAgenzie.map((subAgenzia) => (
                <TableRow key={subAgenzia.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Store className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">{subAgenzia.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{subAgenzia.responsabile_id}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {subAgenzia.commesse_autorizzate.map((commessaId) => {
                        const commessa = commesse.find(c => c.id === commessaId);
                        return (
                          <Badge key={commessaId} variant="outline" className="text-xs">
                            {commessa?.nome || commessaId}
                          </Badge>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={subAgenzia.is_active ? "default" : "secondary"}>
                      {subAgenzia.is_active ? "Attiva" : "Inattiva"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(subAgenzia.created_at).toLocaleDateString('it-IT')}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <ShieldCheck className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Sub Agenzia Modal */}
      <CreateSubAgenziaModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={createSubAgenzia}
        commesse={commesse}
      />
    </div>
  );
};

// Clienti Management Component
const ClientiManagement = ({ selectedUnit, units }) => {
  const [clienti, setClienti] = useState([]);
  const [commesse, setCommesse] = useState([]);
  const [subAgenzie, setSubAgenzie] = useState([]);
  const [selectedCommessa, setSelectedCommessa] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCommesse();
    fetchClienti();
  }, [selectedUnit]);

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

  const fetchClienti = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCommessa) {
        params.append('commessa_id', selectedCommessa);
      }
      params.append('limit', '50');
      
      const response = await axios.get(`${API}/clienti?${params}`);
      setClienti(response.data);
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

  const createCliente = async (clienteData) => {
    try {
      const response = await axios.post(`${API}/clienti`, clienteData);
      setClienti([response.data, ...clienti]);
      toast({
        title: "Successo",
        description: "Cliente creato con successo",
      });
    } catch (error) {
      console.error("Error creating cliente:", error);
      toast({
        title: "Errore",
        description: "Errore nella creazione del cliente",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (selectedCommessa) {
      fetchClienti();
    }
  }, [selectedCommessa]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestione Clienti</h2>
        <div className="flex space-x-3">
          <Select 
            value={selectedCommessa || "all"} 
            onValueChange={(value) => setSelectedCommessa(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-48">
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
          <div className="flex space-x-2">
            <Button 
              onClick={() => {
                fetchSubAgenzie();
                setShowCreateModal(true);
              }}
              disabled={!selectedCommessa}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Cliente
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                fetchSubAgenzie();
                setShowImportModal(true);
              }}
              disabled={!selectedCommessa}
            >
              <Upload className="w-4 h-4 mr-2" />
              Importa Clienti
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Commessa</TableHead>
                <TableHead>Sub Agenzia</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Data Creazione</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clienti.map((cliente) => (
                <TableRow key={cliente.id}>
                  <TableCell>
                    <span className="font-mono text-sm">{cliente.cliente_id}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <FileUser className="w-4 h-4 text-green-600" />
                      <span>{cliente.nome} {cliente.cognome}</span>
                    </div>
                  </TableCell>
                  <TableCell>{cliente.email || 'N/A'}</TableCell>
                  <TableCell>{cliente.telefono}</TableCell>
                  <TableCell>
                    {commesse.find(c => c.id === cliente.commessa_id)?.nome || 'N/A'}
                  </TableCell>
                  <TableCell>
                    {subAgenzie.find(sa => sa.id === cliente.sub_agenzia_id)?.nome || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        cliente.status === "completato" ? "default" :
                        cliente.status === "in_lavorazione" ? "secondary" : "outline"
                      }
                    >
                      {cliente.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(cliente.created_at).toLocaleDateString('it-IT')}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {clienti.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {selectedCommessa ? 'Nessun cliente trovato per questa commessa' : 'Seleziona una commessa per vedere i clienti'}
              </p>
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
        selectedCommessa={selectedCommessa}
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
        selectedCommessa={selectedCommessa}
      />
    </div>
  );
};

// Modal Components
const CreateCommessaModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    nome: '',
    descrizione: '',
    responsabile_id: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ nome: '', descrizione: '', responsabile_id: '' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuova Commessa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome Commessa *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({...formData, nome: e.target.value})}
              required
            />
          </div>
          <div>
            <Label htmlFor="descrizione">Descrizione</Label>
            <Textarea
              id="descrizione"
              value={formData.descrizione}
              onChange={(e) => setFormData({...formData, descrizione: e.target.value})}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">
              Crea Commessa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const CreateSubAgenziaModal = ({ isOpen, onClose, onSubmit, commesse }) => {
  const [formData, setFormData] = useState({
    nome: '',
    descrizione: '',
    responsabile_id: '',
    commesse_autorizzate: []
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ nome: '', descrizione: '', responsabile_id: '', commesse_autorizzate: [] });
    onClose();
  };

  const toggleCommessa = (commessaId) => {
    setFormData(prev => ({
      ...prev,
      commesse_autorizzate: prev.commesse_autorizzate.includes(commessaId)
        ? prev.commesse_autorizzate.filter(id => id !== commessaId)
        : [...prev.commesse_autorizzate, commessaId]
    }));
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuova Sub Agenzia</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome Sub Agenzia *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({...formData, nome: e.target.value})}
              required
            />
          </div>
          <div>
            <Label htmlFor="responsabile_id">ID Responsabile *</Label>
            <Input
              id="responsabile_id"
              value={formData.responsabile_id}
              onChange={(e) => setFormData({...formData, responsabile_id: e.target.value})}
              placeholder="Inserisci l'ID dell'utente responsabile"
              required
            />
          </div>
          <div>
            <Label htmlFor="descrizione">Descrizione</Label>
            <Textarea
              id="descrizione"
              value={formData.descrizione}
              onChange={(e) => setFormData({...formData, descrizione: e.target.value})}
            />
          </div>
          <div>
            <Label>Commesse Autorizzate</Label>
            <div className="space-y-2 max-h-32 overflow-y-auto border rounded p-3">
              {commesse.map((commessa) => (
                <label key={commessa.id} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.commesse_autorizzate.includes(commessa.id)}
                    onChange={() => toggleCommessa(commessa.id)}
                    className="rounded border-gray-300"
                  />
                  <span>{commessa.nome}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">
              Crea Sub Agenzia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const CreateClienteModal = ({ isOpen, onClose, onSubmit, commesse, subAgenzie, selectedCommessa }) => {
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    email: '',
    telefono: '',
    indirizzo: '',
    citta: '',
    provincia: '',
    cap: '',
    codice_fiscale: '',
    partita_iva: '',
    commessa_id: selectedCommessa || '',
    sub_agenzia_id: '',
    note: ''
  });

  useEffect(() => {
    if (selectedCommessa) {
      setFormData(prev => ({ ...prev, commessa_id: selectedCommessa }));
    }
  }, [selectedCommessa]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      nome: '', cognome: '', email: '', telefono: '', indirizzo: '', 
      citta: '', provincia: '', cap: '', codice_fiscale: '', partita_iva: '',
      commessa_id: selectedCommessa || '', sub_agenzia_id: '', note: ''
    });
    onClose();
  };

  const availableSubAgenzie = subAgenzie.filter(sa => 
    sa.commesse_autorizzate.includes(formData.commessa_id)
  );

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo Cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="cognome">Cognome *</Label>
              <Input
                id="cognome"
                value={formData.cognome}
                onChange={(e) => setFormData({...formData, cognome: e.target.value})}
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="telefono">Telefono *</Label>
              <Input
                id="telefono"
                value={formData.telefono}
                onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="commessa_id">Commessa *</Label>
              <Select 
                value={formData.commessa_id || "none"} 
                onValueChange={(value) => setFormData({
                  ...formData, 
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
              <Label htmlFor="sub_agenzia_id">Sub Agenzia *</Label>
              <Select 
                value={formData.sub_agenzia_id || "none"} 
                onValueChange={(value) => setFormData({
                  ...formData, 
                  sub_agenzia_id: value === "none" ? "" : value
                })}
                disabled={!formData.commessa_id}
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

          <div>
            <Label htmlFor="indirizzo">Indirizzo</Label>
            <Input
              id="indirizzo"
              value={formData.indirizzo}
              onChange={(e) => setFormData({...formData, indirizzo: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="citta">Città</Label>
              <Input
                id="citta"
                value={formData.citta}
                onChange={(e) => setFormData({...formData, citta: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="provincia">Provincia</Label>
              <Input
                id="provincia"
                value={formData.provincia}
                onChange={(e) => setFormData({...formData, provincia: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="cap">CAP</Label>
              <Input
                id="cap"
                value={formData.cap}
                onChange={(e) => setFormData({...formData, cap: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="codice_fiscale">Codice Fiscale</Label>
              <Input
                id="codice_fiscale"
                value={formData.codice_fiscale}
                onChange={(e) => setFormData({...formData, codice_fiscale: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="partita_iva">Partita IVA</Label>
              <Input
                id="partita_iva"
                value={formData.partita_iva}
                onChange={(e) => setFormData({...formData, partita_iva: e.target.value})}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              value={formData.note}
              onChange={(e) => setFormData({...formData, note: e.target.value})}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">
              Crea Cliente
            </Button>
          </DialogFooter>
        </form>
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

  const availableSubAgenzie = subAgenzie.filter(sa => 
    sa.commesse_autorizzate.includes(config.commessa_id)
  );

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        resetModal();
        onClose();
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
            element={user ? <Dashboard /> : <Navigate to="/login" replace />}
          />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
};

const AppWithAuth = () => (
  <AuthProvider>
    <App />
  </AuthProvider>
);

export default AppWithAuth;