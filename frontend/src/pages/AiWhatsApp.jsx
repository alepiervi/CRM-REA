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
      
      // FIX: Fetch assistants from separate endpoint if configured
      if (response.data && response.data.configured) {
        try {
          const assistantsResponse = await axios.get(`${API}/ai-assistants`);
          if (assistantsResponse.data && assistantsResponse.data.assistants) {
            setAssistants(assistantsResponse.data.assistants);
          }
        } catch (assistError) {
          console.error("Error fetching assistants:", assistError);
          setAssistants([]);
        }
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
          {config && config.configured ? (
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

      {/* Assistants Management */}
      {assistants && assistants.length > 0 && (
        <AssistantUnitManagement 
          assistants={assistants}
          onRefresh={fetchAIConfig}
        />
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

    // FIX: Close modal immediately before async operation
    onClose();

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


// Assistant Unit Management Component

const AssistantUnitManagement = ({ assistants, onRefresh }) => {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingUnitId, setSavingUnitId] = useState(null);
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

  const handleAssignAssistant = async (unitId, assistantId) => {
    setSavingUnitId(unitId);
    try {
      await axios.put(`${API}/units/${unitId}`, {
        assistant_id: assistantId || null
      });
      
      toast({
        title: "Successo",
        description: "Assistant assegnato correttamente",
      });
      
      // Refresh units
      fetchUnits();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Error assigning assistant:", error);
      toast({
        title: "Errore",
        description: "Errore nell'assegnazione dell'assistant",
        variant: "destructive",
      });
    } finally {
      setSavingUnitId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assegnazione Assistenti per Unit</CardTitle>
        <CardDescription>
          Assegna un assistant OpenAI specifico a ciascuna unit
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Available Assistants Summary */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">Assistants Disponibili:</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {assistants.map((assistant) => (
                <div key={assistant.id} className="text-sm">
                  <span className="font-medium text-blue-800">• {assistant.name}</span>
                  <span className="text-blue-600 text-xs ml-1">({assistant.model})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Units Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3 font-medium text-slate-700">Unit</th>
                  <th className="text-left p-3 font-medium text-slate-700">Assistant Assegnato</th>
                  <th className="text-left p-3 font-medium text-slate-700">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => {
                  const assignedAssistant = assistants.find(a => a.id === unit.assistant_id);
                  return (
                    <tr key={unit.id} className="border-t hover:bg-slate-50">
                      <td className="p-3">
                        <div className="font-medium text-slate-900">{unit.nome}</div>
                        <div className="text-xs text-slate-500">ID: {unit.id.slice(0, 8)}...</div>
                      </td>
                      <td className="p-3">
                        {assignedAssistant ? (
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <div>
                              <div className="font-medium text-slate-900">{assignedAssistant.name}</div>
                              <div className="text-xs text-slate-500">{assignedAssistant.model}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm italic">Nessun assistant assegnato</span>
                        )}
                      </td>
                      <td className="p-3">
                        <select
                          value={unit.assistant_id || ""}
                          onChange={(e) => handleAssignAssistant(unit.id, e.target.value)}
                          disabled={savingUnitId === unit.id}
                          className="w-full max-w-xs p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          <option value="">Nessun assistant</option>
                          {assistants.map((assistant) => (
                            <option key={assistant.id} value={assistant.id}>
                              {assistant.name} ({assistant.model})
                            </option>
                          ))}
                        </select>
                        {savingUnitId === unit.id && (
                          <span className="ml-2 text-xs text-blue-600">Salvando...</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {units.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <p>Nessuna unit disponibile</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// WhatsApp Management Component

const WhatsAppManagement = ({ selectedUnit, units }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [qrSessionData, setQrSessionData] = useState(null); // session_id, phone_number, unit_id
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
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    config.is_connected ? 'bg-green-100' : 'bg-yellow-100'
                  }`}>
                    <MessageCircle className={`w-6 h-6 ${
                      config.is_connected ? 'text-green-600' : 'text-yellow-600'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{config?.phone_number || "WhatsApp Business"}</h3>
                    <p className="text-sm text-slate-500">
                      {config.is_connected ? 'Connesso e Attivo' : 'Configurato - Non Connesso'}
                    </p>
                  </div>
                </div>
                {config.is_connected ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    ✓ Connesso
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                    ⚠ Non Connesso
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Stato Connessione</Label>
                  <p className={`text-sm font-medium ${
                    config.is_connected ? 'text-green-600' : 'text-yellow-600'
                  }`}>
                    {config.is_connected ? 'Attivo' : 'Da Collegare'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Unit</Label>
                  <p className="text-sm font-medium text-slate-700">
                    {units?.find(u => u.id === config.unit_id)?.name || 'N/A'}
                  </p>
                </div>
              </div>

              {config.is_connected ? (
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-800 font-medium">WhatsApp Attivo</span>
                  </div>
                  <p className="text-sm text-green-700 mt-2">
                    ✅ Dispositivo collegato e operativo<br/>
                    📱 Pronto a inviare e ricevere messaggi<br/>
                    🚀 Workflow automation completamente funzionanti
                  </p>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-yellow-800 font-medium">Connessione Richiesta</span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-2">
                    📱 Numero configurato ma non ancora collegato<br/>
                    🔗 Clicca "Connetti WhatsApp" per scansionare il QR code<br/>
                    ⏳ Workflow automation in attesa di connessione
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">WhatsApp Non Configurato</h3>
              <p className="text-slate-600 mb-4">
                Configura WhatsApp Business per iniziare a inviare messaggi automatici.
              </p>
              <Button onClick={() => setShowConfigModal(true)} className="bg-green-600 hover:bg-green-700">
                <MessageCircle className="w-4 h-4 mr-2" />
                Configura Ora
              </Button>
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
          onSuccess={(sessionData) => {
            setShowConfigModal(false);
            setQrSessionData(sessionData);
            setTimeout(() => {
              setShowQRModal(true);
            }, 300);
          }}
          existingConfig={config}
          selectedUnit={selectedUnit}
          units={units}
        />
      )}

      {/* QR Code Modal */}
      {showQRModal && qrSessionData && (
        <WhatsAppQRModal
          sessionData={qrSessionData}
          onClose={() => {
            setShowQRModal(false);
            setQrSessionData(null);
          }}
          onConnected={() => {
            setShowQRModal(false);
            setQrSessionData(null);
            fetchWhatsAppConfig(false);
          }}
        />
      )}
    </div>
  );
};

// WhatsApp Configuration Modal Component

const WhatsAppConfigModal = ({ onClose, onSuccess, existingConfig, selectedUnit, units }) => {
  const [phoneNumber, setPhoneNumber] = useState(existingConfig?.phone_number || "");
  const [unitId, setUnitId] = useState(selectedUnit && selectedUnit !== "all" ? selectedUnit : "");
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
      
      if (!unitId) {
        toast({
          title: "Errore",
          description: "Seleziona una Unit",
          variant: "destructive",
        });
        return;
      }

      const requestData = {
        phone_number: cleanPhoneNumber,
        unit_id: unitId
      };
      
      const response = await axios.post(`${API}/whatsapp-config`, requestData);

      if (response.data.success) {
        toast({
          title: "Successo",
          description: "Configurazione salvata. Ora scansiona il QR code per collegare WhatsApp.",
        });
        
        // Pass session_id and other data back to show QR modal
        onSuccess({
          session_id: response.data.session_id,
          phone_number: cleanPhoneNumber,
          unit_id: unitId
        });
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
          {/* Unit Selection */}
          <div>
            <Label htmlFor="unit-select">Unit *</Label>
            <select
              id="unit-select"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={selectedUnit && selectedUnit !== "all"}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">Seleziona Unit...</option>
              {units && units.filter(u => u.id !== "all").map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.nome}
                </option>
              ))}
            </select>
            {selectedUnit && selectedUnit !== "all" && (
              <p className="text-xs text-gray-500 mt-1">
                Unit preselezionata dal filtro
              </p>
            )}
          </div>

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

// WhatsApp Mock Modal Component (Development Mode)

const WhatsAppQRModal = ({ sessionData, onClose, onConnected }) => {
  const [qrCode, setQrCode] = useState(null);
  const [qrImage, setQrImage] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    if (!sessionData?.session_id) return;
    
    let pollInterval;
    
    const fetchQRCode = async () => {
      try {
        const response = await axios.get(`${API}/whatsapp-qr/${sessionData.session_id}`);
        
        if (response.data.status === 'connected') {
          setStatus('connected');
          setLoading(false);
          clearInterval(pollInterval);
          toast({
            title: "✅ WhatsApp Connesso!",
            description: "Dispositivo collegato con successo",
          });
          setTimeout(() => onConnected(), 2000);
        } else if (response.data.available && response.data.qr) {
          setQrCode(response.data.qr);
          setQrImage(response.data.qr_image);
          setStatus('qr_ready');
          setLoading(false);
        } else if (response.data.status === 'not_found') {
          setStatus('error');
          setLoading(false);
          toast({
            title: "Errore",
            description: "Sessione non trovata. Riprova.",
            variant: "destructive",
          });
        } else {
          setStatus('initializing');
        }
      } catch (error) {
        console.error('Error fetching QR code:', error);
        setStatus('error');
        setLoading(false);
      }
    };
    
    fetchQRCode();
    pollInterval = setInterval(fetchQRCode, 3000);
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [sessionData]);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-center">
            {status === 'connected' ? '✅ WhatsApp Connesso!' : '📱 Collega WhatsApp'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {status === 'connected' 
              ? 'Dispositivo collegato con successo' 
              : 'Scansiona il QR code con WhatsApp'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="w-full bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-300 rounded-lg p-8">
              {loading || status === 'initializing' ? (
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 text-green-500 animate-pulse" />
                  <p className="text-sm text-slate-600">Generazione QR Code...</p>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto mt-2"></div>
                </div>
              ) : status === 'connected' ? (
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-lg font-bold text-green-600 mb-2">Connesso!</p>
                  <p className="text-sm text-slate-600">
                    WhatsApp collegato per: <span className="font-semibold">{sessionData?.phone_number}</span>
                  </p>
                </div>
              ) : status === 'qr_ready' && qrImage ? (
                <div className="text-center">
                  <div className="bg-white p-4 rounded-lg inline-block mb-4">
                    <img src={qrImage} alt="WhatsApp QR Code" className="w-64 h-64" />
                  </div>
                  <p className="text-sm text-slate-600 font-medium">
                    Scansiona con WhatsApp
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-red-600">Errore nel caricamento del QR Code</p>
                </div>
              )}
            </div>
          </div>

          {status === 'qr_ready' && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-xs text-blue-900">
                  <p className="font-semibold mb-1">Come Collegare:</p>
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Apri WhatsApp sul tuo telefono</li>
                    <li>Vai su Impostazioni → Dispositivi collegati</li>
                    <li>Tocca "Collega un dispositivo"</li>
                    <li>Scansiona questo QR code</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            type="button" 
            variant="outline"
            className="w-full" 
            onClick={onClose}
            disabled={loading}
          >
            Chiudi
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

export { AIConfigurationManagement, AIConfigModal, AssistantUnitManagement, WhatsAppManagement, WhatsAppConfigModal, WhatsAppQRModal, LeadWhatsAppValidator };
