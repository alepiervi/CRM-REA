import React, { useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronDown, X, Plus, Minus, Search } from "lucide-react";

/**
 * Multi-select filter con toggle Includi/Escludi.
 *
 * Props:
 *  - label:      string                    Etichetta del filtro
 *  - options:    [{ value, label, icon? }] Opzioni disponibili
 *  - included:   string[]                  Valori inclusi
 *  - excluded:   string[]                  Valori esclusi
 *  - onChange:   ({included, excluded}) => void
 *  - placeholder?: string                  Testo bottone se nulla è selezionato
 *  - testid?:    string                    Prefix data-testid
 *  - searchable?: boolean                  Mostra search box quando le opzioni sono > 8
 */
export const MultiSelectFilter = ({
  label,
  options = [],
  included = [],
  excluded = [],
  onChange,
  placeholder = "Tutti",
  testid = "multifilter",
  searchable = true,
}) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("include"); // "include" | "exclude"
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter((o) => (o.label || o.value || "").toLowerCase().includes(q));
  }, [options, search]);

  const totalSelected = included.length + excluded.length;
  const buttonLabel = (() => {
    if (!totalSelected) return placeholder;
    if (totalSelected === 1) {
      const v = included[0] || excluded[0];
      const opt = options.find((o) => o.value === v);
      const prefix = excluded.length ? "≠ " : "";
      return prefix + (opt?.label || v);
    }
    if (included.length && excluded.length) return `${included.length} incl + ${excluded.length} escl`;
    if (included.length) return `${included.length} selezionati`;
    return `${excluded.length} esclusi`;
  })();

  const toggleValue = (value) => {
    if (mode === "include") {
      // toggle in included; rimuovi anche da excluded
      const newIncl = included.includes(value) ? included.filter((v) => v !== value) : [...included, value];
      const newExcl = excluded.filter((v) => v !== value);
      onChange({ included: newIncl, excluded: newExcl });
    } else {
      const newExcl = excluded.includes(value) ? excluded.filter((v) => v !== value) : [...excluded, value];
      const newIncl = included.filter((v) => v !== value);
      onChange({ included: newIncl, excluded: newExcl });
    }
  };

  const clearAll = () => {
    onChange({ included: [], excluded: [] });
  };

  return (
    <div className="relative inline-block min-w-[160px]" ref={ref}>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid={`${testid}-trigger`}
        className={`w-full px-3 py-2 border rounded-lg text-sm bg-white inline-flex items-center justify-between gap-2 transition-colors ${
          totalSelected > 0
            ? excluded.length && !included.length
              ? "border-red-300 ring-1 ring-red-200"
              : "border-indigo-400 ring-1 ring-indigo-200"
            : "border-slate-300 hover:border-slate-400"
        }`}
      >
        <span className="truncate text-left flex-1">{buttonLabel}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 z-50 mt-1 w-[280px] max-h-[400px] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden flex flex-col"
          data-testid={`${testid}-dropdown`}
        >
          {/* Mode Toggle */}
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => setMode("include")}
              data-testid={`${testid}-mode-include`}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${
                mode === "include"
                  ? "bg-indigo-100 text-indigo-800 border-b-2 border-indigo-600"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Plus className="w-3 h-3" /> Includi
            </button>
            <button
              type="button"
              onClick={() => setMode("exclude")}
              data-testid={`${testid}-mode-exclude`}
              className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${
                mode === "exclude"
                  ? "bg-red-100 text-red-800 border-b-2 border-red-600"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Minus className="w-3 h-3" /> Escludi
            </button>
          </div>

          {/* Search */}
          {searchable && options.length > 8 && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cerca..."
                  className="w-full pl-7 pr-2 py-1 border border-slate-200 rounded text-xs"
                  data-testid={`${testid}-search`}
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <div className="overflow-y-auto flex-1 py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-xs text-slate-400 text-center">Nessuna opzione</div>
            ) : (
              filteredOptions.map((opt) => {
                const isIncluded = included.includes(opt.value);
                const isExcluded = excluded.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleValue(opt.value)}
                    data-testid={`${testid}-opt-${opt.value}`}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors ${
                      isIncluded
                        ? "bg-indigo-50 text-indigo-900"
                        : isExcluded
                          ? "bg-red-50 text-red-900"
                          : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 inline-flex items-center justify-center rounded border flex-shrink-0 ${
                        isIncluded
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : isExcluded
                            ? "bg-red-600 border-red-600 text-white"
                            : "border-slate-300"
                      }`}
                    >
                      {isIncluded && <Check className="w-3 h-3" />}
                      {isExcluded && <X className="w-3 h-3" />}
                    </span>
                    <span className="truncate flex-1">{opt.icon ? `${opt.icon} ` : ""}{opt.label || opt.value}</span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {totalSelected > 0 && (
            <div className="border-t border-slate-200 p-2 bg-slate-50">
              <button
                type="button"
                onClick={clearAll}
                data-testid={`${testid}-clear`}
                className="w-full text-xs text-red-600 hover:text-red-800 hover:bg-red-50 py-1 rounded"
              >
                Pulisci selezione
              </button>
            </div>
          )}
        </div>
      )}

      {/* Selected chips below */}
      {totalSelected > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {included.map((v) => {
            const opt = options.find((o) => o.value === v);
            return (
              <span
                key={`incl-${v}`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-xs"
                data-testid={`${testid}-chip-incl-${v}`}
              >
                <Plus className="w-2.5 h-2.5" />
                <span className="truncate max-w-[120px]">{opt?.label || v}</span>
                <button
                  onClick={() => onChange({ included: included.filter((x) => x !== v), excluded })}
                  className="hover:text-indigo-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          {excluded.map((v) => {
            const opt = options.find((o) => o.value === v);
            return (
              <span
                key={`excl-${v}`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 text-red-800 text-xs"
                data-testid={`${testid}-chip-excl-${v}`}
              >
                <Minus className="w-2.5 h-2.5" />
                <span className="truncate max-w-[120px]">{opt?.label || v}</span>
                <button
                  onClick={() => onChange({ included, excluded: excluded.filter((x) => x !== v) })}
                  className="hover:text-red-900"
                >
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

export default MultiSelectFilter;
