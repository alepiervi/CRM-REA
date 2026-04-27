import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { MessageSquarePlus, Clock, User as UserIcon, Loader2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const formatDate = (iso) => {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return iso;
  }
};

/**
 * Storico note (immutabile) per un cliente.
 * @param {string} clienteId
 * @param {"cliente"|"backoffice"} tipo
 * @param {string} title
 * @param {boolean} readOnly - se true non mostra l'input per nuove note
 * @param {boolean} canAdd - se false l'input è disabilitato (es. utenti non autorizzati per backoffice)
 * @param {string} accentColor - "blue" | "orange"
 */
export const ClienteNotesHistory = ({
  clienteId,
  tipo,
  title,
  readOnly = false,
  canAdd = true,
  accentColor = "blue",
  emptyMessage = "Nessuna nota presente.",
}) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!clienteId || !tipo) return;
    setLoading(true);
    try {
      const res = await axios.get(
        `${API}/clienti/${clienteId}/note-history?tipo=${tipo}`,
        { headers: authHeaders() }
      );
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e?.response?.data?.detail || "Errore caricamento storico");
    } finally {
      setLoading(false);
    }
  }, [clienteId, tipo]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleAdd = async () => {
    const content = newContent.trim();
    if (!content) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await axios.post(
        `${API}/clienti/${clienteId}/note-history`,
        { tipo, content },
        { headers: authHeaders() }
      );
      // Prepend newest on top
      setEntries((prev) => [res.data, ...prev]);
      setNewContent("");
    } catch (e) {
      setError(e?.response?.data?.detail || "Errore aggiunta nota");
    } finally {
      setSubmitting(false);
    }
  };

  const colorClasses = {
    blue: {
      border: "border-blue-200",
      bg: "bg-blue-50",
      btn: "bg-blue-600 hover:bg-blue-700",
      header: "text-blue-900",
    },
    orange: {
      border: "border-orange-200",
      bg: "bg-orange-50",
      btn: "bg-orange-600 hover:bg-orange-700",
      header: "text-orange-900",
    },
  };
  const c = colorClasses[accentColor] || colorClasses.blue;

  return (
    <div
      className={`border ${c.border} rounded-lg overflow-hidden`}
      data-testid={`notes-history-${tipo}`}
    >
      <div className={`${c.bg} px-4 py-2 border-b ${c.border} flex items-center justify-between`}>
        <h4 className={`font-semibold text-sm ${c.header} flex items-center gap-2`}>
          <MessageSquarePlus className="w-4 h-4" />
          {title}
        </h4>
        <span className="text-xs text-slate-500">
          {entries.length} {entries.length === 1 ? "nota" : "note"}
        </span>
      </div>

      {!readOnly && (
        <div className="p-3 border-b border-slate-200 space-y-2 bg-white">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={
              canAdd
                ? `Scrivi una nuova ${tipo === "backoffice" ? "nota back office" : "nota cliente"}...`
                : "Non hai i permessi per aggiungere note Back Office"
            }
            disabled={!canAdd || submitting}
            rows={3}
            className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
            data-testid={`notes-input-${tipo}`}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd || submitting || !newContent.trim()}
              className={`px-4 py-1.5 text-sm font-medium text-white rounded ${c.btn} disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1`}
              data-testid={`notes-add-btn-${tipo}`}
            >
              {submitting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <MessageSquarePlus className="w-3 h-3" />
              )}
              Aggiungi nota
            </button>
          </div>
          {error && (
            <div className="text-xs text-red-600" data-testid={`notes-error-${tipo}`}>
              {error}
            </div>
          )}
        </div>
      )}

      <div className="max-h-[300px] overflow-y-auto bg-white">
        {loading && entries.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Caricamento...
          </div>
        ) : entries.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-sm italic">
            {emptyMessage}
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {entries.map((e) => (
              <li
                key={e.id}
                className="p-3 hover:bg-slate-50 transition-colors"
                data-testid={`notes-entry-${e.id}`}
              >
                <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">
                  {e.content}
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1" data-testid={`notes-entry-author-${e.id}`}>
                    <UserIcon className="w-3 h-3" />
                    {e.created_by_username || "utente"}
                  </span>
                  <span className="flex items-center gap-1" data-testid={`notes-entry-date-${e.id}`}>
                    <Clock className="w-3 h-3" />
                    {formatDate(e.created_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
