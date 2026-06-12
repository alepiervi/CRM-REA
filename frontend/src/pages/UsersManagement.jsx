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
  const [searchQuery, setSearchQuery] = useState(""); // NEW: Search filter
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

  // Fetch ALL referenti (for Super Referente role)
  const fetchAllReferenti = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      const allReferenti = response.data.filter(u => u.role === 'referente');
      setReferenti(allReferenti);
    } catch (error) {
      console.error("Error fetching all referenti:", error);
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

  // Filter users based on search query
  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.username?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.role?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl md:text-3xl font-bold text-slate-800">
          Gestione Utenti {selectedUnit && selectedUnit !== "all" && `- ${units.find(u => u.id === selectedUnit)?.name}`}
        </h2>
        <Button onClick={() => setShowCreateModal(true)} size="sm" className="w-full sm:w-auto">
          <UserPlus className="w-4 h-4 mr-2" />
          Nuovo Utente
        </Button>
      </div>

      {/* Search Filter - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row gap-2 bg-white p-3 md:p-4 rounded-lg shadow-sm border">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Cerca utenti..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2">
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4 mr-1" />
              Cancella
            </Button>
          )}
          <div className="text-sm text-gray-500">
            {filteredUsers.length}/{users.length}
          </div>
        </div>
      </div>

      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">Caricamento...</div>
          ) : (
            <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
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
                {filteredUsers.map((user) => (
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
            </div>
            
            {/* Mobile Card View */}
            <div className="md:hidden max-h-[60vh] overflow-y-auto">
              {filteredUsers.map((user) => (
                <div key={user.id} className="border-b border-slate-200 p-4 last:border-b-0">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900">{user.username}</h3>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                    <Badge variant={user.is_active ? "default" : "secondary"} className="text-xs">
                      {user.is_active ? "Attivo" : "Disattivo"}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <div>
                      <span className="text-slate-500">Ruolo:</span>
                      <div className="mt-1">{getRoleBadge(user.role)}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Unit:</span>
                      <p className="text-slate-700">{user.unit_id ? units.find(u => u.id === user.unit_id)?.name || "N/A" : "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Province:</span>
                      <p className="text-slate-700 text-xs">
                        {user.provinces?.length > 0 ? user.provinces.slice(0, 2).join(", ") : "N/A"}
                        {user.provinces?.length > 2 && ` (+${user.provinces.length - 2})`}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Ultimo accesso:</span>
                      <p className="text-slate-700">{user.last_login ? new Date(user.last_login).toLocaleDateString("it-IT") : "Mai"}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <Button onClick={() => setEditingUser(user)} variant="outline" size="sm" className="flex-1">
                      <Edit className="w-3 h-3 mr-1" /> Modifica
                    </Button>
                    <Button
                      onClick={() => toggleUserStatus(user.id, user.is_active)}
                      variant={user.is_active ? "destructive" : "default"}
                      size="sm"
                      className="flex-1"
                    >
                      {user.is_active ? <PowerOff className="w-3 h-3 mr-1" /> : <Power className="w-3 h-3 mr-1" />}
                      {user.is_active ? "Disattiva" : "Attiva"}
                    </Button>
                    <Button onClick={() => deleteUser(user.id)} variant="destructive" size="sm">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            </>
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
  const { user: currentUser } = useAuth(); // Get current logged-in user
  
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "",
    assignment_type: "", // "unit" o "sub_agenzia" - vuoto fino a selezione esplicita
    unit_id: selectedUnit && selectedUnit !== "all" ? selectedUnit : "",
    unit_autorizzate: [], // NEW: Per Supervisor - multiple unit
    referenti_autorizzati: [], // NEW: Per Super Referente - multiple referenti
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
  const [referentiUnit, setReferentiUnit] = useState([]); // Referenti filtered by selected unit (for Super Referente)
  const [servizi, setServizi] = useState([]);
  const [serviziDisponibili, setServiziDisponibili] = useState([]); // NEW: Servizi per UNIT/SUB selezionata
  const [serviziPerCommessa, setServiziPerCommessa] = useState({}); // NEW: Servizi organizzati per commessa per responsabile_commessa
  const { toast } = useToast();
  
  // DEBUG: Monitor referentiUnit changes
  useEffect(() => {
    console.log('🔍🔍🔍 referentiUnit STATE CHANGED:', referentiUnit);
    console.log('🔍 referentiUnit.length:', referentiUnit.length);
  }, [referentiUnit]);

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
      console.log('⚠️ unitId vuoto, reset stati');
      setServiziDisponibili([]);
      setReferentiUnit([]);
      return;
    }
    
    try {
      console.log('🔄 Fetching servizi for unit:', unitId);
      // Find the selected unit
      const selectedUnitObj = units.find(u => u.id === unitId);
      console.log('🔍 selectedUnitObj:', selectedUnitObj);
      console.log('🔍 commesse_autorizzate:', selectedUnitObj?.commesse_autorizzate);
      
      if (!selectedUnitObj) {
        console.warn('⚠️ Unit non trovata!');
        setServiziDisponibili([]);
        setReferentiUnit([]);
        return;
      }
      
      // IMPORTANTE: Non bloccare se non ci sono commesse, i referenti vanno caricati comunque!
      if (!selectedUnitObj.commesse_autorizzate || selectedUnitObj.commesse_autorizzate.length === 0) {
        console.warn('⚠️ Unit senza commesse autorizzate, ma carico comunque i referenti');
        setServiziDisponibili([]);
        // NON fare return qui! Continua per caricare i referenti
      }
      
      // Fetch all servizi for the authorized commesse of this unit
      const allServizi = [];
      if (selectedUnitObj.commesse_autorizzate && selectedUnitObj.commesse_autorizzate.length > 0) {
        for (const commessaId of selectedUnitObj.commesse_autorizzate) {
          try {
            const response = await axios.get(`${API}/commesse/${commessaId}/servizi`);
            allServizi.push(...response.data);
          } catch (error) {
            console.error(`Error fetching servizi for commessa ${commessaId}:`, error);
          }
        }
      }
      
      console.log('✅ Servizi loaded for unit:', allServizi.length);
      setServiziDisponibili(allServizi);
      
      // Fetch referenti for this unit
      try {
        console.log('🔄🔄🔄 INIZIO FETCH REFERENTI per unit:', unitId);
        const token = localStorage.getItem('token');
        console.log('🔑 Token presente?', !!token);
        console.log('🌐 URL chiamata:', `${API}/users/referenti/${unitId}`);
        
        const refResponse = await axios.get(`${API}/users/referenti/${unitId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('✅✅✅ REFERENTI CARICATI! Status:', refResponse.status);
        console.log('✅ Numero referenti:', refResponse.data.length);
        console.log('✅ Referenti data:', refResponse.data);
        
        setReferentiUnit(refResponse.data);
        console.log('✅ setReferentiUnit chiamato con:', refResponse.data);
      } catch (error) {
        console.error("❌❌❌ ERRORE FETCH REFERENTI:", error);
        console.error("❌ Error response:", error.response);
        console.error("❌ Error details:", error.response?.data);
        console.error("❌ Error status:", error.response?.status);
        setReferentiUnit([]);
      }
    } catch (error) {
      console.error("Error fetching servizi for unit:", error);
      setServiziDisponibili([]);
      setReferentiUnit([]);
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
      
      // Use new endpoint that directly returns servizi filtered by sub_agenzia
      const response = await axios.get(`${API}/cascade/servizi-by-sub-agenzia/${subAgenziaId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      console.log('✅ Servizi loaded for sub agenzia:', response.data.length);
      setServiziDisponibili(response.data);
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
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log("FormData originale:", JSON.stringify({ 
        username: formData.username,
        email: formData.email,
        role: formData.role,
        sub_agenzia_id: formData.sub_agenzia_id,
        unit_id: formData.unit_id,
        assignment_type: formData.assignment_type
      }, null, 2));
      console.log("🔍 sub_agenzia_id value:", formData.sub_agenzia_id);
      console.log("🔍 sub_agenzia_id type:", typeof formData.sub_agenzia_id);
      console.log("🔍 sub_agenzia_id length:", formData.sub_agenzia_id?.length);
      console.log("🔍 unit_id value:", formData.unit_id);
      console.log("🔍 assignment_type value:", formData.assignment_type);
      
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
      
      // FIX: Convert empty strings to null FIRST
      if (submitData.unit_id === "") {
        submitData.unit_id = null;
      }
      if (submitData.sub_agenzia_id === "") {
        submitData.sub_agenzia_id = null;
      }
      
      // Assicurati che solo uno tra unit_id e sub_agenzia_id sia impostato
      if (formData.assignment_type === "unit" || submitData.unit_id) {
        submitData.sub_agenzia_id = null;
      } else if (formData.assignment_type === "sub_agenzia" || submitData.sub_agenzia_id) {
        submitData.unit_id = null;
      } else {
      }

      // Validazione dati critici
      if (!submitData.username || !submitData.email || !submitData.role) {
        throw new Error("Campi obbligatori mancanti: username, email, o role");
      }
      
      console.log("📤📤📤 FINAL PAYLOAD BEING SENT:", JSON.stringify({ 
        username: submitData.username,
        email: submitData.email,
        role: submitData.role,
        password: `[${submitData.password.length} chars]`,
        commesse_autorizzate: submitData.commesse_autorizzate?.length || 0,
        sub_agenzia_id: submitData.sub_agenzia_id,
        unit_id: submitData.unit_id
      }, null, 2));
      
      // FIX: Close modal immediately before async operation
      onClose();
      
      const response = await axios.post(`${API}/users`, submitData);
      console.log("✅ Response received:", response.data.username, "sub_agenzia_id:", response.data.sub_agenzia_id);
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
      // Carica i servizi per la commessa selezionata (per responsabile/backoffice commessa e ruoli store/presidi/area manager)
      if (formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa" || 
          formData.role === "responsabile_store" || formData.role === "responsabile_presidi" ||
          formData.role === "store_assist" || formData.role === "promoter_presidi" ||
          formData.role === "area_manager") {
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
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  {/* Admin can create all roles */}
                  {currentUser?.role === 'admin' && (
                    <>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="super_referente">Super Referente</SelectItem>
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
                    </>
                  )}
                  
                  {/* Responsabile Commessa can create limited roles */}
                  {currentUser?.role === 'responsabile_commessa' && (
                    <>
                      <SelectItem value="agente">Agente</SelectItem>
                      <SelectItem value="operatore">Operatore</SelectItem>
                      <SelectItem value="store_assist">Store Assistant</SelectItem>
                      <SelectItem value="agente_specializzato">Agente Specializzato</SelectItem>
                      <SelectItem value="promoter_presidi">Promoter Presidi</SelectItem>
                      <SelectItem value="backoffice_commessa">BackOffice Commessa</SelectItem>
                      <SelectItem value="backoffice_sub_agenzia">BackOffice Sub Agenzia</SelectItem>
                      <SelectItem value="responsabile_sub_agenzia">Responsabile Sub Agenzia</SelectItem>
                      <SelectItem value="area_manager">Area Manager</SelectItem>
                      <SelectItem value="responsabile_presidi">Responsabile Presidi</SelectItem>
                    </>
                  )}
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

          {/* SUPERVISOR: Selezione Unit Multiple */}
          {formData.role === "supervisor" && (
            <div className="col-span-2">
              <Label>Unit Autorizzate *</Label>
              <p className="text-sm text-slate-500 mb-2">Seleziona le Unit che il Supervisor potrà gestire</p>
              <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {units.map((unit) => (
                    <div key={unit.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`supervisor-unit-${unit.id}`}
                        checked={formData.unit_autorizzate && formData.unit_autorizzate.includes(unit.id)}
                        onCheckedChange={(checked) => {
                          const currentUnits = formData.unit_autorizzate || [];
                          if (checked) {
                            setFormData(prev => ({ 
                              ...prev, 
                              unit_autorizzate: [...currentUnits, unit.id],
                              unit_id: currentUnits.length === 0 ? unit.id : prev.unit_id // Prima unit diventa unit_id principale
                            }));
                          } else {
                            const newUnits = currentUnits.filter(id => id !== unit.id);
                            setFormData(prev => ({ 
                              ...prev, 
                              unit_autorizzate: newUnits,
                              unit_id: newUnits.length > 0 ? newUnits[0] : "" // Aggiorna unit_id principale
                            }));
                          }
                        }}
                      />
                      <Label htmlFor={`supervisor-unit-${unit.id}`} className="text-sm font-normal cursor-pointer">
                        {unit.nome || unit.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              {formData.unit_autorizzate && formData.unit_autorizzate.length > 0 && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ {formData.unit_autorizzate.length} Unit selezionate
                </p>
              )}
            </div>
          )}

          {/* SUPER REFERENTE: Prima Unit, poi Referenti di quella Unit */}
          {formData.role === "super_referente" && (
            <>
              <div>
                <Label>Unit *</Label>
                <Select 
                  value={formData.unit_id} 
                  onValueChange={(value) => {
                    setFormData(prev => ({ ...prev, unit_id: value, referenti_autorizzati: [] }));
                    // Fetch referenti for selected unit
                    if (value) {
                      axios.get(`${API}/users/referenti/${value}`).then(res => {
                        setReferentiUnit(res.data);
                      }).catch(err => {
                        console.error("Error fetching referenti for unit:", err);
                        setReferentiUnit([]);
                      });
                    } else {
                      setReferentiUnit([]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona Unit" />
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

              {formData.unit_id && (
                <div className="col-span-2">
                  <Label>Referenti Autorizzati *</Label>
                  <p className="text-sm text-slate-500 mb-2">Seleziona i Referenti che il Super Referente potrà gestire (vedrà anche tutti gli agenti associati)</p>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                    {referentiUnit.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {referentiUnit.map((referente) => (
                          <div key={referente.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`super-ref-${referente.id}`}
                              checked={formData.referenti_autorizzati && formData.referenti_autorizzati.includes(referente.id)}
                              onCheckedChange={(checked) => {
                                const currentReferenti = formData.referenti_autorizzati || [];
                                if (checked) {
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    referenti_autorizzati: [...currentReferenti, referente.id]
                                  }));
                                } else {
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    referenti_autorizzati: currentReferenti.filter(id => id !== referente.id)
                                  }));
                                }
                              }}
                            />
                            <Label htmlFor={`super-ref-${referente.id}`} className="text-sm font-normal cursor-pointer">
                              {referente.username} {referente.email ? `(${referente.email})` : ''}
                            </Label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">Nessun referente trovato per questa Unit</p>
                    )}
                  </div>
                  {formData.referenti_autorizzati && formData.referenti_autorizzati.length > 0 && (
                    <p className="text-sm text-green-600 mt-2">
                      ✓ {formData.referenti_autorizzati.length} Referenti selezionati
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* AGENTE e REFERENTE: Campo Unit → Servizi */}
          {(formData.role === "agente" || formData.role === "referente") && (
            <div>
              <Label htmlFor="unit_id">Unit *</Label>
              <Select value={formData.unit_id} onValueChange={(value) => {
                setFormData(prev => ({ ...prev, unit_id: value, assignment_type: "unit", servizi_autorizzati: [] }));
                handleUnitChange(value);
              }}>
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
          )}

          {/* AGENTE: Campo Referente */}
          {formData.role === "agente" && formData.unit_id && (
            <div>
              <Label htmlFor="referente_id">Referente</Label>
              <Select value={formData.referente_id} onValueChange={(value) => 
                setFormData(prev => ({ ...prev, referente_id: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder={referentiUnit.length > 0 ? "Seleziona referente" : "Nessun referente disponibile per questa unit"} />
                </SelectTrigger>
                <SelectContent>
                  {referentiUnit.length > 0 ? (
                    referentiUnit.map((ref) => (
                      <SelectItem key={ref.id} value={ref.id}>
                        {ref.username}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>Nessun referente disponibile</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {referentiUnit.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Crea prima un utente Referente per questa Unit
                </p>
              )}
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
                  setFormData(prev => {
                    return { ...prev, sub_agenzia_id: value, assignment_type: "sub_agenzia", commesse_autorizzate: [], servizi_autorizzati: [] };
                  });
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

          {/* RESPONSABILE STORE, RESPONSABILE PRESIDI, PROMOTER PRESIDI e AREA MANAGER: Multi Sub Agenzie → Multi Commesse → Servizi separati per commessa */}
          {(formData.role === "responsabile_store" || formData.role === "responsabile_presidi" || formData.role === "promoter_presidi" || formData.role === "area_manager") && (
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

          {/* STORE ASSISTANT: Singola Sub Agenzia → Multi Commesse → Servizi separati per commessa */}
          {(formData.role === "store_assist") && (
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
  const { user: currentUser } = useAuth(); // Get current logged-in user
  
  console.log("🟣🟣🟣 EDIT MODAL OPENED - User data:", {
    username: user.username,
    role: user.role,
    unit_id: user.unit_id,
    sub_agenzia_id: user.sub_agenzia_id,
    commesse_autorizzate: user.commesse_autorizzate?.length || 0,
    servizi_autorizzati: user.servizi_autorizzati?.length || 0
  });
  
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
    referenti_autorizzati: user.referenti_autorizzati || [], // Per Super Referente
    can_view_analytics: user.can_view_analytics || false,
    entity_management: user.entity_management || "clienti",
    assignment_type: user.unit_id ? "unit" : (user.sub_agenzia_id ? "sub_agenzia" : "")
  });
  
  console.log("🟣 EDIT MODAL - formData initialized:", {
    sub_agenzia_id: user.sub_agenzia_id || "",
    assignment_type: user.unit_id ? "unit" : (user.sub_agenzia_id ? "sub_agenzia" : "")
  });
  const [isLoading, setIsLoading] = useState(false);
  const [servizi, setServizi] = useState([]);
  const [serviziDisponibili, setServiziDisponibili] = useState([]); // NEW: Servizi per UNIT/SUB selezionata
  const [serviziPerCommessa, setServiziPerCommessa] = useState({}); // NEW: Servizi organizzati per commessa per responsabile_commessa
  const [referentiUnit, setReferentiUnit] = useState([]); // Referenti della Unit selezionata
  const { toast } = useToast();
  
  // DEBUG: Monitor referentiUnit changes
  useEffect(() => {
    console.log('🔍🔍🔍 referentiUnit STATE CHANGED:', referentiUnit);
    console.log('🔍 referentiUnit.length:', referentiUnit.length);
  }, [referentiUnit]);

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
    console.log("  - formData.unit_id:", formData.unit_id);
    console.log("  - formData.sub_agenzia_id:", formData.sub_agenzia_id);
    console.log("  - formData.assignment_type:", formData.assignment_type);
    
    if (formData.unit_id && formData.assignment_type === "unit") {
      handleUnitChange(formData.unit_id);
    } else if (formData.sub_agenzia_id && formData.assignment_type === "sub_agenzia") {
      handleSubAgenziaChange(formData.sub_agenzia_id);
    } else {
    }
  }, []);

  // NEW: Load referenti for Super Referente when modal opens
  useEffect(() => {
    if (user.role === "super_referente" && user.unit_id) {
      console.log('🔄 [EDIT MODAL] Loading referenti for Super Referente, unit_id:', user.unit_id);
      axios.get(`${API}/users/referenti/${user.unit_id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      }).then(res => {
        console.log('✅ [EDIT MODAL] Referenti loaded for Super Referente:', res.data);
        setReferentiUnit(res.data);
      }).catch(err => {
        console.error("❌ [EDIT MODAL] Error fetching referenti for Super Referente:", err);
        setReferentiUnit([]);
      });
    }
  }, [user.role, user.unit_id]);

  // NEW: Load servizi for existing commesse when modal opens (for all roles with dynamic services)
  useEffect(() => {
    if ((formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa" ||
         formData.role === "responsabile_store" || formData.role === "responsabile_presidi" ||
         formData.role === "store_assist" || formData.role === "promoter_presidi" ||
         formData.role === "area_manager") && 
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
      console.log('⚠️ EditUser: unitId vuoto, reset stati');
      setServiziDisponibili([]);
      setReferentiUnit([]);
      return;
    }
    
    try {
      console.log('🔄 EditUser: Fetching servizi for unit:', unitId);
      const selectedUnitObj = units.find(u => u.id === unitId);
      console.log('🔍 EditUser: selectedUnitObj:', selectedUnitObj);
      console.log('🔍 EditUser: commesse_autorizzate:', selectedUnitObj?.commesse_autorizzate);
      
      if (!selectedUnitObj) {
        console.warn('⚠️ EditUser: Unit non trovata!');
        setServiziDisponibili([]);
        setReferentiUnit([]);
        return;
      }
      
      // IMPORTANTE: Non bloccare se non ci sono commesse, i referenti vanno caricati comunque!
      if (!selectedUnitObj.commesse_autorizzate || selectedUnitObj.commesse_autorizzate.length === 0) {
        console.warn('⚠️ EditUser: Unit senza commesse autorizzate, ma carico comunque i referenti');
        setServiziDisponibili([]);
        // NON fare return qui! Continua per caricare i referenti
      }
      
      const allServizi = [];
      if (selectedUnitObj.commesse_autorizzate && selectedUnitObj.commesse_autorizzate.length > 0) {
        for (const commessaId of selectedUnitObj.commesse_autorizzate) {
          try {
            const response = await axios.get(`${API}/commesse/${commessaId}/servizi`);
            allServizi.push(...response.data);
          } catch (error) {
            console.error(`EditUser: Error fetching servizi for commessa ${commessaId}:`, error);
          }
        }
      }
      
      console.log('✅ EditUser: Servizi loaded for unit:', allServizi.length);
      setServiziDisponibili(allServizi);
      
      // Fetch referenti for this unit
      try {
        console.log('🔄 EditUser: Fetching referenti for unit:', unitId);
        const token = localStorage.getItem('token');
        const refResponse = await axios.get(`${API}/users/referenti/${unitId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        console.log('✅ EditUser: Referenti loaded for unit:', refResponse.data.length);
        console.log('✅ EditUser: Referenti data:', refResponse.data);
        setReferentiUnit(refResponse.data);
      } catch (error) {
        console.error("❌ EditUser: Error fetching referenti for unit:", error);
        console.error("❌ EditUser: Error details:", error.response?.data);
        setReferentiUnit([]);
      }
    } catch (error) {
      console.error("EditUser: Error fetching servizi for unit:", error);
      setServiziDisponibili([]);
      setReferentiUnit([]);
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
      
      // Use new endpoint that directly returns servizi filtered by sub_agenzia
      const response = await axios.get(`${API}/cascade/servizi-by-sub-agenzia/${subAgenziaId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      console.log('✅ EditUser: Servizi loaded for sub agenzia:', response.data.length);
      setServiziDisponibili(response.data);
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
      
      // Only include password if it was filled in (for password reset)
      if (!cleanData.password || cleanData.password.trim() === '') {
        delete cleanData.password;
      }
      
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
      
      // FIX: Close modal immediately before async operation
      onClose();
      
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
      // Carica i servizi per la commessa selezionata (per responsabile/backoffice commessa e ruoli store/presidi/area manager)
      if (formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa" ||
          formData.role === "responsabile_store" || formData.role === "responsabile_presidi" ||
          formData.role === "store_assist" || formData.role === "promoter_presidi" ||
          formData.role === "area_manager") {
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
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  {/* Admin can create all roles */}
                  {currentUser?.role === 'admin' && (
                    <>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="super_referente">Super Referente</SelectItem>
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
                    </>
                  )}
                  
                  {/* Responsabile Commessa can create limited roles */}
                  {currentUser?.role === 'responsabile_commessa' && (
                    <>
                      <SelectItem value="agente">Agente</SelectItem>
                      <SelectItem value="operatore">Operatore</SelectItem>
                      <SelectItem value="store_assist">Store Assistant</SelectItem>
                      <SelectItem value="agente_specializzato">Agente Specializzato</SelectItem>
                      <SelectItem value="promoter_presidi">Promoter Presidi</SelectItem>
                      <SelectItem value="backoffice_commessa">BackOffice Commessa</SelectItem>
                      <SelectItem value="backoffice_sub_agenzia">BackOffice Sub Agenzia</SelectItem>
                      <SelectItem value="responsabile_sub_agenzia">Responsabile Sub Agenzia</SelectItem>
                      <SelectItem value="area_manager">Area Manager</SelectItem>
                      <SelectItem value="responsabile_presidi">Responsabile Presidi</SelectItem>
                    </>
                  )}
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

          {/* SUPER REFERENTE: Campo Unit → Referenti Autorizzati */}
          {formData.role === "super_referente" && (
            <>
              <div>
                <Label>Unit *</Label>
                <Select 
                  value={formData.unit_id} 
                  onValueChange={(value) => {
                    setFormData(prev => ({ ...prev, unit_id: value, referenti_autorizzati: [] }));
                    // Fetch referenti for selected unit
                    if (value) {
                      axios.get(`${API}/users/referenti/${value}`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                      }).then(res => {
                        console.log('✅ [EDIT] Referenti loaded for unit:', res.data);
                        setReferentiUnit(res.data);
                      }).catch(err => {
                        console.error("Error fetching referenti for unit:", err);
                        setReferentiUnit([]);
                      });
                    } else {
                      setReferentiUnit([]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.nome || unit.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.unit_id && (
                  <p className="text-xs text-green-600 mt-1">
                    Unit assegnata: {units.find(u => u.id === formData.unit_id)?.nome || units.find(u => u.id === formData.unit_id)?.name || formData.unit_id}
                  </p>
                )}
              </div>

              {formData.unit_id && (
                <div className="col-span-2">
                  <Label>Referenti Autorizzati</Label>
                  <p className="text-sm text-slate-500 mb-2">Seleziona i Referenti che il Super Referente potrà gestire</p>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                    {referentiUnit.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {referentiUnit.map((referente) => (
                          <div key={referente.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-super-ref-${referente.id}`}
                              checked={formData.referenti_autorizzati && formData.referenti_autorizzati.includes(referente.id)}
                              onCheckedChange={(checked) => {
                                const currentReferenti = formData.referenti_autorizzati || [];
                                if (checked) {
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    referenti_autorizzati: [...currentReferenti, referente.id]
                                  }));
                                } else {
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    referenti_autorizzati: currentReferenti.filter(id => id !== referente.id)
                                  }));
                                }
                              }}
                            />
                            <Label htmlFor={`edit-super-ref-${referente.id}`} className="text-sm font-normal cursor-pointer">
                              {referente.username} {referente.email ? `(${referente.email})` : ''}
                            </Label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">Nessun referente trovato per questa Unit</p>
                    )}
                  </div>
                  {formData.referenti_autorizzati && formData.referenti_autorizzati.length > 0 && (
                    <p className="text-sm text-green-600 mt-2">
                      ✓ {formData.referenti_autorizzati.length} Referenti selezionati
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* AGENTE e REFERENTE: Campo Unit → Servizi */}
          {(formData.role === "agente" || formData.role === "referente") && (
            <div>
              <Label htmlFor="unit_id">Unit *</Label>
              <Select value={formData.unit_id} onValueChange={(value) => {
                setFormData(prev => ({ ...prev, unit_id: value, assignment_type: "unit", servizi_autorizzati: [] }));
                handleUnitChange(value);
              }}>
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
          )}

          {/* Campo Sub Agenzia - mostrato solo se assignment_type è "sub_agenzia" e non è per ruoli che hanno sezioni dedicate */}
          {formData.assignment_type === "sub_agenzia" && !(formData.role === "responsabile_commessa" || formData.role === "backoffice_commessa" || 
            formData.role === "responsabile_sub_agenzia" || formData.role === "backoffice_sub_agenzia" ||
            formData.role === "agente_specializzato" || formData.role === "operatore" ||
            formData.role === "store_assist") && (
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
             formData.role === "agente_specializzato" || formData.role === "operatore" ||
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

          {formData.role === "agente" && formData.unit_id && (
            <>
              <div>
                <Label htmlFor="referente_id">Referente</Label>
                <Select value={formData.referente_id} onValueChange={(value) => setFormData({ ...formData, referente_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder={referentiUnit.length > 0 ? "Seleziona referente" : "Nessun referente disponibile per questa unit"} />
                  </SelectTrigger>
                  <SelectContent>
                    {referentiUnit.length > 0 ? (
                      referentiUnit.map((referente) => (
                        <SelectItem key={referente.id} value={referente.id}>
                          {referente.username} ({referente.email})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>Nessun referente disponibile</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {referentiUnit.length === 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    Crea prima un utente Referente per questa Unit
                  </p>
                )}
              </div>
            </>
          )}
          
          {formData.role === "agente" && (
            <>

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

          {/* RESPONSABILE/BACKOFFICE SUB AGENZIA, AGENTE SPECIALIZZATO, OPERATORE: Sub Agenzia → Commesse (multi) → Servizi (multi) - EDIT */}
          {(formData.role === "responsabile_sub_agenzia" || formData.role === "backoffice_sub_agenzia" || 
            formData.role === "agente_specializzato" || formData.role === "operatore") && (
            <>
              <div>
                <Label htmlFor="sub_agenzia_id">Sub Agenzia *</Label>
                <Select value={formData.sub_agenzia_id} onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, sub_agenzia_id: value, assignment_type: "sub_agenzia", commesse_autorizzate: [], servizi_autorizzati: [] }));
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

              {/* Servizi disponibili della Sub Agenzia selezionata */}
              {formData.sub_agenzia_id && serviziDisponibili.length > 0 && (
                <div className="col-span-2">
                  <Label>Servizi Autorizzati *</Label>
                  <div className="border rounded-lg p-4 max-h-48 overflow-y-auto bg-slate-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {serviziDisponibili.map((servizio) => (
                        <div key={servizio.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-servizio-sub-${servizio.id}`}
                            checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                            onCheckedChange={(checked) => handleServizioAutorizzatoChange(servizio.id, checked)}
                          />
                          <Label htmlFor={`edit-servizio-sub-${servizio.id}`} className="text-sm font-normal cursor-pointer">
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

          {/* RESPONSABILE STORE, RESPONSABILE PRESIDI, PROMOTER PRESIDI e AREA MANAGER: Multi Sub Agenzie → Multi Commesse → Servizi separati per commessa - EDIT */}
          {(formData.role === "responsabile_store" || formData.role === "responsabile_presidi" || formData.role === "promoter_presidi" || formData.role === "area_manager") && (
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

          {/* STORE ASSISTANT: Singola Sub Agenzia → Multi Commesse → Servizi separati per commessa - EDIT */}
          {(formData.role === "store_assist") && (
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

export { UsersManagement, CreateUserModal, EditUserModal };
