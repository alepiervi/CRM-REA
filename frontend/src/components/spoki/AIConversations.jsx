import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Send, Bot, User as UserIcon, Phone, RefreshCw, MessageCircle, Search, PauseCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const senderMeta = (m) => {
  if (m.direction === "inbound") return { label: "Cliente", icon: UserIcon, color: "bg-slate-100 text-slate-800", side: "left" };
  if (m.sender === "bot") return { label: "Bot AI", icon: Bot, color: "bg-indigo-100 text-indigo-800", side: "right" };
  if (m.sender === "admin") return { label: "Operatore", icon: UserIcon, color: "bg-blue-100 text-blue-800", side: "right" };
  return { label: "Sistema", icon: MessageCircle, color: "bg-green-100 text-green-800", side: "right" };
};

const botBadge = (session) => {
  if (!session || !session.activated_by_workflow) return <Badge variant="secondary" className="text-[10px]">Bot non attivato</Badge>;
  if (session.bot_paused) return <Badge className="bg-amber-500 text-[10px]">Bot in pausa</Badge>;
  return <Badge className="bg-green-600 text-[10px]">Bot attivo</Badge>;
};

const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
};

export const AIConversations = () => {
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null); // lead_id
  const [detail, setDetail] = useState({ messages: [], chatbot_session: null });
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [toggling, setToggling] = useState(false);
  const scrollRef = useRef(null);
  const selectedRef = useRef(null);
  selectedRef.current = selected;

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const r = await axios.get(`${API}/spoki/conversations`, { headers: authHeaders() });
      setConversations(r.data?.conversations || []);
    } catch (e) { /* silenzioso in polling */ }
    finally { setLoadingList(false); }
  }, []);

  const fetchDetail = useCallback(async (leadId) => {
    if (!leadId) return;
    try {
      const r = await axios.get(`${API}/spoki/conversations/${leadId}`, { headers: authHeaders() });
      setDetail(r.data);
    } catch (e) {
      setDetail({ messages: [], chatbot_session: null });
    }
  }, []);

  // Polling "tempo reale" ogni 8s
  useEffect(() => {
    fetchList();
    const t = setInterval(() => {
      fetchList();
      if (selectedRef.current) fetchDetail(selectedRef.current);
    }, 8000);
    return () => clearInterval(t);
  }, [fetchList, fetchDetail]);

  useEffect(() => { if (selected) fetchDetail(selected); }, [selected, fetchDetail]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [detail.messages?.length, selected]);

  const handleSend = async () => {
    const text = body.trim();
    if (!text || !selected) return;
    setSending(true);
    try {
      await axios.post(`${API}/spoki/conversations/${selected}/send`, { body: text }, { headers: authHeaders() });
      setBody("");
      fetchDetail(selected);
      fetchList();
    } catch (e) {
      alert(e?.response?.data?.detail || "Errore invio");
    } finally { setSending(false); }
  };

  const handleToggleBot = async (active) => {
    if (!selected) return;
    setToggling(true);
    try {
      const r = await axios.post(`${API}/spoki/conversations/${selected}/toggle-bot`, { paused: !active }, { headers: authHeaders() });
      setDetail((d) => ({ ...d, chatbot_session: r.data?.session || d.chatbot_session }));
      fetchList();
    } catch (e) {
      alert(e?.response?.data?.detail || "Errore");
    } finally { setToggling(false); }
  };

  const q = search.toLowerCase();
  const filtered = conversations.filter((c) =>
    !q || (c.lead_name || "").toLowerCase().includes(q) || (c.phone || "").includes(q) || (c.unit_label || "").toLowerCase().includes(q)
  );
  const current = conversations.find((c) => c.lead_id === selected);
  const session = detail.chatbot_session;
  const botActive = !!(session && session.activated_by_workflow && !session.bot_paused);

  return (
    <div className="p-6 h-[calc(100vh-80px)] flex flex-col" data-testid="ai-conversations-page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="w-6 h-6 text-indigo-600" /> Conversazioni AI
        </h1>
        <Button variant="outline" size="sm" onClick={() => { fetchList(); if (selected) fetchDetail(selected); }} data-testid="ai-conv-refresh">
          <RefreshCw className={`w-4 h-4 mr-1 ${loadingList ? "animate-spin" : ""}`} /> Aggiorna
        </Button>
      </div>

      <div className="flex-1 flex gap-4 min-h-0 border rounded-lg bg-white overflow-hidden">
        {/* Lista conversazioni */}
        <div className="w-96 border-r flex flex-col min-h-0">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                className="pl-8"
                placeholder="Cerca lead, telefono, unit..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="ai-conv-search"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="text-center text-sm text-slate-400 py-12 px-4">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Nessuna conversazione WhatsApp ancora.
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.lead_id}
                onClick={() => setSelected(c.lead_id)}
                className={`w-full text-left px-3 py-2.5 border-b hover:bg-slate-50 transition-colors ${selected === c.lead_id ? "bg-indigo-50 border-l-2 border-l-indigo-500" : ""}`}
                data-testid={`ai-conv-item-${c.lead_id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{c.lead_name}</span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{fmtTime(c.last_message?.created_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-slate-500 truncate">
                    {c.last_message?.direction === "inbound" ? "↩ " : "↪ "}
                    {c.last_message?.body || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  {botBadge(c.session)}
                  {c.unit_label && <Badge variant="outline" className="text-[10px]">{c.unit_label}</Badge>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Pannello chat */}
        <div className="flex-1 flex flex-col min-h-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              <div className="text-center">
                <Bot className="w-10 h-10 mx-auto mb-2 opacity-30" />
                Seleziona una conversazione per supervisionare il bot
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-slate-50">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate flex items-center gap-2">
                    {current?.lead_name || selected}
                    {current?.phone && <span className="text-xs text-slate-500 font-normal flex items-center gap-1"><Phone className="w-3 h-3" />{current.phone}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {botBadge(session)}
                    {session?.status && <Badge variant="outline" className="text-[10px]">{session.status} • score {session.qualification_score || 0}</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <PauseCircle className={`w-4 h-4 ${botActive ? "text-slate-300" : "text-amber-500"}`} />
                  <Switch
                    checked={botActive}
                    disabled={toggling}
                    onCheckedChange={handleToggleBot}
                    data-testid="ai-conv-bot-toggle"
                  />
                  <span className="text-xs text-slate-600 w-16">{botActive ? "Bot attivo" : "Bot fermo"}</span>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/30">
                {detail.messages?.map((m) => {
                  const meta = senderMeta(m);
                  const Icon = meta.icon;
                  return (
                    <div key={m.id} className={`flex ${meta.side === "right" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${meta.color} border`}>
                        <div className="flex items-center gap-1 text-[10px] opacity-70 mb-0.5">
                          <Icon className="w-3 h-3" /> {meta.label}
                          {m.template_name && <span> • template: <code>{m.template_name}</code></span>}
                          {m.status && <span> • {m.status}</span>}
                        </div>
                        <div className="whitespace-pre-wrap break-words">
                          {m.body || (m.template_name ? `[Template: ${m.template_name}]` : "—")}
                        </div>
                        <div className="text-[10px] opacity-50 mt-0.5">
                          {m.created_at && new Date(m.created_at).toLocaleString("it-IT")}
                        </div>
                        {m.error && <div className="text-[10px] text-red-700 mt-1">⚠ {m.error}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t p-3 bg-white flex gap-2">
                <Input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={botActive ? "Intervieni manualmente (consiglio: metti prima il bot in pausa)..." : "Scrivi al cliente come operatore..."}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  data-testid="ai-conv-input"
                />
                <Button onClick={handleSend} disabled={sending || !body.trim()} data-testid="ai-conv-send">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIConversations;
