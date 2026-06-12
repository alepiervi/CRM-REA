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

export { CallCenterManagement, OutboundCallForm };
