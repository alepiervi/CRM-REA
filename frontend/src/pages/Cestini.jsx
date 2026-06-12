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

const ClientiCestinoManagement = () => {
  const [deletedClienti, setDeletedClienti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { toast } = useToast();

  const fetchDeletedClienti = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/clienti-cestino`);
      if (response.data.success) {
        setDeletedClienti(response.data.clienti || []);
      }
    } catch (error) {
      console.error("Error fetching deleted clienti:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare il cestino clienti",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedClienti();
  }, []);

  const handleRestore = async (clienteId, clienteName) => {
    if (!window.confirm(`Sei sicuro di voler ripristinare "${clienteName}"?`)) return;
    
    try {
      setRestoring(clienteId);
      const response = await axios.post(`${API}/clienti-cestino/${clienteId}/ripristina`);
      
      if (response.data.success) {
        toast({
          title: "Cliente Ripristinato",
          description: `${clienteName} è stato ripristinato e assegnato a ${response.data.assigned_to_name || 'nessuno'}`,
        });
        fetchDeletedClienti();
      }
    } catch (error) {
      console.error("Error restoring cliente:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nel ripristino del cliente",
        variant: "destructive"
      });
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async (clienteId, clienteName) => {
    if (!window.confirm(`ATTENZIONE: Stai per eliminare DEFINITIVAMENTE "${clienteName}". Questa azione non può essere annullata. Continuare?`)) return;
    
    try {
      setDeleting(clienteId);
      const response = await axios.delete(`${API}/clienti-cestino/${clienteId}/elimina-definitivo`);
      
      if (response.data.success) {
        toast({
          title: "Cliente Eliminato",
          description: `${clienteName} è stato eliminato definitivamente`,
        });
        fetchDeletedClienti();
      }
    } catch (error) {
      console.error("Error permanently deleting cliente:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'eliminazione definitiva",
        variant: "destructive"
      });
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-lg p-6 text-white shadow-lg">
        <div className="flex items-center space-x-3">
          <Trash2 className="w-8 h-8" />
          <div>
            <h2 className="text-2xl font-bold">Cestino Clienti</h2>
            <p className="text-red-100">Gestisci i clienti eliminati - Solo Amministratori</p>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <Card className="border-l-4 border-l-orange-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Trash2 className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Clienti nel cestino</p>
                <p className="text-2xl font-bold text-slate-800">{deletedClienti.length}</p>
              </div>
            </div>
            <Button onClick={fetchDeletedClienti} variant="outline" size="sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Aggiorna
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista Clienti Eliminati */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Archive className="w-5 h-5 text-slate-600" />
            <span>Clienti Eliminati</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : deletedClienti.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Trash2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg">Il cestino è vuoto</p>
              <p className="text-sm">I clienti eliminati appariranno qui</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Sub Agenzia</TableHead>
                    <TableHead>Eliminato da</TableHead>
                    <TableHead>Data Eliminazione</TableHead>
                    <TableHead>Ultimo Assegnato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedClienti.map((cliente) => (
                    <TableRow key={cliente.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900">
                            {cliente.nome} {cliente.cognome}
                          </p>
                          <p className="text-sm text-slate-500">{cliente.telefono || cliente.email || 'N/A'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{cliente.sub_agenzia_nome || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-red-600">
                            {cliente.deleted_by_username || 'Sconosciuto'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">
                          {formatDate(cliente.deleted_at)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">
                          {cliente.last_assigned_to ? 
                            <Badge variant="outline" className="text-blue-600">
                              {cliente.last_assigned_to.substring(0, 8)}...
                            </Badge> : 
                            <span className="text-slate-400">Nessuno</span>
                          }
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {/* View Logs */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedCliente(cliente);
                              setShowLogsModal(true);
                            }}
                            title="Visualizza Log"
                          >
                            <FileText className="w-4 h-4 text-slate-500" />
                          </Button>
                          
                          {/* Restore */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(cliente.id, `${cliente.nome} ${cliente.cognome}`)}
                            disabled={restoring === cliente.id}
                            className="text-green-600 border-green-600 hover:bg-green-50"
                          >
                            {restoring === cliente.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Ripristina
                              </>
                            )}
                          </Button>
                          
                          {/* Permanent Delete */}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handlePermanentDelete(cliente.id, `${cliente.nome} ${cliente.cognome}`)}
                            disabled={deleting === cliente.id}
                          >
                            {deleting === cliente.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4 mr-1" />
                                Elimina
                              </>
                            )}
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

      {/* Logs Modal */}
      {showLogsModal && selectedCliente && (
        <Dialog open={showLogsModal} onOpenChange={setShowLogsModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span>Log Eliminazione: {selectedCliente.nome} {selectedCliente.cognome}</span>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Deletion Info */}
              <Card className="border-l-4 border-l-red-500">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-red-600 mb-2">Dettagli Eliminazione</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Eliminato da</p>
                      <p className="font-medium">{selectedCliente.deleted_by_username || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Data</p>
                      <p className="font-medium">{formatDate(selectedCliente.deleted_at)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Ultimo Status</p>
                      <p className="font-medium">{selectedCliente.last_status || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Sub Agenzia</p>
                      <p className="font-medium">{selectedCliente.sub_agenzia_nome || 'N/A'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Logs */}
              <div>
                <h4 className="font-semibold text-slate-700 mb-3">Cronologia Azioni</h4>
                {selectedCliente.deletion_logs && selectedCliente.deletion_logs.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCliente.deletion_logs.map((log, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-slate-50 rounded-lg">
                        <div className={`p-1.5 rounded-full ${
                          log.metadata?.action_type === 'soft_delete' ? 'bg-red-100' : 'bg-green-100'
                        }`}>
                          {log.metadata?.action_type === 'soft_delete' ? (
                            <Trash2 className="w-4 h-4 text-red-600" />
                          ) : (
                            <RotateCcw className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{log.description}</p>
                          <p className="text-xs text-slate-500">
                            {formatDate(log.timestamp)} • {log.performed_by_username || 'Sistema'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">Nessun log disponibile</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLogsModal(false)}>
                Chiudi
              </Button>
              <Button
                onClick={() => {
                  handleRestore(selectedCliente.id, `${selectedCliente.nome} ${selectedCliente.cognome}`);
                  setShowLogsModal(false);
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Ripristina Cliente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// Leads Cestino Management Component

const LeadsCestinoManagement = () => {
  const [deletedLeads, setDeletedLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { toast } = useToast();

  const fetchDeletedLeads = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/leads-cestino`);
      if (response.data.success) {
        setDeletedLeads(response.data.leads || []);
      }
    } catch (error) {
      console.error("Error fetching deleted leads:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare il cestino lead",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletedLeads();
  }, []);

  const handleRestore = async (leadId, leadName) => {
    if (!window.confirm(`Sei sicuro di voler ripristinare "${leadName}"?`)) return;
    
    try {
      setRestoring(leadId);
      const response = await axios.post(`${API}/leads-cestino/${leadId}/ripristina`);
      
      if (response.data.success) {
        toast({
          title: "Lead Ripristinato",
          description: `${leadName} è stato ripristinato e assegnato a ${response.data.assigned_to_name || 'nessuno'}`,
        });
        fetchDeletedLeads();
      }
    } catch (error) {
      console.error("Error restoring lead:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nel ripristino del lead",
        variant: "destructive"
      });
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async (leadId, leadName) => {
    if (!window.confirm(`ATTENZIONE: Stai per eliminare DEFINITIVAMENTE "${leadName}". Questa azione non può essere annullata. Continuare?`)) return;
    
    try {
      setDeleting(leadId);
      const response = await axios.delete(`${API}/leads-cestino/${leadId}/elimina-definitivo`);
      
      if (response.data.success) {
        toast({
          title: "Lead Eliminato",
          description: `${leadName} è stato eliminato definitivamente`,
        });
        fetchDeletedLeads();
      }
    } catch (error) {
      console.error("Error permanently deleting lead:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'eliminazione definitiva",
        variant: "destructive"
      });
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-6 text-white shadow-lg">
        <div className="flex items-center space-x-3">
          <Trash2 className="w-8 h-8" />
          <div>
            <h2 className="text-2xl font-bold">Cestino Lead</h2>
            <p className="text-purple-100">Gestisci i lead eliminati - Solo Amministratori</p>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <Card className="border-l-4 border-l-purple-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Trash2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Lead nel cestino</p>
                <p className="text-2xl font-bold text-slate-800">{deletedLeads.length}</p>
              </div>
            </div>
            <Button onClick={fetchDeletedLeads} variant="outline" size="sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Aggiorna
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista Lead Eliminati */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Archive className="w-5 h-5 text-slate-600" />
            <span>Lead Eliminati</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : deletedLeads.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Trash2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-lg">Il cestino è vuoto</p>
              <p className="text-sm">I lead eliminati appariranno qui</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead className="hidden md:table-cell">Unit</TableHead>
                    <TableHead className="hidden md:table-cell">Campagna</TableHead>
                    <TableHead>Eliminato da</TableHead>
                    <TableHead className="hidden md:table-cell">Data Eliminazione</TableHead>
                    <TableHead className="hidden md:table-cell">Ultimo Agente</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedLeads.map((lead) => (
                    <TableRow key={lead.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900">
                            {lead.nome} {lead.cognome}
                          </p>
                          <p className="text-sm text-slate-500">{lead.telefono || lead.email || 'N/A'}</p>
                          <p className="text-xs text-slate-400 md:hidden">{lead.unit_nome || 'N/A'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm">{lead.unit_nome || 'N/A'}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm">{lead.campagna || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-red-600">
                            {lead.deleted_by_username || 'Sconosciuto'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-slate-600">
                          {formatDate(lead.deleted_at)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-slate-600">
                          {lead.last_agent_name || 'Non assegnato'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestore(lead.id, `${lead.nome} ${lead.cognome}`)}
                            disabled={restoring === lead.id}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          >
                            {restoring === lead.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="w-4 h-4 mr-1" />
                                <span className="hidden sm:inline">Ripristina</span>
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handlePermanentDelete(lead.id, `${lead.nome} ${lead.cognome}`)}
                            disabled={deleting === lead.id}
                          >
                            {deleting === lead.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4 mr-1" />
                                <span className="hidden sm:inline">Elimina</span>
                              </>
                            )}
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
    </div>
  );
};

// Referente Analytics View Component - Shows only referente's agents and leads data

export { ClientiCestinoManagement, LeadsCestinoManagement };
