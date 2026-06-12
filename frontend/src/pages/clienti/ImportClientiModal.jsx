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



// ImportClientiModal — estratto da ClienteModals.jsx (refactoring fase 2)

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


export { ImportClientiModal };
