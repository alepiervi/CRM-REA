import React, { useState } from "react";
import axios from "axios";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useToast } from "../../hooks/use-toast";
import { API, errMsg } from "./shared";

export const AssegnazioneForm = ({ segnalazione, options, onSaved }) => {
  const [commessaId, setCommessaId] = useState(segnalazione.commessa_id || "");
  const [servizioId, setServizioId] = useState(segnalazione.servizio_id || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const commessa = options.find((c) => c.id === commessaId);
  const unchanged = commessaId === segnalazione.commessa_id && servizioId === segnalazione.servizio_id;

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/segnalazioni/${segnalazione.id}/assegnazione`, { commessa_id: commessaId, servizio_id: servizioId });
      toast({ title: "Commessa e servizio assegnati" });
      onSaved();
    } catch (e) {
      toast({ title: "Errore", description: errMsg(e, "Impossibile assegnare"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 border rounded-lg p-4 bg-blue-50/40" data-testid="assegnazione-form">
      <Label className="font-semibold">Assegnazione commessa e servizio</Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select value={commessaId} onValueChange={(v) => { setCommessaId(v); setServizioId(""); }}>
          <SelectTrigger data-testid="assegnazione-commessa-select"><SelectValue placeholder="Seleziona commessa" /></SelectTrigger>
          <SelectContent>{options.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={servizioId} onValueChange={setServizioId} disabled={!commessa}>
          <SelectTrigger data-testid="assegnazione-servizio-select"><SelectValue placeholder="Seleziona servizio" /></SelectTrigger>
          <SelectContent>{(commessa?.servizi || []).map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button size="sm" onClick={save} disabled={saving || !commessaId || !servizioId || unchanged} data-testid="assegnazione-save-btn">
        {saving ? "Salvataggio..." : "Salva assegnazione"}
      </Button>
    </div>
  );
};
