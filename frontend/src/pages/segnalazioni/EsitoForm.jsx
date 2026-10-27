import React, { useState } from "react";
import axios from "axios";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
import { Textarea } from "../../components/ui/textarea";
import { useToast } from "../../hooks/use-toast";
import { API, ESITO_STYLES, errMsg } from "./shared";

export const EsitoForm = ({ segnalazione, esiti, sottoEsitiOk, onSaved }) => {
  const [esito, setEsito] = useState(segnalazione.esito || "");
  const [sotto, setSotto] = useState(segnalazione.sotto_esiti || []);
  const [nota, setNota] = useState(segnalazione.nota_esito || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const toggle = (s, on) => setSotto(on ? [...sotto, s] : sotto.filter((x) => x !== s));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await axios.put(`${API}/segnalazioni/${segnalazione.id}/esito`, {
        esito, sotto_esiti: esito === "OK" ? sotto : [], nota_esito: nota,
      });
      toast({ title: "Esito salvato", description: data.esito });
      onSaved(data);
    } catch (e) {
      toast({ title: "Errore", description: errMsg(e, "Impossibile salvare l'esito"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!segnalazione.commessa_id) {
    return <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3" data-testid="esito-blocked-msg">Assegna commessa e servizio per poter dare l'esito.</p>;
  }

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-slate-50" data-testid="esito-form">
      <Label className="font-semibold">Esito</Label>
      <div className="flex gap-2">
        {esiti.map((e) => (
          <button key={e} type="button" onClick={() => setEsito(e)} data-testid={`esito-option-${e.toLowerCase()}`}
            className={`px-5 py-2 rounded-md border text-sm font-semibold transition-colors ${esito === e ? ESITO_STYLES[e] + " ring-2 ring-offset-1 ring-slate-400" : "bg-white text-slate-600 hover:bg-slate-100"}`}>
            {e}
          </button>
        ))}
      </div>
      {esito === "OK" && (
        <div data-testid="sotto-esiti-section">
          <Label className="text-sm">Sotto esiti * <span className="text-slate-500 font-normal">(selezione multipla)</span></Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            {sottoEsitiOk.map((s, i) => (
              <label key={s} className="flex items-center gap-2 bg-white border rounded px-3 py-2 cursor-pointer text-sm">
                <Checkbox checked={sotto.includes(s)} onCheckedChange={(c) => toggle(s, !!c)} data-testid={`sotto-esito-checkbox-${i}`} />
                {s}
              </label>
            ))}
          </div>
        </div>
      )}
      <div><Label className="text-sm">Nota esito</Label><Textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} data-testid="esito-nota-input" /></div>
      <Button onClick={save} disabled={saving || !esito || (esito === "OK" && sotto.length === 0)} data-testid="esito-save-btn">
        {saving ? "Salvataggio..." : "Salva esito"}
      </Button>
    </div>
  );
};
