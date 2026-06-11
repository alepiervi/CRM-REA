import React, { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Tag, Plus, Trash2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export const TagsManager = () => {
  const [tags, setTags] = useState([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", color: "#64748b", description: "" });

  const fetchTags = async () => {
    try {
      const r = await axios.get(`${API}/lead-tags`, { headers: authHeaders() });
      setTags(r.data || []);
    } catch (e) { setTags([]); }
  };

  useEffect(() => { fetchTags(); }, []);

  const createTag = async () => {
    if (!draft.name.trim()) return;
    try {
      await axios.post(`${API}/lead-tags`, draft, { headers: authHeaders() });
      setCreating(false);
      setDraft({ name: "", color: "#64748b", description: "" });
      fetchTags();
    } catch (e) {
      alert(e?.response?.data?.detail || "Errore");
    }
  };

  const deleteTag = async (id, name) => {
    if (!window.confirm(`Eliminare il tag "${name}"? Verrà rimosso da tutti i lead.`)) return;
    await axios.delete(`${API}/lead-tags/${id}`, { headers: authHeaders() });
    fetchTags();
  };

  return (
    <div className="p-6 space-y-4" data-testid="tags-manager">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tag className="w-6 h-6 text-emerald-600" /> Gestione Tag Lead
        </h1>
        <Button onClick={() => setCreating(true)} data-testid="tag-create-btn">
          <Plus className="w-4 h-4 mr-1" /> Nuovo Tag
        </Button>
      </div>

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

      <Card>
        <CardHeader><CardTitle className="text-base">{tags.length} tag definiti</CardTitle></CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <p className="text-sm text-slate-500">Nessun tag definito. Crea il primo per categorizzare i lead.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {tags.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`tag-row-${t.id}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded-full" style={{ background: t.color }}></span>
                    <div>
                      <div className="font-semibold">{t.label || t.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{t.name}</div>
                      {t.description && <div className="text-xs text-slate-600 mt-1">{t.description}</div>}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteTag(t.id, t.name)} data-testid={`tag-delete-${t.id}`}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-slate-500 mt-4">
        💡 I tag possono essere applicati automaticamente dai workflow tramite il nodo <Badge variant="outline">Aggiungi Tag</Badge>, oppure manualmente dalla scheda Lead.
      </div>
    </div>
  );
};

export default TagsManager;
