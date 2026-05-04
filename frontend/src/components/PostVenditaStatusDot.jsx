import React from "react";

/**
 * Pallino colorato accanto allo status del cliente che riflette lo stage
 * del workflow Post Vendita corrente:
 *   - lavorazione (giallo): cliente in lavorazione, lo status anagrafica NON è cambiato
 *   - attivato (verde):     esito finale → cliente.status="attivato"
 *   - ko (rosso):           esito finale → cliente.status="ko"
 *
 * Tooltip al passaggio del mouse: mostra l'esito/etichetta dello status PV
 * (proveniente da `post_vendita_status_label`, fallback `post_vendita_status`).
 *
 * Non mostra nulla se il cliente non è ancora in post-vendita.
 *
 * Props:
 *  - cliente: { post_vendita_stage?, post_vendita_status_label?, post_vendita_status?, passed_to_post_vendita? }
 *  - size?: 'sm' | 'md'
 */
export const PostVenditaStatusDot = ({ cliente, size = "sm" }) => {
  if (!cliente) return null;
  const stage = cliente.post_vendita_stage;
  const passed = cliente.passed_to_post_vendita;
  if (!stage && !passed) return null;
  if (!stage) return null;

  const config = {
    lavorazione: {
      bg: "bg-amber-400",
      ring: "ring-amber-200",
      label: "In Lavorazione",
    },
    attivato: {
      bg: "bg-emerald-500",
      ring: "ring-emerald-200",
      label: "Attivato",
    },
    ko: {
      bg: "bg-red-500",
      ring: "ring-red-200",
      label: "KO",
    },
  }[stage];

  if (!config) return null;

  const dim = size === "md" ? "w-3.5 h-3.5" : "w-2.5 h-2.5";
  const pvLabel = cliente.post_vendita_status_label || cliente.post_vendita_status || config.label;
  const tooltipText =
    stage === "lavorazione"
      ? `In lavorazione — ${pvLabel}`
      : `Esito Post Vendita: ${pvLabel}`;

  return (
    <span
      className="relative inline-flex items-center group ml-1.5 align-middle"
      data-testid={`pv-status-dot-${stage}`}
    >
      <span
        className={`inline-block ${dim} rounded-full ${config.bg} ring-2 ${config.ring} ${stage === "lavorazione" ? "animate-pulse" : ""}`}
        title={tooltipText}
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 z-50"
      >
        {tooltipText}
      </span>
    </span>
  );
};

export default PostVenditaStatusDot;
