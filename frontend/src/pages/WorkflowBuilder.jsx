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

const NODE_COLOR_PALETTE = {
  green:   { bg: "#ecfdf5", border: "#a7f3d0", iconBg: "#10b981", iconColor: "#fff", textColor: "#065f46" },
  blue:    { bg: "#eff6ff", border: "#bfdbfe", iconBg: "#3b82f6", iconColor: "#fff", textColor: "#1e3a8a" },
  purple:  { bg: "#faf5ff", border: "#e9d5ff", iconBg: "#a855f7", iconColor: "#fff", textColor: "#581c87" },
  orange:  { bg: "#fff7ed", border: "#fed7aa", iconBg: "#f97316", iconColor: "#fff", textColor: "#7c2d12" },
  yellow:  { bg: "#fefce8", border: "#fef08a", iconBg: "#eab308", iconColor: "#fff", textColor: "#713f12" },
  red:     { bg: "#fef2f2", border: "#fecaca", iconBg: "#ef4444", iconColor: "#fff", textColor: "#7f1d1d" },
  gray:    { bg: "#f8fafc", border: "#cbd5e1", iconBg: "#64748b", iconColor: "#fff", textColor: "#1e293b" },
  indigo:  { bg: "#eef2ff", border: "#c7d2fe", iconBg: "#6366f1", iconColor: "#fff", textColor: "#312e81" },
  violet:  { bg: "#f5f3ff", border: "#ddd6fe", iconBg: "#8b5cf6", iconColor: "#fff", textColor: "#4c1d95" },
  emerald: { bg: "#ecfdf5", border: "#6ee7b7", iconBg: "#059669", iconColor: "#fff", textColor: "#064e3b" },
  rose:    { bg: "#fff1f2", border: "#fecdd3", iconBg: "#f43f5e", iconColor: "#fff", textColor: "#881337" },
  slate:   { bg: "#f1f5f9", border: "#cbd5e1", iconBg: "#475569", iconColor: "#fff", textColor: "#0f172a" },
  amber:   { bg: "#fffbeb", border: "#fde68a", iconBg: "#f59e0b", iconColor: "#fff", textColor: "#78350f" },
  fuchsia: { bg: "#fdf4ff", border: "#f5d0fe", iconBg: "#d946ef", iconColor: "#fff", textColor: "#701a75" },
};

const NODE_ICONS = {
  "message-circle": MessageCircle,
  "send": Send,
  "bot": Bot,
  "calendar": Calendar,
  "calendar-plus": Calendar,
  "clock": Clock,
  "clock-3": Clock,
  "tag": Tag,
  "filter": Filter,
  "check-circle": CheckCircle,
  "check-square": CheckSquare,
  "git-branch": GitBranch,
  "split": GitBranch,
  "corner-down-right": CornerDownRight,
  "message-square-reply": MessageSquare,
  "user-plus": UserPlus,
  "mail": Mail,
  "smartphone": Smartphone,
  "settings": Settings,
  "users": Users,
  "default": Workflow,
};




// ===================================================================
// Componenti estratti da App.js (refactoring giugno 2026)
// ===================================================================

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
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [importingTemplate, setImportingTemplate] = useState(false);
  const [selectedUnitForImport, setSelectedUnitForImport] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState("__all__"); // "__all__" | null (root) | folder id
  const [testModeWorkflow, setTestModeWorkflow] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const { toast } = useToast();

  // Workflows visibili in base alla cartella selezionata
  const visibleWorkflows = workflows.filter((w) => {
    if (selectedFolderId === "__all__") return true;
    if (selectedFolderId === null) return !w.folder_id;
    return w.folder_id === selectedFolderId;
  });

  const handleMoveToFolder = async (workflowId, folderId) => {
    try {
      await axios.post(`${API}/workflows/${workflowId}/move`, { folder_id: folderId }, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      fetchWorkflows();
    } catch (e) {
      toast({ title: "Errore", description: e?.response?.data?.detail || "Impossibile spostare", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchWorkflows();
    fetchTemplates();
  }, [selectedUnit]);

  const fetchTemplates = async () => {
    try {
      const response = await axios.get(`${API}/workflow-templates`);
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const importTemplate = async (templateId) => {
    if (!selectedUnitForImport || selectedUnitForImport === "all") {
      toast({
        title: "Errore",
        description: "Seleziona una Unit specifica per importare il template",
        variant: "destructive",
      });
      return;
    }

    setImportingTemplate(true);
    try {
      const response = await axios.post(
        `${API}/workflow-templates/${templateId}/import?unit_id=${selectedUnitForImport}`
      );
      
      toast({
        title: "Successo",
        description: response.data.message,
      });
      
      setShowTemplateModal(false);
      setSelectedUnitForImport("");
      fetchWorkflows();
    } catch (error) {
      console.error("Error importing template:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'importazione del template",
        variant: "destructive",
      });
    } finally {
      setImportingTemplate(false);
    }
  };

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
            <>
              <Button
                onClick={() => setShowTemplateModal(true)}
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Importa Template
              </Button>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Workflow
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {activeView === "list" ? (
        <div className="flex gap-4">
          <WorkflowFoldersSidebar
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            workflows={workflows}
          />
          <div className="flex-1 min-w-0">
            <WorkflowsList
              workflows={visibleWorkflows}
              units={units}
              selectedUnit={selectedUnit}
              onEdit={handleEditWorkflow}
              onDelete={handleDeleteWorkflow}
              onCopy={handleCopyWorkflow}
              onMoveToFolder={handleMoveToFolder}
              onTestRun={(w) => setTestModeWorkflow(w)}
            />
          </div>
        </div>
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

      {/* Test Mode Dialog */}
      {testModeWorkflow && (
        <WorkflowTestModeDialog
          workflow={testModeWorkflow}
          open={!!testModeWorkflow}
          onClose={() => setTestModeWorkflow(null)}
        />
      )}

      {/* Template Preview & Customize */}
      {previewTemplate && (
        <TemplatePreviewDialog
          template={previewTemplate}
          unitId={selectedUnitForImport}
          open={!!previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onImported={() => {
            toast({ title: "Template importato", description: "Workflow creato con i parametri personalizzati." });
            fetchWorkflows();
          }}
        />
      )}

      {/* Create Workflow Modal */}
      {showCreateModal && (
        <CreateWorkflowModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateWorkflow}
        />
      )}

      {/* Template Import Modal */}
      {showTemplateModal && (
        <Dialog open={true} onOpenChange={() => setShowTemplateModal(false)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>📥 Importa Template Workflow</DialogTitle>
              <DialogDescription>
                Scegli un template pre-configurato da importare per la unit selezionata
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Unit Selection Dropdown */}
              <div>
                <Label htmlFor="unit_select">Seleziona Unit *</Label>
                <select
                  id="unit_select"
                  value={selectedUnitForImport}
                  onChange={(e) => setSelectedUnitForImport(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleziona una unit...</option>
                  {units.filter(u => u.id !== "all").map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Warning if no unit selected */}
              {!selectedUnitForImport && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    💡 Seleziona la Unit per cui vuoi importare il workflow automatico
                  </p>
                </div>
              )}

              {/* Templates List */}
              <div className="space-y-3">
                {templates.map((template) => {
                  const palette = (typeof NODE_COLOR_PALETTE !== "undefined" ? NODE_COLOR_PALETTE : {})[template.color] || { bg: "#f8fafc", border: "#cbd5e1", iconBg: "#64748b", iconColor: "#fff", textColor: "#1e293b" };
                  const Icon = (typeof NODE_ICONS !== "undefined" ? NODE_ICONS : {})[template.icon] || Workflow;
                  return (
                  <div key={template.id} className="border rounded-lg p-4 hover:shadow-md transition-all" style={{ borderColor: palette.border }} data-testid={`tpl-card-${template.id}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: palette.iconBg, color: palette.iconColor }}>
                          <Icon className="w-5 h-5" />
                        </span>
                        <div className="flex-1">
                          <h3 className="font-medium text-lg" style={{ color: palette.textColor }}>{template.name}</h3>
                          <p className="text-sm text-slate-600 mt-1">{template.description}</p>
                        
                        {/* Features */}
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-medium text-slate-700">Funzionalità incluse:</p>
                          <ul className="grid grid-cols-2 gap-1">
                            {template.features.map((feature, idx) => (
                              <li key={idx} className="text-xs text-slate-600 flex items-center">
                                <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Metadata */}
                        <div className="mt-3 flex items-center space-x-4 text-xs text-slate-500">
                          <span>Trigger: {template.trigger}</span>
                          <Badge variant="outline" className="text-xs">{template.nodes_count} nodi</Badge>
                        </div>
                        </div>
                      </div>

                      <Button
                        onClick={() => {
                          if (!selectedUnitForImport) {
                            toast({ title: "Seleziona una Unit", description: "Prima scegli la Unit dove importare il workflow", variant: "destructive" });
                            return;
                          }
                          setShowTemplateModal(false);
                          setPreviewTemplate(template);
                        }}
                        disabled={!selectedUnitForImport || importingTemplate}
                        className="ml-4"
                        data-testid={`tpl-import-${template.id}`}
                      >
                        {importingTemplate ? "Importando..." : "Preview & Importa"}
                      </Button>
                    </div>
                  </div>
                  );
                })}

                {templates.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <p>Nessun template disponibile</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setShowTemplateModal(false)}>
                Chiudi
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// Workflow List Component

const WorkflowsList = ({ workflows, units, selectedUnit, onEdit, onDelete, onCopy, onMoveToFolder, onTestRun }) => {
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [workflowToCopy, setWorkflowToCopy] = useState(null);
  const [folders, setFolders] = useState([]);

  useEffect(() => {
    axios.get(`${API}/workflow-folders`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(r => setFolders(r.data || []))
      .catch(() => setFolders([]));
  }, []);

  const folderById = (id) => folders.find(f => f.id === id);

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
                    {workflow.folder_id && folderById(workflow.folder_id) && (
                      <Badge variant="outline" style={{ borderColor: folderById(workflow.folder_id).color, color: folderById(workflow.folder_id).color }}>
                        {folderById(workflow.folder_id).emoji} {folderById(workflow.folder_id).name}
                      </Badge>
                    )}
                    
                    <div className="flex items-center space-x-1">
                      {onMoveToFolder && (
                        <select
                          className="text-xs border rounded px-1 py-1 bg-white"
                          value={workflow.folder_id || ""}
                          onChange={(e) => onMoveToFolder(workflow.id, e.target.value || null)}
                          title="Sposta in cartella"
                          data-testid={`wf-folder-select-${workflow.id}`}
                        >
                          <option value="">— Senza cartella</option>
                          {folders.map(f => <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>)}
                        </select>
                      )}
                      {onTestRun && (
                        <Button
                          onClick={() => onTestRun(workflow)}
                          size="sm"
                          variant="outline"
                          title="Esegui flusso di prova"
                          data-testid={`wf-test-${workflow.id}`}
                        >
                          <FlaskConical className="w-4 h-4 text-indigo-600" />
                        </Button>
                      )}
                      <Button
                        onClick={() => onEdit(workflow)}
                        size="sm"
                        variant="outline"
                        title="Modifica workflow"
                        data-testid={`workflow-edit-${workflow.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        onClick={() => handleCopyClick(workflow)}
                        size="sm"
                        variant="outline"
                        title="Copia in altra Unit"
                        data-testid={`workflow-copy-${workflow.id}`}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        onClick={() => onDelete(workflow.id)}
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        data-testid={`workflow-delete-${workflow.id}`}
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
                    {unit.nome || unit.name}
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

// === Palette polish FASE D ===

const WorkflowCanvas = ({ workflow, onBack, onSave }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [nodeTypes, setNodeTypes] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [nodeStats, setNodeStats] = useState({});
  const { toast } = useToast();

  // Fetch statistiche per nodo
  useEffect(() => {
    if (!workflow?.id) return;
    axios.get(`${API}/workflows/${workflow.id}/node-stats`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(r => setNodeStats(r.data?.node_counts || {}))
      .catch(() => setNodeStats({}));
  }, [workflow?.id]);

  // Load workflow nodes and edges when workflow is provided
  useEffect(() => {
    if (workflow && workflow.nodes && workflow.edges) {
      setNodes(workflow.nodes || []);
      setEdges(workflow.edges || []);
    }
  }, [workflow]);

  // Augmenta i nodi con badge statistiche se disponibili
  useEffect(() => {
    if (!nodeStats || Object.keys(nodeStats).length === 0) return;
    setNodes((prev) => prev.map((n) => {
      const count = nodeStats[n.id];
      if (count === undefined) return n;
      const baseLabel = (n.data?.originalLabel) || (n.data?.label || "").replace(/\s*•\s*\d+×$/, "");
      return {
        ...n,
        data: { ...n.data, originalLabel: baseLabel, label: `${baseLabel} • ${count}×` },
      };
    }));
  }, [nodeStats]);

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

  // Handle node click to edit
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
    setShowNodeEditor(true);
  }, []);

  // Add new node to canvas
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const reactFlowWrapper = React.useRef(null);

  const addNode = (nodeType, nodeSubtype, nodeName, color, position = null) => {
    const id = `${nodeType}_${Date.now()}`;
    const newNode = {
      id,
      type: 'default',
      position: position || {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100
      },
      data: { 
        label: nodeName,
        nodeType: nodeType,
        nodeSubtype: nodeSubtype,
        config: {}  // Configuration data for the node
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

  // Drag from palette → drop on canvas
  const onDragStart = (event, payload) => {
    event.dataTransfer.setData("application/reactflow-node", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = React.useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);
  const onDrop = React.useCallback((event) => {
    event.preventDefault();
    if (!reactFlowInstance) return;
    const data = event.dataTransfer.getData("application/reactflow-node");
    if (!data) return;
    let payload;
    try { payload = JSON.parse(data); } catch { return; }
    const position = reactFlowInstance.screenToFlowPosition
      ? reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      : reactFlowInstance.project({ x: event.clientX, y: event.clientY });
    addNode(payload.nodeType, payload.nodeSubtype, payload.nodeName, payload.color, position);
  }, [reactFlowInstance]);

  // Update node configuration
  const updateNodeConfig = (nodeId, config) => {
    setNodes((nds) => 
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              config: config
            }
          };
        }
        return node;
      })
    );
    setShowNodeEditor(false);
    setSelectedNode(null);
    
    toast({
      title: "Successo",
      description: "Configurazione nodo aggiornata",
    });
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

  // Test Run (FASE B): esegue il workflow su un lead fittizio SENZA invii reali
  const [testRunOpen, setTestRunOpen] = useState(false);
  const [testRunLoading, setTestRunLoading] = useState(false);
  const [testRunResult, setTestRunResult] = useState(null);
  const [testRunForm, setTestRunForm] = useState({
    nome: "Mario",
    cognome: "Rossi",
    telefono: "+393331234567",
    fake_reply: "",
  });

  const handleTestRun = async () => {
    setTestRunLoading(true);
    setTestRunResult(null);
    try {
      // Salva prima il workflow per usare la versione corrente
      await axios.put(`${API}/workflows/${workflow.id}`, {
        workflow_data: { nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } }
      }, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      const payload = {
        fake_lead: {
          id: `test-lead-${Date.now()}`,
          nome: testRunForm.nome || "Mario",
          cognome: testRunForm.cognome || "Rossi",
          telefono: testRunForm.telefono || "+393331234567",
        },
        fake_reply: testRunForm.fake_reply || null,
      };
      const r = await axios.post(`${API}/workflows/${workflow.id}/test-run`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setTestRunResult({ ok: true, data: r.data });
    } catch (e) {
      setTestRunResult({ ok: false, error: e?.response?.data?.detail || e.message });
    } finally {
      setTestRunLoading(false);
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTestRunOpen(true)}
            data-testid="workflow-test-run-btn"
            className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
          >
            <FlaskConical className="w-4 h-4 mr-2" />
            Test Run
          </Button>
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handlePublish}>
            <Target className="w-4 h-4 mr-2" />
            Pubblica
          </Button>
        </div>
      </div>
      
      <div className="flex h-[calc(100%-73px)]">
        {/* Sidebar con nodi disponibili — enhanced */}
        <div className="w-72 border-r border-slate-200 p-3 bg-slate-50 overflow-y-auto max-h-full">
          <div className="sticky top-0 bg-slate-50 pb-2 z-10 space-y-2">
            <h3 className="font-medium text-slate-700">Nodi Disponibili</h3>
            <Input
              data-testid="wf-palette-search"
              placeholder="Cerca nodo..."
              value={paletteSearch}
              onChange={(e) => setPaletteSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          
          {Object.entries(nodeTypes).map(([categoryKey, category]) => {
            const filteredSubtypes = Object.entries(category.subtypes).filter(([k, s]) => {
              if (!paletteSearch) return true;
              const q = paletteSearch.toLowerCase();
              return (s.name || "").toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q) || k.toLowerCase().includes(q);
            });
            if (filteredSubtypes.length === 0) return null;
            return (
              <div key={categoryKey} className="mb-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 px-1">{category.name}</h4>
                <div className="space-y-1.5">
                  {filteredSubtypes.map(([subtypeKey, subtype]) => {
                    const palette = NODE_COLOR_PALETTE[subtype.color] || NODE_COLOR_PALETTE.gray;
                    const IconComp = NODE_ICONS[subtype.icon] || NODE_ICONS.default;
                    return (
                      <button
                        key={subtypeKey}
                        type="button"
                        draggable
                        onDragStart={(e) => onDragStart(e, { nodeType: categoryKey, nodeSubtype: subtypeKey, nodeName: subtype.name, color: subtype.color })}
                        onClick={() => addNode(categoryKey, subtypeKey, subtype.name, subtype.color)}
                        className="w-full text-left p-2.5 rounded-lg border transition-all hover:shadow-sm hover:scale-[1.01] flex items-start gap-2 cursor-grab active:cursor-grabbing"
                        style={{ background: palette.bg, borderColor: palette.border }}
                        data-testid={`palette-node-${subtypeKey}`}
                      >
                        <span className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: palette.iconBg, color: palette.iconColor }}>
                          <IconComp className="w-4 h-4" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="text-xs font-semibold block truncate" style={{ color: palette.textColor }}>{subtype.name}</span>
                          <span className="text-[10px] block leading-tight mt-0.5 line-clamp-2" style={{ color: palette.textColor, opacity: 0.7 }}>{subtype.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Canvas area with React Flow */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
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
                  <p className="text-slate-500 text-sm">Trascina o clicca un nodo dalla sidebar per aggiungerlo</p>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>

      {/* Node Editor Modal */}
      {showNodeEditor && selectedNode && (
        <NodeEditorModal
          node={selectedNode}
          nodeTypes={nodeTypes}
          allNodes={nodes}
          onClose={() => {
            setShowNodeEditor(false);
            setSelectedNode(null);
          }}
          onSave={(config) => updateNodeConfig(selectedNode.id, config)}
        />
      )}

      {/* Test Run Dialog (FASE B) */}
      <Dialog open={testRunOpen} onOpenChange={setTestRunOpen}>
        <DialogContent className="max-w-2xl" data-testid="workflow-test-run-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-indigo-600" />
              Test Run del Workflow
            </DialogTitle>
            <DialogDescription>
              Esegue il workflow su un lead fittizio. <strong>NON</strong> verranno inviati messaggi WhatsApp/email/SMS reali.
              Usalo per verificare il flusso e i rami delle condizioni.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome lead fittizio</Label>
              <Input value={testRunForm.nome} onChange={(e) => setTestRunForm({ ...testRunForm, nome: e.target.value })} data-testid="test-run-nome" />
            </div>
            <div>
              <Label className="text-xs">Cognome</Label>
              <Input value={testRunForm.cognome} onChange={(e) => setTestRunForm({ ...testRunForm, cognome: e.target.value })} data-testid="test-run-cognome" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Telefono</Label>
              <Input value={testRunForm.telefono} onChange={(e) => setTestRunForm({ ...testRunForm, telefono: e.target.value })} data-testid="test-run-telefono" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Risposta simulata del lead (opzionale)</Label>
              <Input
                value={testRunForm.fake_reply}
                onChange={(e) => setTestRunForm({ ...testRunForm, fake_reply: e.target.value })}
                placeholder="Es. 'Si, sono interessato' — se il workflow ha un nodo 'Attendi Risposta'"
                data-testid="test-run-reply"
              />
            </div>
          </div>

          {testRunResult && (
            <div className={`mt-2 p-3 rounded-lg border text-sm ${testRunResult.ok ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`} data-testid="test-run-result">
              <div className="font-semibold mb-2">
                {testRunResult.ok ? "✅ Test completato" : "❌ Errore nel test"}
              </div>
              <pre className="text-xs bg-white/60 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-64">
                {JSON.stringify(testRunResult.ok ? testRunResult.data : testRunResult.error, null, 2)}
              </pre>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setTestRunOpen(false); setTestRunResult(null); }}>
              Chiudi
            </Button>
            <Button
              onClick={handleTestRun}
              disabled={testRunLoading}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="test-run-execute-btn"
            >
              {testRunLoading ? "Esecuzione..." : "Esegui Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Node Editor Modal Component

const NodeEditorModal = ({ node, nodeTypes, allNodes = [], onClose, onSave }) => {
  const [config, setConfig] = useState(node.data.config || {});
  // NEW (FASE C feb 2026): caricamento tag esistenti per nodi add_tag / remove_tag
  const [leadTags, setLeadTags] = useState([]);
  const [newTagName, setNewTagName] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const subtype = node.data.nodeSubtype;
  const isTagNode = subtype === "add_tag" || subtype === "remove_tag";
  const isGoToNode = subtype === "go_to";
  const isMatchValueNode = subtype === "match_value";
  const isIfElseNode = subtype === "if_else";

  useEffect(() => {
    if (!isTagNode) return;
    axios.get(`${API}/lead-tags`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(r => setLeadTags(Array.isArray(r.data) ? r.data : []))
      .catch(() => setLeadTags([]));
  }, [isTagNode]);

  const createTag = async () => {
    const name = (newTagName || "").trim();
    if (!name) return;
    setCreatingTag(true);
    try {
      const r = await axios.post(`${API}/lead-tags`, { name, label: name }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setLeadTags(prev => [...prev, r.data]);
      setConfig({ ...config, tag: r.data.name });
      setNewTagName("");
    } catch (e) {
      alert(e?.response?.data?.detail || "Impossibile creare il tag");
    } finally {
      setCreatingTag(false);
    }
  };

  const getNodeTypeInfo = () => {
    const category = nodeTypes[node.data.nodeType];
    if (!category) return null;
    return category.subtypes[node.data.nodeSubtype];
  };

  const nodeInfo = getNodeTypeInfo();

  const handleSave = () => {
    onSave(config);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configura Nodo: {node.data.label}</DialogTitle>
          <DialogDescription>
            Configura i parametri per questo nodo del workflow
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Node Type Info */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${
                nodeInfo?.color === 'green' ? 'bg-green-500' :
                nodeInfo?.color === 'blue' ? 'bg-blue-500' :
                nodeInfo?.color === 'purple' ? 'bg-purple-500' :
                nodeInfo?.color === 'orange' ? 'bg-orange-500' :
                'bg-gray-500'
              }`}></div>
              <h3 className="font-medium">{node.data.label}</h3>
            </div>
            <p className="text-sm text-slate-600">{nodeInfo?.description}</p>
          </div>

          {/* Configuration Fields */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="node_name">Nome Nodo</Label>
              <Input
                id="node_name"
                value={config.name || node.data.label}
                onChange={(e) => setConfig({...config, name: e.target.value})}
                placeholder="Nome personalizzato per il nodo"
              />
            </div>

            <div>
              <Label htmlFor="node_description">Descrizione</Label>
              <textarea
                id="node_description"
                value={config.description || ''}
                onChange={(e) => setConfig({...config, description: e.target.value})}
                placeholder="Descrizione dettagliata del comportamento"
                className="w-full p-2 border border-gray-300 rounded-lg min-h-[100px]"
              />
            </div>

            {/* Additional config based on node type */}
            {node.data.nodeType === 'triggers' && (
              <div>
                <Label htmlFor="trigger_event">Evento Trigger</Label>
                <Input
                  id="trigger_event"
                  value={config.event || ''}
                  onChange={(e) => setConfig({...config, event: e.target.value})}
                  placeholder="Es: lead_created, status_changed"
                />
              </div>
            )}

            {node.data.nodeType === 'actions' && (isTagNode) && (
              <div className="border border-yellow-200 bg-yellow-50/50 rounded-lg p-4 space-y-3" data-testid="tag-node-config">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="w-4 h-4 text-yellow-700" />
                  {subtype === "add_tag" ? "Tag da AGGIUNGERE al lead" : "Tag da RIMUOVERE dal lead"}
                </Label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  value={config.tag || ""}
                  onChange={(e) => setConfig({ ...config, tag: e.target.value })}
                  data-testid="tag-node-select"
                >
                  <option value="">Seleziona un tag...</option>
                  {leadTags.map(t => (
                    <option key={t.id} value={t.name}>{t.label || t.name}</option>
                  ))}
                </select>
                {subtype === "add_tag" && (
                  <div className="flex gap-2 pt-2 border-t border-yellow-200">
                    <Input
                      placeholder="Crea nuovo tag (es. lead_caldo)"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      data-testid="new-tag-name-input"
                    />
                    <Button
                      type="button"
                      onClick={createTag}
                      disabled={!newTagName.trim() || creatingTag}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white"
                      data-testid="create-tag-btn"
                    >
                      {creatingTag ? "..." : "Crea"}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {node.data.nodeType === 'actions' && isGoToNode && (
              <div className="border border-purple-200 bg-purple-50/50 rounded-lg p-4 space-y-3" data-testid="goto-node-config">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <CornerDownRight className="w-4 h-4 text-purple-700" />
                  Salta al nodo
                </Label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  value={config.target_node_id || ""}
                  onChange={(e) => setConfig({ ...config, target_node_id: e.target.value })}
                  data-testid="goto-target-select"
                >
                  <option value="">Seleziona il nodo target...</option>
                  {allNodes.filter(n => n.id !== node.id).map(n => (
                    <option key={n.id} value={n.id}>
                      [{n.data.nodeType}/{n.data.nodeSubtype}] {n.data.label || n.id}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-purple-700/80">
                  L'esecuzione del workflow continuerà direttamente da questo nodo, ignorando i collegamenti
                  visivi. Utile per cicli o branch riassuntivi.
                </p>
              </div>
            )}

            {node.data.nodeType === 'conditions' && isIfElseNode && (
              <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-4 space-y-3" data-testid="if-else-config">
                <Label className="text-sm font-semibold">Condizione If/Else</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Campo</Label>
                    <Input
                      value={config.field || ""}
                      onChange={(e) => setConfig({ ...config, field: e.target.value })}
                      placeholder="es. lead.status"
                      data-testid="if-else-field"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Operatore</Label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                      value={config.op || "equals"}
                      onChange={(e) => setConfig({ ...config, op: e.target.value })}
                      data-testid="if-else-op"
                    >
                      <option value="equals">è uguale a</option>
                      <option value="not_equals">diverso da</option>
                      <option value="contains">contiene</option>
                      <option value="not_contains">NON contiene</option>
                      <option value="gt">maggiore</option>
                      <option value="lt">minore</option>
                      <option value="empty">è vuoto</option>
                      <option value="not_empty">NON è vuoto</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Valore</Label>
                    <Input
                      value={config.value || ""}
                      onChange={(e) => setConfig({ ...config, value: e.target.value })}
                      placeholder="confronto"
                      data-testid="if-else-value"
                    />
                  </div>
                </div>
                <p className="text-xs text-blue-700/80">
                  Collega 2 rami in uscita: handle <code className="bg-white px-1 rounded">yes</code> e <code className="bg-white px-1 rounded">no</code>.
                  Esempio: campo <code>lead.tags</code> + operatore <code>contains</code> + valore <code>lead_caldo</code>.
                </p>
              </div>
            )}

            {node.data.nodeType === 'conditions' && isMatchValueNode && (
              <div className="border border-indigo-200 bg-indigo-50/50 rounded-lg p-4 space-y-3" data-testid="match-value-config">
                <Label className="text-sm font-semibold">Switch / Match Value</Label>
                <div>
                  <Label className="text-xs">Campo da valutare</Label>
                  <Input
                    value={config.field || ""}
                    onChange={(e) => setConfig({ ...config, field: e.target.value })}
                    placeholder="es. lead.commessa_nome"
                    data-testid="match-value-field"
                  />
                </div>
                <div>
                  <Label className="text-xs">Cases (uno per riga: valore|label)</Label>
                  <textarea
                    className="w-full p-2 border border-gray-300 rounded-lg min-h-[100px] font-mono text-xs"
                    value={
                      Array.isArray(config.cases)
                        ? config.cases.map(c => `${c.value}|${c.label || c.value}`).join("\n")
                        : (config.cases || "")
                    }
                    onChange={(e) => {
                      const lines = e.target.value.split("\n").map(l => l.trim()).filter(Boolean);
                      const cases = lines.map(l => {
                        const [v, lab] = l.split("|");
                        return { value: (v || "").trim(), label: (lab || v || "").trim() };
                      });
                      setConfig({ ...config, cases });
                    }}
                    placeholder={"Energia|Energia\nTelefonia|Telefonia\nGas|Gas"}
                    data-testid="match-value-cases"
                  />
                </div>
                <div>
                  <Label className="text-xs">Label ramo default (se nessun match)</Label>
                  <Input
                    value={config.default_label || "default"}
                    onChange={(e) => setConfig({ ...config, default_label: e.target.value })}
                    data-testid="match-value-default"
                  />
                </div>
                <p className="text-xs text-indigo-700/80">
                  Crea un edge in uscita per ogni "case" usando il <strong>label</strong> come <code>sourceHandle</code>.
                  L'esecuzione seguirà il ramo il cui label matcha il valore del campo.
                </p>
              </div>
            )}

            {node.data.nodeType === 'actions' && !isTagNode && !isGoToNode && (
              <>
                <div>
                  <Label htmlFor="action_type">Tipo Azione</Label>
                  <select
                    id="action_type"
                    value={config.action_type || ''}
                    onChange={(e) => setConfig({...config, action_type: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Seleziona...</option>
                    <option value="send_email">Invia Email</option>
                    <option value="send_sms">Invia SMS</option>
                    <option value="update_field">Aggiorna Campo</option>
                    <option value="assign_user">Assegna Utente</option>
                  </select>
                </div>

                {config.action_type && (
                  <div>
                    <Label htmlFor="action_params">Parametri Azione (JSON)</Label>
                    <textarea
                      id="action_params"
                      value={config.params || '{}'}
                      onChange={(e) => setConfig({...config, params: e.target.value})}
                      placeholder='{"to": "user@example.com", "subject": "..."}'
                      className="w-full p-2 border border-gray-300 rounded-lg min-h-[80px] font-mono text-sm"
                    />
                  </div>
                )}
              </>
            )}

            {node.data.nodeType === 'conditions' && !isIfElseNode && !isMatchValueNode && (
              <div>
                <Label htmlFor="condition_expr">Espressione Condizione</Label>
                <Input
                  id="condition_expr"
                  value={config.expression || ''}
                  onChange={(e) => setConfig({...config, expression: e.target.value})}
                  placeholder="Es: lead.status == 'qualified'"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            Salva Configurazione
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Call Center Management Component

export { LeadQualificationManagement, WorkflowBuilderManagement, WorkflowsList, CopyWorkflowModal, CreateWorkflowModal, WorkflowCanvas, NodeEditorModal };
