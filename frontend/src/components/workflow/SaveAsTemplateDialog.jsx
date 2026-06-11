import React, { useEffect, useState } from "react";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Bookmark, Save, AlertCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const COLORS = ["green","blue","purple","orange","yellow","red","gray","indigo","violet","emerald","rose","slate","amber","fuchsia"];

export const SaveAsTemplateDialog = ({ workflow, open, onClose, onSaved }) => {
  const [nodes, setNodes] = useState([]);
  const [exposeIds, setExposeIds] = useState(new Set());
  const [draft, setDraft] = useState({ name: "", description: "", icon: "workflow", color: "violet" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!workflow) return;
    setDraft({ name: `Copia di ${workflow.name || "workflow"}`, description: workflow.description || "", icon: "workflow", color: "violet" });
    // Recupera nodi dal workflow (può essere già denormalizzato)
    if (workflow.nodes) {
      setNodes(workflow.nodes);
    } else {
      axios.get(`${API}/workflows/${workflow.id}`, { headers: authHeaders() })
        .then(r => setNodes(r.data?.nodes || []))
        .catch(() => setNodes([]));
    }
    setExposeIds(new Set());
    setError("");
  }, [workflow]);

  const toggleExpose = (nid) => {
    const next = new Set(exposeIds);
    if (next.has(nid)) next.delete(nid); else next.add(nid);
    setExposeIds(next);
  };

  const countFieldsForNode = (n) => {
    const cfg = (n?.data?.config) || {};
    return Object.keys(cfg).length;
  };

  const totalParams = Array.from(exposeIds).reduce((acc, nid) => {
    const n = nodes.find(x => x.id === nid);
    return acc + countFieldsForNode(n);
  }, 0);

  const handleSave = async () => {
    if (!draft.name.trim() || !workflow) return;
    setSaving(true);
    setError("");
    try {
      const r = await axios.post(`${API}/workflows/${workflow.id}/save-as-template`, {
        name: draft.name, description: draft.description,
        icon: draft.icon, color: draft.color,
        expose_node_ids: Array.from(exposeIds),
      }, { headers: authHeaders() });
      onSaved && onSaved(r.data);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally { setSaving(false); }
  };

  if (!workflow) return null;
  const configurableNodes = nodes.filter(n => countFieldsForNode(n) > 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="save-tpl-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-violet-600" /> Salva come template
          </DialogTitle>
          <DialogDescription>Crea un template riusabile da questo workflow. Scegli quali parametri esporre.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome template *</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} data-testid="save-tpl-name" autoFocus />
            </div>
            <div>
              <Label>Colore</Label>
              <select className="w-full border rounded px-2 py-2 text-sm" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })}>
                {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>Descrizione</Label>
            <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Nodi da esporre come parametri ({exposeIds.size} selezionati • {totalParams} parametri)</Label>
            </div>
            {configurableNodes.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Nessun nodo del workflow ha campi config personalizzabili.</p>
            ) : (
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {configurableNodes.map((n) => {
                  const isSelected = exposeIds.has(n.id);
                  const cfg = n.data?.config || {};
                  return (
                    <label key={n.id} className={`flex items-start gap-2 p-2 border-b last:border-b-0 cursor-pointer ${isSelected ? "bg-violet-50" : "hover:bg-slate-50"}`} data-testid={`expose-node-${n.id}`}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleExpose(n.id)} className="mt-1" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{n.data?.label || n.id}</div>
                        <div className="text-[10px] text-slate-500">{n.data?.nodeType} / {n.data?.nodeSubtype}</div>
                        {isSelected && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {Object.entries(cfg).map(([k, v]) => (
                              <Badge key={k} variant="outline" className="text-[10px]">{k}: <code className="ml-1">{String(v).slice(0, 30)}</code></Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-800 flex items-start gap-1">
              <AlertCircle className="w-4 h-4 mt-0.5" /> {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSave} disabled={saving || !draft.name.trim()} data-testid="save-tpl-confirm">
            <Save className="w-4 h-4 mr-1" /> {saving ? "Salvataggio..." : "Salva template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveAsTemplateDialog;
