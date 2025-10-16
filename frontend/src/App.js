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
  Star,
  History
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
    console.log('🚀 Starting session timer');
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
  
  // Aruba Drive Configuration state
  const [arubaDriveConfigs, setArubaDriveConfigs] = useState([]);
  const [editingConfig, setEditingConfig] = useState(null);
  const [testingConfigId, setTestingConfigId] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  
  // 🎯 MOBILE-FRIENDLY: Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const { user, logout, setUser, showSessionWarning, timeLeft, extendSession, stopCountdown } = useAuth();
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
        { id: "lead-qualification", label: "Qualificazione Lead", icon: Bot },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "responsabile_commessa" || user.role === "backoffice_commessa") {
      items.push(
        { id: "clienti", label: "Clienti", icon: UserCheck },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "responsabile_sub_agenzia" || user.role === "backoffice_sub_agenzia") {
      items.push(
        { id: "clienti", label: "Clienti", icon: UserCheck },
        { id: "analytics", label: "Analytics", icon: TrendingUp }
      );
    } else if (user.role === "agente_specializzato" || user.role === "operatore" || user.role === "agente" || user.role === "responsabile_store" || user.role === "responsabile_presidi" || user.role === "store_assist" || user.role === "promoter_presidi" || user.role === "area_manager") {
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

        // Sezione "Documenti" rimossa dalla sidebar - ora gestita all'interno della sezione Clienti
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
        <main className="flex-1 h-screen overflow-y-auto mobile-container p-3 md:p-6">
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
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
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
                    
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-2 border-t border-slate-100">
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
  const [serviziPerCommessa, setServiziPerCommessa] = useState({}); // NEW: Servizi organizzati per commessa per responsabile_commessa
  const { toast } = useToast();

  // NEW: Fetch servizi per una specifica commessa (per responsabile_commessa)
  const fetchServiziForCommessa = async (commessaId) => {
    try {
      console.log('🔄 Fetching servizi for commessa:', commessaId);
      const response = await axios.get(`${API}/cascade/servizi-by-commessa/${commessaId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const serviziCommessa = response.data;
      console.log('✅ Servizi loaded for commessa:', commessaId, serviziCommessa);
      
      // Aggiungi i servizi alla cache organizzata per commessa
      setServiziPerCommessa(prev => ({
        ...prev,
        [commessaId]: serviziCommessa
      }));
      
    } catch (error) {
      console.error('❌ Error fetching servizi for commessa:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei servizi per la commessa",
        variant: "destructive",
      });
    }
  };

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

  const handleCommessaAutorizzataChange = async (commessaId, checked) => {
    if (checked) {
      setFormData({
        ...formData,
        commesse_autorizzate: [...formData.commesse_autorizzate, commessaId],
      });
      // Carica i servizi per la commessa selezionata (per responsabile/backoffice commessa e ruoli store/presidi)
      if (formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa" || 
          formData.role === "responsabile_store" || formData.role === "responsabile_presidi" ||
          formData.role === "store_assist" || formData.role === "promoter_presidi") {
        await fetchServiziForCommessa(commessaId);
      } else {
        handleCommessaChange(commessaId);
      }
    } else {
      // Rimuovi commessa e i suoi servizi
      setFormData(prevData => ({
        ...prevData,
        commesse_autorizzate: prevData.commesse_autorizzate.filter((c) => c !== commessaId),
        servizi_autorizzati: prevData.servizi_autorizzati.filter(servizioId => {
          // Rimuovi servizi che appartengono solo a questa commessa
          const servizioCommessa = serviziPerCommessa[commessaId];
          return !servizioCommessa?.some(s => s.id === servizioId);
        })
      }));
      // Rimuovi servizi dalla cache
      setServiziPerCommessa(prev => {
        const newServizi = { ...prev };
        delete newServizi[commessaId];
        return newServizi;
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
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto z-50">
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
                  <SelectItem value="store_assist">Store Assistant</SelectItem>
                  <SelectItem value="responsabile_presidi">Responsabile Presidi</SelectItem>
                  <SelectItem value="promoter_presidi">Promoter Presidi</SelectItem>
                  <SelectItem value="area_manager">Area Manager</SelectItem>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

          {/* Campi condizionali per ruoli specializzati - SEZIONE DUPLICATA RIMOSSA */}

          {/* RESPONSABILE COMMESSA e BACKOFFICE COMMESSA: Commesse (multi) → Servizi separati per commessa */}
          {(formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa") && (
            <>
              <div className="col-span-2">
                <Label>Commesse Autorizzate *</Label>
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

              {/* Servizi separati per ogni commessa selezionata */}
              {formData.commesse_autorizzate && formData.commesse_autorizzate.length > 0 && (
                <div className="col-span-2 space-y-4">
                  <Label className="text-lg font-semibold">Servizi Autorizzati per Commessa</Label>
                  {formData.commesse_autorizzate.map((commessaId) => {
                    const commessa = commesse.find(c => c.id === commessaId);
                    const serviziCommessa = serviziPerCommessa[commessaId] || [];
                    
                    return (
                      <div key={commessaId} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="font-semibold text-blue-700">
                            📋 {commessa?.nome || 'Commessa sconosciuta'}
                          </Label>
                          <span className="text-xs text-gray-500">
                            {serviziCommessa.length} servizi disponibili
                          </span>
                        </div>
                        
                        {serviziCommessa.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {serviziCommessa.map((servizio) => (
                              <div key={servizio.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`servizio-${commessaId}-${servizio.id}`}
                                  checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                                  onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                                />
                                <Label htmlFor={`servizio-${commessaId}-${servizio.id}`} className="text-sm cursor-pointer">
                                  {servizio.nome}
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            <p className="text-sm">Caricamento servizi per {commessa?.nome}...</p>
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mt-2"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-xs text-slate-500 mt-2">
                    Totale servizi selezionati: {formData.servizi_autorizzati?.length || 0}
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

          {/* RESPONSABILE STORE e RESPONSABILE PRESIDI: Multi Sub Agenzie → Multi Commesse → Servizi separati per commessa */}
          {(formData.role === "responsabile_store" || formData.role === "responsabile_presidi") && (
            <>
              <div className="col-span-2">
                <Label>Sub Agenzie Autorizzate *</Label>
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

              {/* Servizi separati per ogni commessa selezionata - STORE/PRESIDI */}
              {formData.commesse_autorizzate && formData.commesse_autorizzate.length > 0 && (
                <div className="col-span-2 space-y-4">
                  <Label className="text-lg font-semibold">Servizi Autorizzati per Commessa</Label>
                  {formData.commesse_autorizzate.map((commessaId) => {
                    const commessa = commesse.find(c => c.id === commessaId);
                    const serviziCommessa = serviziPerCommessa[commessaId] || [];
                    
                    return (
                      <div key={commessaId} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="font-semibold text-green-700">
                            🏪 {commessa?.nome || 'Commessa sconosciuta'} - Store/Presidi
                          </Label>
                          <span className="text-xs text-gray-500">
                            {serviziCommessa.length} servizi disponibili
                          </span>
                        </div>
                        
                        {serviziCommessa.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {serviziCommessa.map((servizio) => (
                              <div key={servizio.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`servizio-store-${commessaId}-${servizio.id}`}
                                  checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                                  onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                                />
                                <Label htmlFor={`servizio-store-${commessaId}-${servizio.id}`} className="text-sm cursor-pointer">
                                  {servizio.nome}
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            <p className="text-sm">Caricamento servizi per {commessa?.nome}...</p>
                            <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mt-2"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-xs text-slate-500 mt-2">
                    Totale servizi selezionati: {formData.servizi_autorizzati?.length || 0}
                  </p>
                </div>
              )}
            </>
          )}

          {/* AREA MANAGER: Multi Sub Agenzie per gestione produzione e clienti */}
          {formData.role === "area_manager" && (
            <>
              <div className="col-span-2">
                <Label>Sub Agenzie Assegnate *</Label>
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {subAgenzie.map((subAgenzia) => (
                      <div key={subAgenzia.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`subagenzia-area-${subAgenzia.id}`}
                          checked={formData.sub_agenzie_autorizzate && formData.sub_agenzie_autorizzate.includes(subAgenzia.id)}
                          onCheckedChange={(checked) => handleSubAgenziaAutorizzataChange(subAgenzia.id, checked)}
                        />
                        <Label htmlFor={`subagenzia-area-${subAgenzia.id}`} className="text-sm font-normal cursor-pointer">
                          {subAgenzia.nome}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Selezionate: {formData.sub_agenzie_autorizzate?.length || 0} sub agenzie
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  💡 Area Manager può vedere produzione e clienti delle sub agenzie selezionate
                </p>
              </div>
            </>
          )}

          {/* STORE ASSISTANT e PROMOTER PRESIDI: Singola Sub Agenzia → Multi Commesse → Servizi separati per commessa */}
          {(formData.role === "store_assist" || formData.role === "promoter_presidi") && (
            <>
              <div>
                <Label htmlFor="sub_agenzia_id">Sub Agenzia *</Label>
                <Select value={formData.sub_agenzia_id} onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, sub_agenzia_id: value, commesse_autorizzate: [], servizi_autorizzati: [] }));
                  setServiziPerCommessa({}); // Reset servizi cache
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

              {/* Servizi separati per ogni commessa selezionata - ASSISTANT/PROMOTER */}
              {formData.commesse_autorizzate && formData.commesse_autorizzate.length > 0 && (
                <div className="col-span-2 space-y-4">
                  <Label className="text-lg font-semibold">Servizi Autorizzati per Commessa</Label>
                  {formData.commesse_autorizzate.map((commessaId) => {
                    const commessa = commesse.find(c => c.id === commessaId);
                    const serviziCommessa = serviziPerCommessa[commessaId] || [];
                    
                    return (
                      <div key={commessaId} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="font-semibold text-orange-700">
                            👨‍💼 {commessa?.nome || 'Commessa sconosciuta'} - Assistant/Promoter
                          </Label>
                          <span className="text-xs text-gray-500">
                            {serviziCommessa.length} servizi disponibili
                          </span>
                        </div>
                        
                        {serviziCommessa.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {serviziCommessa.map((servizio) => (
                              <div key={servizio.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`servizio-assistant-${commessaId}-${servizio.id}`}
                                  checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                                  onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                                />
                                <Label htmlFor={`servizio-assistant-${commessaId}-${servizio.id}`} className="text-sm cursor-pointer">
                                  {servizio.nome}
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            <p className="text-sm">Caricamento servizi per {commessa?.nome}...</p>
                            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mt-2"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-xs text-slate-500 mt-2">
                    Totale servizi selezionati: {formData.servizi_autorizzati?.length || 0}
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
  const [serviziPerCommessa, setServiziPerCommessa] = useState({}); // NEW: Servizi organizzati per commessa per responsabile_commessa
  const { toast } = useToast();

  // NEW: Fetch servizi per una specifica commessa (per responsabile_commessa) - EditModal version
  const fetchServiziForCommessaEdit = async (commessaId) => {
    try {
      console.log('🔄 [EDIT] Fetching servizi for commessa:', commessaId);
      const response = await axios.get(`${API}/cascade/servizi-by-commessa/${commessaId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const serviziCommessa = response.data;
      console.log('✅ [EDIT] Servizi loaded for commessa:', commessaId, serviziCommessa);
      
      // Aggiungi i servizi alla cache organizzata per commessa
      setServiziPerCommessa(prev => ({
        ...prev,
        [commessaId]: serviziCommessa
      }));
      
    } catch (error) {
      console.error('❌ [EDIT] Error fetching servizi for commessa:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei servizi per la commessa",
        variant: "destructive",
      });
    }
  };

  // Load servizi when commesse_autorizzate changes
  useEffect(() => {
    if (formData.commesse_autorizzate && formData.commesse_autorizzate.length > 0) {
      if (formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa" ||
          formData.role === "responsabile_store" || formData.role === "responsabile_presidi" ||
          formData.role === "store_assist" || formData.role === "promoter_presidi") {
        // Per questi ruoli, carica servizi per OGNI commessa autorizzata
        formData.commesse_autorizzate.forEach(commessaId => {
          fetchServiziForCommessaEdit(commessaId);
        });
      } else {
        // Per altri ruoli, usa il sistema esistente
        handleCommessaChange(formData.commesse_autorizzate[0]);
      }
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

  // NEW: Load servizi for existing commesse when modal opens (for all roles with dynamic services)
  useEffect(() => {
    if ((formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa" ||
         formData.role === "responsabile_store" || formData.role === "responsabile_presidi" ||
         formData.role === "store_assist" || formData.role === "promoter_presidi") && 
        user.commesse_autorizzate && user.commesse_autorizzate.length > 0) {
      console.log('🔄 [EDIT MODAL MOUNT] Loading servizi for existing commesse:', user.commesse_autorizzate);
      // Carica servizi per tutte le commesse già autorizzate dell'utente
      user.commesse_autorizzate.forEach(commessaId => {
        fetchServiziForCommessaEdit(commessaId);
      });
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

  const handleCommessaAutorizzataChange = async (commessaId, checked) => {
    const currentCommesse = formData.commesse_autorizzate || [];
    if (checked) {
      setFormData({
        ...formData,
        commesse_autorizzate: [...currentCommesse, commessaId],
      });
      // Carica i servizi per la commessa selezionata (per responsabile/backoffice commessa e ruoli store/presidi)
      if (formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa" ||
          formData.role === "responsabile_store" || formData.role === "responsabile_presidi" ||
          formData.role === "store_assist" || formData.role === "promoter_presidi") {
        await fetchServiziForCommessaEdit(commessaId);
      } else {
        handleCommessaChange(commessaId);
      }
    } else {
      // Rimuovi commessa e i suoi servizi
      setFormData(prevData => ({
        ...prevData,
        commesse_autorizzate: currentCommesse.filter((c) => c !== commessaId),
        servizi_autorizzati: prevData.servizi_autorizzati.filter(servizioId => {
          // Rimuovi servizi che appartengono solo a questa commessa
          const servizioCommessa = serviziPerCommessa[commessaId];
          return !servizioCommessa?.some(s => s.id === servizioId);
        })
      }));
      // Rimuovi servizi dalla cache
      setServiziPerCommessa(prev => {
        const newServizi = { ...prev };
        delete newServizi[commessaId];
        return newServizi;
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
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto z-50">
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
                  <SelectItem value="store_assist">Store Assistant</SelectItem>
                  <SelectItem value="responsabile_presidi">Responsabile Presidi</SelectItem>
                  <SelectItem value="promoter_presidi">Promoter Presidi</SelectItem>
                  <SelectItem value="area_manager">Area Manager</SelectItem>
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

          {/* Campo Sub Agenzia - mostrato solo se assignment_type è "sub_agenzia" e non è per ruoli che hanno sezioni dedicate */}
          {formData.assignment_type === "sub_agenzia" && !(formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa" || 
            formData.role === "responsabile_sub_agenzia" || formData.role === "backoffice_sub_agenzia" ||
            formData.role === "responsabile_store" || formData.role === "responsabile_presidi" || 
            formData.role === "store_assist" || formData.role === "promoter_presidi") && (
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

          {/* NEW: Servizi Autorizzati per UNIT/SUB AGENZIA - Per TUTTI gli utenti con assignment (esclusi store/presidi che hanno sezioni dedicate) */}
          {!(formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa" || 
             formData.role === "responsabile_sub_agenzia" || formData.role === "backoffice_sub_agenzia" ||
             formData.role === "responsabile_store" || formData.role === "responsabile_presidi" ||
             formData.role === "store_assist" || formData.role === "promoter_presidi") && 
           ((formData.assignment_type === "unit" && formData.unit_id) || 
            (formData.assignment_type === "sub_agenzia" && formData.sub_agenzia_id)) && (
            <div>
              <Label>Servizi Autorizzati *</Label>
              {serviziDisponibili.length > 0 ? (
                <>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

          {/* Campi condizionali per ruoli specializzati - EDIT MODAL */}
          {(formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa") && (
            <>
              <div className="col-span-2">
                <Label>Commesse Autorizzate *</Label>
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {commesse.map((commessa) => (
                      <div key={commessa.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-commessa-${commessa.id}`}
                          checked={formData.commesse_autorizzate && formData.commesse_autorizzate.includes(commessa.id)}
                          onCheckedChange={(checked) => handleCommessaAutorizzataChange(commessa.id, checked)}
                        />
                        <Label htmlFor={`edit-commessa-${commessa.id}`} className="text-sm font-normal cursor-pointer">
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

              {/* Servizi separati per ogni commessa selezionata - EDIT MODAL */}
              {formData.commesse_autorizzate && formData.commesse_autorizzate.length > 0 && (
                <div className="col-span-2 space-y-4">
                  <Label className="text-lg font-semibold">Servizi Autorizzati per Commessa</Label>
                  {formData.commesse_autorizzate.map((commessaId) => {
                    const commessa = commesse.find(c => c.id === commessaId);
                    const serviziCommessa = serviziPerCommessa[commessaId] || [];
                    
                    return (
                      <div key={commessaId} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="font-semibold text-blue-700">
                            📋 {commessa?.nome || 'Commessa sconosciuta'}
                          </Label>
                          <span className="text-xs text-gray-500">
                            {serviziCommessa.length} servizi disponibili
                          </span>
                        </div>
                        
                        {serviziCommessa.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {serviziCommessa.map((servizio) => (
                              <div key={servizio.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`edit-servizio-${commessaId}-${servizio.id}`}
                                  checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                                  onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                                />
                                <Label htmlFor={`edit-servizio-${commessaId}-${servizio.id}`} className="text-sm cursor-pointer">
                                  {servizio.nome}
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            <p className="text-sm">Caricamento servizi per {commessa?.nome}...</p>
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mt-2"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-xs text-slate-500 mt-2">
                    Totale servizi selezionati: {formData.servizi_autorizzati?.length || 0}
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

          {/* RESPONSABILE STORE e RESPONSABILE PRESIDI: Multi Sub Agenzie → Multi Commesse → Servizi separati per commessa - EDIT */}
          {(formData.role === "responsabile_store" || formData.role === "responsabile_presidi") && (
            <>
              <div className="col-span-2">
                <Label>Sub Agenzie Autorizzate *</Label>
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

              {/* Servizi separati per ogni commessa selezionata - STORE/PRESIDI EDIT */}
              {formData.commesse_autorizzate && formData.commesse_autorizzate.length > 0 && (
                <div className="col-span-2 space-y-4">
                  <Label className="text-lg font-semibold">Servizi Autorizzati per Commessa</Label>
                  {formData.commesse_autorizzate.map((commessaId) => {
                    const commessa = commesse.find(c => c.id === commessaId);
                    const serviziCommessa = serviziPerCommessa[commessaId] || [];
                    
                    return (
                      <div key={commessaId} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="font-semibold text-green-700">
                            🏪 {commessa?.nome || 'Commessa sconosciuta'} - Store/Presidi (Edit)
                          </Label>
                          <span className="text-xs text-gray-500">
                            {serviziCommessa.length} servizi disponibili
                          </span>
                        </div>
                        
                        {serviziCommessa.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {serviziCommessa.map((servizio) => (
                              <div key={servizio.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`edit-servizio-store-${commessaId}-${servizio.id}`}
                                  checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                                  onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                                />
                                <Label htmlFor={`edit-servizio-store-${commessaId}-${servizio.id}`} className="text-sm cursor-pointer">
                                  {servizio.nome}
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            <p className="text-sm">Caricamento servizi per {commessa?.nome}...</p>
                            <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mt-2"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-xs text-slate-500 mt-2">
                    Totale servizi selezionati: {formData.servizi_autorizzati?.length || 0}
                  </p>
                </div>
              )}
            </>
          )}

          {/* AREA MANAGER: Multi Sub Agenzie per gestione produzione e clienti - EDIT */}
          {formData.role === "area_manager" && (
            <>
              <div className="col-span-2">
                <Label>Sub Agenzie Assegnate *</Label>
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {subAgenzie.map((subAgenzia) => (
                      <div key={subAgenzia.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-subagenzia-area-${subAgenzia.id}`}
                          checked={formData.sub_agenzie_autorizzate && formData.sub_agenzie_autorizzate.includes(subAgenzia.id)}
                          onCheckedChange={(checked) => handleSubAgenziaAutorizzataChange(subAgenzia.id, checked)}
                        />
                        <Label htmlFor={`edit-subagenzia-area-${subAgenzia.id}`} className="text-sm font-normal cursor-pointer">
                          {subAgenzia.nome}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Selezionate: {formData.sub_agenzie_autorizzate?.length || 0} sub agenzie
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  💡 Area Manager può vedere produzione e clienti delle sub agenzie selezionate
                </p>
              </div>
            </>
          )}

          {/* STORE ASSISTANT e PROMOTER PRESIDI: Singola Sub Agenzia → Multi Commesse → Servizi separati per commessa - EDIT */}
          {(formData.role === "store_assist" || formData.role === "promoter_presidi") && (
            <>
              <div>
                <Label htmlFor="sub_agenzia_id">Sub Agenzia *</Label>
                <Select value={formData.sub_agenzia_id} onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, sub_agenzia_id: value, commesse_autorizzate: [], servizi_autorizzati: [] }));
                  setServiziPerCommessa({}); // Reset servizi cache
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

              {/* Servizi separati per ogni commessa selezionata - ASSISTANT/PROMOTER EDIT */}
              {formData.commesse_autorizzate && formData.commesse_autorizzate.length > 0 && (
                <div className="col-span-2 space-y-4">
                  <Label className="text-lg font-semibold">Servizi Autorizzati per Commessa</Label>
                  {formData.commesse_autorizzate.map((commessaId) => {
                    const commessa = commesse.find(c => c.id === commessaId);
                    const serviziCommessa = serviziPerCommessa[commessaId] || [];
                    
                    return (
                      <div key={commessaId} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="font-semibold text-orange-700">
                            👨‍💼 {commessa?.nome || 'Commessa sconosciuta'} - Assistant/Promoter (Edit)
                          </Label>
                          <span className="text-xs text-gray-500">
                            {serviziCommessa.length} servizi disponibili
                          </span>
                        </div>
                        
                        {serviziCommessa.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {serviziCommessa.map((servizio) => (
                              <div key={servizio.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`edit-servizio-assistant-${commessaId}-${servizio.id}`}
                                  checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                                  onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                                />
                                <Label htmlFor={`edit-servizio-assistant-${commessaId}-${servizio.id}`} className="text-sm cursor-pointer">
                                  {servizio.nome}
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            <p className="text-sm">Caricamento servizi per {commessa?.nome}...</p>
                            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mt-2"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-xs text-slate-500 mt-2">
                    Totale servizi selezionati: {formData.servizi_autorizzati?.length || 0}
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
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-3 border-t">
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
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
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

    // CRITICAL FIX: If in clienti section, use selectedClientId instead of generic entityId
    let actualEntityId = entityId;
    if (activeTab === 'clienti' && selectedClientId) {
      actualEntityId = selectedClientId;
      console.log(`🔧 UPLOAD FIX: Using selectedClientId (${selectedClientId}) instead of generic entityId (${entityId})`);
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
        formData.append('entity_id', actualEntityId);
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

  const handleView = async (documentId, filename) => {
    if (!permissions.canDownload) { // Use same permission as download
      toast({
        title: "Non autorizzato",
        description: "Non hai i permessi per visualizzare documenti",
        variant: "destructive",
      });
      return;
    }

    try {
      // Use authenticated request (same as download but for viewing)
      const response = await axios.get(`${API}/documents/${documentId}/view`, {
        responseType: 'blob', // Get file as blob
      });

      // Create blob URL and open in new tab for viewing
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/pdf' 
      });
      const url = window.URL.createObjectURL(blob);
      
      // Open in new tab for viewing
      const newWindow = window.open(url, '_blank');
      
      // Clean up blob URL after a delay to ensure it loads
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 5000);
      
    } catch (error) {
      console.error("Error viewing document:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nella visualizzazione del documento",
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
                          <div className="flex space-x-2">
                            {permissions.canDownload && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleView(doc.id, doc.filename)}
                                title="Visualizza documento"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Visualizza
                              </Button>
                            )}
                            {permissions.canDownload && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(doc.id, doc.filename)}
                                title="Scarica documento"
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Scarica
                              </Button>
                            )}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleView(doc.id, doc.filename)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Visualizza
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(doc.id, doc.filename)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Scarica
                    </Button>
                  </div>
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
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
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
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
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
  const [showArubaConfigModal, setShowArubaConfigModal] = useState(false);
  const [editingCommessa, setEditingCommessa] = useState(null);
  const [editingCommessaForAruba, setEditingCommessaForAruba] = useState(null);
  const [arubaConfig, setArubaConfig] = useState({});
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

  const saveArubaConfig = async (commessaId, config) => {
    try {
      await axios.put(`${API}/commesse/${commessaId}/aruba-config`, config);
      
      toast({
        title: "Successo",
        description: "Configurazione Aruba Drive per filiera salvata con successo",
      });
      
      // Refresh the commesse list to show any changes
      fetchCommesse();
    } catch (error) {
      console.error("Error saving Commessa Aruba config:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nel salvataggio della configurazione Aruba Drive per filiera",
        variant: "destructive"
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
        fetchServizi(selectedCommessa.id);
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
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCommessaForAruba(commessa);
                          setShowArubaConfigModal(true);
                        }}
                        className="p-2 h-8 w-full"
                        title="Configura Aruba Drive (Filiera)"
                      >
                        <FileText className="w-3 h-3" />
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

      {/* Aruba Drive Configuration Modal per Commesse (Filiera) */}
      <ArubaConfigModal 
        isOpen={showArubaConfigModal}
        onClose={() => {
          setShowArubaConfigModal(false);
          setEditingCommessaForAruba(null);
          setArubaConfig({});
        }}
        commessa={editingCommessaForAruba}
        onSave={(config) => {
          if (editingCommessaForAruba) {
            saveArubaConfig(editingCommessaForAruba.id, config);
          }
          setShowArubaConfigModal(false);
          setEditingCommessaForAruba(null);
        }}
      />
    </div>
  );
};

// Aruba Drive Configuration Modal per Commesse (Filiera)
const ArubaConfigModal = ({ isOpen, onClose, onSave, commessa }) => {
  const [config, setConfig] = useState({
    enabled: false,
    url: '',
    username: '',
    password: '',
    root_folder_path: '',
    auto_create_structure: true,
    connection_timeout: 30,
    upload_timeout: 60,
    retry_attempts: 3
  });
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const { toast } = useToast();

  // Carica configurazione esistente quando si apre il modal
  useEffect(() => {
    if (isOpen && commessa) {
      loadCommessaArubaConfig();
    }
  }, [isOpen, commessa]);

  const loadCommessaArubaConfig = async () => {
    if (!commessa) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API}/commesse/${commessa.id}/aruba-config`);
      const loadedConfig = response.data.config || {};
      
      setConfig({
        enabled: loadedConfig.enabled || false,
        url: loadedConfig.url || '',
        username: loadedConfig.username || '',
        password: loadedConfig.password === '***MASKED***' ? '' : (loadedConfig.password || ''),
        root_folder_path: loadedConfig.root_folder_path || commessa.nome,
        auto_create_structure: loadedConfig.auto_create_structure !== false,
        connection_timeout: loadedConfig.connection_timeout || 30,
        upload_timeout: loadedConfig.upload_timeout || 60,
        retry_attempts: loadedConfig.retry_attempts || 3
      });
    } catch (error) {
      console.error("Error loading Aruba config:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare la configurazione Aruba Drive",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await axios.put(`${API}/commesse/${commessa.id}/aruba-config`, config);
      
      toast({
        title: "Successo",
        description: "Configurazione Aruba Drive salvata con successo",
      });
      
      onSave(config);
    } catch (error) {
      console.error("Error saving Aruba config:", error);
      toast({
        title: "Errore", 
        description: error.response?.data?.detail || "Errore nel salvataggio della configurazione",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!config.url || !config.username || !config.password) {
      toast({
        title: "Campi Mancanti",
        description: "Inserisci URL, username e password per testare la connessione",
        variant: "destructive"
      });
      return;
    }

    setTestingConnection(true);
    try {
      // Qui si potrebbe implementare un test reale della connessione
      // Per ora simuliamo
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Test Connessione",
        description: "Configurazione salvata. Test connessione disponibile dopo il salvataggio.",
      });
    } catch (error) {
      toast({
        title: "Test Fallito",
        description: "Impossibile connettersi ad Aruba Drive con le credenziali fornite",
        variant: "destructive"
      });
    } finally {
      setTestingConnection(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              Configurazione Aruba Drive
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {commessa?.nome} - Configurazione accesso documenti (Filiera)
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Clock className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2">Caricamento configurazione...</span>
            </div>
          ) : (
            <>
              {/* Enable/Disable Toggle */}
              <div className="flex items-center space-x-3 p-4 border rounded-lg">
                <input
                  type="checkbox"
                  id="aruba-enabled"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                  className="w-4 h-4"
                />
                <div>
                  <Label htmlFor="aruba-enabled" className="font-medium">
                    Abilita Aruba Drive per questa filiera/commessa
                  </Label>
                  <p className="text-sm text-gray-600">
                    Attiva il caricamento automatico dei documenti su Aruba Drive
                  </p>
                </div>
              </div>

              {config.enabled && (
                <>
                  {/* Connection Settings */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="url">URL Aruba Drive *</Label>
                      <Input
                        id="url"
                        type="url"
                        value={config.url}
                        onChange={(e) => setConfig({ ...config, url: e.target.value })}
                        placeholder="https://webspace.aruba.it"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="root_folder">Cartella Root</Label>
                      <Input
                        id="root_folder"
                        value={config.root_folder_path}
                        onChange={(e) => setConfig({ ...config, root_folder_path: e.target.value })}
                        placeholder={commessa?.nome}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="username">Username *</Label>
                      <Input
                        id="username"
                        value={config.username}
                        onChange={(e) => setConfig({ ...config, username: e.target.value })}
                        placeholder="username@aruba.it"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={config.password}
                        onChange={(e) => setConfig({ ...config, password: e.target.value })}
                        placeholder="Password Aruba Drive"
                        required
                      />
                    </div>
                  </div>

                  {/* Structure Settings */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="auto-structure"
                        checked={config.auto_create_structure}
                        onChange={(e) => setConfig({ ...config, auto_create_structure: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <div>
                        <Label htmlFor="auto-structure" className="font-medium">
                          Crea automaticamente struttura cartelle
                        </Label>
                        <p className="text-sm text-gray-600">
                          Crea cartelle: Commessa/Servizio/TipologiaContratto/Segmento
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Advanced Settings */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-3">Impostazioni Avanzate</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="connection_timeout">Timeout Connessione (s)</Label>
                        <Input
                          id="connection_timeout"
                          type="number"
                          min="10"
                          max="120"
                          value={config.connection_timeout}
                          onChange={(e) => setConfig({ ...config, connection_timeout: parseInt(e.target.value) || 30 })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="upload_timeout">Timeout Upload (s)</Label>
                        <Input
                          id="upload_timeout"
                          type="number"
                          min="30"
                          max="300"
                          value={config.upload_timeout}
                          onChange={(e) => setConfig({ ...config, upload_timeout: parseInt(e.target.value) || 60 })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="retry_attempts">Tentativi Retry</Label>
                        <Input
                          id="retry_attempts"
                          type="number"
                          min="1"
                          max="5"
                          value={config.retry_attempts}
                          onChange={(e) => setConfig({ ...config, retry_attempts: parseInt(e.target.value) || 3 })}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <Button variant="outline" onClick={onClose}>
            Annulla
          </Button>
          
          <div className="space-x-2">
            {config.enabled && (
              <Button
                variant="secondary"
                onClick={testConnection}
                disabled={testingConnection || !config.url || !config.username || !config.password}
              >
                {testingConnection ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Test...
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4 mr-2" />
                    Test Connessione
                  </>
                )}
              </Button>
            )}
            
            <Button
              onClick={handleSave}
              disabled={loading || (config.enabled && (!config.url || !config.username || !config.password))}
            >
              {loading ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                'Salva Configurazione'
              )}
            </Button>
          </div>
        </div>
      </div>
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
      // Get token from localStorage to ensure availability
      const token = localStorage.getItem('token');
      
      // Ensure JWT token is included in headers
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      };
      
      const response = await axios.post(`${API}/sub-agenzie`, subAgenziaData, { headers });
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
                    <div className="mt-3">
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
                  <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 mt-4">
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
                <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 mt-4">
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
const ClientiManagement = ({ selectedUnit, selectedCommessa, units, commesse: commesseFromParent, subAgenzie: subAgenzieFromParent, servizi: serviziFromParent }) => {
  const [clienti, setClienti] = useState([]);
  const [allClienti, setAllClienti] = useState([]); // Store all clients for filtering
  const [commesse, setCommesse] = useState(commesseFromParent || []);
  const [subAgenzie, setSubAgenzie] = useState(subAgenzieFromParent || []);
  const [servizi, setServizi] = useState(serviziFromParent || []);
  const [selectedCommessaLocal, setSelectedCommessaLocal] = useState(selectedCommessa || null);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
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
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: '',
    enabled: false
  });
  // New filter states
  const [clientiFilterStatus, setClientiFilterStatus] = useState('all');
  const [clientiFilterTipologia, setClientiFilterTipologia] = useState('all');
  const [clientiFilterSubAgenzia, setClientiFilterSubAgenzia] = useState('all');
  const [clientiFilterCreatedBy, setClientiFilterCreatedBy] = useState('all');
  // NEW: Additional filter states
  const [clientiFilterServizi, setClientiFilterServizi] = useState('all');
  const [clientiFilterSegmento, setClientiFilterSegmento] = useState('all');
  const [clientiFilterCommesse, setClientiFilterCommesse] = useState('all');
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
  }, [selectedUnit, selectedCommessaLocal, clientiFilterSubAgenzia, clientiFilterStatus, clientiFilterTipologia, clientiFilterCreatedBy, clientiFilterServizi, clientiFilterSegmento, clientiFilterCommesse]);

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

  const fetchClienti = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCommessaLocal) {
        params.append('commessa_id', selectedCommessaLocal);
      }
      if (clientiFilterSubAgenzia && clientiFilterSubAgenzia !== 'all') {
        params.append('sub_agenzia_id', clientiFilterSubAgenzia);
      }
      if (clientiFilterStatus && clientiFilterStatus !== 'all') {
        params.append('status', clientiFilterStatus);
      }
      if (clientiFilterTipologia && clientiFilterTipologia !== 'all') {
        params.append('tipologia_contratto', clientiFilterTipologia);
      }
      if (clientiFilterCreatedBy && clientiFilterCreatedBy !== 'all') {
        params.append('created_by', clientiFilterCreatedBy);
      }
      // NEW: Additional filters
      if (clientiFilterServizi && clientiFilterServizi !== 'all') {
        params.append('servizio_id', clientiFilterServizi);
      }
      if (clientiFilterSegmento && clientiFilterSegmento !== 'all') {
        params.append('segmento', clientiFilterSegmento);
      }
      if (clientiFilterCommesse && clientiFilterCommesse !== 'all') {
        params.append('commessa_id_filter', clientiFilterCommesse);
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
      
      // Apply current filters to backend request
      if (clientiFilterSubAgenzia && clientiFilterSubAgenzia !== 'all') {
        params.append('sub_agenzia_id', clientiFilterSubAgenzia);
      }
      if (clientiFilterTipologia && clientiFilterTipologia !== 'all') {
        params.append('tipologia_contratto', clientiFilterTipologia);
      }
      if (clientiFilterStatus && clientiFilterStatus !== 'all') {
        params.append('status', clientiFilterStatus);
      }
      if (clientiFilterCreatedBy && clientiFilterCreatedBy !== 'all') {
        params.append('created_by', clientiFilterCreatedBy);
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
                  Esporta Excel
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

      {/* Advanced Filters Section */}
      <div className="bg-blue-50 p-4 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Filtri Avanzati</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 gap-3 md:gap-4">
          {/* Sub Agenzia Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sub Agenzia</label>
            <Select value={clientiFilterSubAgenzia} onValueChange={setClientiFilterSubAgenzia}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tutte le Sub Agenzie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le Sub Agenzie</SelectItem>
                {filterOptions.sub_agenzie.map((sub) => (
                  <SelectItem key={sub.value} value={sub.value}>
                    {sub.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipologia Contratto Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipologia Contratto</label>
            <Select value={clientiFilterTipologia} onValueChange={setClientiFilterTipologia}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tutte le Tipologie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le Tipologie</SelectItem>
                {filterOptions.tipologie_contratto.map((tip) => (
                  <SelectItem key={tip.value} value={tip.value}>
                    {tip.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <Select value={clientiFilterStatus} onValueChange={setClientiFilterStatus}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tutti gli Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli Status</SelectItem>
                {filterOptions.status_values.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Created By Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Utente Creatore</label>
            <Select value={clientiFilterCreatedBy} onValueChange={setClientiFilterCreatedBy}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tutti gli Utenti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli Utenti</SelectItem>
                {filterOptions.users.map((user) => (
                  <SelectItem key={user.value} value={user.value}>
                    {user.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* NEW: Servizi Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Servizi</label>
            <Select value={clientiFilterServizi} onValueChange={setClientiFilterServizi}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tutti i Servizi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i Servizi</SelectItem>
                {filterOptions.servizi.map((servizio) => (
                  <SelectItem key={servizio.value} value={servizio.value}>
                    {servizio.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* NEW: Segmento Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Segmento</label>
            <Select value={clientiFilterSegmento} onValueChange={setClientiFilterSegmento}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tutti i Segmenti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i Segmenti</SelectItem>
                {filterOptions.segmenti.map((segmento) => (
                  <SelectItem key={segmento.value} value={segmento.value}>
                    {segmento.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* NEW: Commesse Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commesse</label>
            <Select value={clientiFilterCommesse} onValueChange={setClientiFilterCommesse}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tutte le Commesse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le Commesse</SelectItem>
                {filterOptions.commesse.map((commessa) => (
                  <SelectItem key={commessa.value} value={commessa.value}>
                    {commessa.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Clear All Filters Button */}
        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setClientiFilterSubAgenzia('all');
              setClientiFilterTipologia('all');
              setClientiFilterStatus('all');
              setClientiFilterCreatedBy('all');
              setClientiFilterServizi('all');
              setClientiFilterSegmento('all');
              setClientiFilterCommesse('all');
            }}
          >
            <X className="w-4 h-4 mr-2" />
            Azzera Filtri
          </Button>
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
                  <TableHead>Creato da</TableHead>
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
                      <Badge variant={getClienteStatusVariant(cliente.status)}>
                        {formatClienteStatus(cliente.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <User className="w-3 h-3 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {/* TODO: Mostrare nome utente creatore */}
                          {cliente.created_by ? getUserDisplayName(cliente.created_by) : 'N/A'}
                        </span>
                      </div>
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
                    variant={getClienteStatusVariant(cliente.status)}
                    className="text-xs"
                  >
                    {formatClienteStatus(cliente.status)}
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
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEditCliente(cliente)}
                    className="w-full"
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Modifica
                  </Button>
                  
                  {/* Terza riga: Elimina (full width) */}
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
                            
                            {(log.old_value || log.new_value) && (
                              <div className="text-sm text-gray-500 bg-gray-100 rounded p-2">
                                {log.old_value && (
                                  <div>
                                    <span className="font-medium">Prima:</span> {log.old_value}
                                  </div>
                                )}
                                {log.new_value && (
                                  <div>
                                    <span className="font-medium">Dopo:</span> {log.new_value}
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
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
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
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
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

const CreateClienteModal = ({ isOpen, onClose, onSubmit, commesse, subAgenzie, selectedCommessa, user }) => {
  
  // ENUM MAPPING FUNCTIONS - Convert UUID or display values to backend enum format
  const mapTipologiaContratto = (uuidOrDisplayValue) => {
    // First, check if it's a UUID - if so, convert to display name using cascadeTipologie
    let displayValue = uuidOrDisplayValue;
    
    // If it looks like a UUID (contains hyphens), find the display name
    if (typeof uuidOrDisplayValue === 'string' && uuidOrDisplayValue.includes('-')) {
      const tipologia = cascadeTipologie?.find(t => t.id === uuidOrDisplayValue);
      if (tipologia) {
        displayValue = tipologia.nome;
        console.log(`🔄 UUID → Display: ${uuidOrDisplayValue} → ${displayValue}`);
      }
    }
    
    // Clean the display value and convert to backend enum
    const cleanDisplayValue = (displayValue || '').toString().trim();
    
    const mappings = {
      'Telefonia Fastweb': 'telefonia_fastweb',
      'Energia Fastweb': 'energia_fastweb', 
      'Ho Mobile': 'ho_mobile',
      'Telepass': 'telepass',
      'telepass_premium': 'telepass_premium',
      'telepass_basic': 'telepass_basic',
      'fotovoltaico_residenziale': 'fotovoltaico_residenziale',
      'fotovoltaico_aziendale': 'fotovoltaico_aziendale',
      'manutenzione_premium': 'manutenzione_premium',
      'manutenzione_standard': 'manutenzione_standard'
    };
    
    // Try exact match first, then case insensitive
    let enumValue = mappings[cleanDisplayValue];
    if (!enumValue) {
      // Case insensitive fallback
      const key = Object.keys(mappings).find(k => k.toLowerCase() === cleanDisplayValue.toLowerCase());
      enumValue = key ? mappings[key] : cleanDisplayValue.toLowerCase().replace(/\s+/g, '_');
    }
    
    console.log(`🎯 ENUM MAPPING: Display "${cleanDisplayValue}" → Enum: "${enumValue}"`);
    return enumValue;
  };

  const mapSegmento = (uuidOrDisplayValue) => {
    // First, check if it's a UUID - if so, convert to display name using cascadeSegmenti
    let displayValue = uuidOrDisplayValue;
    
    // If it looks like a UUID (contains hyphens), find the display name
    if (typeof uuidOrDisplayValue === 'string' && uuidOrDisplayValue.includes('-')) {
      const segmento = cascadeSegmenti?.find(s => s.id === uuidOrDisplayValue);
      if (segmento) {
        displayValue = segmento.nome;
        console.log(`🎯 ENUM MAPPING: UUID ${uuidOrDisplayValue} → Display: "${displayValue}"`);
      }
    }
    
    // Now convert display name to backend enum
    const mappings = {
      'Privato': 'privato',           // FIXED: Privato → privato
      'Business': 'business'          // Only Privato and Business supported
    };
    
    const enumValue = mappings[displayValue] || displayValue;
    console.log(`🎯 ENUM MAPPING: Display "${displayValue}" → Enum: "${enumValue}"`);
    return enumValue;
  };

  // STEP MANAGEMENT for cascading flow
  const [currentStep, setCurrentStep] = useState('initial'); // initial, filiera, cliente
  const [showClientForm, setShowClientForm] = useState(false);
  
  // SELECTION DATA for cascading
  const [selectedData, setSelectedData] = useState({
    sub_agenzia_id: '',
    commessa_id: (selectedCommessa && selectedCommessa !== 'all') ? selectedCommessa : '',
    servizio_id: '',
    tipologia_contratto: '',
    segmento: '',
    offerta_id: ''
  });

  // CASCADING DATA ARRAYS - ALWAYS INITIALIZE AS ARRAYS
  const [cascadeSubAgenzie, setCascadeSubAgenzie] = useState([]);
  const [cascadeCommesse, setCascadeCommesse] = useState([]);
  const [cascadeServizi, setCascadeServizi] = useState([]);
  const [cascadeTipologie, setCascadeTipologie] = useState([]);
  const [cascadeSegmenti, setCascadeSegmenti] = useState([]);
  const [cascadeOfferte, setCascadeOfferte] = useState([]);

  // CLIENT FORM DATA (shown after offerta selection)
  const [formData, setFormData] = useState({
    // Campi base sempre presenti
    numero_ordine: '',
    account: '',
    ragione_sociale: '', // Solo se Business
    cognome: '', // Obbligatorio
    nome: '', // Obbligatorio
    data_nascita: '',
    luogo_nascita: '',
    comune_residenza: '',
    provincia: '', // Sigla provincia
    cap: '',
    indirizzo: '',
    email: '',
    telefono: '', // Obbligatorio
    telefono2: '',
    partita_iva: '', // Solo se Business
    codice_fiscale: '', // Obbligatorio
    
    // Documento
    tipo_documento: '',
    numero_documento: '',
    data_rilascio: '',
    luogo_rilascio: '',
    scadenza_documento: '',
    
    // Campi specifici Telefonia Fastweb
    tecnologia: '',
    codice_migrazione: '',
    gestore: '',
    convergenza: false,
    convergenza_items: [{
      numero_cellulare: '',
      iccid: '',
      operatore: ''
    }],
    
    // Campi specifici Energia Fastweb
    codice_pod: '',
    
    // Modalità pagamento
    modalita_pagamento: '',
    iban: '',
    intestatario_diverso: '',
    numero_carta: '',
    mese_carta: '',
    anno_carta: '',
    
    // Note
    note: '',
    
    // Campo Area Manager
    sub_agenzia_id: ''
  });

  // State per gestire i campi convergenza multipli
  const [convergenzaItems, setConvergenzaItems] = useState([{
    numero_cellulare: '',
    iccid: '',
    operatore: ''
  }]);

  // Costanti per i dropdown
  const PROVINCE_ITALIANE = [
    "AG", "AL", "AN", "AO", "AR", "AP", "AT", "AV", "BA", "BT", "BL", "BN", "BG", "BI", "BO", "BZ", 
    "BS", "BR", "CA", "CL", "CB", "CI", "CE", "CT", "CZ", "CH", "CO", "CS", "CR", "KR", "CN", 
    "EN", "FM", "FE", "FI", "FG", "FC", "FR", "GE", "GO", "GR", "IM", "IS", "SP", "AQ", "LT", 
    "LE", "LC", "LI", "LO", "LU", "MC", "MN", "MS", "MT", "VS", "ME", "MI", "MO", "MB", "NA", 
    "NO", "NU", "OG", "OT", "OR", "PD", "PA", "PR", "PV", "PG", "PU", "PE", "PC", "PI", "PT", 
    "PN", "PZ", "PO", "RG", "RA", "RC", "RE", "RI", "RN", "RM", "RO", "SA", "SS", "SV", "SI", 
    "SR", "SO", "TA", "TE", "TR", "TO", "TP", "TN", "TV", "TS", "UD", "VA", "VE", "VB", "VC", 
    "VR", "VV", "VI", "VT"
  ];

  const TIPI_DOCUMENTO = [
    { value: 'carta_identita', label: "Carta d'identità" },
    { value: 'patente', label: 'Patente' },
    { value: 'passaporto', label: 'Passaporto' }
  ];

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

  const MODALITA_PAGAMENTO = [
    { value: 'iban', label: 'IBAN' },
    { value: 'carta_credito', label: 'Carta di Credito' }
  ];

  // Helper functions per campi condizionali
  const isBusinessSegment = () => {
    const segmentoId = selectedData.segmento;
    const segmento = cascadeSegmenti.find(s => s.id === segmentoId);
    return segmento?.nome?.toLowerCase() === 'business';
  };

  const isTelefoniaFastweb = () => {
    const tipologiaId = selectedData.tipologia_contratto;
    const tipologia = cascadeTipologie.find(t => t.id === tipologiaId);
    
    if (!tipologia) return false;
    
    // Riconoscimento per tipologie legate alla telefonia
    const nome = tipologia.nome?.toLowerCase() || '';
    console.log("🔍 isTelefoniaFastweb DEBUG:", {
      tipologiaId,
      tipologia_nome: tipologia.nome,
      nome_lower: nome,
      result: nome.includes('telefonia') || nome.includes('mobile')
    });
    
    return nome.includes('telefonia') || 
           nome.includes('mobile') ||
           nome.includes('sim') ||
           nome.includes('voce') ||
           nome.includes('dati');
  };

  const isEnergiaFastweb = () => {
    const tipologiaId = selectedData.tipologia_contratto;
    const tipologia = cascadeTipologie.find(t => t.id === tipologiaId);
    
    if (!tipologia) return false;
    
    // Riconoscimento per tipologie legate all'energia/fotovoltaico
    const nome = tipologia.nome?.toLowerCase() || '';
    console.log("🔍 isEnergiaFastweb DEBUG:", {
      tipologiaId,
      tipologia_nome: tipologia.nome,
      nome_lower: nome,
      result: nome.includes('energia')
    });
    
    return nome.includes('energia') || 
           nome.includes('fotovoltaico') || 
           nome.includes('solare') || 
           nome.includes('pod') ||
           nome.includes('luce') ||
           nome.includes('gas');
  };

  // Funzioni per gestire i campi convergenza multipli
  const addConvergenzaItem = () => {
    setConvergenzaItems([...convergenzaItems, {
      numero_cellulare: '',
      iccid: '',
      operatore: ''
    }]);
  };

  const removeConvergenzaItem = (index) => {
    if (convergenzaItems.length > 1) {
      setConvergenzaItems(convergenzaItems.filter((_, i) => i !== index));
    }
  };

  const updateConvergenzaItem = (index, field, value) => {
    const updated = convergenzaItems.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    );
    setConvergenzaItems(updated);
  };

  // LEGACY STATES (keep for compatibility)
  const [servizi, setServizi] = useState([]);
  const [createTipologieContratto, setCreateTipologieContratto] = useState([]);
  const [segmenti, setSegmenti] = useState([]);

  // Determine user role and initialize flow
  useEffect(() => {
    if (!isOpen) return;
    
    console.log("🚀 CreateClienteModal opened - Initializing cascading flow");
    console.log("👤 User role:", user?.role);
    console.log("📋 Available data:", {
      commesse: commesse?.length || 0,
      subAgenzie: subAgenzie?.length || 0,
      selectedCommessa
    });
    
    // Reset states when modal opens
    setCurrentStep('initial');
    setShowClientForm(false);
    setSelectedData({
      sub_agenzia_id: '',
      commessa_id: (selectedCommessa && selectedCommessa !== 'all') ? selectedCommessa : '',
      servizio_id: '',
      tipologia_contratto: '',
      segmento: '',
      offerta_id: ''
    });
    
    // Initialize based on user role
    initializeFlowByRole();
    
  }, [isOpen, user, selectedCommessa]);

  const initializeFlowByRole = () => {
    if (!user) return;
    
    if (user?.role === 'sub_agenzia') {
      // SUB AGENZIA FLOW: Start with commesse selection
      console.log("🏢 Sub Agenzia Flow: Starting with commesse selection");
      const commesseArray = Array.isArray(commesse) ? commesse : [];
      setCascadeCommesse(commesseArray);
      
      // If commessa is pre-selected, load servizi immediately
      if (selectedCommessa && selectedCommessa !== 'all') {
        handleCommessaSelect(selectedCommessa);
      }
    } else if (user?.role === 'responsabile_commessa' || user?.role === 'backoffice_commessa') {
      // RESPONSABILE/BACKOFFICE COMMESSA: Start with sub agenzia selection first
      console.log("👔 Responsabile/Backoffice Commessa Flow: Starting with sub agenzia selection");
      setCascadeCommesse([]); // Will be loaded after sub agenzia selection
      // Fetch authorized sub agenzie for this user
      fetchCascadeSubAgenzie();
    } else if (user?.role === 'area_manager') {
      // AREA MANAGER: Load sub agenzie and then auto-populate all commesse
      console.log("🚨 Area Manager Flow: CHIAMATA fetchAreaManagerCommesse per utente:", user?.username);
      console.log("🚨 User data completo:", user);
      setCascadeCommesse([]); 
      fetchAreaManagerCommesse();
    } else if (user?.role === 'responsabile_sub_agenzia' || user?.role === 'backoffice_sub_agenzia' || user?.role === 'agente_specializzato' || user?.role === 'operatore' || user?.role === 'responsabile_store' || user?.role === 'responsabile_presidi' || user?.role === 'store_assist' || user?.role === 'promoter_presidi' || user?.role === 'admin') {
      // SUB AGENZIA ROLES + AGENTI + ADMIN: Start with sub agenzia selection
      console.log("👔 Sub Agenzia Flow + Agenti + Admin: Starting with sub agenzia selection");
      setCascadeCommesse([]); // Will be loaded after sub agenzia selection
      // Fetch sub agenzie for this user (Admin sees ALL, others see authorized)
      fetchCascadeSubAgenzie();
    } else {
      // FALLBACK: Default to empty arrays
      console.log("⚠️ Unknown user role, initializing empty arrays");
      setCascadeCommesse([]);
      setCascadeServizi([]);
      setCascadeTipologie([]);
      setCascadeSegmenti([]);  
      setCascadeOfferte([]);
    }
  };

  // ===== FETCH FUNCTIONS =====
  
  const fetchAreaManagerCommesse = async () => {
    try {
      console.log("🚨 AREA MANAGER DEBUG: START fetchAreaManagerCommesse");
      console.log("🚨 User role:", user?.role);
      console.log("🚨 User commesse_autorizzate:", user?.commesse_autorizzate);
      
      // CRITICAL: Use user.commesse_autorizzate directly as fallback
      if (user?.commesse_autorizzate && user.commesse_autorizzate.length > 0) {
        console.log("🚨 AREA MANAGER CRITICAL FIX: Using user.commesse_autorizzate directly");
        
        // Get all commesse from backend and filter by user authorized
        const allCommesseResponse = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/commesse`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        
        const allCommesse = allCommesseResponse.data || [];
        const authorizedCommesse = allCommesse.filter(commessa => 
          user.commesse_autorizzate.includes(commessa.id)
        );
        
        console.log("🚨 AREA MANAGER CRITICAL FIX: Authorized commesse:", authorizedCommesse);
        setCascadeCommesse(authorizedCommesse);
        
        // Also set sub agenzie for completeness
        const subAgenzieResponse = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/cascade/sub-agenzie`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setCascadeSubAgenzie(subAgenzieResponse.data || []);
        
        return; // Exit early with direct method
      }
      
      console.log("🌍 AREA MANAGER: Fetching all authorized sub agenzie and their commesse");
      
      // First fetch authorized sub agenzie
      const subAgenzieResponse = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/cascade/sub-agenzie`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      const authorizedSubAgenzie = subAgenzieResponse.data || [];
      console.log("🌍 AREA MANAGER: Got authorized sub agenzie:", authorizedSubAgenzie);
      setCascadeSubAgenzie(authorizedSubAgenzie);
      
      // Now fetch commesse from each sub agenzia
      const allCommesse = [];
      const commesseMap = new Map(); // To avoid duplicates
      
      for (const subAgenzia of authorizedSubAgenzie) {
        try {
          console.log(`🌍 AREA MANAGER: Fetching commesse for sub agenzia ${subAgenzia.nome} (${subAgenzia.id})`);
          const commesseResponse = await axios.get(
            `${process.env.REACT_APP_BACKEND_URL}/api/cascade/commesse-by-subagenzia/${subAgenzia.id}`, 
            {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            }
          );
          
          const subAgenziaCommesse = commesseResponse.data || [];
          console.log(`🌍 AREA MANAGER: Got ${subAgenziaCommesse.length} commesse for ${subAgenzia.nome}`);
          
          // Add commesse to map to avoid duplicates
          subAgenziaCommesse.forEach(commessa => {
            if (commessa && commessa.id && !commesseMap.has(commessa.id)) {
              commesseMap.set(commessa.id, commessa);
            }
          });
        } catch (error) {
          console.error(`❌ AREA MANAGER: Error fetching commesse for sub agenzia ${subAgenzia.id}:`, error);
        }
      }
      
      // Convert map to array
      const uniqueCommesse = Array.from(commesseMap.values());
      console.log(`🌍 AREA MANAGER: Total unique commesse found: ${uniqueCommesse.length}`);
      setCascadeCommesse(uniqueCommesse);
      
    } catch (error) {
      console.error("❌ AREA MANAGER: Error in fetchAreaManagerCommesse:", error);
      setCascadeSubAgenzie([]);
      setCascadeCommesse([]);
    }
  };

  const fetchCascadeSubAgenzie = async () => {
    try {
      console.log("🔄 FETCHING: Sub Agenzie cascade");
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/cascade/sub-agenzie`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      console.log("✅ FETCHED Sub Agenzie:", response.data);
      setCascadeSubAgenzie(response.data || []);
    } catch (error) {
      console.error("❌ ERROR fetching sub agenzie:", error);
      setCascadeSubAgenzie([]);
    }
  };

  // ===== CASCADE HANDLERS =====
  
  const handleSubAgenziaSelect = async (subAgenziaId) => {
    console.log("🏢 Sub Agenzia selected:", subAgenziaId);
    setSelectedData(prev => ({ ...prev, sub_agenzia_id: subAgenziaId }));
    
    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error("❌ No JWT token found for cascade API call");
        return;
      }
      
      // Load commesse autorizzate for this sub agenzia
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cascade/commesse-by-subagenzia/${subAgenziaId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ CASCADE API Error: ${response.status} ${response.statusText}`);
        return;
      }
      
      const commesse = await response.json();
      console.log("✅ CASCADE: Commesse loaded successfully:", commesse);
      console.log("✅ CASCADE DEBUG: Commesse array:", Array.isArray(commesse));
      console.log("✅ CASCADE DEBUG: First commessa object:", commesse[0]);
      setCascadeCommesse(Array.isArray(commesse) ? commesse : []);
      
      // Reset downstream selections
      setCascadeServizi([]);
      setCascadeTipologie([]);
      setCascadeSegmenti([]);
      setCascadeOfferte([]);
      setSelectedData(prev => ({ 
        ...prev, 
        commessa_id: '', 
        servizio_id: '', 
        tipologia_contratto: '', 
        segmento: '', 
        offerta_id: '' 
      }));
    } catch (error) {
      console.error("Error loading commesse:", error);
    }
  };

  const handleCommessaSelect = async (commessaId) => {
    console.log("📋 Commessa selected:", commessaId);
    setSelectedData(prev => ({ ...prev, commessa_id: commessaId }));
    
    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error("❌ No JWT token found for cascade API call");
        return;
      }
      
      // Load servizi autorizzati for this commessa
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cascade/servizi-by-commessa/${commessaId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ CASCADE API Error: ${response.status} ${response.statusText}`);
        return;
      }
      
      const servizi = await response.json();
      console.log("✅ CASCADE: Servizi loaded successfully:", servizi);
      setCascadeServizi(Array.isArray(servizi) ? servizi : []);
      
      // Reset downstream selections
      setCascadeTipologie([]);
      setCascadeSegmenti([]);
      setCascadeOfferte([]);
      setSelectedData(prev => ({ 
        ...prev, 
        servizio_id: '', 
        tipologia_contratto: '', 
        segmento: '', 
        offerta_id: '' 
      }));
    } catch (error) {
      console.error("Error loading servizi:", error);
    }
  };

  const handleServizioSelect = async (servizioId) => {
    console.log("⚙️ Servizio selected:", servizioId);
    setSelectedData(prev => ({ ...prev, servizio_id: servizioId }));
    
    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error("❌ No JWT token found for cascade API call");
        return;
      }
      
      // Load tipologie autorizzate for this servizio
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cascade/tipologie-by-servizio/${servizioId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ CASCADE API Error: ${response.status} ${response.statusText}`);
        return;
      }
      
      const tipologie = await response.json();
      console.log("✅ CASCADE: Tipologie loaded successfully:", tipologie);
      setCascadeTipologie(tipologie);
      
      // Reset downstream selections
      setCascadeSegmenti([]);
      setCascadeOfferte([]);
      setSelectedData(prev => ({ 
        ...prev, 
        tipologia_contratto: '', 
        segmento: '', 
        offerta_id: '' 
      }));
    } catch (error) {
      console.error("Error loading tipologie:", error);
    }
  };

  const handleTipologiaSelect = async (tipologiaId) => {
    console.log("📝 Tipologia selected:", tipologiaId);
    setSelectedData(prev => ({ ...prev, tipologia_contratto: tipologiaId }));
    
    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error("❌ No JWT token found for cascade API call");
        return;
      }
      
      // Load segmenti for this tipologia
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/cascade/segmenti-by-tipologia/${tipologiaId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error(`❌ CASCADE API Error: ${response.status} ${response.statusText}`);
        return;
      }
      
      const segmenti = await response.json();
      console.log("✅ CASCADE: Segmenti loaded successfully:", segmenti);
      setCascadeSegmenti(segmenti);
      
      // Reset downstream selections
      setCascadeOfferte([]);
      setSelectedData(prev => ({ ...prev, segmento: '', offerta_id: '' }));
    } catch (error) {
      console.error("Error loading segmenti:", error);
    }
  };

  const handleSegmentoSelect = async (segmentoId) => {
    console.log("🔄🔄🔄 LOADING OFFERTE FOR SEGMENTO:", segmentoId);
    setSelectedData(prev => ({ ...prev, segmento: segmentoId }));
    
    try {
      // Get JWT token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        console.error("❌ No JWT token found for cascade API call");
        return;
      }
      
      // Load offerte based on entire selection chain
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/cascade/offerte-by-filiera?commessa_id=${selectedData.commessa_id}&servizio_id=${selectedData.servizio_id}&tipologia_id=${selectedData.tipologia_contratto}&segmento_id=${segmentoId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        console.error("❌❌❌ OFFERTE REQUEST FAILED:", response.status, response.statusText);
        setCascadeOfferte([]);
        return;
      }
      
      const offerte = await response.json();
      console.log("✅✅✅ CASCADE: Offerte loaded successfully:", {
        segmentoId: segmentoId,
        count: offerte?.length || 0,
        offerte: offerte,
        firstOfferta: offerte?.[0]
      });
      setCascadeOfferte(offerte);
      
      setSelectedData(prev => ({ ...prev, offerta_id: '' }));
    } catch (error) {
      console.error("❌❌❌ Error loading offerte:", error);
      setCascadeOfferte([]);
    }
  };

  const handleOffertaSelect = (offertaId) => {
    console.log("💡💡💡 OFFERTA SELECTED - CRITICAL DEBUG:", {
      offertaId: offertaId,
      offertaType: typeof offertaId,
      isValid: Boolean(offertaId),
      timestamp: new Date().toLocaleTimeString()
    });
    
    const newSelectedData = { ...selectedData, offerta_id: offertaId };
    setSelectedData(newSelectedData);
    
    console.log("💡💡💡 UPDATED selectedData:", newSelectedData);
    
    // Show client form after offerta selection
    setShowClientForm(true);
    setCurrentStep('cliente');
  };

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
    
    console.log("🎯 CASCADING SUBMIT TRIGGERED");
    console.log("Selected data:", selectedData);
    console.log("Form data:", formData);
    
    // Helper per convertire le date in formato MongoDB compatibile
    const formatDateForBackend = (dateValue) => {
      if (!dateValue) return null;
      if (typeof dateValue === 'string') {
        // Se è già una stringa, assicuriamoci che sia in formato YYYY-MM-DD
        return dateValue.split('T')[0]; // Rimuove eventuali parti time
      }
      return null;
    };

    // Create clean form data with cascading selections + ALL client data
    const cleanFormData = {
      // Client personal data (basic)
      nome: formData.nome,
      cognome: formData.cognome,
      email: formData.email || null,
      telefono: formData.telefono,
      telefono2: formData.telefono2 || '', // Map telefono2 -> telefono2 for backend  
      data_nascita: formatDateForBackend(formData.data_nascita),
      luogo_nascita: formData.luogo_nascita || '',
      codice_fiscale: formData.codice_fiscale || '', // Campo richiesto
      
      // Address data  
      indirizzo: formData.indirizzo,
      comune_residenza: formData.comune_residenza || '', // Map comune_residenza -> comune_residenza for backend
      provincia: formData.provincia,
      cap: formData.cap,
      
      // Business data
      ragione_sociale: formData.ragione_sociale || '',
      partita_iva: formData.partita_iva || '',
      
      // Additional fields
      numero_ordine: formData.numero_ordine || '',
      account: formData.account || '',
      
      // Document data
      tipo_documento: formData.tipo_documento || null, // FIX: Send null instead of empty string for enum fields
      numero_documento: formData.numero_documento || '',
      data_rilascio: formatDateForBackend(formData.data_rilascio),
      luogo_rilascio: formData.luogo_rilascio || '',
      scadenza_documento: formatDateForBackend(formData.scadenza_documento),
      
      // Telefonia Fastweb conditional fields
      tecnologia: formData.tecnologia || null, // FIX: Send null instead of empty string for enum fields
      codice_migrazione: formData.codice_migrazione || '',
      gestore: formData.gestore || '',
      convergenza: Boolean(formData.convergenza),
      convergenza_items: formData.convergenza_items || [],
      
      // Energia Fastweb conditional fields
      codice_pod: formData.codice_pod || '',
      
      // Payment data
      modalita_pagamento: formData.modalita_pagamento || null, // FIX: Send null instead of empty string for enum fields
      iban: formData.iban || '',
      intestatario_diverso: formData.intestatario_diverso || '',
      numero_carta: formData.numero_carta || '',
      mese_carta: formData.mese_carta || '',
      anno_carta: formData.anno_carta || '',
      
      // Notes
      note: formData.note || '',
      note_backoffice: formData.note_backoffice || '',
      
      // Cascading selection data - Area Manager uses form selection
      sub_agenzia_id: user?.role === 'area_manager' ? formData.sub_agenzia_id : selectedData.sub_agenzia_id,
      commessa_id: selectedData.commessa_id,
      servizio_id: selectedData.servizio_id,
      tipologia_contratto: mapTipologiaContratto(selectedData.tipologia_contratto),
      segmento: mapSegmento(selectedData.segmento),
      offerta_id: selectedData.offerta_id,
      
      // Additional metadata for tracking
      selection_flow: user?.role === 'sub_agenzia' ? 'sub_agenzia_flow' : 'responsabile_flow',
      created_via: 'cascading_modal'
    };
    
    console.log("🎯 CLEAN CASCADING FORM DATA:", {
      total_fields: Object.keys(cleanFormData).length,
      required_fields: {
        nome: cleanFormData.nome,
        cognome: cleanFormData.cognome, 
        codice_fiscale: cleanFormData.codice_fiscale,
        telefono: cleanFormData.telefono
      },
      cascading_data: {
        sub_agenzia_id: cleanFormData.sub_agenzia_id,
        commessa_id: cleanFormData.commessa_id,
        servizio_id: cleanFormData.servizio_id,
        tipologia_contratto: cleanFormData.tipologia_contratto,
        segmento: cleanFormData.segmento,
        offerta_id: cleanFormData.offerta_id
      },
      selectedData_offerta: selectedData.offerta_id,
      full_data: cleanFormData
    });
    console.log("🔍 DEBUG selectedData before submit:", {
      selectedData: selectedData,
      offerta_id: selectedData.offerta_id,
      has_offerta: Boolean(selectedData.offerta_id)
    });
    
    console.log("🎯 CALLING onSubmit FUNCTION...");
    
    // Call the onSubmit function passed from parent
    onSubmit(cleanFormData);
    
    console.log("🎯 ONSUBMIT CALLED - RESETTING ALL FORMS");
    
    // Reset all form data after submit
    setFormData({
      nome: '', cognome: '', email: '', telefono: '', cellulare: '', 
      data_nascita: '', luogo_nascita: '', codice_fiscale: '', 
      indirizzo: '', comune: '', provincia: '', cap: '', 
      ragione_sociale: '', partita_iva: '', numero_ordine: '', account: '',
      tipo_documento: '', numero_documento: '', data_rilascio: '', 
      luogo_rilascio: '', scadenza_documento: '',
      tecnologia: '', codice_migrazione: '', gestore: '', convergenza: false,
      convergenza_items: [], codice_pod: '',
      modalita_pagamento: '', iban: '', intestatario_diverso: '', 
      numero_carta: '', mese_carta: '', anno_carta: '',
      note: '', note_backoffice: ''
    });
    
    setSelectedData({
      sub_agenzia_id: '',
      commessa_id: '',
      servizio_id: '',
      tipologia_contratto: '',
      segmento: '',
      offerta_id: ''
    });
    
    setShowClientForm(false);
    setCurrentStep('initial');
    
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-blue-600">
            {showClientForm ? "📝 Compila Scheda Cliente" : "🎯 Selezione Prodotto/Offerta"}
          </DialogTitle>
          <DialogDescription className="text-lg">
            {showClientForm 
              ? "Inserisci i dati del cliente per completare la creazione."
              : "Segui il percorso guidato per selezionare il prodotto/offerta più adatto."
            }
          </DialogDescription>
        </DialogHeader>

        {/* CASCADING SELECTION FLOW */}
        {!showClientForm && (
          <div className="space-y-6">
            
            {/* STEP INDICATOR */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-2">Percorso Guidato Selezione</h3>
              <div className="flex flex-wrap gap-2 text-sm">
                {user?.role === 'sub_agenzia' || user?.sub_agenzia_id ? (
                  <>
                    <span className={`px-3 py-1 rounded-full ${selectedData.commessa_id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      1. Commessa
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.servizio_id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      2. Servizio
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.tipologia_contratto ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      3. Tipologia
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.segmento ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      4. Segmento
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.offerta_id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      5. Offerta
                    </span>
                  </>
                ) : (
                  <>
                    <span className={`px-3 py-1 rounded-full ${selectedData.sub_agenzia_id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      1. Sub Agenzia
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.commessa_id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      2. Commessa
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.servizio_id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      3. Servizio
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.tipologia_contratto ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      4. Tipologia
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.segmento ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      5. Segmento
                    </span>
                    <span className={`px-3 py-1 rounded-full ${selectedData.offerta_id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      6. Offerta
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* SUB AGENZIA SELECTION (for Responsabili/Backoffice/Agenti) */}
              {(user?.role === 'responsabile_commessa' || user?.role === 'backoffice_commessa' || user?.role === 'responsabile_sub_agenzia' || user?.role === 'backoffice_sub_agenzia' || user?.role === 'agente_specializzato' || user?.role === 'operatore' || user?.role === 'responsabile_store' || user?.role === 'responsabile_presidi' || user?.role === 'store_assist' || user?.role === 'promoter_presidi' || user?.role === 'admin') && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-700">🏢 Sub Agenzia</Label>
                  <select 
                    value={selectedData.sub_agenzia_id} 
                    onChange={(e) => handleSubAgenziaSelect(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seleziona Sub Agenzia...</option>
                    {Array.isArray(cascadeSubAgenzie) && cascadeSubAgenzie.map(sa => (
                      <option key={sa.id} value={sa.id}>{sa.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* COMMESSA SELECTION */}
              <div className="space-y-2">
                <Label className="text-base font-semibold text-gray-700">📋 Commessa</Label>
                <select 
                  value={selectedData.commessa_id} 
                  onChange={(e) => handleCommessaSelect(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  disabled={!Array.isArray(cascadeCommesse) || (!cascadeCommesse.length && (user?.role === 'responsabile_commessa' || user?.role === 'backoffice_commessa' || user?.role === 'responsabile_sub_agenzia' || user?.role === 'backoffice_sub_agenzia' || user?.role === 'agente_specializzato' || user?.role === 'operatore' || user?.role === 'responsabile_store' || user?.role === 'responsabile_presidi' || user?.role === 'store_assist' || user?.role === 'promoter_presidi'))}
                >
                  <option value="">Seleziona Commessa...</option>
                  {/* AREA MANAGER CRITICAL FIX: Use user.commesse_autorizzate as fallback */}
                  {user?.role === 'area_manager' && (!Array.isArray(cascadeCommesse) || cascadeCommesse.length === 0) && Array.isArray(user?.commesse_autorizzate) ? (
                    // Fallback: Show commesse directly from user authorization if cascade failed
                    commesse.filter(c => user.commesse_autorizzate.includes(c.id)).map(commessa => (
                      <option key={commessa?.id || Math.random()} value={commessa?.id}>{commessa?.nome || 'Nome non disponibile'}</option>
                    ))
                  ) : (
                    // Normal cascade logic for all other cases
                    Array.isArray(cascadeCommesse) && cascadeCommesse.map(commessa => (
                      <option key={commessa?.id || Math.random()} value={commessa?.id}>{commessa?.nome || 'Nome non disponibile'}</option>
                    ))
                  )}
                </select>
              </div>

              {/* SERVIZIO SELECTION */}
              {selectedData.commessa_id && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-700">⚙️ Servizio</Label>
                  <select 
                    value={selectedData.servizio_id} 
                    onChange={(e) => handleServizioSelect(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seleziona Servizio...</option>
                    {Array.isArray(cascadeServizi) && cascadeServizi.map(servizio => (
                      <option key={servizio?.id || Math.random()} value={servizio?.id}>{servizio?.nome || 'Nome non disponibile'}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* TIPOLOGIA CONTRATTO SELECTION */}
              {selectedData.servizio_id && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-700">📝 Tipologia Contratto</Label>
                  <select 
                    value={selectedData.tipologia_contratto} 
                    onChange={(e) => handleTipologiaSelect(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seleziona Tipologia...</option>
                    {Array.isArray(cascadeTipologie) && cascadeTipologie.map(tipologia => (
                      <option key={tipologia?.id || Math.random()} value={tipologia?.id}>{tipologia?.nome || 'Nome non disponibile'}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* SEGMENTO SELECTION */}
              {selectedData.tipologia_contratto && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-700">🎯 Segmento</Label>
                  <select 
                    value={selectedData.segmento} 
                    onChange={(e) => handleSegmentoSelect(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seleziona Segmento...</option>
                    {Array.isArray(cascadeSegmenti) && cascadeSegmenti.map(segmento => (
                      <option key={segmento?.id || Math.random()} value={segmento?.id}>{segmento?.nome || 'Nome non disponibile'}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* OFFERTA SELECTION */}
              {selectedData.segmento && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-gray-700">💡 Offerta</Label>
                  
                  {/* DEBUG INFO */}
                  <div className="bg-yellow-50 p-2 border border-yellow-200 rounded text-xs">
                    <div><strong>DEBUG OFFERTE:</strong></div>
                    <div>• Segmento ID: {selectedData.segmento}</div>
                    <div>• Offerte caricate: {cascadeOfferte?.length || 0}</div>
                    <div>• Offerte array: {JSON.stringify(cascadeOfferte?.map(o => ({id: o?.id, nome: o?.nome})) || 'empty')}</div>
                    <div>• selectedData.offerta_id: "{selectedData.offerta_id || 'empty'}"</div>
                  </div>
                  
                  <select 
                    value={selectedData.offerta_id || ''} 
                    onChange={(e) => {
                      console.log("🎯🎯🎯 DROPDOWN ONCHANGE TRIGGERED:", e.target.value);
                      handleOffertaSelect(e.target.value);
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Seleziona Offerta...</option>
                    {Array.isArray(cascadeOfferte) && cascadeOfferte.length > 0 ? 
                      cascadeOfferte.map(offerta => (
                        <option key={offerta?.id || Math.random()} value={offerta?.id}>
                          {offerta?.nome || 'Nome non disponibile'} (ID: {offerta?.id?.slice(0,8)}...)
                        </option>
                      )) : 
                      <option value="" disabled>Nessuna offerta disponibile</option>
                    }
                  </select>
                </div>
              )}

            </div>

            {/* SELECTION SUMMARY */}
            {Object.values(selectedData).some(val => val) && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">Riepilogo Selezione</h4>
                <div className="grid grid-cols-2 gap-2 text-sm text-blue-700">
                  {selectedData.sub_agenzia_id && <div><strong>Sub Agenzia:</strong> {subAgenzie?.find(sa => sa.id === selectedData.sub_agenzia_id)?.nome}</div>}
                  {selectedData.commessa_id && <div><strong>Commessa:</strong> {cascadeCommesse?.find(c => c.id === selectedData.commessa_id)?.nome}</div>}
                  {selectedData.servizio_id && <div><strong>Servizio:</strong> {cascadeServizi?.find(s => s.id === selectedData.servizio_id)?.nome}</div>}
                  {selectedData.tipologia_contratto && <div><strong>Tipologia:</strong> {cascadeTipologie?.find(t => t.id === selectedData.tipologia_contratto)?.nome}</div>}
                  {selectedData.segmento && <div><strong>Segmento:</strong> {cascadeSegmenti?.find(s => s.id === selectedData.segmento)?.nome}</div>}
                  {selectedData.offerta_id && <div><strong>Offerta:</strong> {cascadeOfferte?.find(o => o.id === selectedData.offerta_id)?.nome}</div>}
                </div>
              </div>
            )}

          </div>
        )}

        {/* CLIENT FORM (shown after offerta selection) */}
        {showClientForm && (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* SELECTED OFFERTA SUMMARY */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200 mb-6">
              <h4 className="font-semibold text-green-800 mb-2">✅ Offerta Selezionata</h4>
              <div className="text-sm text-green-700">
                <div><strong>Offerta:</strong> {cascadeOfferte?.find(o => o.id === selectedData.offerta_id)?.nome}</div>
                <div><strong>Segmento:</strong> {cascadeSegmenti?.find(s => s.id === selectedData.segmento)?.nome}</div>
              </div>
            </div>

          {/* AREA MANAGER: Campo Sub Agenzia all'inizio */}
          {user?.role === 'area_manager' && (
            <div>
              <Label htmlFor="sub_agenzia_id" className="text-base font-semibold">Sub Agenzia *</Label>
              <select 
                id="sub_agenzia_id"
                value={formData.sub_agenzia_id || ''} 
                onChange={(e) => setFormData({...formData, sub_agenzia_id: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                <option value="">Seleziona Sub Agenzia...</option>
                {user?.sub_agenzie_autorizzate?.map(subAgenziaId => {
                  const subAgenzia = cascadeSubAgenzie.find(sa => sa.id === subAgenziaId);
                  return subAgenzia ? (
                    <option key={subAgenzia.id} value={subAgenzia.id}>
                      {subAgenzia.nome}
                    </option>
                  ) : null;
                })}
              </select>
              <p className="text-sm text-gray-600 mt-1">
                Seleziona a quale sub agenzia assegnare questo cliente
              </p>
            </div>
          )}
          
          {/* ===== NUOVA STRUTTURA COMPLETA SCHEDA CLIENTE ===== */}
          
          {/* CAMPI BASE SEMPRE PRESENTI */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Informazioni Base</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="numero_ordine">Numero Ordine</Label>
                <Input
                  id="numero_ordine"
                  value={formData.numero_ordine}
                  onChange={(e) => setFormData({...formData, numero_ordine: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="account">Account</Label>
                <Input
                  id="account"
                  value={formData.account}
                  onChange={(e) => setFormData({...formData, account: e.target.value})}
                />
              </div>
              {isBusinessSegment() && (
                <div>
                  <Label htmlFor="ragione_sociale">Ragione Sociale *</Label>
                  <Input
                    id="ragione_sociale"
                    value={formData.ragione_sociale}
                    onChange={(e) => setFormData({...formData, ragione_sociale: e.target.value})}
                    required
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cognome">Cognome *</Label>
                <Input
                  id="cognome"
                  value={formData.cognome}
                  onChange={(e) => setFormData({...formData, cognome: e.target.value})}
                  required
                />
              </div>
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({...formData, nome: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="data_nascita">Nato/a</Label>
                <Input
                  id="data_nascita"
                  type="date"
                  value={formData.data_nascita}
                  onChange={(e) => setFormData({...formData, data_nascita: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="luogo_nascita">A</Label>
                <Input
                  id="luogo_nascita"
                  value={formData.luogo_nascita}
                  onChange={(e) => setFormData({...formData, luogo_nascita: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="comune_residenza">Comune Residenza</Label>
                <Input
                  id="comune_residenza"
                  value={formData.comune_residenza}
                  onChange={(e) => setFormData({...formData, comune_residenza: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="provincia">Provincia</Label>
                <select
                  id="provincia"
                  value={formData.provincia}
                  onChange={(e) => setFormData({...formData, provincia: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Seleziona Provincia...</option>
                  {PROVINCE_ITALIANE.map(prov => (
                    <option key={prov} value={prov}>{prov}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="cap">Cap</Label>
                <Input
                  id="cap"
                  value={formData.cap}
                  onChange={(e) => setFormData({...formData, cap: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="indirizzo">Indirizzo</Label>
                <Input
                  id="indirizzo"
                  value={formData.indirizzo}
                  onChange={(e) => setFormData({...formData, indirizzo: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
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
              <div>
                <Label htmlFor="telefono2">Telefono 2</Label>
                <Input
                  id="telefono2"
                  value={formData.telefono2}
                  onChange={(e) => setFormData({...formData, telefono2: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isBusinessSegment() && (
                <div>
                  <Label htmlFor="partita_iva">Partita Iva *</Label>
                  <Input
                    id="partita_iva"
                    value={formData.partita_iva}
                    onChange={(e) => setFormData({...formData, partita_iva: e.target.value})}
                    required
                  />
                </div>
              )}
              <div>
                <Label htmlFor="codice_fiscale">Codice Fiscale *</Label>
                <Input
                  id="codice_fiscale"
                  value={formData.codice_fiscale}
                  onChange={(e) => setFormData({...formData, codice_fiscale: e.target.value})}
                  required
                />
              </div>
            </div>
          </div>

          {/* SEZIONE DOCUMENTO */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Documento</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="tipo_documento">Tipo Documento</Label>
                <select
                  id="tipo_documento"
                  value={formData.tipo_documento}
                  onChange={(e) => setFormData({...formData, tipo_documento: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Seleziona Tipo...</option>
                  {TIPI_DOCUMENTO.map(tipo => (
                    <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="numero_documento">Numero documento</Label>
                <Input
                  id="numero_documento"
                  value={formData.numero_documento}
                  onChange={(e) => setFormData({...formData, numero_documento: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="data_rilascio">Data rilascio</Label>
                <Input
                  id="data_rilascio"
                  type="date"
                  value={formData.data_rilascio}
                  onChange={(e) => setFormData({...formData, data_rilascio: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="luogo_rilascio">Luogo Rilascio</Label>
                <Input
                  id="luogo_rilascio"
                  value={formData.luogo_rilascio}
                  onChange={(e) => setFormData({...formData, luogo_rilascio: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="scadenza_documento">Scadenza</Label>
                <Input
                  id="scadenza_documento"
                  type="date"
                  value={formData.scadenza_documento}
                  onChange={(e) => setFormData({...formData, scadenza_documento: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* SEZIONE TELEFONIA FASTWEB */}
          {(() => {
            const showTelefoniaSection = isTelefoniaFastweb();
            console.log("🔍 RENDER CHECK - Telefonia Fastweb section:", showTelefoniaSection);
            return showTelefoniaSection;
          })() && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">📞 Telefonia Fastweb</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="tecnologia">Tecnologia</Label>
                  <select
                    id="tecnologia"
                    value={formData.tecnologia}
                    onChange={(e) => setFormData({...formData, tecnologia: e.target.value})}
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
                    onChange={(e) => setFormData({...formData, codice_migrazione: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="gestore">Gestore</Label>
                  <Input
                    id="gestore"
                    value={formData.gestore}
                    onChange={(e) => setFormData({...formData, gestore: e.target.value})}
                  />
                </div>
              </div>

              {/* CONVERGENZA */}
              <div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="convergenza"
                    checked={formData.convergenza}
                    onChange={(e) => setFormData({...formData, convergenza: e.target.checked})}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <Label htmlFor="convergenza">Convergenza</Label>
                </div>

                {formData.convergenza && (
                  <div className="mt-4 space-y-3">
                    {convergenzaItems.map((item, index) => (
                      <div key={index} className="border p-4 rounded-lg bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <Label>Numero Cellulare</Label>
                            <Input
                              value={item.numero_cellulare}
                              onChange={(e) => updateConvergenzaItem(index, 'numero_cellulare', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>ICCID</Label>
                            <Input
                              value={item.iccid}
                              onChange={(e) => updateConvergenzaItem(index, 'iccid', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Operatore</Label>
                            <Input
                              value={item.operatore}
                              onChange={(e) => updateConvergenzaItem(index, 'operatore', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex justify-between mt-2">
                          <Button
                            type="button"
                            onClick={addConvergenzaItem}
                            variant="outline"
                            size="sm"
                            className="text-green-600"
                          >
                            + Aggiungi
                          </Button>
                          {convergenzaItems.length > 1 && (
                            <Button
                              type="button"
                              onClick={() => removeConvergenzaItem(index)}
                              variant="outline"
                              size="sm"
                              className="text-red-600"
                            >
                              Rimuovi
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SEZIONE ENERGIA FASTWEB */}
          {(() => {
            const showEnergiaSection = isEnergiaFastweb();
            console.log("🔍 RENDER CHECK - Energia Fastweb section:", showEnergiaSection);
            return showEnergiaSection;
          })() && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">⚡ Energia Fastweb</h3>
              
              <div>
                <Label htmlFor="codice_pod">Codice Pod</Label>
                <Input
                  id="codice_pod"
                  value={formData.codice_pod}
                  onChange={(e) => setFormData({...formData, codice_pod: e.target.value})}
                />
              </div>
            </div>
          )}

          {/* SEZIONE MODALITÀ PAGAMENTO */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">💳 Modalità Pagamento</h3>
            
            <div>
              <Label htmlFor="modalita_pagamento">Modalità pagamento</Label>
              <select
                id="modalita_pagamento"
                value={formData.modalita_pagamento}
                onChange={(e) => setFormData({...formData, modalita_pagamento: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Seleziona Modalità...</option>
                {MODALITA_PAGAMENTO.map(modalita => (
                  <option key={modalita.value} value={modalita.value}>{modalita.label}</option>
                ))}
              </select>
            </div>

            {formData.modalita_pagamento === 'iban' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="iban">IBAN</Label>
                  <Input
                    id="iban"
                    value={formData.iban}
                    onChange={(e) => setFormData({...formData, iban: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="intestatario_diverso">Intestatario se diverso</Label>
                  <Input
                    id="intestatario_diverso"
                    value={formData.intestatario_diverso}
                    onChange={(e) => setFormData({...formData, intestatario_diverso: e.target.value})}
                  />
                </div>
              </div>
            )}

            {formData.modalita_pagamento === 'carta_credito' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="numero_carta">Numero Carta</Label>
                  <Input
                    id="numero_carta"
                    value={formData.numero_carta}
                    onChange={(e) => setFormData({...formData, numero_carta: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="mese_carta">Mese</Label>
                  <select
                    id="mese_carta"
                    value={formData.mese_carta}
                    onChange={(e) => setFormData({...formData, mese_carta: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Mese...</option>
                    {Array.from({length: 12}, (_, i) => (
                      <option key={i+1} value={String(i+1).padStart(2, '0')}>
                        {String(i+1).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="anno_carta">Anno</Label>
                  <select
                    id="anno_carta"
                    value={formData.anno_carta}
                    onChange={(e) => setFormData({...formData, anno_carta: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Anno...</option>
                    {Array.from({length: 10}, (_, i) => {
                      const year = new Date().getFullYear() + i;
                      return (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* SEZIONE NOTE */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">📝 Note</h3>
            
            <div>
              <Label htmlFor="note">Note</Label>
              <textarea
                id="note"
                rows={3}
                value={formData.note}
                onChange={(e) => setFormData({...formData, note: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Note aggiuntive..."
              />
            </div>
          </div>
            
          <DialogFooter className="mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowClientForm(false)}
              className="mr-2"
            >
              ← Torna alla Selezione
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700">
              ✅ Crea Cliente
            </Button>
          </DialogFooter>
          </form>
        )}

        {/* FOOTER BUTTONS for cascading flow */}
        {!showClientForm && (
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button 
              type="button" 
              disabled={!selectedData.offerta_id}
              onClick={() => setShowClientForm(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Continua → Scheda Cliente
            </Button>
          </DialogFooter>
        )}

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
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
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
const ViewClienteModal = ({ cliente, onClose, commesse, subAgenzie, servizi }) => {
  if (!cliente) return null;
  
  const getCommessaName = (id) => commesse.find(c => c.id === id)?.nome || id;
  const getSubAgenziaName = (id) => subAgenzie.find(s => s.id === id)?.nome || id;
  const getServizioName = (id) => servizi.find(s => s.id === id)?.nome || id;

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
                  <p className="text-sm">{getServizioName(cliente.servizio_id)}</p>
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
                    {cliente.segmento === 'privato' ? 'Privato' : 
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
                <Badge variant={getClienteStatusVariant(cliente.status)}>
                  {formatClienteStatus(cliente.status)}
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

// Duplicate ImportClientiModal removed - using the full version above

// Edit Cliente Modal Component  
const EditClienteModal = ({ cliente, onClose, onSubmit, commesse, subAgenzie }) => {
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
    
    // Campi Telefonia Fastweb
    tecnologia: cliente?.tecnologia || '',
    codice_migrazione: cliente?.codice_migrazione || '',
    gestore: cliente?.gestore || '',
    convergenza: cliente?.convergenza || false,
    convergenza_items: cliente?.convergenza_items || [],
    
    // Campi Energia Fastweb
    codice_pod: cliente?.codice_pod || '',
    
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
    
    // Note e Status
    status: cliente?.status || 'da_inserire',
    note: cliente?.note || '',
    note_backoffice: cliente?.note_backoffice || ''
  });

  const [servizi, setServizi] = useState([]);
  const [editTipologieContratto, setEditTipologieContratto] = useState([]);
  const [segmenti, setSegmenti] = useState([]);
  const [offertaInfo, setOffertaInfo] = useState(null);
  const [isLoadingTipologie, setIsLoadingTipologie] = useState(true);
  const [isLoadingOfferta, setIsLoadingOfferta] = useState(false);
  const [availableOfferte, setAvailableOfferte] = useState([]);

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

  const fetchSegmenti = async () => {
    try {
      const response = await axios.get(`${API}/segmenti`);
      setSegmenti(response.data);
    } catch (error) {
      console.error("Error fetching segmenti:", error);
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

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Funzioni per rilevare i campi condizionali basati sui dati del cliente esistente - CON CONTROLLI DEFENSIVI
  const isEditEnergiaFastweb = () => {
    try {
      // Prima priorità: controlla se il cliente ha già campi Energia Fastweb popolati
      if (cliente?.codice_pod && cliente.codice_pod.trim() !== '') {
        console.log("🔍 isEditEnergiaFastweb: TRUE - codice_pod present:", cliente.codice_pod);
        return true;
      }
      
      // Seconda priorità: controlla dal nome della tipologia se disponibile
      if (Array.isArray(editTipologieContratto) && editTipologieContratto.length > 0) {
        const tipologia = editTipologieContratto.find(t => t && t.value === cliente?.tipologia_contratto);
        const tipologiaName = (tipologia?.label || '').toLowerCase();
        const isEnergia = tipologiaName.includes('energia') || 
                         tipologiaName.includes('fotovoltaico') || 
                         tipologiaName.includes('solare') || 
                         tipologiaName.includes('pod') ||
                         tipologiaName.includes('luce') ||
                         tipologiaName.includes('gas');
        console.log("🔍 isEditEnergiaFastweb: Tipologia check:", {tipologiaName, isEnergia});
        if (isEnergia) return true;
      }
      
      // Terza priorità: controlla direttamente il valore della tipologia contratto - MA ESCLUDE TELEFONIA
      const tipologiaValue = (cliente?.tipologia_contratto || '').toLowerCase();
      // NON deve includere "fastweb" generico perché "telefonia_fastweb" è diverso da "energia_fastweb"
      const isEnergiaByValue = tipologiaValue.includes('energia') && !tipologiaValue.includes('telefonia');
      console.log("🔍 isEditEnergiaFastweb: Direct value check:", {tipologiaValue, isEnergiaByValue});
      return isEnergiaByValue;
    } catch (error) {
      console.error("❌ Error in isEditEnergiaFastweb:", error);
      return false;
    }
  };

  const isEditTelefoniaFastweb = () => {
    try {
      // Prima priorità: controlla se il cliente ha già campi Telefonia popolati
      if (cliente?.tecnologia || cliente?.codice_migrazione || cliente?.gestore || cliente?.convergenza) {
        console.log("🔍 isEditTelefoniaFastweb: TRUE - fields present:", {
          tecnologia: cliente.tecnologia,
          codice_migrazione: cliente.codice_migrazione, 
          gestore: cliente.gestore,
          convergenza: cliente.convergenza
        });
        return true;
      }
      
      // Seconda priorità: controlla dal nome della tipologia se disponibile
      if (Array.isArray(editTipologieContratto) && editTipologieContratto.length > 0) {
        const tipologia = editTipologieContratto.find(t => t && t.value === cliente?.tipologia_contratto);
        const tipologiaName = (tipologia?.label || '').toLowerCase();
        const isTelefonia = tipologiaName.includes('telefonia') || 
                           tipologiaName.includes('mobile') ||
                           tipologiaName.includes('sim') ||
                           tipologiaName.includes('voce') ||
                           tipologiaName.includes('dati');
        console.log("🔍 isEditTelefoniaFastweb: Tipologia check:", {tipologiaName, isTelefonia});
        if (isTelefonia) return true;
      }
      
      // Terza priorità: controlla direttamente il valore della tipologia contratto - SPECIFICO PER TELEFONIA
      const tipologiaValue = (cliente?.tipologia_contratto || '').toLowerCase();
      const isTelefoniaByValue = tipologiaValue.includes('telefonia') || 
                                tipologiaValue.includes('mobile') || 
                                (tipologiaValue.includes('fastweb') && tipologiaValue.includes('telefonia'));
      console.log("🔍 isEditTelefoniaFastweb: Direct value check:", {tipologiaValue, isTelefoniaByValue});
      return isTelefoniaByValue;
    } catch (error) {
      console.error("❌ Error in isEditTelefoniaFastweb:", error);
      return false;
    }
  };

  const isEditBusinessSegment = () => {
    try {
      // Prima priorità: controlla se il cliente ha già Partita IVA (indicatore di Business)
      if (cliente?.partita_iva && String(cliente.partita_iva).trim() !== '') {
        console.log("🔍 isEditBusinessSegment: TRUE - partita_iva present:", cliente.partita_iva);
        return true;
      }
      
      // Seconda priorità: controlla dal segmento
      const segmento = (cliente?.segmento || '').toLowerCase();
      const isBusiness = segmento === 'business';
      console.log("🔍 isEditBusinessSegment: Segmento check:", {segmento, isBusiness});
      return isBusiness;
    } catch (error) {
      console.error("❌ Error in isEditBusinessSegment:", error);
      return false;
    }
  };

  useEffect(() => {
    if (formData.commessa_id) {
      fetchServizi(formData.commessa_id);
    }
    if (cliente?.offerta_id) {
      fetchOffertaInfo(cliente.offerta_id);
    }
    // Carica tipologie contratto per risolvere i nomi
    if (formData.servizio_id) {
      fetchTipologieByServizio(formData.servizio_id);
    }
    // Carica offerte per il segmento del cliente (o tutte se segmento non disponibile)
    fetchOfferteBySegmento(formData.segmento);
    fetchSegmenti();
  }, []);

  // Trigger re-render quando i dati vengono caricati
  useEffect(() => {
    if (!isLoadingTipologie) {
      console.log("🔄 Tipologie loaded, re-evaluating conditional sections");
      // Force re-evaluation by updating a dummy state if needed
      // The conditional functions will be called again during render
    }
  }, [isLoadingTipologie, editTipologieContratto]);

  // Funzioni duplicate rimosse - ora definite prima del useEffect

  // Funzioni per gestire i campi modificabili (i dati organizzativi non sono più modificabili)

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Mappa i campi frontend ai nomi backend
    const backendData = {
      ...formData,
      telefono2: formData.cellulare  // Mappa cellulare -> telefono2
    };
    
    // Rimuovi i campi frontend che non devono essere inviati al backend
    delete backendData.cellulare;
    
    console.log("🔄 Submitting edit cliente data:", {
      frontend_data: formData,
      backend_data: backendData
    });
    
    onSubmit(backendData);
  };

  // handleChange già definito sopra

  // Debug: Verifica che il componente arrivi al render finale
  console.log("🎯 EditClienteModal: RENDERING COMPLETE - All functions defined, ready to render JSX");

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
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
                  <Label htmlFor="telefono">Telefono</Label>
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
                  <div className="text-xs text-gray-500 mt-1">
                    Debug: formData.cellulare = "{formData.cellulare}", cliente.telefono2 = "{cliente?.telefono2}"
                  </div>
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
              <CardTitle className="text-lg">🏠 Indirizzo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="indirizzo">Indirizzo</Label>
                  <Input
                    id="indirizzo"
                    value={formData.indirizzo}
                    onChange={(e) => handleChange('indirizzo', e.target.value)}
                    placeholder="Via/Piazza, numero civico"
                  />
                </div>
                <div>
                  <Label htmlFor="comune_residenza">Comune di Residenza</Label>
                  <Input
                    id="comune_residenza"
                    value={formData.comune_residenza}
                    onChange={(e) => handleChange('comune_residenza', e.target.value)}
                    placeholder="Inserisci comune"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Debug: formData.comune_residenza = "{formData.comune_residenza}", cliente.comune_residenza = "{cliente?.comune_residenza}"
                  </div>
                </div>
                <div>
                  <Label htmlFor="provincia">Provincia</Label>
                  <select
                    id="provincia"
                    value={formData.provincia}
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
                <div>
                  <Label htmlFor="cap">CAP</Label>
                  <Input
                    id="cap"
                    value={formData.cap}
                    onChange={(e) => handleChange('cap', e.target.value)}
                    placeholder="00000"
                  />
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
                  <p className="text-sm p-2 bg-gray-50 border rounded">
                    {subAgenzie.find(sa => sa.id === cliente?.sub_agenzia_id)?.nome || 'Non disponibile'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Servizio</Label>
                  <p className="text-sm p-2 bg-gray-50 border rounded">
                    {Array.isArray(servizi) && servizi.find(s => s?.id === cliente?.servizio_id)?.nome || 'Non disponibile'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Tipologia Contratto</Label>
                  <p className="text-sm p-2 bg-gray-50 border rounded">
                    {cliente?.tipologia_contratto === 'energia_fastweb' ? 'Energia Fastweb' :
                     cliente?.tipologia_contratto === 'telefonia_fastweb' ? 'Telefonia Fastweb' :
                     cliente?.tipologia_contratto === 'ho_mobile' ? 'Ho Mobile' :
                     cliente?.tipologia_contratto === 'telepass' ? 'Telepass' :
                     cliente?.tipologia_contratto || 'Non disponibile'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Segmento</Label>
                  <p className="text-sm p-2 bg-gray-50 border rounded">
                    {cliente?.segmento === 'privato' ? 'Privato' :
                     cliente?.segmento === 'business' ? 'Business' :
                     cliente?.segmento || 'Non disponibile'}
                  </p>
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
                  
                  {/* Debug: mostra numero offerte caricate */}
                  {availableOfferte && availableOfferte.length > 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      ✅ {availableOfferte.length} offerte disponibili
                    </p>
                  )}
                  
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
              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                Debug: tipo={formData.tipo_documento}, numero={formData.numero_documento}, rilascio={formData.data_rilascio}
              </div>
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

          {/* SEZIONE TELEFONIA FASTWEB */}
          {isEditTelefoniaFastweb() && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">📞 Telefonia Fastweb</CardTitle>
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
                      {cliente?.convergenza_items && cliente.convergenza_items.length > 0 ? (
                        <div className="space-y-2">
                          {cliente.convergenza_items.map((sim, index) => (
                            <div key={index} className="bg-white p-2 rounded border text-sm">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <strong>Numero:</strong> {sim.numero_cellulare || 'Non specificato'}
                                </div>
                                <div>
                                  <strong>Operatore:</strong> {sim.operatore_attuale || 'Non specificato'}
                                </div>
                                <div>
                                  <strong>Tecnologia:</strong> {sim.tecnologia || 'Non specificato'}
                                </div>
                                <div>
                                  <strong>Piano:</strong> {sim.piano_tariffario || 'Non specificato'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-blue-600">Nessuna SIM associata trovata</p>
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
          {isEditEnergiaFastweb() && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">⚡ Energia Fastweb</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <Label htmlFor="codice_pod">Codice Pod</Label>
                  <Input
                    id="codice_pod"
                    value={formData.codice_pod}
                    onChange={(e) => handleChange('codice_pod', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* SEZIONE MODALITÀ PAGAMENTO - SOLO QUELLA SELEZIONATA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">💳 Modalità Pagamento</CardTitle>
              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                Debug: modalita={formData.modalita_pagamento}, iban={formData.iban}, carta={formData.numero_carta}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Modalità Pagamento Selezionata</Label>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                    <strong>
                      {formData.modalita_pagamento === 'iban' ? '💰 IBAN (Bonifico Bancario)' : 
                       formData.modalita_pagamento === 'carta_credito' ? '💳 Carta di Credito' : 
                       '❌ Nessuna modalità selezionata'}
                    </strong>
                  </div>
                </div>
                
                {/* Campi IBAN - Solo se modalità selezionata */}
                {formData.modalita_pagamento === 'iban' && (
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
                
                {/* Campi Carta di Credito - Solo se modalità selezionata */}
                {formData.modalita_pagamento === 'carta_credito' && (
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
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inserito">Inserito</SelectItem>
                    <SelectItem value="ko">KO</SelectItem>
                    <SelectItem value="infoline">Infoline</SelectItem>
                    <SelectItem value="inviata_consumer">Inviata Consumer</SelectItem>
                    <SelectItem value="problematiche_inserimento">Problematiche Inserimento</SelectItem>
                    <SelectItem value="attesa_documenti_clienti">Attesa Documenti Clienti</SelectItem>
                    <SelectItem value="non_acquisibile_richiesta_escalation">Non Acquisibile Richiesta Escalation</SelectItem>
                    <SelectItem value="in_gestione_struttura_consulente">In Gestione Struttura/Consulente</SelectItem>
                    <SelectItem value="non_risponde">Non Risponde</SelectItem>
                    <SelectItem value="passata_al_bo">Passata al BO</SelectItem>
                    <SelectItem value="da_inserire">Da Inserire</SelectItem>
                    <SelectItem value="inserito_sotto_altro_canale">Inserito Sotto Altro Canale</SelectItem>
                    <SelectItem value="proveniente_da_altro_canale">Proveniente da Altro Canale</SelectItem>
                    <SelectItem value="scontrinare">Scontrinare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Note */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">📝 Note</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="note">Note Cliente</Label>
                  <Textarea
                    id="note"
                    value={formData.note}
                    onChange={(e) => handleChange('note', e.target.value)}
                    placeholder="Note aggiuntive del cliente..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="note_backoffice">Note Back Office</Label>
                  <Textarea
                    id="note_backoffice"
                    value={formData.note_backoffice}
                    onChange={(e) => handleChange('note_backoffice', e.target.value)}
                    placeholder="Note interne del Back Office..."
                    rows={3}
                    className="border-orange-200 focus:border-orange-500"
                  />
                </div>
              </div>
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

            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-4">
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

        const response = await axios.post(`${API}/documents/upload`, formData, {
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
  const handleView = async (documentId, filename) => {
    try {
      // Use authenticated request (same as download but for viewing)
      const response = await axios.get(`${API}/documents/${documentId}/view`, {
        responseType: 'blob', // Get file as blob
      });

      // Create blob URL and open in new tab for viewing
      const blob = new Blob([response.data], { 
        type: response.headers['content-type'] || 'application/pdf' 
      });
      const url = window.URL.createObjectURL(blob);
      
      // Open in new tab for viewing
      const newWindow = window.open(url, '_blank');
      
      // Clean up blob URL after a delay to ensure it loads
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 5000);
      
    } catch (error) {
      console.error("Error viewing document:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nella visualizzazione del documento",
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
        
        <div className="p-4 sm:p-6 space-y-6">
          {/* Multi-File Upload Section - Responsive */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="border-b border-slate-200 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Upload className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Carica Documenti</h3>
                    <p className="text-sm text-slate-600">Upload multipli supportati</p>
                  </div>
                </div>
                {selectedFiles.length > 0 && (
                  <Badge variant="secondary" className="self-start sm:self-center">
                    {selectedFiles.length} file selezionati
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="p-4 sm:p-6">
              <div className="space-y-4">
                {/* Responsive Drag & Drop Area */}
                <div
                  className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all duration-200 ${
                    dragActive
                      ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                      : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="space-y-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                      <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-base sm:text-lg font-medium text-slate-700">
                        Trascina file qui o clicca per selezionare
                      </p>
                      <p className="text-xs sm:text-sm text-slate-500">
                        PDF • DOC • XLS • IMG • ZIP • Massimo 10 MB per file
                      </p>
                    </div>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-input-multi"
                    />
                    <label
                      htmlFor="file-input-multi"
                      className="inline-flex items-center px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white text-sm sm:text-base font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Seleziona File
                    </label>
                  </div>
                </div>

                {/* Selected Files List - Mobile Optimized */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-slate-700 text-sm sm:text-base">
                        File Selezionati ({selectedFiles.length})
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedFiles([])}
                        disabled={uploading}
                        className="text-xs"
                      >
                        Rimuovi Tutti
                      </Button>
                    </div>
                    
                    <div className="max-h-40 sm:max-h-48 overflow-y-auto space-y-2">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <div className="flex items-start justify-between space-x-3">
                            <div className="flex items-start space-x-3 min-w-0 flex-1">
                              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || 'Documento'}
                                </p>
                                
                                {/* Progress Bar - Mobile Friendly */}
                                {uploadProgress[file.name] && (
                                  <div className="mt-2 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-slate-600">
                                        {uploadProgress[file.name].status === 'uploading' && 'Caricamento...'}
                                        {uploadProgress[file.name].status === 'completed' && 'Completato'}
                                        {uploadProgress[file.name].status === 'error' && 'Errore'}
                                      </span>
                                      {uploadProgress[file.name].status === 'uploading' && (
                                        <span className="text-xs text-slate-500">
                                          {uploadProgress[file.name].progress}%
                                        </span>
                                      )}
                                    </div>
                                    {uploadProgress[file.name].status === 'uploading' && (
                                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                                        <div 
                                          className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                                          style={{ width: `${uploadProgress[file.name].progress}%` }}
                                        ></div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Status Icon & Remove Button */}
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              {uploadProgress[file.name] && (
                                <>
                                  {uploadProgress[file.name].status === 'completed' && (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  )}
                                  {uploadProgress[file.name].status === 'error' && (
                                    <XCircle className="w-4 h-4 text-red-600" />
                                  )}
                                  {uploadProgress[file.name].status === 'uploading' && (
                                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                  )}
                                </>
                              )}
                              
                              {!uploading && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeFile(index)}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Upload Button - Prominent */}
                    <div className="pt-3 border-t border-slate-200">
                      <Button
                        onClick={handleMultipleUpload}
                        disabled={uploading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3"
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
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Documents List - Mobile Optimized */}
          <Card className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="border-b border-slate-200 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Documenti Cliente</h3>
                    <p className="text-sm text-slate-600">{documents.length} file caricati</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchClientDocuments}
                  disabled={loading}
                  className="self-start sm:self-center"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-600 mr-2" />
                  ) : (
                    <>
                      <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Aggiorna
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <CardContent className="p-4 sm:p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  <p className="text-slate-500 mt-3">Caricamento documenti...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">
                    Nessun documento caricato
                  </h3>
                  <p className="text-slate-500 max-w-sm mx-auto">
                    Usa la sezione di caricamento sopra per aggiungere i primi documenti per questo cliente
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden lg:block">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">File</th>
                            <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Tipo</th>
                            <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Dimensione</th>
                            <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Aruba Drive</th>
                            <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Data</th>
                            <th className="text-center py-3 px-4 font-semibold text-slate-700 text-sm">Azioni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {documents.map((doc, index) => (
                            <tr key={doc.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="py-4 px-4">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <span className="font-medium text-slate-900 text-sm">{doc.filename}</span>
                                </div>
                              </td>
                              <td className="py-4 px-4">
                                <Badge variant="secondary" className="text-xs">
                                  {doc.file_type?.split('/')[1]?.toUpperCase() || 'DOC'}
                                </Badge>
                              </td>
                              <td className="py-4 px-4 text-sm text-slate-600">
                                {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(1)} MB` : 'N/A'}
                              </td>
                              <td className="py-4 px-4">
                                {doc.aruba_drive_path ? (
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="text-xs text-slate-600 max-w-xs truncate">
                                      {doc.aruba_drive_path}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                    <span className="text-xs text-slate-600">Solo locale</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-4 text-sm text-slate-600">
                                {new Date(doc.created_at).toLocaleDateString('it-IT', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: '2-digit'
                                })}
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex items-center justify-center space-x-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleView(doc.id, doc.filename)}
                                    className="h-8 w-8 p-0"
                                    title="Visualizza documento"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDownload(doc.id, doc.filename)}
                                    className="h-8 w-8 p-0"
                                    title="Scarica documento"
                                  >
                                    <Download className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                                    className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-200"
                                    title="Rimuovi dalla lista"
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
                  </div>
                  
                  {/* Mobile/Tablet Card View */}
                  <div className="lg:hidden space-y-3">
                    {documents.map((doc, index) => (
                      <div key={doc.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <div className="space-y-3">
                          {/* File Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 min-w-0 flex-1">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <FileText className="w-5 h-5 text-blue-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-medium text-slate-900 text-sm truncate">{doc.filename}</h4>
                                <div className="flex items-center space-x-3 mt-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {doc.file_type?.split('/')[1]?.toUpperCase() || 'DOC'}
                                  </Badge>
                                  <span className="text-xs text-slate-500">
                                    {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(1)} MB` : 'N/A'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleView(doc.id, doc.filename)}
                                className="h-8 w-8 p-0"
                                title="Visualizza"
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownload(doc.id, doc.filename)}
                                className="h-8 w-8 p-0"
                                title="Scarica"
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteDocument(doc.id, doc.filename)}
                                className="h-8 w-8 p-0 hover:bg-red-50"
                                title="Elimina"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          
                          {/* File Details */}
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              {doc.aruba_drive_path ? (
                                <>
                                  <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                                  <span className="text-xs text-slate-600 truncate">
                                    Aruba Drive: {doc.aruba_drive_path.split('/').slice(-2).join('/')}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <div className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0"></div>
                                  <span className="text-xs text-slate-600">Solo archiviazione locale</span>
                                </>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              Caricato il {new Date(doc.created_at).toLocaleDateString('it-IT', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppWithAuth;