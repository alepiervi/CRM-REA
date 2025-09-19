import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import "./App.css";

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
  X
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

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error("Error fetching user:", error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, {
        username,
        password,
      });
      const { access_token, user: userData } = response.data;
      
      setToken(access_token);
      setUser(userData);
      localStorage.setItem("token", access_token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || "Login failed" 
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
  };

  return (
    <AuthContext.Provider 
      value={{ user, token, loading, login, logout }}
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
        
        <CardFooter className="pt-6 border-t border-slate-100">
          <p className="text-xs text-slate-500 text-center w-full">
            Account di default: <strong>admin</strong> / <strong>admin123</strong>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

// Unit Selector Component
const UnitSelector = ({ selectedUnit, onUnitChange, units, loading }) => {
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-slate-200 rounded-lg w-48"></div>
      </div>
    );
  }

  // Non-admin users should automatically use their unit
  if (user.role !== "admin" && user.unit_id) {
    const userUnit = units.find(u => u.id === user.unit_id);
    return (
      <div className="flex items-center space-x-2">
        <Building2 className="w-5 h-5 text-blue-600" />
        <span className="font-semibold text-slate-800">
          {userUnit?.name || "Unit Assegnata"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <Building2 className="w-5 h-5 text-blue-600" />
      <Select value={selectedUnit} onValueChange={onUnitChange}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Seleziona Unit" />
        </SelectTrigger>
        <SelectContent>
          {user.role === "admin" && (
            <SelectItem value="all">Tutte le Unit</SelectItem>
          )}
          {units.map((unit) => (
            <SelectItem key={unit.id} value={unit.id}>
              {unit.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

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

// Navigation Component
const Navigation = ({ activeTab, setActiveTab, selectedUnit, onUnitChange, units, unitsLoading }) => {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
        { id: "ai-config", label: "Configurazione AI", icon: Settings },
        { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "referente") {
      items.push(
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    }

    return items;
  };

  return (
    <div className="bg-white shadow-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-700 to-indigo-800 bg-clip-text text-transparent">
                  CRM
                </h1>
                <p className="text-xs text-slate-500">Lead Manager</p>
              </div>
            </div>
            
            {/* Unit Selector */}
            <div className="hidden md:block border-l border-slate-200 pl-4">
              <UnitSelector 
                selectedUnit={selectedUnit}
                onUnitChange={onUnitChange}
                units={units}
                loading={unitsLoading}
              />
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {getNavItems().map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === item.id
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium text-slate-800">{user.username}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
            <Button
              onClick={logout}
              variant="ghost"
              size="sm"
              className="text-slate-600 hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>

          {/* Mobile menu button */}
          <Button
            className="md:hidden"
            variant="ghost"
            size="sm"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-200 space-y-4">
            {/* Mobile Unit Selector */}
            <div className="px-3">
              <UnitSelector 
                selectedUnit={selectedUnit}
                onUnitChange={(value) => {
                  onUnitChange(value);
                  setIsMobileMenuOpen(false);
                }}
                units={units}
                loading={unitsLoading}
              />
            </div>
            
            <div className="space-y-1">
              {getNavItems().map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center space-x-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeTab === item.id
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
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
  const { user } = useAuth();

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
      case "ai-config":
        return user.role === "admin" ? <AIConfigurationManagement /> : <div>Non autorizzato</div>;
      case "analytics":
        return <AnalyticsManagement selectedUnit={selectedUnit} units={units} />;
      default:
        return <DashboardStats selectedUnit={selectedUnit} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        selectedUnit={selectedUnit}
        onUnitChange={handleUnitChange}
        units={units}
        unitsLoading={unitsLoading}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTabContent()}
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
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [filters, setFilters] = useState({
    lead_id: "",
    nome: "",
    cognome: "",
    uploaded_by: "",
    date_from: "",
    date_to: "",
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchDocuments();
  }, [selectedUnit, filters]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      // Add all filter parameters
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim()) {
          params.append(key, value.trim());
        }
      });
      
      // Add unit filter if selected
      if (selectedUnit && selectedUnit !== "all") {
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

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div>
              <Label>Lead ID</Label>
              <Input
                placeholder="Filtra per Lead ID"
                value={filters.lead_id}
                onChange={(e) => setFilters({ ...filters, lead_id: e.target.value })}
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
                  lead_id: "",
                  nome: "",
                  cognome: "",
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
                  <TableHead>Lead</TableHead>
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
                      {doc.lead ? (
                        <div>
                          <div className="font-medium">{doc.lead.nome} {doc.lead.cognome}</div>
                          <div className="text-xs text-slate-500">ID: {doc.lead.lead_id}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Lead non trovato</span>
                      )}
                    </TableCell>
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
const DocumentUploadModal = ({ onClose, onSuccess, units, selectedUnit }) => {
  const [selectedLead, setSelectedLead] = useState("");
  const [leads, setLeads] = useState([]);
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchLeads();
  }, [selectedUnit]);

  const fetchLeads = async () => {
    try {
      setLeadsLoading(true);
      const params = new URLSearchParams();
      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      
      const response = await axios.get(`${API}/leads?${params}`);
      setLeads(response.data);
    } catch (error) {
      console.error("Error fetching leads:", error);
    } finally {
      setLeadsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedLead || !file) {
      toast({
        title: "Errore",
        description: "Seleziona un lead e un file PDF",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploaded_by', user.username);

      await axios.post(`${API}/documents/upload/${selectedLead}`, formData, {
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
          <DialogTitle>Carica Documento</DialogTitle>
          <DialogDescription>
            Carica un documento PDF per un lead specifico
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="lead">Lead *</Label>
            <Select value={selectedLead} onValueChange={setSelectedLead}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona lead" />
              </SelectTrigger>
              <SelectContent>
                {leadsLoading ? (
                  <SelectItem value="loading" disabled>Caricamento...</SelectItem>
                ) : (
                  leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.nome} {lead.cognome} - {lead.email}
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
            <Button type="submit" disabled={isLoading || !selectedLead || !file}>
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