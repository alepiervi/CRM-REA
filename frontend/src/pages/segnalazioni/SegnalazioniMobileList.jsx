import React from "react";
import { Paperclip, Lock } from "lucide-react";
import { EsitoBadge } from "./EsitoBadge";
import { formatDate } from "./shared";

export const SegnalazioniMobileList = ({ items, loading, onOpen, showInCarico, userId }) => (
  <div className="md:hidden space-y-2" data-testid="segnalazioni-mobile-list">
    {items.map((s) => (
      <button key={s.id} type="button" onClick={() => onOpen(s.id)} data-testid={`segnalazione-card-${s.id}`}
        className="w-full text-left bg-white border rounded-lg p-3 shadow-sm active:bg-slate-50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold truncate">{s.nome} {s.cognome}</p>
            <p className="text-sm text-slate-600">{s.telefono}</p>
          </div>
          <EsitoBadge esito={s.esito} sottoEsiti={[]} />
        </div>
        {s.sotto_esiti?.length > 0 && <p className="text-xs text-emerald-700 mt-1">{s.sotto_esiti.join(", ")}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
          <span>{formatDate(s.created_at)}</span>
          <span>{s.commessa_id ? `${s.commessa_nome} · ${s.servizio_nome}` : "Da assegnare"}</span>
          {showInCarico && s.in_carico_username && <span className="inline-flex items-center gap-1 text-amber-700"><Lock className="w-3 h-3" />{s.in_carico_id === userId ? "Tu" : s.in_carico_username}</span>}
          {s.documents?.length > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="w-3 h-3" />{s.documents.length}</span>}
          {showInCarico && <span>da {s.created_by_username}</span>}
        </div>
      </button>
    ))}
    {!loading && items.length === 0 && <p className="text-center py-8 text-slate-500 text-sm" data-testid="segnalazioni-mobile-empty">Nessuna segnalazione trovata</p>}
  </div>
);
