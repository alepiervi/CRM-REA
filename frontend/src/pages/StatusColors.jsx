import React, { useEffect, useState } from "react";
import axios from "axios";
import { Palette, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { API } from "../lib/appUtils";
import { setStatusColorMap } from "../lib/statusColors";
import { useToast } from "../hooks/use-toast";

const StatusColorRow = ({ item, scope, onSaved }) => {
  const { toast } = useToast();
  const [color, setColor] = useState(item.color || "#3b82f6");
  const [saving, setSaving] = useState(false);

  const save = async (newColor) => {
    setSaving(true);
    try {
      await axios.put(`${API}/status-colors`, { scope, key: item.key, color: newColor });
      onSaved && (await onSaved());
    } catch (e) {
      toast({ title: "Errore", description: e.response?.data?.detail || "Impossibile salvare il colore", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50" data-testid={`status-color-row-${scope}-${item.key}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
          style={{ backgroundColor: color, color: "#fff" }}
        >
          {item.label}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {saving && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        <Input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          onBlur={(e) => save(e.target.value)}
          className="w-12 h-9 p-1 cursor-pointer"
          data-testid={`status-color-input-${scope}-${item.key}`}
        />
        <span className="text-xs text-slate-500 w-16 font-mono">{color}</span>
      </div>
    </div>
  );
};

const StatusColorSection = ({ title, items, scope, onSaved, emptyMsg }) => (
  <div className="space-y-2">
    <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">{title}</h3>
    {(!items || items.length === 0) ? (
      <p className="text-sm text-slate-400 py-2">{emptyMsg}</p>
    ) : (
      <div className="space-y-1.5">
        {items.map((it) => (
          <StatusColorRow key={`${scope}-${it.key}`} item={it} scope={scope} onSaved={onSaved} />
        ))}
      </div>
    )}
  </div>
);

export default function StatusColors() {
  const [catalog, setCatalog] = useState({ cliente_fixed: [], cliente_custom: [], lead: [] });
  const [loading, setLoading] = useState(true);

  const fetchCatalog = async () => {
    try {
      const res = await axios.get(`${API}/status-colors/catalog`);
      setCatalog(res.data || { cliente_fixed: [], cliente_custom: [], lead: [] });
    } catch (e) {
      // no-op
    } finally {
      setLoading(false);
    }
  };

  // Ricarica la mappa globale (per aggiornare i badge in tutta l'app)
  const refreshGlobalMap = async () => {
    try {
      const res = await axios.get(`${API}/status-colors`);
      setStatusColorMap(res.data);
    } catch (e) { /* no-op */ }
  };

  const handleSaved = async () => {
    await refreshGlobalMap();
    fetchCatalog();
  };

  useEffect(() => { fetchCatalog(); }, []);

  return (
    <div className="space-y-6" data-testid="status-colors-page">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-md">
          <Palette className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Colori Status</h1>
          <p className="text-sm text-slate-500">Assegna un colore a ogni status per distinguerli visivamente in tutta l'app.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Caricamento...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="status-colors-cliente-card">
            <CardHeader>
              <CardTitle className="text-lg">Status Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <StatusColorSection title="Status Fissi" items={catalog.cliente_fixed} scope="cliente" onSaved={handleSaved} emptyMsg="Nessuno status fisso." />
              <StatusColorSection title="Status Personalizzati" items={catalog.cliente_custom} scope="cliente" onSaved={handleSaved} emptyMsg="Nessuno status personalizzato creato." />
            </CardContent>
          </Card>

          <Card data-testid="status-colors-lead-card">
            <CardHeader>
              <CardTitle className="text-lg">Status Lead</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusColorSection title="Status Lead" items={catalog.lead} scope="lead" onSaved={handleSaved} emptyMsg="Nessuno status lead creato." />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
