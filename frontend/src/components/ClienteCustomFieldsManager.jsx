import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Checkbox } from "./ui/checkbox";
import { useToast } from "../hooks/use-toast";
import { Trash2, Edit2, Plus, Database } from "lucide-react";

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

const emptyForm = {
  commessa_id: "",
  tipologia_contratto_id: "",
  name: "",
  label: "",
  field_type: "text",
  options: [],
  placeholder: "",
  required: false,
  order: 0,
  active: true,
};

export default function ClienteCustomFieldsManager() {
  const { toast } = useToast();
  const [commesse, setCommesse] = useState([]);
  const [tipologie, setTipologie] = useState([]);
  const [filterCommessa, setFilterCommessa] = useState("");
  const [filterTipologia, setFilterTipologia] = useState("");
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [optionsInput, setOptionsInput] = useState("");

  // Auth header helper
  const authHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Load commesse + tipologie on mount
  useEffect(() => {
    const loadMeta = async () => {
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
    };
    loadMeta();
  }, []);

  // Load fields when filter changes
  useEffect(() => {
    loadFields();
  }, [filterCommessa, filterTipologia]);

  const loadFields = async () => {
    setLoading(true);
    try {
      const params = { active_only: false };
      if (filterCommessa) params.commessa_id = filterCommessa;
      if (filterTipologia) params.tipologia_contratto_id = filterTipologia;
      const res = await axios.get(`${API}/cliente-custom-fields`, {
        params,
        headers: authHeaders(),
      });
      setFields(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error loading fields:", err);
      toast({ title: "Errore", description: "Impossibile caricare i campi personalizzati", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setForm({ ...emptyForm, commessa_id: filterCommessa, tipologia_contratto_id: filterTipologia });
    setOptionsInput("");
    setDialogOpen(true);
  };

  const openEditDialog = (field) => {
    setEditingId(field.id);
    setForm({
      commessa_id: field.commessa_id,
      tipologia_contratto_id: field.tipologia_contratto_id,
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
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.commessa_id || !form.tipologia_contratto_id || !form.label || !form.field_type) {
      toast({ title: "Campi obbligatori", description: "Commessa, Tipologia, Etichetta e Tipo sono obbligatori", variant: "destructive" });
      return;
    }
    const needsOptions = form.field_type === "select" || form.field_type === "multi_select";
    if (needsOptions) {
      const parsed = optionsInput
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      if (parsed.length === 0) {
        toast({ title: "Opzioni richieste", description: "Per menu a tendina/multi-select inserisci almeno un'opzione", variant: "destructive" });
        return;
      }
      form.options = parsed;
    } else {
      form.options = [];
    }

    try {
      if (editingId) {
        // Update: only send updatable fields
        const updatePayload = {
          label: form.label,
          field_type: form.field_type,
          options: form.options,
          placeholder: form.placeholder,
          required: form.required,
          order: form.order,
          active: form.active,
        };
        await axios.put(`${API}/cliente-custom-fields/${editingId}`, updatePayload, { headers: authHeaders() });
        toast({ title: "Campo aggiornato", description: `"${form.label}" salvato con successo` });
      } else {
        // Create: use name from label (will be normalized by backend)
        const createPayload = {
          ...form,
          name: form.name || form.label,
        };
        await axios.post(`${API}/cliente-custom-fields`, createPayload, { headers: authHeaders() });
        toast({ title: "Campo creato", description: `"${form.label}" aggiunto con successo` });
      }
      setDialogOpen(false);
      loadFields();
    } catch (err) {
      console.error("Save error:", err);
      const msg = err?.response?.data?.detail || "Errore durante il salvataggio";
      toast({ title: "Errore", description: msg, variant: "destructive" });
    }
  };

  const handleDelete = async (field) => {
    if (!window.confirm(`Eliminare il campo "${field.label}"? I valori già salvati nei clienti non verranno rimossi.`)) return;
    try {
      await axios.delete(`${API}/cliente-custom-fields/${field.id}`, { headers: authHeaders() });
      toast({ title: "Campo eliminato", description: `"${field.label}" rimosso` });
      loadFields();
    } catch (err) {
      toast({ title: "Errore", description: "Impossibile eliminare il campo", variant: "destructive" });
    }
  };

  const getCommessaName = (id) => commesse.find((c) => c.id === id)?.nome || id;
  const getTipologiaName = (id) => tipologie.find((t) => t.value === id)?.label || id;

  const needsOptions = form.field_type === "select" || form.field_type === "multi_select";

  return (
    <div className="space-y-6" data-testid="cliente-custom-fields-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-600" />
            Campi Personalizzati Clienti
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Definisci campi aggiuntivi specifici per ogni combinazione <strong>Commessa + Tipologia Contratto</strong>.
            I campi appariranno automaticamente nel form di creazione/modifica clienti.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700" data-testid="add-custom-field-btn">
          <Plus className="w-4 h-4 mr-2" /> Nuovo Campo
        </Button>
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
              <select
                className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                value={filterCommessa}
                onChange={(e) => setFilterCommessa(e.target.value)}
                data-testid="filter-commessa"
              >
                <option value="">Tutte le commesse</option>
                {commesse.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Tipologia Contratto</Label>
              <select
                className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                value={filterTipologia}
                onChange={(e) => setFilterTipologia(e.target.value)}
                data-testid="filter-tipologia"
              >
                <option value="">Tutte le tipologie</option>
                {tipologie.map((t) => (
                  <option key={t.value} value={t.value}>{t.label || "(senza nome)"}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Campi definiti {loading && <span className="text-sm text-slate-500 font-normal">(caricamento...)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!loading && fields.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Database className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>Nessun campo personalizzato definito per questa combinazione.</p>
              <p className="text-sm mt-1">Clicca <strong>"Nuovo Campo"</strong> per crearne uno.</p>
            </div>
          )}
          {fields.length > 0 && (
            <div className="space-y-2">
              {fields.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                  data-testid={`custom-field-row-${f.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{f.label}</span>
                      <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{f.name}</code>
                      <Badge variant="outline">{FIELD_TYPES.find((t) => t.value === f.field_type)?.label || f.field_type}</Badge>
                      {f.required && <Badge className="bg-red-100 text-red-800">Obbligatorio</Badge>}
                      {!f.active && <Badge className="bg-slate-200 text-slate-600">Disattivato</Badge>}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {getCommessaName(f.commessa_id)} → {getTipologiaName(f.tipologia_contratto_id)}
                      {f.options && f.options.length > 0 && (
                        <span className="ml-2">• Opzioni: {f.options.join(", ")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(f)} data-testid={`edit-field-${f.id}`}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleDelete(f)} data-testid={`delete-field-${f.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifica campo" : "Nuovo campo personalizzato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Commessa *</Label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white disabled:bg-slate-50"
                  value={form.commessa_id}
                  onChange={(e) => setForm({ ...form, commessa_id: e.target.value })}
                  disabled={!!editingId}
                  data-testid="field-commessa-select"
                >
                  <option value="">Seleziona commessa...</option>
                  {commesse.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Tipologia Contratto *</Label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white disabled:bg-slate-50"
                  value={form.tipologia_contratto_id}
                  onChange={(e) => setForm({ ...form, tipologia_contratto_id: e.target.value })}
                  disabled={!!editingId}
                  data-testid="field-tipologia-select"
                >
                  <option value="">Seleziona tipologia...</option>
                  {tipologie.map((t) => (
                    <option key={t.value} value={t.value}>{t.label || "(senza nome)"}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Etichetta visualizzata *</Label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Es: Codice Cliente Esterno"
                  data-testid="field-label-input"
                />
              </div>
              <div>
                <Label>Tipo di campo *</Label>
                <select
                  className="w-full p-2 border border-gray-300 rounded-lg bg-white"
                  value={form.field_type}
                  onChange={(e) => setForm({ ...form, field_type: e.target.value })}
                  data-testid="field-type-select"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Placeholder (testo guida)</Label>
              <Input
                value={form.placeholder}
                onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
                placeholder="Opzionale"
              />
            </div>
            {needsOptions && (
              <div>
                <Label>Opzioni (separate da virgola) *</Label>
                <Input
                  value={optionsInput}
                  onChange={(e) => setOptionsInput(e.target.value)}
                  placeholder="Es: Valido, Scaduto, Da verificare"
                  data-testid="field-options-input"
                />
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <Label>Ordinamento</Label>
                <Input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Checkbox
                  id="field-required"
                  checked={form.required}
                  onCheckedChange={(v) => setForm({ ...form, required: !!v })}
                  data-testid="field-required-checkbox"
                />
                <Label htmlFor="field-required" className="cursor-pointer">Obbligatorio</Label>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Checkbox
                  id="field-active"
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: !!v })}
                />
                <Label htmlFor="field-active" className="cursor-pointer">Attivo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700" data-testid="save-field-btn">
              {editingId ? "Salva modifiche" : "Crea campo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
