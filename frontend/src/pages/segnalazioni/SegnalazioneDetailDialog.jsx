import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { EsitoBadge } from "./EsitoBadge";
import { EsitoForm } from "./EsitoForm";
import { AssegnazioneForm } from "./AssegnazioneForm";
import { PresaInCaricoBox } from "./PresaInCaricoBox";
import { DocumentsSection } from "./DocumentsSection";
import { API, ESITO_ROLES, formatDate } from "./shared";

const Field = ({ label, value, testId }) => (
  <div><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="text-sm font-medium break-words" data-testid={testId}>{value || "-"}</p></div>
);

export const SegnalazioneDetailDialog = ({ id, onClose, user, meta, onChanged }) => {
  const [seg, setSeg] = useState(null);
  const load = useCallback(async () => {
    const { data } = await axios.get(`${API}/segnalazioni/${id}`);
    setSeg(data);
  }, [id]);

  useEffect(() => { if (id) load(); else setSeg(null); }, [id, load]);
  const refresh = () => { load(); onChanged(); };
  const canWork = seg && (user.role === "admin" || seg.in_carico_id === user.id);

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="segnalazione-detail-dialog">
        <DialogHeader><DialogTitle>Scheda Segnalazione</DialogTitle></DialogHeader>
        {!seg ? <p className="text-sm text-slate-500">Caricamento...</p> : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome" value={seg.nome} testId="detail-nome" />
              <Field label="Cognome" value={seg.cognome} testId="detail-cognome" />
              <Field label="Telefono" value={seg.telefono} testId="detail-telefono" />
              <Field label="Commessa / Servizio" value={seg.commessa_id ? `${seg.commessa_nome} · ${seg.servizio_nome}` : "Da assegnare"} testId="detail-commessa" />
              <Field label="Segnalato da" value={`${seg.created_by_username} · ${formatDate(seg.created_at)}`} testId="detail-created-by" />
              <div><p className="text-xs uppercase tracking-wide text-slate-500">Esito attuale</p><EsitoBadge esito={seg.esito} sottoEsiti={seg.sotto_esiti} testId="detail-esito-badge" /></div>
            </div>
            <Field label="Note" value={seg.note} testId="detail-note" />
            {seg.nota_esito && <Field label={`Nota esito (${seg.esito_by || ""})`} value={seg.nota_esito} testId="detail-nota-esito" />}
            {ESITO_ROLES.includes(user.role) && (
              <PresaInCaricoBox segnalazione={seg} user={user} onChanged={refresh} />
            )}
            {ESITO_ROLES.includes(user.role) && canWork && (
              <AssegnazioneForm key={`a-${seg.updated_at}`} segnalazione={seg} options={meta.commesse} onSaved={refresh} />
            )}
            {ESITO_ROLES.includes(user.role) && canWork && (
              <EsitoForm key={seg.updated_at} segnalazione={seg} esiti={meta.esiti} sottoEsitiOk={meta.sotto_esiti_ok} onSaved={refresh} />
            )}
            <DocumentsSection segnalazione={seg} onUploaded={refresh} />
            {seg.esito_history?.length > 0 && (
              <div data-testid="esito-history">
                <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Storico esiti</p>
                {seg.esito_history.slice().reverse().map((h, i) => (
                  <p key={i} className="text-xs text-slate-600">{formatDate(h.at)} · {h.by_username} → <b>{h.esito}</b>{h.sotto_esiti.length ? ` (${h.sotto_esiti.join(", ")})` : ""}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
