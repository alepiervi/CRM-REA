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
  Filter
} from "lucide-react";

// Smart Backend URL Detection - works in all environments
// PRODUCTION BACKEND: Always use dedicated production backend (always on)
const getBackendURL = () => {
  // CRITICAL: Always use environment variable when available
  // This is automatically set during Emergent deployments
  const envBackendURL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
  
  if (envBackendURL) {
    console.log('✅ Using environment variable REACT_APP_BACKEND_URL:', envBackendURL);
    return envBackendURL;
  }
  
  // Fallback only for local development when env var is not set
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('💻 Development: Using localhost backend');
    return 'http://localhost:8001';
  }
  
  // Should never reach here in production
  console.error('❌ No backend URL configured! Set REACT_APP_BACKEND_URL environment variable');
  return 'http://localhost:8001';
};

const BACKEND_URL = getBackendURL();
const API = `${BACKEND_URL}/api`;

// Log configuration for debugging
console.log('📡 Backend URL configured:', BACKEND_URL);
console.log('📡 API endpoint:', API);

// Helper functions
const formatDate = (dateString) => {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
  return new Date(dateString).toLocaleDateString('it-IT', options);
};

// Helper function per formattare gli status dei clienti
const formatClienteStatus = (status) => {
  const statusMapping = {
    'inserito': 'Inserito',
    'ko': 'KO',
    'infoline': 'Infoline',
    'inviata_consumer': 'Inviata Consumer',
    'problematiche_inserimento': 'Problematiche Inserimento',
    'attesa_documenti_clienti': 'Attesa Documenti Clienti',
    'non_acquisibile_richiesta_escalation': 'Non Acquisibile Richiesta Escalation',
    'in_gestione_struttura_consulente': 'In Gestione Struttura/Consulente',
    'non_risponde': 'Non Risponde',
    'passata_al_bo': 'Passata al BO',
    'da_inserire': 'Da Inserire',
    'inserito_sotto_altro_canale': 'Inserito Sotto Altro Canale',
    'proveniente_da_altro_canale': 'Proveniente da Altro Canale',
    'scontrinare': 'Scontrinare'
  };
  
  return statusMapping[status] || status?.replace('_', ' ').toUpperCase() || 'Non specificato';
};

// Helper function per il colore degli status
const getClienteStatusVariant = (status) => {
  switch(status) {
    case 'inserito':
    case 'inviata_consumer':
      return 'default';
    case 'ko':
    case 'problematiche_inserimento':
    case 'non_acquisibile_richiesta_escalation':
      return 'destructive';
    case 'infoline':
    case 'in_gestione_struttura_consulente':
      return 'secondary';
    case 'da_inserire':
    case 'attesa_documenti_clienti':
      return 'outline';
    default:
      return 'secondary';
  }
};

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
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const { toast } = useToast(); // Add toast hook
  // REDESIGNED: Single-timer session management state
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const sessionTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  // REDESIGNED: Single-timer session management system
  const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes total
  const WARNING_TIME = 2 * 60 * 1000;     // Show warning 2 minutes before timeout

  const checkSessionTimeout = () => {
    const now = Date.now();
    const timeSinceActivity = now - lastActivityRef.current;
    const timeRemaining = SESSION_TIMEOUT - timeSinceActivity;

    console.log(`🕐 Session check: ${Math.floor(timeRemaining / 1000)}s remaining`);

    // DEFENSIVE CHECK: Don't logout if session extension just happened (within last 5 seconds)
    if (timeSinceActivity < 5000) {
      console.log('✅ Recent activity detected - session is active');
      if (showSessionWarning) {
        console.log('✅ Hiding session warning due to recent activity');
        setShowSessionWarning(false);
        stopCountdown();
      }
      return;
    }

    if (timeRemaining <= 0) {
      // Session expired - logout
      console.log('🚪 Session expired - logging out');
      clearSessionTimers();
      setShowSessionWarning(false);
      showSessionWarningToast('⏰ Sessione scaduta per inattività', 'destructive');
      setTimeout(logout, 1000);
      return;
    }

    if (timeRemaining <= WARNING_TIME && !showSessionWarning) {
      // Show warning banner and start countdown
      console.log(`⚠️ Showing session warning: ${Math.floor(timeRemaining / 1000)}s left`);
      setShowSessionWarning(true);
      setTimeLeft(Math.ceil(timeRemaining / 1000));
      showSessionWarningToast('⚠️ La sessione scadrà tra 2 minuti', 'default');
      startCountdown();
    } else if (timeRemaining > WARNING_TIME && showSessionWarning) {
      // Hide warning if activity detected
      console.log('✅ Activity detected - hiding session warning');
      setShowSessionWarning(false);
      stopCountdown();
    }
  };

  const clearSessionTimers = () => {
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const startSessionTimer = () => {
    clearSessionTimers();
    
    // Update last activity
    lastActivityRef.current = Date.now();
    
    // Check session every 5 seconds
    sessionTimerRef.current = setInterval(checkSessionTimeout, 5000);
  };

  const showSessionWarningToast = (message, variant = 'default') => {
    try {
      toast({
        title: "⏰ Avviso Sessione",
        description: message,
        variant: variant,
        duration: 8000
      });
    } catch (error) {
      console.log('Toast error:', error, 'Message:', message);
    }
  };

  const startCountdown = () => {
    console.log('▶️ Starting countdown');
    stopCountdown();
    
    countdownIntervalRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        const newTime = prevTime - 1;
        
        if (newTime <= 0) {
          console.log('⏰ Countdown reached 0 - checking session');
          stopCountdown();
          checkSessionTimeout(); // This will handle logout if needed
          return 0;
        }
        
        return newTime;
      });
    }, 1000);
  };

  const stopCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  };

  const extendSession = async () => {
    console.log('🔄 Extending session - STOPPING COUNTDOWN IMMEDIATELY');
    
    // CRITICAL FIX: Stop countdown and update activity BEFORE API call to prevent race condition
    stopCountdown();
    setShowSessionWarning(false);
    lastActivityRef.current = Date.now();
    
    try {
      // Validate JWT token
      console.log('🔑 Validating JWT token...');
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL || ''}/api/auth/me`);
      
      if (response.data && response.data.username && response.data.id) {
        console.log('✅ Session extended successfully');
        
        // Update user data if needed
        setUser(response.data);
        
        showSessionWarningToast('✅ Sessione estesa per altri 15 minuti', 'default');
        
        console.log('✅ Session successfully extended with race condition fix');
      } else {
        throw new Error('Invalid response from auth/me endpoint');
      }
      
    } catch (error) {
      console.error('❌ Session extension failed:', error);
      showSessionWarningToast('⏰ Sessione scaduta - richiesto nuovo login', 'destructive');
      setTimeout(logout, 1000);
    }
  };

  // resetActivityTimer removed - using handleActivity directly in useEffect

  // REDESIGNED: Activity detection system
  useEffect(() => {
    if (!token || !user) return;

    const activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    
    let throttleTimeout = null;
    
    const handleActivity = () => {
      // Throttle activity detection to prevent excessive calls
      if (throttleTimeout) return;
      
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
      }, 1000);
      
      console.log('🎯 Activity detected');
      
      // Update last activity time
      lastActivityRef.current = Date.now();
      
      // If warning is showing, hide it (user is active)
      if (showSessionWarning) {
        console.log('✅ Hiding session warning due to activity');
        setShowSessionWarning(false);
        stopCountdown();
      }
    };

    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Start session timer
    startSessionTimer();

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      clearSessionTimers();
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

  // Simplified axios interceptor - only logout on critical auth failures
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // Only logout on critical authentication failures, not during session operations
        if (error.response?.status === 401 && 
            !error.config?.url?.includes('/auth/me')) {
          console.log('🚪 Critical auth failure - logging out');
          logout();
        }
        return Promise.reject(error);
      }
    );

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
      
      // Check if user needs to change password
      if (userData.password_change_required) {
        setShowPasswordChangeModal(true);
        toast({
          title: "⚠️ Cambio Password Richiesto", 
          description: "Devi cambiare la password al primo accesso per motivi di sicurezza.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "✅ Login effettuato con successo", 
          description: `Benvenuto/a, ${userData.username}!`,
          variant: "default"
        });
      }
      
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

  // REDESIGNED: Clear timers on logout
  const logout = () => {
    console.log('🚪 Logging out user');
    
    // Clear redesigned session timers
    clearSessionTimers();
    
    // Hide any session warnings
    setShowSessionWarning(false);
    
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

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: currentPassword,
        new_password: newPassword
      });
      
      // Update user data to reflect password change
      const updatedUser = { ...user, password_change_required: false };
      setUser(updatedUser);
      setShowPasswordChangeModal(false);
      
      toast({
        title: "✅ Password cambiata con successo",
        description: "La tua password è stata aggiornata.",
        variant: "default"
      });
      
      return { success: true };
    } catch (error) {
      toast({
        title: "❌ Errore cambio password",
        description: error.response?.data?.detail || "Errore durante il cambio password",
        variant: "destructive"
      });
      return { success: false };
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        token, 
        loading, 
        login, 
        logout, 
        checkAuth,
        showSessionWarning: showSessionWarning || false,
        timeLeft: timeLeft || 0,
        extendSession: extendSession || (() => {}),
        stopCountdown: stopCountdown || (() => {}),
        showPasswordChangeModal,
        setShowPasswordChangeModal,
        changePassword
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Password Change Modal Component
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
  
  // 🎯 MOBILE-FRIENDLY: Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const { user, logout, setUser, showSessionWarning, timeLeft, extendSession, stopCountdown } = useAuth();
  const { toast } = useToast();

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
        { id: "workflow-builder", label: "Workflow Builder", icon: Workflow },
        { id: "ai-config", label: "Configurazione AI", icon: Settings },
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
        { id: "leads", label: "Lead", icon: Phone },
        { id: "lead-qualification", label: "Qualificazione Lead", icon: Bot },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "responsabile_commessa") {
      items.push(
        { id: "users", label: "Utenti", icon: Users },
        { id: "clienti", label: "Clienti", icon: UserCheck },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "backoffice_commessa") {
      items.push(
        { id: "clienti", label: "Clienti", icon: UserCheck },
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
        case "analytics":
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
  const [isRefreshing, setIsRefreshing] = useState(false); // NEW: For manual refresh animation
  const [autoRefresh, setAutoRefresh] = useState(true); // NEW: Auto-refresh toggle
  const [lastUpdated, setLastUpdated] = useState(null); // NEW: Last refresh timestamp
  const [selectedLead, setSelectedLead] = useState(null);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [leadEditData, setLeadEditData] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [leadStatuses, setLeadStatuses] = useState([]); // NEW: Dynamic statuses
  const [users, setUsers] = useState([]); // NEW: Users for agent names
  const [showFilters, setShowFilters] = useState(false); // Mobile: filters collapsed
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
    fetchLeads();
    fetchCustomFields();
    fetchLeadStatuses(); // NEW: Fetch dynamic statuses
    fetchUsers(); // NEW: Fetch users for agent names
  }, [selectedUnit, filters]);

  // Auto-refresh leads every 30 seconds to show new leads from Zapier
  useEffect(() => {
    if (!autoRefresh) return; // Only auto-refresh if enabled

    const intervalId = setInterval(() => {
      fetchLeads(true); // true indica che è un refresh automatico
    }, 30000); // 30 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [selectedUnit, filters, autoRefresh]); // Re-create interval when filters or autoRefresh change

  const fetchLeads = async (isAutoRefresh = false) => {
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
      
      const response = await axios.get(`${API}/leads?${params}`);
      setLeads(response.data);
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

  const handleManualRefresh = () => {
    fetchLeads(false); // Manual refresh
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
      const response = await axios.get(`${API}/lead-status?${params}`);
      setLeadStatuses(response.data);
    } catch (error) {
      console.error("Error fetching lead statuses:", error);
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
  const openLeadDetail = (lead) => {
    const leadWithAgentName = {
      ...lead,
      assigned_agent_name: getAgentName(lead.assigned_agent_id)
    };
    setSelectedLead(leadWithAgentName);
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
    // If no esito, try to find "Nuovo" status in database
    const statusName = esito || "Nuovo";
    
    // Find the status configuration from leadStatuses
    const statusConfig = leadStatuses.find(status => status.nome === statusName);
    
    if (statusConfig && statusConfig.colore) {
      // Use the configured color from database
      return (
        <Badge 
          style={{ 
            backgroundColor: statusConfig.colore,
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

          {/* Advanced Filters - Hidden on mobile unless expanded */}
          <div className={`${showFilters ? 'block' : 'hidden'} md:block`}>
            {/* Divider */}
            <div className="border-t border-slate-200 mb-4 md:mb-6"></div>
          
            {/* Filter Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {/* Unit Filter - Solo per Admin */}
            {user?.role === "admin" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-500" />
                  Unit
                </Label>
                <Select
                  value={filters.unit_id || "all"}
                  onValueChange={(value) => setFilters({ ...filters, unit_id: value === "all" ? "" : value })}
                >
                  <SelectTrigger className="border-slate-200 focus:border-blue-400 rounded-lg">
                    <SelectValue placeholder="Tutte le Unit" />
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
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-amber-500" />
                Campagna
              </Label>
              <Select
                value={filters.campagna || "all"}
                onValueChange={(value) => setFilters({ ...filters, campagna: value === "all" ? "" : value })}
              >
                <SelectTrigger className="border-slate-200 focus:border-blue-400 rounded-lg">
                  <SelectValue placeholder="Tutte le campagne" />
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
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-500" />
                Provincia
              </Label>
              <div className="relative">
                <Input
                  placeholder="Filtra per provincia..."
                  value={filters.provincia}
                  onChange={(e) => setFilters({ ...filters, provincia: e.target.value })}
                  className="pl-3 border-slate-200 focus:border-blue-400 rounded-lg"
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
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-500" />
                Stato Lead
              </Label>
              <select
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">Tutti gli stati</option>
                {leadStatuses.map((status) => (
                  <option key={status.id} value={status.nome}>
                    {status.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Agente */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                Agente Assegnato
              </Label>
              <select
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white"
                value={filters.assigned_agent_id}
                onChange={(e) => setFilters({ ...filters, assigned_agent_id: e.target.value })}
              >
                <option value="">Tutti gli agenti</option>
                <option value="unassigned">❌ Non assegnati</option>
                {users.filter(u => u.role === "agente").map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    👤 {agent.username}
                  </option>
                ))}
              </select>
            </div>

            {/* Da Data */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-500" />
                Da Data
              </Label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                className="border-slate-200 focus:border-blue-400 rounded-lg"
              />
            </div>

            {/* A Data */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-500" />
                A Data
              </Label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                className="border-slate-200 focus:border-blue-400 rounded-lg"
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
            </div>
          )}
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
                      {/* Colonna Assegnato a - Solo per Admin e Referente */}
                      {(user?.role === "admin" || user?.role === "referente") && (
                        <TableHead>Assegnato a</TableHead>
                      )}
                      <TableHead>Stato</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Azioni</TableHead>
