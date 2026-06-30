// Dialog impostazioni fuso orario per-utente (giu 2026)
import React, { useState } from "react";
import axios from "axios";
import { Globe } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "../ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../ui/select";
import { useAuth } from "../../context/AuthContext";
import { API } from "../../lib/appUtils";
import { setActiveTimezone } from "../../lib/datetime";
import { useToast } from "../../hooks/use-toast";

// Fusi orari più comuni per le sub-agenzie internazionali
export const TIMEZONE_OPTIONS = [
  { value: "Europe/Rome", label: "🇮🇹 Italia — Roma (CET/CEST)" },
  { value: "Europe/London", label: "🇬🇧 Regno Unito — Londra (GMT/BST)" },
  { value: "Europe/Madrid", label: "🇪🇸 Spagna — Madrid" },
  { value: "Europe/Paris", label: "🇫🇷 Francia — Parigi" },
  { value: "Europe/Berlin", label: "🇩🇪 Germania — Berlino" },
  { value: "Europe/Lisbon", label: "🇵🇹 Portogallo — Lisbona" },
  { value: "Europe/Athens", label: "🇬🇷 Grecia — Atene" },
  { value: "Europe/Bucharest", label: "🇷🇴 Romania — Bucarest" },
  { value: "Europe/Istanbul", label: "🇹🇷 Turchia — Istanbul" },
  { value: "America/New_York", label: "🇺🇸 USA — New York (EST/EDT)" },
  { value: "America/Sao_Paulo", label: "🇧🇷 Brasile — San Paolo" },
  { value: "America/Argentina/Buenos_Aires", label: "🇦🇷 Argentina — Buenos Aires" },
  { value: "Asia/Dubai", label: "🇦🇪 Emirati — Dubai" },
  { value: "Asia/Kolkata", label: "🇮🇳 India — Kolkata" },
];

export const TimezoneSettingsDialog = () => {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(user?.timezone || "Europe/Rome");
  const [saving, setSaving] = useState(false);

  const currentTz = user?.timezone || "Europe/Rome";

  const handleOpenChange = (v) => {
    if (v) setSelected(user?.timezone || "Europe/Rome");
    setOpen(v);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.patch(`${API}/auth/me/timezone`, { timezone: selected });
      const newTz = res.data?.timezone || selected;
      setActiveTimezone(newTz);
      if (setUser && user) setUser({ ...user, timezone: newTz });
      toast({
        title: "✅ Fuso orario aggiornato",
        description: `Le date saranno mostrate in ${newTz}.`,
      });
      setOpen(false);
    } catch (e) {
      toast({
        title: "❌ Errore",
        description: e.response?.data?.detail || "Impossibile aggiornare il fuso orario",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-slate-600 hover:text-blue-600 hover:border-blue-300"
          data-testid="timezone-settings-trigger"
          title="Fuso orario"
        >
          <Globe className="w-4 h-4 mr-2" />
          <span className="hidden lg:inline">Fuso orario</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="timezone-settings-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" /> Fuso orario
          </DialogTitle>
          <DialogDescription>
            Scegli il fuso orario in cui visualizzare date, orari e filtrare per data.
            Attuale: <span className="font-medium">{currentTz}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">
            Seleziona fuso orario
          </label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger data-testid="timezone-select-trigger">
              <SelectValue placeholder="Seleziona fuso orario" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {TIMEZONE_OPTIONS.map((tz) => (
                <SelectItem key={tz.value} value={tz.value} data-testid={`timezone-option-${tz.value}`}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="timezone-cancel-btn">
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={saving || selected === currentTz} data-testid="timezone-save-btn">
            {saving ? "Salvataggio..." : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TimezoneSettingsDialog;
