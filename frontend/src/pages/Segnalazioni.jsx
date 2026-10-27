import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Plus, Paperclip, Megaphone } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { EsitoBadge } from "./segnalazioni/EsitoBadge";
import { SegnalazioniFilters } from "./segnalazioni/SegnalazioniFilters";
import { CreateSegnalazioneDialog } from "./segnalazioni/CreateSegnalazioneDialog";
import { SegnalazioneDetailDialog } from "./segnalazioni/SegnalazioneDetailDialog";
import { API, formatDate } from "./segnalazioni/shared";

export default function Segnalazioni() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ commesse: [], esiti: [], sotto_esiti_ok: [] });
  const [filters, setFilters] = useState({ search: "", esito: "all", commessa_id: "all" });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [openId, setOpenId] = useState(null);
  const canCreate = user.role === "segnalatore" || user.role === "admin";

  const load = useCallback(async () => {
    const params = { search: filters.search || undefined };
    if (filters.esito !== "all") params.esito = filters.esito;
    if (filters.commessa_id !== "all") params.commessa_id = filters.commessa_id;
    const { data } = await axios.get(`${API}/segnalazioni`, { params });
    setItems(data);
    setLoading(false);
  }, [filters]);

  useEffect(() => { axios.get(`${API}/segnalazioni/options`).then((r) => setMeta(r.data)); }, []);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  return (
    <div className="space-y-6" data-testid="segnalazioni-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Megaphone className="w-6 h-6 text-blue-600" />Segnalatori</h1>
          <p className="text-sm text-slate-500">{user.role === "segnalatore" ? "Inserisci e monitora i clienti che hai segnalato" : "Clienti segnalati da lavorare ed esitare"}</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)} disabled={meta.commesse.length === 0} data-testid="new-segnalazione-btn">
            <Plus className="w-4 h-4 mr-2" />Nuova Segnalazione
          </Button>
        )}
      </div>
      {canCreate && meta.commesse.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3" data-testid="no-commesse-warning">Nessuna commessa/servizio associato al tuo utente. Contatta l'amministratore.</p>
      )}
      <SegnalazioniFilters filters={filters} setFilters={setFilters} options={meta.commesse} />
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
                  <TableCell className="text-sm">{s.commessa_nome} <span className="text-slate-400">·</span> {s.servizio_nome}</TableCell>
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
      <CreateSegnalazioneDialog open={showCreate} onClose={() => setShowCreate(false)} options={meta.commesse} onCreated={load} />
      <SegnalazioneDetailDialog id={openId} onClose={() => setOpenId(null)} user={user} meta={meta} onChanged={load} />
    </div>
  );
}
