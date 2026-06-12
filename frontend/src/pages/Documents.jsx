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
              'Authorization': `Bearer ${localStorage.getItem('token')}`
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
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.mp3,.wav,.ogg,.m4a,.aac,.wma,.flac,audio/*"
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


export { DocumentsManagement };
