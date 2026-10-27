import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { format } from "date-fns";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Plus, Paperclip, Megaphone, FileSpreadsheet } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../hooks/use-toast";
import { EsitoBadge } from "./segnalazioni/EsitoBadge";
import { SegnalazioniFilters } from "./segnalazioni/SegnalazioniFilters";
import { SegnalazioniStats } from "./segnalazioni/SegnalazioniStats";
import { CreateSegnalazioneDialog } from "./segnalazioni/CreateSegnalazioneDialog";
import { SegnalazioneDetailDialog } from "./segnalazioni/SegnalazioneDetailDialog";
import { API, errMsg, formatDate } from "./segnalazioni/shared";

const buildParams = (f) => {
  const p = {};
  if (f.search) p.search = f.search;
  if (f.esito !== "all") p.esito = f.esito;
  if (f.commessa_id !== "all") p.commessa_id = f.commessa_id;
  if (f.segnalatore_id !== "all") p.segnalatore_id = f.segnalatore_id;
  if (f.range?.from) p.date_from = format(f.range.from, "yyyy-MM-dd");
  if (f.range?.to || f.range?.from) p.date_to = format(f.range.to || f.range.from, "yyyy-MM-dd");
  return p;
};

export default function Segnalazioni() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState({ commesse: [], esiti: [], sotto_esiti_ok: [] });
  const [segnalatori, setSegnalatori] = useState([]);
  const [filters, setFilters] = useState({ search: "", esito: "all", commessa_id: "all", segnalatore_id: "all", range: undefined });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [openId, setOpenId] = useState(null);
  const isSegnalatore = user.role === "segnalatore";
  const canCreate = isSegnalatore || user.role === "admin";

  const load = useCallback(async () => {
    const params = buildParams(filters);
    try {
      const [list, st] = await Promise.all([
        axios.get(`${API}/segnalazioni`, { params }),
        axios.get(`${API}/segnalazioni/stats/summary`, { params }),
      ]);
      setItems(list.data);
      setStats(st.data);
      window.dispatchEvent(new Event("segnalazioni-changed"));
    } catch (e) {
      toast({ title: "Errore caricamento segnalazioni", description: errMsg(e, "Riprova"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    axios.get(`${API}/segnalazioni/options`).then((r) => setMeta(r.data));
    if (!isSegnalatore) axios.get(`${API}/segnalazioni/segnalatori/list`).then((r) => setSegnalatori(r.data));
  }, [isSegnalatore]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await axios.get(`${API}/segnalazioni/export/excel`, { params: buildParams(filters), responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      Object.assign(document.createElement("a"), { href: url, download: `segnalazioni_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx` }).click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Errore export", description: errMsg(e, "Impossibile esportare"), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="segnalazioni-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Megaphone className="w-6 h-6 text-blue-600" />Segnalatori</h1>
          <p className="text-sm text-slate-500">{isSegnalatore ? "Inserisci i clienti e guarda com'è andata con le tue segnalazioni" : "Clienti segnalati da lavorare ed esitare"}</p>
        </div>
        <div className="flex gap-2">
          {user.role === "admin" && (
            <Button variant="outline" onClick={exportExcel} disabled={exporting} data-testid="segnalazioni-export-btn">
              <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />{exporting ? "Esportazione..." : "Esporta Excel"}
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setShowCreate(true)} data-testid="new-segnalazione-btn">
              <Plus className="w-4 h-4 mr-2" />Nuova Segnalazione
            </Button>
          )}
        </div>
      </div>
      <SegnalazioniFilters filters={filters} setFilters={setFilters} options={meta.commesse} segnalatori={segnalatori} showSegnalatore={!isSegnalatore} />
      <SegnalazioniStats stats={stats} onOpen={setOpenId} />
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table data-testid="segnalazioni-table">
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead><TableHead>Telefono</TableHead><TableHead>Commessa / Servizio</TableHead>
                <TableHead>Segnalatore</TableHead><TableHead>Data</TableHead><TableHead>Esito</TableHead><TableHead className="text-center">Doc</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenId(s.id)} data-testid={`segnalazione-row-${s.id}`}>
                  <TableCell className="font-medium">{s.nome} {s.cognome}</TableCell>
                  <TableCell>{s.telefono}</TableCell>
                  <TableCell className="text-sm">{s.commessa_id ? <>{s.commessa_nome} <span className="text-slate-400">·</span> {s.servizio_nome}</> : <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 text-xs" data-testid={`segnalazione-da-assegnare-${s.id}`}>Da assegnare</span>}</TableCell>
                  <TableCell className="text-sm">{s.created_by_username}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatDate(s.created_at)}</TableCell>
                  <TableCell><EsitoBadge esito={s.esito} sottoEsiti={s.sotto_esiti} testId={`segnalazione-esito-${s.id}`} /></TableCell>
                  <TableCell className="text-center text-sm text-slate-500">{s.documents?.length ? <span className="inline-flex items-center gap-1"><Paperclip className="w-3 h-3" />{s.documents.length}</span> : "-"}</TableCell>
                </TableRow>
              ))}
              {!loading && items.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-slate-500" data-testid="segnalazioni-empty">Nessuna segnalazione trovata</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <CreateSegnalazioneDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={load} />
      <SegnalazioneDetailDialog id={openId} onClose={() => setOpenId(null)} user={user} meta={meta} onChanged={load} />
    </div>
  );
}
