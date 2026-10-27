import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const ESITO_STYLES = {
  OK: "bg-emerald-100 text-emerald-800 border-emerald-200",
  KO: "bg-red-100 text-red-800 border-red-200",
  NR: "bg-amber-100 text-amber-800 border-amber-200",
};

export const ESITO_ROLES = ["admin", "responsabile_commessa", "backoffice_commessa"];

export const errMsg = (e, fallback) => e?.response?.data?.detail || fallback;

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "-";

export async function uploadDocuments(segnalazioneId, files) {
  const failed = [];
  for (const f of files) {
    const fd = new FormData();
    fd.append("file", f);
    try {
      await axios.post(`${API}/segnalazioni/${segnalazioneId}/documents`, fd);
    } catch (e) {
      failed.push(`${f.name}: ${errMsg(e, "errore")}`);
    }
  }
  return failed;
}
