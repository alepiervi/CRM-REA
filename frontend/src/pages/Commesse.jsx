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

  const fetchTipologieContrattoAdmin = async (servizioId) => {
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
      
      // Refresh filter options for ClientiManagement
      try {
        await axios.get(`${API}/clienti/filter-options`);
      } catch (error) {
        console.error("Error refreshing filter options:", error);
      }
      
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
      
      // Refresh filter options for ClientiManagement
      try {
        await axios.get(`${API}/clienti/filter-options`);
      } catch (error) {
        console.error("Error refreshing filter options:", error);
      }
      
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
      
      // Refresh filter options for ClientiManagement
      try {
        await axios.get(`${API}/clienti/filter-options`);
      } catch (error) {
        console.error("Error refreshing filter options:", error);
      }
      
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
        fetchTipologieContrattoAdmin(selectedServizio);
      }
      
      // Refresh filter options for ClientiManagement
      try {
        await axios.get(`${API}/clienti/filter-options`);
      } catch (error) {
        console.error("Error refreshing filter options:", error);
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
        fetchTipologieContrattoAdmin(selectedServizio);
      }
      
      // Refresh filter options for ClientiManagement
      try {
        await axios.get(`${API}/clienti/filter-options`);
      } catch (error) {
        console.error("Error refreshing filter options:", error);
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
      
      // Refresh filter options for ClientiManagement
      try {
        await axios.get(`${API}/clienti/filter-options`);
      } catch (error) {
        console.error("Error refreshing filter options:", error);
      }
      
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
      
      // Refresh filter options for ClientiManagement
      try {
        await axios.get(`${API}/clienti/filter-options`);
      } catch (error) {
        console.error("Error refreshing filter options:", error);
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
        fetchTipologieContrattoAdmin(selectedServizio);
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
      await fetchTipologieContrattoAdmin();
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
      await fetchTipologieContrattoAdmin();
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
      
      const response = await axios.post(`${API}/admin/migrate-segmenti`);
      
      console.log('✅ Migration response status:', response.status);
      console.log('✅ Migration response data:', response.data);
      
      toast({
        title: "Successo",
        description: response.data.message,
      });
      
      // Refresh tipologie after migration to get updated count
      console.log('🔄 Refreshing tipologie after migration...');
      await fetchTipologieContrattoAdmin();
      
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
    <div className="space-y-4 md:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
        <h2 className="text-xl md:text-2xl font-bold">Gestione Commesse</h2>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreateModal(true)} size="sm" className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            Nuova Commessa
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Lista Commesse - Scrollable on mobile */}
        <Card className="lg:col-span-1 overflow-hidden">
          <CardHeader className="p-3 md:p-4">
            <CardTitle className="text-base md:text-lg">Commesse</CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-4 pt-0 max-h-[50vh] lg:max-h-none overflow-y-auto">
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
                              fetchTipologieContrattoAdmin(servizio.id);
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
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [availableFolders, setAvailableFolders] = useState([]);
  const { toast } = useToast();

  // Carica configurazione esistente quando si apre il modal
  useEffect(() => {
    if (isOpen && commessa) {
      loadCommessaArubaConfig();
    }
  }, [isOpen, commessa]);

  const loadAvailableFolders = async () => {
    if (!config.url || !config.username || !config.password) {
      toast({
        title: "⚠️ Campi mancanti",
        description: "Inserisci URL, username e password prima di caricare le cartelle",
        variant: "destructive"
      });
      return;
    }
    
    setLoadingFolders(true);
    try {
      const response = await axios.post(`${API}/nextcloud/list-folders`, {
        url: config.url,
        username: config.username,
        password: config.password
      });
      
      if (response.data.success) {
        setAvailableFolders(response.data.folders || []);
        toast({
          title: "✅ Cartelle caricate",
          description: `Trovate ${response.data.folders?.length || 0} cartelle disponibili`
        });
      }
    } catch (error) {
      console.error("Error loading folders:", error);
      toast({
        title: "❌ Errore",
        description: error.response?.data?.detail || "Impossibile caricare le cartelle dal cloud",
        variant: "destructive"
      });
    } finally {
      setLoadingFolders(false);
    }
  };

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
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="url">URL Nextcloud *</Label>
                      <Input
                        id="url"
                        type="url"
                        value={config.url}
                        onChange={(e) => setConfig({ ...config, url: e.target.value })}
                        placeholder="https://vkbu5u.arubadrive.com"
                        required
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Solo URL base (es: https://vkbu5u.arubadrive.com)
                      </p>
                    </div>
                  </div>

                  {/* Credentials */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="username">Username *</Label>
                      <Input
                        id="username"
                        value={config.username}
                        onChange={(e) => setConfig({ ...config, username: e.target.value })}
                        placeholder="crm"
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
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>
                  
                  {/* Load Folders and Select */}
                  <div className="space-y-3 p-4 bg-slate-50 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Cartella Cloud *</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={loadAvailableFolders}
                        disabled={loadingFolders || !config.url || !config.username || !config.password}
                      >
                        {loadingFolders ? (
                          <>
                            <Clock className="w-4 h-4 mr-2 animate-spin" />
                            Caricamento...
                          </>
                        ) : (
                          <>
                            <FolderOpen className="w-4 h-4 mr-2" />
                            Carica Cartelle
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {availableFolders.length > 0 ? (
                      <Select
                        value={config.root_folder_path}
                        onValueChange={(value) => setConfig({ ...config, root_folder_path: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona cartella dal cloud..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFolders.map((folder) => (
                            <SelectItem key={folder.name} value={folder.name}>
                              📁 {folder.display_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={config.root_folder_path}
                        onChange={(e) => setConfig({ ...config, root_folder_path: e.target.value })}
                        placeholder={commessa?.nome || "Nome cartella"}
                        className="bg-white"
                      />
                    )}
                    
                    <p className="text-xs text-slate-500">
                      {availableFolders.length > 0 
                        ? `${availableFolders.length} cartelle disponibili nel cloud`
                        : "Clicca 'Carica Cartelle' per vedere le cartelle disponibili nel cloud"
                      }
                    </p>
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
  const { toast } = useToast();
  
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
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Integrazione Webhook / Zapier</h3>
            
            {/* ID Commessa */}
            <div>
              <Label className="text-sm font-medium text-gray-600">ID Commessa (per configurazione Zapier)</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input 
                  value={commessa.id || 'N/A'} 
                  readOnly 
                  className="flex-1 bg-blue-50 font-mono text-sm"
                />
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    copyToClipboard(commessa.id);
                    toast({
                      title: "Copiato!",
                      description: "ID commessa copiato negli appunti",
                    });
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                💡 Usa questo ID per configurare l'integrazione Zapier
              </p>
            </div>

            {/* URL Webhook */}
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
                    onClick={() => {
                      copyToClipboard(commessa.webhook_zapier);
                      toast({
                        title: "Copiato!",
                        description: "URL webhook copiato negli appunti",
                      });
                    }}
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
    is_active: true,
    has_sub_offerte: false
  });
  const [subOfferte, setSubOfferte] = useState([]);
  const [newSubOfferta, setNewSubOfferta] = useState({ nome: '', descrizione: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Submit main offerta
    const mainOfferta = { 
      ...formData, 
      segmento_id: segmentoId 
    };
    
    try {
      console.log("🎁 Creating main offerta with has_sub_offerte:", formData.has_sub_offerte);
      const result = await onSubmit(mainOfferta);
      console.log("✅ Main offerta created:", result);
      
      // Extract offerta_id from result (could be result.id or result.offerta_id)
      const offertaId = result.id || result.offerta_id;
      
      // If has sub-offerte, create them
      if (formData.has_sub_offerte && subOfferte.length > 0 && offertaId) {
        console.log(`📦 Creating ${subOfferte.length} sub-offerte for offerta ID:`, offertaId);
        
        const API = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
        const token = localStorage.getItem('token');
        
        for (const subOff of subOfferte) {
          console.log("📦 Creating sub-offerta:", subOff.nome);
          const response = await fetch(`${API}/api/offerte`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              nome: subOff.nome,
              descrizione: subOff.descrizione,
              segmento_id: segmentoId,
              parent_offerta_id: offertaId,
              is_active: true,
              has_sub_offerte: false
            })
          });
          
          if (response.ok) {
            console.log("✅ Sub-offerta created:", subOff.nome);
          } else {
            console.error("❌ Failed to create sub-offerta:", subOff.nome, await response.text());
          }
        }
      } else if (formData.has_sub_offerte && subOfferte.length === 0) {
        console.warn("⚠️ has_sub_offerte is true but no sub-offerte added");
      } else if (formData.has_sub_offerte && !offertaId) {
        console.error("❌ has_sub_offerte is true but offerta_id not found in result:", result);
      }
    } catch (error) {
      console.error("❌ Error creating offerta/sub-offerte:", error);
    }
    
    // Reset form
    setFormData({ nome: '', descrizione: '', is_active: true, has_sub_offerte: false });
    setSubOfferte([]);
    setNewSubOfferta({ nome: '', descrizione: '' });
    onClose();
  };

  const handleAddSubOfferta = () => {
    if (newSubOfferta.nome.trim()) {
      setSubOfferte([...subOfferte, { ...newSubOfferta }]);
      setNewSubOfferta({ nome: '', descrizione: '' });
    }
  };

  const handleRemoveSubOfferta = (index) => {
    setSubOfferte(subOfferte.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    setFormData({ nome: '', descrizione: '', is_active: true, has_sub_offerte: false });
    setSubOfferte([]);
    setNewSubOfferta({ nome: '', descrizione: '' });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
          
          {/* NEW: Checkbox for sub-offerte */}
          <div className="flex items-center space-x-2 bg-blue-50 p-3 rounded">
            <input
              type="checkbox"
              id="has_sub_offerte"
              checked={formData.has_sub_offerte}
              onChange={(e) => setFormData({...formData, has_sub_offerte: e.target.checked})}
              className="rounded"
            />
            <Label htmlFor="has_sub_offerte" className="font-semibold text-blue-900">
              Questa offerta ha sotto-offerte (es. Vodafone con varianti)
            </Label>
          </div>
          
          {/* NEW: Sub-offerte form */}
          {formData.has_sub_offerte && (
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50 space-y-3">
              <h4 className="font-semibold text-blue-900">Sotto-Offerte</h4>
              
              {/* List existing sub-offerte */}
              {subOfferte.length > 0 && (
                <div className="space-y-2 mb-3">
                  {subOfferte.map((subOff, index) => (
                    <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                      <div className="flex-1">
                        <p className="font-medium">{subOff.nome}</p>
                        {subOff.descrizione && (
                          <p className="text-sm text-gray-600">{subOff.descrizione}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSubOfferta(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add new sub-offerta */}
              <div className="space-y-2">
                <Label>Aggiungi Sotto-Offerta</Label>
                <Input
                  placeholder="Nome sotto-offerta (es. Vodafone Young, Vodafone Senior...)"
                  value={newSubOfferta.nome}
                  onChange={(e) => setNewSubOfferta({...newSubOfferta, nome: e.target.value})}
                />
                <Input
                  placeholder="Descrizione opzionale"
                  value={newSubOfferta.descrizione}
                  onChange={(e) => setNewSubOfferta({...newSubOfferta, descrizione: e.target.value})}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSubOfferta}
                  disabled={!newSubOfferta.nome.trim()}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Aggiungi Sotto-Offerta
                </Button>
              </div>
            </div>
          )}
          
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


export { CommesseManagement, ArubaConfigModal, CreateCommessaModal, ViewCommessaModal, EditCommessaModal, CreateTipologiaContrattoModal, CreateOffertaModal };
