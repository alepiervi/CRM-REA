import React, { useState } from "react";
import { Search } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";

// Select single-value con barra di ricerca interna (match "contains" sulla label).
// pinned: opzioni sempre visibili in cima (es. "Tutti"), non filtrate dalla ricerca.
// options: opzioni filtrabili [{ value, label, color? }].
export const SearchableSelect = ({
  value,
  onValueChange,
  options = [],
  pinned = [],
  placeholder = "Seleziona",
  triggerClassName = "",
  searchPlaceholder = "Cerca...",
  testid = "searchable-select",
}) => {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => (o.label || o.value || "").toLowerCase().includes(q))
    : options;

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      onOpenChange={(open) => { if (!open) setSearch(""); }}
    >
      <SelectTrigger className={triggerClassName} data-testid={`${testid}-trigger`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <div className="p-2 sticky top-0 bg-white z-10 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              autoFocus
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="pl-7 h-8 text-sm"
              data-testid={`${testid}-search`}
            />
          </div>
        </div>
        {!q && pinned.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
        {filtered.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            <div className="flex items-center gap-2">
              {item.color && (
                <span
                  className="w-3 h-3 rounded-full border border-slate-300 flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <span className="text-sm">{item.label}</span>
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

export default SearchableSelect;
