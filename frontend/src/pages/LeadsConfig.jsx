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

const UnitsManagement = () => {
  const [units, setUnits] = useState([]);
  const [commesse, setCommesse] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchUnits();
    fetchCommesse();
  }, []);

  const fetchUnits = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/units`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setUnits(response.data);
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

  const fetchCommesse = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/commesse`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setCommesse(response.data);
    } catch (error) {
      console.error("Error fetching commesse:", error);
    }
  };

  const deleteUnit = async (unitId, unitName) => {
    if (!window.confirm(`Sei sicuro di voler eliminare l'unit "${unitName}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/units/${unitId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      toast({
        title: "Successo",
        description: "Unit eliminata con successo",
      });
      fetchUnits();
    } catch (error) {
      console.error("Error deleting unit:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'eliminazione dell'unit",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-slate-800">Gestione Unit Lead</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuova Unit
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Commessa</TableHead>
                <TableHead>Campagne Autorizzate</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">
                    Nessuna unit trovata
                  </TableCell>
                </TableRow>
              ) : (
                units.map((unit) => {
                  const commessa = commesse.find((c) => c.id === unit.commessa_id);
                  return (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.nome}</TableCell>
                      <TableCell>{commessa?.nome || "N/A"}</TableCell>
                      <TableCell>
                        {unit.campagne_autorizzate?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {unit.campagne_autorizzate.slice(0, 3).map((campagna, idx) => (
                              <Badge key={idx} variant="outline">{campagna}</Badge>
                            ))}
                            {unit.campagne_autorizzate.length > 3 && (
                              <Badge variant="outline">+{unit.campagne_autorizzate.length - 3}</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">Nessuna</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {unit.is_active ? (
                          <Badge className="bg-green-100 text-green-800">Attiva</Badge>
                        ) : (
                          <Badge variant="secondary">Inattiva</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUnit(unit);
                            setShowEditModal(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteUnit(unit.id, unit.nome)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showCreateModal && (
        <CreateUnitModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchUnits();
          }}
          commesse={commesse}
        />
      )}

      {showEditModal && selectedUnit && (
        <EditUnitModal
          unit={selectedUnit}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUnit(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedUnit(null);
            fetchUnits();
          }}
          commesse={commesse}
        />
      )}
    </div>
  );
};

// Create Unit Modal

const CreateUnitModal = ({ onClose, onSuccess, commesse }) => {
  const [formData, setFormData] = useState({
    nome: "",
    commesse_autorizzate: [], // Changed from commessa_id to commesse_autorizzate (array)
    campagne_autorizzate: [],
    auto_assign_enabled: true, // NEW: Smistamento automatico abilitato di default
  });
  const [campagnaInput, setCampagnaInput] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Pass data to parent onSuccess handler which will do the API call
    onSuccess(formData);
  };

  const addCampagna = () => {
    if (campagnaInput.trim() && !formData.campagne_autorizzate.includes(campagnaInput.trim())) {
      setFormData({
        ...formData,
        campagne_autorizzate: [...formData.campagne_autorizzate, campagnaInput.trim()],
      });
      setCampagnaInput("");
    }
  };

  const removeCampagna = (campagna) => {
    setFormData({
      ...formData,
      campagne_autorizzate: formData.campagne_autorizzate.filter((c) => c !== campagna),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Nuova Unit Lead</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome Unit *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Commesse Autorizzate *</Label>
              <div className="space-y-2">
                <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2">
                  {commesse.map((commessa) => (
                    <div key={commessa.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`commessa-${commessa.id}`}
                        checked={formData.commesse_autorizzate.includes(commessa.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              commesse_autorizzate: [...formData.commesse_autorizzate, commessa.id]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              commesse_autorizzate: formData.commesse_autorizzate.filter(id => id !== commessa.id)
                            });
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`commessa-${commessa.id}`} className="text-sm cursor-pointer">
                        {commessa.nome}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  Selezionate: {formData.commesse_autorizzate.length} commess{formData.commesse_autorizzate.length === 1 ? 'a' : 'e'}
                </p>
              </div>
            </div>

            <div>
              <Label>Campagne Autorizzate</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={campagnaInput}
                  onChange={(e) => setCampagnaInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCampagna();
                    }
                  }}
                  placeholder="Nome campagna"
                />
                <Button type="button" onClick={addCampagna} variant="outline">
                  Aggiungi
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.campagne_autorizzate.map((campagna, idx) => (
                  <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                    {campagna}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeCampagna(campagna)}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Smistamento Automatico */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Smistamento Automatico</Label>
                  <p className="text-xs text-gray-500 mt-1">
                    Se attivo, i lead vengono assegnati automaticamente agli agenti in base alla provincia
                  </p>
                </div>
                <Switch
                  checked={formData.auto_assign_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, auto_assign_enabled: checked })}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">Crea Unit</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

// Edit Unit Modal

const EditUnitModal = ({ unit, onClose, onSuccess, commesse }) => {
  const [formData, setFormData] = useState({
    nome: unit.nome,
    commesse_autorizzate: unit.commesse_autorizzate || [],
    campagne_autorizzate: unit.campagne_autorizzate || [],
    auto_assign_enabled: unit.auto_assign_enabled !== false, // NEW: Default true if undefined
    is_active: unit.is_active,
    welcome_message: unit.welcome_message || "",
  });
  const [campagnaInput, setCampagnaInput] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Pass data to parent onSuccess handler which will do the API call
    onSuccess(formData);
  };

  const addCampagna = () => {
    if (campagnaInput.trim() && !formData.campagne_autorizzate.includes(campagnaInput.trim())) {
      setFormData({
        ...formData,
        campagne_autorizzate: [...formData.campagne_autorizzate, campagnaInput.trim()],
      });
      setCampagnaInput("");
    }
  };

  const removeCampagna = (campagna) => {
    setFormData({
      ...formData,
      campagne_autorizzate: formData.campagne_autorizzate.filter((c) => c !== campagna),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Modifica Unit Lead</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome Unit *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Commesse Autorizzate *</Label>
              <div className="space-y-2">
                <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2">
                  {commesse.map((commessa) => (
                    <div key={commessa.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`commessa-${commessa.id}`}
                        checked={formData.commesse_autorizzate.includes(commessa.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              commesse_autorizzate: [...formData.commesse_autorizzate, commessa.id]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              commesse_autorizzate: formData.commesse_autorizzate.filter(id => id !== commessa.id)
                            });
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`commessa-${commessa.id}`} className="text-sm cursor-pointer">
                        {commessa.nome}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  Selezionate: {formData.commesse_autorizzate.length} commess{formData.commesse_autorizzate.length === 1 ? 'a' : 'e'}
                </p>
              </div>
            </div>

            <div>
              <Label>Campagne Autorizzate</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={campagnaInput}
                  onChange={(e) => setCampagnaInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCampagna();
                    }
                  }}
                  placeholder="Nome campagna"
                />
                <Button type="button" onClick={addCampagna} variant="outline">
                  Aggiungi
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.campagne_autorizzate.map((campagna, idx) => (
                  <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                    {campagna}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeCampagna(campagna)}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Smistamento Automatico */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Smistamento Automatico</Label>
                  <p className="text-xs text-gray-500 mt-1">
                    Se attivo, i lead vengono assegnati automaticamente agli agenti in base alla provincia
                  </p>
                </div>
                <Switch
                  checked={formData.auto_assign_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, auto_assign_enabled: checked })}
                />
              </div>
            </div>

            {/* Welcome Message for WhatsApp */}
            <div>
              <Label htmlFor="welcome_message">Messaggio Benvenuto WhatsApp</Label>
              <textarea
                id="welcome_message"
                value={formData.welcome_message}
                onChange={(e) => setFormData({ ...formData, welcome_message: e.target.value })}
                placeholder="Ciao {nome}! Benvenuto in {unit_name}. Sei pronto per iniziare? Rispondi SI per continuare."
                className="w-full p-2 border border-gray-300 rounded-lg min-h-[100px]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Usa {"{nome}"}, {"{cognome}"}, {"{unit_name}"} come placeholder
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <Label htmlFor="is_active">Unit Attiva</Label>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">Salva Modifiche</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

// ============================================================================
// LEAD STATUS MANAGEMENT COMPONENT - For managing dynamic lead statuses
// ============================================================================

const LeadStatusManagement = () => {
  const [statuses, setStatuses] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [filterUnit, setFilterUnit] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchStatuses();
    fetchUnits();
  }, [filterUnit]);

  const fetchStatuses = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterUnit && filterUnit !== "all") {
        params.append("unit_id", filterUnit);
      } else {
        // Quando "Tutti" è selezionato, mostra tutti gli status (globali + per unit)
        params.append("show_all", "true");
      }
      const response = await axios.get(`${API}/lead-status?${params}`);
      setStatuses(response.data);
    } catch (error) {
      console.error("Error fetching lead statuses:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento degli status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUnits = async () => {
    try {
      const response = await axios.get(`${API}/units`);
      setUnits(response.data);
    } catch (error) {
      console.error("Error fetching units:", error);
    }
  };

  const deleteStatus = async (statusId, statusName) => {
    if (!window.confirm(`Sei sicuro di voler eliminare lo status "${statusName}"?`)) {
      return;
    }

    try {
      await axios.delete(`${API}/lead-status/${statusId}`);
      toast({
        title: "Successo",
        description: "Status eliminato con successo",
      });
      fetchStatuses();
    } catch (error) {
      console.error("Error deleting status:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'eliminazione dello status",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-slate-800">Gestione Status Lead</h2>
        <div className="flex gap-2">
          <select
            className="border rounded-md p-2"
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
          >
            <option value="">Tutti gli status</option>
            <option value="all">Solo globali</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.nome}
              </option>
            ))}
          </select>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nuovo Status
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Ordine</TableHead>
                <TableHead>Colore</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statuses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500">
                    Nessuno status trovato
                  </TableCell>
                </TableRow>
              ) : (
                statuses.map((status) => {
                  const unit = units.find((u) => u.id === status.unit_id);
                  return (
                    <TableRow key={status.id}>
                      <TableCell className="font-medium">{status.nome}</TableCell>
                      <TableCell>
                        {status.unit_id ? (
                          <Badge variant="outline">{unit?.nome || "N/A"}</Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800">Globale</Badge>
                        )}
                      </TableCell>
                      <TableCell>{status.ordine}</TableCell>
                      <TableCell>
                        {status.colore ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded border"
                              style={{ backgroundColor: status.colore }}
                            />
                            <span className="text-sm">{status.colore}</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">Nessuno</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {status.is_active ? (
                          <Badge className="bg-green-100 text-green-800">Attivo</Badge>
                        ) : (
                          <Badge variant="secondary">Inattivo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedStatus(status);
                            setShowEditModal(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteStatus(status.id, status.nome)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showCreateModal && (
        <CreateLeadStatusModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchStatuses();
          }}
          units={units}
        />
      )}

      {showEditModal && selectedStatus && (
        <EditLeadStatusModal
          status={selectedStatus}
          onClose={() => {
            setShowEditModal(false);
            setSelectedStatus(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedStatus(null);
            fetchStatuses();
          }}
          units={units}
        />
      )}
    </div>
  );
};

// Create Lead Status Modal

const CreateLeadStatusModal = ({ onClose, onSuccess, units }) => {
  const [formData, setFormData] = useState({
    nome: "",
    unit_id: "",
    ordine: 0,
    colore: "#3b82f6",
  });
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        unit_id: formData.unit_id || null,
      };
      await axios.post(`${API}/lead-status`, submitData);
      toast({
        title: "Successo",
        description: "Status creato con successo",
      });
      onSuccess();
    } catch (error) {
      console.error("Error creating lead status:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nella creazione dello status",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Nuovo Status Lead</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome Status *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="unit_id">Unit (lasciare vuoto per status globale)</Label>
              <select
                id="unit_id"
                className="w-full border rounded-md p-2"
                value={formData.unit_id}
                onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
              >
                <option value="">Globale (tutte le unit)</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="ordine">Ordine di visualizzazione</Label>
              <Input
                id="ordine"
                type="number"
                value={formData.ordine}
                onChange={(e) => setFormData({ ...formData, ordine: parseInt(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="colore">Colore</Label>
              <div className="flex gap-2">
                <Input
                  id="colore"
                  type="color"
                  value={formData.colore}
                  onChange={(e) => setFormData({ ...formData, colore: e.target.value })}
                  className="w-20"
                />
                <Input
                  type="text"
                  value={formData.colore}
                  onChange={(e) => setFormData({ ...formData, colore: e.target.value })}
                  placeholder="#3b82f6"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">Crea Status</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

// Edit Lead Status Modal

const EditLeadStatusModal = ({ status, onClose, onSuccess, units }) => {
  const [formData, setFormData] = useState({
    nome: status.nome,
    ordine: status.ordine,
    colore: status.colore || "#3b82f6",
    is_active: status.is_active,
  });
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/lead-status/${status.id}`, formData);
      toast({
        title: "Successo",
        description: "Status aggiornato con successo",
      });
      onSuccess();
    } catch (error) {
      console.error("Error updating lead status:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'aggiornamento dello status",
        variant: "destructive",
      });
    }
  };

  const unit = units.find((u) => u.id === status.unit_id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Modifica Status Lead</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <Label>Unit</Label>
              <p className="text-sm text-gray-600">
                {status.unit_id ? unit?.nome || "N/A" : "Globale (tutte le unit)"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                L'unit non può essere modificata dopo la creazione
              </p>
            </div>

            <div>
              <Label htmlFor="nome">Nome Status *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="ordine">Ordine di visualizzazione</Label>
              <Input
                id="ordine"
                type="number"
                value={formData.ordine}
                onChange={(e) => setFormData({ ...formData, ordine: parseInt(e.target.value) })}
              />
            </div>

            <div>
              <Label htmlFor="colore">Colore</Label>
              <div className="flex gap-2">
                <Input
                  id="colore"
                  type="color"
                  value={formData.colore}
                  onChange={(e) => setFormData({ ...formData, colore: e.target.value })}
                  className="w-20"
                />
                <Input
                  type="text"
                  value={formData.colore}
                  onChange={(e) => setFormData({ ...formData, colore: e.target.value })}
                  placeholder="#3b82f6"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              <Label htmlFor="is_active">Status Attivo</Label>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">Salva Modifiche</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

// Custom Fields Management Component

const CustomFieldsManagement = () => {
  const [customFields, setCustomFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedField, setSelectedField] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomFields();
  }, []);

  const fetchCustomFields = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/custom-fields`);
      setCustomFields(response.data);
    } catch (error) {
      console.error("Error fetching custom fields:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei campi personalizzati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteField = async (fieldId, fieldName) => {
    if (!window.confirm(`Sei sicuro di voler eliminare il campo "${fieldName}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API}/custom-fields/${fieldId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      toast({
        title: "Successo",
        description: "Campo eliminato con successo",
      });
      fetchCustomFields();
    } catch (error) {
      console.error("Error deleting custom field:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'eliminazione del campo",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Caricamento...</div>;
  }

  const fieldTypeLabels = {
    text: "Testo",
    number: "Numero",
    select: "Selezione",
    checkbox: "Checkbox",
    date: "Data"
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-slate-800">Campi Personalizzati Lead</h2>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuovo Campo
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Campo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Richiesto</TableHead>
                <TableHead>Opzioni</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customFields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">
                    Nessun campo personalizzato trovato. Aggiungi il primo campo!
                  </TableCell>
                </TableRow>
              ) : (
                customFields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">{field.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{fieldTypeLabels[field.field_type] || field.field_type}</Badge>
                    </TableCell>
                    <TableCell>
                      {field.required ? (
                        <Badge className="bg-red-100 text-red-800">Obbligatorio</Badge>
                      ) : (
                        <Badge variant="secondary">Opzionale</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {field.options && field.options.length > 0 ? (
                        <div className="text-sm text-gray-600">
                          {field.options.slice(0, 3).join(", ")}
                          {field.options.length > 3 && "..."}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedField(field);
                          setShowEditModal(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteField(field.id, field.name)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showCreateModal && (
        <CreateCustomFieldModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchCustomFields();
          }}
        />
      )}

      {showEditModal && selectedField && (
        <EditCustomFieldModal
          field={selectedField}
          onClose={() => {
            setShowEditModal(false);
            setSelectedField(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedField(null);
            fetchCustomFields();
          }}
        />
      )}
    </div>
  );
};

// Create Custom Field Modal

const CreateCustomFieldModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    field_type: "text",  // Fixed: was 'type', backend expects 'field_type'
    required: false,
    options: []
  });
  const [optionInput, setOptionInput] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Errore",
        description: "Il nome del campo è obbligatorio",
        variant: "destructive",
      });
      return;
    }

    if (formData.field_type === "select" && formData.options.length === 0) {
      toast({
        title: "Errore",
        description: "Devi aggiungere almeno un'opzione per il campo select",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API}/custom-fields`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      toast({
        title: "Successo",
        description: "Campo creato con successo",
      });
      onSuccess();
    } catch (error) {
      console.error("Error creating custom field:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nella creazione del campo",
        variant: "destructive",
      });
    }
  };

  const addOption = () => {
    if (optionInput.trim()) {
      setFormData({
        ...formData,
        options: [...formData.options, optionInput.trim()]
      });
      setOptionInput("");
    }
  };

  const removeOption = (index) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Nuovo Campo Personalizzato</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nome Campo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Es: Numero Contratto, Data Installazione..."
                required
              />
            </div>

            <div>
              <Label htmlFor="type">Tipo Campo *</Label>
              <Select
                value={formData.field_type}
                onValueChange={(value) => setFormData({ ...formData, field_type: value, options: [] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Testo</SelectItem>
                  <SelectItem value="number">Numero</SelectItem>
                  <SelectItem value="select">Selezione (Dropdown)</SelectItem>
                  <SelectItem value="checkbox">Checkbox</SelectItem>
                  <SelectItem value="date">Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.field_type === "select" && (
              <div>
                <Label>Opzioni *</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={optionInput}
                    onChange={(e) => setOptionInput(e.target.value)}
                    placeholder="Aggiungi un'opzione"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOption();
                      }
                    }}
                  />
                  <Button type="button" onClick={addOption} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1">
                  {formData.options.map((option, index) => (
                    <div key={index} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                      <span className="text-sm">{option}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOption(index)}
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="required"
                checked={formData.required}
                onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="required" className="cursor-pointer">
                Campo obbligatorio
              </Label>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">Crea Campo</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

// Edit Custom Field Modal

const EditCustomFieldModal = ({ field, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: field.name,
    field_type: field.field_type,  // Fixed: was 'type', backend uses 'field_type'
    required: field.required,
    options: field.options || []
  });
  const [optionInput, setOptionInput] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Errore",
        description: "Il nome del campo è obbligatorio",
        variant: "destructive",
      });
      return;
    }

    if (formData.field_type === "select" && formData.options.length === 0) {
      toast({
        title: "Errore",
        description: "Devi aggiungere almeno un'opzione per il campo select",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API}/custom-fields/${field.id}`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      toast({
        title: "Successo",
        description: "Campo aggiornato con successo",
      });
      onSuccess();
    } catch (error) {
      console.error("Error updating custom field:", error);
      toast({
        title: "Errore",
        description: error.response?.data?.detail || "Errore nell'aggiornamento del campo",
        variant: "destructive",
      });
    }
  };

  const addOption = () => {
    if (optionInput.trim()) {
      setFormData({
        ...formData,
        options: [...formData.options, optionInput.trim()]
      });
      setOptionInput("");
    }
  };

  const removeOption = (index) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Modifica Campo Personalizzato</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nome Campo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Tipo Campo</Label>
              <p className="text-sm text-gray-600 p-2 bg-slate-50 rounded">
                {formData.field_type === "text" && "Testo"}
                {formData.field_type === "number" && "Numero"}
                {formData.field_type === "select" && "Selezione (Dropdown)"}
                {formData.field_type === "checkbox" && "Checkbox"}
                {formData.field_type === "date" && "Data"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Il tipo non può essere modificato dopo la creazione
              </p>
            </div>

            {formData.field_type === "select" && (
              <div>
                <Label>Opzioni *</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={optionInput}
                    onChange={(e) => setOptionInput(e.target.value)}
                    placeholder="Aggiungi un'opzione"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOption();
                      }
                    }}
                  />
                  <Button type="button" onClick={addOption} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1">
                  {formData.options.map((option, index) => (
                    <div key={index} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                      <span className="text-sm">{option}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOption(index)}
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="required"
                checked={formData.required}
                onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="required" className="cursor-pointer">
                Campo obbligatorio
              </Label>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit">Salva Modifiche</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};


// Lead Detail Modal Component

export { UnitsManagement, CreateUnitModal, EditUnitModal, LeadStatusManagement, CreateLeadStatusModal, EditLeadStatusModal, CustomFieldsManagement, CreateCustomFieldModal, EditCustomFieldModal };
