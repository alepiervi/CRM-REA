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

const ReferenteAnalyticsView = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      let url = `${API}/analytics/referente/${user.id}`;
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await axios.get(url);
      setAnalytics(response.data);
    } catch (error) {
      console.error("Error fetching referente analytics:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Impossibile caricare le analytics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-8 text-center text-slate-600">
        Nessun dato disponibile
      </div>
    );
  }

  const { referente, total_stats, agent_breakdown, outcomes } = analytics;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Analytics Team</h2>
              <p className="text-blue-100">Statistiche dei tuoi agenti e lead</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-white/20 border-white/30 text-white placeholder:text-white/70 w-40"
              placeholder="Da"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-white/20 border-white/30 text-white placeholder:text-white/70 w-40"
              placeholder="A"
            />
            <Button onClick={fetchAnalytics} variant="secondary" size="sm">
              <RefreshCw className="w-4 h-4 mr-1" /> Aggiorna
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Totale Lead</p>
                <p className="text-3xl font-bold text-blue-700">{total_stats?.total_leads || 0}</p>
              </div>
              <Phone className="w-10 h-10 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Contattati</p>
                <p className="text-3xl font-bold text-green-700">{total_stats?.contacted_leads || 0}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Agenti</p>
                <p className="text-3xl font-bold text-purple-700">{agent_breakdown?.length || 0}</p>
              </div>
              <Users className="w-10 h-10 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Tasso Contatto</p>
                <p className="text-3xl font-bold text-orange-700">
                  {total_stats?.total_leads > 0 
                    ? Math.round((total_stats?.contacted_leads / total_stats?.total_leads) * 100) 
                    : 0}%
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Outcomes Breakdown - Totali per Esito */}
      {outcomes && Object.keys(outcomes).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Totale Esiti Lead
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Object.entries(outcomes).sort((a, b) => b[1] - a[1]).map(([esito, count]) => (
                <div key={esito} className="bg-slate-50 rounded-lg p-3 text-center border">
                  <p className="text-2xl font-bold text-slate-700">{count}</p>
                  <p className="text-xs text-slate-500 truncate" title={esito}>{esito || 'Non impostato'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pivot Table - Agenti x Esiti */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Pivot Agenti per Esito
          </CardTitle>
          <p className="text-sm text-slate-500">Dettaglio esiti per ogni agente</p>
        </CardHeader>
        <CardContent>
          {agent_breakdown && agent_breakdown.length > 0 ? (
            <div className="overflow-x-auto">
              {(() => {
                // Collect all unique esiti across all agents
                const allEsiti = new Set();
                agent_breakdown.forEach(agentData => {
                  if (agentData.outcomes) {
                    Object.keys(agentData.outcomes).forEach(e => allEsiti.add(e));
                  }
                });
                const esitiArray = Array.from(allEsiti).sort();
                
                // Calculate totals per esito
                const esitoTotals = {};
                esitiArray.forEach(e => {
                  esitoTotals[e] = agent_breakdown.reduce((sum, agentData) => 
                    sum + (agentData.outcomes?.[e] || 0), 0);
                });
                
                return (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-bold">Agente</TableHead>
                        <TableHead className="text-center font-bold">Totale</TableHead>
                        {esitiArray.map(esito => (
                          <TableHead key={esito} className="text-center text-xs">
                            {esito || 'N/A'}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agent_breakdown.map((agentData, idx) => (
                        <TableRow key={agentData.agent?.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <TableCell className="font-medium">
                            {agentData.agent?.username || 'N/A'}
                          </TableCell>
                          <TableCell className="text-center font-bold text-blue-600">
                            {agentData.total_leads || 0}
                          </TableCell>
                          {esitiArray.map(esito => (
                            <TableCell key={esito} className="text-center">
                              {agentData.outcomes?.[esito] ? (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  esito === 'Nuovo' ? 'bg-gray-100 text-gray-600' :
                                  ['Interessato', 'Venduto', 'Completato', 'Appuntamento', 'Lead Interessato'].includes(esito) 
                                    ? 'bg-green-100 text-green-700' 
                                    : ['Non Interessato', 'KO', 'Non Risponde'].includes(esito)
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-blue-100 text-blue-600'
                                }`}>
                                  {agentData.outcomes[esito]}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {/* Riga Totali */}
                      <TableRow className="bg-slate-100 font-bold border-t-2">
                        <TableCell className="font-bold">TOTALE</TableCell>
                        <TableCell className="text-center font-bold text-blue-700">
                          {agent_breakdown.reduce((sum, a) => sum + (a.total_leads || 0), 0)}
                        </TableCell>
                        {esitiArray.map(esito => (
                          <TableCell key={esito} className="text-center font-bold">
                            {esitoTotals[esito] || 0}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                );
              })()}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nessun agente assegnato</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agents Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Riepilogo Performance Agenti
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agent_breakdown && agent_breakdown.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agente</TableHead>
                    <TableHead className="text-center">Lead Totali</TableHead>
                    <TableHead className="text-center">Contattati</TableHead>
                    <TableHead className="text-center">Tasso Contatto</TableHead>
                    <TableHead className="text-center">Qualità</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agent_breakdown.map((agentData, idx) => {
                    const contactRate = agentData.total_leads > 0 
                      ? Math.round((agentData.contacted_leads / agentData.total_leads) * 100) 
                      : 0;
                    const positiveOutcomes = agentData.outcomes 
                      ? Object.entries(agentData.outcomes)
                          .filter(([esito]) => ['Interessato', 'Venduto', 'Completato', 'Appuntamento', 'Lead Interessato'].includes(esito))
                          .reduce((sum, [, count]) => sum + count, 0)
                      : 0;
                    const qualityRate = agentData.total_leads > 0 
                      ? Math.round((positiveOutcomes / agentData.total_leads) * 100) 
                      : 0;
                    
                    return (
                      <TableRow key={agentData.agent?.id || idx}>
                        <TableCell className="font-medium">{agentData.agent?.username || 'N/A'}</TableCell>
                        <TableCell className="text-center">{agentData.total_leads}</TableCell>
                        <TableCell className="text-center">{agentData.contacted_leads}</TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            contactRate >= 70 ? 'bg-green-100 text-green-700' :
                            contactRate >= 40 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {contactRate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            qualityRate >= 30 ? 'bg-green-100 text-green-700' :
                            qualityRate >= 15 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {positiveOutcomes} ({qualityRate}%)
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nessun agente assegnato</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Super Referente Analytics View Component - Shows all referenti and their agents network

const SuperReferenteAnalyticsView = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedReferenteId, setSelectedReferenteId] = useState('');
  const [referentiList, setReferentiList] = useState([]);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch list of authorized referenti
  const fetchReferentiList = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      // Filter to only show referenti that are in referenti_autorizzati
      const authorizedReferenti = user.referenti_autorizzati || [];
      const referenti = response.data.filter(u => 
        u.role === 'referente' && authorizedReferenti.includes(u.id)
      );
      setReferentiList(referenti);
    } catch (error) {
      console.error("Error fetching referenti list:", error);
    }
  };

  // Fetch analytics for a specific referente or all
  const fetchAnalytics = async (referenteId = null) => {
    try {
      setLoading(true);
      
      if (referenteId) {
        // Fetch specific referente analytics
        let url = `${API}/analytics/referente/${referenteId}`;
        const params = new URLSearchParams();
        if (dateFrom) params.append('date_from', dateFrom);
        if (dateTo) params.append('date_to', dateTo);
        if (params.toString()) url += `?${params.toString()}`;
        
        const response = await axios.get(url);
        setAnalytics({ type: 'single', data: response.data });
      } else {
        // Fetch aggregated analytics for all authorized referenti
        const authorizedReferenti = user.referenti_autorizzati || [];
        if (authorizedReferenti.length === 0) {
          setAnalytics({ type: 'empty', data: null });
          return;
        }
        
        // Fetch analytics for each referente
        const allAnalytics = await Promise.all(
          authorizedReferenti.map(async (refId) => {
            try {
              let url = `${API}/analytics/referente/${refId}`;
              const params = new URLSearchParams();
              if (dateFrom) params.append('date_from', dateFrom);
              if (dateTo) params.append('date_to', dateTo);
              if (params.toString()) url += `?${params.toString()}`;
              
              const response = await axios.get(url);
              return response.data;
            } catch (error) {
              console.error(`Error fetching analytics for referente ${refId}:`, error);
              return null;
            }
          })
        );
        
        // Aggregate data
        const validAnalytics = allAnalytics.filter(a => a !== null);
        const aggregated = {
          total_leads: 0,
          contacted_leads: 0,
          referenti: [],
          all_agents: [],
          outcomes: {}
        };
        
        validAnalytics.forEach(refData => {
          aggregated.total_leads += refData.total_stats?.total_leads || 0;
          aggregated.contacted_leads += refData.total_stats?.contacted_leads || 0;
          aggregated.referenti.push(refData.referente);
          
          // Aggregate outcomes from referente level (more accurate)
          if (refData.outcomes) {
            Object.entries(refData.outcomes).forEach(([esito, count]) => {
              aggregated.outcomes[esito] = (aggregated.outcomes[esito] || 0) + count;
            });
          }
          
          // Add agents with normalized structure
          if (refData.agent_breakdown) {
            refData.agent_breakdown.forEach(agentData => {
              aggregated.all_agents.push({
                id: agentData.agent?.id || agentData.id,
                username: agentData.agent?.username || agentData.username,
                email: agentData.agent?.email || agentData.email,
                total_leads: agentData.total_leads || 0,
                contacted_leads: agentData.contacted_leads || 0,
                contact_rate: agentData.contact_rate || 0,
                outcomes: agentData.outcomes || {},
                referente_username: refData.referente?.username
              });
            });
          }
        });
        
        setAnalytics({ type: 'aggregated', data: aggregated });
      }
    } catch (error) {
      console.error("Error fetching super referente analytics:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Impossibile caricare le analytics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferentiList();
    fetchAnalytics();
  }, []);

  useEffect(() => {
    fetchAnalytics(selectedReferenteId || null);
  }, [selectedReferenteId, dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Users className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Analytics Rete</h2>
              <p className="text-indigo-100">Statistiche dei tuoi Referenti e Agenti</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={selectedReferenteId}
              onChange={(e) => setSelectedReferenteId(e.target.value)}
              className="bg-white border border-slate-300 text-slate-800 rounded-md px-3 py-2 text-sm font-medium shadow-sm"
            >
              <option value="">Tutti i Referenti</option>
              {referentiList.map(ref => (
                <option key={ref.id} value={ref.id}>{ref.username}</option>
              ))}
            </select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-white border-slate-300 text-slate-800 w-40"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-white border-slate-300 text-slate-800 w-40"
            />
            <Button onClick={() => fetchAnalytics(selectedReferenteId || null)} variant="secondary" size="sm">
              <RefreshCw className="w-4 h-4 mr-1" /> Aggiorna
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Referenti</p>
                <p className="text-3xl font-bold text-blue-700">
                  {analytics?.type === 'aggregated' ? analytics.data?.referenti?.length || 0 : 1}
                </p>
              </div>
              <Users className="w-10 h-10 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Agenti Totali</p>
                <p className="text-3xl font-bold text-green-700">
                  {analytics?.type === 'aggregated' 
                    ? analytics.data?.all_agents?.length || 0 
                    : analytics?.data?.agent_breakdown?.length || 0}
                </p>
              </div>
              <User className="w-10 h-10 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Totale Lead</p>
                <p className="text-3xl font-bold text-purple-700">
                  {analytics?.type === 'aggregated' 
                    ? analytics.data?.total_leads || 0 
                    : analytics?.data?.total_stats?.total_leads || 0}
                </p>
              </div>
              <Phone className="w-10 h-10 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Contattati</p>
                <p className="text-3xl font-bold text-orange-700">
                  {analytics?.type === 'aggregated' 
                    ? analytics.data?.contacted_leads || 0 
                    : analytics?.data?.total_stats?.contacted_leads || 0}
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Totale Esiti */}
      {analytics?.data?.outcomes && Object.keys(analytics.data.outcomes).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Totale Esiti Lead
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Object.entries(analytics.data.outcomes).sort((a, b) => b[1] - a[1]).map(([esito, count]) => (
                <div key={esito} className="bg-slate-50 rounded-lg p-3 text-center border">
                  <p className="text-2xl font-bold text-slate-700">{count}</p>
                  <p className="text-xs text-slate-500 truncate" title={esito}>{esito || 'Non impostato'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pivot Table - Agenti x Esiti */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Pivot Agenti per Esito
          </CardTitle>
          <p className="text-sm text-slate-500">Dettaglio esiti per ogni agente nella rete</p>
        </CardHeader>
        <CardContent>
          {(() => {
            const agents = analytics?.type === 'aggregated' 
              ? analytics.data?.all_agents || []
              : analytics?.data?.agent_breakdown || [];
            
            if (agents.length === 0) {
              return (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nessun agente trovato</p>
                </div>
              );
            }
            
            // Collect all unique esiti
            const allEsiti = new Set();
            agents.forEach(agentData => {
              if (agentData.outcomes) {
                Object.keys(agentData.outcomes).forEach(e => allEsiti.add(e));
              }
            });
            const esitiArray = Array.from(allEsiti).sort();
            
            // Calculate totals
            const esitoTotals = {};
            esitiArray.forEach(e => {
              esitoTotals[e] = agents.reduce((sum, agentData) => 
                sum + (agentData.outcomes?.[e] || 0), 0);
            });
            
            return (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="font-bold">Agente</TableHead>
                      {analytics?.type === 'aggregated' && (
                        <TableHead className="font-bold">Referente</TableHead>
                      )}
                      <TableHead className="text-center font-bold">Totale</TableHead>
                      {esitiArray.map(esito => (
                        <TableHead key={esito} className="text-center text-xs">
                          {esito || 'N/A'}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((agentData, idx) => (
                      <TableRow key={agentData.id || agentData.agent?.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <TableCell className="font-medium">
                          {agentData.username || agentData.agent?.username || 'N/A'}
                        </TableCell>
                        {analytics?.type === 'aggregated' && (
                          <TableCell className="text-sm text-slate-500">
                            {agentData.referente_username || 'N/A'}
                          </TableCell>
                        )}
                        <TableCell className="text-center font-bold text-blue-600">
                          {agentData.total_leads || 0}
                        </TableCell>
                        {esitiArray.map(esito => (
                          <TableCell key={esito} className="text-center">
                            {agentData.outcomes?.[esito] ? (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                esito === 'Nuovo' ? 'bg-gray-100 text-gray-600' :
                                ['Interessato', 'Venduto', 'Completato', 'Appuntamento', 'Lead Interessato'].includes(esito) 
                                  ? 'bg-green-100 text-green-700' 
                                  : ['Non Interessato', 'KO', 'Non Risponde'].includes(esito)
                                  ? 'bg-red-100 text-red-600'
                                  : 'bg-blue-100 text-blue-600'
                              }`}>
                                {agentData.outcomes[esito]}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {/* Riga Totali */}
                    <TableRow className="bg-slate-100 font-bold border-t-2">
                      <TableCell className="font-bold">TOTALE</TableCell>
                      {analytics?.type === 'aggregated' && <TableCell />}
                      <TableCell className="text-center font-bold text-blue-700">
                        {agents.reduce((sum, a) => sum + (a.total_leads || 0), 0)}
                      </TableCell>
                      {esitiArray.map(esito => (
                        <TableCell key={esito} className="text-center font-bold">
                          {esitoTotals[esito] || 0}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
};

// Supervisor Analytics Component

const SupervisorAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      let url = `${API}/analytics/supervisor/unit`;
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await axios.get(url);
      setAnalytics(response.data);
    } catch (error) {
      console.error("Error fetching supervisor analytics:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Impossibile caricare le analytics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleExportLeads = async () => {
    try {
      setExporting(true);
      let url = `${API}/leads/export`;
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await axios.get(url, { responseType: 'blob' });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `leads_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      
      toast({
        title: "Export completato",
        description: "Il file Excel è stato scaricato",
      });
    } catch (error) {
      console.error("Error exporting leads:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Impossibile esportare i lead",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">
                Analytics {analytics?.units?.length > 1 ? `(${analytics?.units?.length} Unit)` : `Unit: ${analytics?.units?.[0]?.nome || 'N/A'}`}
              </h2>
              <p className="text-indigo-100">
                {analytics?.units?.length > 1 
                  ? analytics.units.map(u => u.nome).join(', ')
                  : 'Panoramica performance agenti e referenti'
                }
              </p>
            </div>
          </div>
          <Button 
            onClick={handleExportLeads} 
            disabled={exporting}
            className="bg-white text-indigo-600 hover:bg-indigo-50"
          >
            {exporting ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Esporta Lead Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Da</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data A</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={fetchAnalytics} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Aggiorna
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Lead Totali</p>
            <p className="text-2xl font-bold text-slate-800">{analytics?.stats?.total_leads || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Lead Contattati</p>
            <p className="text-2xl font-bold text-slate-800">{analytics?.stats?.contacted_leads || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Non Assegnati</p>
            <p className="text-2xl font-bold text-slate-800">{analytics?.stats?.unassigned_leads || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Tasso Contatto</p>
            <p className="text-2xl font-bold text-slate-800">{analytics?.stats?.contact_rate || 0}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Referenti Table */}
      {analytics?.referenti?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-purple-600" />
              <span>Performance Referenti ({analytics.stats.total_referenti})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Agenti</TableHead>
                    <TableHead className="text-center">Lead Totali</TableHead>
                    <TableHead className="text-center">Contattati</TableHead>
                    <TableHead className="text-center">Tasso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.referenti.map((ref) => (
                    <TableRow key={ref.id}>
                      <TableCell className="font-medium">{ref.username}</TableCell>
                      <TableCell className="text-sm text-slate-500">{ref.email}</TableCell>
                      <TableCell className="text-center">{ref.agents_count}</TableCell>
                      <TableCell className="text-center">{ref.total_leads}</TableCell>
                      <TableCell className="text-center">{ref.contacted_leads}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={ref.contact_rate >= 70 ? "default" : ref.contact_rate >= 40 ? "secondary" : "destructive"}>
                          {ref.contact_rate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agents Table */}
      {analytics?.agents?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-600" />
              <span>Performance Agenti ({analytics.stats.total_agents})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agente</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Lead Totali</TableHead>
                    <TableHead className="text-center">Contattati</TableHead>
                    <TableHead className="text-center">Tasso Contatto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.username}</TableCell>
                      <TableCell className="text-sm text-slate-500">{agent.email}</TableCell>
                      <TableCell className="text-center">{agent.total_leads}</TableCell>
                      <TableCell className="text-center">{agent.contacted_leads}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={agent.contact_rate >= 70 ? "default" : agent.contact_rate >= 40 ? "secondary" : "destructive"}>
                          {agent.contact_rate}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Totale Esiti */}
      {analytics?.outcomes && Object.keys(analytics.outcomes).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-green-600" />
              <span>Totale Esiti Lead</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {Object.entries(analytics.outcomes).sort((a, b) => b[1] - a[1]).map(([esito, count]) => (
                <div key={esito} className="bg-slate-50 rounded-lg p-3 text-center border">
                  <p className="text-2xl font-bold text-slate-700">{count}</p>
                  <p className="text-xs text-slate-500 truncate" title={esito}>{esito || 'Non impostato'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pivot Table - Agenti x Esiti */}
      {analytics?.agents?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <span>Pivot Agenti per Esito</span>
            </CardTitle>
            <p className="text-sm text-slate-500">Dettaglio esiti per ogni agente</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {(() => {
                // Collect all unique esiti across all agents
                const allEsiti = new Set();
                analytics.agents.forEach(agent => {
                  if (agent.outcomes) {
                    Object.keys(agent.outcomes).forEach(e => allEsiti.add(e));
                  }
                });
                const esitiArray = Array.from(allEsiti).sort();
                
                // Calculate totals per esito
                const esitoTotals = {};
                esitiArray.forEach(e => {
                  esitoTotals[e] = analytics.agents.reduce((sum, agent) => 
                    sum + (agent.outcomes?.[e] || 0), 0);
                });
                
                return (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-bold">Agente</TableHead>
                        <TableHead className="text-center font-bold">Totale</TableHead>
                        {esitiArray.map(esito => (
                          <TableHead key={esito} className="text-center text-xs">
                            {esito || 'N/A'}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.agents.map((agent, idx) => (
                        <TableRow key={agent.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <TableCell className="font-medium">
                            {agent.username || 'N/A'}
                          </TableCell>
                          <TableCell className="text-center font-bold text-blue-600">
                            {agent.total_leads || 0}
                          </TableCell>
                          {esitiArray.map(esito => (
                            <TableCell key={esito} className="text-center">
                              {agent.outcomes?.[esito] ? (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  esito === 'Nuovo' ? 'bg-gray-100 text-gray-600' :
                                  ['Interessato', 'Venduto', 'Completato', 'Appuntamento', 'Lead Interessato'].includes(esito) 
                                    ? 'bg-green-100 text-green-700' 
                                    : ['Non Interessato', 'KO', 'Non Risponde'].includes(esito)
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-blue-100 text-blue-600'
                                }`}>
                                  {agent.outcomes[esito]}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {/* Riga Totali */}
                      <TableRow className="bg-slate-100 font-bold border-t-2">
                        <TableCell className="font-bold">TOTALE</TableCell>
                        <TableCell className="text-center font-bold text-blue-700">
                          {analytics.agents.reduce((sum, a) => sum + (a.total_leads || 0), 0)}
                        </TableCell>
                        {esitiArray.map(esito => (
                          <TableCell key={esito} className="text-center font-bold">
                            {esitoTotals[esito] || 0}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {(!analytics?.agents?.length && !analytics?.referenti?.length) && (
        <Card>
          <CardContent className="p-8 text-center text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-lg">Nessun agente o referente nella tua Unit</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Clienti Management Component

export { ReferenteAnalyticsView, SuperReferenteAnalyticsView, SupervisorAnalytics };
