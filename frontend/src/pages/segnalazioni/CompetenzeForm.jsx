import React, { useState } from "react";
import axios from "axios";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useToast } from "../../hooks/use-toast";
import { API, errMsg } from "./shared";

const NONE = "__none__";

export const CompetenzeForm = ({ segnalazione, competenze, onSaved }) => {
  const [values, setValues] = useState(segnalazione.competenze || {});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/segnalazioni/${segnalazione.id}/competenze`, { competenze: values });
      toast({ title: "Competenze salvate" });
      onSaved();
    } catch (e) {
      toast({ title: "Errore", description: errMsg(e, "Impossibile salvare le competenze"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 border rounded-lg p-4 bg-violet-50/40" data-testid="competenze-form">
      <Label className="font-semibold">Competenze prodotti attivati <span className="font-normal text-slate-500">(facoltative, solo Admin)</span></Label>
      {segnalazione.sotto_esiti.map((s, i) => (
        <div key={s} className="flex items-center gap-3">
          <span className="w-40 text-sm font-medium text-emerald-700">{s}</span>
          <Select value={values[s] || NONE} onValueChange={(v) => setValues({ ...values, [s]: v === NONE ? "" : v })}>
            <SelectTrigger className="w-48" data-testid={`competenza-select-${i}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>- Nessuna -</SelectItem>
              {competenze.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ))}
      <Button size="sm" onClick={save} disabled={saving} data-testid="competenze-save-btn">{saving ? "Salvataggio..." : "Salva competenze"}</Button>
    </div>
  );
};

export const CompetenzeView = ({ competenze = {} }) => {
  const entries = Object.entries(competenze);
  if (!entries.length) return null;
  return (
    <div data-testid="competenze-view">
      <p className="text-xs uppercase tracking-wide text-slate-500">Competenze</p>
      <div className="flex flex-wrap gap-2 mt-1">
        {entries.map(([k, v]) => (
          <span key={k} className="text-xs border rounded px-2 py-1 bg-white"><b className="text-emerald-700">{k}</b> → {v}</span>
        ))}
      </div>
    </div>
  );
};
