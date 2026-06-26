import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Package, Clock, User as UserIcon, Loader2, ArrowRight } from "lucide-react";
import { formatDateTimeIT } from "../lib/datetime";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const formatDate = (iso) => formatDateTimeIT(iso);

const STAGE_META = {
  lavorazione: {
    label: "In Lavorazione",
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-300",
    dot: "bg-amber-400",
    emoji: "🟡",
  },
  attivato: {
    label: "Attivato",
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    border: "border-emerald-300",
    dot: "bg-emerald-500",
    emoji: "🟢",
  },
  ko: {
    label: "KO",
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-300",
    dot: "bg-red-500",
    emoji: "🔴",
  },
};

/**
 * Sezione "Evoluzione Post Vendita" mostrata nelle schede Cliente (View + Edit).
 * Read-only: ogni utente che ha accesso al cliente può vedere lo storico.
 *
 * Mostra:
 *  - Status corrente (label + badge stage colorato)
 *  - Timeline di tutti i cambi status (newest first), con autore e data
 */
export const ClientePostVenditaSection = ({ clienteId, clienteSnapshot }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API}/clienti/${clienteId}/post-vendita-history`, {
        headers: authHeaders(),
      });
      setData(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Errore caricamento storico Post Vendita");
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    load();
  }, [load]);

  // Use server-side data if available, fallback to clienteSnapshot
  const current = data?.current || {
    post_vendita_status: clienteSnapshot?.post_vendita_status,
    post_vendita_status_label: clienteSnapshot?.post_vendita_status_label,
    post_vendita_stage: clienteSnapshot?.post_vendita_stage,
    passed_to_post_vendita: clienteSnapshot?.passed_to_post_vendita,
    post_vendita_status_updated_at: clienteSnapshot?.post_vendita_status_updated_at,
  };
  const history = data?.history || [];
  const stageMeta = current.post_vendita_stage ? STAGE_META[current.post_vendita_stage] : null;

  const notInPV = !current.passed_to_post_vendita && !current.post_vendita_stage;

  return (
    <div
      className="rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white p-4"
      data-testid="cliente-post-vendita-section"
    >
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-5 h-5 text-indigo-600" />
        <h3 className="font-semibold text-indigo-900">Evoluzione Post Vendita</h3>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Caricamento storico...
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>
      )}

      {!loading && !error && notInPV && (
        <p className="text-sm text-slate-500 italic">
          Cliente non ancora passato al Post Vendita.
        </p>
      )}

      {!loading && !error && !notInPV && (
        <>
          {/* Current state */}
          <div className="flex items-center flex-wrap gap-2 mb-4">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Stato attuale:</span>
            {stageMeta ? (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${stageMeta.bg} ${stageMeta.text} ${stageMeta.border}`}
                data-testid="cliente-pv-current-stage"
              >
                <span className={`w-2 h-2 rounded-full ${stageMeta.dot}`} />
                {stageMeta.emoji} {stageMeta.label}
              </span>
            ) : null}
            {current.post_vendita_status_label && (
              <span className="text-sm font-medium text-slate-700" data-testid="cliente-pv-current-label">
                {current.post_vendita_status_label}
              </span>
            )}
            {current.post_vendita_status_updated_at && (
              <span className="text-xs text-slate-400 ml-auto">
                aggiornato il {formatDate(current.post_vendita_status_updated_at)}
              </span>
            )}
          </div>

          {/* Timeline */}
          {history.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Nessuna variazione storica registrata.</p>
          ) : (
            <div className="space-y-2" data-testid="cliente-pv-history-list">
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Cronologia ({history.length})</div>
              <ol className="relative border-l-2 border-indigo-100 ml-2 pl-4 space-y-3">
                {history.map((h) => {
                  const sm = STAGE_META[h.post_vendita_stage] || STAGE_META.lavorazione;
                  return (
                    <li key={h.id} className="relative" data-testid={`cliente-pv-history-${h.id}`}>
                      <span
                        className={`absolute -left-[22px] top-1.5 w-3 h-3 rounded-full ${sm.dot} ring-2 ring-white shadow`}
                      />
                      <div className="flex items-center flex-wrap gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${sm.bg} ${sm.text} ${sm.border}`}
                        >
                          {sm.emoji} {sm.label}
                        </span>
                        <span className="text-sm font-medium text-slate-700">
                          {h.post_vendita_status_label || h.post_vendita_status}
                        </span>
                        {h.previous_label && (
                          <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" />
                            <span className="line-through">{h.previous_label}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDate(h.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <UserIcon className="w-3 h-3" /> {h.created_by_username || "system"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ClientePostVenditaSection;
