import React from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Calendar } from "../../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";

const fmt = (d) => format(d, "dd/MM/yyyy", { locale: it });

export const DateRangeFilter = ({ value, onChange }) => {
  const label = value?.from ? (value.to ? `${fmt(value.from)} - ${fmt(value.to)}` : `Dal ${fmt(value.from)}`) : "Data: Da - A";
  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-start font-normal sm:w-60" data-testid="segnalazioni-date-filter">
            <CalendarDays className="w-4 h-4 mr-2 text-slate-500" />
            <span className={value?.from ? "" : "text-slate-500"}>{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar mode="range" selected={value} onSelect={(r) => onChange(r || undefined)} numberOfMonths={2} locale={it} initialFocus data-testid="segnalazioni-date-calendar" />
        </PopoverContent>
      </Popover>
      {value?.from && (
        <Button variant="ghost" size="icon" onClick={() => onChange(undefined)} data-testid="segnalazioni-date-clear-btn" title="Rimuovi filtro data">
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
};
