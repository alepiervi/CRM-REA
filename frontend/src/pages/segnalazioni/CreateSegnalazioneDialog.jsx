import React, { useState, useEffect } from "react";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useToast } from "../../hooks/use-toast";
import { FilePicker } from "./FilePicker";
import { API, errMsg, uploadDocuments } from "./shared";

const EMPTY = { nome: "", cognome: "", telefono: "", note: "", commessa_id: "", servizio_id: "" };

export const CreateSegnalazioneDialog = ({ open, onClose, options, onCreated }) => {
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const commessa = options.find((c) => c.id === form.commessa_id);

  useEffect(() => {
    if (!open) return;
    const only = options.length === 1 ? options[0] : null;
    setForm({ ...EMPTY, commessa_id: only?.id || "", servizio_id: only?.servizi.length === 1 ? only.servizi[0].id : "" });
    setFiles([]);
  }, [open, options]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.commessa_id || !form.servizio_id) {
      toast({ title: "Seleziona commessa e servizio", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data } = await axios.post(`${API}/segnalazioni`, form);
      const failed = await uploadDocuments(data.id, files);
      if (failed.length) toast({ title: "Segnalazione salvata, ma alcuni documenti non sono stati caricati", description: failed.join(" • "), variant: "destructive" });
      else toast({ title: "Segnalazione inserita", description: `${data.nome} ${data.cognome}` });
      onCreated();
      onClose();
    } catch (err) {
      toast({ title: "Errore", description: errMsg(err, "Impossibile salvare la segnalazione"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="w-[95vw] max-w-xl max-h-[90vh] overflow-y-auto" data-testid="create-segnalazione-dialog">
        <DialogHeader><DialogTitle>Nuova Segnalazione</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Nome *</Label><Input required value={form.nome} onChange={set("nome")} data-testid="segnalazione-nome-input" /></div>
            <div><Label>Cognome *</Label><Input required value={form.cognome} onChange={set("cognome")} data-testid="segnalazione-cognome-input" /></div>
          </div>
          <div><Label>Numero di Telefono *</Label><Input required type="tel" minLength={5} value={form.telefono} onChange={set("telefono")} data-testid="segnalazione-telefono-input" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Commessa *</Label>
              <Select value={form.commessa_id} onValueChange={(v) => setForm({ ...form, commessa_id: v, servizio_id: "" })}>
                <SelectTrigger data-testid="segnalazione-commessa-select"><SelectValue placeholder="Seleziona commessa" /></SelectTrigger>
                <SelectContent>{options.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Servizio *</Label>
              <Select value={form.servizio_id} onValueChange={(v) => setForm({ ...form, servizio_id: v })} disabled={!commessa}>
                <SelectTrigger data-testid="segnalazione-servizio-select"><SelectValue placeholder="Seleziona servizio" /></SelectTrigger>
                <SelectContent>{(commessa?.servizi || []).map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Note</Label><Textarea rows={3} value={form.note} onChange={set("note")} data-testid="segnalazione-note-input" /></div>
          <div><Label>Documenti / Foto</Label><FilePicker files={files} onChange={setFiles} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} data-testid="segnalazione-cancel-btn">Annulla</Button>
            <Button type="submit" disabled={saving} data-testid="segnalazione-submit-btn">{saving ? "Salvataggio..." : "Salva Segnalazione"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
