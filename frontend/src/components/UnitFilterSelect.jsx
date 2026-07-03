import React, { useState } from "react";
import { Search, Building2, MapPin } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";

// Select del filtro Unit/Sub Agenzia con barra di ricerca interna (match "contains" sul nome).
export const UnitFilterSelect = ({ value, onValueChange, items = [], triggerClassName = "mt-1" }) => {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) => (i.nome || i.name || "").toLowerCase().includes(q))
    : items;

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      onOpenChange={(open) => { if (!open) setSearch(""); }}
    >
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder="Seleziona unit" />
      </SelectTrigger>
      <SelectContent>
        <div className="p-2 sticky top-0 bg-white z-10 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              autoFocus
              placeholder="Cerca unit o sub agenzia..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="pl-7 h-8 text-sm"
              data-testid="unit-filter-search"
            />
          </div>
        </div>
        {!q && <SelectItem value="all">Tutte le Unit/Sub Agenzie</SelectItem>}
        {filtered.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            <div className="flex items-center space-x-2">
              {item.type === "unit" ? <Building2 className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
              <span className="text-sm">{item.nome || item.name}</span>
              <Badge variant="outline" className="text-xs">
                {item.type === "unit" ? "Unit" : "Sub Agenzia"}
              </Badge>
            </div>
          </SelectItem>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-sm text-slate-400 text-center">Nessun risultato</div>
        )}
      </SelectContent>
    </Select>
  );
};

export default UnitFilterSelect;
