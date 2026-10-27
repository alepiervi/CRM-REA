import React, { useRef } from "react";
import { Button } from "../../components/ui/button";
import { Paperclip, X } from "lucide-react";

export const FilePicker = ({ files, onChange, testId = "segnalazione-files" }) => {
  const inputRef = useRef(null);
  const add = (e) => {
    onChange([...files, ...Array.from(e.target.files || [])]);
    e.target.value = "";
  };
  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        className="hidden" onChange={add} data-testid={`${testId}-input`} />
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} data-testid={`${testId}-add-btn`}>
        <Paperclip className="w-4 h-4 mr-2" /> Aggiungi documenti o foto
      </Button>
      {files.length > 0 && (
        <ul className="space-y-1" data-testid={`${testId}-list`}>
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between text-sm bg-slate-50 border rounded px-3 py-1.5">
              <span className="truncate">{f.name} <span className="text-slate-400">({Math.ceil(f.size / 1024)} KB)</span></span>
              <button type="button" className="text-slate-400 hover:text-red-600" data-testid={`${testId}-remove-${i}`}
                onClick={() => onChange(files.filter((_, j) => j !== i))}>
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
