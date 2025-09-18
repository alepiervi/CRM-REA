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
  ChevronDown
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
      if (selectedUnit) {
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
    ];

    if (user.role === "admin") {
      items.push(
        { id: "users", label: "Utenti", icon: Users },
        { id: "containers", label: "Contenitori", icon: Home }
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
  const [selectedUnit, setSelectedUnit] = useState("");
  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchUnits();
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

  const handleUnitChange = (unitId) => {
    setSelectedUnit(unitId);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardStats selectedUnit={selectedUnit} />;
      case "leads":
        return <LeadsManagement selectedUnit={selectedUnit} />;
      case "users":
        return user.role === "admin" ? <UsersManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
      case "containers":
        return user.role === "admin" ? <ContainersManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
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

// Leads Management Component
const LeadsManagement = ({ selectedUnit }) => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [filters, setFilters] = useState({
    campagna: "",
    provincia: "",
    date_from: "",
    date_to: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchLeads();
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

  const updateLead = async (leadId, esito, note) => {
    try {
      await axios.put(`${API}/leads/${leadId}`, { esito, note });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-800">Gestione Lead</h2>
        <Button onClick={fetchLeads} variant="outline" size="sm">
          <Search className="w-4 h-4 mr-2" />
          Aggiorna
        </Button>
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
                      <Button
                        onClick={() => setSelectedLead(lead)}
                        variant="ghost"
                        size="sm"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
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
        />
      )}
    </div>
  );
};

// Lead Detail Modal Component
const LeadDetailModal = ({ lead, onClose, onUpdate }) => {
  const [esito, setEsito] = useState(lead.esito || "");
  const [note, setNote] = useState(lead.note || "");

  const handleSave = () => {
    onUpdate(lead.id, esito, note);
  };

  const esitoOptions = [
    "FISSATO APPUNTAMENTO",
    "KO",
    "NR", 
    "RICHIAMARE",
    "CONTRATTUALIZATO"
  ];

  return (
    <Dialog open={!!lead} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Dettagli Lead</span>
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
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            <CheckCircle className="w-4 h-4 mr-2" />
            Salva Modifiche
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Users Management Component (Admin only)
const UsersManagement = ({ selectedUnit, units }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [provinces, setProvinces] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchProvinces();
  }, [selectedUnit]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedUnit) {
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
          Gestione Utenti {selectedUnit && `- ${units.find(u => u.id === selectedUnit)?.name}`}
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
                      <Button
                        onClick={() => toggleUserStatus(user.id, user.is_active)}
                        variant={user.is_active ? "destructive" : "default"}
                        size="sm"
                        className="mr-2"
                      >
                        {user.is_active ? (
                          <>
                            <PowerOff className="w-3 h-3 mr-1" />
                            Disattiva
                          </>
                        ) : (
                          <>
                            <Power className="w-3 h-3 mr-1" />
                            Attiva
                          </>
                        )}
                      </Button>
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
          selectedUnit={selectedUnit}
        />
      )}
    </div>
  );
};

// Create User Modal Component
const CreateUserModal = ({ onClose, onSuccess, provinces, units, selectedUnit }) => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "",
    unit_id: selectedUnit || "",
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

// Containers Management Component (Admin only)
const ContainersManagement = ({ selectedUnit, units }) => {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
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
      if (selectedUnit) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-800">
          Gestione Contenitori {selectedUnit && `- ${units.find(u => u.id === selectedUnit)?.name}`}
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
                  <CardTitle className="flex items-center space-x-2">
                    <Home className="w-5 h-5 text-green-600" />
                    <span>{container.name}</span>
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
    </div>
  );
};

// Create Container Modal Component
const CreateContainerModal = ({ onClose, onSubmit, units, selectedUnit }) => {
  const [formData, setFormData] = useState({
    name: "",
    unit_id: selectedUnit || "",
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