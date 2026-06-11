import React, { useState } from "react";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { FlaskConical, Play, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export const WorkflowTestModeDialog = ({ workflow, open, onClose }) => {
  const [nome, setNome] = useState("Mario");
  const [cognome, setCognome] = useState("Test");
  const [telefono, setTelefono] = useState("+393331234567");
  const [reply, setReply] = useState("Sì sono interessato, vorrei un appuntamento");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const r = await axios.post(
        `${API}/workflows/${workflow.id}/test-run`,
        {
          fake_lead: {
            id: `test-${Date.now()}`, nome, cognome, telefono,
            commessa_id: workflow.unit_id,
          },
          fake_reply: reply || null,
        },
        { headers: authHeaders() }
      );
      setResult({ ok: true, data: r.data });
    } catch (e) {
      setResult({ ok: false, error: e?.response?.data?.detail || e.message });
    } finally { setRunning(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl" data-testid="wf-test-mode-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-indigo-600" /> Flusso di prova
          </DialogTitle>
          <DialogDescription>
            Esegui il workflow con un lead fittizio. Nessun messaggio WhatsApp reale verrà inviato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} data-testid="wf-test-nome" />
            </div>
            <div>
              <Label>Cognome</Label>
              <Input value={cognome} onChange={(e) => setCognome(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Telefono</Label>
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div>
            <Label>Risposta simulata cliente (vuota = no reply)</Label>
            <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} data-testid="wf-test-reply" />
          </div>

          {result && (
            <div className={`p-3 rounded border text-sm ${result.ok ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              {result.ok ? (
                <div>
                  <div className="font-semibold text-green-800 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Esecuzione: {result.data?.status}</div>
                  <div className="text-xs mt-1">execution_id: <code>{result.data?.execution_id}</code></div>
                </div>
              ) : (
                <div className="text-red-800 flex items-start gap-1">
                  <AlertCircle className="w-4 h-4 mt-0.5" /> {result.error}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Chiudi</Button>
          <Button onClick={handleRun} disabled={running} data-testid="wf-test-run">
            {running ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
            {running ? "Esecuzione..." : "Avvia prova"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WorkflowTestModeDialog;
