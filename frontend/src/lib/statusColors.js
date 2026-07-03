// Colori personalizzati degli status (Cliente + Lead), caricati una volta al login.
// La mappa è: { cliente: {statusValue: hexColor}, lead: {statusIdOrNome: hexColor} }

let _statusColorMap = { cliente: {}, lead: {} };

export function setStatusColorMap(map) {
  if (map && typeof map === "object") {
    _statusColorMap = { cliente: map.cliente || {}, lead: map.lead || {} };
  }
}

export function getStatusColor(scope, key) {
  if (!key) return null;
  return _statusColorMap?.[scope]?.[key] || null;
}

export const getClienteStatusColor = (value) => getStatusColor("cliente", value);
export const getLeadStatusColor = (key) => getStatusColor("lead", key);

// Calcola un colore testo leggibile (bianco/nero) in base alla luminanza dello sfondo
export function contrastText(hex) {
  if (!hex) return "#ffffff";
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return "#ffffff";
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1e293b" : "#ffffff";
}

// Stile inline per un badge dato un colore. null se nessun colore.
export function statusBadgeStyle(color) {
  if (!color) return null;
  return { backgroundColor: color, color: contrastText(color), borderColor: color };
}

// Helper diretto per gli status cliente
export function getClienteStatusStyle(value) {
  return statusBadgeStyle(getClienteStatusColor(value));
}

export function getLeadStatusStyle(key) {
  return statusBadgeStyle(getLeadStatusColor(key));
}
