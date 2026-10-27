import React from "react";
import { Card, CardContent } from "../../components/ui/card";
import { EsitoBadge } from "./EsitoBadge";
import { formatDate } from "./shared";

const Kpi = ({ label, value, tone, testId }) => (
  <Card className="border-slate-200">
    <CardContent className="p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone}`} data-testid={testId}>{value}</p>
    </CardContent>
  </Card>
);

const Bar = ({ label, value, max }) => (
  <div className="flex items-center gap-3 text-sm">
    <span className="w-32 shrink-0 text-slate-600">{label}</span>
    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full bg-emerald-500 rounded-full transition-[width] duration-500" style={{ width: `${max ? (value * 100) / max : 0}%` }} />
    </div>
    <span className="w-8 text-right font-semibold">{value}</span>
  </div>
);

export const SegnalazioniStats = ({ stats, onOpen }) => {
  if (!stats) return null;
  const maxSotto = Math.max(0, ...Object.values(stats.sotto_esiti));
  return (
    <div className="space-y-4" data-testid="segnalazioni-stats">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Totale" value={stats.totale} tone="text-slate-900" testId="stat-totale" />
        <Kpi label="Da lavorare" value={stats.da_lavorare} tone="text-slate-500" testId="stat-da-lavorare" />
        <Kpi label="OK" value={stats.per_esito.OK} tone="text-emerald-600" testId="stat-ok" />
        <Kpi label="KO" value={stats.per_esito.KO} tone="text-red-600" testId="stat-ko" />
        <Kpi label="NR" value={stats.per_esito.NR} tone="text-amber-600" testId="stat-nr" />
        <Kpi label="% OK su esitate" value={`${stats.tasso_ok}%`} tone="text-blue-700" testId="stat-tasso-ok" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card><CardContent className="p-4 space-y-2" data-testid="stat-sotto-esiti">
          <p className="text-sm font-semibold mb-2">Dettaglio OK per tipologia</p>
          {Object.entries(stats.sotto_esiti).map(([k, v]) => <Bar key={k} label={k} value={v} max={maxSotto} />)}
        </CardContent></Card>
        <Card><CardContent className="p-4" data-testid="stat-ultime-esitate">
          <p className="text-sm font-semibold mb-2">Ultime esitate</p>
          {stats.ultime_esitate.length === 0 && <p className="text-sm text-slate-500">Nessuna segnalazione esitata nel periodo.</p>}
          <ul className="divide-y">
            {stats.ultime_esitate.map((s) => (
              <li key={s.id} className="py-2 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50 px-1 rounded" onClick={() => onOpen(s.id)} data-testid={`ultima-esitata-${s.id}`}>
                <span className="text-sm"><b>{s.nome} {s.cognome}</b> <span className="text-slate-400">· {formatDate(s.esito_at)}</span></span>
                <EsitoBadge esito={s.esito} sottoEsiti={s.sotto_esiti} />
              </li>
            ))}
          </ul>
        </CardContent></Card>
      </div>
    </div>
  );
};
