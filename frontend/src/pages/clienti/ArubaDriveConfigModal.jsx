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



// ArubaDriveConfigModal — estratto da ClienteModals.jsx (refactoring fase 2)

const ArubaDriveConfigModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  editingConfig 
}) => {
  const [formData, setFormData] = useState({
    name: "",
    url: "https://da6z2a.arubadrive.com/login?clear=1",
    username: "",
    password: "",
    is_active: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (editingConfig) {
      setFormData({
        name: editingConfig.name || "",
        url: editingConfig.url || "https://da6z2a.arubadrive.com/login?clear=1",
        username: editingConfig.username || "",
        password: "", // Non pre-compilare password per sicurezza
        is_active: editingConfig.is_active || false
      });
    } else {
      // Reset per nuova configurazione
      setFormData({
        name: "",
        url: "https://da6z2a.arubadrive.com/login?clear=1",
        username: "",
        password: "",
        is_active: false
      });
    }
  }, [editingConfig, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.url || !formData.username || (!editingConfig && !formData.password)) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const dataToSave = { ...formData };
      // Se stiamo modificando e password è vuota, non includerla nell'update
      if (editingConfig && !formData.password) {
        delete dataToSave.password;
      }

      await onSave(dataToSave);
      onClose();
    } catch (error) {
      console.error("Error saving config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {editingConfig ? "Modifica" : "Nuova"} Configurazione Aruba Drive
          </CardTitle>
          <p className="text-sm text-gray-600">
            Configura l'accesso al tuo account Aruba Drive
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome Configurazione *</Label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="es. Account Principale"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <Label htmlFor="url">URL Aruba Drive *</Label>
              <input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({...formData, url: e.target.value})}
                placeholder="https://da6z2a.arubadrive.com/login?clear=1"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <Label htmlFor="username">Username *</Label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                placeholder="Il tuo username Aruba Drive"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <Label htmlFor="password">
                Password {editingConfig ? "(lascia vuoto per mantenere)" : "*"}
              </Label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="La tua password Aruba Drive"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required={!editingConfig}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
              />
              <Label htmlFor="is_active" className="cursor-pointer">Imposta come configurazione attiva</Label>
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
              <p><strong>Note:</strong></p>
              <p>• Solo una configurazione può essere attiva alla volta</p>
              <p>• La configurazione attiva verrà usata per gli upload automatici</p>
              <p>• Puoi testare la connessione dopo aver salvato</p>
            </div>

            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {editingConfig ? "Aggiorna" : "Salva"}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1"
              >
                Annulla
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// Rimuovo il componente ClientiManagement duplicato - esiste già alla riga 11995

// Componente avanzato per gestire documenti multipli del cliente (stesse funzioni della sezione Documenti)


export { ArubaDriveConfigModal };
