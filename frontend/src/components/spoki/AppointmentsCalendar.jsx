import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Calendar, ChevronLeft, ChevronRight, Clock, Check, X as XIcon, Settings as SettingsIcon } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const STATUS_COLORS = {
  proposed: "bg-amber-100 text-amber-800 border-amber-300",
  pending: "bg-blue-100 text-blue-800 border-blue-300",
  confirmed: "bg-green-100 text-green-800 border-green-300",
  canceled: "bg-red-100 text-red-800 border-red-300",
  completed: "bg-slate-200 text-slate-700 border-slate-300",
  no_show: "bg-orange-100 text-orange-800 border-orange-300",
};

const startOfWeek = (d) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};

const fmtDate = (d) => d.toISOString().split("T")[0];

export const AppointmentsCalendar = ({ units = [] }) => {
  const [unitId, setUnitId] = useState(units?.[0]?.id || "");
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calCfg, setCalCfg] = useState(null);
  const [showCfg, setShowCfg] = useState(false);

  const weekDays = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      out.push(d);
    }
    return out;
  }, [weekStart]);

  const fetchAppointments = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (unitId) params.append("unit_id", unitId);
    params.append("date_from", fmtDate(weekStart));
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    params.append("date_to", fmtDate(end));
    try {
      const r = await axios.get(`${API}/calendar/appointments?${params}`, { headers: authHeaders() });
      setAppointments(r.data?.appointments || []);
    } catch (e) {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCalCfg = async () => {
    if (!unitId) return;
    try {
      const r = await axios.get(`${API}/calendar/unit-configs/${unitId}`, { headers: authHeaders() });
      setCalCfg(r.data);
    } catch (e) { setCalCfg(null); }
  };

  useEffect(() => { if (unitId) { fetchAppointments(); fetchCalCfg(); } /* eslint-disable-next-line */ }, [unitId, weekStart]);

  const handleStatusChange = async (appt, newStatus) => {
    try {
      await axios.patch(`${API}/calendar/appointments/${appt.id}`, { status: newStatus }, { headers: authHeaders() });
      fetchAppointments();
    } catch (e) { alert(e?.response?.data?.detail || "Errore"); }
  };

  return (
    <div className="p-6 space-y-4" data-testid="appointments-calendar">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calendar className="w-6 h-6 text-indigo-600" /> Calendario Appuntamenti
        </h1>
        <div className="flex items-center gap-2">
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger className="w-64" data-testid="cal-unit-select">
              <SelectValue placeholder="Seleziona Unit" />
            </SelectTrigger>
            <SelectContent>
              {units?.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome || u.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setShowCfg(!showCfg)} data-testid="cal-config-toggle">
            <SettingsIcon className="w-4 h-4 mr-1" /> Orari
          </Button>
        </div>
      </div>

      {showCfg && calCfg && (
        <CalendarConfigEditor cfg={calCfg} unitId={unitId} onSaved={(c) => { setCalCfg(c); setShowCfg(false); }} />
      )}

      <div className="flex items-center justify-between bg-white border rounded-lg px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }} data-testid="cal-prev-week">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="font-semibold">
          {weekStart.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} – {(() => { const e = new Date(weekStart); e.setDate(e.getDate() + 6); return e.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }); })()}
        </div>
        <Button variant="ghost" size="sm" onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }} data-testid="cal-next-week">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((d, i) => {
          const iso = fmtDate(d);
          const list = appointments.filter((a) => a.appointment_date === iso).sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));
          const isToday = fmtDate(new Date()) === iso;
          return (
            <div key={i} className={`border rounded-lg p-2 min-h-[200px] bg-white ${isToday ? "ring-2 ring-indigo-400" : ""}`} data-testid={`cal-day-${iso}`}>
              <div className="text-xs font-semibold text-slate-500 mb-2">
                {d.toLocaleDateString("it-IT", { weekday: "short" })}<br />
                <span className="text-lg text-slate-800">{d.getDate()}</span>
              </div>
              {loading && <div className="text-xs text-slate-400">…</div>}
              {!loading && list.length === 0 && <div className="text-xs text-slate-300">—</div>}
              {list.map((a) => (
                <div key={a.id} className={`mb-1 p-2 rounded border text-xs ${STATUS_COLORS[a.status] || "bg-slate-50"}`} data-testid={`appt-${a.id}`}>
                  <div className="font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {a.appointment_time}
                  </div>
                  <div>{a.contact_name || "Lead"}</div>
                  <div className="text-[10px] opacity-75">{a.contact_phone}</div>
                  <div className="flex gap-1 mt-1">
                    {a.status !== "confirmed" && (
                      <button onClick={() => handleStatusChange(a, "confirmed")} className="p-1 rounded hover:bg-white/50" title="Conferma" data-testid={`appt-confirm-${a.id}`}>
                        <Check className="w-3 h-3 text-green-700" />
                      </button>
                    )}
                    {a.status !== "canceled" && (
                      <button onClick={() => handleStatusChange(a, "canceled")} className="p-1 rounded hover:bg-white/50" title="Annulla" data-testid={`appt-cancel-${a.id}`}>
                        <XIcon className="w-3 h-3 text-red-700" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="text-xs text-slate-500">Legenda:&nbsp;
        <Badge variant="outline" className="bg-amber-100">Proposto</Badge>&nbsp;
        <Badge variant="outline" className="bg-blue-100">In attesa</Badge>&nbsp;
        <Badge variant="outline" className="bg-green-100">Confermato</Badge>&nbsp;
        <Badge variant="outline" className="bg-red-100">Annullato</Badge>
      </div>
    </div>
  );
};

const WEEKDAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

const CalendarConfigEditor = ({ cfg, unitId, onSaved }) => {
  const [working, setWorking] = useState(cfg.working_hours || []);
  const [slot, setSlot] = useState(cfg.slot_duration_minutes || 30);
  const [saving, setSaving] = useState(false);

  const setForDay = (wd, field, val) => {
    const existing = working.find((h) => h.weekday === wd);
    let next;
    if (existing) {
      next = working.map((h) => (h.weekday === wd ? { ...h, [field]: val } : h));
    } else {
      next = [...working, { weekday: wd, start_time: "09:00", end_time: "18:00", [field]: val }];
    }
    setWorking(next);
  };
  const toggleDay = (wd) => {
    if (working.find((h) => h.weekday === wd)) {
      setWorking(working.filter((h) => h.weekday !== wd));
    } else {
      setWorking([...working, { weekday: wd, start_time: "09:00", end_time: "18:00" }]);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await axios.put(`${API}/calendar/unit-configs/${unitId}`, {
        ...cfg,
        working_hours: working,
        slot_duration_minutes: parseInt(slot, 10) || 30,
      }, { headers: authHeaders() });
      onSaved(r.data);
    } catch (e) {
      alert(e?.response?.data?.detail || "Errore salvataggio");
    } finally { setSaving(false); }
  };

  return (
    <Card data-testid="cal-cfg-editor">
      <CardHeader><CardTitle className="text-lg">Orari di lavoro Unit</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {WEEKDAYS.map((label, wd) => {
          const slot = working.find((h) => h.weekday === wd);
          return (
            <div key={wd} className="flex items-center gap-3">
              <input type="checkbox" checked={!!slot} onChange={() => toggleDay(wd)} data-testid={`cal-day-toggle-${wd}`} />
              <div className="w-24 text-sm">{label}</div>
              {slot && (
                <>
                  <Input type="time" className="w-32" value={slot.start_time} onChange={(e) => setForDay(wd, "start_time", e.target.value)} />
                  <span>–</span>
                  <Input type="time" className="w-32" value={slot.end_time} onChange={(e) => setForDay(wd, "end_time", e.target.value)} />
                </>
              )}
            </div>
          );
        })}
        <div className="flex items-center gap-3">
          <Label>Durata slot (minuti)</Label>
          <Input type="number" className="w-24" min="10" max="240" value={slot} onChange={(e) => setSlot(e.target.value)} />
        </div>
        <Button onClick={save} disabled={saving} data-testid="cal-cfg-save">{saving ? "Salvataggio..." : "Salva orari"}</Button>
      </CardContent>
    </Card>
  );
};

export default AppointmentsCalendar;
