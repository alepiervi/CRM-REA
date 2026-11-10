import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { FileSpreadsheet, X } from "lucide-react";

const byName = (a, b) => (a.label || "").localeCompare(b.label || "", "it", { sensitivity: "base" });
export const roleLabel = (r) => (r || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const EMPTY_USER_FILTERS = { role: "all", unit: "all", subAgenzia: "all", commessa: "all" };

export const applyUserFilters = (users, f) => users.filter((u) =>
  (f.role === "all" || u.role === f.role) &&
  (f.unit === "all" || u.unit_id === f.unit || (u.unit_autorizzate || []).includes(f.unit)) &&
  (f.subAgenzia === "all" || u.sub_agenzia_id === f.subAgenzia || (u.sub_agenzie_autorizzate || []).includes(f.subAgenzia)) &&
  (f.commessa === "all" || (u.commesse_autorizzate || []).includes(f.commessa)));

const FilterSelect = ({ value, onChange, allLabel, options, testId }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="sm:w-48" data-testid={testId}><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="all">{allLabel}</SelectItem>
      {options.slice().sort(byName).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
    </SelectContent>
  </Select>
);

export const UsersFilters = ({ filters, setFilters, users, units, subAgenzie, commesse, onExport, exporting, count }) => {
  const set = (k) => (v) => setFilters({ ...filters, [k]: v });
  const roles = [...new Set(users.map((u) => u.role))].map((r) => ({ value: r, label: roleLabel(r) }));
  const active = Object.values(filters).some((v) => v !== "all");
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2" data-testid="users-filters">
      <FilterSelect value={filters.role} onChange={set("role")} allLabel="Tutti i ruoli" options={roles} testId="users-filter-role" />
      <FilterSelect value={filters.unit} onChange={set("unit")} allLabel="Tutte le Unit" testId="users-filter-unit"
        options={(units || []).map((u) => ({ value: u.id, label: u.name || u.nome }))} />
      <FilterSelect value={filters.subAgenzia} onChange={set("subAgenzia")} allLabel="Tutte le Sub Agenzie" testId="users-filter-sub-agenzia"
        options={(subAgenzie || []).map((s) => ({ value: s.id, label: s.nome }))} />
      <FilterSelect value={filters.commessa} onChange={set("commessa")} allLabel="Tutte le Commesse" testId="users-filter-commessa"
        options={(commesse || []).map((c) => ({ value: c.id, label: c.nome }))} />
      {active && (
        <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_USER_FILTERS)} data-testid="users-filters-reset-btn">
          <X className="w-4 h-4 mr-1" /> Azzera filtri
        </Button>
      )}
      <Button variant="outline" className="sm:ml-auto" onClick={onExport} disabled={exporting || count === 0} data-testid="users-export-btn">
        <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />{exporting ? "Esportazione..." : `Esporta Excel (${count})`}
      </Button>
    </div>
  );
};
