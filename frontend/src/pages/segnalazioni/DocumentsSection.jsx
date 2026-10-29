import React, { useState } from "react";
import axios from "axios";
import { Button } from "../../components/ui/button";
import { Label } from "../../components/ui/label";
import { useToast } from "../../hooks/use-toast";
import { Download, FileText, Upload } from "lucide-react";
import { FilePicker } from "./FilePicker";
import { API, errMsg, formatDate, uploadDocuments } from "./shared";

export const DocumentsSection = ({ segnalazione, onUploaded, canUpload = true }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const docs = segnalazione.documents || [];

  const upload = async () => {
    setUploading(true);
    const failed = await uploadDocuments(segnalazione.id, files);
    setUploading(false);
    setFiles([]);
    if (failed.length) toast({ title: "Alcuni documenti non sono stati caricati", description: failed.join(" • "), variant: "destructive" });
    else toast({ title: "Documenti caricati su Aruba Drive" });
    onUploaded();
  };

  const download = async (d) => {
    try {
      const res = await axios.get(`${API}/segnalazioni/${segnalazione.id}/documents/${d.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = Object.assign(document.createElement("a"), { href: url, download: d.original_filename });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Errore download", description: errMsg(e, "File non disponibile"), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3" data-testid="segnalazione-documents-section">
      <Label className="font-semibold">Documenti ({docs.length})</Label>
      {docs.length === 0 && <p className="text-sm text-slate-500">Nessun documento caricato.</p>}
      <ul className="space-y-1">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between text-sm border rounded px-3 py-2" data-testid={`segnalazione-doc-${d.id}`}>
            <span className="flex items-center gap-2 truncate"><FileText className="w-4 h-4 text-slate-400 shrink-0" />{d.original_filename}
              <span className="text-xs text-slate-400">{d.uploaded_by} · {formatDate(d.uploaded_at)}</span></span>
            <Button size="sm" variant="ghost" onClick={() => download(d)} data-testid={`segnalazione-doc-download-${d.id}`}><Download className="w-4 h-4" /></Button>
          </li>
        ))}
      </ul>
      {canUpload && <FilePicker files={files} onChange={setFiles} testId="detail-files" />}
      {canUpload && files.length > 0 && (
        <Button size="sm" onClick={upload} disabled={uploading} data-testid="detail-files-upload-btn">
          <Upload className="w-4 h-4 mr-2" />{uploading ? "Caricamento..." : `Carica ${files.length} file`}
        </Button>
      )}
    </div>
  );
};
