import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Send, Bot, User as UserIcon, Phone, RefreshCw, MessageCircle } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const senderMeta = (m) => {
  if (m.direction === "inbound") return { label: "Cliente", icon: UserIcon, color: "bg-slate-100 text-slate-800", side: "left" };
  if (m.sender === "bot") return { label: "Bot", icon: Bot, color: "bg-indigo-100 text-indigo-800", side: "right" };
  if (m.sender === "admin") return { label: "Admin", icon: UserIcon, color: "bg-blue-100 text-blue-800", side: "right" };
  return { label: "Sistema", icon: MessageCircle, color: "bg-green-100 text-green-800", side: "right" };
};

export const LeadConversationsTab = ({ leadId }) => {
  const [data, setData] = useState({ messages: [], chatbot_session: null });
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const fetchData = async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/spoki/conversations/${leadId}`, { headers: authHeaders() });
      setData(r.data);
    } catch (e) {
      setData({ messages: [], chatbot_session: null, error: e?.response?.data?.detail || e.message });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [leadId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [data.messages?.length]);

  const handleSend = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await axios.post(`${API}/spoki/conversations/${leadId}/send`, { body: text }, { headers: authHeaders() });
      setBody("");
      fetchData();
    } catch (e) {
      alert(e?.response?.data?.detail || "Errore invio");
    } finally { setSending(false); }
  };

  const session = data.chatbot_session;

  return (
    <div className="flex flex-col h-full" data-testid="lead-conv-tab">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-50">
        <div className="flex items-center gap-2 text-sm">
          <MessageCircle className="w-4 h-4 text-green-600" />
          <strong>Conversazione WhatsApp</strong>
          {session && (
            <Badge variant="outline" className="ml-2">
              {session.status} • score {session.qualification_score || 0}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} data-testid="lead-conv-refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/30 min-h-[300px] max-h-[500px]">
        {(!data.messages || data.messages.length === 0) && !loading && (
          <div className="text-center text-sm text-slate-400 py-12">
            <Phone className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Nessuna conversazione WhatsApp ancora. <br />Il messaggio di benvenuto parte automaticamente alla creazione del lead.
          </div>
        )}
        {data.messages?.map((m) => {
          const meta = senderMeta(m);
          const Icon = meta.icon;
          return (
            <div key={m.id} className={`flex ${meta.side === "right" ? "justify-end" : "justify-start"}`} data-testid={`msg-${m.id}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${meta.color} border`}>
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

      <div className="border-t p-2 bg-white flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Scrivi un messaggio (finestra 24h dopo ultima risposta cliente)..."
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          data-testid="lead-conv-input"
        />
        <Button onClick={handleSend} disabled={sending || !body.trim()} data-testid="lead-conv-send">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default LeadConversationsTab;
