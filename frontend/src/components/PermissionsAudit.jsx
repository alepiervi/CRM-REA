import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  ShieldAlert,
  RefreshCw,
  Wrench,
  CheckCircle2,
  Loader2,
  Users as UsersIcon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const CATEGORIES = [
  {
    key: "services_without_parent_commessa",
    title: "Servizi senza commessa parent",
    description:
      "L'utente ha un servizio autorizzato ma la sua commessa parent NON è in commesse_autorizzate. Risultato: il servizio non viene mostrato nel wizard cliente.",
    color: "red",
    columns: ["username", "role", "servizio_nome", "missing_commessa_nome"],
    headers: ["Utente", "Ruolo", "Servizio", "Commessa Mancante"],
    fixable: true,
  },
  {
    key: "orphaned_commesse",
    title: "Commesse senza alcun servizio",
    description:
      "L'utente (BO/Resp Sub Agenzia) ha una commessa autorizzata senza alcun servizio associato. Inutile/orfana.",
    color: "amber",
    columns: ["username", "role", "commessa_nome"],
    headers: ["Utente", "Ruolo", "Commessa Orfana"],
    fixable: true,
  },
  {
    key: "services_not_in_sub_agenzia",
    title: "Servizi non autorizzati nella Sub Agenzia",
    description:
      "L'utente ha un servizio che la sua Sub Agenzia non ha tra i propri servizi_autorizzati. Permesso 'in eccesso'.",
    color: "purple",
    columns: ["username", "role", "sub_agenzie", "servizio_nome"],
    headers: ["Utente", "Ruolo", "Sub Agenzie", "Servizio Extra"],
    fixable: false,
  },
  {
    key: "commesse_not_in_sub_agenzia",
    title: "Commesse non autorizzate nella Sub Agenzia",
    description:
      "L'utente ha una commessa che la sua Sub Agenzia non ha tra le proprie commesse_autorizzate.",
    color: "blue",
    columns: ["username", "role", "sub_agenzie", "commessa_nome"],
    headers: ["Utente", "Ruolo", "Sub Agenzie", "Commessa Extra"],
    fixable: false,
  },
];

const colorMap = {
  red: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", badge: "bg-red-100 text-red-800" },
  amber: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", badge: "bg-amber-100 text-amber-800" },
  purple: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", badge: "bg-purple-100 text-purple-800" },
  blue: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-800" },
};

export const PermissionsAudit = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fixingUserId, setFixingUserId] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [error, setError] = useState(null);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API}/admin/permissions-audit`, { headers: authHeaders() });
      setData(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Errore caricamento audit");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const handleAutoFix = async (userId) => {
    setFixingUserId(userId);
    try {
      await axios.post(`${API}/admin/permissions-audit/auto-fix/${userId}`, {}, { headers: authHeaders() });
      await fetchAudit();
    } catch (e) {
      setError(e?.response?.data?.detail || "Errore auto-fix");
    } finally {
      setFixingUserId(null);
    }
  };

  const handleFixAllInCategory = async (catKey) => {
    if (!data) return;
    const items = data.categories?.[catKey] || [];
    const userIds = [...new Set(items.map((i) => i.user_id))];
    if (!userIds.length) return;
    if (!window.confirm(`Procedo con auto-fix su ${userIds.length} utenti?`)) return;
    setLoading(true);
    try {
      for (const uid of userIds) {
        await axios
          .post(`${API}/admin/permissions-audit/auto-fix/${uid}`, {}, { headers: authHeaders() })
          .catch(() => {});
      }
      await fetchAudit();
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  if (loading && !data) {
    return (
      <div className="p-8 flex items-center justify-center text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Analisi in corso...
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-600 bg-red-50 border border-red-200 rounded-lg">{error}</div>;
  }

  return (
    <div className="p-6 space-y-6" data-testid="permissions-audit-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-amber-600" />
            Audit Permessi Utenti
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Report delle incoerenze tra commesse autorizzate e servizi autorizzati. Esegui un check periodico.
          </p>
        </div>
        <button
          onClick={fetchAudit}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          data-testid="audit-refresh-btn"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Aggiorna
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg" data-testid="audit-summary-users">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Utenti analizzati</div>
          <div className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-slate-400" />
            {data?.users_checked || 0}
          </div>
        </div>
        <div className={`p-4 rounded-lg border ${data?.total_issues ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`} data-testid="audit-summary-issues">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Incoerenze totali</div>
          <div className={`text-3xl font-bold flex items-center gap-2 ${data?.total_issues ? "text-red-700" : "text-emerald-700"}`}>
            {data?.total_issues ? <ShieldAlert className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
            {data?.total_issues ?? 0}
          </div>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg col-span-2">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Ultimo controllo</div>
          <div className="text-sm font-mono text-slate-700 mt-2">
            {data?.checked_at ? new Date(data.checked_at).toLocaleString("it-IT") : "—"}
          </div>
        </div>
      </div>

      {data?.total_issues === 0 && (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-emerald-700">
          <CheckCircle2 className="w-6 h-6" />
          <div>
            <div className="font-semibold">Nessuna incoerenza trovata!</div>
            <div className="text-sm">I permessi degli utenti sono allineati ai servizi/commesse delle Sub Agenzie.</div>
          </div>
        </div>
      )}

      {/* Categories */}
      {CATEGORIES.map((cat) => {
        const items = data?.categories?.[cat.key] || [];
        const c = colorMap[cat.color];
        const isOpen = expanded[cat.key];
        return (
          <div
            key={cat.key}
            className={`border ${c.border} rounded-lg overflow-hidden`}
            data-testid={`audit-category-${cat.key}`}
          >
            <button
              onClick={() => toggleExpand(cat.key)}
              className={`w-full ${c.bg} px-4 py-3 flex items-center justify-between hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center gap-3 text-left">
                {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                <div>
                  <div className={`font-semibold ${c.text}`}>{cat.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{cat.description}</div>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${c.badge}`}>
                {items.length}
              </span>
            </button>
            {isOpen && (
              <div className="bg-white">
                {items.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-sm">Nessuna incoerenza in questa categoria.</div>
                ) : (
                  <>
                    {cat.fixable && (
                      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex justify-end">
                        <button
                          onClick={() => handleFixAllInCategory(cat.key)}
                          className="text-sm flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                          data-testid={`audit-fix-all-${cat.key}`}
                        >
                          <Wrench className="w-3 h-3" />
                          Auto-fix tutti
                        </button>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
                          <tr>
                            {cat.headers.map((h) => (
                              <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                            ))}
                            {cat.fixable && <th className="px-4 py-2 text-right font-medium">Azione</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {items.map((it, idx) => (
                            <tr key={`${cat.key}-${idx}`} className="hover:bg-slate-50">
                              {cat.columns.map((col) => (
                                <td key={col} className="px-4 py-2">
                                  {Array.isArray(it[col]) ? it[col].join(", ") : it[col]}
                                </td>
                              ))}
                              {cat.fixable && (
                                <td className="px-4 py-2 text-right">
                                  <button
                                    onClick={() => handleAutoFix(it.user_id)}
                                    disabled={fixingUserId === it.user_id}
                                    className="text-xs flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50"
                                    data-testid={`audit-fix-btn-${it.user_id}`}
                                  >
                                    {fixingUserId === it.user_id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Wrench className="w-3 h-3" />
                                    )}
                                    Fix
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PermissionsAudit;
