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



// ClientDocumentsModal — estratto da ClienteModals.jsx (refactoring fase 2)

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
            'Authorization': `Bearer ${localStorage.getItem('token')}`
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
      // Get the first error message for details
      const firstError = uploadResults.find(r => !r.success);
      const errorDetail = firstError?.error || "Errore di connessione";
      
      toast({
        title: "Errore Upload - Server Aruba",
        description: `Il documento NON è stato salvato. ${errorDetail}`,
        variant: "destructive",
      });
    } else if (errorCount > 0) {
      toast({
        title: "Upload Parziale",
        description: `${successCount} file caricati, ${errorCount} falliti. I file falliti NON sono stati salvati.`,
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
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center space-x-3 text-lg sm:text-xl">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-slate-900 truncate">Documenti Cliente</h2>
                  <p className="text-sm text-slate-600 truncate">{clientName}</p>
                </div>
              </DialogTitle>
              {/* Close button - always visible on mobile */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="flex-shrink-0 h-10 w-10 p-0 rounded-full hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <DialogDescription className="text-sm text-slate-500 leading-relaxed hidden sm:block">
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
                                        {uploadProgress[file.name].status === 'completed' && 'Salvato su Aruba Drive'}
                                        {uploadProgress[file.name].status === 'error' && (
                                          <span className="text-red-600 font-medium">
                                            NON salvato - {uploadProgress[file.name].error || 'Errore server Aruba'}
                                          </span>
                                        )}
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
                            <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Cloud Storage</th>
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
                                {doc.cloud_path || doc.aruba_drive_path ? (
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span className="text-xs text-slate-600 max-w-xs truncate" title={doc.cloud_path || doc.aruba_drive_path}>
                                      {doc.storage_type === 'nextcloud' && '☁️ '}
                                      {doc.cloud_path || doc.aruba_drive_path}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                    <span className="text-xs text-slate-600">📁 Solo locale</span>
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
        
        {/* Footer with Close button - sticky on mobile */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 md:hidden">
          <Button onClick={onClose} className="w-full">
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};



export { ClientDocumentsModal };
