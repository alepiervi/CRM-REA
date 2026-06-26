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
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { Switch } from "../../components/ui/switch";
import { useToast } from "../../hooks/use-toast";
import { Toaster } from "../../components/ui/toaster";
import ClienteCustomFieldsManager from "../../components/ClienteCustomFieldsManager";
import {
  useClienteCustomFields,
  useClienteStatusOptions,
  CustomFieldsSection,
  CustomFieldsViewSection,
  validateRequiredCustomFields,
} from "../../components/CustomFieldsRenderer";
import {
  useClienteLock,
  ClienteLockedScreen,
  useActiveClienteLocks,
} from "../../components/ClienteLock";
import { ClienteNotesHistory } from "../../components/ClienteNotesHistory";
import { PermissionsAudit } from "../../components/PermissionsAudit";
import { PostVendita } from "../../components/PostVendita";
import { PassToPostVenditaButton } from "../../components/PassToPostVenditaButton";
import { PostVenditaStatusDot } from "../../components/PostVenditaStatusDot";
import { ClientePostVenditaSection } from "../../components/ClientePostVenditaSection";
import { MultiSelectFilter } from "../../components/MultiSelectFilter";
import { SpokiAdminConfig } from "../../components/spoki/SpokiAdminConfig";
import { AppointmentsCalendar } from "../../components/spoki/AppointmentsCalendar";
import { AIConversations } from "../../components/spoki/AIConversations";
import { LeadConversationsTab } from "../../components/spoki/LeadConversationsTab";
import { WorkflowFoldersSidebar } from "../../components/workflow/WorkflowFoldersSidebar";
import { WorkflowTestModeDialog } from "../../components/workflow/WorkflowTestModeDialog";
import { TemplatePreviewDialog } from "../../components/workflow/TemplatePreviewDialog";
import { TagsManager } from "../../components/tags/TagsManager";

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
} from "../../lib/appUtils";
import { AuthContext, useAuth, AuthProvider } from "../../context/AuthContext";



// ViewClienteModal — estratto da ClienteModals.jsx (refactoring fase 2)

const ViewClienteModal = ({ cliente, onClose, commesse, subAgenzie, servizi }) => {
  const { user } = useAuth();
  const [offertaInfo, setOffertaInfo] = useState(null);
  const [subOffertaInfo, setSubOffertaInfo] = useState(null);  // NEW: Sub-offerta info
  const [servizioInfo, setServizioInfo] = useState(null);  // NEW: Servizio info
  const [assignedUserInfo, setAssignedUserInfo] = useState(null);  // NEW: Assigned user info
  const [simUsersInfo, setSimUsersInfo] = useState({});  // NEW: Cache for SIM assigned users
  
  // NEW: Custom fields for View
  const { fields: customFields, sections: customSections } = useClienteCustomFields(
    cliente?.commessa_id,
    cliente?.tipologia_contratto_id
  );

  // LOCK: acquire lock on mount (blocks other users from opening)
  const {
    loading: lockLoading,
    lockStatus,
    forceRelease: forceReleaseLock,
  } = useClienteLock(cliente?.id, !!cliente?.id);
  
  if (!cliente) return null;
  
  // NEW: Function to get user display name from cache or fetch
  const getUserDisplayName = (userId) => {
    if (!userId) return "N/A";
    if (simUsersInfo[userId]) {
      return simUsersInfo[userId];
    }
    return "Caricamento...";
  };
  
  const getCommessaName = (id) => commesse.find(c => c.id === id)?.nome || 'Non specificato';
  const getSubAgenziaName = (id) => subAgenzie.find(s => s.id === id)?.nome || 'Non specificato';
  const getServizioName = (id) => {
    // Try to get from fetched info first, then from array, then fallback
    if (servizioInfo && servizioInfo.id === id) {
      return servizioInfo.nome;
    }
    return servizi.find(s => s.id === id)?.nome || 'Non specificato';
  };

  // Fetch offerta info when component mounts
  useEffect(() => {
    const fetchOfferta = async () => {
      if (cliente.offerta_id) {
        try {
          const response = await axios.get(`${API}/offerte/${cliente.offerta_id}`);
          setOffertaInfo(response.data);
        } catch (error) {
          console.error("Error fetching offerta:", error);
        }
      }
    };
    fetchOfferta();
  }, [cliente.offerta_id]);
  
  // NEW: Fetch sub-offerta info when component mounts
  useEffect(() => {
    const fetchSubOfferta = async () => {
      if (cliente.sub_offerta_id) {
        try {
          const response = await axios.get(`${API}/offerte/${cliente.sub_offerta_id}`);
          setSubOffertaInfo(response.data);
        } catch (error) {
          console.error("Error fetching sub-offerta:", error);
        }
      }
    };
    fetchSubOfferta();
  }, [cliente.sub_offerta_id]);
  
  // NEW: Fetch servizio info when component mounts
  useEffect(() => {
    const fetchServizio = async () => {
      if (cliente.servizio_id) {
        try {
          const response = await axios.get(`${API}/servizi/${cliente.servizio_id}`);
          setServizioInfo(response.data);
        } catch (error) {
          console.error("Error fetching servizio:", error);
        }
      }
    };
    fetchServizio();
  }, [cliente.servizio_id]);

  // NEW: Fetch assigned user info when component mounts
  useEffect(() => {
    const fetchAssignedUser = async () => {
      if (cliente.assigned_to) {
        try {
          const response = await axios.get(`${API}/users/display-name/${cliente.assigned_to}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          });
          setAssignedUserInfo(response.data);
        } catch (error) {
          console.error("Error fetching assigned user:", error);
        }
      }
    };
    fetchAssignedUser();
  }, [cliente.assigned_to]);

  // NEW: Fetch users info for SIM convergenza
  useEffect(() => {
    const fetchSimUsers = async () => {
      if (cliente.convergenza_items && cliente.convergenza_items.length > 0) {
        const userIds = cliente.convergenza_items
          .map(sim => sim.assigned_user_id)
          .filter(id => id && !simUsersInfo[id]); // Only fetch if not already cached
        
        if (userIds.length === 0) return;
        
        const newUsersInfo = { ...simUsersInfo };
        
        for (const userId of userIds) {
          try {
            const response = await axios.get(`${API}/users/display-name/${userId}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            newUsersInfo[userId] = response.data.display_name;
          } catch (error) {
            console.error(`Error fetching user ${userId}:`, error);
            newUsersInfo[userId] = 'Utente non trovato';
          }
        }
        
        setSimUsersInfo(newUsersInfo);
      }
    };
    fetchSimUsers();
  }, [cliente.convergenza_items]);

  // Helper per verificare se mostrare sezioni condizionali
  const isTelefoniaFastweb = () => {
    const tipologia = cliente.tipologia_contratto?.toLowerCase() || '';
    return tipologia.includes('telefonia') && !tipologia.includes('mobile');
  };

  const isMobile = () => {
    const tipologia = cliente.tipologia_contratto?.toLowerCase() || '';
    return tipologia.includes('mobile');
  };

  const isEnergiaFastweb = () => {
    const tipologia = cliente.tipologia_contratto?.toLowerCase() || '';
    return tipologia.includes('energia') || cliente.codice_pod;
  };

  const isTelepass = () => {
    const tipologia = cliente.tipologia_contratto?.toLowerCase() || '';
    return tipologia.includes('telepass') || cliente.obu;
  };

  // If locked by another user, show the locked screen instead of the full anagrafica
  if (lockStatus && lockStatus.owned_by_me === false) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-lg w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <span className="truncate">Anagrafica: {cliente.nome} {cliente.cognome}</span>
            </DialogTitle>
          </DialogHeader>
          <ClienteLockedScreen
            lockStatus={lockStatus}
            isAdmin={user?.role === 'admin'}
            onForceRelease={forceReleaseLock}
            onClose={onClose}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <span className="truncate">Anagrafica: {cliente.nome} {cliente.cognome}</span>
            </DialogTitle>
            {/* Close button - visible on mobile */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="flex-shrink-0 h-10 w-10 p-0 rounded-full hover:bg-slate-100 md:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <DialogDescription className="hidden sm:block">
            Visualizzazione completa di tutti i dati anagrafici del cliente
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* Dati Anagrafici */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <User className="w-4 h-4 mr-2" />
                Dati Anagrafici
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cliente.segmento === 'business' && (
                <div>
                  <Label className="text-sm font-medium text-slate-600">Ragione Sociale</Label>
                  <p className="text-sm">{cliente.ragione_sociale || 'Non specificato'}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Cognome</Label>
                  <p className="text-sm">{cliente.cognome || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Nome</Label>
                  <p className="text-sm">{cliente.nome || 'Non specificato'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Data di Nascita</Label>
                  <p className="text-sm">{cliente.data_nascita || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Luogo di Nascita</Label>
                  <p className="text-sm">{cliente.luogo_nascita || 'Non specificato'}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Codice Fiscale</Label>
                <p className="text-sm font-mono">{cliente.codice_fiscale || 'Non specificato'}</p>
              </div>
              {cliente.segmento === 'business' && (
                <div>
                  <Label className="text-sm font-medium text-slate-600">Partita IVA</Label>
                  <p className="text-sm font-mono">{cliente.partita_iva || 'Non specificato'}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Indirizzo Residenza */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Indirizzo Residenza
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-slate-600">Indirizzo</Label>
                <p className="text-sm" data-testid="view-cliente-indirizzo">{cliente.indirizzo || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Comune</Label>
                <p className="text-sm">{cliente.comune_residenza || 'Non specificato'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Provincia</Label>
                  <p className="text-sm">{cliente.provincia || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">CAP</Label>
                  <p className="text-sm">{cliente.cap || 'Non specificato'}</p>
                </div>
              </div>
              {(cliente.indirizzo_attivazione || cliente.comune_attivazione || cliente.provincia_attivazione || cliente.cap_attivazione) && (
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                  <Label className="text-sm font-semibold text-amber-700">📍 Indirizzo Attivazione / Installazione</Label>
                  {cliente.indirizzo_attivazione && (
                    <div>
                      <Label className="text-xs font-medium text-slate-600">Indirizzo</Label>
                      <p className="text-sm" data-testid="view-cliente-indirizzo-attivazione">{cliente.indirizzo_attivazione}</p>
                    </div>
                  )}
                  {cliente.comune_attivazione && (
                    <div>
                      <Label className="text-xs font-medium text-slate-600">Comune</Label>
                      <p className="text-sm" data-testid="view-cliente-comune-attivazione">{cliente.comune_attivazione}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {cliente.provincia_attivazione && (
                      <div>
                        <Label className="text-xs font-medium text-slate-600">Provincia</Label>
                        <p className="text-sm" data-testid="view-cliente-provincia-attivazione">{cliente.provincia_attivazione}</p>
                      </div>
                    )}
                    {cliente.cap_attivazione && (
                      <div>
                        <Label className="text-xs font-medium text-slate-600">CAP</Label>
                        <p className="text-sm" data-testid="view-cliente-cap-attivazione">{cliente.cap_attivazione}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contatti */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Phone className="w-4 h-4 mr-2" />
                Contatti
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-slate-600">Email</Label>
                <p className="text-sm">{cliente.email || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Cellulare</Label>
                <p className="text-sm">{cliente.telefono || 'Non specificato'}</p>
              </div>
              {cliente.telefono2 && (
                <div>
                  <Label className="text-sm font-medium text-slate-600">Telefono 2</Label>
                  <p className="text-sm">{cliente.telefono2}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Documento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-slate-600">Tipo Documento</Label>
                <p className="text-sm uppercase">{cliente.tipo_documento || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Numero Documento</Label>
                <p className="text-sm font-mono">{cliente.numero_documento || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Rilasciato Il</Label>
                <p className="text-sm">{cliente.data_rilascio || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Da (Luogo Rilascio)</Label>
                <p className="text-sm">{cliente.luogo_rilascio || 'Non specificato'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Scadenza</Label>
                <p className="text-sm">{cliente.scadenza_documento || 'Non specificato'}</p>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Numero Ordine</Label>
                  <p className="text-sm font-mono">{cliente.numero_ordine || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Account</Label>
                  <p className="text-sm">{cliente.account || 'Non specificato'}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Sub Agenzia</Label>
                <p className="text-sm">{getSubAgenziaName(cliente.sub_agenzia_id)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Commessa</Label>
                <p className="text-sm">{getCommessaName(cliente.commessa_id)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Servizio</Label>
                <p className="text-sm">{getServizioName(cliente.servizio_id)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Tipologia Contratto</Label>
                <p className="text-sm capitalize">
                  {cliente.tipologia_contratto?.replace(/_/g, ' ') || 'Non specificato'}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Segmento</Label>
                <p className="text-sm capitalize">
                  {cliente.segmento_nome || cliente.segmento || 'Non specificato'}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-600">Offerta</Label>
                <p className="text-sm">{offertaInfo?.nome || cliente.offerta_id || 'Non specificato'}</p>
              </div>
              {/* NEW: Sub-Offerta */}
              {cliente.sub_offerta_id && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <Label className="text-sm font-semibold text-blue-900">📦 Sotto-Offerta</Label>
                  <p className="text-sm font-medium text-blue-800">
                    {subOffertaInfo?.nome || cliente.sub_offerta_id}
                  </p>
                  {subOffertaInfo?.descrizione && (
                    <p className="text-xs text-blue-700 mt-1">{subOffertaInfo.descrizione}</p>
                  )}
                </div>
              )}
              <div>
                <Label className="text-sm font-medium text-slate-600">Status</Label>
                <span className="inline-flex items-center">
                  <Badge variant={getClienteStatusVariant(cliente.status)}>
                    {formatClienteStatus(cliente.status)}
                  </Badge>
                  <PostVenditaStatusDot cliente={cliente} size="md" />
                </span>
              </div>
              
              {/* NEW: Assigned User */}
              {cliente.assigned_to && (
                <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                  <Label className="text-sm font-semibold text-purple-900">👤 Assegnato a</Label>
                  <p className="text-sm font-medium text-purple-800">
                    {assignedUserInfo?.display_name || cliente.assigned_to}
                  </p>
                  {assignedUserInfo?.username && (
                    <p className="text-xs text-purple-700 mt-1">
                      Username: {assignedUserInfo.username} | Ruolo: {assignedUserInfo.role}
                    </p>
                  )}
                </div>
              )}
              
              <div>
                <Label className="text-sm font-medium text-slate-600">Data Creazione</Label>
                <p className="text-sm">{formatDate(cliente.created_at)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sezione Telefonia Fissa - mostrata se commessa è Telefonia o se ci sono dati telefonia */}
        {(isTelefoniaFastweb() || cliente.tecnologia || cliente.codice_migrazione || cliente.gestore || cliente.numero_portabilita || cliente.convergenza) && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Phone className="w-4 h-4 mr-2" />
                Telefonia Fissa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Tecnologia</Label>
                  <p className="text-sm uppercase">{cliente.tecnologia || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Codice Migrazione</Label>
                  <p className="text-sm">{cliente.codice_migrazione || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Numero Portabilità</Label>
                  <p className="text-sm">{cliente.numero_portabilita || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Gestore</Label>
                  <p className="text-sm">{cliente.gestore || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Convergenza</Label>
                  <p className="text-sm">{cliente.convergenza ? 'Attiva' : 'Non attiva'}</p>
                </div>
              </div>

              {/* SIM Convergenza */}
              {cliente.convergenza && cliente.convergenza_items && cliente.convergenza_items.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-blue-800 mb-2">SIM Associate alla Convergenza</h4>
                  <div className="space-y-2">
                    {cliente.convergenza_items.map((sim, index) => (
                      <div key={index} className="p-3 border rounded bg-gray-50">
                        <h5 className="font-semibold mb-2">SIM #{index + 1}</h5>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <strong>Numero Cellulare:</strong> {sim.numero_cellulare || 'Non specificato'}
                          </div>
                          <div>
                            <strong>ICCID:</strong> {sim.iccid || 'Non specificato'}
                          </div>
                          <div>
                            <strong>Operatore:</strong> {sim.operatore || 'Non specificato'}
                          </div>
                          <div>
                            <strong>Offerta SIM:</strong> {sim.offerta_sim || 'Non specificato'}
                          </div>
                          {sim.assigned_user_id && (
                            <div className="col-span-2 bg-purple-50 p-2 rounded border-l-4 border-purple-400 mt-2">
                              <strong className="text-purple-800">👤 Utente Assegnato:</strong>{' '}
                              <span className="text-purple-900">
                                {getUserDisplayName(sim.assigned_user_id)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sezione Dati Mobile - Condizionale */}
        {isMobile() && cliente.mobile_items && cliente.mobile_items.length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Smartphone className="w-4 h-4 mr-2" />
                Dati Mobile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {cliente.mobile_items.map((mobile, index) => (
                  <div key={index} className="p-3 border rounded bg-gray-50">
                    <h5 className="font-semibold mb-2">SIM #{index + 1}</h5>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <strong>Telefono da Portare:</strong> {mobile.telefono_da_portare || 'Non specificato'}
                      </div>
                      <div>
                        <strong>ICCID:</strong> {mobile.iccid || 'Non specificato'}
                      </div>
                      <div>
                        <strong>Operatore:</strong> {mobile.operatore || 'Non specificato'}
                      </div>
                      <div>
                        <strong>Titolare se Diverso:</strong> {mobile.titolare_diverso || 'Non specificato'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sezione Energia - mostrata se commessa è Energia Fastweb o se ci sono dati energia */}
        {((isEnergiaFastweb() && !isTelepass()) || cliente.codice_pod || cliente.energia_tipologia || cliente.energia_consumo_annuo || cliente.energia_potenza_contatore || cliente.energia_potenza_impegnata || cliente.energia_fornitore_attuale) && !isTelepass() && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Zap className="w-4 h-4 mr-2" />
                Energia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Tipologia</Label>
                  <p className="text-sm">{cliente.energia_tipologia || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Codice POD</Label>
                  <p className="text-sm font-mono">{cliente.codice_pod || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Consumo Annuo</Label>
                  <p className="text-sm">{cliente.energia_consumo_annuo || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Potenza Contatore</Label>
                  <p className="text-sm">{cliente.energia_potenza_contatore || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Potenza Impegnata</Label>
                  <p className="text-sm">{cliente.energia_potenza_impegnata || 'Non specificato'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Fornitore Attuale</Label>
                  <p className="text-sm" data-testid="view-cliente-fornitore-attuale">{cliente.energia_fornitore_attuale || 'Non specificato'}</p>
                </div>
              </div>
              {/* Vecchio intestatario - solo se popolato (Switch con voltura) */}
              {(cliente.energia_vecchio_intestatario_nome || cliente.energia_vecchio_intestatario_cognome || cliente.energia_vecchio_intestatario_cf) && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Vecchio Intestatario (Switch con voltura)</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-600">Nome</Label>
                      <p className="text-sm">{cliente.energia_vecchio_intestatario_nome || 'Non specificato'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-600">Cognome</Label>
                      <p className="text-sm">{cliente.energia_vecchio_intestatario_cognome || 'Non specificato'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-600">Codice Fiscale</Label>
                      <p className="text-sm font-mono">{cliente.energia_vecchio_intestatario_cf || 'Non specificato'}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sezione Telepass - mostrata se commessa è Telepass o se OBU è compilato */}
        {(isTelepass() || cliente.obu) && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <Zap className="w-4 h-4 mr-2" />
                Telepass
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label className="text-sm font-medium text-slate-600">OBU</Label>
                <p className="text-sm font-mono">{cliente.obu || 'Non specificato'}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modalità Pagamento */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <CreditCard className="w-4 h-4 mr-2" />
              Modalità Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-slate-600">Modalità Pagamento</Label>
                <p className="text-sm uppercase">{cliente.modalita_pagamento || 'Non specificato'}</p>
              </div>
              {cliente.modalita_pagamento === 'iban' && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">IBAN</Label>
                    <p className="text-sm font-mono">{cliente.iban || 'Non specificato'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Intestatario se Diverso</Label>
                    <p className="text-sm">{cliente.intestatario_diverso || 'Non specificato'}</p>
                  </div>
                </>
              )}
              {cliente.modalita_pagamento === 'carta_credito' && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Numero Carta</Label>
                    <p className="text-sm font-mono">{cliente.numero_carta || 'Non specificato'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Intestatario Carta</Label>
                    <p className="text-sm">{cliente.intestatario_carta || 'Non specificato'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">CVV</Label>
                    <p className="text-sm">{cliente.cvv_carta || 'Non specificato'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Mese Scadenza</Label>
                    <p className="text-sm">{cliente.mese_carta || 'Non specificato'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Anno Scadenza</Label>
                    <p className="text-sm">{cliente.anno_carta || 'Non specificato'}</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Campi Personalizzati - dinamici in base a (commessa + tipologia) */}
        <div className="mt-4">
          <CustomFieldsViewSection
            fields={customFields}
            sections={customSections}
            values={cliente?.dati_aggiuntivi || {}}
          />
        </div>

        {/* Sezione Post Vendita - evoluzione visibile a tutti gli utenti con accesso al cliente */}
        <div className="mt-4">
          <ClientePostVenditaSection clienteId={cliente?.id} clienteSnapshot={cliente} />
        </div>

        {/* Storico Note - immutabile, read-only in view */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Storico Note
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ClienteNotesHistory
                clienteId={cliente?.id}
                tipo="cliente"
                title="Note Cliente"
                accentColor="blue"
                readOnly={true}
                emptyMessage="Nessuna nota cliente presente."
              />
              <ClienteNotesHistory
                clienteId={cliente?.id}
                tipo="backoffice"
                title="Note Back Office"
                accentColor="orange"
                readOnly={true}
                emptyMessage="Nessuna nota back office presente."
              />
            </div>
          </CardContent>
        </Card>

        <DialogFooter className="mt-6 sticky bottom-0 bg-white pt-4 border-t md:border-t-0 md:pt-0 md:static">
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:justify-between">
            <PassToPostVenditaButton cliente={cliente} userRole={user?.role} />
            <Button onClick={onClose} className="w-full md:w-auto">Chiudi</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
// Duplicate ImportClientiModal removed - using the full version above

// Edit Cliente Modal Component  


export { ViewClienteModal };
