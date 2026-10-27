import React, { useState } from "react";
import axios from "axios";
import { Button } from "../../components/ui/button";
import { useToast } from "../../hooks/use-toast";
import { Hand, Lock } from "lucide-react";
import { API, errMsg, formatDate } from "./shared";

export const PresaInCaricoBox = ({ segnalazione, user, onChanged }) => {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const holder = segnalazione.in_carico_id;
  const mine = holder === user.id;

  const take = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/segnalazioni/${segnalazione.id}/presa-in-carico`);
      toast({ title: "Segnalazione presa in carico" });
    } catch (e) {
      toast({ title: "Non disponibile", description: errMsg(e, "Impossibile prendere in carico"), variant: "destructive" });
    } finally {
      setSaving(false);
      onChanged();
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3 ${holder ? (mine ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200") : "bg-slate-50"}`} data-testid="presa-in-carico-box">
      <p className="text-sm flex items-center gap-2" data-testid="presa-in-carico-status">
        {holder ? <Lock className="w-4 h-4 shrink-0" /> : <Hand className="w-4 h-4 shrink-0 text-slate-500" />}
        {!holder && "Nessuno sta lavorando questa segnalazione."}
        {mine && <span>La stai lavorando tu dal {formatDate(segnalazione.in_carico_at)}. Si libera da sola quando salvi l'esito.</span>}
        {holder && !mine && <span>In carico a <b>{segnalazione.in_carico_username}</b> dal {formatDate(segnalazione.in_carico_at)}</span>}
      </p>
      {!mine && (!holder || user.role === "admin") && (
        <Button size="sm" onClick={take} disabled={saving} data-testid="presa-in-carico-btn">
          {saving ? "..." : holder ? "Prendi tu in carico" : "Prendi in carico"}
        </Button>
      )}
    </div>
  );
};
