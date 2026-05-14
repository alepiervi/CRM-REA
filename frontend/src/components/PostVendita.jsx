import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
  Package,
  Upload,
  Settings,
  RefreshCw,
  Search,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  X,
  History,
  Check,
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// =====================================================
// MAIN COMPONENT
// =====================================================
export const PostVendita = ({ user }) => {
  const [activeSubTab, setActiveSubTab] = useState("clienti");
  const [commesse, setCommesse] = useState([]);
  const [selectedCommessa, setSelectedCommessa] = useState("");
  const [servizi, setServizi] = useState([]);  // tutti i servizi della commessa selezionata
  const [selectedServiziIds, setSelectedServiziIds] = useState([]);  // [] = tutti

  useEffect(() => {
    const loadCommesse = async () => {
      try {
        const res = await axios.get(`${API}/commesse`, { headers: authHeaders() });
        const list = Array.isArray(res.data) ? res.data : res.data?.commesse || [];
        setCommesse(list);
        if (list.length && !selectedCommessa) setSelectedCommessa(list[0].id);
      } catch (e) {
        console.error("loadCommesse", e);
      }
    };
    loadCommesse();
  }, []);

  // Carica i servizi disponibili per la commessa selezionata.
  // Backoffice_commessa con servizi_autorizzati: la lista è filtrata dal backend tramite /servizi
  // (ritorna solo i servizi autorizzati per l'utente).
  useEffect(() => {
    if (!selectedCommessa) {
      setServizi([]);
      setSelectedServiziIds([]);
      return;
    }
    const loadServizi = async () => {
      try {
        const res = await axios.get(`${API}/servizi`, {
          params: { commessa_id: selectedCommessa },
          headers: authHeaders(),
        });
        const list = Array.isArray(res.data) ? res.data : res.data?.servizi || [];
        setServizi(list);
        // Reset selezione su quelli ancora presenti nella lista
        setSelectedServiziIds((prev) => prev.filter((sid) => list.find((s) => s.id === sid)));
      } catch (e) {
        console.error("loadServizi", e);
        setServizi([]);
      }
    };
    loadServizi();
  }, [selectedCommessa]);

  const toggleServizio = (id) => {
    setSelectedServiziIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };
  const clearServizi = () => setSelectedServiziIds([]);

  const isAdmin = user?.role === "admin";

  return (
    <div className="p-6 space-y-6" data-testid="post-vendita-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="w-7 h-7 text-indigo-600" />
            Post Vendita
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestione del workflow post-vendita: status configurabili per commessa e import massivi.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-slate-600">Commessa:</label>
          <select
            value={selectedCommessa}
            onChange={(e) => setSelectedCommessa(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            data-testid="post-vendita-commessa-select"
          >
            {commesse.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <ServiziMultiSelect
            servizi={servizi}
            selected={selectedServiziIds}
            onToggle={toggleServizio}
            onClear={clearServizi}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-1">
        <TabButton active={activeSubTab === "clienti"} onClick={() => setActiveSubTab("clienti")} testid="pv-tab-clienti">
          <Package className="w-4 h-4" />
          Clienti Post-Vendita
        </TabButton>
        <TabButton active={activeSubTab === "import"} onClick={() => setActiveSubTab("import")} testid="pv-tab-import">
          <Upload className="w-4 h-4" />
          Import Massivo
        </TabButton>
        {isAdmin && (
          <TabButton active={activeSubTab === "config"} onClick={() => setActiveSubTab("config")} testid="pv-tab-config">
            <Settings className="w-4 h-4" />
            Configurazione Status
          </TabButton>
        )}
        <TabButton active={activeSubTab === "history"} onClick={() => setActiveSubTab("history")} testid="pv-tab-history">
          <History className="w-4 h-4" />
          Storico Import
        </TabButton>
      </div>

      {/* Content */}
      <div>
        {activeSubTab === "clienti" && <ClientiTab commessaId={selectedCommessa} servizioIds={selectedServiziIds} />}
        {activeSubTab === "import" && <BulkImportTab commessaId={selectedCommessa} commesse={commesse} />}
        {activeSubTab === "config" && isAdmin && <StatusConfigTab commessaId={selectedCommessa} />}
        {activeSubTab === "history" && <ImportHistoryTab />}
      </div>
    </div>
  );
};

const ServiziMultiSelect = ({ servizi, selected, onToggle, onClear }) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const totalServizi = servizi.length;
  const selectedCount = selected.length;
  const buttonLabel =
    totalServizi === 0 ? "Nessun servizio"
    : selectedCount === 0 ? "Tutti i servizi"
    : selectedCount === 1 ? (servizi.find((s) => s.id === selected[0])?.nome || "1 servizio")
    : `${selectedCount} servizi`;

  return (
    <div className="relative" ref={ref}>
      <label className="text-sm text-slate-600 mr-2">Servizio:</label>
      <button
        type="button"
        onClick={() => totalServizi && setOpen((o) => !o)}
        disabled={totalServizi === 0}
        className={`px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white inline-flex items-center gap-2 min-w-[180px] justify-between disabled:opacity-50 hover:border-slate-400 ${selectedCount > 0 ? "ring-1 ring-indigo-300" : ""}`}
        data-testid="post-vendita-servizio-multi"
      >
        <span className="truncate">{buttonLabel}</span>
        <ChevronRight className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-64 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg p-1.5" data-testid="post-vendita-servizio-dropdown">
          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 mb-1">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Filtra per servizio</span>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="text-xs text-indigo-600 hover:text-indigo-800"
                data-testid="post-vendita-servizio-clear"
              >
                Reset
              </button>
            )}
          </div>
          {servizi.map((s) => {
            const isOn = selected.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onToggle(s.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left ${isOn ? "bg-indigo-50 text-indigo-800" : "hover:bg-slate-50 text-slate-700"}`}
                data-testid={`post-vendita-servizio-opt-${s.id}`}
              >
                <span className={`w-4 h-4 inline-flex items-center justify-center rounded border ${isOn ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300"}`}>
                  {isOn && <Check className="w-3 h-3" />}
                </span>
                <span className="truncate">{s.nome}</span>
              </button>
            );
          })}
        </div>
      )}
      {selectedCount > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selected.map((sid) => {
            const s = servizi.find((x) => x.id === sid);
            if (!s) return null;
            return (
              <span key={sid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs">
                {s.nome}
                <button onClick={() => onToggle(sid)} className="hover:text-indigo-900" data-testid={`post-vendita-servizio-chip-remove-${sid}`}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TabButton = ({ children, active, onClick, testid }) => (
  <button
    onClick={onClick}
    data-testid={testid}
    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active
        ? "border-indigo-600 text-indigo-700"
        : "border-transparent text-slate-500 hover:text-slate-700"
    }`}
  >
    {children}
  </button>
);

const KpiCard = ({ label, value, accent = "slate", emoji, active, onClick, testid }) => {
  const palette = {
    amber:   { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-800",   ring: "ring-amber-400"   },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", ring: "ring-emerald-400" },
    red:     { bg: "bg-red-50",     border: "border-red-200",     text: "text-red-800",     ring: "ring-red-400"     },
    indigo:  { bg: "bg-indigo-50",  border: "border-indigo-200",  text: "text-indigo-800",  ring: "ring-indigo-400"  },
    slate:   { bg: "bg-slate-50",   border: "border-slate-200",   text: "text-slate-800",   ring: "ring-slate-400"   },
  }[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className={`text-left p-4 rounded-lg border ${palette.bg} ${palette.border} hover:shadow-md transition-all ${active ? `ring-2 ${palette.ring} shadow-sm` : ""}`}
    >
      <div className={`text-xs uppercase tracking-wide ${palette.text} flex items-center gap-1.5 opacity-80`}>
        <span>{emoji}</span> {label}
      </div>
      <div className={`text-3xl font-bold mt-1 ${palette.text}`}>{value}</div>
    </button>
  );
};

// =====================================================
// CLIENTI TAB
// =====================================================
const ClientiTab = ({ commessaId, servizioIds = [] }) => {
  const [statusConfig, setStatusConfig] = useState([]);
  const [data, setData] = useState({ clienti: [], total: 0 });
  const [stats, setStats] = useState({ lavorazione: 0, attivato: 0, ko: 0, no_stage: 0, total: 0 });
  const [filters, setFilters] = useState({
    post_vendita_status: "",
    codice_account_filter: "",
    search: "",
    stage: "",  // empty = default behavior (uses include_closed); "lavorazione"|"attivato"|"ko" = explicit
    include_closed: false,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const PAGE_SIZE = 50;

  // Stable key per servizioIds to feed useCallback deps without re-firing on identity-only changes
  const servizioIdsKey = (servizioIds || []).slice().sort().join(",");

  const fetchData = useCallback(async () => {
    if (!commessaId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("commessa_id", commessaId);
      params.append("page", String(page));
      params.append("page_size", String(PAGE_SIZE));
      params.append("include_closed", String(filters.include_closed));
      (servizioIds || []).forEach((sid) => params.append("servizio_id", sid));
      if (filters.stage) params.append("stage", filters.stage);
      if (filters.post_vendita_status) params.append("post_vendita_status", filters.post_vendita_status);
      if (filters.codice_account_filter) params.append("codice_account_filter", filters.codice_account_filter);
      if (filters.search) params.append("search", filters.search);

      const statsParams = new URLSearchParams();
      statsParams.append("commessa_id", commessaId);
      (servizioIds || []).forEach((sid) => statsParams.append("servizio_id", sid));

      const [resCli, resCfg, resStats] = await Promise.all([
        axios.get(`${API}/post-vendita/clienti?${params.toString()}`, { headers: authHeaders() }),
        axios.get(`${API}/post-vendita/status-config`, { params: { commessa_id: commessaId }, headers: authHeaders() }),
        axios.get(`${API}/post-vendita/clienti/stats?${statsParams.toString()}`, { headers: authHeaders() }),
      ]);
      setData(resCli.data);
      setStatusConfig(resCfg.data || []);
      setStats(resStats.data || { lavorazione: 0, attivato: 0, ko: 0, no_stage: 0, total: 0 });
    } catch (e) {
      console.error("fetch post-vendita clienti", e);
    } finally {
      setLoading(false);
    }
    // servizioIdsKey is sufficient to detect changes; servizioIds itself is referenced via closure
  }, [commessaId, servizioIdsKey, page, filters]); // eslint-disable-line

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh la lista quando il modale Post Vendita salva una modifica al cliente
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("app:pv-cliente-updated", handler);
    return () => window.removeEventListener("app:pv-cliente-updated", handler);
  }, [fetchData]);

  const handleStatusChange = async (clienteId, newStatus) => {
    try {
      await axios.patch(
        `${API}/post-vendita/clienti/${clienteId}/status`,
        { post_vendita_status: newStatus },
        { headers: authHeaders() }
      );
      fetchData();
    } catch (e) {
      alert(e?.response?.data?.detail || "Errore aggiornamento status");
    }
  };

  const handleDeleteCliente = async (cliente, e) => {
    e?.stopPropagation();
    const label = `${cliente.cognome || ""} ${cliente.nome || ""}`.trim() || cliente.ragione_sociale || "(senza nome)";
    if (!window.confirm(`Rimuovere il cliente "${label}" dalla sezione Post Vendita?\n\nIl cliente resterà nell'anagrafica clienti e potrà essere reinserito in Post Vendita in qualsiasi momento dal pulsante "Passa al Post Vendita".`)) return;
    try {
      await axios.delete(`${API}/post-vendita/clienti/${cliente.id}`, { headers: authHeaders() });
      fetchData();
    } catch (err) {
      alert(err?.response?.data?.detail || "Errore rimozione cliente dal Post Vendita");
    }
  };

  const statusLabel = (val) => {
    const cfg = statusConfig.find((s) => s.value === val);
    return cfg?.label || val || "—";
  };
  const statusColor = (val) => {
    const cfg = statusConfig.find((s) => s.value === val);
    return cfg?.color || "#6b7280";
  };

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="In Lavorazione"
          value={stats.lavorazione + stats.no_stage}
          stage="lavorazione"
          active={filters.stage === "lavorazione" || (!filters.stage && !filters.include_closed)}
          accent="amber"
          emoji="🟡"
          onClick={() => { setFilters({ ...filters, stage: "lavorazione", include_closed: false }); setPage(1); }}
          testid="pv-kpi-lavorazione"
        />
        <KpiCard
          label="Attivati"
          value={stats.attivato}
          stage="attivato"
          active={filters.stage === "attivato"}
          accent="emerald"
          emoji="🟢"
          onClick={() => { setFilters({ ...filters, stage: "attivato", include_closed: true }); setPage(1); }}
          testid="pv-kpi-attivato"
        />
        <KpiCard
          label="KO"
          value={stats.ko}
          stage="ko"
          active={filters.stage === "ko"}
          accent="red"
          emoji="🔴"
          onClick={() => { setFilters({ ...filters, stage: "ko", include_closed: true }); setPage(1); }}
          testid="pv-kpi-ko"
        />
        <KpiCard
          label="Tutti"
          value={stats.total}
          stage=""
          active={!filters.stage && filters.include_closed}
          accent="indigo"
          emoji="📋"
          onClick={() => { setFilters({ ...filters, stage: "", include_closed: true }); setPage(1); }}
          testid="pv-kpi-tutti"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap bg-slate-50 border border-slate-200 rounded-lg p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cerca nome, cognome, email, codice account..."
            value={filters.search}
            onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }}
            className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            data-testid="pv-clienti-search"
          />
        </div>
        <select
          value={filters.post_vendita_status}
          onChange={(e) => { setFilters({ ...filters, post_vendita_status: e.target.value }); setPage(1); }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          data-testid="pv-clienti-filter-status"
        >
          <option value="">Tutti gli status</option>
          {statusConfig.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filters.codice_account_filter}
          onChange={(e) => { setFilters({ ...filters, codice_account_filter: e.target.value }); setPage(1); }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
          data-testid="pv-clienti-filter-account"
        >
          <option value="">Tutti i clienti</option>
          <option value="present">Con Codice Account</option>
          <option value="missing">Senza Codice Account</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700 px-2 py-1 rounded-lg hover:bg-white cursor-pointer" data-testid="pv-clienti-include-closed-label">
          <input
            type="checkbox"
            checked={filters.include_closed}
            onChange={(e) => { setFilters({ ...filters, include_closed: e.target.checked }); setPage(1); }}
            data-testid="pv-clienti-include-closed"
          />
          <span className="select-none">Mostra anche chiusi (🟢 Attivati / 🔴 KO)</span>
        </label>
        <button
          onClick={fetchData}
          className="flex items-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm"
          data-testid="pv-clienti-refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Aggiorna
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="text-sm text-slate-600" data-testid="pv-clienti-count">
          <span className="font-semibold">{data.total}</span> clienti{filters.include_closed ? " in post-vendita" : " in lavorazione"}
        </div>
        {!filters.include_closed && (
          <div className="text-xs text-slate-500 italic">
            ℹ️ I clienti con esito 🟢 Attivato o 🔴 KO sono nascosti per default. Lo storico resta sull'anagrafica del cliente.
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Cliente</th>
                <th className="px-3 py-2 text-left font-medium">Codice Account</th>
                <th className="px-3 py-2 text-left font-medium">CF / P.IVA</th>
                <th className="px-3 py-2 text-left font-medium">Offerta Attivata</th>
                <th className="px-3 py-2 text-left font-medium">Status PV</th>
                <th className="px-3 py-2 text-left font-medium">Aggiornato</th>
                <th className="px-3 py-2 text-right font-medium">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.clienti.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-slate-400">
                    {loading ? "Caricamento..." : "Nessun cliente in post-vendita per i filtri selezionati."}
                  </td>
                </tr>
              ) : data.clienti.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-indigo-50 cursor-pointer transition-colors"
                  data-testid={`pv-cliente-row-${c.id}`}
                  onClick={(e) => {
                    // Avoid triggering when clicking the inline status select
                    if (e.target.closest("select")) return;
                    window.dispatchEvent(new CustomEvent("app:open-cliente-from-pv", { detail: { clienteId: c.id } }));
                  }}
                  title="Clicca per aprire la scheda completa del cliente"
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{c.cognome} {c.nome}</div>
                    {c.ragione_sociale && <div className="text-xs text-slate-500">{c.ragione_sociale}</div>}
                  </td>
                  <td className="px-3 py-2">
                    {c.codice_account ? (
                      <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{c.codice_account}</span>
                    ) : (
                      <span className="text-amber-600 text-xs italic">Mancante</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">
                    {c.partita_iva ? (
                      <span title="Partita IVA">{c.partita_iva}</span>
                    ) : c.codice_fiscale ? (
                      <span title="Codice Fiscale">{c.codice_fiscale}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {c.offerta_name ? (
                      <span className="inline-block max-w-[200px] truncate" title={c.offerta_name}>{c.offerta_name}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={c.post_vendita_status || ""}
                      onChange={(e) => handleStatusChange(c.id, e.target.value)}
                      className="px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                      style={{ borderLeft: `4px solid ${statusColor(c.post_vendita_status)}` }}
                      data-testid={`pv-cliente-status-${c.id}`}
                    >
                      <option value="">— nessuno —</option>
                      {statusConfig.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                      {c.post_vendita_status && !statusConfig.find((s) => s.value === c.post_vendita_status) && (
                        <option value={c.post_vendita_status}>{statusLabel(c.post_vendita_status)} (legacy)</option>
                      )}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {c.post_vendita_status_updated_at ? new Date(c.post_vendita_status_updated_at).toLocaleString("it-IT") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={(e) => handleDeleteCliente(c, e)}
                      className="inline-flex items-center justify-center p-1.5 rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                      title="Rimuovi dalla sezione Post Vendita (il cliente resta in anagrafica)"
                      data-testid={`pv-cliente-delete-${c.id}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 bg-slate-50 text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1 border border-slate-300 rounded disabled:opacity-40 hover:bg-white"
              data-testid="pv-clienti-prev"
            >
              <ChevronLeft className="w-4 h-4" /> Prec.
            </button>
            <span className="text-slate-600">
              Pagina <strong>{page}</strong> di <strong>{totalPages}</strong>
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1 border border-slate-300 rounded disabled:opacity-40 hover:bg-white"
              data-testid="pv-clienti-next"
            >
              Succ. <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// =====================================================
// STATUS CONFIG TAB
// =====================================================
const StatusConfigTab = ({ commessaId }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // null | "new" | item

  const load = useCallback(async () => {
    if (!commessaId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/post-vendita/status-config`, {
        params: { commessa_id: commessaId },
        headers: authHeaders(),
      });
      setItems(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [commessaId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    try {
      if (form.id) {
        const { id, created_at, ...patch } = form;
        await axios.put(`${API}/post-vendita/status-config/${id}`, patch, { headers: authHeaders() });
      } else {
        await axios.post(`${API}/post-vendita/status-config`, form, { headers: authHeaders() });
      }
      setEditing(null);
      load();
    } catch (e) {
      alert(e?.response?.data?.detail || "Errore salvataggio");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Disattivare questo status? I clienti già con questo status manterranno il valore.")) return;
    try {
      await axios.delete(`${API}/post-vendita/status-config/${id}`, { headers: authHeaders() });
      load();
    } catch (e) {
      alert(e?.response?.data?.detail || "Errore eliminazione");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Definisci i passaggi del workflow post-vendita per la commessa selezionata.
        </p>
        <button
          onClick={() => setEditing({ commessa_id: commessaId, value: "", label: "", color: "#6b7280", order: items.length, is_default: false })}
          disabled={!commessaId}
          className="flex items-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm disabled:opacity-40"
          data-testid="pv-config-add-btn"
        >
          <Plus className="w-4 h-4" /> Aggiungi Status
        </button>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Ordine</th>
              <th className="px-3 py-2 text-left">Colore</th>
              <th className="px-3 py-2 text-left">Etichetta</th>
              <th className="px-3 py-2 text-left">Tipo (Stage)</th>
              <th className="px-3 py-2 text-left">Value</th>
              <th className="px-3 py-2 text-left">Default</th>
              <th className="px-3 py-2 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">{loading ? "Caricamento..." : "Nessuno status configurato. Aggiungi il primo."}</td></tr>
            ) : items.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50" data-testid={`pv-config-row-${s.value}`}>
                <td className="px-3 py-2">{s.order}</td>
                <td className="px-3 py-2">
                  <span className="inline-block w-6 h-6 rounded border border-slate-200" style={{ background: s.color || "#6b7280" }} />
                </td>
                <td className="px-3 py-2 font-medium">{s.label}</td>
                <td className="px-3 py-2"><StageBadge stage={s.stage || "lavorazione"} /></td>
                <td className="px-3 py-2 font-mono text-xs">{s.value}</td>
                <td className="px-3 py-2">{s.is_default ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : ""}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setEditing(s)} className="text-blue-600 hover:text-blue-800 mr-3" data-testid={`pv-config-edit-${s.value}`}><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-800" data-testid={`pv-config-delete-${s.value}`}><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <StatusConfigDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

const StageBadge = ({ stage }) => {
  const map = {
    attivato: { label: "Attivato", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", emoji: "🟢" },
    ko: { label: "KO", cls: "bg-red-100 text-red-700 border-red-200", emoji: "🔴" },
    lavorazione: { label: "Lavorazione", cls: "bg-amber-100 text-amber-700 border-amber-200", emoji: "🟡" },
  };
  const cfg = map[stage] || map.lavorazione;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${cfg.cls}`}>
      <span>{cfg.emoji}</span>
      {cfg.label}
    </span>
  );
};

const StatusConfigDialog = ({ initial, onClose, onSave }) => {
  const [form, setForm] = useState({
    id: initial.id,
    commessa_id: initial.commessa_id,
    value: initial.value || "",
    label: initial.label || "",
    color: initial.color || "#6b7280",
    stage: initial.stage || "lavorazione",
    order: initial.order ?? 0,
    is_default: initial.is_default || false,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.label.trim()) return alert("Etichetta richiesta");
    const value = form.value.trim() || form.label.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, "");
    onSave({ ...form, value });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" data-testid="pv-config-dialog">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="font-semibold">{form.id ? "Modifica Status" : "Nuovo Status"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-700">Etichetta *</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
              placeholder="es. Da Lavorare"
              data-testid="pv-config-label-input"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Tipo (Stage) *</label>
            <select
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
              data-testid="pv-config-stage-input"
            >
              <option value="lavorazione">🟡 Lavorazione</option>
              <option value="attivato">🟢 Attivato</option>
              <option value="ko">🔴 KO</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Determina come si aggiorna automaticamente lo <strong>status anagrafica</strong> del cliente quando si trova in questo stato del workflow.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Value (interno)</label>
            <input
              type="text"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm"
              placeholder="auto-generato dalla etichetta"
              data-testid="pv-config-value-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Colore</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="mt-1 w-full h-10 border border-slate-300 rounded-lg"
                data-testid="pv-config-color-input"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Ordine</label>
              <input
                type="number"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                data-testid="pv-config-order-input"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              data-testid="pv-config-default-input"
            />
            Status di default (assegnato automaticamente quando un cliente passa al post-vendita)
          </label>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded-lg hover:bg-slate-100">Annulla</button>
            <button type="submit" className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg" data-testid="pv-config-save-btn">
              Salva
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =====================================================
// BULK IMPORT TAB (Wizard)
// =====================================================
const BulkImportTab = ({ commessaId, commesse }) => {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [codiceColumn, setCodiceColumn] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [statusConfig, setStatusConfig] = useState([]);
  const [manualMatches, setManualMatches] = useState({}); // {row_index: cliente_id}
  const [result, setResult] = useState(null);
  const [previewHeaders, setPreviewHeaders] = useState([]);
  const [allClienti, setAllClienti] = useState([]); // for manual select
  const fileInputRef = useRef(null);

  const commessaName = commesse.find((c) => c.id === commessaId)?.nome || "";

  const loadCfg = useCallback(async () => {
    if (!commessaId) return;
    try {
      const res = await axios.get(`${API}/post-vendita/status-config`, {
        params: { commessa_id: commessaId }, headers: authHeaders(),
      });
      setStatusConfig(res.data || []);
    } catch (e) { console.error(e); }
  }, [commessaId]);

  useEffect(() => { loadCfg(); }, [loadCfg]);

  const reset = () => {
    setStep(1);
    setFile(null);
    setCodiceColumn("");
    setNewStatus("");
    setAnalysis(null);
    setManualMatches({});
    setResult(null);
    setPreviewHeaders([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const previewFileHeaders = async (f) => {
    // Parse first row client-side for column selection (csv only quick-peek)
    if (!f) return;
    const isXlsx = f.name.toLowerCase().endsWith(".xlsx") || f.name.toLowerCase().endsWith(".xls");
    if (isXlsx) {
      // For xlsx, ask user to type column name; OR run analyze with empty codice to extract headers
      setPreviewHeaders([]);
      return;
    }
    try {
      const text = await f.text();
      const firstLine = (text.split(/\r?\n/)[0] || "").trim();
      if (!firstLine) return;
      // Detect delimiter
      const delim = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
      const headers = firstLine.split(delim).map((h) => h.replace(/^"|"$/g, "").trim());
      setPreviewHeaders(headers);
      // Auto-detect codice column
      const guess = headers.find((h) => /codice.*account|account.*code|^account$|cod.account/i.test(h));
      if (guess) setCodiceColumn(guess);
    } catch (e) { console.error(e); }
  };

  const analyze = async () => {
    if (!file || !codiceColumn || !newStatus) {
      alert("Carica un file, scegli la colonna codice account e indica il nuovo status.");
      return;
    }
    setAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("commessa_id", commessaId);
      fd.append("codice_account_column", codiceColumn);
      fd.append("new_status", newStatus);
      fd.append("match_columns", JSON.stringify([]));
      const res = await axios.post(`${API}/post-vendita/bulk-import/analyze`, fd, {
        headers: { ...authHeaders(), "Content-Type": "multipart/form-data" },
      });
      setAnalysis(res.data);
      // Load all clienti without code for the manual match dropdown
      const cliRes = await axios.get(`${API}/clienti`, {
        params: { commessa_id: commessaId, page_size: 500 }, headers: authHeaders(),
      });
      setAllClienti(cliRes.data?.clienti || []);
      setStep(2);
    } catch (e) {
      alert(e?.response?.data?.detail || "Errore analisi file");
    } finally {
      setAnalyzing(false);
    }
  };

  const execute = async () => {
    if (!analysis) return;
    setExecuting(true);
    try {
      const manual = (analysis.unmatched || [])
        .filter((u) => manualMatches[u.row_index])
        .map((u) => ({ cliente_id: manualMatches[u.row_index], codice_account: u.code_to_set || "" }));
      const auto = (analysis.auto_matched || []).map((a) => ({ cliente_id: a.cliente_id, codice_account: a.codice_account }));
      const res = await axios.post(`${API}/post-vendita/bulk-import/execute`, {
        commessa_id: commessaId,
        new_status: newStatus,
        auto_matched: auto,
        manual_matched: manual,
      }, { headers: authHeaders() });
      setResult(res.data);
      setStep(3);
    } catch (e) {
      alert(e?.response?.data?.detail || "Errore esecuzione import");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="pv-import-tab">
      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        <StepBadge num={1} label="Carica & Mappa" active={step === 1} done={step > 1} />
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <StepBadge num={2} label="Anteprima Match" active={step === 2} done={step > 2} />
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <StepBadge num={3} label="Risultato" active={step === 3} done={false} />
      </div>

      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-800">Step 1 — Carica file e mappa la colonna</h3>
            <p className="text-sm text-slate-500 mt-1">Commessa: <strong>{commessaName || "—"}</strong></p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">File CSV o Excel (.csv / .xlsx)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFile(f || null);
                if (f) previewFileHeaders(f);
              }}
              className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              data-testid="pv-import-file-input"
            />
            {file && (
              <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" /> {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Colonna del file con il "Codice Account"</label>
              {previewHeaders.length > 0 ? (
                <select
                  value={codiceColumn}
                  onChange={(e) => setCodiceColumn(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  data-testid="pv-import-codice-column"
                >
                  <option value="">— seleziona —</option>
                  {previewHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={codiceColumn}
                  onChange={(e) => setCodiceColumn(e.target.value)}
                  placeholder="es. CodiceAccount"
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  data-testid="pv-import-codice-column"
                />
              )}
              <p className="text-xs text-slate-500 mt-1">Per file Excel: digita esattamente il nome dell'header presente nella prima riga.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Nuovo Status da applicare</label>
              <input
                type="text"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                placeholder="es. Attivato"
                list="pv-existing-statuses"
                className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                data-testid="pv-import-new-status"
              />
              <datalist id="pv-existing-statuses">
                {statusConfig.map((s) => <option key={s.value} value={s.label} />)}
              </datalist>
              <p className="text-xs text-slate-500 mt-1">Se non esiste, verrà creato automaticamente in configurazione.</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={analyze}
              disabled={analyzing || !file || !codiceColumn || !newStatus || !commessaId}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
              data-testid="pv-import-analyze-btn"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              Analizza file
            </button>
          </div>
        </div>
      )}

      {step === 2 && analysis && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SummaryCard label="Totale righe" value={analysis.total_rows} icon={<FileSpreadsheet className="w-5 h-5" />} color="slate" />
            <SummaryCard label="Match automatici" value={analysis.auto_matched?.length || 0} icon={<CheckCircle2 className="w-5 h-5" />} color="emerald" />
            <SummaryCard label="Da risolvere manualmente" value={analysis.unmatched?.length || 0} icon={<AlertTriangle className="w-5 h-5" />} color="amber" />
          </div>

          {/* Auto-matched */}
          <div className="bg-white border border-emerald-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-200 font-semibold text-emerald-800 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Match automatici per "Codice Account"
            </div>
            {(analysis.auto_matched || []).length === 0 ? (
              <div className="p-4 text-sm text-slate-400">Nessun match automatico trovato.</div>
            ) : (
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-600 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Codice Account</th>
                      <th className="px-3 py-2 text-left">Cliente abbinato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analysis.auto_matched.map((a) => (
                      <tr key={a.row_index}>
                        <td className="px-3 py-1.5 text-xs text-slate-500">{a.row_index + 1}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{a.codice_account}</td>
                        <td className="px-3 py-1.5">{a.cliente_label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Unmatched - manual resolution */}
          <div className="bg-white border border-amber-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 font-semibold text-amber-800 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Righe da abbinare manualmente
            </div>
            {(analysis.unmatched || []).length === 0 ? (
              <div className="p-4 text-sm text-slate-400">Tutte le righe sono state abbinate automaticamente.</div>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-xs uppercase text-slate-600 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Anteprima riga</th>
                      <th className="px-3 py-2 text-left">Motivo</th>
                      <th className="px-3 py-2 text-left">Abbina a cliente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analysis.unmatched.map((u) => (
                      <tr key={u.row_index} data-testid={`pv-import-unmatched-${u.row_index}`}>
                        <td className="px-3 py-1.5 text-xs text-slate-500">{u.row_index + 1}</td>
                        <td className="px-3 py-1.5 text-xs text-slate-600 truncate max-w-xs">
                          {Object.entries(u.row || {}).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(" • ")}
                        </td>
                        <td className="px-3 py-1.5 text-xs">
                          {u.reason ? (
                            <span className="text-amber-700">{u.reason}</span>
                          ) : (
                            <span className="text-slate-500">Codice non trovato: <code>{u.code_to_set}</code></span>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            value={manualMatches[u.row_index] || ""}
                            onChange={(e) => setManualMatches({ ...manualMatches, [u.row_index]: e.target.value })}
                            className="px-2 py-1 border border-slate-300 rounded text-xs bg-white max-w-[260px]"
                            data-testid={`pv-import-manual-select-${u.row_index}`}
                          >
                            <option value="">— ignora —</option>
                            {(u.candidates || []).length > 0 && (
                              <optgroup label="Candidati suggeriti">
                                {u.candidates.map((c) => (
                                  <option key={c.cliente_id} value={c.cliente_id}>{c.cliente_label} ({c.matched_field})</option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="Tutti i clienti della commessa">
                              {allClienti.map((c) => (
                                <option key={c.id} value={c.id}>{c.cognome} {c.nome} {c.email ? `— ${c.email}` : ""}</option>
                              ))}
                            </optgroup>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button onClick={() => { setStep(1); setAnalysis(null); }} className="px-3 py-2 text-sm rounded-lg hover:bg-slate-100 flex items-center gap-1" data-testid="pv-import-back-btn">
              <ChevronLeft className="w-4 h-4" /> Indietro
            </button>
            <button
              onClick={execute}
              disabled={executing}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
              data-testid="pv-import-execute-btn"
            >
              {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Conferma e applica
            </button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="bg-white border border-emerald-200 rounded-lg p-5 space-y-4" data-testid="pv-import-result">
          <div className="flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="w-7 h-7" />
            <h3 className="text-xl font-semibold">Import completato</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <SummaryCard label="Match automatici applicati" value={result.auto_matched} icon={<CheckCircle2 className="w-5 h-5" />} color="emerald" />
            <SummaryCard label="Match manuali applicati" value={result.manual_matched} icon={<CheckCircle2 className="w-5 h-5" />} color="indigo" />
            <SummaryCard label="Errori" value={result.errors?.length || 0} icon={<AlertTriangle className="w-5 h-5" />} color={result.errors?.length ? "red" : "slate"} />
          </div>
          {result.status_auto_created && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
              ✨ Nuovo status <strong>{newStatus}</strong> creato automaticamente nella configurazione della commessa.
            </div>
          )}
          {result.errors?.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-red-700">Dettaglio errori ({result.errors.length})</summary>
              <pre className="mt-2 bg-red-50 p-3 rounded text-xs overflow-x-auto">{JSON.stringify(result.errors, null, 2)}</pre>
            </details>
          )}
          <div className="flex justify-end pt-3 border-t border-slate-200">
            <button onClick={reset} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm" data-testid="pv-import-new-btn">
              Nuovo import
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const StepBadge = ({ num, label, active, done }) => (
  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${active ? "bg-indigo-100 text-indigo-800 font-semibold" : done ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${active ? "bg-indigo-600 text-white" : done ? "bg-emerald-600 text-white" : "bg-slate-300 text-slate-600"}`}>
      {done ? "✓" : num}
    </span>
    {label}
  </div>
);

const SummaryCard = ({ label, value, icon, color }) => {
  const colors = {
    slate: "bg-slate-50 border-slate-200 text-slate-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    red: "bg-red-50 border-red-200 text-red-700",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
  };
  return (
    <div className={`p-4 rounded-lg border ${colors[color] || colors.slate}`}>
      <div className="text-xs uppercase tracking-wide opacity-70 flex items-center gap-1">{icon} {label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
    </div>
  );
};

// =====================================================
// IMPORT HISTORY TAB
// =====================================================
const ImportHistoryTab = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/post-vendita/imports`, { headers: authHeaders() });
      setItems(res.data?.imports || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3" data-testid="pv-history-tab">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">Ultimi 50 import effettuati.</p>
        <button onClick={load} className="flex items-center gap-1 px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Aggiorna
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Utente</th>
              <th className="px-3 py-2 text-left">Status applicato</th>
              <th className="px-3 py-2 text-right">Auto</th>
              <th className="px-3 py-2 text-right">Manuali</th>
              <th className="px-3 py-2 text-right">Errori</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">{loading ? "Caricamento..." : "Nessun import effettuato."}</td></tr>
            ) : items.map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-2 text-xs">{new Date(i.uploaded_at).toLocaleString("it-IT")}</td>
                <td className="px-3 py-2">{i.uploaded_by_username}</td>
                <td className="px-3 py-2">
                  {i.new_status_label || i.new_status}
                  {i.status_auto_created && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">nuovo</span>}
                </td>
                <td className="px-3 py-2 text-right text-emerald-700">{i.auto_matched_count}</td>
                <td className="px-3 py-2 text-right text-indigo-700">{i.manual_matched_count}</td>
                <td className="px-3 py-2 text-right">{(i.errors?.length || 0) > 0 ? <span className="text-red-700">{i.errors.length}</span> : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PostVendita;
