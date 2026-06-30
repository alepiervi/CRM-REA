/**
 * Datetime utilities — fix timezone (feb 2026) + fuso orario per-utente (giu 2026)
 *
 * PROBLEMA: il backend salva timestamp in UTC con `datetime.now(timezone.utc)`,
 * ma MongoDB li memorizza come naive datetime. FastAPI serializza la naive datetime
 * in ISO 8601 SENZA suffisso "Z" (es. "2026-02-15T14:30:00").
 * `new Date("2026-02-15T14:30:00")` in JavaScript interpreta la stringa SENZA tz come
 * ora LOCALE del browser, non come UTC. Risultato: orari errati di ±1/2h.
 *
 * FIX: usare sempre questi helper per parsing/format dei timestamp del backend.
 *
 * NEW (giu 2026): il fuso orario di visualizzazione è configurabile per-utente.
 * `setActiveTimezone(tz)` viene chiamato al login/refresh con `user.timezone`.
 * Tutte le funzioni di format usano `getActiveTimezone()` (default "Europe/Rome").
 */

const TZ_REGEX = /([zZ]|[+-]\d{2}:?\d{2})$/;

const DEFAULT_TZ = "Europe/Rome";
let _activeTimezone = DEFAULT_TZ;

/** Imposta il fuso orario attivo per la visualizzazione (IANA, es. "Europe/London"). */
export function setActiveTimezone(tz) {
  if (tz && typeof tz === "string") {
    _activeTimezone = tz;
  }
}

/** Ritorna il fuso orario attivo corrente. */
export function getActiveTimezone() {
  return _activeTimezone || DEFAULT_TZ;
}

/**
 * Parse un timestamp ISO dal backend forzando l'interpretazione come UTC se manca
 * il marker di timezone (Z o +HH:MM). Restituisce un oggetto Date o null.
 */
export function parseBackendDate(iso) {
  if (!iso) return null;
  if (iso instanceof Date) return iso;
  let s = String(iso);
  if (!TZ_REGEX.test(s)) {
    // Aggiungi "Z" per forzare l'interpretazione UTC
    s = s.replace(/(\.\d+)?$/, "Z");
    if (!s.endsWith("Z")) s = s + "Z";
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Format data+ora nel fuso attivo — es. "15/02/2026, 16:30". */
export function formatDateTimeIT(iso, opts = {}) {
  const d = parseBackendDate(iso);
  if (!d) return "";
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: getActiveTimezone(),
    ...opts,
  });
}

/** Format solo data nel fuso attivo — es. "15/02/2026". */
export function formatDateIT(iso, opts = {}) {
  const d = parseBackendDate(iso);
  if (!d) return "";
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: getActiveTimezone(),
    ...opts,
  });
}

/** Format solo ora HH:MM nel fuso attivo — es. "16:30". */
export function formatTimeIT(iso) {
  const d = parseBackendDate(iso);
  if (!d) return "";
  return d.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: getActiveTimezone(),
  });
}

/**
 * Convert a Date (or "today" if omitted) to a `YYYY-MM-DD` string nel fuso attivo,
 * indipendente dal fuso del browser. Utile per inizializzare input <type="date">.
 */
export function todayRomeISO(date) {
  const d = date || new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: getActiveTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
