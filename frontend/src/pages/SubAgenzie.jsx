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
import { CreateUnitModal, EditUnitModal } from "./LeadsConfig";


// ===================================================================
// Componenti estratti da App.js (refactoring giugno 2026)
// ===================================================================

const SubAgenzieManagement = ({ selectedUnit, selectedCommessa, units, commesse: commesseFromParent, subAgenzie: subAgenzieFromParent }) => {
  const [activeTab, setActiveTab] = useState("units");
  
  // Use props data when available, fallback to local state
  const [unitsData, setUnitsData] = useState(units || []);
  const [subAgenzie, setSubAgenzie] = useState(subAgenzieFromParent || []);
  const [commesse, setCommesse] = useState(commesseFromParent || []);
  const [servizi, setServizi] = useState([]); // NEW: Add servizi state
  const [responsabili, setResponsabili] = useState([]); // NEW: Add responsabili state for Sub Agenzia
  
  const [showCreateUnitModal, setShowCreateUnitModal] = useState(false);
  const [showEditUnitModal, setShowEditUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  
  // Sub Agenzie state  
  const [showCreateSubModal, setShowCreateSubModal] = useState(false);
  const [showEditSubModal, setShowEditSubModal] = useState(false);
  const [editingSubAgenzia, setEditingSubAgenzia] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false); // NEW: Track if commesse and servizi are loaded
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchUnits(),
        fetchSubAgenzie(),
        fetchCommesse(),
        fetchServizi(),
        fetchResponsabili()
      ]);
      setDataLoaded(true); // Set dataLoaded to true when all data is fetched
    };
    loadData();
  }, []);

  // NEW: Fetch servizi function
  const fetchServizi = async () => {
    try {
      console.log('🔄 SubAgenzieManagement: Fetching servizi...');
      const response = await axios.get(`${API}/servizi`);
      console.log('✅ SubAgenzieManagement: Servizi loaded:', response.data.length, 'items');
      setServizi(response.data);
    } catch (error) {
      console.error("❌ SubAgenzieManagement: Error fetching servizi:", error);
      // Don't show error toast for servizi to avoid noise
    }
  };

  // NEW: Fetch responsabili (users with role responsabile_sub_agenzia)
  const fetchResponsabili = async () => {
    try {
      console.log('🔄 SubAgenzieManagement: Fetching responsabili...');
      const response = await axios.get(`${API}/users`);
      // Filter only responsabile_sub_agenzia users
      const responsabiliUsers = response.data.filter(user => 
        user.role === 'responsabile_sub_agenzia'
      );
      console.log('✅ SubAgenzieManagement: Responsabili loaded:', responsabiliUsers.length, 'items');
      setResponsabili(responsabiliUsers);
    } catch (error) {
      console.error("❌ SubAgenzieManagement: Error fetching responsabili:", error);
    }
  };

  // Units functions
  const fetchUnits = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/units`);
      setUnitsData(response.data);
    } catch (error) {
      console.error("Error fetching units:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle unit",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createUnit = async (unitData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/units`, unitData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setUnitsData([response.data, ...unitsData]);
      toast({
        title: "Successo",
        description: "Unit creata con successo",
      });
      setShowCreateUnitModal(false);
    } catch (error) {
      console.error("Error creating unit:", error);
      toast({
        title: "Errore",
        description: "Errore nella creazione della unit",
        variant: "destructive",
      });
    }
  };

  const deleteUnit = async (unitId) => {
    if (window.confirm("Sei sicuro di voler eliminare questa unit?")) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API}/units/${unitId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setUnitsData(unitsData.filter(unit => unit.id !== unitId));
        toast({
          title: "Successo", 
          description: "Unit eliminata con successo",
        });
      } catch (error) {
        console.error("Error deleting unit:", error);
        toast({
          title: "Errore",
          description: "Errore nell'eliminazione della unit",
          variant: "destructive",
        });
      }
    }
  };

  const updateUnit = async (unitId, updateData) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`${API}/units/${unitId}`, updateData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setUnitsData(unitsData.map(unit => 
        unit.id === unitId ? response.data : unit
      ));
      toast({
        title: "Successo",
        description: "Unit modificata con successo",
      });
      setShowEditUnitModal(false);
      setEditingUnit(null);
    } catch (error) {
      console.error("Error updating unit:", error);
      toast({
        title: "Errore",
        description: "Errore nella modifica della unit",
        variant: "destructive",
      });
    }
  };

  const handleEditUnit = (unit) => {
    setEditingUnit(unit);
    setShowEditUnitModal(true);
  };

  // Sub Agenzie functions
  const fetchSubAgenzie = async () => {
    try {
      const response = await axios.get(`${API}/sub-agenzie`);
      setSubAgenzie(response.data);
    } catch (error) {
      console.error("Error fetching sub agenzie:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle sub agenzie",
        variant: "destructive",
      });
    }
  };

  const fetchCommesse = async () => {
    try {
      console.log('🔄 SubAgenzieManagement: Fetching commesse...');
      const response = await axios.get(`${API}/commesse`);
      console.log('✅ SubAgenzieManagement: Commesse loaded:', response.data.length, 'items');
      setCommesse(response.data);
    } catch (error) {
      console.error("❌ SubAgenzieManagement: Error fetching commesse:", error);
    }
  };

  const createSubAgenzia = async (subAgenziaData) => {
    try {
      // Get token from localStorage to ensure availability
      const token = localStorage.getItem('token');
      
      // Ensure JWT token is included in headers
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      };
      
      const response = await axios.post(`${API}/sub-agenzie`, subAgenziaData, { headers });
      setSubAgenzie([response.data, ...subAgenzie]);
      toast({
        title: "Successo",
        description: "Sub Agenzia creata con successo",
      });
      setShowCreateSubModal(false);
    } catch (error) {
      console.error("Error creating sub agenzia:", error);
      toast({
        title: "Errore",
        description: "Errore nella creazione della sub agenzia",
        variant: "destructive",
      });
    }
  };

  const updateSubAgenzia = async (subAgenziaId, updateData) => {
    try {
      const response = await axios.put(`${API}/sub-agenzie/${subAgenziaId}`, updateData);
      setSubAgenzie(subAgenzie.map(sa => 
        sa.id === subAgenziaId ? response.data : sa
      ));
      toast({
        title: "Successo",
        description: "Sub Agenzia modificata con successo",
      });
      setShowEditSubModal(false);
      setEditingSubAgenzia(null);
    } catch (error) {
      console.error("Error updating sub agenzia:", error);
      toast({
        title: "Errore",
        description: "Errore nella modifica della sub agenzia",
        variant: "destructive",
      });
    }
  };

  const deleteSubAgenzia = async (subAgenziaId) => {
    if (window.confirm("Sei sicuro di voler eliminare questa Sub Agenzia?")) {
      try {
        await axios.delete(`${API}/sub-agenzie/${subAgenziaId}`);
        setSubAgenzie(subAgenzie.filter(sa => sa.id !== subAgenziaId));
        toast({
          title: "Successo",
          description: "Sub Agenzia eliminata con successo",
        });
      } catch (error) {
        console.error("Error deleting sub agenzia:", error);
        toast({
          title: "Errore",
          description: "Errore nell'eliminazione della sub agenzia",
          variant: "destructive",
        });
      }
    }
  };

  const handleEditSubAgenzia = (subAgenzia) => {
    setEditingSubAgenzia(subAgenzia);
    setShowEditSubModal(true);
  };

  // Render Units Tab
  const renderUnitsTab = () => {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base md:text-lg font-medium text-slate-800">Gestione Unit</h3>
            <p className="text-xs md:text-sm text-slate-600">Gestisci le unit organizzative</p>
          </div>
          <Button 
            onClick={() => setShowCreateUnitModal(true)}
            disabled={!dataLoaded}
            size="sm"
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            {dataLoaded ? 'Nuova Unit' : 'Caricamento...'}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-1">
            {unitsData
              .filter(unit => 
                selectedCommessa === "all" || 
                unit.commesse_autorizzate?.includes(selectedCommessa)
              )
              .map((unit) => (
              <Card key={unit.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <div>
                        <CardTitle className="text-lg">{unit.nome || unit.name}</CardTitle>
                        <p className="text-sm text-slate-500">{unit.description}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Badge variant={unit.is_active ? "default" : "secondary"}>
                        {unit.is_active ? "Attiva" : "Inattiva"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-xs text-slate-500">ID</Label>
                      <p className="font-mono text-xs">{unit.id}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Creata il</Label>
                      <p className="text-xs">
                        {new Date(unit.created_at).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                  </div>
                  
                  {/* Commesse autorizzate */}
                  {unit.commesse_autorizzate && unit.commesse_autorizzate.length > 0 && (
                    <div className="mt-3">
                      <Label className="text-xs text-slate-500 mb-2 block">Commesse Autorizzate</Label>
                      <div className="flex flex-wrap gap-1">
                        {unit.commesse_autorizzate.map((commessaId) => {
                          const commessa = commesse.find(c => c.id === commessaId);
                          return (
                            <Badge key={commessaId} variant="secondary" className="text-xs">
                              {commessa?.nome || commessaId}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditUnit(unit)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Modifica
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteUnit(unit.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Elimina
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Unit Modal */}
        {showCreateUnitModal && (
          <CreateUnitModal
            onClose={() => setShowCreateUnitModal(false)}
            onSuccess={createUnit}
            commesse={commesse}
            servizi={servizi}
          />
        )}
        
        {/* Edit Unit Modal */}
        {showEditUnitModal && editingUnit && (
          <EditUnitModal
            unit={editingUnit}
            onClose={() => {
              setShowEditUnitModal(false);
              setEditingUnit(null);
            }}
            onSuccess={(updateData) => updateUnit(editingUnit.id, updateData)}
            commesse={commesse}
            servizi={servizi}
          />
        )}
      </div>
    );
  };

  // Render Sub Agenzie Tab
  const renderSubAgenzieTab = () => {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base md:text-lg font-medium text-slate-800">Gestione Sub Agenzie</h3>
            <p className="text-xs md:text-sm text-slate-600">Gestisci le sub agenzie</p>
          </div>
          <Button 
            onClick={() => setShowCreateSubModal(true)}
            disabled={!dataLoaded}
            size="sm"
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            {dataLoaded ? 'Nuova Sub Agenzia' : 'Caricamento...'}
          </Button>
        </div>

        <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-1">
          {subAgenzie
            .filter(subAgenzia => 
              selectedCommessa === "all" || 
              subAgenzia.commesse_autorizzate?.includes(selectedCommessa)
            )
            .map((subAgenzia) => (
            <Card key={subAgenzia.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Store className="w-5 h-5 text-green-600" />
                    <div>
                      <CardTitle className="text-lg">{subAgenzia.nome}</CardTitle>
                      <p className="text-sm text-slate-500">{subAgenzia.descrizione}</p>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {subAgenzia.commesse_autorizzate?.length || 0} Commesse
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label className="text-xs text-slate-500">Responsabile</Label>
                    <p className="font-medium">{subAgenzia.responsabile || "Non assegnato"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Email</Label>
                    <p className="text-sm">{subAgenzia.email || "Non configurata"}</p>
                  </div>
                </div>

                {subAgenzia.commesse_autorizzate && subAgenzia.commesse_autorizzate.length > 0 && (
                  <div className="mb-4">
                    <Label className="text-xs text-slate-500 mb-2 block">Commesse Autorizzate</Label>
                    <div className="flex flex-wrap gap-1">
                      {subAgenzia.commesse_autorizzate.map((commessaId) => {
                        const commessa = commesse.find(c => c.id === commessaId);
                        return (
                          <Badge key={commessaId} variant="secondary" className="text-xs">
                            {commessa?.nome || commessaId}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="text-xs text-slate-400 mt-2">
                  Creata il: {new Date(subAgenzia.created_at).toLocaleDateString('it-IT')}
                </div>
                
                {/* Actions */}
                <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditSubAgenzia(subAgenzia)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Modifica
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteSubAgenzia(subAgenzia.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Elimina
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create Sub Agenzia Modal */}
        {showCreateSubModal && (
          <CreateSubAgenziaModal
            onClose={() => setShowCreateSubModal(false)}
            onSuccess={createSubAgenzia}
            commesse={commesse}
            servizi={servizi}
            responsabili={responsabili}
          />
        )}
        
        {/* Edit Sub Agenzia Modal */}
        {showEditSubModal && editingSubAgenzia && (
          <EditSubAgenziaModal
            subAgenzia={editingSubAgenzia}
            onClose={() => {
              setShowEditSubModal(false);
              setEditingSubAgenzia(null);
            }}
            onSuccess={(updateData) => updateSubAgenzia(editingSubAgenzia.id, updateData)}
            commesse={commesse}
            servizi={servizi}
            responsabili={responsabili}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col space-y-2">
        <h2 className="text-xl md:text-3xl font-bold text-slate-800 flex items-center">
          <Store className="w-6 h-6 md:w-8 md:h-8 mr-2 md:mr-3 text-green-600" />
          Unit & Sub Agenzie
        </h2>
        {selectedCommessa && selectedCommessa !== "all" && (
          <p className="text-sm text-slate-600 ml-8 md:ml-11">
            Filtrato: <Badge variant="secondary">{commesse.find(c => c.id === selectedCommessa)?.nome || selectedCommessa}</Badge>
          </p>
        )}
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="units" className="flex items-center space-x-1 md:space-x-2">
            <Building2 className="w-4 h-4" />
            <span>Unit</span>
          </TabsTrigger>
          <TabsTrigger value="sub-agenzie" className="flex items-center space-x-1 md:space-x-2">
            <Store className="w-4 h-4" />
            <span>Sub Agenzie</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="units" className="space-y-4 md:space-y-6">
          {renderUnitsTab()}
        </TabsContent>

        <TabsContent value="sub-agenzie" className="space-y-4 md:space-y-6">
          {renderSubAgenzieTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Costanti globali per filtri e dropdown

const CreateSubAgenziaModal = ({ onClose, onSuccess, commesse, servizi, responsabili }) => {
  const [formData, setFormData] = useState({
    nome: '',
    descrizione: '',
    responsabile_id: '',
    commesse_autorizzate: [],
    servizi_autorizzati: []
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showResponsabiliDropdown, setShowResponsabiliDropdown] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSuccess(formData);
    setFormData({ 
      nome: '', 
      descrizione: '', 
      responsabile_id: '', 
      commesse_autorizzate: [],
      servizi_autorizzati: []
    });
    setSearchTerm('');
  };

  // Filter responsabili based on search term
  const getFilteredResponsabili = () => {
    if (!responsabili || responsabili.length === 0) return [];
    if (!searchTerm) return responsabili;
    
    const lowerSearch = searchTerm.toLowerCase();
    return responsabili.filter(resp => 
      resp.username?.toLowerCase().includes(lowerSearch) ||
      resp.nome?.toLowerCase().includes(lowerSearch) ||
      resp.cognome?.toLowerCase().includes(lowerSearch) ||
      resp.email?.toLowerCase().includes(lowerSearch)
    );
  };

  // Select a responsabile
  const selectResponsabile = (responsabile) => {
    setFormData(prev => ({ ...prev, responsabile_id: responsabile.id }));
    setSearchTerm(`${responsabile.nome || ''} ${responsabile.cognome || ''} (${responsabile.username})`);
    setShowResponsabiliDropdown(false);
  };

  // Get selected responsabile display name
  const getSelectedResponsabileName = () => {
    if (!formData.responsabile_id || !responsabili) return '';
    const selected = responsabili.find(r => r.id === formData.responsabile_id);
    if (!selected) return '';
    return `${selected.nome || ''} ${selected.cognome || ''} (${selected.username})`;
  };

  const toggleCommessa = (commessaId) => {
    setFormData(prev => ({
      ...prev,
      commesse_autorizzate: prev.commesse_autorizzate.includes(commessaId)
        ? prev.commesse_autorizzate.filter(id => id !== commessaId)
        : [...prev.commesse_autorizzate, commessaId]
    }));
  };

  const toggleServizio = (servizioId) => {
    setFormData(prev => ({
      ...prev,
      servizi_autorizzati: prev.servizi_autorizzati.includes(servizioId)
        ? prev.servizi_autorizzati.filter(id => id !== servizioId)
        : [...prev.servizi_autorizzati, servizioId]
    }));
  };
  // Filter servizi based on selected commesse
  const getFilteredServizi = () => {
    if (!servizi || servizi.length === 0) return [];
    
    // If no commesse selected, show NO servizi (must select commessa first)
    if (formData.commesse_autorizzate.length === 0) {
      return [];
    }
    
    // Filter servizi to show only those belonging to selected commesse
    return servizi.filter(servizio => 
      formData.commesse_autorizzate.includes(servizio.commessa_id)
    );
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuova Sub Agenzia</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome Sub Agenzia *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                required
              />
            </div>
            <div className="relative">
              <Label htmlFor="responsabile">Responsabile *</Label>
              <Input
                id="responsabile"
                value={searchTerm || getSelectedResponsabileName()}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTerm(value);
                  
                  // If no responsabili available, use the input value directly as ID
                  if (!responsabili || responsabili.length === 0) {
                    setFormData(prev => ({ ...prev, responsabile_id: value }));
                    setShowResponsabiliDropdown(false);
                  } else {
                    // Otherwise, show dropdown for search
                    setShowResponsabiliDropdown(true);
                    if (!value) {
                      setFormData(prev => ({ ...prev, responsabile_id: '' }));
                    }
                  }
                }}
                onFocus={() => {
                  // Only show dropdown if responsabili exist
                  if (responsabili && responsabili.length > 0) {
                    setShowResponsabiliDropdown(true);
                  }
                }}
                placeholder={responsabili && responsabili.length > 0 
                  ? "Cerca per nome, cognome o username..." 
                  : "Inserisci ID responsabile manualmente..."}
                required={!formData.responsabile_id}
              />
              
              {/* Show dropdown with results or no-results message */}
              {showResponsabiliDropdown && responsabili && responsabili.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {getFilteredResponsabili().length > 0 ? (
                    getFilteredResponsabili().map((resp) => (
                      <div
                        key={resp.id}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                        onClick={() => selectResponsabile(resp)}
                      >
                        <div className="font-medium text-slate-800">
                          {resp.nome} {resp.cognome}
                        </div>
                        <div className="text-sm text-slate-500">
                          {resp.username} • {resp.email}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-center text-slate-500">
                      <p className="text-sm">Nessun responsabile trovato con questi criteri</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Show warning if no managers available */}
              {(!responsabili || responsabili.length === 0) && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800">Nessun responsabile disponibile</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Non ci sono utenti con ruolo "Responsabile Sub Agenzia" nel sistema. 
                        Puoi inserire manualmente l'ID di un responsabile nel campo sopra.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <Label htmlFor="descrizione">Descrizione</Label>
            <Textarea
              id="descrizione"
              value={formData.descrizione}
              onChange={(e) => setFormData({...formData, descrizione: e.target.value})}
              rows={3}
            />
          </div>

          {/* Commesse e Servizi Selection */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Commesse Selection */}
            <div>
              <Label>Commesse Autorizzate</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3 bg-gray-50">
                {commesse?.map((commessa) => (
                  <div key={commessa.id} className="flex items-center space-x-2 cursor-pointer" onClick={() => toggleCommessa(commessa.id)}>
                    <input
                      type="checkbox"
                      checked={formData.commesse_autorizzate && formData.commesse_autorizzate.includes(commessa.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleCommessa(commessa.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{commessa.nome}</span>
                  </div>
                ))}
                {(!commesse || commesse.length === 0) && (
                  <p className="text-sm text-gray-500 italic">Nessuna commessa disponibile</p>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Selezionate: {formData.commesse_autorizzate.length} commesse
              </p>
            </div>

            {/* Servizi Selection */}
            <div>
              <Label>Servizi Autorizzati</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3 bg-blue-50">
                {getFilteredServizi().map((servizio) => (
                  <div key={servizio.id} className="flex items-center space-x-2 cursor-pointer" onClick={() => toggleServizio(servizio.id)}>
                    <input
                      type="checkbox"
                      checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleServizio(servizio.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{servizio.nome}</span>
                  </div>
                ))}
                {getFilteredServizi().length === 0 && (
                  <p className="text-sm text-gray-500 italic">
                    {formData.commesse_autorizzate.length === 0 
                      ? "Seleziona prima una commessa per vedere i servizi" 
                      : "Nessun servizio disponibile per le commesse selezionate"}
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Selezionati: {formData.servizi_autorizzati.length} servizi
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">
              Crea Sub Agenzia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Edit Sub Agenzia Modal Component

const EditSubAgenziaModal = ({ subAgenzia, onClose, onSuccess, commesse, servizi, responsabili }) => {
  const [formData, setFormData] = useState({
    nome: subAgenzia?.nome || '',
    descrizione: subAgenzia?.descrizione || '',
    responsabile_id: subAgenzia?.responsabile_id || '',
    commesse_autorizzate: subAgenzia?.commesse_autorizzate || [],
    servizi_autorizzati: subAgenzia?.servizi_autorizzati || []
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showResponsabiliDropdown, setShowResponsabiliDropdown] = useState(false);

  // Filter responsabili based on search term
  const getFilteredResponsabili = () => {
    if (!responsabili || responsabili.length === 0) return [];
    if (!searchTerm) return responsabili;
    
    const lowerSearch = searchTerm.toLowerCase();
    return responsabili.filter(resp => 
      resp.username?.toLowerCase().includes(lowerSearch) ||
      resp.nome?.toLowerCase().includes(lowerSearch) ||
      resp.cognome?.toLowerCase().includes(lowerSearch) ||
      resp.email?.toLowerCase().includes(lowerSearch)
    );
  };

  // Select a responsabile
  const selectResponsabile = (responsabile) => {
    setFormData(prev => ({ ...prev, responsabile_id: responsabile.id }));
    setSearchTerm(`${responsabile.nome || ''} ${responsabile.cognome || ''} (${responsabile.username})`);
    setShowResponsabiliDropdown(false);
  };

  // Get selected responsabile display name
  const getSelectedResponsabileName = () => {
    if (!formData.responsabile_id || !responsabili) return '';
    const selected = responsabili.find(r => r.id === formData.responsabile_id);
    if (!selected) return '';
    return `${selected.nome || ''} ${selected.cognome || ''} (${selected.username})`;
  };

  const toggleCommessa = (commessaId) => {
    setFormData(prev => ({
      ...prev,
      commesse_autorizzate: prev.commesse_autorizzate.includes(commessaId)
        ? prev.commesse_autorizzate.filter(id => id !== commessaId)
        : [...prev.commesse_autorizzate, commessaId]
    }));
  };

  const toggleServizio = (servizioId) => {
    setFormData(prev => ({
      ...prev,
      servizi_autorizzati: prev.servizi_autorizzati.includes(servizioId)
        ? prev.servizi_autorizzati.filter(id => id !== servizioId)
        : [...prev.servizi_autorizzati, servizioId]
    }));
  };
  // Filter servizi based on selected commesse
  const getFilteredServizi = () => {
    if (!servizi || servizi.length === 0) return [];
    
    // If no commesse selected, show NO servizi (must select commessa first)
    if (formData.commesse_autorizzate.length === 0) {
      return [];
    }
    
    // Filter servizi to show only those belonging to selected commesse
    return servizi.filter(servizio => 
      formData.commesse_autorizzate.includes(servizio.commessa_id)
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSuccess(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Sub Agenzia</DialogTitle>
          <DialogDescription>
            Modifica i dati della sub agenzia "{subAgenzia.nome}"
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome">Nome Sub Agenzia *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                required
              />
            </div>
            <div className="relative">
              <Label htmlFor="responsabile">Responsabile *</Label>
              <Input
                id="responsabile"
                value={searchTerm || getSelectedResponsabileName()}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTerm(value);
                  
                  // If no responsabili available, use the input value directly as ID
                  if (!responsabili || responsabili.length === 0) {
                    setFormData(prev => ({ ...prev, responsabile_id: value }));
                    setShowResponsabiliDropdown(false);
                  } else {
                    // Otherwise, show dropdown for search
                    setShowResponsabiliDropdown(true);
                    if (!value) {
                      setFormData(prev => ({ ...prev, responsabile_id: '' }));
                    }
                  }
                }}
                onFocus={() => {
                  // Only show dropdown if responsabili exist
                  if (responsabili && responsabili.length > 0) {
                    setShowResponsabiliDropdown(true);
                  }
                }}
                placeholder={responsabili && responsabili.length > 0 
                  ? "Cerca per nome, cognome o username..." 
                  : "Inserisci ID responsabile manualmente..."}
                required={!formData.responsabile_id}
              />
              
              {/* Show dropdown with results or no-results message */}
              {showResponsabiliDropdown && responsabili && responsabili.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {getFilteredResponsabili().length > 0 ? (
                    getFilteredResponsabili().map((resp) => (
                      <div
                        key={resp.id}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                        onClick={() => selectResponsabile(resp)}
                      >
                        <div className="font-medium text-slate-800">
                          {resp.nome} {resp.cognome}
                        </div>
                        <div className="text-sm text-slate-500">
                          {resp.username} • {resp.email}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-center text-slate-500">
                      <p className="text-sm">Nessun responsabile trovato con questi criteri</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Show warning if no managers available */}
              {(!responsabili || responsabili.length === 0) && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800">Nessun responsabile disponibile</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Non ci sono utenti con ruolo "Responsabile Sub Agenzia" nel sistema. 
                        Puoi inserire manualmente l'ID di un responsabile nel campo sopra.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <Label htmlFor="descrizione">Descrizione</Label>
            <Textarea
              id="descrizione"
              value={formData.descrizione}
              onChange={(e) => setFormData({...formData, descrizione: e.target.value})}
              rows={3}
            />
          </div>

          {/* Sub Agenzia Info Display */}
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <Label className="text-xs font-medium text-slate-600">ID Sub Agenzia</Label>
                <p className="font-mono bg-white p-1 rounded">{subAgenzia.id}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-600">Creata il</Label>
                <p className="bg-white p-1 rounded">
                  {subAgenzia.created_at ? new Date(subAgenzia.created_at).toLocaleString('it-IT') : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Commesse e Servizi Selection */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Commesse Selection */}
            <div>
              <Label>Commesse Autorizzate</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-3 bg-gray-50">
                {commesse?.map((commessa) => (
                  <div key={commessa.id} className="flex items-center space-x-2 cursor-pointer" onClick={() => toggleCommessa(commessa.id)}>
                    <input
                      type="checkbox"
                      checked={formData.commesse_autorizzate && formData.commesse_autorizzate.includes(commessa.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleCommessa(commessa.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{commessa.nome}</span>
                  </div>
                ))}
                {(!commesse || commesse.length === 0) && (
                  <p className="text-sm text-gray-500 italic">Nessuna commessa disponibile</p>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Selezionate: {formData.commesse_autorizzate.length} commesse
              </p>
            </div>

            {/* Servizi Selection */}
            <div>
              <Label>Servizi Autorizzati</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-3 bg-blue-50">
                {getFilteredServizi().map((servizio) => (
                  <div key={servizio.id} className="flex items-center space-x-2 cursor-pointer" onClick={() => toggleServizio(servizio.id)}>
                    <input
                      type="checkbox"
                      checked={formData.servizi_autorizzati && formData.servizi_autorizzati.includes(servizio.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleServizio(servizio.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{servizio.nome}</span>
                  </div>
                ))}
                {getFilteredServizi().length === 0 && (
                  <p className="text-sm text-gray-500 italic">
                    {formData.commesse_autorizzate.length === 0 
                      ? "Seleziona prima una commessa per vedere i servizi" 
                      : "Nessun servizio disponibile per le commesse selezionate"}
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Selezionati: {formData.servizi_autorizzati.length} servizi
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">
              Salva Modifiche
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};


export { SubAgenzieManagement, CreateSubAgenziaModal, EditSubAgenziaModal };
