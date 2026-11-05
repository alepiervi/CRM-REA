import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useToast } from "../../hooks/use-toast";
import { Unlock, UserCheck } from "lucide-react";
import { API, errMsg } from "./shared";

export const AdminInCaricoControls = ({ segnalazione, onChanged }) => {
  const [operatori, setOperatori] = useState([]);
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    axios.get(`${API}/segnalazioni/${segnalazione.id}/operatori`).then((r) => setOperatori(r.data)).catch(() => setOperatori([]));
  }, [segnalazione.id]);

  const run = async (path, body, okMsg) => {
    setSaving(true);
    try {
      await axios.post(`${API}/segnalazioni/${segnalazione.id}/${path}`, body);
      toast({ title: okMsg });
      setUserId("");
      onChanged();
    } catch (e) {
      toast({ title: "Errore", description: errMsg(e, "Operazione non riuscita"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const target = operatori.find((o) => o.id === userId);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-3 border-t border-dashed" data-testid="admin-in-carico-controls">
      {segnalazione.in_carico_id && (
        <Button size="sm" variant="outline" disabled={saving} onClick={() => run("sblocca", {}, "Segnalazione sbloccata")} data-testid="admin-sblocca-btn">
          <Unlock className="w-4 h-4 mr-1" /> Sblocca
        </Button>
      )}
      <Select value={userId} onValueChange={setUserId}>
        <SelectTrigger className="sm:w-56 h-9" data-testid="admin-assegna-operatore-select"><SelectValue placeholder="Assegna a un operatore..." /></SelectTrigger>
        <SelectContent>
          {operatori.filter((o) => o.id !== segnalazione.in_carico_id).map((o) => <SelectItem key={o.id} value={o.id}>{o.username}</SelectItem>)}
          {operatori.length === 0 && <div className="px-3 py-2 text-sm text-slate-500">Nessun operatore disponibile</div>}
        </SelectContent>
      </Select>
      <Button size="sm" disabled={saving || !userId} onClick={() => run("assegna-operatore", { user_id: userId }, `Assegnata a ${target?.username}`)} data-testid="admin-assegna-operatore-btn">
        <UserCheck className="w-4 h-4 mr-1" /> Assegna
      </Button>
    </div>
  );
};
