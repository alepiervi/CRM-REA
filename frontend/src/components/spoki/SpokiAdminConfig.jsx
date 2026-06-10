import React, { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { MessageCircle, RefreshCw, AlertCircle, CheckCircle, QrCode, Save } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export const SpokiAdminConfig = ({ units = [] }) => {
  const [health, setHealth] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templatesError, setTemplatesError] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [unitConfig, setUnitConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [pairResponse, setPairResponse] = useState(null);
  const [allConfigs, setAllConfigs] = useState([]);

  const fetchHealth = async () => {
    try {
      const r = await axios.get(`${API}/spoki/health`, { headers: authHeaders() });
      setHealth(r.data);
    } catch (e) {
      setHealth({ status: "error", error: e.message });
    }
  };

  const fetchTemplates = async () => {
    try {
      const r = await axios.get(`${API}/spoki/templates`, { headers: authHeaders() });
      setTemplates(r.data?.templates || []);
      if (r.data?.error) setTemplatesError(r.data.error); else setTemplatesError("");
    } catch (e) {
      setTemplatesError(e?.response?.data?.detail || e.message);
    }
  };

  const fetchAllConfigs = async () => {
    try {
      const r = await axios.get(`${API}/spoki/unit-configs`, { headers: authHeaders() });
      setAllConfigs(r.data || []);
    } catch (e) { /* ignore */ }
  };

  const fetchUnitConfig = async (unitId) => {
    if (!unitId) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/spoki/unit-configs/${unitId}`, { headers: authHeaders() });
      setUnitConfig(r.data);
    } catch (e) {
      setUnitConfig(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchTemplates();
    fetchAllConfigs();
  }, []);

  useEffect(() => {
    if (selectedUnitId) fetchUnitConfig(selectedUnitId);
  }, [selectedUnitId]);

  const handleSave = async () => {
    if (!selectedUnitId || !unitConfig) return;
    setSaving(true);
    try {
      const payload = {
        whatsapp_number: unitConfig.whatsapp_number || null,
        welcome_template_name: unitConfig.welcome_template_name || null,
        welcome_template_language: unitConfig.welcome_template_language || "it",
        welcome_template_variables: unitConfig.welcome_template_variables || {},
        chatbot_system_prompt: unitConfig.chatbot_system_prompt || null,
        chatbot_enabled: !!unitConfig.chatbot_enabled,
      };
      const r = await axios.patch(`${API}/spoki/unit-configs/${selectedUnitId}`, payload, { headers: authHeaders() });
      setUnitConfig(r.data);
      fetchAllConfigs();
    } catch (e) {
      alert(e?.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const handlePair = async () => {
    if (!selectedUnitId) return;
    setPairing(true);
    setPairResponse(null);
    try {
      const r = await axios.post(`${API}/spoki/unit-configs/${selectedUnitId}/pair`, {}, { headers: authHeaders() });
      setPairResponse(r.data);
      fetchUnitConfig(selectedUnitId);
    } catch (e) {
      setPairResponse({ error: e?.response?.data?.detail || e.message });
    } finally {
      setPairing(false);
    }
  };

  const statusBadge = () => {
    if (!health) return <Badge variant="secondary">…</Badge>;
    if (health.status === "ok") return <Badge className="bg-green-600">Connesso</Badge>;
    if (health.status === "no_api_key") return <Badge variant="secondary">Chiave non configurata</Badge>;
    return <Badge variant="destructive">Errore: {health.error?.slice(0, 60)}</Badge>;
  };

  return (
    <div className="p-6 space-y-6" data-testid="spoki-admin-config">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-green-600" /> Configurazione WhatsApp Spoki
        </h1>
        <div className="flex items-center gap-3">
          {statusBadge()}
          <Button variant="outline" size="sm" onClick={() => { fetchHealth(); fetchTemplates(); }} data-testid="spoki-refresh">
            <RefreshCw className="w-4 h-4 mr-1" /> Aggiorna
          </Button>
        </div>
      </div>

      {health?.status === "error" && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-orange-700 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-900">
              <strong>Connessione Spoki non attiva.</strong> Verifica nel pannello Spoki che l&apos;API key sia stata generata e attivata.
              <div className="mt-1 font-mono text-xs">{health.error}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Seleziona Unit / Commessa</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
            <SelectTrigger data-testid="spoki-unit-select">
              <SelectValue placeholder="Scegli una Unit..." />
            </SelectTrigger>
            <SelectContent>
              {units?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome || u.label || u.id} {allConfigs.find(c => c.unit_id === u.id) ? "✓" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedUnitId && unitConfig && !loading && (
        <Card data-testid="spoki-unit-config-card">
          <CardHeader>
            <CardTitle>Configurazione Unit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Numero WhatsApp (E.164, es. +393331234567)</Label>
                <Input
                  data-testid="spoki-whatsapp-number"
                  value={unitConfig.whatsapp_number || ""}
                  onChange={(e) => setUnitConfig({ ...unitConfig, whatsapp_number: e.target.value })}
                  placeholder="+393331234567"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Stato pairing: <Badge variant={unitConfig.pairing_status === "connected" ? "default" : "secondary"}>{unitConfig.pairing_status || "not_paired"}</Badge>
                </div>
              </div>
              <div>
                <Label>Template di Benvenuto</Label>
                <Select
                  value={unitConfig.welcome_template_name || ""}
                  onValueChange={(v) => setUnitConfig({ ...unitConfig, welcome_template_name: v })}
                >
                  <SelectTrigger data-testid="spoki-template-select">
                    <SelectValue placeholder={templates.length ? "Scegli template..." : "Nessun template disponibile"} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t, i) => (
                      <SelectItem key={i} value={t.name || t.id || `tpl-${i}`}>
                        {t.name || t.id || `Template ${i+1}`} {t.language ? `(${t.language})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templatesError && <div className="text-xs text-red-600 mt-1">{templatesError}</div>}
              </div>
              <div>
                <Label>Lingua template</Label>
                <Input
                  value={unitConfig.welcome_template_language || "it"}
                  onChange={(e) => setUnitConfig({ ...unitConfig, welcome_template_language: e.target.value })}
                  placeholder="it"
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  data-testid="spoki-chatbot-switch"
                  checked={!!unitConfig.chatbot_enabled}
                  onCheckedChange={(v) => setUnitConfig({ ...unitConfig, chatbot_enabled: v })}
                />
                <Label>Chatbot OpenAI attivo</Label>
              </div>
            </div>

            <div>
              <Label>System prompt chatbot (italiano)</Label>
              <Textarea
                data-testid="spoki-system-prompt"
                rows={8}
                value={unitConfig.chatbot_system_prompt || ""}
                onChange={(e) => setUnitConfig({ ...unitConfig, chatbot_system_prompt: e.target.value })}
                placeholder="Sei l'assistente di Nureal..."
              />
              <div className="text-xs text-gray-500 mt-1">
                Il bot deve rispondere SOLO con JSON nel formato richiesto. Modifica con cautela il prompt di default.
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={saving} data-testid="spoki-save-config">
                <Save className="w-4 h-4 mr-1" /> {saving ? "Salvataggio..." : "Salva configurazione"}
              </Button>
              <Button variant="outline" onClick={handlePair} disabled={pairing || !health?.api_key_configured} data-testid="spoki-pair-number">
                <QrCode className="w-4 h-4 mr-1" /> {pairing ? "Generazione QR..." : "Associa numero (QR)"}
              </Button>
            </div>

            {pairResponse && (
              <Card className={pairResponse.error ? "border-red-300 bg-red-50" : "border-blue-300 bg-blue-50"}>
                <CardContent className="p-3 text-sm">
                  {pairResponse.error ? (
                    <div className="text-red-800">{pairResponse.error}</div>
                  ) : (
                    <>
                      <div className="font-semibold mb-1 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Sessione pairing aperta</div>
                      <pre className="text-xs overflow-x-auto">{JSON.stringify(pairResponse.spoki_response || pairResponse, null, 2)}</pre>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SpokiAdminConfig;
