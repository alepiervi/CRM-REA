import React, { useEffect, useState } from "react";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { CheckCircle, Sparkles, Settings, Download } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export const TemplatePreviewDialog = ({ template, unitId, open, onClose, onImported }) => {
  const [overrides, setOverrides] = useState({});
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!template) return;
    const init = {};
    (template.parameters || []).forEach((p) => { init[p.key] = p.default ?? ""; });
    setOverrides(init);
  }, [template]);

  const updateField = (key, val) => setOverrides({ ...overrides, [key]: val });

  const handleImport = async () => {
    if (!template || !unitId) return;
    setImporting(true);
    setError("");
    try {
      const r = await axios.post(
        `${API}/workflow-templates/${template.id}/import?unit_id=${unitId}`,
        overrides,
        { headers: { ...authHeaders(), "Content-Type": "application/json" } }
      );
      onImported && onImported(r.data);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally {
      setImporting(false);
    }
  };

  if (!template) return null;
  const params = template.parameters || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="tpl-preview-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-600" />
            Preview & Personalizza: {template.name}
          </DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Riepilogo template */}
          <div className="bg-slate-50 border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{template.nodes_count} nodi</Badge>
              <Badge variant="outline">Trigger: {template.trigger}</Badge>
            </div>
            <ul className="text-xs space-y-1">
              {template.features.map((f, i) => (
                <li key={i} className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-600" /> {f}</li>
              ))}
            </ul>
          </div>

          {/* Parametri */}
          {params.length === 0 ? (
            <div className="text-sm text-slate-500 italic">
              Questo template non ha parametri personalizzabili — verrà importato con valori di default.
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
                <Settings className="w-4 h-4" /> Personalizza i parametri
              </div>
              <div className="space-y-3">
                {params.map((p) => (
                  <div key={p.key} data-testid={`tpl-param-${p.key}`}>
                    <Label className="text-xs">{p.label}</Label>
                    {p.type === "textarea" ? (
                      <Textarea
                        rows={2}
                        value={overrides[p.key] ?? ""}
                        onChange={(e) => updateField(p.key, e.target.value)}
                      />
                    ) : (
                      <Input
                        type={p.type === "number" ? "number" : "text"}
                        value={overrides[p.key] ?? ""}
                        onChange={(e) => updateField(p.key, e.target.value)}
                      />
                    )}
                    <div className="text-[10px] text-slate-400 mt-0.5">Default: <code>{String(p.default)}</code></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-800">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={handleImport} disabled={importing || !unitId} data-testid="tpl-preview-import">
            <Download className="w-4 h-4 mr-1" />
            {importing ? "Importando..." : "Importa workflow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TemplatePreviewDialog;
