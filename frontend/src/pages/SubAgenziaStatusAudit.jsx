import React, { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import { format } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import { formatDateTimeIT, parseBackendDate } from "../lib/datetime";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { useToast } from "../hooks/use-toast";
import { ShieldCheck, RefreshCw, Download, Filter, History } from "lucide-react";

import { API } from "../lib/appUtils";

/**
 * Audit dei cambi status fatti dai Backoffice Sub Agenzia con privilegio attivo.
 * Accessibile a: admin, responsabile_commessa.
 */
export const SubAgenziaStatusAudit = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [subAgenzie, setSubAgenzie] = useState([]);
  const [filters, setFilters] = useState({
    sub_agenzia_id: "all",
    date_from: "",
    date_to: "",
  });

  const fetchSubAgenzie = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/sub-agenzie`);
      // Mostra solo quelle privilegiate (per default), ma includi tutte per filtro
      setSubAgenzie(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      setSubAgenzie([]);
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.sub_agenzia_id && filters.sub_agenzia_id !== "all") params.sub_agenzia_id = filters.sub_agenzia_id;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      const r = await axios.get(`${API}/audit/sub-agenzia-status-changes`, { params });
      setRows(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      toast({ title: "Errore", description: e?.response?.data?.detail || "Impossibile caricare l'audit", variant: "destructive" });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => { fetchSubAgenzie(); }, [fetchSubAgenzie]);
  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  const privilegedSubs = useMemo(
    () => subAgenzie.filter((s) => s.can_change_status === true),
    [subAgenzie]
  );

  const exportCsv = () => {
    if (!rows.length) {
      toast({ title: "Nessun dato", description: "Niente da esportare" });
      return;
    }
    const header = ["Data", "Cliente", "Tipologia", "Sub Agenzia", "Vecchio status", "Nuovo status", "Operatore", "Ruolo"];
    const lines = [header.join(";")];
    for (const r of rows) {
      const data = r.timestamp ? formatDateTimeIT(r.timestamp) : "";
      const cliente = `${r.cliente_nome || ""} ${r.cliente_cognome || ""}`.trim();
      lines.push([
        data,
        cliente.replace(/;/g, ","),
        (r.tipologia_contratto || "").replace(/;/g, ","),
        (r.sub_agenzia_nome || "").replace(/;/g, ","),
        (r.old_status || "").replace(/;/g, ","),
        (r.new_status || "").replace(/;/g, ","),
        (r.user_name || "").replace(/;/g, ","),
        (r.user_role || "").replace(/;/g, ","),
      ].join(";"));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_status_sub_agenzia_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 md:space-y-6" data-testid="sub-agenzia-status-audit-page">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-emerald-600" />
            Audit Status Sub Agenzie
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Cronologia dei cambi di status fatti dai <strong>Backoffice Sub Agenzia</strong> con privilegio
            <code className="ml-1 px-1 py-0.5 bg-slate-100 rounded text-xs">can_change_status</code> attivo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAudit} data-testid="audit-refresh-btn">
            <RefreshCw className="w-4 h-4 mr-2" /> Aggiorna
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} data-testid="audit-export-btn">
            <Download className="w-4 h-4 mr-2" /> Esporta CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            Filtri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">Sub Agenzia</Label>
              <Select
                value={filters.sub_agenzia_id}
                onValueChange={(v) => setFilters((f) => ({ ...f, sub_agenzia_id: v }))}
              >
                <SelectTrigger data-testid="audit-filter-sub-agenzia">
                  <SelectValue placeholder="Tutte le sub agenzie privilegiate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le sub agenzie</SelectItem>
                  {privilegedSubs.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Da</Label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
                data-testid="audit-filter-date-from"
              />
            </div>
            <div>
              <Label className="text-xs">A</Label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
                data-testid="audit-filter-date-to"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setFilters({ sub_agenzia_id: "all", date_from: "", date_to: "" })}
                data-testid="audit-filter-reset"
              >
                Reset filtri
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            Movimenti
            <Badge variant="secondary" className="ml-2" data-testid="audit-rows-count">
              {rows.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10 text-slate-500">Caricamento…</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-slate-500" data-testid="audit-empty-state">
              Nessun cambio di status registrato per il periodo selezionato.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="audit-rows-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipologia</TableHead>
                    <TableHead>Sub Agenzia</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Operatore</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} data-testid={`audit-row-${r.id}`}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {r.timestamp ? formatDateTimeIT(r.timestamp) : "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {`${r.cliente_nome || ""} ${r.cliente_cognome || ""}`.trim() || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.tipologia_contratto || "—"}</Badge>
                      </TableCell>
                      <TableCell>{r.sub_agenzia_nome || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          <Badge variant="secondary">{r.old_status || "—"}</Badge>
                          <span className="text-slate-400">→</span>
                          <Badge>{r.new_status || "—"}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{r.user_name || "—"}</div>
                        <div className="text-slate-500">{r.user_role || ""}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubAgenziaStatusAudit;
