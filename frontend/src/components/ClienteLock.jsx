import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import { Lock, Unlock, AlertTriangle } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Hook per gestire il lucchetto (lock) su una scheda Cliente.
 * - Acquisisce il lock al mount.
 * - Invia heartbeat ogni 4 min (timeout backend = 10 min).
 * - Rilascia il lock all'unmount.
 *
 * @param {string} clienteId - id del cliente
 * @param {boolean} enabled - se false non fa nulla (utile per modal non aperti)
 * @returns {{ loading, lockStatus, forceRelease }}
 *   lockStatus: null | { owned_by_me: true } | { owned_by_me: false, locked_by: { user_id, username }, locked_at }
 */
export const useClienteLock = (clienteId, enabled = true) => {
  const [loading, setLoading] = useState(true);
  const [lockStatus, setLockStatus] = useState(null);
  const [error, setError] = useState(null);
  const heartbeatIntervalRef = useRef(null);
  const ownedRef = useRef(false);

  const acquire = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post(
        `${API}/clienti/${clienteId}/lock`,
        {},
        { headers: authHeaders(), validateStatus: (s) => s < 500 }
      );
      if (res.status === 200 && res.data?.owned_by_me) {
        ownedRef.current = true;
        setLockStatus({ owned_by_me: true, ...res.data });
      } else if (res.status === 409) {
        ownedRef.current = false;
        setLockStatus({
          owned_by_me: false,
          locked_by: res.data?.locked_by,
          locked_at: res.data?.locked_at,
          expires_at: res.data?.expires_at,
          message: res.data?.message,
        });
      } else {
        setError(res.data?.detail || `Errore ${res.status}`);
      }
    } catch (e) {
      setError(e?.message || "Errore rete");
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  const release = useCallback(async () => {
    if (!clienteId || !ownedRef.current) return;
    try {
      await axios.delete(`${API}/clienti/${clienteId}/lock`, {
        headers: authHeaders(),
      });
    } catch (_) {
      /* silenzioso: potrebbe essere già scaduto */
    }
    ownedRef.current = false;
  }, [clienteId]);

  const heartbeat = useCallback(async () => {
    if (!clienteId || !ownedRef.current) return;
    try {
      const res = await axios.post(
        `${API}/clienti/${clienteId}/lock/heartbeat`,
        {},
        { headers: authHeaders(), validateStatus: (s) => s < 500 }
      );
      if (res.status === 409) {
        // Qualcuno ha preso il lock (es. admin ha forzato)
        ownedRef.current = false;
        setLockStatus({
          owned_by_me: false,
          locked_by: res.data?.locked_by,
          message: res.data?.message || "Lock perso",
        });
      }
    } catch (_) {
      /* ignore network errors */
    }
  }, [clienteId]);

  const forceRelease = useCallback(async () => {
    if (!clienteId) return false;
    try {
      await axios.post(
        `${API}/clienti/${clienteId}/lock/force-release`,
        {},
        { headers: authHeaders() }
      );
      await acquire();
      return true;
    } catch (e) {
      setError(e?.response?.data?.detail || "Force release fallito");
      return false;
    }
  }, [clienteId, acquire]);

  useEffect(() => {
    if (!enabled || !clienteId) {
      setLoading(false);
      return () => {};
    }
    acquire();

    // heartbeat every 4 minutes
    heartbeatIntervalRef.current = setInterval(heartbeat, 4 * 60 * 1000);

    // release on tab close / page unload
    const onBeforeUnload = () => {
      if (ownedRef.current) {
        const token = localStorage.getItem("token");
        const url = `${API}/clienti/${clienteId}/lock`;
        // sendBeacon doesn't support DELETE; use fetch keepalive
        try {
          fetch(url, {
            method: "DELETE",
            keepalive: true,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
        } catch (_) { /* ignore */ }
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      clearInterval(heartbeatIntervalRef.current);
      window.removeEventListener("beforeunload", onBeforeUnload);
      release();
    };
  }, [clienteId, enabled]); // eslint-disable-line

  return { loading, lockStatus, error, forceRelease, refresh: acquire };
};

/**
 * Schermo da mostrare quando il Cliente è in lock da un altro utente.
 * Mostra chi lo sta usando, ora, e (se admin) pulsante force unlock.
 */
export const ClienteLockedScreen = ({ lockStatus, isAdmin, onForceRelease, onClose }) => {
  if (!lockStatus) return null;
  const username = lockStatus.locked_by?.username || "utente sconosciuto";
  let timeString = "";
  if (lockStatus.locked_at) {
    try {
      const d = new Date(lockStatus.locked_at);
      timeString = d.toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_) { /* noop */ }
  }

  return (
    <div
      className="flex flex-col items-center justify-center p-10 text-center space-y-4"
      data-testid="cliente-locked-screen"
    >
      <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
        <Lock className="w-10 h-10 text-amber-700" />
      </div>
      <h3 className="text-2xl font-bold text-slate-800">Scheda in lavorazione</h3>
      <p className="text-slate-600 max-w-md">
        Questa anagrafica cliente è attualmente aperta da{" "}
        <span className="font-semibold text-amber-700" data-testid="locked-by-username">
          {username}
        </span>
        {timeString && (
          <>
            {" "}dalle{" "}
            <span className="font-mono text-sm">{timeString}</span>
          </>
        )}
        . Non puoi entrare finché non viene rilasciata.
      </p>
      <p className="text-xs text-slate-500 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Il lock scade automaticamente dopo 10 minuti di inattività.
      </p>
      <div className="flex gap-3 mt-4">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-800 font-medium"
          data-testid="locked-close-btn"
        >
          Chiudi
        </button>
        {isAdmin && (
          <button
            onClick={onForceRelease}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium flex items-center gap-2"
            data-testid="locked-force-release-btn"
            title="Solo Admin: forza rilascio del lock"
          >
            <Unlock className="w-4 h-4" />
            Forza sblocco (Admin)
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Hook per listare tutti i lock attivi. Usato nella lista Clienti per mostrare il badge 🔒.
 * Fa polling ogni 30 secondi.
 */
export const useActiveClienteLocks = () => {
  const [locksByClienteId, setLocksByClienteId] = useState({});

  const fetchLocks = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/cliente-locks`, { headers: authHeaders() });
      const map = {};
      (res.data?.locks || []).forEach((l) => {
        map[l.cliente_id] = l;
      });
      setLocksByClienteId(map);
    } catch (_) { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchLocks();
    const id = setInterval(fetchLocks, 10000); // polling ogni 10s
    const onFocus = () => fetchLocks();
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchLocks();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchLocks]);

  return { locksByClienteId, refresh: fetchLocks };
};
