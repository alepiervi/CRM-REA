import React, { useState } from "react";
import axios from "axios";
import { Package, Loader2, CheckCircle2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Inline button to mark a cliente as passed_to_post_vendita.
 * Visible to admin, backoffice_commessa, responsabile_commessa, and the cliente creator/assignee
 * (backend already enforces can_user_access_cliente).
 *
 * Props:
 * - cliente: { id, passed_to_post_vendita, post_vendita_status }
 * - userRole: string (current user role)
 * - onUpdated?: () => void  (callback after success)
 * - size?: 'sm' | 'md'
 */
export const PassToPostVenditaButton = ({ cliente, userRole, onUpdated, size = "md" }) => {
  const [loading, setLoading] = useState(false);
  const [localPassed, setLocalPassed] = useState(!!cliente?.passed_to_post_vendita);
  const [localStatus, setLocalStatus] = useState(cliente?.post_vendita_status || null);

  // Hide for roles that should never trigger this
  const allowedRoles = new Set([
    "admin",
    "backoffice_commessa",
    "responsabile_commessa",
    "responsabile_sub_agenzia",
    "backoffice_sub_agenzia",
    "agente_specializzato",
    "operatore",
    "responsabile_store",
    "responsabile_presidi",
    "store_assist",
    "promoter_presidi",
    "area_manager",
  ]);
  if (!cliente?.id || !allowedRoles.has(userRole)) return null;

  const handleClick = async () => {
    if (localPassed) {
      // Already passed: do nothing
      return;
    }
    if (!window.confirm("Confermi di passare questo cliente al Post Vendita?")) return;
    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/clienti/${cliente.id}/pass-to-post-vendita`,
        {},
        { headers: authHeaders() }
      );
      setLocalPassed(true);
      setLocalStatus(res.data?.post_vendita_status || null);
      if (onUpdated) onUpdated(res.data);
    } catch (e) {
      alert(e?.response?.data?.detail || "Errore: impossibile passare il cliente al Post Vendita");
    } finally {
      setLoading(false);
    }
  };

  const padding = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm";

  if (localPassed) {
    return (
      <div
        className={`inline-flex items-center gap-2 ${padding} rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium`}
        data-testid="pass-to-pv-already"
      >
        <CheckCircle2 className="w-4 h-4" />
        In Post Vendita{localStatus ? ` · ${localStatus}` : ""}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-2 ${padding} rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50 transition-colors`}
      data-testid="pass-to-pv-btn"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
      Passa al Post Vendita
    </button>
  );
};

export default PassToPostVenditaButton;
