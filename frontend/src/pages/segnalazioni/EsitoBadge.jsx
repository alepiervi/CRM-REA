import React from "react";
import { Badge } from "../../components/ui/badge";
import { ESITO_STYLES } from "./shared";

export const EsitoBadge = ({ esito, sottoEsiti = [], testId }) => (
  <div className="flex flex-wrap items-center gap-1" data-testid={testId}>
    {esito ? (
      <Badge variant="outline" className={`${ESITO_STYLES[esito]} font-semibold`}>{esito}</Badge>
    ) : (
      <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">Da lavorare</Badge>
    )}
    {sottoEsiti.map((s) => (
      <Badge key={s} variant="outline" className="bg-white text-emerald-700 border-emerald-200 text-[11px]">{s}</Badge>
    ))}
  </div>
);
