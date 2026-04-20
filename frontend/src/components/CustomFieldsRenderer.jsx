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
 * Hook to fetch custom fields for a given (commessa_id, tipologia_contratto_id)
 */
export function useClienteCustomFields(commessaId, tipologiaId) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!commessaId || !tipologiaId) {
      setFields([]);
      return;
    }
    setLoading(true);
    axios
      .get(`${API}/cliente-custom-fields`, {
        params: { commessa_id: commessaId, tipologia_contratto_id: tipologiaId, active_only: true },
        headers: authHeaders(),
      })
      .then((res) => setFields(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error("Error loading custom fields:", err);
        setFields([]);
      })
      .finally(() => setLoading(false));
  }, [commessaId, tipologiaId]);

  return { fields, loading };
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
        <select
          {...commonProps}
          className="w-full p-2 border border-gray-300 rounded-lg bg-white"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Seleziona...</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
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
          <Checkbox
            id={`cf-${field.id}`}
            checked={!!value}
            onCheckedChange={(v) => onChange(!!v)}
            disabled={disabled}
            data-testid={`custom-field-input-${field.name}`}
          />
          <Label htmlFor={`cf-${field.id}`} className="cursor-pointer text-sm">
            {field.label}
          </Label>
        </div>
      );
    case "text":
    default:
      return <Input {...commonProps} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  }
}

/**
 * Renders a full section of custom fields in a grid.
 * `values` is an object { [field.name]: value }.
 * `onChangeField(name, value)` is called when a field value changes.
 */
export function CustomFieldsSection({ fields, values, onChangeField, disabled = false, title = "Campi Aggiuntivi" }) {
  if (!fields || fields.length === 0) return null;

  return (
    <div className="bg-indigo-50/50 border border-indigo-200 rounded-lg p-4 space-y-4" data-testid="custom-fields-section">
      <h4 className="font-semibold text-indigo-900 flex items-center gap-2">
        📝 {title}
        <span className="text-xs font-normal text-indigo-700">({fields.length} campo/i)</span>
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((f) => (
          <div key={f.id} className={f.field_type === "textarea" ? "md:col-span-2" : ""}>
            {f.field_type !== "checkbox" && (
              <Label htmlFor={`cf-${f.id}`}>
                {f.label}
                {f.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
            )}
            <CustomFieldInput
              field={f}
              value={values?.[f.name]}
              onChange={(v) => onChangeField(f.name, v)}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Renders read-only values for the View modal.
 */
export function CustomFieldsViewSection({ fields, values, title = "Campi Aggiuntivi" }) {
  if (!fields || fields.length === 0) return null;
  return (
    <div className="bg-indigo-50/50 border border-indigo-200 rounded-lg p-4 space-y-3" data-testid="custom-fields-view-section">
      <h4 className="font-semibold text-indigo-900">📝 {title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map((f) => {
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
}

/**
 * Validate required custom fields. Returns list of missing labels.
 */
export function validateRequiredCustomFields(fields, values) {
  const missing = [];
  (fields || []).forEach((f) => {
    if (!f.required) return;
    const v = values?.[f.name];
    if (
      v === undefined ||
      v === null ||
      v === "" ||
      (Array.isArray(v) && v.length === 0) ||
      (f.field_type === "checkbox" && v === false)
    ) {
      if (f.field_type !== "checkbox") missing.push(f.label);
      else missing.push(f.label);
    }
  });
  return missing;
}
