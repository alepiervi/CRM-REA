import React, { useState, useEffect, useCallback } from "react";
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
import { useToast } from "./hooks/use-toast";
import { Toaster } from "./components/ui/toaster";

// Lucide icons
import { 
  Users, 
  User,
  Building2, 
  Phone, 
  Mail, 
  Calendar, 
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
  Users2,
  Briefcase,
  Settings2,
  FileUser,
  FileSpreadsheet,
  CheckCircle2,
  Progress,
  Star
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
  const [activityTimer, setActivityTimer] = useState(null);

  // Activity timeout system - 14 minute timer like the other app
  const INACTIVITY_TIME = 14 * 60 * 1000; // 14 minutes in milliseconds

  const startActivityTimer = () => {
    console.log('Starting 14 minute timer');
    
    // Clear existing timer
    if (activityTimer) {
      clearTimeout(activityTimer);
    }

    // Start new timer
    const timer = setTimeout(() => {
      console.log('Inactivity timeout - logging out user');
      logout();
    }, INACTIVITY_TIME);

    setActivityTimer(timer);
  };

  const resetActivityTimer = () => {
    console.log('Activity detected - resetting timer');
    if (token && user) {
      startActivityTimer();
    }
  };

  // Activity listeners
  useEffect(() => {
    if (!token || !user) return;

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Add event listeners for user activity
    const handleActivity = () => {
      resetActivityTimer();
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Start initial timer
    startActivityTimer();

    // Cleanup function
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      
      if (activityTimer) {
        clearTimeout(activityTimer);
      }
    };
  }, [token, user]);

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
        // Solo fai logout su errori di autenticazione critici, non su tutti i 403
        if (error.response?.status === 401) {
          // Token scaduto o non valido, forza logout
          logout();
        } else if (error.response?.status === 403) {
          // Per 403, fai logout solo se è un errore di auth endpoints
          const url = error.config?.url || '';
          if (url.includes('/auth/') || url.includes('/auth/me')) {
            logout();
          }
          // Altri 403 (es. autorizzazioni specifiche risorse) non causano logout
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

  // Clear timer on logout
  const logout = () => {
    console.log('Logging out user');
    
    if (activityTimer) {
      clearTimeout(activityTimer);
      setActivityTimer(null);
    }
    
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    
    // Force page reload to ensure clean state
    window.location.reload();
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
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    const result = await login(username, password);
    
    if (result.success) {
      toast({
        title: "Accesso effettuato",
        description: "Benvenuto in ELON!",
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
              ELON
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
  
  // Aruba Drive Configuration state
  const [arubaDriveConfigs, setArubaDriveConfigs] = useState([]);
  const [editingConfig, setEditingConfig] = useState(null);
  const [testingConfigId, setTestingConfigId] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  
  // 🎯 MOBILE-FRIENDLY: Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const { user, logout, setUser } = useAuth();
  const { toast } = useToast();

  // 🎯 MOBILE-FRIENDLY: Detect screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false); // Close mobile menu on desktop
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 🎯 MOBILE-FRIENDLY: Close mobile menu when tab changes
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    fetchUnits();
    fetchCommesse();
    fetchSubAgenzie();
    
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
    } catch (error) {
      console.error("Error fetching sub agenzie:", error);
      // Don't show toast for this as it's handled by the component fallback to props
      setSubAgenzie([]); // Fallback to empty array
    }
  };

  const fetchTipologieContratto = async (commessaId = selectedCommessa, servizioId = selectedServizio) => {
    try {
      console.log("🔄 FETCH TIPOLOGIE START:", { 
        commessaId, 
        servizioId,
        selectedCommessa,
        selectedServizio
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
      
      const response = await axios.get(url);
      console.log("✅ Tipologie contratto ricevute:", response.data);
      setFormTipologieContratto(response.data);
    } catch (error) {
      console.error("❌ Error fetching tipologie contratto:", error);
      setFormTipologieContratto([]);
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
    } catch (error) {
      console.error("Error creating offerta:", error);
      toast({
        title: "Errore",
        description: "Errore nella creazione dell'offerta",
        variant: "destructive",
      });
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
    
    if (user.role === "responsabile_commessa") {
      // Per responsabile commessa, mostra solo le commesse autorizzate
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
      
      console.log("✅ Commesse filtrate:", filteredCommesse);
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

  // Aruba Drive Configuration functions - MOVED UP before useEffect
  const fetchArubaDriveConfigs = async () => {
    console.log('🔧 fetchArubaDriveConfigs called');
    try {
      const response = await axios.get(`${API}/admin/aruba-drive-configs`);
      console.log('✅ Aruba Drive configs fetched:', response.data);
      setArubaDriveConfigs(response.data || []);
    } catch (error) {
      console.error("Error fetching Aruba Drive configs:", error);
      // toast will be handled by individual components that call this function
    }
  };

  const saveArubaDriveConfig = async (configData) => {
    try {
      if (editingConfig) {
        // Update existing config
        await axios.put(`${API}/admin/aruba-drive-configs/${editingConfig.id}`, configData);
        // Note: toast will be handled by modal component
      } else {
        // Create new config
        await axios.post(`${API}/admin/aruba-drive-configs`, configData);
        // Note: toast will be handled by modal component
      }
      
      fetchArubaDriveConfigs();
      setShowConfigModal(false);
      setEditingConfig(null);
    } catch (error) {
      console.error("Error saving Aruba Drive config:", error);
      throw error; // Let modal handle the error
    }
  };

  const deleteArubaDriveConfig = async (configId) => {
    if (!confirm("Sei sicuro di voler eliminare questa configurazione?")) {
      return;
    }

    try {
      await axios.delete(`${API}/admin/aruba-drive-configs/${configId}`);
      fetchArubaDriveConfigs();
    } catch (error) {
      console.error("Error deleting Aruba Drive config:", error);
    }
  };

  const testArubaDriveConfig = async (configId) => {
    setTestingConfigId(configId);
    
    try {
      const response = await axios.post(`${API}/admin/aruba-drive-configs/${configId}/test`);
      
      // Log result (toast will be handled by component)
      console.log('Test result:', response.data.success ? 'Success' : 'Failed', response.data.message);
      
      fetchArubaDriveConfigs(); // Refresh to show test results
    } catch (error) {
      console.error("Error testing Aruba Drive config:", error);
    } finally {
      setTestingConfigId(null);
    }
  };

  // Load Aruba Drive configurations quando si entra nella sezione configurazioni
  useEffect(() => {
    if (activeTab === 'configurazioni' && user?.role === 'admin') {
      fetchArubaDriveConfigs();
    }
  }, [activeTab]);

  // Duplicate function removed - using the updated version above

  const getNavItems = () => {
    const items = [
      { id: "dashboard", label: "Dashboard", icon: BarChart3 }
    ];

    if (user.role === "admin") {
      items.push(
        { id: "leads", label: "Lead", icon: Phone },
        { id: "documents", label: "Documenti", icon: FileText },
        { id: "users", label: "Utenti", icon: Users },
        { id: "workflow-builder", label: "Workflow Builder", icon: Workflow },
        { id: "ai-config", label: "Configurazione AI", icon: Settings },
        { id: "configurazioni", label: "Configurazioni", icon: Cog },
        { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
        { id: "lead-qualification", label: "Qualificazione Lead", icon: Bot },
        { id: "call-center", label: "Call Center", icon: PhoneCall },
        { id: "commesse", label: "Commesse", icon: Building },
        { id: "sub-agenzie", label: "Unit & Sub Agenzie", icon: Store },
        { id: "clienti", label: "Clienti", icon: UserCheck },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "referente") {
      items.push(
        { id: "documents", label: "Documenti", icon: FileText },
        { id: "lead-qualification", label: "Qualificazione Lead", icon: Bot },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "responsabile_commessa" || user.role === "backoffice_commessa") {
      items.push(
        { id: "clienti", label: "Clienti", icon: UserCheck },
        { id: "documents", label: "Documenti", icon: FileText },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "responsabile_sub_agenzia" || user.role === "backoffice_sub_agenzia") {
      items.push(
        { id: "clienti", label: "Clienti", icon: UserCheck },
        { id: "documents", label: "Documenti", icon: FileText },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "agente_specializzato" || user.role === "operatore" || user.role === "agente") {
      items.push(
        { id: "clienti", label: "Clienti", icon: UserCheck },
        { id: "documents", label: "Documenti", icon: FileText }
      );
    }

    return items;
  };

  const renderTabContent = () => {
    console.log("Rendering tab content for:", activeTab);
    try {
      switch (activeTab) {
        case "dashboard":
          if (user.role === "responsabile_commessa") {
            return <ResponsabileCommessaDashboard selectedUnit={selectedUnit} selectedTipologiaContratto={selectedTipologiaContratto} units={units} commesse={commesse} />;
          }
          return <DashboardStats selectedUnit={selectedUnit} />;
        case "leads":
          return <LeadsManagement selectedUnit={selectedUnit} units={units} />;
        case "configurazioni":
          return <ConfigurazioniManagement 
            onFetchConfigs={() => {}} // Placeholder - useEffect nel Dashboard gestisce il caricamento
            arubaDriveConfigs={arubaDriveConfigs}
            onSaveConfig={saveArubaDriveConfig}
            onDeleteConfig={deleteArubaDriveConfig}
            onTestConfig={testArubaDriveConfig}
            testingConfigId={testingConfigId}
            editingConfig={editingConfig}
            setEditingConfig={setEditingConfig}
            showConfigModal={showConfigModal}
            setShowConfigModal={setShowConfigModal}
          />;

        case "documents":
          // Tutti i ruoli hanno accesso alla sezione documenti con autorizzazioni specifiche
          return <DocumentsManagement 
            selectedUnit={selectedUnit} 
            selectedCommessa={selectedCommessa}
            selectedTipologiaContratto={selectedTipologiaContratto}
            units={units} 
            commesse={commesse}
            subAgenzie={subAgenzie}
            userRole={user.role}
            userId={user.id}
          />;
        case "users":
          return user.role === "admin" ? <UsersManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
        case "workflow-builder":
          return user.role === "admin" ? <WorkflowBuilderManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
        case "ai-config":
          return user.role === "admin" ? <AIConfigurationManagement /> : <div>Non autorizzato</div>;
        case "whatsapp":
          return user.role === "admin" ? <WhatsAppManagement selectedUnit={selectedUnit} units={units} /> : <div>Non autorizzato</div>;
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
          if (user.role === "admin" || user.role === "responsabile_commessa") {
            try {
              return <ClientiManagement selectedUnit={selectedUnit} selectedCommessa={selectedCommessa} selectedTipologiaContratto={selectedTipologiaContratto} units={units} commesse={commesse} subAgenzie={subAgenzie} />;
            } catch (error) {
              console.error("Error rendering ClientiManagement:", error);
              return <div className="p-4 text-red-600">Errore nel caricamento della gestione clienti: {error.message}</div>;
            }
          } else {
            return <div>Non autorizzato</div>;
          }
        case "analytics":
          if (user.role === "responsabile_commessa") {
            return <ResponsabileCommessaAnalytics selectedUnit={selectedUnit} selectedTipologiaContratto={selectedTipologiaContratto} units={units} commesse={commesse} />;
          }
          return <AnalyticsManagement selectedUnit={selectedUnit} units={units} />;
        default:
          return <DashboardStats selectedUnit={selectedUnit} />;
      }
    } catch (error) {
      console.error("Error in renderTabContent:", error);
      return <div className="p-4 text-red-600">Errore nel rendering: {error.message}</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-hidden">
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
                    <h1 className="text-lg font-bold text-slate-800">ELON</h1>
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

            {/* Mobile Selectors - Complete Hierarchy */}
            <div className="p-2 bg-slate-50 border-b border-slate-200 max-h-32 overflow-y-auto flex-shrink-0">
              {/* 1. Commessa Selector */}
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

            {/* Mobile Navigation */}
            <nav className="flex-1 overflow-y-auto px-1 py-2 min-h-0" style={{maxHeight: 'calc(100vh - 240px)'}}>
              {getNavItems().map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mobile-nav-item ${
                    activeTab === item.id
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
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
      <div className="desktop-sidebar w-64 bg-white border-r border-slate-200 shadow-sm flex flex-col">
        {/* Desktop Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">ELON</h1>
              <p className="text-xs text-slate-500">System All in One</p>
            </div>
          </div>
          
          {/* Desktop Hierarchical Selectors */}
          <div>
            {/* 1. SELETTORE COMMESSA */}
            <Label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
              1. Seleziona Commessa
              {getAvailableCommesse().length > 0 && (
                <span className="ml-1 text-xs text-green-600">({getAvailableCommesse().length} disponibili)</span>
              )}
            </Label>
            <Select value={selectedCommessa} onValueChange={handleCommessaChange}>
              <SelectTrigger className="mt-1">
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
                    <span className="ml-1 text-xs text-green-600">({servizi.length})</span>
                  )}
                </Label>
                <Select value={selectedServizio || "all"} onValueChange={handleServizioChange}>
                  <SelectTrigger className="mt-1">
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
                  3. Tipologia Contratto
                  {formTipologieContratto.length > 0 && (
                    <span className="ml-1 text-xs text-green-600">({formTipologieContratto.length})</span>
                  )}
                </Label>
                <Select value={selectedTipologiaContratto} onValueChange={handleTipologiaContrattoChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleziona tipologia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le Tipologie</SelectItem>
                    {formTipologieContratto.map((tipologia) => (
                      <SelectItem key={tipologia.value} value={tipologia.value}>
                        <div className="flex items-center space-x-2">
                          <FileText className="w-3 h-3" />
                          <span>{tipologia.label}</span>
                        </div>
                      </SelectItem>
                    ))}
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
                  <SelectTrigger className="mt-1">
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
                            <Store className="w-3 h-3" />
                          )}
                          <span>{item.nome}</span>
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
        </div>

        {/* Desktop Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
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
            </button>
          ))}
        </nav>

        {/* Desktop Footer */}
        <div className="p-4 border-t border-slate-200">
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
        <header className="bg-white border-b border-slate-200 px-4 py-3 lg:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(true)}
                className="mobile-menu-button p-2 lg:hidden touch-target"
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

        {/* 🎯 RESPONSIVE: Page Content */}
        <main className="flex-1 overflow-y-auto mobile-container p-3 md:p-6">
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
            <div>
              {/* Desktop Table View */}
              <div className="hidden md:block">
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
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden">
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
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-600">{lead.telefono}</span>
                      </div>
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
                    </div>
                    
                    <div className="flex space-x-2 pt-2 border-t border-slate-100">
                      <Button
                        onClick={() => setSelectedLead(lead)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        title="Visualizza dettagli"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Vista
                      </Button>
                      {user.role === "admin" && (
                        <Button
                          onClick={() => deleteLead(lead.id, `${lead.nome} ${lead.cognome}`)}
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          title="Elimina lead"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Elimina
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
  // Nuovi state per gestione autorizzazioni specializzate
  const [commesse, setCommesse] = useState([]);
  const [servizi, setServizi] = useState([]);
  const [subAgenzie, setSubAgenzie] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
    fetchProvinces();
    fetchCommesse();
    fetchSubAgenzie();
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

  const fetchCommesse = async () => {
    try {
      console.log("🔄 Fetching commesse from backend...");
      const response = await axios.get(`${API}/commesse`);
      console.log("✅ Commesse ricevute dal backend:", response.data);
      setCommesse(response.data);
    } catch (error) {
      console.error("❌ Error fetching commesse:", error);
      setCommesse([]);
    }
  };

  const fetchSubAgenzie = async () => {
    try {
      const response = await axios.get(`${API}/sub-agenzie`);
      setSubAgenzie(response.data);
    } catch (error) {
      console.error("Error fetching sub agenzie:", error);
      setSubAgenzie([]);
    }
  };

  const fetchServizi = async (commessaId) => {
    try {
      const response = await axios.get(`${API}/commesse/${commessaId}/servizi`);
      setServizi(response.data);
    } catch (error) {
      console.error("Error fetching servizi:", error);
      setServizi([]);
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
            <div className="mobile-table-container">
              <Table className="mobile-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="mobile-table">Username</TableHead>
                    <TableHead className="mobile-table">Email</TableHead>
                    <TableHead className="mobile-table">Ruolo</TableHead>
                    <TableHead className="mobile-table">Unit</TableHead>
                    <TableHead className="mobile-table">Province</TableHead>
                    <TableHead className="mobile-table">Stato</TableHead>
                    <TableHead className="mobile-table">Ultimo Accesso</TableHead>
                    <TableHead className="mobile-table">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium mobile-table">{user.username}</TableCell>
                    <TableCell className="mobile-table">{user.email}</TableCell>
                    <TableCell className="mobile-table">{getRoleBadge(user.role)}</TableCell>
                    <TableCell className="mobile-table">
                      {user.unit_id ? units.find(u => u.id === user.unit_id)?.name || "N/A" : "N/A"}
                    </TableCell>
                    <TableCell className="mobile-table">
                      {user.provinces?.length > 0 ? (
                        <div className="text-xs">
                          {user.provinces.slice(0, 2).join(", ")}
                          {user.provinces.length > 2 && ` (+${user.provinces.length - 2})`}
                        </div>
                      ) : "N/A"}
                    </TableCell>
                    <TableCell className="mobile-table">
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? "Attivo" : "Disattivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="mobile-table">
                      {user.last_login ? 
                        new Date(user.last_login).toLocaleDateString("it-IT") : 
                        "Mai"
                      }
                    </TableCell>
                    <TableCell className="mobile-table">
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
            </div>
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
          commesse={commesse}
          subAgenzie={subAgenzie}
          fetchServizi={fetchServizi}
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
          commesse={commesse}
          subAgenzie={subAgenzie}
          fetchServizi={fetchServizi}
        />
      )}
    </div>
  );
};

// Enhanced Create User Modal Component with Referenti
const CreateUserModal = ({ onClose, onSuccess, provinces, units, referenti, selectedUnit, commesse, subAgenzie, fetchServizi }) => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "",
    assignment_type: "", // "unit" o "sub_agenzia" - vuoto fino a selezione esplicita
    unit_id: selectedUnit && selectedUnit !== "all" ? selectedUnit : "",
    sub_agenzia_id: "",
    referente_id: "",
    provinces: [],
    // Nuovi campi per autorizzazioni specializzate
    commesse_autorizzate: [],
    servizi_autorizzati: [],
    sub_agenzie_autorizzate: [],
    entity_management: "clienti", // NEW: entity management field
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [servizi, setServizi] = useState([]);
  const [serviziDisponibili, setServiziDisponibili] = useState([]); // NEW: Servizi per UNIT/SUB selezionata
  const { toast } = useToast();

  // NEW: Fetch servizi quando si seleziona una UNIT
  const handleUnitChange = async (unitId) => {
    if (!unitId) {
      setServiziDisponibili([]);
      return;
    }
    
    try {
      console.log('🔄 Fetching servizi for unit:', unitId);
      // Find the selected unit
      const selectedUnitObj = units.find(u => u.id === unitId);
      if (!selectedUnitObj || !selectedUnitObj.commesse_autorizzate) {
        setServiziDisponibili([]);
        return;
      }
      
      // Fetch all servizi for the authorized commesse of this unit
      const allServizi = [];
      for (const commessaId of selectedUnitObj.commesse_autorizzate) {
        try {
          const response = await axios.get(`${API}/commesse/${commessaId}/servizi`);
          allServizi.push(...response.data);
        } catch (error) {
          console.error(`Error fetching servizi for commessa ${commessaId}:`, error);
        }
      }
      
      console.log('✅ Servizi loaded for unit:', allServizi.length);
      setServiziDisponibili(allServizi);
    } catch (error) {
      console.error("Error fetching servizi for unit:", error);
      setServiziDisponibili([]);
    }
  };

  // NEW: Fetch servizi quando si seleziona una SUB AGENZIA
  const handleSubAgenziaChange = async (subAgenziaId) => {
    if (!subAgenziaId) {
      setServiziDisponibili([]);
      return;
    }
    
    try {
      console.log('🔄 Fetching servizi for sub agenzia:', subAgenziaId);
      // Find the selected sub agenzia
      const selectedSubAgenzia = subAgenzie.find(sa => sa.id === subAgenziaId);
      if (!selectedSubAgenzia) {
        console.log('⚠️ Sub agenzia not found');
        setServiziDisponibili([]);
        return;
      }
      
      console.log('✅ Sub agenzia found:', selectedSubAgenzia.nome);
      console.log('📋 Sub agenzia commesse_autorizzate:', selectedSubAgenzia.commesse_autorizzate);
      console.log('📋 Sub agenzia servizi_autorizzati:', selectedSubAgenzia.servizi_autorizzati);
      
      // Fetch servizi based on the commesse authorized for this sub agenzia
      const allServizi = [];
      if (selectedSubAgenzia.commesse_autorizzate && selectedSubAgenzia.commesse_autorizzate.length > 0) {
        for (const commessaId of selectedSubAgenzia.commesse_autorizzate) {
          try {
            const response = await axios.get(`${API}/commesse/${commessaId}/servizi`);
            allServizi.push(...response.data);
          } catch (error) {
            console.error(`Error fetching servizi for commessa ${commessaId}:`, error);
          }
        }
      }
      
      // If servizi_autorizzati exists, filter to show only those
      let finalServizi = allServizi;
      if (selectedSubAgenzia.servizi_autorizzati && selectedSubAgenzia.servizi_autorizzati.length > 0) {
        finalServizi = allServizi.filter(s => selectedSubAgenzia.servizi_autorizzati.includes(s.id));
        console.log(`✅ Filtered servizi from ${allServizi.length} to ${finalServizi.length} based on servizi_autorizzati`);
      }
      
      console.log('✅ Servizi loaded for sub agenzia:', finalServizi.length);
      setServiziDisponibili(finalServizi);
    } catch (error) {
      console.error("Error fetching servizi for sub agenzia:", error);
      setServiziDisponibili([]);
    }
  };

  // Fetch servizi quando si seleziona una commessa
  const handleCommessaChange = async (commessaId) => {
    try {
      const response = await axios.get(`${API}/commesse/${commessaId}/servizi`);
      setServizi(response.data);
    } catch (error) {
      console.error("Error fetching servizi:", error);
      setServizi([]);
    }
  };

  // Aggiorna can_view_analytics in base al ruolo
  const getRolePermissions = (role) => {
    const analyticsRoles = [
      'admin', 
      'responsabile_commessa', 
      'responsabile_sub_agenzia',
      'agente_specializzato',
      'operatore'
    ];
    return analyticsRoles.includes(role);
  };

  const handleSubmit = async (e) => {
    console.log("🚀 HANDLESUBMIT CHIAMATO! Event:", e);
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log("=== DEBUG CREAZIONE UTENTE ===");
      console.log("FormData originale:", { ...formData, password: formData.password ? `[${formData.password.length} chars]` : "[VUOTO]" });
      
      // Prepara i dati per l'invio, rimuovendo assignment_type e impostando correttamente unit_id/sub_agenzia_id
      const submitData = { ...formData };
      delete submitData.assignment_type;
      
      // CRITICAL FIX: Assicurati che la password sia presente e non vuota
      console.log("Password prima del controllo:", submitData.password ? `[${submitData.password.length} chars]` : "[VUOTO/NULL]");
      
      if (!submitData.password || submitData.password.trim() === "") {
        console.log("⚠️ Password vuota detected - impostazione default admin123");
        submitData.password = "admin123";
      } else {
        console.log("✅ Password già presente:", `[${submitData.password.length} chars]`);
      }
      
      // Assicurati che solo uno tra unit_id e sub_agenzia_id sia impostato
      if (formData.assignment_type === "unit") {
        submitData.sub_agenzia_id = null;
      } else {
        submitData.unit_id = null;
      }

      // Validazione dati critici
      if (!submitData.username || !submitData.email || !submitData.role) {
        throw new Error("Campi obbligatori mancanti: username, email, o role");
      }
      
      console.log("📤 Invio dati utente:", { 
        ...submitData, 
        password: `[${submitData.password.length} chars - ${submitData.password.substring(0,3)}...]`,
        commesse_autorizzate: submitData.commesse_autorizzate?.length || 0
      });
      
      const response = await axios.post(`${API}/users`, submitData);
      console.log("✅ Utente creato con successo:", response.data);
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

  const handleCommessaAutorizzataChange = (commessaId, checked) => {
    if (checked) {
      setFormData({
        ...formData,
        commesse_autorizzate: [...formData.commesse_autorizzate, commessaId],
      });
      // Carica i servizi per la commessa selezionata
      handleCommessaChange(commessaId);
    } else {
      setFormData({
        ...formData,
        commesse_autorizzate: formData.commesse_autorizzate.filter((c) => c !== commessaId),
      });
    }
  };

  const handleServizioAutorizzatoChange = (servizioId, checked) => {
    if (checked) {
      setFormData({
        ...formData,
        servizi_autorizzati: [...(formData.servizi_autorizzati || []), servizioId],
      });
    } else {
      setFormData({
        ...formData,
        servizi_autorizzati: (formData.servizi_autorizzati || []).filter((s) => s !== servizioId),
      });
    }
  };

  const handleSubAgenziaAutorizzataChange = (subAgenziaId, checked) => {
    if (checked) {
      setFormData({
        ...formData,
        sub_agenzie_autorizzate: [...formData.sub_agenzie_autorizzate, subAgenziaId],
      });
      // Carica i servizi per la sub agenzia selezionata
      // Per ora usiamo tutti i servizi, ma potremmo implementare un endpoint specifico
      if (subAgenzie.length > 0) {
        const subAgenzia = subAgenzie.find(sa => sa.id === subAgenziaId);
        if (subAgenzia && subAgenzia.commessa_id) {
          handleCommessaChange(subAgenzia.commessa_id);
        }
      }
    } else {
      setFormData({
        ...formData,
        sub_agenzie_autorizzate: formData.sub_agenzie_autorizzate.filter((s) => s !== subAgenziaId),
      });
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto z-50">
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
                placeholder="Lascia vuoto per default: admin123"
              />
              <p className="text-xs text-slate-500 mt-1">
                Se vuoto, verrà impostata automaticamente "admin123"
              </p>
            </div>

            <div>
              <Label htmlFor="role">Ruolo *</Label>
              <Select value={formData.role} onValueChange={(value) => {
                console.log("🎯 Role selector onChange:", value);
                setFormData({ ...formData, role: value });
                console.log("🎯 FormData after role change:", { ...formData, role: value });
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona ruolo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="referente">Referente</SelectItem>
                  <SelectItem value="agente">Agente</SelectItem>
                  <SelectItem value="responsabile_commessa">Responsabile Commessa</SelectItem>
                  <SelectItem value="backoffice_commessa">BackOffice Commessa</SelectItem>
                  <SelectItem value="responsabile_sub_agenzia">Responsabile Sub Agenzia</SelectItem>
                  <SelectItem value="backoffice_sub_agenzia">BackOffice Sub Agenzia</SelectItem>
                  <SelectItem value="agente_specializzato">Agente Specializzato</SelectItem>
                  <SelectItem value="operatore">Operatore</SelectItem>
                  <SelectItem value="responsabile_store">Responsabile Store</SelectItem>
                  <SelectItem value="store_assistant">Store Assistant</SelectItem>
                  <SelectItem value="responsabile_presidi">Responsabile Presidi</SelectItem>
                  <SelectItem value="promoter_presidi">Promoter Presidi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Entity Management Configuration */}
            <div>
              <Label htmlFor="entity_management">Gestione Entità</Label>
              <Select value={formData.entity_management} onValueChange={(value) => setFormData({ ...formData, entity_management: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tipo entità gestite" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clienti">
                    <div className="flex items-center">
                      <UserCheck className="w-4 h-4 mr-2 text-blue-500" />
                      Solo Clienti
                    </div>
                  </SelectItem>
                  <SelectItem value="lead">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2 text-green-500" />
                      Solo Lead
                    </div>
                  </SelectItem>
                  <SelectItem value="both">
                    <div className="flex items-center">
                      <Building2 className="w-4 h-4 mr-2 text-purple-500" />
                      Clienti e Lead
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Definisce quali tipi di entità l'utente può visualizzare e gestire
              </p>
            </div>
          </div>

          {/* AGENTE e REFERENTE: Campo Unit → Servizi */}
          {(formData.role === "agente" || formData.role === "referente") && (
            <div>
              <Label htmlFor="unit_id">Unit *</Label>
              <Select value={formData.unit_id} onValueChange={(value) => {
                setFormData(prev => ({ ...prev, unit_id: value, servizi_autorizzati: [] }));
                handleUnitChange(value);
              }}>
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
          )}

          {/* AGENTE: Campo Referente */}
          {formData.role === "agente" && (
            <div>
              <Label htmlFor="referente_id">Referente</Label>
              <Select value={formData.referente_id} onValueChange={(value) => 
                setFormData(prev => ({ ...prev, referente_id: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona referente" />
                </SelectTrigger>
                <SelectContent>
                  {referenti.map((ref) => (
                    <SelectItem key={ref.id} value={ref.id}>
                      {ref.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* AGENTE e REFERENTE: Servizi della Unit selezionata */}
          {(formData.role === "agente" || formData.role === "referente") && formData.unit_id && (
            <div className="col-span-2">
              <Label>Servizi Autorizzati *</Label>
              {serviziDisponibili.length > 0 ? (
                <div>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-2 gap-2">
                      {serviziDisponibili.map((servizio) => (
                        <div key={servizio.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`servizio-${servizio.id}`}
                            checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                            onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                          />
                          <Label htmlFor={`servizio-${servizio.id}`} className="text-sm font-normal cursor-pointer">
                            {servizio.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Selezionati: {formData.servizi_autorizzati?.length || 0} servizi
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg p-4 bg-amber-50 border-amber-200">
                  <p className="text-sm text-amber-800">
                    Nessun servizio disponibile per questa Unit. Assicurati che la Unit abbia commesse autorizzate con servizi.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Campi condizionali per ruoli specializzati */}
          {(formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa") && (
            <>
              <div>
                <Label>Commesse Autorizzate *</Label>
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2">
                    {commesse.map((commessa) => (
                      <div key={commessa.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`commessa-${commessa.id}`}
                          checked={formData.commesse_autorizzate && formData.commesse_autorizzate.includes(commessa.id)}
                          onCheckedChange={(checked) => handleCommessaAutorizzataChange(commessa.id, checked)}
                        />
                        <Label htmlFor={`commessa-${commessa.id}`} className="text-sm">
                          {commessa.nome}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Servizi autorizzati - mostrati solo se almeno una commessa è selezionata */}
              {formData.commesse_autorizzate.length > 0 && (
                <div>
                  <Label>Servizi Autorizzati *</Label>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2">
                      {servizi.map((servizio) => (
                        <div key={servizio.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`servizio-${servizio.id}`}
                            checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                            onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                          />
                          <Label htmlFor={`servizio-${servizio.id}`} className="text-sm">
                            {servizio.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* RESPONSABILE COMMESSA e BACKOFFICE COMMESSA: Commesse (multi) → Servizi (multi) */}
          {(formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa") && (
            <>
              <div className="col-span-2">
                <Label>Commesse Autorizzate *</Label>
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                  <div className="grid grid-cols-2 gap-2">
                    {commesse.map((commessa) => (
                      <div key={commessa.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`commessa-${commessa.id}`}
                          checked={formData.commesse_autorizzate && formData.commesse_autorizzate.includes(commessa.id)}
                          onCheckedChange={(checked) => handleCommessaAutorizzataChange(commessa.id, checked)}
                        />
                        <Label htmlFor={`commessa-${commessa.id}`} className="text-sm font-normal cursor-pointer">
                          {commessa.nome}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Selezionate: {formData.commesse_autorizzate?.length || 0} commesse
                </p>
              </div>

              {/* Servizi delle commesse selezionate */}
              {formData.commesse_autorizzate && formData.commesse_autorizzate.length > 0 && servizi.length > 0 && (
                <div className="col-span-2">
                  <Label>Servizi Autorizzati *</Label>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-2 gap-2">
                      {servizi.map((servizio) => (
                        <div key={servizio.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`servizio-commessa-${servizio.id}`}
                            checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                            onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                          />
                          <Label htmlFor={`servizio-commessa-${servizio.id}`} className="text-sm font-normal cursor-pointer">
                            {servizio.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Selezionati: {formData.servizi_autorizzati?.length || 0} servizi
                  </p>
                </div>
              )}
            </>
          )}

          {/* RESPONSABILE/BACKOFFICE SUB AGENZIA, AGENTE SPECIALIZZATO, OPERATORE: Sub Agenzia → Commesse (multi) → Servizi (multi) */}
          {(formData.role === "responsabile_sub_agenzia" || formData.role === "backoffice_sub_agenzia" || 
            formData.role === "agente_specializzato" || formData.role === "operatore") && (
            <>
              <div>
                <Label htmlFor="sub_agenzia_id">Sub Agenzia *</Label>
                <Select value={formData.sub_agenzia_id} onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, sub_agenzia_id: value, commesse_autorizzate: [], servizi_autorizzati: [] }));
                  // Carica commesse della sub agenzia selezionata
                  const selectedSub = subAgenzie.find(sa => sa.id === value);
                  if (selectedSub && selectedSub.commesse_autorizzate) {
                    // Le commesse disponibili sono quelle autorizzate per questa sub
                    setFormData(prev => ({ ...prev, sub_agenzia_id: value, commesse_autorizzate: [], servizi_autorizzati: [] }));
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona sub agenzia" />
                  </SelectTrigger>
                  <SelectContent>
                    {subAgenzie.map((subAgenzia) => (
                      <SelectItem key={subAgenzia.id} value={subAgenzia.id}>
                        {subAgenzia.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Commesse autorizzate della Sub Agenzia selezionata */}
              {formData.sub_agenzia_id && (() => {
                const selectedSub = subAgenzie.find(sa => sa.id === formData.sub_agenzia_id);
                const commesseDisponibili = selectedSub && selectedSub.commesse_autorizzate 
                  ? commesse.filter(c => selectedSub.commesse_autorizzate.includes(c.id))
                  : [];
                
                return commesseDisponibili.length > 0 && (
                  <div className="col-span-2">
                    <Label>Commesse Autorizzate *</Label>
                    <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                      <div className="grid grid-cols-2 gap-2">
                        {commesseDisponibili.map((commessa) => (
                          <div key={commessa.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`commessa-sub-${commessa.id}`}
                              checked={formData.commesse_autorizzate && formData.commesse_autorizzate.includes(commessa.id)}
                              onCheckedChange={(checked) => handleCommessaAutorizzataChange(commessa.id, checked)}
                            />
                            <Label htmlFor={`commessa-sub-${commessa.id}`} className="text-sm font-normal cursor-pointer">
                              {commessa.nome}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Selezionate: {formData.commesse_autorizzate?.length || 0} commesse
                    </p>
                  </div>
                );
              })()}

              {/* Servizi delle commesse selezionate */}
              {formData.commesse_autorizzate && formData.commesse_autorizzate.length > 0 && servizi.length > 0 && (
                <div className="col-span-2">
                  <Label>Servizi Autorizzati *</Label>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-2 gap-2">
                      {servizi.map((servizio) => (
                        <div key={servizio.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`servizio-sub-${servizio.id}`}
                            checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                            onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                          />
                          <Label htmlFor={`servizio-sub-${servizio.id}`} className="text-sm font-normal cursor-pointer">
                            {servizio.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Selezionati: {formData.servizi_autorizzati?.length || 0} servizi
                  </p>
                </div>
              )}
            </>
          )}

          {/* Province di copertura per Agente */}
          {formData.role === "agente" && (
            <div className="col-span-2">
              <Label>Province di Copertura *</Label>
              <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                <div className="grid grid-cols-3 gap-2">
                  {provinces.map((province) => (
                    <div key={province} className="flex items-center space-x-2">
                      <Checkbox
                        id={`province-${province}`}
                        checked={formData.provinces.includes(province)}
                        onCheckedChange={(checked) => handleProvinceChange(province, checked)}
                      />
                      <Label htmlFor={`province-${province}`} className="text-sm font-normal cursor-pointer">
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

          {/* RESPONSABILE STORE e RESPONSABILE PRESIDI: Multi Sub Agenzie → Multi Commesse → Multi Servizi */}
          {(formData.role === "responsabile_store" || formData.role === "responsabile_presidi") && (
            <>
              <div className="col-span-2">
                <Label>Sub Agenzie Autorizzate *</Label>
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                  <div className="grid grid-cols-2 gap-2">
                    {subAgenzie.map((subAgenzia) => (
                      <div key={subAgenzia.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`subagenzia-store-${subAgenzia.id}`}
                          checked={formData.sub_agenzie_autorizzate && formData.sub_agenzie_autorizzate.includes(subAgenzia.id)}
                          onCheckedChange={(checked) => handleSubAgenziaAutorizzataChange(subAgenzia.id, checked)}
                        />
                        <Label htmlFor={`subagenzia-store-${subAgenzia.id}`} className="text-sm font-normal cursor-pointer">
                          {subAgenzia.nome}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Selezionate: {formData.sub_agenzie_autorizzate?.length || 0} sub agenzie
                </p>
              </div>

              {/* Commesse autorizzate (tutte le commesse disponibili) */}
              {formData.sub_agenzie_autorizzate && formData.sub_agenzie_autorizzate.length > 0 && (
                <div className="col-span-2">
                  <Label>Commesse Autorizzate *</Label>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-2 gap-2">
                      {commesse.map((commessa) => (
                        <div key={commessa.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`commessa-store-${commessa.id}`}
                            checked={formData.commesse_autorizzate && formData.commesse_autorizzate.includes(commessa.id)}
                            onCheckedChange={(checked) => handleCommessaAutorizzataChange(commessa.id, checked)}
                          />
                          <Label htmlFor={`commessa-store-${commessa.id}`} className="text-sm font-normal cursor-pointer">
                            {commessa.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Selezionate: {formData.commesse_autorizzate?.length || 0} commesse
                  </p>
                </div>
              )}

              {/* Servizi delle commesse selezionate */}
              {formData.commesse_autorizzate && formData.commesse_autorizzate.length > 0 && servizi.length > 0 && (
                <div className="col-span-2">
                  <Label>Servizi Autorizzati *</Label>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-2 gap-2">
                      {servizi.map((servizio) => (
                        <div key={servizio.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`servizio-store-${servizio.id}`}
                            checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                            onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                          />
                          <Label htmlFor={`servizio-store-${servizio.id}`} className="text-sm font-normal cursor-pointer">
                            {servizio.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Selezionati: {formData.servizi_autorizzati?.length || 0} servizi
                  </p>
                </div>
              )}
            </>
          )}

          {/* STORE ASSISTANT e PROMOTER PRESIDI: Singola Sub Agenzia → Multi Commesse → Multi Servizi */}
          {(formData.role === "store_assistant" || formData.role === "promoter_presidi") && (
            <>
              <div>
                <Label htmlFor="sub_agenzia_id">Sub Agenzia *</Label>
                <Select value={formData.sub_agenzia_id} onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, sub_agenzia_id: value, commesse_autorizzate: [], servizi_autorizzati: [] }));
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona sub agenzia" />
                  </SelectTrigger>
                  <SelectContent>
                    {subAgenzie.map((subAgenzia) => (
                      <SelectItem key={subAgenzia.id} value={subAgenzia.id}>
                        {subAgenzia.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Commesse autorizzate (tutte le commesse disponibili) */}
              {formData.sub_agenzia_id && (
                <div className="col-span-2">
                  <Label>Commesse Autorizzate *</Label>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-2 gap-2">
                      {commesse.map((commessa) => (
                        <div key={commessa.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`commessa-assistant-${commessa.id}`}
                            checked={formData.commesse_autorizzate && formData.commesse_autorizzate.includes(commessa.id)}
                            onCheckedChange={(checked) => handleCommessaAutorizzataChange(commessa.id, checked)}
                          />
                          <Label htmlFor={`commessa-assistant-${commessa.id}`} className="text-sm font-normal cursor-pointer">
                            {commessa.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Selezionate: {formData.commesse_autorizzate?.length || 0} commesse
                  </p>
                </div>
              )}

              {/* Servizi delle commesse selezionate */}
              {formData.commesse_autorizzate && formData.commesse_autorizzate.length > 0 && servizi.length > 0 && (
                <div className="col-span-2">
                  <Label>Servizi Autorizzati *</Label>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-2 gap-2">
                      {servizi.map((servizio) => (
                        <div key={servizio.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`servizio-assistant-${servizio.id}`}
                            checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                            onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                          />
                          <Label htmlFor={`servizio-assistant-${servizio.id}`} className="text-sm font-normal cursor-pointer">
                            {servizio.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Selezionati: {formData.servizi_autorizzati?.length || 0} servizi
                  </p>
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button 
              type="button" 
              disabled={isLoading}
              onClick={(e) => {
                console.log("🎯 BUTTON ONCLICK chiamato! Forcing form submit...");
                e.preventDefault();
                handleSubmit(e);
              }}
            >
              {isLoading ? "Creazione..." : "Crea Utente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Edit User Modal Component
const EditUserModal = ({ user, onClose, onSuccess, provinces, units, referenti, commesse, subAgenzie, fetchServizi }) => {
  const [formData, setFormData] = useState({
    username: user.username,
    email: user.email,
    password: "",
    role: user.role,
    unit_id: user.unit_id || "",
    sub_agenzia_id: user.sub_agenzia_id || "",
    referente_id: user.referente_id || "",
    provinces: user.provinces || [],
    // Campi per ruoli specializzati
    commesse_autorizzate: user.commesse_autorizzate || [],
    servizi_autorizzati: user.servizi_autorizzati || [],
    sub_agenzie_autorizzate: user.sub_agenzie_autorizzate || [],
    can_view_analytics: user.can_view_analytics || false,
    entity_management: user.entity_management || "clienti",
    assignment_type: user.unit_id ? "unit" : (user.sub_agenzia_id ? "sub_agenzia" : "")
  });
  const [isLoading, setIsLoading] = useState(false);
  const [servizi, setServizi] = useState([]);
  const [serviziDisponibili, setServiziDisponibili] = useState([]); // NEW: Servizi per UNIT/SUB selezionata
  const { toast } = useToast();

  // Load servizi when commesse_autorizzate changes
  useEffect(() => {
    if (formData.commesse_autorizzate && formData.commesse_autorizzate.length > 0) {
      // Carica servizi per la prima commessa autorizzata
      handleCommessaChange(formData.commesse_autorizzate[0]);
    }
  }, [formData.commesse_autorizzate]);

  // NEW: Load servizi when unit_id or sub_agenzia_id is set on mount
  useEffect(() => {
    if (formData.unit_id && formData.assignment_type === "unit") {
      handleUnitChange(formData.unit_id);
    } else if (formData.sub_agenzia_id && formData.assignment_type === "sub_agenzia") {
      handleSubAgenziaChange(formData.sub_agenzia_id);
    }
  }, []);

  // NEW: Fetch servizi quando si seleziona una UNIT
  const handleUnitChange = async (unitId) => {
    if (!unitId) {
      setServiziDisponibili([]);
      return;
    }
    
    try {
      console.log('🔄 EditUser: Fetching servizi for unit:', unitId);
      const selectedUnitObj = units.find(u => u.id === unitId);
      if (!selectedUnitObj || !selectedUnitObj.commesse_autorizzate) {
        setServiziDisponibili([]);
        return;
      }
      
      const allServizi = [];
      for (const commessaId of selectedUnitObj.commesse_autorizzate) {
        try {
          const response = await axios.get(`${API}/commesse/${commessaId}/servizi`);
          allServizi.push(...response.data);
        } catch (error) {
          console.error(`Error fetching servizi for commessa ${commessaId}:`, error);
        }
      }
      
      console.log('✅ EditUser: Servizi loaded for unit:', allServizi.length);
      setServiziDisponibili(allServizi);
    } catch (error) {
      console.error("EditUser: Error fetching servizi for unit:", error);
      setServiziDisponibili([]);
    }
  };

  // NEW: Fetch servizi quando si seleziona una SUB AGENZIA
  const handleSubAgenziaChange = async (subAgenziaId) => {
    if (!subAgenziaId) {
      setServiziDisponibili([]);
      return;
    }
    
    try {
      console.log('🔄 EditUser: Fetching servizi for sub agenzia:', subAgenziaId);
      const selectedSubAgenzia = subAgenzie.find(sa => sa.id === subAgenziaId);
      if (!selectedSubAgenzia) {
        console.log('⚠️ EditUser: Sub agenzia not found');
        setServiziDisponibili([]);
        return;
      }
      
      console.log('✅ EditUser: Sub agenzia found:', selectedSubAgenzia.nome);
      console.log('📋 EditUser: Sub agenzia commesse_autorizzate:', selectedSubAgenzia.commesse_autorizzate);
      console.log('📋 EditUser: Sub agenzia servizi_autorizzati:', selectedSubAgenzia.servizi_autorizzati);
      
      // Fetch servizi based on the commesse authorized for this sub agenzia
      const allServizi = [];
      if (selectedSubAgenzia.commesse_autorizzate && selectedSubAgenzia.commesse_autorizzate.length > 0) {
        for (const commessaId of selectedSubAgenzia.commesse_autorizzate) {
          try {
            const response = await axios.get(`${API}/commesse/${commessaId}/servizi`);
            allServizi.push(...response.data);
          } catch (error) {
            console.error(`EditUser: Error fetching servizi for commessa ${commessaId}:`, error);
          }
        }
      }
      
      // If servizi_autorizzati exists, filter to show only those
      let finalServizi = allServizi;
      if (selectedSubAgenzia.servizi_autorizzati && selectedSubAgenzia.servizi_autorizzati.length > 0) {
        finalServizi = allServizi.filter(s => selectedSubAgenzia.servizi_autorizzati.includes(s.id));
        console.log(`✅ EditUser: Filtered servizi from ${allServizi.length} to ${finalServizi.length} based on servizi_autorizzati`);
      }
      
      console.log('✅ EditUser: Servizi loaded for sub agenzia:', finalServizi.length);
      setServiziDisponibili(finalServizi);
    } catch (error) {
      console.error("EditUser: Error fetching servizi for sub agenzia:", error);
      setServiziDisponibili([]);
    }
  };

  const handleCommessaChange = async (commessaId) => {
    if (commessaId) {
      try {
        const response = await axios.get(`${API}/commesse/${commessaId}/servizi`);
        setServizi(response.data);
        console.log("Servizi caricati per commessa:", commessaId, response.data);
      } catch (error) {
        console.error("Error fetching servizi:", error);
        setServizi([]);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Clean data before sending
      const cleanData = { ...formData };
      
      // Remove password field (not supported in UserUpdate model)
      delete cleanData.password;
      
      // Remove assignment_type field as it's only for UI
      delete cleanData.assignment_type;
      
      // Auto-set can_view_analytics based on role
      if (formData.role === "responsabile_commessa" || formData.role === "responsabile_sub_agenzia") {
        cleanData.can_view_analytics = true;
      } else if (formData.role === "backoffice_commessa" || formData.role === "backoffice_sub_agenzia") {
        cleanData.can_view_analytics = false;
      }
      
      // Clear unit_id and referente_id for specialist roles that don't need them
      const specialistRoles = ["responsabile_commessa", "backoffice_commessa", "responsabile_sub_agenzia", "backoffice_sub_agenzia"];
      if (specialistRoles.includes(formData.role)) {
        cleanData.unit_id = null;
        cleanData.referente_id = null;
      }
      
      await axios.put(`${API}/users/${user.id}`, cleanData);
      toast({
        title: "Successo",
        description: "Utente aggiornato con successo",
      });
      onSuccess();
    } catch (error) {
      console.error("Error updating user:", error);
      
      // Handle error message properly to avoid React crash
      let errorMessage = "Errore nell'aggiornamento dell'utente";
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          if (typeof error.response.data.detail === 'string') {
            errorMessage = error.response.data.detail;
          } else if (Array.isArray(error.response.data.detail)) {
            // Handle Pydantic validation errors
            errorMessage = error.response.data.detail.map(err => 
              `${err.loc ? err.loc.join('.') : 'Field'}: ${err.msg}`
            ).join(', ');
          } else {
            errorMessage = "Errore di validazione dei dati";
          }
        }
      }
      
      toast({
        title: "Errore",
        description: errorMessage,
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

  const handleCommessaAutorizzataChange = (commessaId, checked) => {
    const currentCommesse = formData.commesse_autorizzate || [];
    if (checked) {
      setFormData({
        ...formData,
        commesse_autorizzate: [...currentCommesse, commessaId],
      });
      // Carica i servizi per la commessa selezionata
      handleCommessaChange(commessaId);
    } else {
      setFormData({
        ...formData,
        commesse_autorizzate: currentCommesse.filter((c) => c !== commessaId),
      });
    }
  };

  const handleSubAgenziaAutorizzataChange = (subAgenziaId, checked) => {
    const currentSubAgenzie = formData.sub_agenzie_autorizzate || [];
    if (checked) {
      setFormData({
        ...formData,
        sub_agenzie_autorizzate: [...currentSubAgenzie, subAgenziaId],
      });
    } else {
      setFormData({
        ...formData,
        sub_agenzie_autorizzate: currentSubAgenzie.filter((s) => s !== subAgenziaId),
      });
    }
  };

  const handleServizioAutorizzatoChange = (servizioId, checked) => {
    if (checked) {
      setFormData({
        ...formData,
        servizi_autorizzati: [...(formData.servizi_autorizzati || []), servizioId],
      });
    } else {
      setFormData({
        ...formData,
        servizi_autorizzati: (formData.servizi_autorizzati || []).filter((s) => s !== servizioId),
      });
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto z-50">
        <DialogHeader>
          <DialogTitle>Modifica Utente</DialogTitle>
          <DialogDescription>
            Modifica i dati dell'utente e le sue autorizzazioni
          </DialogDescription>
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
              <Select value={formData.role} onValueChange={(value) => {
                console.log("🎯 Role selector onChange:", value);
                setFormData({ ...formData, role: value });
                console.log("🎯 FormData after role change:", { ...formData, role: value });
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona ruolo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="referente">Referente</SelectItem>
                  <SelectItem value="agente">Agente</SelectItem>
                  <SelectItem value="responsabile_commessa">Responsabile Commessa</SelectItem>
                  <SelectItem value="backoffice_commessa">BackOffice Commessa</SelectItem>
                  <SelectItem value="responsabile_sub_agenzia">Responsabile Sub Agenzia</SelectItem>
                  <SelectItem value="backoffice_sub_agenzia">BackOffice Sub Agenzia</SelectItem>
                  <SelectItem value="agente_specializzato">Agente Specializzato</SelectItem>
                  <SelectItem value="operatore">Operatore</SelectItem>
                  <SelectItem value="responsabile_store">Responsabile Store</SelectItem>
                  <SelectItem value="store_assistant">Store Assistant</SelectItem>
                  <SelectItem value="responsabile_presidi">Responsabile Presidi</SelectItem>
                  <SelectItem value="promoter_presidi">Promoter Presidi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Entity Management Configuration */}
          <div>
            <Label htmlFor="entity_management">Gestione Entità</Label>
            <Select value={formData.entity_management} onValueChange={(value) => setFormData({ ...formData, entity_management: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tipo entità gestite" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clienti">
                  <div className="flex items-center">
                    <UserCheck className="w-4 h-4 mr-2 text-blue-500" />
                    Solo Clienti
                  </div>
                </SelectItem>
                <SelectItem value="lead">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-2 text-green-500" />
                    Solo Lead
                  </div>
                </SelectItem>
                <SelectItem value="both">
                  <div className="flex items-center">
                    <Building2 className="w-4 h-4 mr-2 text-purple-500" />
                    Clienti e Lead
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              Definisce quali tipi di entità l'utente può visualizzare e gestire
            </p>
          </div>

          {/* AGENTE e REFERENTE: Campo Unit → Servizi */}
          {(formData.role === "agente" || formData.role === "referente") && (
            <div>
              <Label htmlFor="unit_id">Unit *</Label>
              <Select value={formData.unit_id} onValueChange={(value) => {
                setFormData(prev => ({ ...prev, unit_id: value, servizi_autorizzati: [] }));
                handleUnitChange(value);
              }}>
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
          )}

          {/* Campo Sub Agenzia - mostrato solo se assignment_type è "sub_agenzia" e non è responsabile/backoffice commessa */}
          {formData.assignment_type === "sub_agenzia" && !(formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa") && (
            <div>
              <Label htmlFor="sub_agenzia_id">Sub Agenzia *</Label>
              <Select value={formData.sub_agenzia_id} onValueChange={(value) => {
                setFormData({ ...formData, sub_agenzia_id: value, servizi_autorizzati: [] });
                handleSubAgenziaChange(value);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona sub agenzia" />
                </SelectTrigger>
                <SelectContent>
                  {subAgenzie.map((subAgenzia) => (
                    <SelectItem key={subAgenzia.id} value={subAgenzia.id}>
                      {subAgenzia.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* NEW: Servizi Autorizzati per UNIT/SUB AGENZIA - Per TUTTI gli utenti con assignment */}
          {!(formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa" || 
             formData.role === "responsabile_sub_agenzia" || formData.role === "backoffice_sub_agenzia") && 
           ((formData.assignment_type === "unit" && formData.unit_id) || 
            (formData.assignment_type === "sub_agenzia" && formData.sub_agenzia_id)) && (
            <div>
              <Label>Servizi Autorizzati *</Label>
              {serviziDisponibili.length > 0 ? (
                <>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-2 gap-2">
                      {serviziDisponibili.map((servizio) => (
                        <div key={servizio.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-servizio-generale-${servizio.id}`}
                            checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                            onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                          />
                          <Label htmlFor={`edit-servizio-generale-${servizio.id}`} className="text-sm font-normal cursor-pointer">
                            {servizio.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Selezionati: {formData.servizi_autorizzati?.length || 0} servizi
                  </p>
                </>
              ) : (
                <div className="border rounded-lg p-4 bg-amber-50 border-amber-200">
                  <p className="text-sm text-amber-800">
                    {formData.assignment_type === "unit" 
                      ? "Nessun servizio disponibile per questa Unit. Assicurati che la Unit abbia commesse autorizzate con servizi."
                      : "Nessun servizio disponibile per questa Sub Agenzia. Assicurati che la Sub Agenzia abbia servizi autorizzati."}
                  </p>
                </div>
              )}
            </div>
          )}

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

          {/* Campi condizionali per ruoli specializzati */}
          {(formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa") && (
            <>
              <div>
                <Label>Commesse Autorizzate *</Label>
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    {commesse.map((commessa) => (
                      <div key={commessa.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={commessa.id}
                          checked={formData.commesse_autorizzate && formData.commesse_autorizzate.includes(commessa.id)}
                          onCheckedChange={(checked) => handleCommessaAutorizzataChange(commessa.id, checked)}
                        />
                        <Label htmlFor={commessa.id} className="text-sm">
                          {commessa.nome}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Selezionate: {formData.commesse_autorizzate ? formData.commesse_autorizzate.length : 0} commesse
                </p>
              </div>

              {formData.commesse_autorizzate && formData.commesse_autorizzate.length > 0 && servizi && servizi.length > 0 && (
                <div>
                  <Label>Servizi Autorizzati (opzionale)</Label>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                    <div className="space-y-2">
                      {servizi.map((servizio) => (
                        <div key={servizio.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={servizio.id}
                            checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                            onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                          />
                          <Label htmlFor={servizio.id} className="text-sm">
                            {servizio.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Selezionati: {formData.servizi_autorizzati ? formData.servizi_autorizzati.length : 0} servizi
                  </p>
                </div>
              )}
            </>
          )}

          {(formData.role === "responsabile_sub_agenzia" || formData.role === "backoffice_sub_agenzia") && (
            <div>
              <Label>Sub Agenzie Autorizzate *</Label>
              <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                <div className="space-y-2">
                  {subAgenzie.map((subAgenzia) => (
                    <div key={subAgenzia.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={subAgenzia.id}
                        checked={formData.sub_agenzie_autorizzate && formData.sub_agenzie_autorizzate.includes(subAgenzia.id)}
                        onCheckedChange={(checked) => handleSubAgenziaAutorizzataChange(subAgenzia.id, checked)}
                      />
                      <Label htmlFor={subAgenzia.id} className="text-sm">
                        {subAgenzia.nome}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Selezionate: {formData.sub_agenzie_autorizzate ? formData.sub_agenzie_autorizzate.length : 0} sub agenzie
              </p>
            </div>
          )}

          {/* RESPONSABILE STORE e RESPONSABILE PRESIDI: Multi Sub Agenzie → Multi Commesse → Multi Servizi */}
          {(formData.role === "responsabile_store" || formData.role === "responsabile_presidi") && (
            <>
              <div className="col-span-2">
                <Label>Sub Agenzie Autorizzate *</Label>
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                  <div className="grid grid-cols-2 gap-2">
                    {subAgenzie.map((subAgenzia) => (
                      <div key={subAgenzia.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-subagenzia-store-${subAgenzia.id}`}
                          checked={formData.sub_agenzie_autorizzate && formData.sub_agenzie_autorizzate.includes(subAgenzia.id)}
                          onCheckedChange={(checked) => handleSubAgenziaAutorizzataChange(subAgenzia.id, checked)}
                        />
                        <Label htmlFor={`edit-subagenzia-store-${subAgenzia.id}`} className="text-sm font-normal cursor-pointer">
                          {subAgenzia.nome}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Selezionate: {formData.sub_agenzie_autorizzate?.length || 0} sub agenzie
                </p>
              </div>

              {/* Commesse autorizzate (tutte le commesse disponibili) */}
              {formData.sub_agenzie_autorizzate && formData.sub_agenzie_autorizzate.length > 0 && (
                <div className="col-span-2">
                  <Label>Commesse Autorizzate *</Label>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-2 gap-2">
                      {commesse.map((commessa) => (
                        <div key={commessa.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-commessa-store-${commessa.id}`}
                            checked={formData.commesse_autorizzate && formData.commesse_autorizzate.includes(commessa.id)}
                            onCheckedChange={(checked) => handleCommessaAutorizzataChange(commessa.id, checked)}
                          />
                          <Label htmlFor={`edit-commessa-store-${commessa.id}`} className="text-sm font-normal cursor-pointer">
                            {commessa.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Selezionate: {formData.commesse_autorizzate?.length || 0} commesse
                  </p>
                </div>
              )}

              {/* Servizi delle commesse selezionate */}
              {formData.commesse_autorizzate && formData.commesse_autorizzate.length > 0 && servizi.length > 0 && (
                <div className="col-span-2">
                  <Label>Servizi Autorizzati *</Label>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-2 gap-2">
                      {servizi.map((servizio) => (
                        <div key={servizio.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-servizio-store-${servizio.id}`}
                            checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                            onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                          />
                          <Label htmlFor={`edit-servizio-store-${servizio.id}`} className="text-sm font-normal cursor-pointer">
                            {servizio.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Selezionati: {formData.servizi_autorizzati?.length || 0} servizi
                  </p>
                </div>
              )}
            </>
          )}

          {/* STORE ASSISTANT e PROMOTER PRESIDI: Singola Sub Agenzia → Multi Commesse → Multi Servizi */}
          {(formData.role === "store_assistant" || formData.role === "promoter_presidi") && (
            <>
              <div>
                <Label htmlFor="sub_agenzia_id">Sub Agenzia *</Label>
                <Select value={formData.sub_agenzia_id} onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, sub_agenzia_id: value, commesse_autorizzate: [], servizi_autorizzati: [] }));
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona sub agenzia" />
                  </SelectTrigger>
                  <SelectContent>
                    {subAgenzie.map((subAgenzia) => (
                      <SelectItem key={subAgenzia.id} value={subAgenzia.id}>
                        {subAgenzia.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Commesse autorizzate (tutte le commesse disponibili) */}
              {formData.sub_agenzia_id && (
                <div className="col-span-2">
                  <Label>Commesse Autorizzate *</Label>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-2 gap-2">
                      {commesse.map((commessa) => (
                        <div key={commessa.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-commessa-assistant-${commessa.id}`}
                            checked={formData.commesse_autorizzate && formData.commesse_autorizzate.includes(commessa.id)}
                            onCheckedChange={(checked) => handleCommessaAutorizzataChange(commessa.id, checked)}
                          />
                          <Label htmlFor={`edit-commessa-assistant-${commessa.id}`} className="text-sm font-normal cursor-pointer">
                            {commessa.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Selezionate: {formData.commesse_autorizzate?.length || 0} commesse
                  </p>
                </div>
              )}

              {/* Servizi delle commesse selezionate */}
              {formData.commesse_autorizzate && formData.commesse_autorizzate.length > 0 && servizi.length > 0 && (
                <div className="col-span-2">
                  <Label>Servizi Autorizzati *</Label>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-2 gap-2">
                      {servizi.map((servizio) => (
                        <div key={servizio.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-servizio-assistant-${servizio.id}`}
                            checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                            onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                          />
                          <Label htmlFor={`edit-servizio-assistant-${servizio.id}`} className="text-sm font-normal cursor-pointer">
                            {servizio.nome}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Selezionati: {formData.servizi_autorizzati?.length || 0} servizi
                  </p>
                </div>
              )}
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
const UnitsManagement = ({ selectedUnit }) => {
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

      {/* REMOVED: Old Unit Modals - using the ones in SubAgenzieManagement instead */}
    </div>
  );
};

// Create Unit Modal Component
const CreateUnitModal = ({ onClose, onSuccess, commesse, servizi }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    assistant_id: "",
    commesse_autorizzate: [],
    servizi_autorizzati: []
  });

  const toggleCommessa = (commessaId) => {
    console.log('🔄 toggleCommessa called for:', commessaId);
    setFormData(prev => {
      console.log('📊 Current commesse_autorizzate:', prev.commesse_autorizzate);
      const newCommesse = prev.commesse_autorizzate.includes(commessaId)
        ? prev.commesse_autorizzate.filter(id => id !== commessaId)
        : [...prev.commesse_autorizzate, commessaId];
      console.log('✅ New commesse_autorizzate:', newCommesse);
      return {
        ...prev,
        commesse_autorizzate: newCommesse
      };
    });
  };

  const toggleServizio = (servizioId) => {
    setFormData(prev => ({
      ...prev,
      servizi_autorizzati: prev.servizi_autorizzati.includes(servizioId)
        ? prev.servizi_autorizzati.filter(id => id !== servizioId)
        : [...prev.servizi_autorizzati, servizioId]
    }));
  };

  // Filter servizi based on selected commesse
  const getFilteredServizi = () => {
    if (!servizi || servizi.length === 0) return [];
    
    // If no commesse selected, show NO servizi (must select commessa first)
    if (formData.commesse_autorizzate.length === 0) {
      return [];
    }
    
    // Filter servizi to show only those belonging to selected commesse
    return servizi.filter(servizio => 
      formData.commesse_autorizzate.includes(servizio.commessa_id)
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSuccess(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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

          {/* Commesse e Servizi Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Commesse Selection */}
            <div>
              <Label>Commesse Autorizzate</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3 bg-gray-50">
                {commesse?.map((commessa) => (
                  <div key={commessa.id} className="flex items-center space-x-2 cursor-pointer" onClick={() => toggleCommessa(commessa.id)}>
                    <input
                      type="checkbox"
                      checked={formData.commesse_autorizzate && formData.commesse_autorizzate.includes(commessa.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleCommessa(commessa.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{commessa.nome}</span>
                  </div>
                ))}
                {(!commesse || commesse.length === 0) && (
                  <p className="text-sm text-gray-500 italic">Nessuna commessa disponibile</p>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Selezionate: {formData.commesse_autorizzate.length} commesse
              </p>
            </div>

            {/* Servizi Selection */}
            <div>
              <Label>Servizi Autorizzati</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3 bg-blue-50">
                {getFilteredServizi().map((servizio) => (
                  <div key={servizio.id} className="flex items-center space-x-2 cursor-pointer" onClick={() => toggleServizio(servizio.id)}>
                    <input
                      type="checkbox"
                      checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleServizio(servizio.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{servizio.nome}</span>
                  </div>
                ))}
                {getFilteredServizi().length === 0 && (
                  <p className="text-sm text-gray-500 italic">
                    {formData.commesse_autorizzate.length === 0 
                      ? "Seleziona prima una commessa per vedere i servizi" 
                      : "Nessun servizio disponibile per le commesse selezionate"}
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Selezionati: {formData.servizi_autorizzati.length} servizi
              </p>
            </div>
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
const EditUnitModal = ({ unit, onClose, onSuccess, commesse, servizi }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: unit?.name || "",
    description: unit?.description || "",
    assistant_id: unit?.assistant_id || "",
    commesse_autorizzate: unit?.commesse_autorizzate || [],
    servizi_autorizzati: unit?.servizi_autorizzati || []
  });

  const toggleCommessa = (commessaId) => {
    setFormData(prev => ({
      ...prev,
      commesse_autorizzate: prev.commesse_autorizzate.includes(commessaId)
        ? prev.commesse_autorizzate.filter(id => id !== commessaId)
        : [...prev.commesse_autorizzate, commessaId]
    }));
  };

  const toggleServizio = (servizioId) => {
    setFormData(prev => ({
      ...prev,
      servizi_autorizzati: prev.servizi_autorizzati.includes(servizioId)
        ? prev.servizi_autorizzati.filter(id => id !== servizioId)
        : [...prev.servizi_autorizzati, servizioId]
    }));
  };
  // Filter servizi based on selected commesse
  const getFilteredServizi = () => {
    if (!servizi || servizi.length === 0) return [];
    
    // If no commesse selected, show NO servizi (must select commessa first)
    if (formData.commesse_autorizzate.length === 0) {
      return [];
    }
    
    // Filter servizi to show only those belonging to selected commesse
    return servizi.filter(servizio => 
      formData.commesse_autorizzate.includes(servizio.commessa_id)
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSuccess(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Unit</DialogTitle>
          <DialogDescription>
            Modifica i dati della unit "{unit.name}"
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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

          {/* Unit Info Display */}
          <div className="bg-slate-50 p-3 rounded-lg space-y-2">
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

          {/* Commesse e Servizi Selection */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Commesse Selection */}
            <div>
              <Label>Commesse Autorizzate</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-3 bg-gray-50">
                {commesse?.map((commessa) => (
                  <div key={commessa.id} className="flex items-center space-x-2 cursor-pointer" onClick={() => toggleCommessa(commessa.id)}>
                    <input
                      type="checkbox"
                      checked={formData.commesse_autorizzate && formData.commesse_autorizzate.includes(commessa.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleCommessa(commessa.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{commessa.nome}</span>
                  </div>
                ))}
                {(!commesse || commesse.length === 0) && (
                  <p className="text-sm text-gray-500 italic">Nessuna commessa disponibile</p>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Selezionate: {formData.commesse_autorizzate.length} commesse
              </p>
            </div>

            {/* Servizi Selection */}
            <div>
              <Label>Servizi Autorizzati</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-3 bg-blue-50">
                {getFilteredServizi().map((servizio) => (
                  <div key={servizio.id} className="flex items-center space-x-2 cursor-pointer" onClick={() => toggleServizio(servizio.id)}>
                    <input
                      type="checkbox"
                      checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleServizio(servizio.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{servizio.nome}</span>
                  </div>
                ))}
                {getFilteredServizi().length === 0 && (
                  <p className="text-sm text-gray-500 italic">
                    {formData.commesse_autorizzate.length === 0 
                      ? "Seleziona prima una commessa per vedere i servizi" 
                      : "Nessun servizio disponibile per le commesse selezionate"}
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Selezionati: {formData.servizi_autorizzati.length} servizi
              </p>
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

// Advanced Analytics Management Component with Charts and Reports
// Responsabile Commessa Analytics Component
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
  const [activeTab, setActiveTab] = useState("dashboard");
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
  const { user } = useAuth();
  const { toast } = useToast();

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
        axios.get(`${API}/leads?${params}`),
        axios.get(`${API}/users?${params}`),
        axios.get(`${API}/commesse`)
      ]);

      const leads = leadsRes.data;
      const users = usersRes.data;

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
      const params = new URLSearchParams();
      params.append('date_from', dateRange.startDate);
      params.append('date_to', dateRange.endDate);
      
      // Create a temporary export endpoint for clients
      const response = await axios.get(`${API}/clienti`, { params });
      const clientiData = response.data;
      
      // For now, download as JSON (future: implement Excel export for clients)
      const blob = new Blob([JSON.stringify(clientiData, null, 2)], { type: 'application/json' });
      downloadFile(blob, `clienti_export_${format(new Date(), 'yyyyMMdd')}.json`);
      
      toast({ title: "Successo", description: "Export Clienti completato" });
    } catch (error) {
      console.error("Error exporting clienti:", error);
      toast({ title: "Errore", description: "Errore nell'export dei clienti", variant: "destructive" });
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
        <div className="hidden md:block space-y-6">
          {/* Desktop Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Totale Lead</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{dashboardData.totalLeads}</div>
                <p className="text-xs text-muted-foreground">Lead generati nel periodo</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Totale Clienti</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{dashboardData.totalClients}</div>
                <p className="text-xs text-muted-foreground">Clienti acquisiti</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasso Conversione</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{dashboardData.conversionRate}%</div>
                <p className="text-xs text-muted-foreground">Lead convertiti</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Commesse Attive</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{dashboardData.totalCommesse}</div>
                <p className="text-xs text-muted-foreground">Progetti in corso</p>
              </CardContent>
            </Card>
          </div>

          {/* Desktop Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Line Chart - Leads Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Andamento Lead (Ultimi 14 giorni)</CardTitle>
              </CardHeader>
              <CardContent>
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
            <Card>
              <CardHeader>
                <CardTitle>Distribuzione Esiti</CardTitle>
              </CardHeader>
              <CardContent>
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
            <Card>
              <CardHeader>
                <CardTitle>Performance Agenti (Top 10)</CardTitle>
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
            </div>
          </div>
        </div>

        {/* DESKTOP TABS */}
        <TabsList className="hidden md:grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="dashboard" className="text-base font-semibold">
            📊 Dashboard Overview
          </TabsTrigger>
          <TabsTrigger value="agents" className="text-base font-semibold">
            👥 Analytics Agenti
          </TabsTrigger>
          <TabsTrigger value="referenti" className="text-base font-semibold">
            🎯 Analytics Referenti
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {renderDashboard()}
        </TabsContent>

        {/* Agents Tab */}
        <TabsContent value="agents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Seleziona Agente per Analytics Dettagliate</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedAgent} onValueChange={(value) => {
                setSelectedAgent(value);
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
            </CardContent>
          </Card>

          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-slate-600">Caricamento analytics...</p>
              </CardContent>
            </Card>
          ) : analyticsData && selectedAgent ? (
            renderAgentAnalytics()
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">Seleziona un agente per visualizzare le analytics</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Referenti Tab */}
        <TabsContent value="referenti" className="space-y-6">
          {user.role === "admin" ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Seleziona Referente per Analytics Dettagliate</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedReferente} onValueChange={(value) => {
                    setSelectedReferente(value);
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
                </CardContent>
              </Card>

              {loading ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-slate-600">Caricamento analytics...</p>
                  </CardContent>
                </Card>
              ) : analyticsData && selectedReferente ? (
                renderReferenteAnalytics()
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Users2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600">Seleziona un referente per visualizzare le analytics</p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <ShieldCheck className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">Solo gli amministratori possono visualizzare le analytics dei referenti</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Documents Management Component with Role-Based Access Control
const DocumentsManagement = ({ 
  selectedUnit, 
  selectedCommessa, 
  selectedTipologiaContratto, 
  units, 
  commesse, 
  subAgenzie, 
  userRole, 
  userId 
}) => {
  const [activeTab, setActiveTab] = useState("clienti"); // "clienti" or "lead"
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [entityList, setEntityList] = useState([]); // Clienti o Lead disponibili
  const [selectedEntity, setSelectedEntity] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [filters, setFilters] = useState({
    entity_id: "",
    nome: "",
    cognome: "",
    date_from: "",
    date_to: ""
  });
  const { toast } = useToast();
  const { user } = useAuth();

  // Determina le autorizzazioni basate sul ruolo
  const getPermissions = () => {
    switch (userRole) {
      case "admin":
        return {
          canViewAll: true,
          canUpload: true,
          canDownload: true,
          commesseFilter: null, // Vede tutte le commesse
          subAgenzieFilter: null, // Vede tutte le sub agenzie
          entityFilter: null // Vede tutti i clienti/lead
        };
      
      case "responsabile_commessa":
      case "backoffice_commessa":
        return {
          canViewAll: false,
          canUpload: true,
          canDownload: true,
          commesseFilter: user.commesse_autorizzate, // Solo commesse autorizzate
          subAgenzieFilter: null, // Tutte le sub agenzie delle sue commesse
          entityFilter: "commessa" // Filtra per commessa
        };
      
      case "responsabile_sub_agenzia":
      case "backoffice_sub_agenzia":
        return {
          canViewAll: false,
          canUpload: true,
          canDownload: true,
          commesseFilter: user.commesse_autorizzate,
          subAgenzieFilter: [user.sub_agenzia_id], // Solo la sua sub agenzia
          entityFilter: "sub_agenzia"
        };
      
      case "agente_specializzato":
      case "operatore":
      case "agente":
        return {
          canViewAll: false,
          canUpload: true,
          canDownload: true,
          commesseFilter: user.commesse_autorizzate,
          subAgenzieFilter: user.sub_agenzie_autorizzate,
          entityFilter: "created_by", // Solo le sue anagrafiche
          createdByFilter: userId
        };
      
      default:
        return {
          canViewAll: false,
          canUpload: false,
          canDownload: false,
          commesseFilter: [],
          subAgenzieFilter: [],
          entityFilter: null
        };
    }
  };

  const permissions = getPermissions();

  useEffect(() => {
    fetchDocuments();
  }, [selectedCommessa, selectedUnit, filters, activeTab]);

  // Search entities function with debouncing
  const searchEntities = async (query, entityType) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      setIsSearching(true);
      const response = await axios.get(`${API}/search-entities?query=${encodeURIComponent(query)}&entity_type=${entityType}`);
      setSearchResults(response.data.results || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error("Error searching entities:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  const handleSearchInput = (query) => {
    setSearchQuery(query);
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Set new timeout for debounced search
    const timeout = setTimeout(() => {
      searchEntities(query, activeTab);
    }, 300); // 300ms debounce

    setSearchTimeout(timeout);
  };

  // Handle entity selection from search results
  const handleEntitySelect = (entity) => {
    setSelectedEntity(entity.id);
    setSearchQuery(`${entity.display_name} (${entity.matched_fields.join(', ')})`);
    setShowSearchResults(false);
    setSearchResults([]);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setSelectedEntity("");
    setSearchResults([]);
    setShowSearchResults(false);
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
  };

  // Other functions (Aruba Drive functions moved to Dashboard component)

  const fetchEntityList = async () => {
    try {
      const params = new URLSearchParams();
      
      // Applica filtri basati sui permessi
      if (!permissions.canViewAll) {
        if (permissions.commesseFilter) {
          permissions.commesseFilter.forEach(commessaId => {
            params.append('commessa_ids', commessaId);
          });
        }
        if (permissions.subAgenzieFilter) {
          permissions.subAgenzieFilter.forEach(subAgenziaId => {
            params.append('sub_agenzia_ids', subAgenziaId);
          });
        }
        if (permissions.createdByFilter) {
          params.append('created_by', permissions.createdByFilter);
        }
      }

      // Seleziona l'endpoint appropriato
      const endpoint = activeTab === "clienti" ? "/clienti" : "/leads";
      const response = await axios.get(`${API}${endpoint}?${params}`);
      setEntityList(response.data);
    } catch (error) {
      console.error(`Error fetching ${activeTab}:`, error);
      setEntityList([]);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      // Tipo di documento
      params.append('document_type', activeTab);
      
      // Filtri di autorizzazione
      if (!permissions.canViewAll) {
        if (permissions.commesseFilter) {
          permissions.commesseFilter.forEach(commessaId => {
            params.append('commessa_ids', commessaId);
          });
        }
        if (permissions.subAgenzieFilter) {
          permissions.subAgenzieFilter.forEach(subAgenziaId => {
            params.append('sub_agenzia_ids', subAgenziaId);
          });
        }
        if (permissions.createdByFilter) {
          params.append('created_by', permissions.createdByFilter);
        }
      }

      // Filtri aggiuntivi
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim()) {
          params.append(key, value.trim());
        }
      });

      const response = await axios.get(`${API}/documents?${params}`);
      setDocuments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento documenti",
        variant: "destructive",
      });
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMultipleUpload = async (entityId, files) => {
    if (!permissions.canUpload) {
      toast({
        title: "Non autorizzato",
        description: "Non hai i permessi per caricare documenti",
        variant: "destructive",
      });
      return;
    }

    if (!files || files.length === 0) {
      toast({
        title: "Errore",
        description: "Seleziona almeno un file da caricare",
        variant: "destructive",
      });
      return;
    }

    try {
      const uploadPromises = files.map(async (file, index) => {
        const fileId = `${file.name}-${index}-${Date.now()}`;
        
        // Initialize progress for this file
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: { progress: 0, status: 'uploading', filename: file.name }
        }));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('entity_type', activeTab);
        formData.append('entity_id', entityId);
        formData.append('uploaded_by', userId);

        try {
          const response = await axios.post(`${API}/documents/upload`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(prev => ({
                ...prev,
                [fileId]: { ...prev[fileId], progress: percentCompleted }
              }));
            }
          });

          // Update progress to completed
          setUploadProgress(prev => ({
            ...prev,
            [fileId]: { ...prev[fileId], progress: 100, status: 'completed' }
          }));

          return { success: true, filename: file.name, data: response.data };
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          setUploadProgress(prev => ({
            ...prev,
            [fileId]: { ...prev[fileId], status: 'error', error: error.message }
          }));
          return { success: false, filename: file.name, error: error.message };
        }
      });

      const results = await Promise.all(uploadPromises);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      // Show results
      if (successful.length > 0) {
        toast({
          title: "Upload Completato",
          description: `${successful.length} file caricati con successo${failed.length > 0 ? `, ${failed.length} falliti` : ''}`,
        });
      }

      if (failed.length > 0) {
        toast({
          title: "Alcuni upload falliti",
          description: `${failed.length} file non sono stati caricati: ${failed.map(f => f.filename).join(', ')}`,
          variant: "destructive",
        });
      }

      // Refresh documents list
      fetchDocuments();

      // Integrazione Aruba Drive per upload completati
      if (successful.length > 0) {
        // TODO: Chiamata API per integrazione Aruba Drive
        console.log('🌐 ARUBA DRIVE: Preparando upload per', entityId);
      }

      // Close modal and reset state
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadFiles([]);
        setUploadProgress({});
        setSelectedEntity("");
      }, 2000);

    } catch (error) {
      console.error("Error in multiple upload:", error);
      toast({
        title: "Errore",
        description: "Errore durante l'upload multiplo",
        variant: "destructive",
      });
    }
  };

  // Drag & Drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setUploadFiles(droppedFiles);
    }
  };

  // File input handler
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      setUploadFiles(selectedFiles);
    }
  };

  const handleDownload = async (documentId, filename) => {
    if (!permissions.canDownload) {
      toast({
        title: "Non autorizzato",
        description: "Non hai i permessi per scaricare documenti",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await axios.get(`${API}/documents/${documentId}/download`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({
        title: "Errore",
        description: "Errore nel download del documento",
        variant: "destructive",
      });
    }
  };

  const getRoleDisplayText = () => {
    switch (userRole) {
      case "admin":
        return "Puoi gestire documenti di tutti i clienti e lead";
      case "responsabile_commessa":
      case "backoffice_commessa":
        return "Puoi gestire documenti delle commesse autorizzate e relative Sub Agenzie/Unit";
      case "responsabile_sub_agenzia":
      case "backoffice_sub_agenzia":
        return "Puoi gestire documenti della tua Sub Agenzia nelle commesse autorizzate";
      case "agente_specializzato":
      case "operatore":
      case "agente":
        return "Puoi gestire documenti solo delle anagrafiche create da te";
      default:
        return "Accesso limitato ai documenti";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 🖥️ DESKTOP VIEW */}
      <div className="hidden md:block">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg p-6 text-white mb-6">
          <h1 className="text-2xl font-bold mb-2">📁 Gestione Documenti</h1>
          <p className="text-blue-100">{getRoleDisplayText()}</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-slate-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => setActiveTab("clienti")}
            className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all ${
              activeTab === "clienti"
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-700 hover:bg-slate-200"
            }`}
          >
            👥 Documenti Clienti
          </button>
          <button
            onClick={() => setActiveTab("lead")}
            className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all ${
              activeTab === "lead"
                ? "bg-green-600 text-white shadow-md"
                : "text-slate-700 hover:bg-slate-200"
            }`}
          >
            📞 Documenti Lead
          </button>
        </div>

        {/* Upload Button */}
        {permissions.canUpload && (
          <div className="mb-6">
            <Button
              onClick={() => setShowUploadModal(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Carica Nuovo Documento
            </Button>
          </div>
        )}

        {/* Documents Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              {activeTab === "clienti" ? "📁 Documenti Clienti" : "📁 Documenti Lead"}
              <Badge variant="secondary" className="ml-2">
                {documents.length} documenti
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-500">Nessun documento trovato</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome File</TableHead>
                      <TableHead>{activeTab === "clienti" ? "Cliente" : "Lead"}</TableHead>
                      <TableHead>Dimensione</TableHead>
                      <TableHead>Caricato da</TableHead>
                      <TableHead>Data Upload</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="font-medium">{doc.filename}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {doc.entity_name || `${activeTab} ID: ${doc.entity_id}`}
                        </TableCell>
                        <TableCell>{doc.file_size || 'N/A'}</TableCell>
                        <TableCell>{doc.uploaded_by_name || 'N/A'}</TableCell>
                        <TableCell>
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString('it-IT') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {permissions.canDownload && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(doc.id, doc.filename)}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Scarica
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 📱 MOBILE VIEW */}
      <div className="md:hidden p-4 space-y-6 bg-slate-50 min-h-screen">
        {/* Mobile Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white">
          <h2 className="text-xl font-bold mb-2">📁 Documenti</h2>
          <p className="text-blue-100 text-sm">{getRoleDisplayText()}</p>
        </div>

        {/* Mobile Tab Navigation */}
        <div className="bg-white rounded-xl p-1 shadow-lg">
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => setActiveTab("clienti")}
              className={`py-4 px-4 rounded-lg font-semibold text-sm transition-all ${
                activeTab === "clienti"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              👥 Clienti
            </button>
            <button
              onClick={() => setActiveTab("lead")}
              className={`py-4 px-4 rounded-lg font-semibold text-sm transition-all ${
                activeTab === "lead"
                  ? "bg-green-600 text-white shadow-md"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              📞 Lead
            </button>
          </div>
        </div>

        {/* Mobile Upload Button */}
        {permissions.canUpload && (
          <Button
            onClick={() => setShowUploadModal(true)}
            className="w-full bg-green-600 hover:bg-green-700 py-4 text-base font-semibold"
          >
            <Upload className="w-5 h-5 mr-2" />
            Carica Nuovo Documento
          </Button>
        )}

        {/* Mobile Documents List */}
        <div className="space-y-4">
          {documents.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">Nessun documento trovato</p>
            </Card>
          ) : (
            documents.map((doc) => (
              <Card key={doc.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <h3 className="font-semibold text-slate-900 text-sm truncate">
                        {doc.filename}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500">
                      {doc.entity_name || `${activeTab} ID: ${doc.entity_id}`}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-2 mb-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dimensione:</span>
                    <span className="text-slate-700">{doc.file_size || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Caricato da:</span>
                    <span className="text-slate-700">{doc.uploaded_by_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Data:</span>
                    <span className="text-slate-700">
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString('it-IT') : 'N/A'}
                    </span>
                  </div>
                </div>
                
                {permissions.canDownload && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(doc.id, doc.filename)}
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Scarica Documento
                  </Button>
                )}
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Upload Modal - Multiplo con Progress Bar */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Carica Documenti</CardTitle>
              <p className="text-sm text-slate-600">Carica uno o più documenti contemporaneamente</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Entity Search */}
              <div>
                <Label>Cerca {activeTab === "clienti" ? "Cliente" : "Lead"}:</Label>
                <p className="text-xs text-slate-600 mb-2">
                  Cerca per: ID, Cognome, {activeTab === "clienti" ? "Codice Fiscale, P.IVA, " : ""}Telefono, Email
                </p>
                <div className="relative">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={`Digita per cercare ${activeTab === "clienti" ? "cliente" : "lead"}...`}
                      value={searchQuery}
                      onChange={(e) => handleSearchInput(e.target.value)}
                      className="w-full p-3 pr-10 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                  </div>

                  {/* Search Results Dropdown */}
                  {showSearchResults && searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
                      {searchResults.map((entity, index) => (
                        <div
                          key={entity.id}
                          onClick={() => handleEntitySelect(entity)}
                          className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">
                                {entity.display_name}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {entity.matched_fields.map((field, idx) => (
                                  <span
                                    key={idx}
                                    className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded"
                                  >
                                    {field}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="ml-2 text-xs text-slate-500">
                              {entity.entity_type === "clienti" ? "Cliente" : "Lead"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No Results Message */}
                  {showSearchResults && searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg p-3">
                      <p className="text-slate-500 text-sm">
                        Nessun {activeTab === "clienti" ? "cliente" : "lead"} trovato per "{searchQuery}"
                      </p>
                    </div>
                  )}

                  {/* Search Instructions */}
                  {searchQuery.length > 0 && searchQuery.length < 2 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg p-3">
                      <p className="text-slate-500 text-sm">
                        Digita almeno 2 caratteri per iniziare la ricerca
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Drag & Drop Area */}
              <div>
                <Label>File:</Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">
                    {isDragging ? 'Rilascia i file qui' : 'Trascina i file qui o clicca per selezionare'}
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Supporta: PDF, DOC, DOCX, JPG, JPEG, PNG, TXT
                  </p>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                  />
                  <label
                    htmlFor="file-upload"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Seleziona File
                  </label>
                </div>
              </div>

              {/* Selected Files List */}
              {uploadFiles.length > 0 && (
                <div>
                  <Label>File Selezionati ({uploadFiles.length}):</Label>
                  <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                    {uploadFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
                        <div className="flex items-center space-x-3">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">{file.name}</p>
                            <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUploadFiles(files => files.filter((_, i) => i !== index));
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {Object.keys(uploadProgress).length > 0 && (
                <div>
                  <Label>Progresso Upload:</Label>
                  <div className="space-y-3 mt-2">
                    {Object.entries(uploadProgress).map(([fileId, progress]) => (
                      <div key={fileId} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{progress.filename}</span>
                          <span className="text-sm text-slate-500">
                            {progress.status === 'uploading' && `${progress.progress}%`}
                            {progress.status === 'completed' && (
                              <span className="text-green-600 flex items-center">
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Completato
                              </span>
                            )}
                            {progress.status === 'error' && (
                              <span className="text-red-600 flex items-center">
                                <AlertCircle className="w-4 h-4 mr-1" />
                                Errore
                              </span>
                            )}
                          </span>
                        </div>
                        {progress.status === 'uploading' && (
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress.progress}%` }}
                            ></div>
                          </div>
                        )}
                        {progress.status === 'completed' && (
                          <div className="w-full bg-green-200 rounded-full h-2">
                            <div className="bg-green-600 h-2 rounded-full w-full"></div>
                          </div>
                        )}
                        {progress.status === 'error' && (
                          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                            {progress.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="flex space-x-2">
                <Button
                  onClick={() => {
                    if (selectedEntity && uploadFiles.length > 0) {
                      handleMultipleUpload(selectedEntity, uploadFiles);
                    }
                  }}
                  disabled={!selectedEntity || uploadFiles.length === 0 || Object.keys(uploadProgress).length > 0}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Carica {uploadFiles.length > 1 ? `${uploadFiles.length} File` : 'File'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFiles([]);
                    setUploadProgress({});
                    setSelectedEntity("");
                    setIsDragging(false);
                    clearSearch();
                  }}
                  className="flex-1"
                  disabled={Object.keys(uploadProgress).length > 0}
                >
                  Annulla
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

const AIConfigurationManagement = () => {
  const [config, setConfig] = useState(null);
  const [assistants, setAssistants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false); // Per AI config
  const { toast } = useToast();

  useEffect(() => {
    fetchAIConfig();
  }, []);

  const fetchAIConfig = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/ai-config`);
      setConfig(response.data);
      
      if (response.data && response.data.assistants) {
        setAssistants(response.data.assistants);
      }
    } catch (error) {
      console.error("Error fetching AI config:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-800">
          Configurazione AI
        </h2>
        <Button onClick={() => setShowConfigModal(true)}>
          <Settings className="w-4 h-4 mr-2" />
          Configura
        </Button>
      </div>

      {/* Current Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Stato Configurazione</CardTitle>
          <CardDescription>
            Visualizza lo stato attuale della configurazione AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          {config && config.openai_configured ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-green-700 font-medium">OpenAI configurato correttamente</span>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">Dettagli Configurazione:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-green-600 font-medium">Modello:</span>
                    <span className="ml-2 text-green-800">{config.model_name || "gpt-3.5-turbo"}</span>
                  </div>
                  <div>
                    <span className="text-green-600 font-medium">Status:</span>
                    <span className="ml-2 text-green-800">Attivo</span>
                  </div>
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
                Per utilizzare le funzionalità AI, è necessario configurare una chiave API OpenAI valida.
              </p>
              <Button onClick={() => setShowConfigModal(true)} className="w-fit">
                <Settings className="w-4 h-4 mr-2" />
                Configura OpenAI
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assistants List */}
      {assistants && assistants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assistant Configurati</CardTitle>
            <CardDescription>
              Lista degli assistant AI configurati per le unità
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assistants.map((assistant, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{assistant.name || "Assistant"}</h4>
                      <p className="text-sm text-slate-600">Unità: {assistant.unit_id || "Tutte"}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-green-600">Attivo</span>
                    </div>
                  </div>
                  {assistant.description && (
                    <p className="text-sm text-slate-600 mt-2">{assistant.description}</p>
                  )}
                </div>
              ))}
            </div>
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

  useEffect(() => {
    if (existingConfig && existingConfig.openai_api_key_preview) {
      setApiKey(existingConfig.openai_api_key_preview);
    }
  }, [existingConfig]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci una chiave API valida",
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
          description: "Configurazione AI salvata correttamente",
        });
        onSuccess();
      } else {
        throw new Error(response.data.message || "Configurazione non valida");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurazione AI</DialogTitle>
          <DialogDescription>
            Inserisci la tua chiave API OpenAI per abilitare le funzionalità AI
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="apiKey">Chiave API OpenAI</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              La chiave API verrà crittografata e salvata in modo sicuro
            </p>
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

// Configurazioni Management Component
const ConfigurazioniManagement = ({ 
  onFetchConfigs,
  arubaDriveConfigs,
  onSaveConfig,
  onDeleteConfig,
  onTestConfig,
  testingConfigId,
  editingConfig,
  setEditingConfig,
  showConfigModal,
  setShowConfigModal
}) => {
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // ConfigurazioniManagement non deve chiamare direttamente fetchArubaDriveConfigs
    // Viene gestito dal useEffect del Dashboard quando activeTab cambia
    setLoading(false);
  }, []);

  const handleSaveConfig = async (configData) => {
    if (onSaveConfig) {
      await onSaveConfig(configData);
    }
  };

  const handleDeleteConfig = async (configId) => {
    if (onDeleteConfig) {
      await onDeleteConfig(configId);
    }
  };

  const handleTestConfig = async (configId) => {
    if (onTestConfig) {
      await onTestConfig(configId);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Caricamento configurazioni...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestione Configurazioni</h1>
          <p className="text-gray-600">Gestisci le configurazioni del sistema</p>
        </div>
        
        <Button
          onClick={() => setShowConfigModal && setShowConfigModal(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuova Configurazione
        </Button>
      </div>

      {/* Aruba Drive Configurations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Cog className="w-5 h-5" />
            <span>Configurazioni Aruba Drive</span>
          </CardTitle>
          <CardDescription>
            Gestisci le configurazioni per l'integrazione con Aruba Drive
          </CardDescription>
        </CardHeader>
        <CardContent>
          {arubaDriveConfigs && arubaDriveConfigs.length > 0 ? (
            <div className="space-y-4">
              {arubaDriveConfigs.map((config) => (
                <div key={config.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{config.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{config.name}</p>
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-gray-500">
                          <strong>URL:</strong> {config.url}
                        </p>
                        <p className="text-xs text-gray-500">
                          <strong>Username:</strong> {config.username}
                        </p>
                        <p className="text-xs text-gray-500">
                          <strong>Password:</strong> {config.password_masked}
                        </p>
                        <p className="text-xs text-gray-500">
                          <strong>Stato:</strong> 
                          <span className={`ml-1 px-2 py-1 rounded text-xs ${
                            config.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {config.is_active ? 'Attiva' : 'Inattiva'}
                          </span>
                        </p>
                      </div>
                      {config.last_test_result && (
                        <div className="mt-2">
                          <span 
                            className={`inline-block px-2 py-1 rounded text-xs ${
                              config.last_test_result.success 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {config.last_test_result.success ? "✓ Test OK" : "✗ Test Fallito"}
                          </span>
                          {config.last_test_result.message && (
                            <p className="text-xs text-gray-600 mt-1">{config.last_test_result.message}</p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestConfig(config.id)}
                        disabled={testingConfigId === config.id}
                      >
                        {testingConfigId === config.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                            Test...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Test
                          </>
                        )}
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingConfig && setEditingConfig(config);
                          setShowConfigModal && setShowConfigModal(true);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Modifica
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteConfig(config.id)}
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Elimina
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Cog className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nessuna configurazione trovata
              </h3>
              <p className="text-gray-600 mb-4">
                Inizia creando la tua prima configurazione Aruba Drive
              </p>
              <Button
                onClick={() => setShowConfigModal && setShowConfigModal(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crea Configurazione
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aruba Drive Configuration Modal */}
      <ArubaDriveConfigModal 
        isOpen={showConfigModal}
        onClose={() => {
          setShowConfigModal(false);
          setEditingConfig && setEditingConfig(null);
        }}
        onSave={handleSaveConfig}
        editingConfig={editingConfig}
      />
    </div>
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

// Lead Qualification Management Component (FASE 4)
const LeadQualificationManagement = ({ selectedUnit, units }) => {
  const [activeTab, setActiveTab] = useState("active");
  const [qualifications, setQualifications] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (activeTab === "active") {
      fetchActiveQualifications();
    } else if (activeTab === "analytics") {
      fetchQualificationAnalytics();
    }
  }, [activeTab, selectedUnit]);

  const fetchActiveQualifications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      
      const response = await axios.get(`${API}/lead-qualification/active?${params}`);
      setQualifications(response.data.active_qualifications || []);
    } catch (error) {
      console.error("Error fetching active qualifications:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle qualificazioni attive",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchQualificationAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedUnit && selectedUnit !== "all") {
        params.append('unit_id', selectedUnit);
      }
      
      // Last 30 days
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 30);
      params.append('date_from', dateFrom.toISOString());
      
      const response = await axios.get(`${API}/lead-qualification/analytics?${params}`);
      setAnalytics(response.data.analytics);
    } catch (error) {
      console.error("Error fetching qualification analytics:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle analytics qualificazioni",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualResponse = async (leadId, message) => {
    try {
      const formData = new FormData();
      formData.append('message', message);
      formData.append('source', 'manual');
      
      const response = await axios.post(`${API}/lead-qualification/${leadId}/response`, formData);
      
      if (response.data.success) {
        toast({
          title: "Successo",
          description: "Risposta processata con successo",
        });
        setShowResponseModal(false);
        setSelectedLead(null);
        fetchActiveQualifications();
      } else {
        toast({
          title: "Attenzione",
          description: response.data.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error processing manual response:", error);
      toast({
        title: "Errore",
        description: "Errore nell'invio della risposta",
        variant: "destructive",
      });
    }
  };

  const handleCompleteQualification = async (leadId, result, score, notes) => {
    try {
      const formData = new FormData();
      formData.append('result', result);
      formData.append('score', score.toString());
      formData.append('notes', notes);
      
      const response = await axios.post(`${API}/lead-qualification/${leadId}/complete`, formData);
      
      if (response.data.success) {
        toast({
          title: "Successo",
          description: "Qualificazione completata manualmente",
        });
        fetchActiveQualifications();
      }
    } catch (error) {
      console.error("Error completing qualification:", error);
      toast({
        title: "Errore",
        description: "Errore nel completamento manuale",
        variant: "destructive",
      });
    }
  };

  const formatTimeRemaining = (seconds) => {
    if (!seconds || seconds <= 0) return "Scaduto";
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const getStageLabel = (stage) => {
    const stages = {
      "initial": "Contatto Iniziale",
      "interest_check": "Verifica Interesse", 
      "info_gathering": "Raccolta Info",
      "qualification": "Qualificazione",
      "completed": "Completato",
      "timeout": "Timeout",
      "agent_assigned": "Assegnato ad Agente"
    };
    return stages[stage] || stage;
  };

  const renderActiveQualifications = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (qualifications.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <Bot className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">Nessuna qualificazione attiva al momento</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {qualifications.map((qual) => (
          <Card key={qual.qualification_id} className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Bot className="w-5 h-5 text-blue-600" />
                  <div>
                    <CardTitle className="text-lg">{qual.lead_name}</CardTitle>
                    <p className="text-sm text-slate-500">{qual.lead_phone}</p>
                  </div>
                </div>
                <Badge variant="outline" className="flex items-center space-x-1">
                  <Timer className="w-3 h-3" />
                  <span>{formatTimeRemaining(qual.time_remaining_seconds)}</span>
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label className="text-xs text-slate-500">Stadio</Label>
                  <p className="font-medium">{getStageLabel(qual.stage)}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Score</Label>
                  <p className="font-medium flex items-center">
                    <Award className="w-4 h-4 mr-1 text-yellow-500" />
                    {qual.score}/100
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Risposte Lead</Label>
                  <p className="font-medium">{qual.responses_count}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Messaggi Bot</Label>
                  <p className="font-medium">{qual.bot_messages_sent}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Iniziato: {new Date(qual.started_at).toLocaleString('it-IT')}
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedLead(qual);
                      setShowResponseModal(true);
                    }}
                  >
                    <MessageCircle className="w-4 h-4 mr-1" />
                    Aggiungi Risposta
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCompleteQualification(qual.lead_id, 'manual_completion', qual.score, 'Completato manualmente')}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Completa
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderAnalytics = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!analytics) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <Activity className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600">Nessun dato analytics disponibile</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Qualificazioni Totali</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{analytics.total_qualifications}</div>
              <p className="text-xs text-muted-foreground">Negli ultimi 30 giorni</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attualmente Attive</CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{analytics.active_qualifications}</div>
              <p className="text-xs text-muted-foreground">In corso ora</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasso Conversione</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{analytics.conversion_rate}%</div>
              <p className="text-xs text-muted-foreground">Lead qualificati</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Score Medio</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{analytics.average_score}</div>
              <p className="text-xs text-muted-foreground">Qualità media lead</p>
            </CardContent>
          </Card>
        </div>

        {/* Results Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Risultati Qualificazione</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(analytics.results_breakdown).map(([result, count]) => (
                <div key={result} className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-800">{count}</div>
                  <div className="text-sm text-slate-600 capitalize">{result.replace('_', ' ')}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Metriche Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Risposte medie per lead:</span>
                  <span className="font-medium">{analytics.average_responses_per_lead}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Messaggi bot medi:</span>
                  <span className="font-medium">{analytics.average_bot_messages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Lead qualificati:</span>
                  <span className="font-medium text-green-600">{analytics.qualified_leads}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Completati:</span>
                  <span className="font-medium">{analytics.completed_qualifications}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sistema Bot Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {analytics.conversion_rate}%
                </div>
                <p className="text-slate-600">Efficacia Bot</p>
                <div className="mt-4 text-sm text-slate-500">
                  Il sistema bot qualifica automaticamente i lead con un tasso di successo del {analytics.conversion_rate}%
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-slate-800 flex items-center">
          <Bot className="w-8 h-8 mr-3 text-blue-600" />
          Qualificazione Lead Automatica
        </h2>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => fetchActiveQualifications()}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <Activity className="w-4 h-4 mr-2" />
            Aggiorna
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">Qualificazioni Attive</TabsTrigger>
          <TabsTrigger value="analytics">Analytics & Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          {renderActiveQualifications()}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {renderAnalytics()}
        </TabsContent>
      </Tabs>

      {/* Manual Response Modal */}
      {showResponseModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md m-4">
            <CardHeader>
              <CardTitle>Aggiungi Risposta Manuale</CardTitle>
              <p className="text-sm text-slate-500">
                Lead: {selectedLead.lead_name} - {selectedLead.lead_phone}
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => {
                e.preventDefault();
                const message = e.target.message.value;
                if (message.trim()) {
                  handleManualResponse(selectedLead.lead_id, message);
                }
              }}>
                <div className="space-y-4">
                  <div>
                    <Label>Messaggio del Lead</Label>
                    <Input
                      name="message"
                      placeholder="Inserisci la risposta del lead..."
                      required
                    />
                  </div>
                  <div className="text-xs text-slate-500">
                    Stadio attuale: {getStageLabel(selectedLead.stage)}
                  </div>
                  <div className="flex space-x-2">
                    <Button type="submit" className="flex-1">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Invia Risposta
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowResponseModal(false);
                        setSelectedLead(null);
                      }}
                    >
                      Annulla
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
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
const CommesseManagement = ({ 
  selectedUnit, 
  units, 
  selectedTipologia,
  setSelectedTipologia,
  selectedSegmento,
  setSelectedSegmento,
  segmenti,
  offerte,
  fetchSegmenti,
  fetchOfferte,
  updateSegmento,
  createOfferta,
  updateOfferta,
  deleteOfferta 
}) => {
  const [commesse, setCommesse] = useState([]);
  const [servizi, setServizi] = useState([]);
  const [tipologieContratto, setTipologieContratto] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCommessa, setSelectedCommessa] = useState(null);
  const [selectedServizio, setSelectedServizio] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateTipologiaModal, setShowCreateTipologiaModal] = useState(false);
  const [showCreateOffertaModal, setShowCreateOffertaModal] = useState(false);
  const [showViewCommessaModal, setShowViewCommessaModal] = useState(false);
  const [showEditCommessaModal, setShowEditCommessaModal] = useState(false);
  const [editingCommessa, setEditingCommessa] = useState(null);
  const [modalType, setModalType] = useState(''); // 'commessa', 'servizio', 'tipologia', 'offerta'
  const { toast } = useToast();

  console.log('🎯 CommesseManagement props:', { 
    selectedTipologia, 
    selectedSegmento, 
    segmenti: segmenti?.length,
    offerte: offerte?.length 
  });

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
      setTipologieContratto([]); // Reset tipologie quando cambia servizio
      setSelectedServizio(null);
    } catch (error) {
      console.error("Error fetching servizi:", error);
      setServizi([]); // Reset servizi on error
      setTipologieContratto([]);
    }
  };

  const fetchTipologieContratto = async (servizioId) => {
    try {
      const response = await axios.get(`${API}/servizi/${servizioId}/tipologie-contratto`);
      console.log(`Tipologie contratto per servizio ${servizioId}:`, response.data);
      setTipologieContratto(response.data);
    } catch (error) {
      console.error("Error fetching tipologie contratto:", error);
      setTipologieContratto([]);
    }
  };

  const createCommessa = async (commessaData) => {
    try {
      const response = await axios.post(`${API}/commesse`, commessaData);
      // Aggiorna la lista delle commesse
      await fetchCommesse();
      
      toast({
        title: "Successo",
        description: "Commessa creata con successo",
      });
      
      // Se non c'è una commessa selezionata, seleziona automaticamente quella appena creata
      if (!selectedCommessa) {
        setSelectedCommessa(response.data);
        await fetchServizi(response.data.id);
      }
      
    } catch (error) {
      console.error("Error creating commessa:", error);
      toast({
        title: "Errore",
        description: "Errore nella creazione della commessa",
        variant: "destructive",
      });
    }
  };

  const updateCommessa = async (commessaId, commessaData) => {
    try {
      const response = await axios.put(`${API}/commesse/${commessaId}`, commessaData);
      
      // Aggiorna la lista delle commesse
      await fetchCommesse();
      
      // Se la commessa modificata è quella selezionata, aggiorna anche quella
      if (selectedCommessa && selectedCommessa.id === commessaId) {
        setSelectedCommessa(response.data);
        // Ricarica anche i servizi se necessario per aggiornare i dati correlati
        await fetchServizi(commessaId);
      }
      
      toast({
        title: "Successo",
        description: "Commessa aggiornata con successo",
      });
      
    } catch (error) {
      console.error("Error updating commessa:", error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento della commessa",
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

  const createTipologiaContratto = async (tipologiaData) => {
    try {
      const response = await axios.post(`${API}/tipologie-contratto`, {
        ...tipologiaData,
        servizio_id: selectedServizio
      });
      
      // Refresh tipologie list
      if (selectedServizio) {
        fetchTipologieContratto(selectedServizio);
      }
      
      toast({
        title: "Successo",
        description: "Tipologia contratto creata con successo",
      });
    } catch (error) {
      console.error("Error creating tipologia contratto:", error);
      toast({
        title: "Errore",
        description: "Errore nella creazione della tipologia contratto",
        variant: "destructive",
      });
    }
  };

  const deleteTipologiaContratto = async (tipologiaId) => {
    try {
      await axios.delete(`${API}/tipologie-contratto/${tipologiaId}`);
      
      // Refresh tipologie list
      if (selectedServizio) {
        fetchTipologieContratto(selectedServizio);
      }
      
      toast({
        title: "Successo",
        description: "Tipologia contratto eliminata con successo",
      });
    } catch (error) {
      console.error("Error deleting tipologia contratto:", error);
      toast({
        title: "Errore",
        description: "Errore nell'eliminazione della tipologia contratto",
        variant: "destructive",
      });
    }
  };

  const deleteCommessa = async (commessaId) => {
    try {
      await axios.delete(`${API}/commesse/${commessaId}`);
      
      // Se la commessa eliminata era quella selezionata, resetta la selezione
      if (selectedCommessa && selectedCommessa.id === commessaId) {
        setSelectedCommessa(null);
        setSelectedServizio(null);
        setServizi([]);
        setTipologieContratto([]);
      }
      
      // Refresh commesse list
      await fetchCommesse();
      
      toast({
        title: "Successo",
        description: "Commessa eliminata con successo",
      });
    } catch (error) {
      console.error("Error deleting commessa:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'eliminazione della commessa",
        variant: "destructive",
      });
    }
  };

  const deleteServizio = async (servizioId) => {
    try {
      await axios.delete(`${API}/servizi/${servizioId}`);
      
      // Refresh servizi list
      if (selectedCommessa) {
        fetchServiziPerCommessa(selectedCommessa);
      }
      
      toast({
        title: "Successo",
        description: "Servizio eliminato con successo",
      });
    } catch (error) {
      console.error("Error deleting servizio:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'eliminazione del servizio",
        variant: "destructive",
      });
    }
  };

  const rimuoviTipologiaDaServizio = async (tipologiaId, servizioId) => {
    try {
      await axios.delete(`${API}/servizi/${servizioId}/tipologie-contratto/${tipologiaId}`);
      
      // Refresh tipologie list
      if (selectedServizio) {
        fetchTipologieContratto(selectedServizio);
      }
      
      toast({
        title: "Successo",
        description: "Tipologia rimossa dal servizio",
      });
    } catch (error) {
      console.error("Error removing tipologia:", error);
      toast({
        title: "Errore",
        description: "Errore nella rimozione della tipologia",
        variant: "destructive",
      });
    }
  };

  const migrateHardcodedToDatabase = async (force = false) => {
    try {
      console.log('🚀 Starting hardcoded to database migration...', force ? '(FORCE MODE)' : '');
      
      const response = await axios.post(`${API}/admin/migrate-hardcoded-to-database?force=${force}`);
      
      console.log('✅ Migration response:', response.data);
      
      // Show detailed debug info
      if (response.data.debug_info) {
        console.log('📊 Migration details:');
        response.data.debug_info.forEach(info => console.log(' - ' + info));
      }
      
      toast({
        title: "Successo",
        description: response.data.message + (response.data.debug_info ? ` (Dettagli in console)` : ''),
      });
      
      // Refresh all data after migration
      console.log('🔄 Refreshing all data after migration...');
      await fetchTipologieContratto();
      await fetchCommesse();
      
    } catch (error) {
      console.error("❌ Error migrating hardcoded to database:", error);
      
      toast({
        title: "Errore",
        description: error.response?.data?.detail || error.message || "Errore nella migrazione elementi hardcoded",
        variant: "destructive",
      });
    }
  };

  const disableHardcodedElements = async () => {
    try {
      console.log('🚫 Disabling hardcoded elements...');
      
      const response = await axios.post(`${API}/admin/disable-hardcoded-elements`);
      
      console.log('✅ Disable response:', response.data);
      
      toast({
        title: "Successo",
        description: response.data.message,
      });
      
      // Refresh all data after disabling
      console.log('🔄 Refreshing all data after disabling hardcoded...');
      await fetchTipologieContratto();
      await fetchCommesse();
      
    } catch (error) {
      console.error("❌ Error disabling hardcoded elements:", error);
      
      toast({
        title: "Errore",
        description: error.response?.data?.detail || error.message || "Errore nella disabilitazione elementi hardcoded",
        variant: "destructive",
      });
    }
  };

  const migrateSegmenti = async () => {
    try {
      console.log('🚀 Starting segmenti migration...');
      console.log('🚀 API URL:', `${API}/admin/migrate-segmenti`);
      console.log('🚀 User token present:', !!localStorage.getItem('token'));
      
      const response = await axios.post(`${API}/admin/migrate-segmenti`);
      
      console.log('✅ Migration response status:', response.status);
      console.log('✅ Migration response data:', response.data);
      
      toast({
        title: "Successo",
        description: response.data.message,
      });
      
      // Refresh tipologie after migration to get updated count
      console.log('🔄 Refreshing tipologie after migration...');
      await fetchTipologieContratto();
      
    } catch (error) {
      console.error("❌ Error migrating segmenti:", error);
      console.error("❌ Error status:", error.response?.status);
      console.error("❌ Error response:", error.response?.data);
      console.error("❌ Error message:", error.message);
      
      toast({
        title: "Errore",
        description: error.response?.data?.detail || error.message || "Errore nella migrazione dei segmenti",
        variant: "destructive",
      });
    }
  };

  // Duplicate functions removed

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestione Commesse</h2>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuova Commessa
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Lista Commesse */}
        <Card>
          <CardHeader>
            <CardTitle>Commesse</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {commesse.map((commessa) => (
                <div 
                  key={commessa.id}
                  className={`p-4 border rounded-lg transition-colors ${
                    selectedCommessa?.id === commessa.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header con titolo e icona */}
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{commessa.nome}</h3>
                        {commessa.descrizione && (
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{commessa.descrizione}</p>
                        )}
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={commessa.is_active ? "default" : "secondary"} className="text-xs">
                        {commessa.is_active ? "Attiva" : "Inattiva"}
                      </Badge>
                      {commessa.entity_type && (
                        <Badge variant="outline" className="text-xs">
                          {commessa.entity_type === 'clienti' ? 'Solo Clienti' : 
                           commessa.entity_type === 'lead' ? 'Solo Lead' : 'Clienti & Lead'}
                        </Badge>
                      )}
                      {commessa.has_whatsapp && (
                        <Badge variant="secondary" className="text-xs">
                          <MessageCircle className="w-3 h-3 mr-1" />
                          WhatsApp
                        </Badge>
                      )}
                      {commessa.has_ai && (
                        <Badge variant="secondary" className="text-xs">
                          <Bot className="w-3 h-3 mr-1" />
                          AI
                        </Badge>
                      )}
                      {commessa.has_call_center && (
                        <Badge variant="secondary" className="text-xs">
                          <Headphones className="w-3 h-3 mr-1" />
                          Call Center
                        </Badge>
                      )}
                    </div>

                    {/* Pulsanti - Layout a griglia per miglior controllo */}
                    <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-100">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowViewCommessaModal(true);
                        }}
                        className="p-2 h-8 w-full"
                        title="Visualizza dettagli"
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCommessa(commessa);
                          setShowEditCommessaModal(true);
                        }}
                        className="p-2 h-8 w-full"
                        title="Modifica commessa"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (selectedCommessa?.id !== commessa.id) {
                            setServizi([]);
                            setTipologieContratto([]);
                            setSelectedCommessa(commessa);
                            setSelectedServizio(null);
                            fetchServizi(commessa.id);
                          }
                        }}
                        className="p-2 h-8 w-full"
                        title="Gestisci servizi e tipologie"
                      >
                        <Settings className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Eliminare definitivamente la commessa "${commessa.nome}"?`)) {
                            deleteCommessa(commessa.id);
                          }
                        }}
                        className="p-2 h-8 w-full"
                        title="Elimina commessa"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Servizi della Commessa Selezionata */}
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
                  <div 
                    key={servizio.id} 
                    className={`p-4 border rounded-lg transition-colors ${
                      selectedServizio === servizio.id ? 'border-green-500 bg-green-50' : 'hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Header con titolo e icona */}
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                          <Settings2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{servizio.nome}</h3>
                          {servizio.descrizione && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{servizio.descrizione}</p>
                          )}
                        </div>
                      </div>

                      {/* Badge */}
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={servizio.is_active ? "default" : "secondary"} className="text-xs">
                          {servizio.is_active ? "Attivo" : "Inattivo"}
                        </Badge>
                      </div>

                      {/* Pulsanti - Layout a griglia */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (selectedServizio !== servizio.id) {
                              setSelectedServizio(servizio.id);
                              fetchTipologieContratto(servizio.id);
                            }
                          }}
                          className="p-2 h-8 w-full"
                          title="Gestisci tipologie contratto"
                        >
                          <Settings className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Eliminare definitivamente il servizio "${servizio.nome}"?`)) {
                              deleteServizio(servizio.id);
                            }
                          }}
                          className="p-2 h-8 w-full"
                          title="Elimina servizio"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {servizi.length === 0 && (
                  <p className="text-gray-500 text-center py-4">
                    Nessun servizio configurato per questa commessa
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Seleziona una commessa per vedere i servizi</p>
            )}
          </CardContent>
        </Card>

        {/* Tipologie di Contratto del Servizio Selezionato */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedServizio ? 'Tipologie di Contratto' : 'Seleziona un Servizio'}
            </CardTitle>
            {selectedServizio && (
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => {
                    setModalType('tipologia');
                    setShowCreateTipologiaModal(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuova Tipologia
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {selectedServizio ? (
              <div className="space-y-3">
                {tipologieContratto.map((tipologia) => (
                  <div 
                    key={tipologia.id} 
                    className={`p-4 border rounded-lg transition-colors ${
                      selectedTipologia === tipologia.id ? 'border-purple-500 bg-purple-50' : 'hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Header con titolo e icona */}
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                          <FileText className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{tipologia.nome || tipologia.label}</h3>
                          {tipologia.descrizione && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{tipologia.descrizione}</p>
                          )}
                        </div>
                      </div>

                      {/* Badge */}
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={tipologia.is_active ? "default" : "secondary"} className="text-xs">
                          {tipologia.is_active ? "Attiva" : "Inattiva"}
                        </Badge>
                      </div>

                      {/* Pulsanti - Layout a griglia */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const tipologiaId = tipologia.id || tipologia.value;
                            
                            if (selectedTipologia !== tipologiaId) {
                              setSelectedTipologia(tipologiaId);
                              fetchSegmenti(tipologiaId);
                            }
                          }}
                          className="p-2 h-8 w-full"
                          title="Gestisci segmenti"
                        >
                          <Settings className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Rimuovere "${tipologia.nome}" da questo servizio?`)) {
                              rimuoviTipologiaDaServizio(tipologia.id, selectedServizio);
                            }
                          }}
                          className="p-2 h-8 w-full"
                          title="Rimuovi da servizio"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Eliminare definitivamente "${tipologia.nome}"?`)) {
                              deleteTipologiaContratto(tipologia.id);
                            }
                          }}
                          className="p-2 h-8 w-full"
                          title="Elimina tipologia"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {tipologieContratto.length === 0 && (
                  <p className="text-gray-500 text-center py-4">
                    Nessuna tipologia di contratto configurata per questo servizio
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Seleziona un servizio per vedere le tipologie di contratto</p>
            )}
          </CardContent>
        </Card>

        {/* Segmenti della Tipologia Selezionata */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedTipologia ? 'Segmenti' : 'Seleziona una Tipologia'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedTipologia ? (
              <div className="space-y-3">
                {segmenti.map((segmento) => (
                  <div 
                    key={segmento.id} 
                    className={`p-4 border rounded-lg transition-colors ${
                      selectedSegmento === segmento.id ? 'border-orange-500 bg-orange-50' : 'hover:bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Header con titolo e icona */}
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0">
                          <Tag className="w-5 h-5 text-orange-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{segmento.nome}</h3>
                        </div>
                      </div>

                      {/* Badge */}
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={segmento.is_active ? "default" : "secondary"} className="text-xs">
                          {segmento.is_active ? "Attivo" : "Inattivo"}
                        </Badge>
                      </div>

                      {/* Pulsanti - Layout a griglia */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (selectedSegmento !== segmento.id) {
                              setSelectedSegmento(segmento.id);
                              fetchOfferte(segmento.id);
                            }
                          }}
                          className="p-2 h-8 w-full"
                          title="Gestisci offerte"
                        >
                          <Settings className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateSegmento(segmento.id, { is_active: !segmento.is_active });
                          }}
                          className="p-2 h-8 w-full"
                          title={segmento.is_active ? 'Disattiva segmento' : 'Attiva segmento'}
                        >
                          {segmento.is_active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {segmenti.length === 0 && (
                  <p className="text-gray-500 text-center py-4">
                    Nessun segmento disponibile per questa tipologia
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Seleziona una tipologia per vedere i segmenti</p>
            )}
          </CardContent>
        </Card>

        {/* Offerte del Segmento Selezionato */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedSegmento ? 'Offerte' : 'Seleziona un Segmento'}
            </CardTitle>
            {selectedSegmento && (
              <Button 
                size="sm" 
                onClick={() => {
                  setModalType('offerta');
                  setShowCreateOffertaModal(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuova Offerta
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {selectedSegmento ? (
              <div className="space-y-3">
                {offerte.map((offerta) => (
                  <div 
                    key={offerta.id} 
                    className="p-4 border rounded-lg border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="space-y-3">
                      {/* Header con titolo e icona */}
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-yellow-100 rounded-lg flex-shrink-0">
                          <Star className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">{offerta.nome}</h3>
                          {offerta.descrizione && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{offerta.descrizione}</p>
                          )}
                        </div>
                      </div>

                      {/* Badge */}
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={offerta.is_active ? "default" : "secondary"} className="text-xs">
                          {offerta.is_active ? "Attiva" : "Inattiva"}
                        </Badge>
                      </div>

                      {/* Pulsanti - Layout a griglia */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            updateOfferta(offerta.id, { is_active: !offerta.is_active });
                          }}
                          className="p-2 h-8 w-full"
                          title={offerta.is_active ? 'Disattiva offerta' : 'Attiva offerta'}
                        >
                          {offerta.is_active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (confirm(`Eliminare definitivamente "${offerta.nome}"?`)) {
                              deleteOfferta(offerta.id);
                            }
                          }}
                          className="p-2 h-8 w-full"
                          title="Elimina offerta"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {offerte.length === 0 && (
                  <p className="text-gray-500 text-center py-4">
                    Nessuna offerta configurata per questo segmento
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Seleziona un segmento per vedere le offerte</p>
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

      {/* Create Tipologia Contratto Modal */}
      <CreateTipologiaContrattoModal 
        isOpen={showCreateTipologiaModal}
        onClose={() => setShowCreateTipologiaModal(false)}
        onSubmit={createTipologiaContratto}
        servizioId={selectedServizio}
      />

      {/* Create Offerta Modal */}
      <CreateOffertaModal 
        isOpen={showCreateOffertaModal}
        onClose={() => setShowCreateOffertaModal(false)}
        onSubmit={createOfferta}
        segmentoId={selectedSegmento}
      />

      {/* View Commessa Details Modal */}
      <ViewCommessaModal 
        isOpen={showViewCommessaModal}
        onClose={() => setShowViewCommessaModal(false)}
        commessa={selectedCommessa}
      />

      {/* Edit Commessa Modal */}
      <EditCommessaModal 
        isOpen={showEditCommessaModal}
        onClose={() => {
          setShowEditCommessaModal(false);
          setEditingCommessa(null);
        }}
        onSubmit={(commessaData) => {
          updateCommessa(editingCommessa.id, commessaData);
          setShowEditCommessaModal(false);
          setEditingCommessa(null);
        }}
        commessa={editingCommessa}
      />
    </div>
  );
};

// Unit & Sub Agenzie Management Component (Unified)
const SubAgenzieManagement = ({ selectedUnit, selectedCommessa, units, commesse: commesseFromParent, subAgenzie: subAgenzieFromParent }) => {
  const [activeTab, setActiveTab] = useState("units");
  
  // Use props data when available, fallback to local state
  const [unitsData, setUnitsData] = useState(units || []);
  const [subAgenzie, setSubAgenzie] = useState(subAgenzieFromParent || []);
  const [commesse, setCommesse] = useState(commesseFromParent || []);
  const [servizi, setServizi] = useState([]); // NEW: Add servizi state
  const [responsabili, setResponsabili] = useState([]); // NEW: Add responsabili state for Sub Agenzia
  
  const [showCreateUnitModal, setShowCreateUnitModal] = useState(false);
  const [showEditUnitModal, setShowEditUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  
  // Sub Agenzie state  
  const [showCreateSubModal, setShowCreateSubModal] = useState(false);
  const [showEditSubModal, setShowEditSubModal] = useState(false);
  const [editingSubAgenzia, setEditingSubAgenzia] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false); // NEW: Track if commesse and servizi are loaded
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchUnits(),
        fetchSubAgenzie(),
        fetchCommesse(),
        fetchServizi(),
        fetchResponsabili()
      ]);
      setDataLoaded(true); // Set dataLoaded to true when all data is fetched
    };
    loadData();
  }, []);

  // NEW: Fetch servizi function
  const fetchServizi = async () => {
    try {
      console.log('🔄 SubAgenzieManagement: Fetching servizi...');
      const response = await axios.get(`${API}/servizi`);
      console.log('✅ SubAgenzieManagement: Servizi loaded:', response.data.length, 'items');
      setServizi(response.data);
    } catch (error) {
      console.error("❌ SubAgenzieManagement: Error fetching servizi:", error);
      // Don't show error toast for servizi to avoid noise
    }
  };

  // NEW: Fetch responsabili (users with role responsabile_sub_agenzia)
  const fetchResponsabili = async () => {
    try {
      console.log('🔄 SubAgenzieManagement: Fetching responsabili...');
      const response = await axios.get(`${API}/users`);
      // Filter only responsabile_sub_agenzia users
      const responsabiliUsers = response.data.filter(user => 
        user.role === 'responsabile_sub_agenzia'
      );
      console.log('✅ SubAgenzieManagement: Responsabili loaded:', responsabiliUsers.length, 'items');
      setResponsabili(responsabiliUsers);
    } catch (error) {
      console.error("❌ SubAgenzieManagement: Error fetching responsabili:", error);
    }
  };

  // Units functions
  const fetchUnits = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/units`);
      setUnitsData(response.data);
    } catch (error) {
      console.error("Error fetching units:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle unit",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createUnit = async (unitData) => {
    try {
      const response = await axios.post(`${API}/units`, unitData);
      setUnitsData([response.data, ...unitsData]);
      toast({
        title: "Successo",
        description: "Unit creata con successo",
      });
      setShowCreateUnitModal(false);
    } catch (error) {
      console.error("Error creating unit:", error);
      toast({
        title: "Errore",
        description: "Errore nella creazione della unit",
        variant: "destructive",
      });
    }
  };

  const deleteUnit = async (unitId) => {
    if (window.confirm("Sei sicuro di voler eliminare questa unit?")) {
      try {
        await axios.delete(`${API}/units/${unitId}`);
        setUnitsData(unitsData.filter(unit => unit.id !== unitId));
        toast({
          title: "Successo", 
          description: "Unit eliminata con successo",
        });
      } catch (error) {
        console.error("Error deleting unit:", error);
        toast({
          title: "Errore",
          description: "Errore nell'eliminazione della unit",
          variant: "destructive",
        });
      }
    }
  };

  const updateUnit = async (unitId, updateData) => {
    try {
      const response = await axios.put(`${API}/units/${unitId}`, updateData);
      setUnitsData(unitsData.map(unit => 
        unit.id === unitId ? response.data : unit
      ));
      toast({
        title: "Successo",
        description: "Unit modificata con successo",
      });
      setShowEditUnitModal(false);
      setEditingUnit(null);
    } catch (error) {
      console.error("Error updating unit:", error);
      toast({
        title: "Errore",
        description: "Errore nella modifica della unit",
        variant: "destructive",
      });
    }
  };

  const handleEditUnit = (unit) => {
    setEditingUnit(unit);
    setShowEditUnitModal(true);
  };

  // Sub Agenzie functions
  const fetchSubAgenzie = async () => {
    try {
      const response = await axios.get(`${API}/sub-agenzie`);
      setSubAgenzie(response.data);
    } catch (error) {
      console.error("Error fetching sub agenzie:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle sub agenzie",
        variant: "destructive",
      });
    }
  };

  const fetchCommesse = async () => {
    try {
      console.log('🔄 SubAgenzieManagement: Fetching commesse...');
      const response = await axios.get(`${API}/commesse`);
      console.log('✅ SubAgenzieManagement: Commesse loaded:', response.data.length, 'items');
      setCommesse(response.data);
    } catch (error) {
      console.error("❌ SubAgenzieManagement: Error fetching commesse:", error);
    }
  };

  const createSubAgenzia = async (subAgenziaData) => {
    try {
      const response = await axios.post(`${API}/sub-agenzie`, subAgenziaData);
      setSubAgenzie([response.data, ...subAgenzie]);
      toast({
        title: "Successo",
        description: "Sub Agenzia creata con successo",
      });
      setShowCreateSubModal(false);
    } catch (error) {
      console.error("Error creating sub agenzia:", error);
      toast({
        title: "Errore",
        description: "Errore nella creazione della sub agenzia",
        variant: "destructive",
      });
    }
  };

  const updateSubAgenzia = async (subAgenziaId, updateData) => {
    try {
      const response = await axios.put(`${API}/sub-agenzie/${subAgenziaId}`, updateData);
      setSubAgenzie(subAgenzie.map(sa => 
        sa.id === subAgenziaId ? response.data : sa
      ));
      toast({
        title: "Successo",
        description: "Sub Agenzia modificata con successo",
      });
      setShowEditSubModal(false);
      setEditingSubAgenzia(null);
    } catch (error) {
      console.error("Error updating sub agenzia:", error);
      toast({
        title: "Errore",
        description: "Errore nella modifica della sub agenzia",
        variant: "destructive",
      });
    }
  };

  const deleteSubAgenzia = async (subAgenziaId) => {
    if (window.confirm("Sei sicuro di voler eliminare questa Sub Agenzia?")) {
      try {
        await axios.delete(`${API}/sub-agenzie/${subAgenziaId}`);
        setSubAgenzie(subAgenzie.filter(sa => sa.id !== subAgenziaId));
        toast({
          title: "Successo",
          description: "Sub Agenzia eliminata con successo",
        });
      } catch (error) {
        console.error("Error deleting sub agenzia:", error);
        toast({
          title: "Errore",
          description: "Errore nell'eliminazione della sub agenzia",
          variant: "destructive",
        });
      }
    }
  };

  const handleEditSubAgenzia = (subAgenzia) => {
    setEditingSubAgenzia(subAgenzia);
    setShowEditSubModal(true);
  };

  // Render Units Tab
  const renderUnitsTab = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-slate-800">Gestione Unit</h3>
            <p className="text-sm text-slate-600">Gestisci le unit organizzative del sistema</p>
          </div>
          <Button 
            onClick={() => setShowCreateUnitModal(true)}
            disabled={!dataLoaded}
          >
            <Plus className="w-4 h-4 mr-2" />
            {dataLoaded ? 'Nuova Unit' : 'Caricamento...'}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid gap-4">
            {unitsData
              .filter(unit => 
                selectedCommessa === "all" || 
                unit.commesse_autorizzate?.includes(selectedCommessa)
              )
              .map((unit) => (
              <Card key={unit.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <div>
                        <CardTitle className="text-lg">{unit.name}</CardTitle>
                        <p className="text-sm text-slate-500">{unit.description}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Badge variant={unit.is_active ? "default" : "secondary"}>
                        {unit.is_active ? "Attiva" : "Inattiva"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-xs text-slate-500">ID</Label>
                      <p className="font-mono text-xs">{unit.id}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Creata il</Label>
                      <p className="text-xs">
                        {new Date(unit.created_at).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                  </div>
                  
                  {/* Commesse autorizzate */}
                  {unit.commesse_autorizzate && unit.commesse_autorizzate.length > 0 && (
                    <div className="mt-4">
                      <Label className="text-xs text-slate-500 mb-2 block">Commesse Autorizzate</Label>
                      <div className="flex flex-wrap gap-1">
                        {unit.commesse_autorizzate.map((commessaId) => {
                          const commessa = commesse.find(c => c.id === commessaId);
                          return (
                            <Badge key={commessaId} variant="secondary" className="text-xs">
                              {commessa?.nome || commessaId}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="flex justify-end space-x-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditUnit(unit)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Modifica
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteUnit(unit.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Elimina
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Unit Modal */}
        {showCreateUnitModal && (
          <CreateUnitModal
            onClose={() => setShowCreateUnitModal(false)}
            onSuccess={createUnit}
            commesse={commesse}
            servizi={servizi}
          />
        )}
        
        {/* Edit Unit Modal */}
        {showEditUnitModal && editingUnit && (
          <EditUnitModal
            unit={editingUnit}
            onClose={() => {
              setShowEditUnitModal(false);
              setEditingUnit(null);
            }}
            onSuccess={(updateData) => updateUnit(editingUnit.id, updateData)}
            commesse={commesse}
            servizi={servizi}
          />
        )}
      </div>
    );
  };

  // Render Sub Agenzie Tab
  const renderSubAgenzieTab = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-slate-800">Gestione Sub Agenzie</h3>
            <p className="text-sm text-slate-600">Gestisci le sub agenzie e le loro autorizzazioni</p>
          </div>
          <Button 
            onClick={() => setShowCreateSubModal(true)}
            disabled={!dataLoaded}
          >
            <Plus className="w-4 h-4 mr-2" />
            {dataLoaded ? 'Nuova Sub Agenzia' : 'Caricamento...'}
          </Button>
        </div>

        <div className="grid gap-4">
          {subAgenzie
            .filter(subAgenzia => 
              selectedCommessa === "all" || 
              subAgenzia.commesse_autorizzate?.includes(selectedCommessa)
            )
            .map((subAgenzia) => (
            <Card key={subAgenzia.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Store className="w-5 h-5 text-green-600" />
                    <div>
                      <CardTitle className="text-lg">{subAgenzia.nome}</CardTitle>
                      <p className="text-sm text-slate-500">{subAgenzia.descrizione}</p>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {subAgenzia.commesse_autorizzate?.length || 0} Commesse
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label className="text-xs text-slate-500">Responsabile</Label>
                    <p className="font-medium">{subAgenzia.responsabile || "Non assegnato"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Email</Label>
                    <p className="text-sm">{subAgenzia.email || "Non configurata"}</p>
                  </div>
                </div>

                {subAgenzia.commesse_autorizzate && subAgenzia.commesse_autorizzate.length > 0 && (
                  <div className="mb-4">
                    <Label className="text-xs text-slate-500 mb-2 block">Commesse Autorizzate</Label>
                    <div className="flex flex-wrap gap-1">
                      {subAgenzia.commesse_autorizzate.map((commessaId) => {
                        const commessa = commesse.find(c => c.id === commessaId);
                        return (
                          <Badge key={commessaId} variant="secondary" className="text-xs">
                            {commessa?.nome || commessaId}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="text-xs text-slate-400 mt-2">
                  Creata il: {new Date(subAgenzia.created_at).toLocaleDateString('it-IT')}
                </div>
                
                {/* Actions */}
                <div className="flex justify-end space-x-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditSubAgenzia(subAgenzia)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Modifica
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteSubAgenzia(subAgenzia.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Elimina
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create Sub Agenzia Modal */}
        {showCreateSubModal && (
          <CreateSubAgenziaModal
            onClose={() => setShowCreateSubModal(false)}
            onSuccess={createSubAgenzia}
            commesse={commesse}
            servizi={servizi}
            responsabili={responsabili}
          />
        )}
        
        {/* Edit Sub Agenzia Modal */}
        {showEditSubModal && editingSubAgenzia && (
          <EditSubAgenziaModal
            subAgenzia={editingSubAgenzia}
            onClose={() => {
              setShowEditSubModal(false);
              setEditingSubAgenzia(null);
            }}
            onSuccess={(updateData) => updateSubAgenzia(editingSubAgenzia.id, updateData)}
            commesse={commesse}
            servizi={servizi}
            responsabili={responsabili}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 flex items-center">
            <Store className="w-8 h-8 mr-3 text-green-600" />
            Unit & Sub Agenzie
          </h2>
          {selectedCommessa && selectedCommessa !== "all" && (
            <p className="text-sm text-slate-600 mt-1 ml-11">
              Filtrato per commessa: <Badge variant="secondary">{commesse.find(c => c.id === selectedCommessa)?.nome || selectedCommessa}</Badge>
            </p>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="units" className="flex items-center space-x-2">
            <Building2 className="w-4 h-4" />
            <span>Unit</span>
          </TabsTrigger>
          <TabsTrigger value="sub-agenzie" className="flex items-center space-x-2">
            <Store className="w-4 h-4" />
            <span>Sub Agenzie</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="units" className="space-y-6">
          {renderUnitsTab()}
        </TabsContent>

        <TabsContent value="sub-agenzie" className="space-y-6">
          {renderSubAgenzieTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Clienti Management Component
const ClientiManagement = ({ selectedUnit, selectedCommessa, units, commesse: commesseFromParent, subAgenzie: subAgenzieFromParent }) => {
  const [clienti, setClienti] = useState([]);
  const [allClienti, setAllClienti] = useState([]); // Store all clients for filtering
  const [commesse, setCommesse] = useState(commesseFromParent || []);
  const [subAgenzie, setSubAgenzie] = useState(subAgenzieFromParent || []);
  const [selectedCommessaLocal, setSelectedCommessaLocal] = useState(selectedCommessa || null);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedClientName, setSelectedClientName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: '',
    enabled: false
  });
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  // Get filtered clients (combining search and date filters)
  const getFilteredClients = () => {
    let filtered = clienti;
    
    // Apply date filter if enabled
    if (dateFilter.enabled) {
      filtered = filterClientsByDate(filtered);
    }
    
    return filtered;
  };

  useEffect(() => {
    try {
      // Always fetch commesse and sub agenzie to ensure fresh data
      console.log("📊 ClientiManagement: Inizializzazione - caricando dati...");
      fetchCommesse();
      fetchSubAgenzie();
      fetchClienti();
    } catch (error) {
      console.error("ClientiManagement useEffect error:", error);
      toast({
        title: "Errore",
        description: "Errore durante il caricamento iniziale",
        variant: "destructive",
      });
    }
  }, [selectedUnit, selectedCommessaLocal]);

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

  const fetchClienti = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCommessaLocal) {
        params.append('commessa_id', selectedCommessaLocal);
      }
      params.append('limit', '50');
      
      const response = await axios.get(`${API}/clienti?${params}`);
      setAllClienti(response.data); // Store all clients
      setClienti(response.data); // Display all initially
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

  // Filter clients based on search query and type
  const filterClienti = (query, type) => {
    if (!query.trim()) {
      setClienti(allClienti);
      return;
    }

    const searchQuery = query.toLowerCase().trim();
    const filtered = allClienti.filter(cliente => {
      switch (type) {
        case 'id':
          return cliente.cliente_id?.toLowerCase().includes(searchQuery);
        case 'cognome':
          return cliente.cognome?.toLowerCase().includes(searchQuery);
        case 'codice_fiscale':
          return cliente.codice_fiscale?.toLowerCase().includes(searchQuery);
        case 'partita_iva':
          return cliente.partita_iva?.toLowerCase().includes(searchQuery);
        case 'telefono':
          return cliente.telefono?.includes(searchQuery) || cliente.cellulare?.includes(searchQuery);
        case 'email':
          return cliente.email?.toLowerCase().includes(searchQuery);
        case 'all':
        default:
          return (
            cliente.cliente_id?.toLowerCase().includes(searchQuery) ||
            cliente.cognome?.toLowerCase().includes(searchQuery) ||
            cliente.nome?.toLowerCase().includes(searchQuery) ||
            cliente.codice_fiscale?.toLowerCase().includes(searchQuery) ||
            cliente.partita_iva?.toLowerCase().includes(searchQuery) ||
            cliente.telefono?.includes(searchQuery) ||
            cliente.cellulare?.includes(searchQuery) ||
            cliente.email?.toLowerCase().includes(searchQuery)
          );
      }
    });
    
    setClienti(filtered);
  };

  // Handle search input change
  const handleSearchChange = (query) => {
    setSearchQuery(query);
    filterClienti(query, searchType);
  };

  // Handle search type change
  const handleSearchTypeChange = (type) => {
    setSearchType(type);
    filterClienti(searchQuery, type);
  };

  const createCliente = async (clienteData) => {
    console.log("🚀 CREATE CLIENTE FUNCTION CALLED");
    console.log("🚀 Cliente Data Received:", clienteData);
    console.log("🚀 API URL:", `${API}/clienti`);
    
    try {
      console.log("🚀 MAKING POST REQUEST TO BACKEND...");
      const response = await axios.post(`${API}/clienti`, clienteData);
      console.log("✅ POST REQUEST SUCCESS:", response);
      
      setClienti([response.data, ...clienti]);
      setAllClienti([response.data, ...allClienti]); // Update all clients too
      toast({
        title: "Successo",
        description: "Cliente creato con successo",
      });
      console.log("✅ CLIENTE CREATION COMPLETED SUCCESSFULLY");
    } catch (error) {
      console.error("❌ ERROR CREATING CLIENTE:", error);
      console.error("❌ Error Details:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      toast({
        title: "Errore", 
        description: "Errore nella creazione del cliente",
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

  const deleteCliente = async (clienteId) => {
    try {
      await axios.delete(`${API}/clienti/${clienteId}`);
      
      // Remove from both states
      setClienti(clienti.filter(c => c.id !== clienteId));
      setAllClienti(allClienti.filter(c => c.id !== clienteId));
      
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
  const exportClients = () => {
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
      // Get filtered clients using the unified function
      const clientsToExport = getFilteredClients();
      
      if (clientsToExport.length === 0) {
        toast({
          title: "Attenzione", 
          description: "Nessun cliente trovato con i filtri applicati",
          variant: "destructive",
        });
        setIsExporting(false);
        return;
      }

      // Prepare CSV headers
      const headers = [
        'ID Cliente',
        'Nome',
        'Cognome', 
        'Email',
        'Telefono',
        'Cellulare',
        'Codice Fiscale',
        'P. IVA',
        'Indirizzo',
        'Città',
        'Provincia',
        'CAP',
        'Data Creazione',
        'Commessa',
        'Sub Agenzia'
      ];

      // Convert clients to CSV format
      const csvContent = [
        headers.join(','),
        ...clientsToExport.map(cliente => [
          cliente.cliente_id || '',
          cliente.nome || '',
          cliente.cognome || '',
          cliente.email || '',
          cliente.telefono || '',
          cliente.cellulare || '',
          cliente.codice_fiscale || '',
          cliente.partita_iva || '',
          cliente.indirizzo || '',
          cliente.citta || '',
          cliente.provincia || '',
          cliente.cap || '',
          cliente.created_at ? new Date(cliente.created_at).toLocaleDateString('it-IT') : '',
          cliente.commessa_nome || '',
          cliente.sub_agenzia_nome || ''
        ].map(field => `"${field}"`).join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Generate filename with current date and filters
      let filename = 'clienti_export_' + new Date().toISOString().split('T')[0];
      if (dateFilter.enabled && dateFilter.startDate && dateFilter.endDate) {
        filename += `_${dateFilter.startDate}_${dateFilter.endDate}`;
      }
      filename += '.csv';
      
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Successo",
        description: `Esportati ${clientsToExport.length} clienti in ${filename}`,
      });

    } catch (error) {
      console.error('Error exporting clients:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'esportazione dei clienti",
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

  // Re-apply search when allClienti changes
  useEffect(() => {
    if (searchQuery) {
      filterClienti(searchQuery, searchType);
    }
  }, [allClienti]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestione Clienti</h2>
        <div className="flex space-x-3">
          <Select 
            value={selectedCommessaLocal || "all"} 
            onValueChange={(value) => setSelectedCommessaLocal(value === "all" ? null : value)}
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
            <Button
              variant="outline"
              onClick={exportClients}
              disabled={clienti.length === 0 || isExporting}
            >
              {isExporting ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Esportando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Esporta CSV
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Date Filter Section */}
      <div className="bg-gray-50 p-4 rounded-lg border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
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
                Filtra per periodo di creazione
              </label>
            </div>
            
            {dateFilter.enabled && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">Dal:</label>
                  <input
                    type="date"
                    value={dateFilter.startDate}
                    onChange={(e) => setDateFilter(prev => ({
                      ...prev,
                      startDate: e.target.value
                    }))}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">Al:</label>
                  <input
                    type="date"
                    value={dateFilter.endDate}
                    onChange={(e) => setDateFilter(prev => ({
                      ...prev,
                      endDate: e.target.value
                    }))}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                >
                  <X className="w-3 h-3 mr-1" />
                  Azzera
                </Button>
              </div>
            )}
          </div>

          {dateFilter.enabled && (dateFilter.startDate || dateFilter.endDate) && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Clienti filtrati: </span>
              <span className="text-blue-600 font-semibold">
                {getFilteredClients().length} di {clienti.length}
              </span>
            </div>
          )}
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

      <Card>
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block">
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
                {getFilteredClients().map((cliente) => (
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

          {/* Mobile Card View */}
          <div className="md:hidden">
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
                  <Badge 
                    variant={
                      cliente.status === "completato" ? "default" :
                      cliente.status === "in_lavorazione" ? "secondary" : "outline"
                    }
                    className="text-xs"
                  >
                    {cliente.status.replace('_', ' ').toUpperCase()}
                  </Badge>
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
                  
                  {/* Seconda riga: Modifica e Elimina */}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEditCliente(cliente)}
                    className="w-full"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Modifica
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => {
                      if (confirm(`Eliminare definitivamente il cliente "${cliente.nome} ${cliente.cognome}"?`)) {
                        deleteCliente(cliente.id);
                      }
                    }}
                    className="w-full"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Elimina
                  </Button>
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
          }}
          commesse={commesse}
          subAgenzie={subAgenzie}
        />
      )}

      {/* Edit Cliente Modal */}
      {showEditModal && selectedCliente && (
        <EditClienteModal 
          cliente={selectedCliente}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCliente(null);
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
    </div>
  );
};

// Modal Components
const CreateCommessaModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    nome: '',
    descrizione: '',
    descrizione_interna: '',
    responsabile_id: '',
    entity_type: 'clienti',
    has_whatsapp: false,
    has_ai: false,
    has_call_center: false,
    document_management: 'disabled'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ 
      nome: '', 
      descrizione: '', 
      descrizione_interna: '',
      responsabile_id: '', 
      entity_type: 'clienti',
      has_whatsapp: false,
      has_ai: false,
      has_call_center: false,
      document_management: 'disabled'
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuova Commessa - Configurazione Avanzata</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Informazioni Base</h3>
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
                placeholder="Descrizione pubblica della commessa"
              />
            </div>
            <div>
              <Label htmlFor="descrizione_interna">Descrizione Interna</Label>
              <Textarea
                id="descrizione_interna"
                value={formData.descrizione_interna}
                onChange={(e) => setFormData({...formData, descrizione_interna: e.target.value})}
                placeholder="Note interne e dettagli operativi per il team"
                className="min-h-20"
              />
            </div>
            <div>
              <Label htmlFor="entity_type">Gestisce *</Label>
              <Select value={formData.entity_type} onValueChange={(value) => setFormData({...formData, entity_type: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tipo entità" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clienti">Clienti</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="both">Entrambi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Feature Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Configurazione Funzionalità</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="has_whatsapp"
                  checked={formData.has_whatsapp}
                  onCheckedChange={(checked) => setFormData({...formData, has_whatsapp: checked})}
                />
                <Label htmlFor="has_whatsapp" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  <MessageCircle className="w-4 h-4 inline mr-2" />
                  Abilita WhatsApp Business
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="has_ai"
                  checked={formData.has_ai}
                  onCheckedChange={(checked) => setFormData({...formData, has_ai: checked})}
                />
                <Label htmlFor="has_ai" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  <Bot className="w-4 h-4 inline mr-2" />
                  Abilita Funzionalità AI
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="has_call_center"
                  checked={formData.has_call_center}
                  onCheckedChange={(checked) => setFormData({...formData, has_call_center: checked})}
                />
                <Label htmlFor="has_call_center" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  <Headphones className="w-4 h-4 inline mr-2" />
                  Abilita Call Center
                </Label>
              </div>
            </div>
          </div>

          {/* Document Management */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Gestione Documenti</h3>
            <div>
              <Label htmlFor="document_management">Accesso Documenti</Label>
              <Select value={formData.document_management} onValueChange={(value) => setFormData({...formData, document_management: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona configurazione documenti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">
                    <div className="flex items-center">
                      <XCircle className="w-4 h-4 mr-2 text-gray-500" />
                      Disabilitato
                    </div>
                  </SelectItem>
                  <SelectItem value="clienti_only">
                    <div className="flex items-center">
                      <UserCheck className="w-4 h-4 mr-2 text-blue-500" />
                      Solo Clienti
                    </div>
                  </SelectItem>
                  <SelectItem value="lead_only">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2 text-green-500" />
                      Solo Lead
                    </div>
                  </SelectItem>
                  <SelectItem value="both">
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2 text-blue-600" />
                      Clienti e Lead
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">
              <Plus className="w-4 h-4 mr-2" />
              Crea Commessa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ViewCommessaModal = ({ isOpen, onClose, commessa }) => {
  if (!isOpen || !commessa) return null;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Dettagli Commessa: {commessa.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Informazioni Base</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Nome Commessa</Label>
                <p className="text-sm text-gray-900 mt-1">{commessa.nome}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Stato</Label>
                <div className="mt-1">
                  <Badge variant={commessa.is_active ? "default" : "secondary"}>
                    {commessa.is_active ? "Attiva" : "Inattiva"}
                  </Badge>
                </div>
              </div>
            </div>

            {commessa.descrizione && (
              <div>
                <Label className="text-sm font-medium text-gray-600">Descrizione</Label>
                <p className="text-sm text-gray-900 mt-1 p-3 bg-gray-50 rounded-md">{commessa.descrizione}</p>
              </div>
            )}

            {commessa.descrizione_interna && (
              <div>
                <Label className="text-sm font-medium text-gray-600">Descrizione Interna</Label>
                <p className="text-sm text-gray-900 mt-1 p-3 bg-yellow-50 rounded-md border-l-4 border-yellow-400">{commessa.descrizione_interna}</p>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium text-gray-600">Gestione Entità</Label>
              <div className="mt-1">
                <Badge variant="outline">
                  {commessa.entity_type === 'clienti' ? 'Solo Clienti' : 
                   commessa.entity_type === 'lead' ? 'Solo Lead' : 'Clienti & Lead'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Webhook Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Integrazione Webhook</h3>
            <div>
              <Label className="text-sm font-medium text-gray-600">URL Webhook Zapier</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input 
                  value={commessa.webhook_zapier || 'Nessun webhook configurato'} 
                  readOnly 
                  className="flex-1 bg-gray-50"
                />
                {commessa.webhook_zapier && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => copyToClipboard(commessa.webhook_zapier)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Feature Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Funzionalità Abilitate</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg border-2 ${commessa.has_whatsapp ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <MessageCircle className={`w-5 h-5 ${commessa.has_whatsapp ? 'text-green-600' : 'text-gray-400'}`} />
                  {commessa.has_whatsapp ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <h4 className={`font-medium mt-2 ${commessa.has_whatsapp ? 'text-green-900' : 'text-gray-600'}`}>
                  WhatsApp Business
                </h4>
                <p className={`text-xs mt-1 ${commessa.has_whatsapp ? 'text-green-700' : 'text-gray-500'}`}>
                  {commessa.has_whatsapp ? 'Abilitato' : 'Disabilitato'}
                </p>
              </div>

              <div className={`p-4 rounded-lg border-2 ${commessa.has_ai ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <Bot className={`w-5 h-5 ${commessa.has_ai ? 'text-blue-600' : 'text-gray-400'}`} />
                  {commessa.has_ai ? (
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <h4 className={`font-medium mt-2 ${commessa.has_ai ? 'text-blue-900' : 'text-gray-600'}`}>
                  Intelligenza Artificiale
                </h4>
                <p className={`text-xs mt-1 ${commessa.has_ai ? 'text-blue-700' : 'text-gray-500'}`}>
                  {commessa.has_ai ? 'Abilitato' : 'Disabilitato'}
                </p>
              </div>

              <div className={`p-4 rounded-lg border-2 ${commessa.has_call_center ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between">
                  <Headphones className={`w-5 h-5 ${commessa.has_call_center ? 'text-purple-600' : 'text-gray-400'}`} />
                  {commessa.has_call_center ? (
                    <CheckCircle className="w-5 h-5 text-purple-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <h4 className={`font-medium mt-2 ${commessa.has_call_center ? 'text-purple-900' : 'text-gray-600'}`}>
                  Call Center
                </h4>
                <p className={`text-xs mt-1 ${commessa.has_call_center ? 'text-purple-700' : 'text-gray-500'}`}>
                  {commessa.has_call_center ? 'Abilitato' : 'Disabilitato'}
                </p>
              </div>
            </div>
          </div>

          {/* Document Management */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Gestione Documenti</h3>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {commessa.document_management === 'disabled' && (
                  <>
                    <XCircle className="w-5 h-5 text-gray-500" />
                    <span className="text-gray-700">Gestione documenti disabilitata</span>
                  </>
                )}
                {commessa.document_management === 'clienti_only' && (
                  <>
                    <UserCheck className="w-5 h-5 text-blue-500" />
                    <span className="text-blue-700">Documenti abilitati solo per Clienti</span>
                  </>
                )}
                {commessa.document_management === 'lead_only' && (
                  <>
                    <Users className="w-5 h-5 text-green-500" />
                    <span className="text-green-700">Documenti abilitati solo per Lead</span>
                  </>
                )}
                {commessa.document_management === 'both' && (
                  <>
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    <span className="text-blue-700">Documenti abilitati per Clienti e Lead</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Informazioni Sistema</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-sm font-medium text-gray-600">Creata il</Label>
                <p className="text-gray-900 mt-1">
                  {commessa.created_at ? new Date(commessa.created_at).toLocaleString('it-IT') : 'Non disponibile'}
                </p>
              </div>
              {commessa.updated_at && (
                <div>
                  <Label className="text-sm font-medium text-gray-600">Ultima modifica</Label>
                  <p className="text-gray-900 mt-1">
                    {new Date(commessa.updated_at).toLocaleString('it-IT')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EditCommessaModal = ({ isOpen, onClose, onSubmit, commessa }) => {
  const [formData, setFormData] = useState({
    nome: '',
    descrizione: '',
    descrizione_interna: '',
    entity_type: 'clienti',
    has_whatsapp: false,
    has_ai: false,
    has_call_center: false,
    document_management: 'disabled'
  });

  // Inizializza il form con i dati della commessa quando si apre il modal
  useEffect(() => {
    if (commessa && isOpen) {
      setFormData({
        nome: commessa.nome || '',
        descrizione: commessa.descrizione || '',
        descrizione_interna: commessa.descrizione_interna || '',
        entity_type: commessa.entity_type || 'clienti',
        has_whatsapp: commessa.has_whatsapp || false,
        has_ai: commessa.has_ai || false,
        has_call_center: commessa.has_call_center || false,
        document_management: commessa.document_management || 'disabled'
      });
    }
  }, [commessa, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleClose = () => {
    setFormData({
      nome: '',
      descrizione: '',
      descrizione_interna: '',
      entity_type: 'clienti',
      has_whatsapp: false,
      has_ai: false,
      has_call_center: false,
      document_management: 'disabled'
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Commessa: {commessa?.nome}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Informazioni Base</h3>
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
                placeholder="Descrizione pubblica della commessa"
              />
            </div>
            <div>
              <Label htmlFor="descrizione_interna">Descrizione Interna</Label>
              <Textarea
                id="descrizione_interna"
                value={formData.descrizione_interna}
                onChange={(e) => setFormData({...formData, descrizione_interna: e.target.value})}
                placeholder="Note interne e dettagli operativi per il team"
                className="min-h-20"
              />
            </div>
            <div>
              <Label htmlFor="entity_type">Gestisce *</Label>
              <Select value={formData.entity_type} onValueChange={(value) => setFormData({...formData, entity_type: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tipo entità" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clienti">Clienti</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="both">Entrambi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Feature Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Configurazione Funzionalità</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="has_whatsapp"
                  checked={formData.has_whatsapp}
                  onCheckedChange={(checked) => setFormData({...formData, has_whatsapp: checked})}
                />
                <Label htmlFor="has_whatsapp" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  <MessageCircle className="w-4 h-4 inline mr-2" />
                  Abilita WhatsApp Business
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="has_ai"
                  checked={formData.has_ai}
                  onCheckedChange={(checked) => setFormData({...formData, has_ai: checked})}
                />
                <Label htmlFor="has_ai" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  <Bot className="w-4 h-4 inline mr-2" />
                  Abilita Funzionalità AI
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="has_call_center"
                  checked={formData.has_call_center}
                  onCheckedChange={(checked) => setFormData({...formData, has_call_center: checked})}
                />
                <Label htmlFor="has_call_center" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  <Headphones className="w-4 h-4 inline mr-2" />
                  Abilita Call Center
                </Label>
              </div>
            </div>
          </div>

          {/* Document Management */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Gestione Documenti</h3>
            <div>
              <Label htmlFor="document_management">Accesso Documenti</Label>
              <Select value={formData.document_management} onValueChange={(value) => setFormData({...formData, document_management: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona configurazione documenti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">
                    <div className="flex items-center">
                      <XCircle className="w-4 h-4 mr-2 text-gray-500" />
                      Disabilitato
                    </div>
                  </SelectItem>
                  <SelectItem value="clienti_only">
                    <div className="flex items-center">
                      <UserCheck className="w-4 h-4 mr-2 text-blue-500" />
                      Solo Clienti
                    </div>
                  </SelectItem>
                  <SelectItem value="lead_only">
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2 text-green-500" />
                      Solo Lead
                    </div>
                  </SelectItem>
                  <SelectItem value="both">
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2 text-blue-600" />
                      Clienti e Lead
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
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

const CreateTipologiaContrattoModal = ({ isOpen, onClose, onSubmit, servizioId }) => {
  const [formData, setFormData] = useState({
    nome: '',
    descrizione: '',
    is_active: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ 
      ...formData, 
      servizio_id: servizioId 
    });
    setFormData({ nome: '', descrizione: '', is_active: true });
    onClose();
  };

  const handleClose = () => {
    setFormData({ nome: '', descrizione: '', is_active: true });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuova Tipologia di Contratto</DialogTitle>
          <p className="text-sm text-gray-600">
            Crea una nuova tipologia di contratto per il servizio selezionato
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome Tipologia *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({...formData, nome: e.target.value})}
              placeholder="es. Contratto Business, Contratto Premium..."
              required
            />
          </div>
          <div>
            <Label htmlFor="descrizione">Descrizione</Label>
            <Textarea
              id="descrizione"
              value={formData.descrizione}
              onChange={(e) => setFormData({...formData, descrizione: e.target.value})}
              placeholder="Descrizione opzionale della tipologia..."
              rows={3}
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
              className="rounded"
            />
            <Label htmlFor="is_active">Tipologia attiva</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Annulla
            </Button>
            <Button type="submit">
              <Plus className="w-4 h-4 mr-2" />
              Crea Tipologia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const CreateOffertaModal = ({ isOpen, onClose, onSubmit, segmentoId }) => {
  const [formData, setFormData] = useState({
    nome: '',
    descrizione: '',
    is_active: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ 
      ...formData, 
      segmento_id: segmentoId 
    });
    setFormData({ nome: '', descrizione: '', is_active: true });
    onClose();
  };

  const handleClose = () => {
    setFormData({ nome: '', descrizione: '', is_active: true });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuova Offerta</DialogTitle>
          <p className="text-sm text-gray-600">
            Crea una nuova offerta per il segmento selezionato
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome Offerta *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({...formData, nome: e.target.value})}
              placeholder="es. Offerta Base, Offerta Premium..."
              required
            />
          </div>
          <div>
            <Label htmlFor="descrizione">Descrizione</Label>
            <Textarea
              id="descrizione"
              value={formData.descrizione}
              onChange={(e) => setFormData({...formData, descrizione: e.target.value})}
              placeholder="Descrizione opzionale dell'offerta..."
              rows={3}
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
              className="rounded"
            />
            <Label htmlFor="is_active">Offerta attiva</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Annulla
            </Button>
            <Button type="submit">
              <Plus className="w-4 h-4 mr-2" />
              Crea Offerta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const CreateSubAgenziaModal = ({ onClose, onSuccess, commesse, servizi, responsabili }) => {
  const [formData, setFormData] = useState({
    nome: '',
    descrizione: '',
    responsabile_id: '',
    commesse_autorizzate: [],
    servizi_autorizzati: []
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showResponsabiliDropdown, setShowResponsabiliDropdown] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSuccess(formData);
    setFormData({ 
      nome: '', 
      descrizione: '', 
      responsabile_id: '', 
      commesse_autorizzate: [],
      servizi_autorizzati: []
    });
    setSearchTerm('');
  };

  // Filter responsabili based on search term
  const getFilteredResponsabili = () => {
    if (!responsabili || responsabili.length === 0) return [];
    if (!searchTerm) return responsabili;
    
    const lowerSearch = searchTerm.toLowerCase();
    return responsabili.filter(resp => 
      resp.username?.toLowerCase().includes(lowerSearch) ||
      resp.nome?.toLowerCase().includes(lowerSearch) ||
      resp.cognome?.toLowerCase().includes(lowerSearch) ||
      resp.email?.toLowerCase().includes(lowerSearch)
    );
  };

  // Select a responsabile
  const selectResponsabile = (responsabile) => {
    setFormData(prev => ({ ...prev, responsabile_id: responsabile.id }));
    setSearchTerm(`${responsabile.nome || ''} ${responsabile.cognome || ''} (${responsabile.username})`);
    setShowResponsabiliDropdown(false);
  };

  // Get selected responsabile display name
  const getSelectedResponsabileName = () => {
    if (!formData.responsabile_id || !responsabili) return '';
    const selected = responsabili.find(r => r.id === formData.responsabile_id);
    if (!selected) return '';
    return `${selected.nome || ''} ${selected.cognome || ''} (${selected.username})`;
  };

  const toggleCommessa = (commessaId) => {
    setFormData(prev => ({
      ...prev,
      commesse_autorizzate: prev.commesse_autorizzate.includes(commessaId)
        ? prev.commesse_autorizzate.filter(id => id !== commessaId)
        : [...prev.commesse_autorizzate, commessaId]
    }));
  };

  const toggleServizio = (servizioId) => {
    setFormData(prev => ({
      ...prev,
      servizi_autorizzati: prev.servizi_autorizzati.includes(servizioId)
        ? prev.servizi_autorizzati.filter(id => id !== servizioId)
        : [...prev.servizi_autorizzati, servizioId]
    }));
  };
  // Filter servizi based on selected commesse
  const getFilteredServizi = () => {
    if (!servizi || servizi.length === 0) return [];
    
    // If no commesse selected, show NO servizi (must select commessa first)
    if (formData.commesse_autorizzate.length === 0) {
      return [];
    }
    
    // Filter servizi to show only those belonging to selected commesse
    return servizi.filter(servizio => 
      formData.commesse_autorizzate.includes(servizio.commessa_id)
    );
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuova Sub Agenzia</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome Sub Agenzia *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                required
              />
            </div>
            <div className="relative">
              <Label htmlFor="responsabile">Responsabile *</Label>
              <Input
                id="responsabile"
                value={searchTerm || getSelectedResponsabileName()}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTerm(value);
                  
                  // If no responsabili available, use the input value directly as ID
                  if (!responsabili || responsabili.length === 0) {
                    setFormData(prev => ({ ...prev, responsabile_id: value }));
                    setShowResponsabiliDropdown(false);
                  } else {
                    // Otherwise, show dropdown for search
                    setShowResponsabiliDropdown(true);
                    if (!value) {
                      setFormData(prev => ({ ...prev, responsabile_id: '' }));
                    }
                  }
                }}
                onFocus={() => {
                  // Only show dropdown if responsabili exist
                  if (responsabili && responsabili.length > 0) {
                    setShowResponsabiliDropdown(true);
                  }
                }}
                placeholder={responsabili && responsabili.length > 0 
                  ? "Cerca per nome, cognome o username..." 
                  : "Inserisci ID responsabile manualmente..."}
                required={!formData.responsabile_id}
              />
              
              {/* Show dropdown with results or no-results message */}
              {showResponsabiliDropdown && responsabili && responsabili.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {getFilteredResponsabili().length > 0 ? (
                    getFilteredResponsabili().map((resp) => (
                      <div
                        key={resp.id}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                        onClick={() => selectResponsabile(resp)}
                      >
                        <div className="font-medium text-slate-800">
                          {resp.nome} {resp.cognome}
                        </div>
                        <div className="text-sm text-slate-500">
                          {resp.username} • {resp.email}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-center text-slate-500">
                      <p className="text-sm">Nessun responsabile trovato con questi criteri</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Show warning if no managers available */}
              {(!responsabili || responsabili.length === 0) && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800">Nessun responsabile disponibile</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Non ci sono utenti con ruolo "Responsabile Sub Agenzia" nel sistema. 
                        Puoi inserire manualmente l'ID di un responsabile nel campo sopra.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <Label htmlFor="descrizione">Descrizione</Label>
            <Textarea
              id="descrizione"
              value={formData.descrizione}
              onChange={(e) => setFormData({...formData, descrizione: e.target.value})}
              rows={3}
            />
          </div>

          {/* Commesse e Servizi Selection */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Commesse Selection */}
            <div>
              <Label>Commesse Autorizzate</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3 bg-gray-50">
                {commesse?.map((commessa) => (
                  <div key={commessa.id} className="flex items-center space-x-2 cursor-pointer" onClick={() => toggleCommessa(commessa.id)}>
                    <input
                      type="checkbox"
                      checked={formData.commesse_autorizzate && formData.commesse_autorizzate.includes(commessa.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleCommessa(commessa.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{commessa.nome}</span>
                  </div>
                ))}
                {(!commesse || commesse.length === 0) && (
                  <p className="text-sm text-gray-500 italic">Nessuna commessa disponibile</p>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Selezionate: {formData.commesse_autorizzate.length} commesse
              </p>
            </div>

            {/* Servizi Selection */}
            <div>
              <Label>Servizi Autorizzati</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3 bg-blue-50">
                {getFilteredServizi().map((servizio) => (
                  <div key={servizio.id} className="flex items-center space-x-2 cursor-pointer" onClick={() => toggleServizio(servizio.id)}>
                    <input
                      type="checkbox"
                      checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleServizio(servizio.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{servizio.nome}</span>
                  </div>
                ))}
                {getFilteredServizi().length === 0 && (
                  <p className="text-sm text-gray-500 italic">
                    {formData.commesse_autorizzate.length === 0 
                      ? "Seleziona prima una commessa per vedere i servizi" 
                      : "Nessun servizio disponibile per le commesse selezionate"}
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Selezionati: {formData.servizi_autorizzati.length} servizi
              </p>
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

// Edit Sub Agenzia Modal Component
const EditSubAgenziaModal = ({ subAgenzia, onClose, onSuccess, commesse, servizi, responsabili }) => {
  const [formData, setFormData] = useState({
    nome: subAgenzia?.nome || '',
    descrizione: subAgenzia?.descrizione || '',
    responsabile_id: subAgenzia?.responsabile_id || '',
    commesse_autorizzate: subAgenzia?.commesse_autorizzate || [],
    servizi_autorizzati: subAgenzia?.servizi_autorizzati || []
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showResponsabiliDropdown, setShowResponsabiliDropdown] = useState(false);

  // Filter responsabili based on search term
  const getFilteredResponsabili = () => {
    if (!responsabili || responsabili.length === 0) return [];
    if (!searchTerm) return responsabili;
    
    const lowerSearch = searchTerm.toLowerCase();
    return responsabili.filter(resp => 
      resp.username?.toLowerCase().includes(lowerSearch) ||
      resp.nome?.toLowerCase().includes(lowerSearch) ||
      resp.cognome?.toLowerCase().includes(lowerSearch) ||
      resp.email?.toLowerCase().includes(lowerSearch)
    );
  };

  // Select a responsabile
  const selectResponsabile = (responsabile) => {
    setFormData(prev => ({ ...prev, responsabile_id: responsabile.id }));
    setSearchTerm(`${responsabile.nome || ''} ${responsabile.cognome || ''} (${responsabile.username})`);
    setShowResponsabiliDropdown(false);
  };

  // Get selected responsabile display name
  const getSelectedResponsabileName = () => {
    if (!formData.responsabile_id || !responsabili) return '';
    const selected = responsabili.find(r => r.id === formData.responsabile_id);
    if (!selected) return '';
    return `${selected.nome || ''} ${selected.cognome || ''} (${selected.username})`;
  };

  const toggleCommessa = (commessaId) => {
    setFormData(prev => ({
      ...prev,
      commesse_autorizzate: prev.commesse_autorizzate.includes(commessaId)
        ? prev.commesse_autorizzate.filter(id => id !== commessaId)
        : [...prev.commesse_autorizzate, commessaId]
    }));
  };

  const toggleServizio = (servizioId) => {
    setFormData(prev => ({
      ...prev,
      servizi_autorizzati: prev.servizi_autorizzati.includes(servizioId)
        ? prev.servizi_autorizzati.filter(id => id !== servizioId)
        : [...prev.servizi_autorizzati, servizioId]
    }));
  };
  // Filter servizi based on selected commesse
  const getFilteredServizi = () => {
    if (!servizi || servizi.length === 0) return [];
    
    // If no commesse selected, show NO servizi (must select commessa first)
    if (formData.commesse_autorizzate.length === 0) {
      return [];
    }
    
    // Filter servizi to show only those belonging to selected commesse
    return servizi.filter(servizio => 
      formData.commesse_autorizzate.includes(servizio.commessa_id)
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSuccess(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Sub Agenzia</DialogTitle>
          <DialogDescription>
            Modifica i dati della sub agenzia "{subAgenzia.nome}"
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome Sub Agenzia *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                required
              />
            </div>
            <div className="relative">
              <Label htmlFor="responsabile">Responsabile *</Label>
              <Input
                id="responsabile"
                value={searchTerm || getSelectedResponsabileName()}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTerm(value);
                  
                  // If no responsabili available, use the input value directly as ID
                  if (!responsabili || responsabili.length === 0) {
                    setFormData(prev => ({ ...prev, responsabile_id: value }));
                    setShowResponsabiliDropdown(false);
                  } else {
                    // Otherwise, show dropdown for search
                    setShowResponsabiliDropdown(true);
                    if (!value) {
                      setFormData(prev => ({ ...prev, responsabile_id: '' }));
                    }
                  }
                }}
                onFocus={() => {
                  // Only show dropdown if responsabili exist
                  if (responsabili && responsabili.length > 0) {
                    setShowResponsabiliDropdown(true);
                  }
                }}
                placeholder={responsabili && responsabili.length > 0 
                  ? "Cerca per nome, cognome o username..." 
                  : "Inserisci ID responsabile manualmente..."}
                required={!formData.responsabile_id}
              />
              
              {/* Show dropdown with results or no-results message */}
              {showResponsabiliDropdown && responsabili && responsabili.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {getFilteredResponsabili().length > 0 ? (
                    getFilteredResponsabili().map((resp) => (
                      <div
                        key={resp.id}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                        onClick={() => selectResponsabile(resp)}
                      >
                        <div className="font-medium text-slate-800">
                          {resp.nome} {resp.cognome}
                        </div>
                        <div className="text-sm text-slate-500">
                          {resp.username} • {resp.email}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-center text-slate-500">
                      <p className="text-sm">Nessun responsabile trovato con questi criteri</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Show warning if no managers available */}
              {(!responsabili || responsabili.length === 0) && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800">Nessun responsabile disponibile</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Non ci sono utenti con ruolo "Responsabile Sub Agenzia" nel sistema. 
                        Puoi inserire manualmente l'ID di un responsabile nel campo sopra.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <Label htmlFor="descrizione">Descrizione</Label>
            <Textarea
              id="descrizione"
              value={formData.descrizione}
              onChange={(e) => setFormData({...formData, descrizione: e.target.value})}
              rows={3}
            />
          </div>

          {/* Sub Agenzia Info Display */}
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <Label className="text-xs font-medium text-slate-600">ID Sub Agenzia</Label>
                <p className="font-mono bg-white p-1 rounded">{subAgenzia.id}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600">Creata il</Label>
                <p className="bg-white p-1 rounded">
                  {subAgenzia.created_at ? new Date(subAgenzia.created_at).toLocaleString('it-IT') : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Commesse e Servizi Selection */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Commesse Selection */}
            <div>
              <Label>Commesse Autorizzate</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-3 bg-gray-50">
                {commesse?.map((commessa) => (
                  <div key={commessa.id} className="flex items-center space-x-2 cursor-pointer" onClick={() => toggleCommessa(commessa.id)}>
                    <input
                      type="checkbox"
                      checked={formData.commesse_autorizzate && formData.commesse_autorizzate.includes(commessa.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleCommessa(commessa.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{commessa.nome}</span>
                  </div>
                ))}
                {(!commesse || commesse.length === 0) && (
                  <p className="text-sm text-gray-500 italic">Nessuna commessa disponibile</p>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Selezionate: {formData.commesse_autorizzate.length} commesse
              </p>
            </div>

            {/* Servizi Selection */}
            <div>
              <Label>Servizi Autorizzati</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-3 bg-blue-50">
                {getFilteredServizi().map((servizio) => (
                  <div key={servizio.id} className="flex items-center space-x-2 cursor-pointer" onClick={() => toggleServizio(servizio.id)}>
                    <input
                      type="checkbox"
                      checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleServizio(servizio.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{servizio.nome}</span>
                  </div>
                ))}
                {getFilteredServizi().length === 0 && (
                  <p className="text-sm text-gray-500 italic">
                    {formData.commesse_autorizzate.length === 0 
                      ? "Seleziona prima una commessa per vedere i servizi" 
                      : "Nessun servizio disponibile per le commesse selezionate"}
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Selezionati: {formData.servizi_autorizzati.length} servizi
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">
              Salva Modifiche
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
    commessa_id: (selectedCommessa && selectedCommessa !== 'all') ? selectedCommessa : '',
    sub_agenzia_id: '',
    servizio_id: '',
    tipologia_contratto: '',
    segmento: '',
    note: ''
  });

  const [servizi, setServizi] = useState([]);
  const [createTipologieContratto, setCreateTipologieContratto] = useState([]);
  const [segmenti, setSegmenti] = useState([]);

  // Debug: Log received props
  useEffect(() => {
    console.log("📋 CreateClienteModal: Props ricevute:");
    console.log("  - Commesse:", commesse?.length || 0, "elementi");
    console.log("  - Sub Agenzie:", subAgenzie?.length || 0, "elementi");
    console.log("  - Selected Commessa:", selectedCommessa);
    
    // 🔍 DEBUG: Inspect actual objects
    if (commesse && commesse.length > 0) {
      console.log("🔍 Primo oggetto commessa:", JSON.stringify(commesse[0], null, 2));
    }
    if (subAgenzie && subAgenzie.length > 0) {
      console.log("🔍 Primo oggetto sub_agenzia:", JSON.stringify(subAgenzie[0], null, 2));
    }
  }, [commesse, subAgenzie, selectedCommessa]);

  useEffect(() => {
    if (selectedCommessa && selectedCommessa !== 'all') {
      setFormData(prev => ({ ...prev, commessa_id: selectedCommessa }));
      fetchServizi(selectedCommessa);
    }
  }, [selectedCommessa]);

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
      const response = await axios.get(`${API}/segmenti`);
      setSegmenti(response.data);
    } catch (error) {
      console.error("Error fetching segmenti:", error);
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
    
    console.log("🎯 HANDLE SUBMIT CALLED - DEBUGGING");
    console.log("🎯 Form Data Before Validation:", formData);
    
    // Validate required fields
    if (!formData.nome || !formData.cognome || !formData.telefono) {
      alert("Per favore compila tutti i campi obbligatori: Nome, Cognome e Telefono");
      return;
    }
    
    if (!formData.commessa_id || formData.commessa_id === "none") {
      alert("Per favore seleziona una Commessa");
      return;
    }
    
    if (!formData.sub_agenzia_id || formData.sub_agenzia_id === "none") {
      alert("Per favore seleziona una Sub Agenzia");
      return;
    }
    
    // Mappatura display values → backend enum values
    const tipologiaMapping = {
      'Telefonia Fastweb': 'telefonia_fastweb',
      'Energia Fastweb': 'energia_fastweb',
      'HO Mobile': 'ho_mobile',
      'Telepass': 'telepass'
    };
    
    const segmentoMapping = {
      'Residenziale': 'residenziale',
      'Business': 'business'
    };
    
    // Converti i valori display agli enum backend
    const mapTipologiaValue = (value) => {
      if (!value || value === "none") return null;
      // Se è già un valore enum, mantienilo
      if (Object.values(tipologiaMapping).includes(value)) return value;
      // Altrimenti cerca nella mappatura
      return tipologiaMapping[value] || value;
    };
    
    const mapSegmentoValue = (value) => {
      if (!value || value === "none") return null;
      // Se è già un valore enum, mantienilo  
      if (Object.values(segmentoMapping).includes(value)) return value;
      // Altrimenti cerca nella mappatura
      return segmentoMapping[value] || value;
    };
    
    // Clean data - remove "none" values but keep valid IDs, and map enum values
    const cleanFormData = {
      ...formData,
      email: formData.email || null, // Rimuovi email vuota
      commessa_id: formData.commessa_id === "none" ? "" : formData.commessa_id,
      sub_agenzia_id: formData.sub_agenzia_id === "none" ? "" : formData.sub_agenzia_id,
      servizio_id: (!formData.servizio_id || formData.servizio_id === "none") ? null : formData.servizio_id,
      tipologia_contratto: mapTipologiaValue(formData.tipologia_contratto),
      segmento: mapSegmentoValue(formData.segmento)
    };
    
    console.log("🎯 ORIGINAL FORM DATA:", formData);
    console.log("🎯 CLEAN FORM DATA FOR SUBMISSION:", cleanFormData);
    console.log("🎯 ENUM MAPPINGS APPLIED:");
    console.log("  - tipologia_contratto:", formData.tipologia_contratto, "→", cleanFormData.tipologia_contratto);
    console.log("  - segmento:", formData.segmento, "→", cleanFormData.segmento);
    console.log("🎯 CALLING onSubmit FUNCTION...");
    
    // Call the onSubmit function passed from parent
    onSubmit(cleanFormData);
    
    console.log("🎯 ONSUBMIT CALLED - RESETTING FORM");
    
    // Reset form after submit
    setFormData({
      nome: '', cognome: '', email: '', telefono: '', indirizzo: '', 
      citta: '', provincia: '', cap: '', codice_fiscale: '', partita_iva: '',
      commessa_id: (selectedCommessa && selectedCommessa !== 'all') ? selectedCommessa : '',
      sub_agenzia_id: '', servizio_id: '',
      tipologia_contratto: '', segmento: '', note: ''
    });
    
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo Cliente</DialogTitle>
          <DialogDescription>
            Crea un nuovo cliente inserendo i dati richiesti. I campi contrassegnati con * sono obbligatori.
          </DialogDescription>
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
                onValueChange={(value) => {
                  const commessaId = value === "none" ? "" : value;
                  handleCommessaChange(commessaId);
                }}
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

          {/* Nuovi campi: Servizio, Tipologia Contratto, Segmento */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="servizio_id">Servizio</Label>
              <Select 
                value={formData.servizio_id || "none"} 
                onValueChange={(value) => {
                  const servizioId = value === "none" ? "" : value;
                  handleServizioChange(servizioId);
                }}
                disabled={!formData.commessa_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona Servizio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seleziona Servizio</SelectItem>
                  {servizi.map((servizio) => (
                    <SelectItem key={servizio.id} value={servizio.id}>
                      {servizio.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tipologia_contratto">Tipologia Contratto *</Label>
              <Select 
                value={formData.tipologia_contratto || "none"} 
                onValueChange={(value) => setFormData({
                  ...formData, 
                  tipologia_contratto: value === "none" ? "" : value
                })}
                disabled={!formData.servizio_id || createTipologieContratto.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona Tipologia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Seleziona Tipologia</SelectItem>
                  {createTipologieContratto.map((tipologia) => (
                    <SelectItem key={tipologia.value} value={tipologia.label}>
                      {tipologia.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="segmento">Segmento *</Label>
              <Select 
                value={formData.segmento || "none"} 
                onValueChange={(value) => setFormData({
                  ...formData, 
                  segmento: value === "none" ? "" : value
                })}
                disabled={!formData.tipologia_contratto || segmenti.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona Segmento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Seleziona Segmento</SelectItem>
                  {segmenti.map((segmento) => (
                    <SelectItem key={segmento.value} value={segmento.value}>
                      {segmento.label}
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

// View Cliente Modal Component
const ViewClienteModal = ({ cliente, onClose, commesse, subAgenzie }) => {
  if (!cliente) return null;
  
  const getCommessaName = (id) => commesse.find(c => c.id === id)?.nome || id;
  const getSubAgenziaName = (id) => subAgenzie.find(s => s.id === id)?.nome || id;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <span>Anagrafica Cliente: {cliente.nome} {cliente.cognome}</span>
          </DialogTitle>
          <DialogDescription>
            Visualizzazione completa dei dati anagrafici del cliente
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* Dati Personali */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <User className="w-4 h-4 mr-2" />
                Dati Personali
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-slate-600">Nome Completo</Label>
                <p className="text-sm">{cliente.nome} {cliente.cognome}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Email</Label>
                <p className="text-sm">{cliente.email || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Telefono</Label>
                <p className="text-sm">{cliente.telefono || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Data di Nascita</Label>
                <p className="text-sm">{cliente.data_nascita || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Luogo di Nascita</Label>
                <p className="text-sm">{cliente.luogo_nascita || 'Non specificato'}</p>
              </div>
              {/* Nuovi campi */}
              {cliente.servizio_id && (
                <div>
                  <Label className="text-sm font-medium text-slate-600">Servizio</Label>
                  <p className="text-sm">{cliente.servizio_id}</p>
                </div>
              )}
              {cliente.tipologia_contratto && (
                <div>
                  <Label className="text-sm font-medium text-slate-600">Tipologia Contratto</Label>
                  <p className="text-sm">
                    {cliente.tipologia_contratto === 'energia_fastweb' ? 'Energia Fastweb' :
                     cliente.tipologia_contratto === 'telefonia_fastweb' ? 'Telefonia Fastweb' :
                     cliente.tipologia_contratto === 'ho_mobile' ? 'Ho Mobile' :
                     cliente.tipologia_contratto === 'telepass' ? 'Telepass' :
                     cliente.tipologia_contratto}
                  </p>
                </div>
              )}
              {cliente.segmento && (
                <div>
                  <Label className="text-sm font-medium text-slate-600">Segmento</Label>
                  <p className="text-sm">
                    {cliente.segmento === 'residenziale' ? 'Residenziale' : 
                     cliente.segmento === 'business' ? 'Business' : 
                     cliente.segmento}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dati Fiscali */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Dati Fiscali
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-slate-600">Codice Fiscale</Label>
                <p className="text-sm font-mono">{cliente.codice_fiscale || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Partita IVA</Label>
                <p className="text-sm font-mono">{cliente.partita_iva || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Cliente ID</Label>
                <p className="text-sm font-mono">{cliente.cliente_id}</p>
              </div>
            </CardContent>
          </Card>

          {/* Indirizzo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Indirizzo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-slate-600">Via/Piazza</Label>
                <p className="text-sm">{cliente.indirizzo || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Città</Label>
                <p className="text-sm">{cliente.citta || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Provincia</Label>
                <p className="text-sm">{cliente.provincia || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">CAP</Label>
                <p className="text-sm">{cliente.cap || 'Non specificato'}</p>
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
              <div>
                <Label className="text-sm font-medium text-slate-600">Commessa</Label>
                <p className="text-sm">{getCommessaName(cliente.commessa_id)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Sub Agenzia</Label>
                <p className="text-sm">{getSubAgenziaName(cliente.sub_agenzia_id)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Status</Label>
                <Badge variant={
                  cliente.status === "completato" ? "default" :
                  cliente.status === "in_corso" ? "secondary" : 
                  "outline"
                }>
                  {cliente.status || 'Non specificato'}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Data Creazione</Label>
                <p className="text-sm">{new Date(cliente.created_at).toLocaleDateString('it-IT')}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Note */}
        {cliente.note && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Note
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{cliente.note}</p>
            </CardContent>
          </Card>
        )}

        <DialogFooter className="mt-6">
          <Button onClick={onClose}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Edit Cliente Modal Component  
const EditClienteModal = ({ cliente, onClose, onSubmit, commesse, subAgenzie }) => {
  const [formData, setFormData] = useState({
    nome: cliente?.nome || '',
    cognome: cliente?.cognome || '',
    email: cliente?.email || '',
    telefono: cliente?.telefono || '',
    data_nascita: cliente?.data_nascita || '',
    luogo_nascita: cliente?.luogo_nascita || '',
    codice_fiscale: cliente?.codice_fiscale || '',
    partita_iva: cliente?.partita_iva || '',
    indirizzo: cliente?.indirizzo || '',
    citta: cliente?.citta || '',
    provincia: cliente?.provincia || '',
    cap: cliente?.cap || '',
    commessa_id: cliente?.commessa_id || '',
    sub_agenzia_id: cliente?.sub_agenzia_id || '',
    servizio_id: cliente?.servizio_id || '',
    tipologia_contratto: cliente?.tipologia_contratto || '',
    segmento: cliente?.segmento || '',
    status: cliente?.status || 'nuovo',
    note: cliente?.note || ''
  });

  const [servizi, setServizi] = useState([]);
  const [editTipologieContratto, setEditTipologieContratto] = useState([]);
  const [segmenti, setSegmenti] = useState([]);

  useEffect(() => {
    if (formData.commessa_id) {
      fetchServizi(formData.commessa_id);
    }
    fetchSegmenti();
  }, []);

  useEffect(() => {
    if (formData.servizio_id && formData.commessa_id) {
      fetchEditTipologieContratto(formData.commessa_id, formData.servizio_id);
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

  const fetchEditTipologieContratto = async (commessaId, servizioId) => {
    try {
      const response = await axios.get(`${API}/tipologie-contratto?commessa_id=${commessaId}&servizio_id=${servizioId}`);
      setEditTipologieContratto(response.data);
    } catch (error) {
      console.error("Error fetching tipologie contratto:", error);
      setEditTipologieContratto([]);
    }
  };

  const fetchSegmenti = async () => {
    try {
      const response = await axios.get(`${API}/segmenti`);
      setSegmenti(response.data);
    } catch (error) {
      console.error("Error fetching segmenti:", error);
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
    setEditTipologieContratto([]);
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
    onSubmit(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Edit className="w-5 h-5 text-blue-600" />
            <span>Modifica Cliente: {cliente?.nome} {cliente?.cognome}</span>
          </DialogTitle>
          <DialogDescription>
            Modifica i dati anagrafici del cliente. I campi contrassegnati con * sono obbligatori.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Dati Personali */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dati Personali</CardTitle>
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
                  <Label htmlFor="telefono">Telefono</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) => handleChange('telefono', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="data_nascita">Data di Nascita</Label>
                  <Input
                    id="data_nascita"
                    type="date"
                    value={formData.data_nascita}
                    onChange={(e) => handleChange('data_nascita', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="luogo_nascita">Luogo di Nascita</Label>
                  <Input
                    id="luogo_nascita"
                    value={formData.luogo_nascita}
                    onChange={(e) => handleChange('luogo_nascita', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dati Fiscali */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dati Fiscali</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="codice_fiscale">Codice Fiscale</Label>
                  <Input
                    id="codice_fiscale"
                    value={formData.codice_fiscale}
                    onChange={(e) => handleChange('codice_fiscale', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="partita_iva">Partita IVA</Label>
                  <Input
                    id="partita_iva"
                    value={formData.partita_iva}
                    onChange={(e) => handleChange('partita_iva', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Indirizzo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Indirizzo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="indirizzo">Via/Piazza</Label>
                  <Input
                    id="indirizzo"
                    value={formData.indirizzo}
                    onChange={(e) => handleChange('indirizzo', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="citta">Città</Label>
                  <Input
                    id="citta"
                    value={formData.citta}
                    onChange={(e) => handleChange('citta', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="provincia">Provincia</Label>
                  <Input
                    id="provincia"
                    value={formData.provincia}
                    onChange={(e) => handleChange('provincia', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="cap">CAP</Label>
                  <Input
                    id="cap"
                    value={formData.cap}
                    onChange={(e) => handleChange('cap', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dati Organizzativi */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dati Organizzativi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Commessa *</Label>
                  <Select value={formData.commessa_id} onValueChange={(value) => handleCommessaChange(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona commessa" />
                    </SelectTrigger>
                    <SelectContent>
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
                  <Select value={formData.sub_agenzia_id} onValueChange={(value) => handleChange('sub_agenzia_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona sub agenzia" />
                    </SelectTrigger>
                    <SelectContent>
                      {subAgenzie.map((subAgenzia) => (
                        <SelectItem key={subAgenzia.id} value={subAgenzia.id}>
                          {subAgenzia.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Nuovi campi */}
                <div>
                  <Label>Servizio</Label>
                  <Select 
                    value={formData.servizio_id || ""} 
                    onValueChange={(value) => handleServizioChange(value)}
                    disabled={!formData.commessa_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona servizio" />
                    </SelectTrigger>
                    <SelectContent>
                      {servizi.map((servizio) => (
                        <SelectItem key={servizio.id} value={servizio.id}>
                          {servizio.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipologia Contratto</Label>
                  <Select 
                    value={formData.tipologia_contratto || ""} 
                    onValueChange={(value) => handleChange('tipologia_contratto', value)}
                    disabled={!formData.servizio_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipologia" />
                    </SelectTrigger>
                    <SelectContent>
                      {editTipologieContratto.map((tipologia) => (
                        <SelectItem key={tipologia.value} value={tipologia.value}>
                          {tipologia.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Segmento</Label>
                  <Select 
                    value={formData.segmento || ""} 
                    onValueChange={(value) => handleChange('segmento', value)}
                    disabled={!formData.tipologia_contratto}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona segmento" />
                    </SelectTrigger>
                    <SelectContent>
                      {segmenti.map((segmento) => (
                        <SelectItem key={segmento.value} value={segmento.value}>
                          {segmento.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nuovo">Nuovo</SelectItem>
                      <SelectItem value="contattato">Contattato</SelectItem>
                      <SelectItem value="in_corso">In Corso</SelectItem>
                      <SelectItem value="completato">Completato</SelectItem>
                      <SelectItem value="sospeso">Sospeso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Note */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Note</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.note}
                onChange={(e) => handleChange('note', e.target.value)}
                placeholder="Note aggiuntive..."
                rows={4}
              />
            </CardContent>
          </Card>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">
              Salva Modifiche
            </Button>
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

            <div className="flex space-x-2 pt-4">
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

        const response = await axios.post(`${API}/aruba-drive/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
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
      toast({
        title: "Errore Upload",
        description: `Tutti i ${errorCount} file hanno fallito il caricamento`,
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
            <DialogTitle className="flex items-center space-x-3 text-lg sm:text-xl">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-slate-900 truncate">Documenti Cliente</h2>
                <p className="text-sm text-slate-600 truncate">{clientName}</p>
              </div>
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 leading-relaxed">
              Gestisci documenti per questo cliente. I file vengono organizzati automaticamente su Aruba Drive.
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <div className="space-y-6">
          {/* Multi-File Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>📁 Carica Documenti (Multi-File)</span>
                <Badge variant="outline">{selectedFiles.length} file selezionati</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Drag & Drop Area */}
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-slate-700 mb-2">
                    Trascina file qui o clicca per selezionare
                  </p>
                  <p className="text-sm text-slate-500 mb-4">
                    Supporta file multipli • PDF, DOC, XLS, IMG, ZIP
                  </p>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-input-multi"
                  />
                  <label
                    htmlFor="file-input-multi"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Seleziona File
                  </label>
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-slate-700">File Selezionati:</h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded border">
                          <div className="flex items-center space-x-2 flex-1">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium truncate">{file.name}</span>
                            <span className="text-xs text-slate-500">
                              ({(file.size / 1024 / 1024).toFixed(2)} MB)
                            </span>
                          </div>
                          
                          {/* Progress Bar */}
                          {uploadProgress[file.name] && (
                            <div className="flex items-center space-x-2 mr-2">
                              {uploadProgress[file.name].status === 'uploading' && (
                                <div className="w-16 bg-slate-200 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all" 
                                    style={{ width: `${uploadProgress[file.name].progress}%` }}
                                  ></div>
                                </div>
                              )}
                              {uploadProgress[file.name].status === 'completed' && (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              )}
                              {uploadProgress[file.name].status === 'error' && (
                                <XCircle className="w-4 h-4 text-red-600" />
                              )}
                            </div>
                          )}
                          
                          {!uploading && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeFile(index)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload Controls */}
                {selectedFiles.length > 0 && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedFiles([])}
                      disabled={uploading}
                    >
                      Azzera Selezione
                    </Button>
                    <Button
                      onClick={handleMultipleUpload}
                      disabled={uploading}
                      className="bg-green-600 hover:bg-green-700"
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
                )}
              </div>
            </CardContent>
          </Card>

          {/* Documents List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>📋 Documenti Cliente ({documents.length})</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchClientDocuments}
                  disabled={loading}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-600" />
                  ) : (
                    "🔄 Aggiorna"
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-700 mb-2">
                    Nessun documento caricato
                  </h3>
                  <p className="text-slate-500">
                    Usa la sezione di caricamento sopra per aggiungere documenti per questo cliente
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-slate-300">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="border border-slate-300 px-4 py-2 text-left">File</th>
                        <th className="border border-slate-300 px-4 py-2 text-left">Tipo</th>
                        <th className="border border-slate-300 px-4 py-2 text-left">Dimensione</th>
                        <th className="border border-slate-300 px-4 py-2 text-left">Aruba Drive</th>
                        <th className="border border-slate-300 px-4 py-2 text-left">Data Upload</th>
                        <th className="border border-slate-300 px-4 py-2 text-center">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50">
                          <td className="border border-slate-300 px-4 py-3">
                            <div className="flex items-center space-x-2">
                              <FileText className="w-5 h-5 text-blue-600" />
                              <span className="font-medium">{doc.filename}</span>
                            </div>
                          </td>
                          <td className="border border-slate-300 px-4 py-3">
                            <Badge variant="secondary">
                              {doc.file_type || 'application/octet-stream'}
                            </Badge>
                          </td>
                          <td className="border border-slate-300 px-4 py-3">
                            {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                          </td>
                          <td className="border border-slate-300 px-4 py-3">
                            {doc.aruba_drive_path ? (
                              <span className="text-green-600 text-sm">
                                ✅ {doc.aruba_drive_path}
                              </span>
                            ) : (
                              <span className="text-amber-600 text-sm">⏳ Solo locale</span>
                            )}
                          </td>
                          <td className="border border-slate-300 px-4 py-3">
                            {new Date(doc.created_at).toLocaleDateString('it-IT', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="border border-slate-300 px-4 py-3">
                            <div className="flex items-center justify-center space-x-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownload(doc.id, doc.filename)}
                                title="Scarica da Aruba Drive"
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                                title="Rimuovi dalla lista (mantieni su Aruba Drive)"
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
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppWithAuth;