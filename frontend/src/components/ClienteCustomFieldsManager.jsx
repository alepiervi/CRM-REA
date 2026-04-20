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
import { Trash2, Edit2, Plus, Database, LayoutGrid } from "lucide-react";

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

  useEffect(() => {
    loadData();
  }, [filterCommessa, filterTipologia]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = { active_only: false };
      if (filterCommessa) params.commessa_id = filterCommessa;
      if (filterTipologia) params.tipologia_contratto_id = filterTipologia;
      const [fRes, sRes] = await Promise.all([
        axios.get(`${API}/cliente-custom-fields`, { params, headers: authHeaders() }),
        axios.get(`${API}/cliente-custom-sections`, { params, headers: authHeaders() }),
      ]);
      setFields(Array.isArray(fRes.data) ? fRes.data : []);
      setSections(Array.isArray(sRes.data) ? sRes.data : []);
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
              <select className="w-full p-2 border border-gray-300 rounded-lg bg-white" value={filterTipologia} onChange={(e) => setFilterTipologia(e.target.value)} data-testid="filter-tipologia">
                <option value="">Tutte le tipologie</option>
                {tipologie.map((t) => (<option key={t.value} value={t.value}>{t.label || "(senza nome)"}</option>))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="fields" data-testid="tab-fields"><Database className="w-4 h-4 mr-2" />Campi ({fields.length})</TabsTrigger>
          <TabsTrigger value="sections" data-testid="tab-sections"><LayoutGrid className="w-4 h-4 mr-2" />Sezioni ({sections.length})</TabsTrigger>
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
                <select className="w-full p-2 border border-gray-300 rounded-lg bg-white disabled:bg-slate-50" value={fieldForm.tipologia_contratto_id} onChange={(e) => setFieldForm({ ...fieldForm, tipologia_contratto_id: e.target.value, section_id: "" })} disabled={!!editingFieldId} data-testid="field-tipologia-select">
                  <option value="">Seleziona tipologia...</option>
                  {tipologie.map((t) => (<option key={t.value} value={t.value}>{t.label || "(senza nome)"}</option>))}
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
                <select className="w-full p-2 border border-gray-300 rounded-lg bg-white disabled:bg-slate-50" value={sectionForm.tipologia_contratto_id} onChange={(e) => setSectionForm({ ...sectionForm, tipologia_contratto_id: e.target.value })} disabled={!!editingSectionId} data-testid="section-tipologia-select">
                  <option value="">Seleziona tipologia...</option>
                  {tipologie.map((t) => (<option key={t.value} value={t.value}>{t.label || "(senza nome)"}</option>))}
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
    </div>
  );
}
