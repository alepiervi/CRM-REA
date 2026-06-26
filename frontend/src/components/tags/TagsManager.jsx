import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import {
  Tag, Plus, Trash2, Pencil, Merge, Search, AlertTriangle, Sparkles, Users, UserCheck,
} from "lucide-react";
import { useToast } from "../../hooks/use-toast";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export const TagsManager = () => {
  const { toast } = useToast();
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // all|used|unused|orphans

  // Create form
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", color: "#64748b", description: "" });

  // Edit form
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", label: "", color: "", description: "" });

  // Merge form
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");

  const fetchTags = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/lead-tags/usage`, { headers: authHeaders() });
      setTags(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      setTags([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTags(); }, []);

  const filtered = useMemo(() => {
    return tags.filter((t) => {
      if (search) {
        const q = search.toLowerCase();
        if (!`${t.name} ${t.label || ""} ${t.description || ""}`.toLowerCase().includes(q)) return false;
      }
      if (filterMode === "used" && t.total_count === 0) return false;
      if (filterMode === "unused" && t.total_count > 0) return false;
      if (filterMode === "orphans" && !t.is_orphan) return false;
      return true;
    });
  }, [tags, search, filterMode]);

  const totals = useMemo(() => ({
    all: tags.length,
    used: tags.filter((t) => t.total_count > 0).length,
    unused: tags.filter((t) => t.total_count === 0).length,
    orphans: tags.filter((t) => t.is_orphan).length,
  }), [tags]);

  const createTag = async () => {
    if (!draft.name.trim()) return;
    try {
      await axios.post(`${API}/lead-tags`, draft, { headers: authHeaders() });
      setCreating(false);
      setDraft({ name: "", color: "#64748b", description: "" });
      fetchTags();
      toast({ title: "Tag creato", description: draft.name });
    } catch (e) {
      toast({ title: "Errore", description: e?.response?.data?.detail || "Impossibile creare il tag", variant: "destructive" });
    }
  };

  const openEdit = (t) => {
    setEditing(t);
    setEditForm({ name: t.name, label: t.label || "", color: t.color || "#64748b", description: t.description || "" });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await axios.patch(`${API}/lead-tags/${editing.id}`, editForm, { headers: authHeaders() });
      setEditing(null);
      fetchTags();
      toast({ title: "Tag aggiornato", description: editForm.name });
    } catch (e) {
      toast({ title: "Errore", description: e?.response?.data?.detail || "Impossibile aggiornare", variant: "destructive" });
    }
  };

  const deleteTag = async (id, name, total) => {
    const msg = total > 0
      ? `Eliminare il tag "${name}"? Verrà rimosso da ${total} lead/clienti che lo hanno applicato.`
      : `Eliminare il tag "${name}"? Non è applicato a nessun lead/cliente.`;
    if (!window.confirm(msg)) return;
    try {
      await axios.delete(`${API}/lead-tags/${id}`, { headers: authHeaders() });
      fetchTags();
      toast({ title: "Tag eliminato", description: name });
    } catch (e) {
      toast({ title: "Errore", description: e?.response?.data?.detail || "Impossibile eliminare", variant: "destructive" });
    }
  };

  const runMerge = async () => {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return;
    const srcTag = tags.find((t) => t.id === mergeSource);
    const tgtTag = tags.find((t) => t.id === mergeTarget);
    if (!window.confirm(`Unire "${srcTag?.name}" in "${tgtTag?.name}"?\n${srcTag?.total_count || 0} lead/clienti verranno ri-taggati e il tag sorgente eliminato.`)) return;
    try {
      const r = await axios.post(`${API}/lead-tags/merge`, { source_id: mergeSource, target_id: mergeTarget }, { headers: authHeaders() });
      setMergeOpen(false);
      setMergeSource("");
      setMergeTarget("");
      fetchTags();
      toast({ title: "Merge completato", description: `${r.data.merged_from} → ${r.data.merged_into}` });
    } catch (e) {
      toast({ title: "Errore", description: e?.response?.data?.detail || "Impossibile unire", variant: "destructive" });
    }
  };

  const adoptOrphans = async () => {
    if (!window.confirm(`Creare formalmente in libreria i ${totals.orphans} tag orfani trovati?`)) return;
    try {
      const r = await axios.post(`${API}/lead-tags/cleanup-orphans`, {}, { headers: authHeaders() });
      fetchTags();
      toast({ title: "Cleanup completato", description: `${r.data.created_count} tag aggiunti alla libreria` });
    } catch (e) {
      toast({ title: "Errore", description: e?.response?.data?.detail || "Impossibile eseguire cleanup", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-4" data-testid="tags-manager">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tag className="w-6 h-6 text-emerald-600" /> Gestione Tag Lead
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Centralizza, rinomina, unisci e pulisci i tag usati su lead e clienti
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {totals.orphans > 0 && (
            <Button variant="outline" onClick={adoptOrphans} data-testid="adopt-orphans-btn" className="border-amber-300 text-amber-700">
              <Sparkles className="w-4 h-4 mr-1" /> Adotta {totals.orphans} orfani
            </Button>
          )}
          <Button variant="outline" onClick={() => setMergeOpen(true)} data-testid="merge-open-btn">
            <Merge className="w-4 h-4 mr-1" /> Unisci tag
          </Button>
          <Button onClick={() => setCreating(true)} data-testid="tag-create-btn">
            <Plus className="w-4 h-4 mr-1" /> Nuovo Tag
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={() => setFilterMode("all")} className={`p-3 rounded-lg border text-left transition-all ${filterMode === "all" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`} data-testid="stat-all">
          <div className="text-xs text-slate-500">Totali</div>
          <div className="text-2xl font-bold">{totals.all}</div>
        </button>
        <button onClick={() => setFilterMode("used")} className={`p-3 rounded-lg border text-left transition-all ${filterMode === "used" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`} data-testid="stat-used">
          <div className="text-xs text-slate-500">In uso</div>
          <div className="text-2xl font-bold text-emerald-600">{totals.used}</div>
        </button>
        <button onClick={() => setFilterMode("unused")} className={`p-3 rounded-lg border text-left transition-all ${filterMode === "unused" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`} data-testid="stat-unused">
          <div className="text-xs text-slate-500">Mai usati</div>
          <div className="text-2xl font-bold text-slate-400">{totals.unused}</div>
        </button>
        <button onClick={() => setFilterMode("orphans")} className={`p-3 rounded-lg border text-left transition-all ${filterMode === "orphans" ? "border-amber-500 bg-amber-50" : "border-slate-200 bg-white hover:border-slate-300"}`} data-testid="stat-orphans">
          <div className="text-xs text-slate-500 flex items-center gap-1">Orfani <AlertTriangle className="w-3 h-3" /></div>
          <div className="text-2xl font-bold text-amber-600">{totals.orphans}</div>
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca tag..."
          className="pl-9"
          data-testid="tags-search"
        />
      </div>

      {/* Create form */}
      {creating && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome (slug auto-generato)</Label>
                <Input data-testid="tag-name-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="es. Sorgente Sito Web" autoFocus />
              </div>
              <div>
                <Label>Colore</Label>
                <input type="color" className="w-full h-10 rounded border" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Descrizione (opzionale)</Label>
              <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button onClick={createTag} data-testid="tag-save-btn">Salva</Button>
              <Button variant="outline" onClick={() => setCreating(false)}>Annulla</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tag list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {filtered.length} tag visibili
            <Badge variant="outline" className="ml-2 text-xs">{filterMode}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-500">Caricamento…</div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Nessun tag corrisponde ai filtri.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((t) => (
                <div key={t.name} className={`p-3 border rounded-lg ${t.is_orphan ? "border-amber-300 bg-amber-50/30" : "border-slate-200 bg-white"}`} data-testid={`tag-row-${t.name}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: t.color }}></span>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{t.label || t.name}</div>
                        <div className="text-xs text-slate-500 font-mono truncate">{t.name}</div>
                      </div>
                    </div>
                    {t.is_orphan && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">orfano</Badge>
                    )}
                  </div>
                  {t.description && <div className="text-xs text-slate-600 mt-2">{t.description}</div>}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      <Users className="w-3 h-3 mr-1" /> {t.lead_count} lead
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <UserCheck className="w-3 h-3 mr-1" /> {t.cliente_count} clienti
                    </Badge>
                  </div>
                  <div className="mt-3 flex gap-1 justify-end">
                    {!t.is_orphan && t.id && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(t)} data-testid={`tag-edit-${t.name}`}>
                          <Pencil className="w-3.5 h-3.5 text-blue-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteTag(t.id, t.name, t.total_count)} data-testid={`tag-delete-${t.name}`}>
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-slate-500 mt-4">
        💡 I tag possono essere applicati automaticamente dai workflow tramite il nodo <Badge variant="outline">Aggiungi Tag</Badge>, oppure manualmente dalla scheda Lead. I tag "orfani" sono stati usati su lead/clienti ma non sono nella libreria formale (puoi adottarli con un click).
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent data-testid="tag-edit-dialog">
          <DialogHeader>
            <DialogTitle>Modifica tag</DialogTitle>
            <DialogDescription>
              Rinominando il tag (`name`) il nuovo nome verrà applicato a tutti i lead/clienti che lo hanno.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome (slug)</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} data-testid="tag-edit-name" />
            </div>
            <div>
              <Label>Label visualizzata</Label>
              <Input value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} data-testid="tag-edit-label" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Colore</Label>
                <input type="color" className="w-full h-10 rounded border" value={editForm.color} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Descrizione</Label>
                <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annulla</Button>
            <Button onClick={saveEdit} data-testid="tag-edit-save">Salva modifiche</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge dialog */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent data-testid="tag-merge-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Merge className="w-5 h-5" /> Unisci tag</DialogTitle>
            <DialogDescription>
              Il tag <strong>sorgente</strong> sarà eliminato e tutti i lead/clienti che lo avevano riceveranno il tag <strong>destinazione</strong> al suo posto. Operazione irreversibile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tag SORGENTE (verrà eliminato)</Label>
              <Select value={mergeSource} onValueChange={setMergeSource}>
                <SelectTrigger data-testid="merge-source-select"><SelectValue placeholder="Scegli..." /></SelectTrigger>
                <SelectContent>
                  {tags.filter((t) => t.id && !t.is_orphan).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label || t.name} ({t.total_count} uses)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tag DESTINAZIONE (riceverà gli usi)</Label>
              <Select value={mergeTarget} onValueChange={setMergeTarget}>
                <SelectTrigger data-testid="merge-target-select"><SelectValue placeholder="Scegli..." /></SelectTrigger>
                <SelectContent>
                  {tags.filter((t) => t.id && !t.is_orphan && t.id !== mergeSource).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label || t.name} ({t.total_count} uses)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>Annulla</Button>
            <Button onClick={runMerge} disabled={!mergeSource || !mergeTarget || mergeSource === mergeTarget} className="bg-purple-600 hover:bg-purple-700" data-testid="merge-execute-btn">
              <Merge className="w-4 h-4 mr-1" /> Unisci
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TagsManager;
