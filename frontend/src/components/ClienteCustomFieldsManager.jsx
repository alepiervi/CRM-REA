import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Checkbox } from "./ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useToast } from "../hooks/use-toast";
import { Trash2, Edit2, Plus, Database, LayoutGrid, Flag } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FIELD_TYPES = [
  { value: "text", label: "Testo" },
  { value: "textarea", label: "Area di testo" },
  { value: "number", label: "Numero" },
  { value: "date", label: "Data" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Telefono" },
  { value: "select", label: "Menu a tendina" },
  { value: "multi_select", label: "Selezione multipla" },
  { value: "checkbox", label: "Checkbox (Sì/No)" },
];

const emptyFieldForm = {
  commessa_id: "",
  tipologia_contratto_id: "",
  section_id: "",
  name: "",
  label: "",
  field_type: "text",
  options: [],
  placeholder: "",
  required: false,
  order: 0,
  active: true,
};

const emptySectionForm = {
  commessa_id: "",
  tipologia_contratto_id: "",
  name: "",
  icon: "📋",
  order: 0,
  active: true,
};

const STATUS_STAGES = [
  { value: "nuovo", label: "Nuovo", color: "bg-blue-100 text-blue-800" },
  { value: "in_lavorazione", label: "In Lavorazione", color: "bg-amber-100 text-amber-800" },
  { value: "chiuso_vinto", label: "Chiuso Vinto", color: "bg-green-100 text-green-800" },
  { value: "chiuso_perso", label: "Chiuso Perso", color: "bg-red-100 text-red-800" },
];

const emptyStatusForm = {
  commessa_id: "",
  tipologia_contratto_id: "",
  name: "",
  color: "#6366f1",
  icon: "",
  stage: "in_lavorazione",
  order: 0,
  active: true,
};

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function ClienteCustomFieldsManager() {
  const { toast } = useToast();
  const [commesse, setCommesse] = useState([]);
  const [tipologie, setTipologie] = useState([]);
  const [filterCommessa, setFilterCommessa] = useState("");
  const [filterTipologia, setFilterTipologia] = useState("");
  const [fields, setFields] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("fields");

  // Field dialog state
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [fieldForm, setFieldForm] = useState(emptyFieldForm);
  const [optionsInput, setOptionsInput] = useState("");

  // Section dialog state
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [sectionForm, setSectionForm] = useState(emptySectionForm);

  // Status dialog state
  const [statuses, setStatuses] = useState([]);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [statusForm, setStatusForm] = useState(emptyStatusForm);
  const [statusBreakdown, setStatusBreakdown] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const [comRes, tipRes] = await Promise.all([
          axios.get(`${API}/commesse`, { headers: authHeaders() }),
          axios.get(`${API}/tipologie-contratto/all`, { headers: authHeaders() }),
        ]);
        setCommesse(Array.isArray(comRes.data) ? comRes.data : []);
        setTipologie(Array.isArray(tipRes.data) ? tipRes.data : []);
      } catch (err) {
        console.error("Error loading meta:", err);
      }
    })();
  }, []);

  // Fetch tipologie specifiche per una commessa (reutilizzabile per ogni contesto)
  const fetchTipologieForCommessa = async (commessaId) => {
    if (!commessaId) return [];
    try {
      const res = await axios.get(`${API}/tipologie-contratto`, {
        params: { commessa_id: commessaId },
        headers: authHeaders()
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      console.error("Error fetching tipologie for commessa:", err);
      return [];
    }
  };

  // Tipologie dinamiche per ogni contesto
  const [filterTipologieList, setFilterTipologieList] = useState([]);
  const [fieldTipologieList, setFieldTipologieList] = useState([]);
  const [sectionTipologieList, setSectionTipologieList] = useState([]);
  const [statusTipologieList, setStatusTipologieList] = useState([]);

  // Filter: al cambio di filterCommessa → ricarica tipologie + reset selezione
  useEffect(() => {
    if (filterCommessa) {
      fetchTipologieForCommessa(filterCommessa).then((list) => {
        setFilterTipologieList(list);
        // reset tipologia se non più compatibile
        if (filterTipologia && !list.find((t) => t.value === filterTipologia)) {
          setFilterTipologia("");
        }
      });
    } else {
      setFilterTipologieList([]);
      setFilterTipologia("");
    }
  }, [filterCommessa]);

  // Field dialog: al cambio di fieldForm.commessa_id → ricarica tipologie
  useEffect(() => {
    if (fieldForm.commessa_id) {
      fetchTipologieForCommessa(fieldForm.commessa_id).then((list) => {
        setFieldTipologieList(list);
        // In create mode, se la tipologia selezionata non appartiene alla nuova commessa → reset
        if (!editingFieldId && fieldForm.tipologia_contratto_id && !list.find(t => t.value === fieldForm.tipologia_contratto_id)) {
          setFieldForm(f => ({ ...f, tipologia_contratto_id: "", section_id: "" }));
        }
      });
    } else {
      setFieldTipologieList([]);
    }
  }, [fieldForm.commessa_id]);

  // Section dialog
  useEffect(() => {
    if (sectionForm.commessa_id) {
      fetchTipologieForCommessa(sectionForm.commessa_id).then((list) => {
        setSectionTipologieList(list);
        if (!editingSectionId && sectionForm.tipologia_contratto_id && !list.find(t => t.value === sectionForm.tipologia_contratto_id)) {
          setSectionForm(f => ({ ...f, tipologia_contratto_id: "" }));
        }
      });
    } else {
      setSectionTipologieList([]);
    }
  }, [sectionForm.commessa_id]);

  // Status dialog
  useEffect(() => {
    if (statusForm.commessa_id) {
      fetchTipologieForCommessa(statusForm.commessa_id).then((list) => {
        setStatusTipologieList(list);
        if (!editingStatusId && statusForm.tipologia_contratto_id && !list.find(t => t.value === statusForm.tipologia_contratto_id)) {
          setStatusForm(f => ({ ...f, tipologia_contratto_id: "" }));
        }
      });
    } else {
      setStatusTipologieList([]);
    }
  }, [statusForm.commessa_id]);

  useEffect(() => {
    loadData();
    loadStatusBreakdown();
  }, [filterCommessa, filterTipologia]);

  const loadStatusBreakdown = async () => {
    try {
      const params = {};
      if (filterCommessa) params.commessa_id = filterCommessa;
      if (filterTipologia) params.tipologia_contratto_id = filterTipologia;
      const res = await axios.get(`${API}/analytics/cliente-statuses-breakdown`, { params, headers: authHeaders() });
      setStatusBreakdown(res.data || null);
    } catch (err) {
      console.error("Error loading status breakdown:", err);
      setStatusBreakdown(null);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = { active_only: false };
      if (filterCommessa) params.commessa_id = filterCommessa;
      if (filterTipologia) params.tipologia_contratto_id = filterTipologia;
      const [fRes, sRes, stRes] = await Promise.all([
        axios.get(`${API}/cliente-custom-fields`, { params, headers: authHeaders() }),
        axios.get(`${API}/cliente-custom-sections`, { params, headers: authHeaders() }),
        axios.get(`${API}/cliente-custom-statuses`, { params, headers: authHeaders() }),
      ]);
      setFields(Array.isArray(fRes.data) ? fRes.data : []);
      setSections(Array.isArray(sRes.data) ? sRes.data : []);
      setStatuses(Array.isArray(stRes.data) ? stRes.data : []);
    } catch (err) {
      console.error("Error loading data:", err);
      toast({ title: "Errore", description: "Impossibile caricare dati", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ---------- FIELD HANDLERS ----------
  const openCreateFieldDialog = () => {
    setEditingFieldId(null);
    setFieldForm({ ...emptyFieldForm, commessa_id: filterCommessa, tipologia_contratto_id: filterTipologia });
    setOptionsInput("");
    setFieldDialogOpen(true);
  };

  const openEditFieldDialog = (field) => {
    setEditingFieldId(field.id);
    setFieldForm({
      commessa_id: field.commessa_id,
      tipologia_contratto_id: field.tipologia_contratto_id,
      section_id: field.section_id || "",
      name: field.name,
      label: field.label,
      field_type: field.field_type,
      options: field.options || [],
      placeholder: field.placeholder || "",
      required: field.required,
      order: field.order,
      active: field.active,
    });
    setOptionsInput((field.options || []).join(", "));
    setFieldDialogOpen(true);
  };

  const handleSaveField = async () => {
    if (!fieldForm.commessa_id || !fieldForm.tipologia_contratto_id || !fieldForm.label || !fieldForm.field_type) {
      toast({ title: "Campi obbligatori", description: "Commessa, Tipologia, Etichetta e Tipo sono obbligatori", variant: "destructive" });
      return;
    }
    const needsOptions = fieldForm.field_type === "select" || fieldForm.field_type === "multi_select";
    const payload = { ...fieldForm };
    if (needsOptions) {
      const parsed = optionsInput.split(",").map((o) => o.trim()).filter(Boolean);
      if (parsed.length === 0) {
        toast({ title: "Opzioni richieste", description: "Per select/multi-select inserisci almeno un'opzione", variant: "destructive" });
        return;
      }
      payload.options = parsed;
    } else {
      payload.options = [];
    }
    // Convert empty section_id to null
    payload.section_id = payload.section_id || null;

    try {
      if (editingFieldId) {
        const updatePayload = {
          label: payload.label,
          field_type: payload.field_type,
          options: payload.options,
          placeholder: payload.placeholder,
          required: payload.required,
          order: payload.order,
          active: payload.active,
          section_id: payload.section_id,
        };
        await axios.put(`${API}/cliente-custom-fields/${editingFieldId}`, updatePayload, { headers: authHeaders() });
        toast({ title: "Campo aggiornato" });
      } else {
        payload.name = payload.name || payload.label;
        await axios.post(`${API}/cliente-custom-fields`, payload, { headers: authHeaders() });
        toast({ title: "Campo creato" });
      }
      setFieldDialogOpen(false);
      loadData();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Errore salvataggio";
      toast({ title: "Errore", description: msg, variant: "destructive" });
    }
  };

  const handleDeleteField = async (field) => {
    if (!window.confirm(`Eliminare "${field.label}"? I valori già salvati nei clienti non verranno rimossi.`)) return;
    try {
      await axios.delete(`${API}/cliente-custom-fields/${field.id}`, { headers: authHeaders() });
      toast({ title: "Campo eliminato" });
      loadData();
    } catch (err) {
      toast({ title: "Errore", description: "Eliminazione fallita", variant: "destructive" });
    }
  };

  // ---------- SECTION HANDLERS ----------
  const openCreateSectionDialog = () => {
    setEditingSectionId(null);
    setSectionForm({ ...emptySectionForm, commessa_id: filterCommessa, tipologia_contratto_id: filterTipologia });
    setSectionDialogOpen(true);
  };

  const openEditSectionDialog = (section) => {
    setEditingSectionId(section.id);
    setSectionForm({
      commessa_id: section.commessa_id,
      tipologia_contratto_id: section.tipologia_contratto_id,
      name: section.name,
      icon: section.icon || "📋",
      order: section.order,
      active: section.active,
    });
    setSectionDialogOpen(true);
  };

  const handleSaveSection = async () => {
    if (!sectionForm.commessa_id || !sectionForm.tipologia_contratto_id || !sectionForm.name) {
      toast({ title: "Campi obbligatori", description: "Commessa, Tipologia e Nome sono obbligatori", variant: "destructive" });
      return;
    }
    try {
      if (editingSectionId) {
        const updatePayload = {
          name: sectionForm.name,
          icon: sectionForm.icon,
          order: sectionForm.order,
          active: sectionForm.active,
        };
        await axios.put(`${API}/cliente-custom-sections/${editingSectionId}`, updatePayload, { headers: authHeaders() });
        toast({ title: "Sezione aggiornata" });
      } else {
        await axios.post(`${API}/cliente-custom-sections`, sectionForm, { headers: authHeaders() });
        toast({ title: "Sezione creata" });
      }
      setSectionDialogOpen(false);
      loadData();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Errore salvataggio";
      toast({ title: "Errore", description: msg, variant: "destructive" });
    }
  };

  const handleDeleteSection = async (section) => {
    if (!window.confirm(`Eliminare la sezione "${section.name}"? I campi assegnati verranno spostati nel gruppo di default (non eliminati).`)) return;
    try {
      await axios.delete(`${API}/cliente-custom-sections/${section.id}`, { headers: authHeaders() });
      toast({ title: "Sezione eliminata" });
      loadData();
    } catch (err) {
      toast({ title: "Errore", description: "Eliminazione fallita", variant: "destructive" });
    }
  };

  // ---------- STATUS HANDLERS ----------
  const openCreateStatusDialog = () => {
    setEditingStatusId(null);
    setStatusForm({ ...emptyStatusForm, commessa_id: filterCommessa, tipologia_contratto_id: filterTipologia });
    setStatusDialogOpen(true);
  };

  const openEditStatusDialog = (st) => {
    setEditingStatusId(st.id);
    setStatusForm({
      commessa_id: st.commessa_id,
      tipologia_contratto_id: st.tipologia_contratto_id,
      name: st.name,
      color: st.color || "#6366f1",
      icon: st.icon || "",
      stage: st.stage,
      order: st.order,
      active: st.active,
    });
    setStatusDialogOpen(true);
  };

  const handleSaveStatus = async () => {
    if (!statusForm.commessa_id || !statusForm.tipologia_contratto_id || !statusForm.name) {
      toast({ title: "Campi obbligatori", description: "Commessa, Tipologia e Nome sono obbligatori", variant: "destructive" });
      return;
    }
    try {
      if (editingStatusId) {
        const updatePayload = {
          name: statusForm.name,
          color: statusForm.color,
          icon: statusForm.icon || null,
          stage: statusForm.stage,
          order: statusForm.order,
          active: statusForm.active,
        };
        await axios.put(`${API}/cliente-custom-statuses/${editingStatusId}`, updatePayload, { headers: authHeaders() });
        toast({ title: "Status aggiornato" });
      } else {
        await axios.post(`${API}/cliente-custom-statuses`, statusForm, { headers: authHeaders() });
        toast({ title: "Status creato" });
      }
      setStatusDialogOpen(false);
      loadData();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Errore salvataggio";
      toast({ title: "Errore", description: msg, variant: "destructive" });
    }
  };

  const handleDeleteStatus = async (st) => {
    if (!window.confirm(`Eliminare lo status "${st.name}"? Gli eventuali clienti con questo status manterranno il valore storico.`)) return;
    try {
      const res = await axios.delete(`${API}/cliente-custom-statuses/${st.id}`, { headers: authHeaders() });
      const used = res?.data?.clients_using_status || 0;
      toast({ title: "Status eliminato", description: used > 0 ? `${used} clienti mantengono il valore storico` : undefined });
      loadData();
    } catch (err) {
      toast({ title: "Errore", description: "Eliminazione fallita", variant: "destructive" });
    }
  };

  // ---------- HELPERS ----------
  const getCommessaName = (id) => commesse.find((c) => c.id === id)?.nome || id;
  const getTipologiaName = (id) => tipologie.find((t) => t.value === id)?.label || id;
  const getSectionName = (id) => sections.find((s) => s.id === id)?.name || "— (Campi Aggiuntivi)";

  const needsOptions = fieldForm.field_type === "select" || fieldForm.field_type === "multi_select";

  // Sections filtered for current field form context (commessa+tipologia of the field)
  const sectionsForField = sections.filter(
    (s) => s.commessa_id === fieldForm.commessa_id && s.tipologia_contratto_id === fieldForm.tipologia_contratto_id
  );

  return (
    <div className="space-y-6" data-testid="cliente-custom-fields-page">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-6 h-6 text-blue-600" />
          Campi e Sezioni Personalizzati Clienti
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Definisci sezioni e campi aggiuntivi per ogni combinazione <strong>Commessa + Tipologia Contratto</strong>.
          Appariranno automaticamente nel form di creazione/modifica clienti.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Commessa</Label>
              <select className="w-full p-2 border border-gray-300 rounded-lg bg-white" value={filterCommessa} onChange={(e) => setFilterCommessa(e.target.value)} data-testid="filter-commessa">
                <option value="">Tutte le commesse</option>
                {commesse.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
              </select>
            </div>
            <div>
              <Label>Tipologia Contratto</Label>
              <select className="w-full p-2 border border-gray-300 rounded-lg bg-white disabled:bg-slate-50" value={filterTipologia} onChange={(e) => setFilterTipologia(e.target.value)} disabled={!filterCommessa} data-testid="filter-tipologia">
                <option value="">{filterCommessa ? "Tutte le tipologie della commessa" : "Seleziona prima una commessa"}</option>
                {filterTipologieList.map((t) => (<option key={t.value} value={t.value}>{t.label || "(senza nome)"}</option>))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="fields" data-testid="tab-fields"><Database className="w-4 h-4 mr-2" />Campi ({fields.length})</TabsTrigger>
          <TabsTrigger value="sections" data-testid="tab-sections"><LayoutGrid className="w-4 h-4 mr-2" />Sezioni ({sections.length})</TabsTrigger>
          <TabsTrigger value="statuses" data-testid="tab-statuses"><Flag className="w-4 h-4 mr-2" />Status ({statuses.length})</TabsTrigger>
        </TabsList>

        {/* --- FIELDS TAB --- */}
        <TabsContent value="fields">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Campi definiti {loading && <span className="text-sm text-slate-500 font-normal">(caricamento...)</span>}</CardTitle>
              <Button onClick={openCreateFieldDialog} className="bg-blue-600 hover:bg-blue-700" data-testid="add-custom-field-btn">
                <Plus className="w-4 h-4 mr-2" /> Nuovo Campo
              </Button>
            </CardHeader>
            <CardContent>
              {!loading && fields.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Database className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Nessun campo personalizzato definito.</p>
                </div>
              )}
              {fields.length > 0 && (
                <div className="space-y-2">
                  {fields.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50" data-testid={`custom-field-row-${f.id}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{f.label}</span>
                          <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{f.name}</code>
                          <Badge variant="outline">{FIELD_TYPES.find((t) => t.value === f.field_type)?.label || f.field_type}</Badge>
                          {f.required && <Badge className="bg-red-100 text-red-800">Obbligatorio</Badge>}
                          {!f.active && <Badge className="bg-slate-200 text-slate-600">Disattivato</Badge>}
                          <Badge className="bg-indigo-100 text-indigo-800">📁 {getSectionName(f.section_id)}</Badge>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {getCommessaName(f.commessa_id)} → {getTipologiaName(f.tipologia_contratto_id)}
                          {f.options && f.options.length > 0 && <span className="ml-2">• Opzioni: {f.options.join(", ")}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEditFieldDialog(f)} data-testid={`edit-field-${f.id}`}><Edit2 className="w-4 h-4" /></Button>
                        <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleDeleteField(f)} data-testid={`delete-field-${f.id}`}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- SECTIONS TAB --- */}
        <TabsContent value="sections">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Sezioni personalizzate</CardTitle>
              <Button onClick={openCreateSectionDialog} className="bg-indigo-600 hover:bg-indigo-700" data-testid="add-custom-section-btn">
                <Plus className="w-4 h-4 mr-2" /> Nuova Sezione
              </Button>
            </CardHeader>
            <CardContent>
              {!loading && sections.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <LayoutGrid className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Nessuna sezione personalizzata definita.</p>
                  <p className="text-sm mt-1">Le sezioni raggruppano i campi nel form cliente.</p>
                </div>
              )}
              {sections.length > 0 && (
                <div className="space-y-2">
                  {sections.map((s) => {
                    const fieldsInSection = fields.filter((f) => f.section_id === s.id).length;
                    return (
                      <div key={s.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50" data-testid={`custom-section-row-${s.id}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xl">{s.icon || "📋"}</span>
                            <span className="font-semibold text-slate-900">{s.name}</span>
                            <Badge variant="outline">#{s.order}</Badge>
                            {!s.active && <Badge className="bg-slate-200 text-slate-600">Disattivata</Badge>}
                            <Badge className="bg-blue-100 text-blue-800">{fieldsInSection} campi</Badge>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {getCommessaName(s.commessa_id)} → {getTipologiaName(s.tipologia_contratto_id)}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditSectionDialog(s)} data-testid={`edit-section-${s.id}`}><Edit2 className="w-4 h-4" /></Button>
                          <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleDeleteSection(s)} data-testid={`delete-section-${s.id}`}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- STATUSES TAB --- */}
        <TabsContent value="statuses">
          {/* Funnel Analytics Widget */}
          {statusBreakdown && statusBreakdown.total > 0 && (
            <Card className="mb-4" data-testid="status-funnel-widget">
              <CardHeader>
                <CardTitle className="text-lg">📊 Imbuto Status Cliente ({statusBreakdown.total} clienti)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {STATUS_STAGES.map((stage) => {
                    const count = statusBreakdown.by_stage[stage.value] || 0;
                    const pct = statusBreakdown.total > 0 ? Math.round((count / statusBreakdown.total) * 100) : 0;
                    return (
                      <div key={stage.value} className={`p-3 rounded-lg border ${stage.color.replace('text-', 'border-').replace('bg-', 'border-')}`} data-testid={`stage-tile-${stage.value}`}>
                        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{stage.label}</div>
                        <div className="text-2xl font-bold mt-1 text-slate-900">{count}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{pct}% del totale</div>
                      </div>
                    );
                  })}
                </div>
                {statusBreakdown.by_status.length > 0 && (
                  <details className="mt-4">
                    <summary className="text-sm text-slate-600 cursor-pointer hover:text-slate-900">Dettaglio per singolo status</summary>
                    <div className="mt-2 space-y-1">
                      {statusBreakdown.by_status.map((s) => (
                        <div key={s.value} className="flex items-center justify-between text-sm py-1 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            {s.color && <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: s.color }} />}
                            <span>{s.name}</span>
                            {!s.is_standard && <Badge className="bg-emerald-100 text-emerald-800 text-xs">Custom</Badge>}
                            <Badge variant="outline" className="text-xs">{STATUS_STAGES.find(x => x.value === s.stage)?.label || s.stage}</Badge>
                          </div>
                          <span className="font-semibold">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Status personalizzati</CardTitle>
              <Button onClick={openCreateStatusDialog} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-custom-status-btn">
                <Plus className="w-4 h-4 mr-2" /> Nuovo Status
              </Button>
            </CardHeader>
            <CardContent>
              {!loading && statuses.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Flag className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Nessuno status personalizzato definito.</p>
                  <p className="text-sm mt-1">Aggiungi status aggiuntivi oltre a quelli standard. Verranno mappati in Analytics per stage di imbuto.</p>
                </div>
              )}
              {statuses.length > 0 && (
                <div className="space-y-2">
                  {statuses.map((st) => {
                    const stageMeta = STATUS_STAGES.find(s => s.value === st.stage) || STATUS_STAGES[1];
                    return (
                      <div key={st.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50" data-testid={`custom-status-row-${st.id}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="w-4 h-4 rounded-full border border-slate-300" style={{ backgroundColor: st.color }} />
                            {st.icon && <span className="text-lg">{st.icon}</span>}
                            <span className="font-semibold text-slate-900">{st.name}</span>
                            <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{st.value}</code>
                            <Badge className={stageMeta.color}>Stage: {stageMeta.label}</Badge>
                            <Badge variant="outline">#{st.order}</Badge>
                            {!st.active && <Badge className="bg-slate-200 text-slate-600">Disattivato</Badge>}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {getCommessaName(st.commessa_id)} → {getTipologiaName(st.tipologia_contratto_id)}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditStatusDialog(st)} data-testid={`edit-status-${st.id}`}><Edit2 className="w-4 h-4" /></Button>
                          <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleDeleteStatus(st)} data-testid={`delete-status-${st.id}`}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* --- FIELD DIALOG --- */}
      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingFieldId ? "Modifica campo" : "Nuovo campo personalizzato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Commessa *</Label>
                <select className="w-full p-2 border border-gray-300 rounded-lg bg-white disabled:bg-slate-50" value={fieldForm.commessa_id} onChange={(e) => setFieldForm({ ...fieldForm, commessa_id: e.target.value, section_id: "" })} disabled={!!editingFieldId} data-testid="field-commessa-select">
                  <option value="">Seleziona commessa...</option>
                  {commesse.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
                </select>
              </div>
              <div>
                <Label>Tipologia Contratto *</Label>
                <select className="w-full p-2 border border-gray-300 rounded-lg bg-white disabled:bg-slate-50" value={fieldForm.tipologia_contratto_id} onChange={(e) => setFieldForm({ ...fieldForm, tipologia_contratto_id: e.target.value, section_id: "" })} disabled={!!editingFieldId || !fieldForm.commessa_id} data-testid="field-tipologia-select">
                  <option value="">{fieldForm.commessa_id ? "Seleziona tipologia..." : "Seleziona prima una commessa"}</option>
                  {fieldTipologieList.map((t) => (<option key={t.value} value={t.value}>{t.label || "(senza nome)"}</option>))}
                </select>
              </div>
            </div>
            <div>
              <Label>Sezione di destinazione</Label>
              <select className="w-full p-2 border border-gray-300 rounded-lg bg-white" value={fieldForm.section_id} onChange={(e) => setFieldForm({ ...fieldForm, section_id: e.target.value })} data-testid="field-section-select">
                <option value="">— Campi Aggiuntivi (default)</option>
                {sectionsForField.map((s) => (<option key={s.id} value={s.id}>{s.icon} {s.name}</option>))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Le sezioni disponibili dipendono dalla combinazione Commessa + Tipologia scelta. Crea prima le sezioni dal tab "Sezioni".
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Etichetta visualizzata *</Label>
                <Input value={fieldForm.label} onChange={(e) => setFieldForm({ ...fieldForm, label: e.target.value })} placeholder="Es: Codice Cliente Esterno" data-testid="field-label-input" />
              </div>
              <div>
                <Label>Tipo di campo *</Label>
                <select className="w-full p-2 border border-gray-300 rounded-lg bg-white" value={fieldForm.field_type} onChange={(e) => setFieldForm({ ...fieldForm, field_type: e.target.value })} data-testid="field-type-select">
                  {FIELD_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                </select>
              </div>
            </div>
            <div>
              <Label>Placeholder (testo guida)</Label>
              <Input value={fieldForm.placeholder} onChange={(e) => setFieldForm({ ...fieldForm, placeholder: e.target.value })} placeholder="Opzionale" />
            </div>
            {needsOptions && (
              <div>
                <Label>Opzioni (separate da virgola) *</Label>
                <Input value={optionsInput} onChange={(e) => setOptionsInput(e.target.value)} placeholder="Es: Valido, Scaduto, Da verificare" data-testid="field-options-input" />
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <Label>Ordinamento</Label>
                <Input type="number" value={fieldForm.order} onChange={(e) => setFieldForm({ ...fieldForm, order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Checkbox id="field-required" checked={fieldForm.required} onCheckedChange={(v) => setFieldForm({ ...fieldForm, required: !!v })} data-testid="field-required-checkbox" />
                <Label htmlFor="field-required" className="cursor-pointer">Obbligatorio</Label>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Checkbox id="field-active" checked={fieldForm.active} onCheckedChange={(v) => setFieldForm({ ...fieldForm, active: !!v })} />
                <Label htmlFor="field-active" className="cursor-pointer">Attivo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSaveField} className="bg-blue-600 hover:bg-blue-700" data-testid="save-field-btn">
              {editingFieldId ? "Salva modifiche" : "Crea campo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- SECTION DIALOG --- */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingSectionId ? "Modifica sezione" : "Nuova sezione"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Commessa *</Label>
                <select className="w-full p-2 border border-gray-300 rounded-lg bg-white disabled:bg-slate-50" value={sectionForm.commessa_id} onChange={(e) => setSectionForm({ ...sectionForm, commessa_id: e.target.value })} disabled={!!editingSectionId} data-testid="section-commessa-select">
                  <option value="">Seleziona commessa...</option>
                  {commesse.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
                </select>
              </div>
              <div>
                <Label>Tipologia Contratto *</Label>
                <select className="w-full p-2 border border-gray-300 rounded-lg bg-white disabled:bg-slate-50" value={sectionForm.tipologia_contratto_id} onChange={(e) => setSectionForm({ ...sectionForm, tipologia_contratto_id: e.target.value })} disabled={!!editingSectionId || !sectionForm.commessa_id} data-testid="section-tipologia-select">
                  <option value="">{sectionForm.commessa_id ? "Seleziona tipologia..." : "Seleziona prima una commessa"}</option>
                  {sectionTipologieList.map((t) => (<option key={t.value} value={t.value}>{t.label || "(senza nome)"}</option>))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-3">
              <div>
                <Label>Icona</Label>
                <Input value={sectionForm.icon} onChange={(e) => setSectionForm({ ...sectionForm, icon: e.target.value })} placeholder="📋" data-testid="section-icon-input" />
              </div>
              <div>
                <Label>Nome sezione *</Label>
                <Input value={sectionForm.name} onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })} placeholder="Es: Dati contratto avanzati" data-testid="section-name-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label>Ordinamento</Label>
                <Input type="number" value={sectionForm.order} onChange={(e) => setSectionForm({ ...sectionForm, order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Checkbox id="section-active" checked={sectionForm.active} onCheckedChange={(v) => setSectionForm({ ...sectionForm, active: !!v })} />
                <Label htmlFor="section-active" className="cursor-pointer">Attiva</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSaveSection} className="bg-indigo-600 hover:bg-indigo-700" data-testid="save-section-btn">
              {editingSectionId ? "Salva modifiche" : "Crea sezione"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- STATUS DIALOG --- */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingStatusId ? "Modifica status" : "Nuovo status personalizzato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Commessa *</Label>
                <select className="w-full p-2 border border-gray-300 rounded-lg bg-white disabled:bg-slate-50" value={statusForm.commessa_id} onChange={(e) => setStatusForm({ ...statusForm, commessa_id: e.target.value })} disabled={!!editingStatusId} data-testid="status-commessa-select">
                  <option value="">Seleziona commessa...</option>
                  {commesse.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
                </select>
              </div>
              <div>
                <Label>Tipologia Contratto *</Label>
                <select className="w-full p-2 border border-gray-300 rounded-lg bg-white disabled:bg-slate-50" value={statusForm.tipologia_contratto_id} onChange={(e) => setStatusForm({ ...statusForm, tipologia_contratto_id: e.target.value })} disabled={!!editingStatusId || !statusForm.commessa_id} data-testid="status-tipologia-select">
                  <option value="">{statusForm.commessa_id ? "Seleziona tipologia..." : "Seleziona prima una commessa"}</option>
                  {statusTipologieList.map((t) => (<option key={t.value} value={t.value}>{t.label || "(senza nome)"}</option>))}
                </select>
              </div>
            </div>
            <div>
              <Label>Nome status *</Label>
              <Input value={statusForm.name} onChange={(e) => setStatusForm({ ...statusForm, name: e.target.value })} placeholder="Es: Richiamo Domani" data-testid="status-name-input" />
              <p className="text-xs text-slate-500 mt-1">Il valore tecnico (chiave) verrà generato automaticamente normalizzando il nome.</p>
            </div>
            <div className="grid grid-cols-[100px_100px_1fr] gap-3">
              <div>
                <Label>Icona</Label>
                <Input value={statusForm.icon} onChange={(e) => setStatusForm({ ...statusForm, icon: e.target.value })} placeholder="⏰" data-testid="status-icon-input" />
              </div>
              <div>
                <Label>Colore</Label>
                <Input type="color" value={statusForm.color} onChange={(e) => setStatusForm({ ...statusForm, color: e.target.value })} className="h-10" data-testid="status-color-input" />
              </div>
              <div>
                <Label>Stage (per Analytics) *</Label>
                <select className="w-full p-2 border border-gray-300 rounded-lg bg-white" value={statusForm.stage} onChange={(e) => setStatusForm({ ...statusForm, stage: e.target.value })} data-testid="status-stage-select">
                  {STATUS_STAGES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label>Ordinamento</Label>
                <Input type="number" value={statusForm.order} onChange={(e) => setStatusForm({ ...statusForm, order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Checkbox id="status-active" checked={statusForm.active} onCheckedChange={(v) => setStatusForm({ ...statusForm, active: !!v })} />
                <Label htmlFor="status-active" className="cursor-pointer">Attivo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSaveStatus} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-status-btn">
              {editingStatusId ? "Salva modifiche" : "Crea status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
