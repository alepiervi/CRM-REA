import React, { useEffect, useState } from "react";
import axios from "axios";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Fetches combined standard + custom status options for a given (commessa_id, tipologia_contratto_id).
 */
export function useClienteStatusOptions(commessaId, tipologiaId) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (commessaId) params.commessa_id = commessaId;
    if (tipologiaId) params.tipologia_contratto_id = tipologiaId;
    axios
      .get(`${API}/cliente-status-options`, { params, headers: authHeaders() })
      .then((res) => setOptions(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error("Error loading status options:", err);
        setOptions([]);
      })
      .finally(() => setLoading(false));
  }, [commessaId, tipologiaId]);

  return { options, loading };
}

/**
 * Fetches BOTH custom fields and custom sections for a given (commessa_id, tipologia_contratto_id).
 */
export function useClienteCustomFields(commessaId, tipologiaId) {
  const [fields, setFields] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!commessaId || !tipologiaId) {
      setFields([]);
      setSections([]);
      return;
    }
    setLoading(true);
    const params = { commessa_id: commessaId, tipologia_contratto_id: tipologiaId, active_only: true };
    Promise.all([
      axios.get(`${API}/cliente-custom-fields`, { params, headers: authHeaders() }),
      axios.get(`${API}/cliente-custom-sections`, { params, headers: authHeaders() }),
    ])
      .then(([fRes, sRes]) => {
        setFields(Array.isArray(fRes.data) ? fRes.data : []);
        setSections(Array.isArray(sRes.data) ? sRes.data : []);
      })
      .catch((err) => {
        console.error("Error loading custom fields/sections:", err);
        setFields([]);
        setSections([]);
      })
      .finally(() => setLoading(false));
  }, [commessaId, tipologiaId]);

  return { fields, sections, loading };
}

/**
 * Renders a single custom field input based on its field_type.
 */
export function CustomFieldInput({ field, value, onChange, disabled = false }) {
  const commonProps = {
    id: `cf-${field.id}`,
    placeholder: field.placeholder || "",
    disabled,
    "data-testid": `custom-field-input-${field.name}`,
  };
  switch (field.field_type) {
    case "textarea":
      return <Textarea {...commonProps} value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3} />;
    case "number":
      return <Input {...commonProps} type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <Input {...commonProps} type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    case "email":
      return <Input {...commonProps} type="email" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    case "phone":
      return <Input {...commonProps} type="tel" value={value || ""} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <select {...commonProps} className="w-full p-2 border border-gray-300 rounded-lg bg-white" value={value || ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Seleziona...</option>
          {(field.options || []).map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
        </select>
      );
    case "multi_select": {
      const arr = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-1 border border-gray-200 rounded-lg p-2">
          {(field.options || []).map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={arr.includes(opt)}
                onCheckedChange={(checked) => {
                  if (checked) onChange([...arr, opt]);
                  else onChange(arr.filter((x) => x !== opt));
                }}
                disabled={disabled}
                data-testid={`custom-field-option-${field.name}-${opt}`}
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      );
    }
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox id={`cf-${field.id}`} checked={!!value} onCheckedChange={(v) => onChange(!!v)} disabled={disabled} data-testid={`custom-field-input-${field.name}`} />
          <Label htmlFor={`cf-${field.id}`} className="cursor-pointer text-sm">{field.label}</Label>
        </div>
      );
    case "text":
    default:
      return <Input {...commonProps} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

/**
 * Groups fields by section (and a "default" group for fields without section_id).
 * Returns an array of { section, fields } ordered by section.order then default last.
 */
function groupFieldsBySection(fields, sections) {
  const sectionMap = new Map();
  sections.forEach((s) => sectionMap.set(s.id, { section: s, fields: [] }));
  const defaultGroup = { section: null, fields: [] };

  fields.forEach((f) => {
    if (f.section_id && sectionMap.has(f.section_id)) {
      sectionMap.get(f.section_id).fields.push(f);
    } else {
      defaultGroup.fields.push(f);
    }
  });

  const groups = Array.from(sectionMap.values()).filter((g) => g.fields.length > 0);
  groups.sort((a, b) => (a.section?.order ?? 0) - (b.section?.order ?? 0));
  if (defaultGroup.fields.length > 0) groups.push(defaultGroup);
  return groups;
}

/**
 * Renders all custom fields grouped by section.
 * Props: fields (array), sections (array), values (object), onChangeField(name, value).
 */
export function CustomFieldsSection({ fields, sections = [], values, onChangeField, disabled = false }) {
  if (!fields || fields.length === 0) return null;
  const groups = groupFieldsBySection(fields, sections);

  return (
    <div className="space-y-4" data-testid="custom-fields-section">
      {groups.map((group, gIdx) => {
        const title = group.section ? `${group.section.icon || "📋"} ${group.section.name}` : "📝 Campi Aggiuntivi";
        const colorClass = group.section ? "bg-indigo-50/70 border-indigo-300" : "bg-amber-50/70 border-amber-300";
        return (
          <div key={group.section?.id || `default-${gIdx}`} className={`border rounded-lg p-4 space-y-4 ${colorClass}`} data-testid={group.section ? `custom-section-${group.section.id}` : "custom-section-default"}>
            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
              {title}
              <span className="text-xs font-normal text-slate-600">({group.fields.length} campo/i)</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {group.fields.map((f) => (
                <div key={f.id} className={f.field_type === "textarea" ? "md:col-span-2" : ""}>
                  {f.field_type !== "checkbox" && (
                    <Label htmlFor={`cf-${f.id}`}>
                      {f.label}
                      {f.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                  )}
                  <CustomFieldInput field={f} value={values?.[f.name]} onChange={(v) => onChangeField(f.name, v)} disabled={disabled} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Renders readonly fields grouped by section for View modal.
 */
export function CustomFieldsViewSection({ fields, sections = [], values }) {
  if (!fields || fields.length === 0) return null;
  const groups = groupFieldsBySection(fields, sections);

  return (
    <div className="space-y-4" data-testid="custom-fields-view-section">
      {groups.map((group, gIdx) => {
        const title = group.section ? `${group.section.icon || "📋"} ${group.section.name}` : "📝 Campi Aggiuntivi";
        const colorClass = group.section ? "bg-indigo-50/70 border-indigo-300" : "bg-amber-50/70 border-amber-300";
        return (
          <div key={group.section?.id || `default-${gIdx}`} className={`border rounded-lg p-4 space-y-3 ${colorClass}`}>
            <h4 className="font-semibold text-slate-900">{title}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {group.fields.map((f) => {
                const v = values?.[f.name];
                let display = "Non specificato";
                if (v !== undefined && v !== null && v !== "") {
                  if (f.field_type === "checkbox") display = v ? "Sì" : "No";
                  else if (f.field_type === "multi_select" && Array.isArray(v)) display = v.length ? v.join(", ") : "Non specificato";
                  else display = String(v);
                }
                return (
                  <div key={f.id}>
                    <Label className="text-sm font-medium text-slate-600">{f.label}</Label>
                    <p className="text-sm" data-testid={`custom-field-view-${f.name}`}>{display}</p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Validate required custom fields. Returns list of missing labels.
 */
export function validateRequiredCustomFields(fields, values) {
  const missing = [];
  (fields || []).forEach((f) => {
    if (!f.required) return;
    const v = values?.[f.name];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (f.field_type === "checkbox" && v === false)) {
      missing.push(f.label);
    }
  });
  return missing;
}
