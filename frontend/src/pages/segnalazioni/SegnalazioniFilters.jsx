import React from "react";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Search } from "lucide-react";

export const SegnalazioniFilters = ({ filters, setFilters, options }) => (
  <div className="flex flex-col sm:flex-row gap-3">
    <div className="relative flex-1">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <Input className="pl-9" placeholder="Cerca nome, cognome, telefono, segnalatore..." value={filters.search}
        onChange={(e) => setFilters({ ...filters, search: e.target.value })} data-testid="segnalazioni-search-input" />
    </div>
    <Select value={filters.esito} onValueChange={(v) => setFilters({ ...filters, esito: v })}>
      <SelectTrigger className="sm:w-44" data-testid="segnalazioni-esito-filter"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tutti gli esiti</SelectItem>
        <SelectItem value="da_lavorare">Da lavorare</SelectItem>
        <SelectItem value="OK">OK</SelectItem>
        <SelectItem value="KO">KO</SelectItem>
        <SelectItem value="NR">NR</SelectItem>
      </SelectContent>
    </Select>
    <Select value={filters.commessa_id} onValueChange={(v) => setFilters({ ...filters, commessa_id: v })}>
      <SelectTrigger className="sm:w-48" data-testid="segnalazioni-commessa-filter"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tutte le commesse</SelectItem>
        {options.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>
);
