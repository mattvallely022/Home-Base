import { useState, useEffect, useMemo } from "react";
import {
  Plus, X, TrendingUp, Calendar, Clock, ChevronDown, ChevronUp, Trash2,
  ClipboardPaste, Check, AlertCircle, Pencil, Download, Copy,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

// ---------- constants ----------

const ENTRY_TYPES = [
  { id: "meal", label: "Meal" },
  { id: "symptom", label: "Symptom check-in" },
  { id: "bowel", label: "Bowel movement" },
  { id: "observation", label: "Observation / Reflection" },
  { id: "quiet", label: "Quiet day" },
];

const FIELD_TYPES = {
  scale: { label: "Scale (0–10)" },
  bristol: { label: "Bristol stool scale (1–7)" },
  select: { label: "Choice" },
  multiselect: { label: "Choice (select multiple)" },
  boolean: { label: "Yes / No" },
  text: { label: "Short note" },
  list: { label: "List (multiple items)" },
};

// every field declares which entry type(s) it shows up on via `types: [entryTypeId...]`
const DEFAULT_SCHEMA = [
  {
    id: "mealType", label: "Meal", type: "select",
    options: ["breakfast", "lunch", "dinner", "snack"],
    types: ["meal"], builtin: true, active: true, aliases: ["meal", "ate"], allowCustom: true,
  },
  {
    id: "mealFat", label: "Fat level", type: "select",
    options: ["none", "low", "medium", "high"],
    types: ["meal"], builtin: true, active: true, aliases: ["fat", "fat level", "meal fat"],
  },
  {
    id: "foods", label: "Foods", type: "list",
    types: ["meal"], builtin: true, active: true, aliases: ["food", "foods", "items"],
  },
  {
    id: "timing", label: "Timing", type: "select",
    options: ["waking up", "after breakfast", "before lunch", "after lunch", "before dinner", "after dinner", "before bed", "other"],
    types: ["symptom", "bowel"], builtin: true, active: true, aliases: ["timing", "when"], allowCustom: true,
  },
  { id: "pain", label: "Pain or Discomfort", type: "select", options: ["None", "Light", "Medium", "High", "Extreme"], types: ["symptom"], builtin: true, active: true, aliases: ["pain", "pain level", "discomfort"] },
  {
    id: "sensationType", label: "Sensation Type", type: "multiselect",
    options: [
      "Dull ache", "Cramping / colicky", "Sharp / stabbing", "Burning", "Twisting / gripping",
      "Hungry gnawing pain", "Tender / sore to touch", "Pressure", "Bloated", "Shredding", "Unsure",
    ],
    types: ["symptom"], builtin: true, active: true, aliases: ["sensation", "sensation type", "pain type"], allowCustom: true,
  },
  {
    id: "location", label: "Location", type: "multiselect",
    options: [
      "Upper right", "Upper middle", "Upper left", "Around belly button",
      "Lower right", "Lower middle", "Lower left", "Xiphoid process",
    ],
    types: ["symptom"], builtin: true, active: true, aliases: ["location", "where"], allowAddOption: true,
  },
  {
    id: "gasWords", label: "Bowel & gas words", type: "multiselect",
    options: ["Gassy non-smelly", "Smelly gas", "Hot gas", "Gurgling / churning gas", "\"Trapped\" gas", "Burping"],
    types: ["symptom"], builtin: true, active: true, aliases: ["gas", "bowel gas", "gas words"], allowAddOption: true,
  },
  { id: "urgency", label: "Urgency", type: "boolean", types: ["bowel"], builtin: true, active: true, aliases: ["urgency"] },
  {
    id: "attemptNumber", label: "Attempt", type: "select",
    options: ["First Attempt", "Second Attempt", "Third Attempt", "Fourth Attempt"],
    types: ["bowel"], builtin: true, active: true, aliases: ["attempt", "attempt number"],
  },
  { id: "bristol", label: "Stool type", type: "bristol", types: ["bowel"], builtin: true, active: true, aliases: ["stool", "bristol", "bm type"] },
  { id: "stoolColor", label: "Stool color", type: "colorScale", types: ["bowel"], builtin: true, active: true, aliases: ["color", "stool color"] },
  {
    id: "emptying", label: "Emptying quality", type: "select",
    options: ["Incomplete feeling", "Mostly out", "Neutral", "Good emptying", "Constipation"],
    types: ["bowel"], builtin: true, active: true, aliases: ["emptying", "emptying quality", "quality"],
  },
  { id: "bloodMucus", label: "Blood / mucus present", type: "boolean", types: ["bowel"], builtin: true, active: true, aliases: ["blood", "mucus", "blood/mucus"] },
  { id: "notes", label: "Notes", type: "text", types: ["meal", "symptom", "bowel", "quiet"], builtin: true, active: true, aliases: ["notes", "note"] },
  {
    id: "learnings", label: "Learnings", type: "list",
    types: ["observation"], builtin: true, active: true, aliases: ["learning", "learnings", "observation", "reflection"],
  },
];

const BRISTOL_HINT = {
  1: "hard lumps", 2: "lumpy sausage", 3: "cracked sausage", 4: "smooth sausage",
  5: "soft blobs", 6: "mushy", 7: "watery",
};

const STOOL_COLOR_HINT = {
  1: "black / tarry", 2: "dark brown", 3: "brown", 4: "yellow",
  5: "green", 6: "red / bloody", 7: "pale / clay-colored",
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);
const uid = () => Math.random().toString(36).slice(2, 10);

function isBlankValue(val) {
  if (val === undefined || val === "") return true;
  if (Array.isArray(val)) return val.every((v) => !v || !String(v).trim());
  return false;
}

function displayValue(val) {
  if (typeof val === "boolean") return val ? "yes" : "no";
  if (Array.isArray(val)) return val.filter((v) => v && String(v).trim()).join(", ");
  return String(val);
}

// ---------- storage helpers ----------

async function loadSchema() {
  try {
    const r = await window.storage.get("gutlog:schema");
    return r ? JSON.parse(r.value) : DEFAULT_SCHEMA;
  } catch {
    return DEFAULT_SCHEMA;
  }
}
async function saveSchema(schema) {
  await window.storage.set("gutlog:schema", JSON.stringify(schema));
}
async function loadEntries() {
  try {
    const r = await window.storage.get("gutlog:entries");
    return r ? JSON.parse(r.value) : [];
  } catch {
    return [];
  }
}
async function saveEntries(entries) {
  await window.storage.set("gutlog:entries", JSON.stringify(entries));
}

// ---------- free-text parsing ----------

function extractDate(text) {
  const lower = text.toLowerCase();
  if (/\byesterday\b/.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  if (/\btoday\b/.test(lower)) return todayStr();
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (slash) {
    const year = new Date().getFullYear();
    const mm = String(slash[1]).padStart(2, "0");
    const dd = String(slash[2]).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }
  return null;
}

function closestOption(raw, options) {
  const r = raw.toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === r);
  if (exact) return exact;
  const partial = options.find((o) => r.includes(o.toLowerCase()) || o.toLowerCase().includes(r));
  return partial || null;
}

// Parses pasted text against a given list of fields (already filtered to the active entry type)
function parseEntryText(text, fields) {
  const values = {};
  const matchedIds = [];

  fields.forEach((field) => {
    const aliases = [field.label, ...(field.aliases || [])].filter(Boolean);
    for (const alias of aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // list fields may legitimately contain commas in their value, so stop only at line breaks/semicolons
      const stopChars = (field.type === "list" || field.type === "multiselect") ? "\\n;" : "\\n,.;";
      const re = new RegExp(escaped + `\\s*[:\\-=]\\s*([^${stopChars}]+)`, "i");
      const m = text.match(re);
      if (!m) continue;
      const raw = m[1].trim();
      if (!raw) continue;

      if (field.type === "scale" || field.type === "bristol" || field.type === "colorScale") {
        const numMatch = raw.match(/-?\d+(\.\d+)?/);
        if (!numMatch) continue;
        let num = Number(numMatch[0]);
        const bounds = field.type === "scale" ? [0, 10] : [1, 7];
        num = Math.min(bounds[1], Math.max(bounds[0], num));
        values[field.id] = num;
      } else if (field.type === "boolean") {
        const r = raw.toLowerCase();
        if (/^(y|yes|true|present)/.test(r)) values[field.id] = true;
        else if (/^(n|no|none|false|absent)/.test(r)) values[field.id] = false;
        else continue;
      } else if (field.type === "select") {
        const match = closestOption(raw, field.options);
        if (!match) continue;
        values[field.id] = match;
      } else if (field.type === "list") {
        const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
        if (items.length === 0) continue;
        values[field.id] = items;
      } else if (field.type === "multiselect") {
        const rawItems = raw.split(",").map((s) => s.trim()).filter(Boolean);
        if (rawItems.length === 0) continue;
        const resolved = rawItems
          .map((item) => closestOption(item, field.options) || (field.allowCustom ? item : null))
          .filter(Boolean);
        if (resolved.length === 0) continue;
        values[field.id] = resolved;
      } else {
        values[field.id] = raw;
      }
      matchedIds.push(field.id);
      break;
    }
  });

  // if nothing else matched, try to catch a bare "timing" or "meal" keyword loose in the text
  const unmatchedFields = fields.filter((f) => !matchedIds.includes(f.id));
  return { date: extractDate(text), values, matchedIds, unmatchedFields };
}

// ---------- field input ----------

function FieldInput({ field, value, onChange, suggestions, onAddOption }) {
  const startsCustom = field.type === "select" && field.allowCustom && value && !field.options.includes(value);
  const [customMode, setCustomMode] = useState(startsCustom);
  const [openSuggestFor, setOpenSuggestFor] = useState(null);
  const [newOptionOpen, setNewOptionOpen] = useState(false);
  const [newOptionText, setNewOptionText] = useState("");
  const initialMultiOtherOpen =
    field.type === "multiselect" && field.allowCustom && Array.isArray(value)
      ? value.some((s) => !(field.options || []).includes(s))
      : false;
  const [multiOtherOpen, setMultiOtherOpen] = useState(initialMultiOtherOpen);

  if (field.type === "scale" || field.type === "bristol" || field.type === "colorScale") {
    const min = field.type === "scale" ? 0 : 1;
    const max = field.type === "scale" ? 10 : 7;
    const hintMap = field.type === "bristol" ? BRISTOL_HINT : field.type === "colorScale" ? STOOL_COLOR_HINT : null;
    const v = value ?? "";
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-stone-600">{field.label}</span>
          <span className="text-sm font-mono text-stone-800">
            {v === "" ? "—" : v}
            {hintMap && v !== "" ? ` · ${hintMap[v]}` : ""}
          </span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={v === "" ? min : v}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-stone-700"
        />
      </div>
    );
  }
  if (field.type === "select") {
    if (customMode) {
      return (
        <div>
          <label className="text-sm text-stone-600 block mb-1">{field.label}</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder={`Type your own ${field.label.toLowerCase()}`}
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
            <button
              type="button"
              onClick={() => { setCustomMode(false); onChange(""); }}
              className="text-xs text-stone-600 underline whitespace-nowrap"
            >
              choose from list
            </button>
          </div>
        </div>
      );
    }
    return (
      <div>
        <label className="text-sm text-stone-600 block mb-1">{field.label}</label>
        <div className="flex flex-wrap gap-2">
          {field.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                value === opt
                  ? "bg-stone-800 text-stone-50 border-stone-800"
                  : "bg-transparent text-stone-600 border-stone-300 hover:border-stone-500"
              }`}
            >
              {opt}
            </button>
          ))}
          {field.allowCustom && (
            <button
              type="button"
              onClick={() => { setCustomMode(true); onChange(""); }}
              className="px-3 py-1.5 rounded-full text-sm border border-dashed border-stone-400 text-stone-600 hover:border-stone-600 transition"
            >
              Other…
            </button>
          )}
        </div>
      </div>
    );
  }
  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-600">{field.label}</span>
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`w-11 h-6 rounded-full relative transition ${value ? "bg-amber-700" : "bg-stone-300"}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${value ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
    );
  }
  if (field.type === "multiselect") {
    const options = field.options || [];
    const selected = Array.isArray(value) ? value : [];
    const fixedSelected = selected.filter((s) => options.includes(s));
    const customValue = field.allowCustom ? selected.find((s) => !options.includes(s)) || "" : "";

    const toggleOption = (opt) => {
      const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
      onChange(next);
    };

    const setCustomText = (text) => {
      const next = [...fixedSelected];
      if (text.trim()) next.push(text);
      onChange(next);
    };

    const toggleOther = () => {
      if (multiOtherOpen) {
        setMultiOtherOpen(false);
        setCustomText("");
      } else {
        setMultiOtherOpen(true);
      }
    };

    const submitNewOption = () => {
      const trimmed = newOptionText.trim();
      setNewOptionText("");
      setNewOptionOpen(false);
      if (!trimmed) return;
      onAddOption && onAddOption(trimmed);
      if (!selected.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
        onChange([...selected, trimmed]);
      }
    };

    return (
      <div>
        <label className="text-sm text-stone-600 block mb-1">{field.label}</label>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => toggleOption(opt)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                selected.includes(opt)
                  ? "bg-stone-800 text-stone-50 border-stone-800"
                  : "bg-transparent text-stone-600 border-stone-300 hover:border-stone-500"
              }`}
            >
              {opt}
            </button>
          ))}
          {field.allowCustom && (
            <button
              type="button"
              onClick={toggleOther}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                multiOtherOpen
                  ? "bg-amber-800 text-white border-amber-800"
                  : "border-dashed border-stone-400 text-stone-600 hover:border-stone-600"
              }`}
            >
              Other…
            </button>
          )}
          {onAddOption && (
            <button
              type="button"
              onClick={() => setNewOptionOpen((o) => !o)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                newOptionOpen
                  ? "bg-amber-800 text-white border-amber-800"
                  : "border-dashed border-stone-400 text-stone-600 hover:border-stone-600"
              }`}
            >
              + Add option
            </button>
          )}
        </div>
        {field.allowCustom && multiOtherOpen && (
          <input
            type="text"
            autoFocus
            value={customValue}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Describe it"
            className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        )}
        {onAddOption && newOptionOpen && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={newOptionText}
              onChange={(e) => setNewOptionText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitNewOption(); } }}
              placeholder="New option, saved for next time"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
            <button type="button" onClick={submitNewOption} className="px-3 py-2 rounded-lg bg-stone-800 text-white text-sm">
              Add
            </button>
          </div>
        )}
      </div>
    );
  }
  if (field.type === "list") {
    const items = Array.isArray(value) && value.length > 0 ? value : [""];
    const updateItem = (idx, v) => {
      const next = [...items];
      next[idx] = v;
      onChange(next);
    };
    const addItem = () => onChange([...items, ""]);
    const removeItem = (idx) => {
      const next = items.filter((_, i) => i !== idx);
      onChange(next.length > 0 ? next : [""]);
    };
    const matchesFor = (idx) => {
      if (!suggestions || suggestions.length === 0) return [];
      const q = (items[idx] || "").trim().toLowerCase();
      const alreadyUsed = new Set(
        items.filter((_, i) => i !== idx).map((v) => (v || "").trim().toLowerCase()).filter(Boolean)
      );
      const pool = suggestions.filter((s) => !alreadyUsed.has(s.toLowerCase()));
      const filtered = q ? pool.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q) : pool;
      return filtered.slice(0, 6);
    };
    return (
      <div>
        <label className="text-sm text-stone-600 block mb-1">{field.label}</label>
        <div className="space-y-2">
          {items.map((item, idx) => {
            const matches = openSuggestFor === idx ? matchesFor(idx) : [];
            return (
              <div key={idx} className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => { updateItem(idx, e.target.value); setOpenSuggestFor(idx); }}
                    onFocus={() => setOpenSuggestFor(idx)}
                    onBlur={() => setTimeout(() => setOpenSuggestFor((cur) => (cur === idx ? null : cur)), 120)}
                    placeholder={idx === 0 ? "e.g. grilled chicken" : "another item"}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                  {matches.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-stone-300 rounded-lg shadow-md overflow-hidden">
                      {matches.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); updateItem(idx, s); setOpenSuggestFor(null); }}
                          className="w-full text-left px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="text-stone-400 hover:text-red-500">
                    <X size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="mt-2 text-xs text-stone-600 flex items-center gap-1 hover:text-stone-800"
        >
          <Plus size={12} /> add another item
        </button>
      </div>
    );
  }
  return (
    <div>
      <label className="text-sm text-stone-600 block mb-1">{field.label}</label>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white/60 focus:outline-none focus:ring-2 focus:ring-stone-400"
        placeholder="Anything worth remembering..."
      />
    </div>
  );
}

// ---------- add field panel ----------

function AddFieldPanel({ onAdd, onClose, defaultType }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState("scale");
  const [options, setOptions] = useState("");
  const [types, setTypes] = useState([defaultType]);

  const toggleType = (id) => {
    setTypes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const submit = () => {
    if (!label.trim() || types.length === 0) return;
    const field = { id: uid(), label: label.trim(), type, builtin: false, active: true, types, aliases: [] };
    if (type === "select" || type === "multiselect") {
      field.options = options.split(",").map((s) => s.trim()).filter(Boolean);
      if (field.options.length === 0) return;
    }
    onAdd(field);
    onClose();
  };

  return (
    <div className="border border-stone-300 rounded-xl p-4 bg-amber-50/60 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-stone-800 text-sm">Track something new</h4>
        <button onClick={onClose} className="text-stone-600 hover:text-stone-700"><X size={16} /></button>
      </div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Sleep quality, Medication taken, Stress level"
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white"
      />
      <div>
        <div className="text-xs text-stone-700 mb-1">Field type</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(FIELD_TYPES).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => setType(key)}
              className={`px-2.5 py-1 rounded-md text-xs border ${type === key ? "bg-stone-800 text-white border-stone-800" : "border-stone-300 text-stone-600"}`}
            >
              {meta.label}
            </button>
          ))}
        </div>
      </div>
      {(type === "select" || type === "multiselect") && (
        <input
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          placeholder="Comma-separated choices, e.g. none, mild, moderate, severe"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white"
        />
      )}
      <div>
        <div className="text-xs text-stone-700 mb-1">Show on which entry types?</div>
        <div className="flex flex-wrap gap-2">
          {ENTRY_TYPES.map((et) => (
            <button
              key={et.id}
              onClick={() => toggleType(et.id)}
              className={`px-2.5 py-1 rounded-md text-xs border ${types.includes(et.id) ? "bg-amber-800 text-white border-amber-800" : "border-stone-300 text-stone-600"}`}
            >
              {et.label}
            </button>
          ))}
        </div>
      </div>
      <button onClick={submit} className="w-full py-2 rounded-lg bg-stone-800 text-white text-sm font-medium hover:bg-stone-700">
        Add field
      </button>
    </div>
  );
}

// ---------- main app ----------

export default function HomeBase() {
  const [schema, setSchema] = useState(DEFAULT_SCHEMA);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("log");
  const [entryType, setEntryType] = useState("meal");
  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState(nowTime());
  const [values, setValues] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [showAddField, setShowAddField] = useState(false);
  const [showManageFields, setShowManageFields] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [historyFilter, setHistoryFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const [s, e] = await Promise.all([loadSchema(), loadEntries()]);
      setSchema(s);
      setEntries(e);
      setLoading(false);
    })();
  }, []);

  const fieldsForType = (typeId) => schema.filter((f) => f.active && f.types.includes(typeId));
  const activeFields = fieldsForType(entryType);

  // Build "you've typed this before" suggestions for every list-type field (e.g. Foods),
  // ranked by how often it's been used, then how recently.
  const listSuggestions = useMemo(() => {
    const counts = {};
    entries.forEach((e) => {
      Object.entries(e.values || {}).forEach(([fid, val]) => {
        if (!Array.isArray(val)) return;
        const ts = entryTimestamp(e);
        val.forEach((item) => {
          const clean = (item || "").trim();
          if (!clean) return;
          const key = clean.toLowerCase();
          counts[fid] = counts[fid] || {};
          if (!counts[fid][key]) counts[fid][key] = { label: clean, count: 0, last: 0 };
          counts[fid][key].count += 1;
          counts[fid][key].last = Math.max(counts[fid][key].last, ts);
        });
      });
    });
    const result = {};
    Object.entries(counts).forEach(([fid, map]) => {
      result[fid] = Object.values(map)
        .sort((a, b) => b.count - a.count || b.last - a.last)
        .map((v) => v.label);
    });
    return result;
  }, [entries]);

  // "Still going" — the most recent Symptom entry, so it can be re-logged
  // with one tap (same values, fresh timestamp) instead of re-filling the
  // whole form to say "yes, still true." (Bowel movements don't get this —
  // repeating a bowel entry verbatim isn't a useful action.)
  const lastByType = useMemo(() => {
    const result = {};
    ["symptom"].forEach((t) => {
      const matches = entries.filter((e) => e.type === t);
      if (matches.length === 0) return;
      result[t] = matches.reduce((latest, e) => (entryTimestamp(e) > entryTimestamp(latest) ? e : latest));
    });
    return result;
  }, [entries]);

  const repeatEntry = async (entry) => {
    const cloned = {
      id: uid(),
      type: entry.type,
      date: todayStr(),
      time: nowTime(),
      values: JSON.parse(JSON.stringify(entry.values || {})),
      savedAt: new Date().toISOString(),
    };
    const next = [...entries, cloned].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    setEntries(next);
    await saveEntries(next);
  };

  const logQuickEntry = async (type, values) => {
    const cloned = {
      id: uid(),
      type,
      date: todayStr(),
      time: nowTime(),
      values,
      savedAt: new Date().toISOString(),
    };
    const next = [...entries, cloned].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    setEntries(next);
    await saveEntries(next);
  };

  // "Since when" status — most recent flare-matching entry, and most recent
  // bowel entry that wasn't flagged as constipated/incomplete, so a lingering
  // condition shows up as elapsed time even across days with no new detail.
  const lastFlareEntry = useMemo(() => {
    const matches = entries.filter(
      (e) => (e.type === "symptom" || e.type === "bowel") && FLARE_PRESETS.some((p) => p.test(e.values || {}))
    );
    if (matches.length === 0) return null;
    return matches.reduce((latest, e) => (entryTimestamp(e) > entryTimestamp(latest) ? e : latest));
  }, [entries]);

  const lastNormalMovement = useMemo(() => {
    const matches = entries.filter(
      (e) => e.type === "bowel" && e.values?.emptying && !["Constipation", "Incomplete feeling"].includes(e.values.emptying)
    );
    if (matches.length === 0) return null;
    return matches.reduce((latest, e) => (entryTimestamp(e) > entryTimestamp(latest) ? e : latest));
  }, [entries]);

  const resetForm = (keepType) => {
    setValues({});
    setEditingId(null);
    setDate(todayStr());
    setTime(nowTime());
    setImportResult(null);
    setImportText("");
    if (!keepType) setEntryType("meal");
  };

  const handleAddField = async (field) => {
    const next = [...schema, field];
    setSchema(next);
    await saveSchema(next);
  };

  const addOptionToField = async (fieldId, newOption) => {
    const trimmed = newOption.trim();
    if (!trimmed) return;
    const next = schema.map((f) => {
      if (f.id !== fieldId) return f;
      const existing = f.options || [];
      if (existing.some((o) => o.toLowerCase() === trimmed.toLowerCase())) return f;
      return { ...f, options: [...existing, trimmed] };
    });
    setSchema(next);
    await saveSchema(next);
  };

  const toggleFieldActive = async (id) => {
    const next = schema.map((f) => (f.id === id ? { ...f, active: !f.active } : f));
    setSchema(next);
    await saveSchema(next);
  };

  const toggleFieldType = async (id, typeId) => {
    const next = schema.map((f) => {
      if (f.id !== id) return f;
      const has = f.types.includes(typeId);
      return { ...f, types: has ? f.types.filter((t) => t !== typeId) : [...f.types, typeId] };
    });
    setSchema(next);
    await saveSchema(next);
  };

  const updateAliases = async (id, aliasStr) => {
    const aliases = aliasStr.split(",").map((s) => s.trim()).filter(Boolean);
    const next = schema.map((f) => (f.id === id ? { ...f, aliases } : f));
    setSchema(next);
    await saveSchema(next);
  };

  const deleteCustomField = async (id) => {
    const next = schema.filter((f) => f.id !== id);
    setSchema(next);
    await saveSchema(next);
  };

  const runImport = () => {
    if (!importText.trim()) return;
    const result = parseEntryText(importText, activeFields);
    setValues((prev) => ({ ...prev, ...result.values }));
    if (result.date) setDate(result.date);
    setImportResult(result);
  };

  const saveEntry = async () => {
    let next;
    if (editingId) {
      next = entries.map((e) => (e.id === editingId ? { ...e, type: entryType, date, time, values } : e));
    } else {
      next = [...entries, { id: uid(), type: entryType, date, time, values, savedAt: new Date().toISOString() }];
    }
    next.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    setEntries(next);
    await saveEntries(next);
    setSaveMsg(editingId ? "Updated" : "Saved");
    setTimeout(() => setSaveMsg(""), 1500);
    resetForm(true);
  };

  const deleteEntry = async (id) => {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    await saveEntries(next);
  };

  const editEntry = (entry) => {
    setEntryType(entry.type);
    setDate(entry.date);
    setTime(entry.time);
    setValues(entry.values);
    setEditingId(entry.id);
    setTab("log");
    setExpandedEntry(null);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-700 text-sm">Loading your log…</div>;
  }

  return (
    <div className="min-h-screen bg-[#F7F3EC] text-stone-800" style={{ fontFamily: "'Georgia', 'Iowan Old Style', serif" }}>
      <div className="max-w-lg mx-auto px-4 pb-24 pt-6">
        <header className="mb-5">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl tracking-tight">Home Base</h1>
            <span className="text-xs text-stone-600 font-mono">{entries.length} {entries.length === 1 ? "entry" : "entries"}</span>
          </div>
          <p className="text-xs text-stone-700 mt-0.5">Meals, symptoms, and bowel movements — logged as they happen.</p>
        </header>

        {(lastFlareEntry || lastNormalMovement) && (
          <div
            className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600 mb-4 -mt-1"
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            {lastFlareEntry && <span>Last flare: {timeAgoLabel(lastFlareEntry)}</span>}
            {lastNormalMovement && <span>Last normal movement: {timeAgoLabel(lastNormalMovement)}</span>}
          </div>
        )}

        <nav className="flex gap-1 mb-5 bg-stone-200/50 rounded-full p-1 w-fit flex-wrap" style={{ fontFamily: "system-ui, sans-serif" }}>
          {[["log", "Log"], ["history", "History"], ["trends", "Trends"], ["patterns", "Patterns"], ["export", "Export"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-full text-sm transition ${tab === key ? "bg-white shadow-sm text-stone-900" : "text-stone-700"}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "log" && (
          <div className="space-y-5" style={{ fontFamily: "system-ui, sans-serif" }}>
            {!editingId && lastByType.symptom && (
              <div className="space-y-1.5">
                <div className="text-xs text-stone-600">Still going?</div>
                <QuickRepeatCard entry={lastByType.symptom} schema={schema} onRepeat={repeatEntry} />
              </div>
            )}
            {!editingId && (
              <div className="flex gap-2">
                <QuickActionButton
                  label="Still constipated"
                  onLog={() => logQuickEntry("bowel", { emptying: "Constipation" })}
                />
                <QuickActionButton
                  label="Quiet day"
                  onLog={() => logQuickEntry("quiet", {})}
                />
              </div>
            )}
            {editingId && (
              <div className="flex items-center justify-between bg-amber-100/70 border border-amber-300 rounded-lg px-3 py-2 text-xs text-amber-800">
                <span>Editing an existing entry</span>
                <button onClick={() => resetForm(true)} className="underline">cancel</button>
              </div>
            )}

            <div>
              <div className="text-xs text-stone-700 mb-1.5">Entry type</div>
              <div className="flex gap-2">
                {ENTRY_TYPES.map((et) => (
                  <button
                    key={et.id}
                    onClick={() => { setEntryType(et.id); setValues({}); setImportResult(null); }}
                    className={`flex-1 py-2 rounded-xl text-sm border transition ${
                      entryType === et.id ? "bg-stone-800 text-white border-stone-800" : "bg-white/70 text-stone-600 border-stone-200"
                    }`}
                  >
                    {et.label}
                  </button>
                ))}
              </div>
            </div>

            {showImport ? (
              <div className="border border-stone-300 rounded-xl p-4 bg-white/70 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-stone-800 text-sm flex items-center gap-1.5">
                    <ClipboardPaste size={14} /> Paste notes to fill the form
                  </h4>
                  <button onClick={() => { setShowImport(false); setImportResult(null); }} className="text-stone-600 hover:text-stone-700"><X size={16} /></button>
                </div>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={3}
                  placeholder={
                    entryType === "meal"
                      ? `e.g. "lunch - fat level: high, notes: takeout burger and fries"`
                      : entryType === "symptom"
                      ? `e.g. "after lunch - pain: 6, urgency: 7, notes: rough one"`
                      : `e.g. "stool: 6, blood/mucus: no, urgency: 5"`
                  }
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white"
                />
                <button onClick={runImport} className="w-full py-2 rounded-lg bg-stone-800 text-white text-sm font-medium hover:bg-stone-700">
                  Fill form from this
                </button>
                {importResult && (
                  <div className="text-xs space-y-1 pt-1">
                    {importResult.date && <div className="flex items-center gap-1.5 text-stone-600"><Check size={12} className="text-emerald-600" /> Date set to {date}</div>}
                    {importResult.matchedIds.length > 0 && (
                      <div className="flex items-center gap-1.5 text-stone-600">
                        <Check size={12} className="text-emerald-600" />
                        Filled: {importResult.matchedIds.map((id) => schema.find((f) => f.id === id)?.label).join(", ")}
                      </div>
                    )}
                    {importResult.unmatchedFields.length > 0 && (
                      <div className="flex items-start gap-1.5 text-amber-700">
                        <AlertCircle size={12} className="mt-0.5 shrink-0" />
                        <span>Couldn't find: {importResult.unmatchedFields.map((f) => f.label).join(", ")} — fill in below, or teach it a phrase under Manage fields.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowImport(true)}
                className="w-full py-2 rounded-xl border border-stone-300 text-stone-600 text-sm flex items-center justify-center gap-1.5 hover:border-stone-400 hover:bg-white/50"
              >
                <ClipboardPaste size={14} /> Paste from notes / a chat instead
              </button>
            )}

            <div className="flex gap-2">
              <div className="flex items-center gap-2 bg-white/70 rounded-xl px-3 py-2 border border-stone-200 flex-1">
                <Calendar size={15} className="text-stone-600" />
                <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-sm focus:outline-none flex-1" />
              </div>
              <div className="flex items-center gap-2 bg-white/70 rounded-xl px-3 py-2 border border-stone-200">
                <Clock size={15} className="text-stone-600" />
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-transparent text-sm focus:outline-none" />
              </div>
            </div>

            <div className="space-y-4">
              {activeFields.length === 0 && (
                <p className="text-sm text-stone-600">No fields are set to show for {ENTRY_TYPES.find((t) => t.id === entryType)?.label} yet. Add one below.</p>
              )}
              {activeFields.map((field) => (
                <div key={field.id} className="bg-white/70 rounded-xl px-4 py-3 border border-stone-200">
                  <FieldInput
                    field={field}
                    value={values[field.id]}
                    onChange={(v) => setValues((prev) => ({ ...prev, [field.id]: v }))}
                    suggestions={field.type === "list" ? listSuggestions[field.id] : undefined}
                    onAddOption={field.allowAddOption ? (opt) => addOptionToField(field.id, opt) : undefined}
                  />
                </div>
              ))}
            </div>

            {showAddField ? (
              <AddFieldPanel onAdd={handleAddField} onClose={() => setShowAddField(false)} defaultType={entryType} />
            ) : (
              <button onClick={() => setShowAddField(true)} className="w-full py-2.5 rounded-xl border border-dashed border-stone-300 text-stone-700 text-sm flex items-center justify-center gap-1.5 hover:border-stone-400 hover:text-stone-700">
                <Plus size={15} /> Track something new
              </button>
            )}

            <button onClick={() => setShowManageFields((s) => !s)} className="text-xs text-stone-600 hover:text-stone-600 flex items-center gap-1">
              {showManageFields ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Manage fields ({schema.length})
            </button>
            {showManageFields && (
              <div className="bg-white/60 rounded-xl border border-stone-200 p-3 space-y-3">
                <p className="text-[11px] text-stone-600">
                  Choose which entry types a field appears on, and add phrases you naturally use so paste-import recognizes them.
                </p>
                {schema.map((f) => (
                  <div key={f.id} className="space-y-1.5 pb-3 border-b border-stone-100 last:border-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className={f.active ? "text-stone-700" : "text-stone-600 line-through"}>{f.label}</span>
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleFieldActive(f.id)} className="text-xs text-stone-700 underline">{f.active ? "hide" : "show"}</button>
                        {!f.builtin && <button onClick={() => deleteCustomField(f.id)} className="text-stone-600 hover:text-red-500"><Trash2 size={13} /></button>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ENTRY_TYPES.map((et) => (
                        <button
                          key={et.id}
                          onClick={() => toggleFieldType(f.id, et.id)}
                          className={`px-2 py-0.5 rounded-md text-[11px] border ${f.types.includes(et.id) ? "bg-amber-800 text-white border-amber-800" : "border-stone-300 text-stone-700"}`}
                        >
                          {et.label}
                        </button>
                      ))}
                    </div>
                    <input
                      defaultValue={(f.aliases || []).join(", ")}
                      onBlur={(e) => updateAliases(f.id, e.target.value)}
                      placeholder="recognized phrases, e.g. cramping, tummy pain"
                      className="w-full text-xs rounded-md border border-stone-200 px-2 py-1 bg-white/80 text-stone-600"
                    />
                  </div>
                ))}
              </div>
            )}

            <button onClick={saveEntry} className="w-full py-3 rounded-xl bg-amber-800 text-white font-medium hover:bg-amber-900 transition">
              {saveMsg || (editingId ? `Update entry` : `Save ${ENTRY_TYPES.find((t) => t.id === entryType)?.label.toLowerCase()} entry`)}
            </button>
          </div>
        )}

        {tab === "history" && (
          <HistoryTab
            entries={entries}
            schema={schema}
            expandedEntry={expandedEntry}
            setExpandedEntry={setExpandedEntry}
            onDelete={deleteEntry}
            onEdit={editEntry}
            filter={historyFilter}
            setFilter={setHistoryFilter}
          />
        )}

        {tab === "trends" && <TrendsTab entries={entries} schema={schema} />}

        {tab === "patterns" && <PatternsTab entries={entries} schema={schema} />}

        {tab === "export" && <ExportTab entries={entries} schema={schema} />}
      </div>
    </div>
  );
}

// ---------- history ----------

function QuickActionButton({ label, onLog }) {
  const [justLogged, setJustLogged] = useState(false);

  const handleClick = async () => {
    await onLog();
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition ${
        justLogged
          ? "bg-emerald-700 text-white border-emerald-700"
          : "bg-white/70 text-stone-700 border-stone-300 hover:border-stone-400"
      }`}
    >
      {justLogged ? "Logged ✓" : label}
    </button>
  );
}

function QuickRepeatCard({ entry, schema, onRepeat }) {
  const [justLogged, setJustLogged] = useState(false);
  const fieldById = Object.fromEntries(schema.map((f) => [f.id, f]));
  const typeLabel = ENTRY_TYPES.find((t) => t.id === entry.type)?.label || entry.type;
  const summary = Object.entries(entry.values || {})
    .map(([fid, val]) => {
      const f = fieldById[fid];
      if (!f || isBlankValue(val)) return null;
      return displayValue(val);
    })
    .filter(Boolean)
    .join(" · ");

  const handleClick = async () => {
    await onRepeat(entry);
    setJustLogged(true);
    setTimeout(() => setJustLogged(false), 1500);
  };

  return (
    <div className="flex items-center justify-between bg-white/70 rounded-xl border border-stone-200 px-3 py-2.5 gap-3">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-stone-500">{typeLabel} · {timeAgoLabel(entry)}</div>
        <div className="text-sm text-stone-700 truncate">{summary || "(no details)"}</div>
      </div>
      <button
        type="button"
        onClick={handleClick}
        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
          justLogged ? "bg-emerald-700 text-white" : "bg-amber-800 text-white hover:bg-amber-900"
        }`}
      >
        {justLogged ? "Logged ✓" : "Still going"}
      </button>
    </div>
  );
}

function HistoryTab({ entries, schema, expandedEntry, setExpandedEntry, onDelete, onEdit, filter, setFilter }) {
  const fieldById = Object.fromEntries(schema.map((f) => [f.id, f]));
  const filtered = filter === "all" ? entries : entries.filter((e) => e.type === filter);
  const sorted = [...filtered].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  return (
    <div className="space-y-3" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="flex gap-1.5 flex-wrap">
        {[{ id: "all", label: "All" }, ...ENTRY_TYPES].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 rounded-full text-xs border ${filter === f.id ? "bg-stone-800 text-white border-stone-800" : "border-stone-300 text-stone-600"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {sorted.length === 0 && <p className="text-sm text-stone-600">No entries here yet.</p>}

      <div className="space-y-2">
        {sorted.map((entry) => {
          if (entry.type === "quiet") {
            const note = entry.values?.notes;
            return (
              <div key={entry.id} className="bg-white/70 rounded-xl border border-stone-200 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-stone-700">{entry.date} · {entry.time} — Quiet day</div>
                  {note && <div className="text-sm text-stone-600 mt-0.5">{note}</div>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => onEdit(entry)} className="text-xs text-stone-700 hover:text-stone-800 flex items-center gap-1"><Pencil size={12} /> edit</button>
                  <button onClick={() => onDelete(entry.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"><Trash2 size={12} /> delete</button>
                </div>
              </div>
            );
          }
          if (entry.type === "observation") {
            const items = Array.isArray(entry.values?.learnings)
              ? entry.values.learnings.filter((v) => v && String(v).trim())
              : [];
            return (
              <div key={entry.id} className="bg-white/70 rounded-xl border border-stone-200 px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-stone-700">{entry.date} · {entry.time}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => onEdit(entry)} className="text-xs text-stone-700 hover:text-stone-800 flex items-center gap-1"><Pencil size={12} /> edit</button>
                    <button onClick={() => onDelete(entry.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"><Trash2 size={12} /> delete</button>
                  </div>
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-stone-600 italic">No learnings written for this entry.</p>
                ) : (
                  <ul className="space-y-1">
                    {items.map((item, i) => (
                      <li key={i} className="text-sm text-stone-800 flex gap-2">
                        <span className="text-amber-800">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          }

          const isOpen = expandedEntry === entry.id;
          const typeLabel = ENTRY_TYPES.find((t) => t.id === entry.type)?.label || entry.type;
          return (
            <div key={entry.id} className="bg-white/70 rounded-xl border border-stone-200 overflow-hidden">
              <button onClick={() => setExpandedEntry(isOpen ? null : entry.id)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded">{typeLabel}</span>
                  <span className="text-sm font-medium text-stone-700">{entry.date} · {entry.time}</span>
                </div>
                {isOpen ? <ChevronUp size={15} className="text-stone-600" /> : <ChevronDown size={15} className="text-stone-600" />}
              </button>
              {isOpen && (
                <div className="px-4 pb-3 space-y-1.5 border-t border-stone-100 pt-2">
                  {Object.entries(entry.values).map(([fid, val]) => {
                    const f = fieldById[fid];
                    if (!f || isBlankValue(val)) return null;
                    return (
                      <div key={fid} className="flex justify-between text-sm gap-3">
                        <span className="text-stone-700 shrink-0">{f.label}</span>
                        <span className="text-stone-800 font-mono text-right">{displayValue(val)}</span>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-4 pt-2">
                    <button onClick={() => onEdit(entry)} className="text-xs text-stone-700 hover:text-stone-800 flex items-center gap-1"><Pencil size={12} /> edit</button>
                    <button onClick={() => onDelete(entry.id)} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"><Trash2 size={12} /> delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- trends ----------

function TrendsTab({ entries, schema }) {
  const numericFields = schema.filter((f) => f.type === "scale" || f.type === "bristol" || f.type === "colorScale");
  const [selectedField, setSelectedField] = useState(numericFields[0]?.id || null);

  const relevantField = schema.find((f) => f.id === selectedField);
  const selectFieldForGrouping = relevantField
    ? schema.find((f) => f.type === "select" && f.types.some((t) => relevantField.types.includes(t)))
    : null;

  const sorted = [...entries].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const chartData = useMemo(() => {
    if (!selectedField) return [];
    return sorted
      .filter((e) => e.values[selectedField] !== undefined && e.values[selectedField] !== "")
      .map((e) => ({ date: `${e.date.slice(5)} ${e.time}`, value: e.values[selectedField] }));
  }, [sorted, selectedField]);

  const groupedData = useMemo(() => {
    if (!selectFieldForGrouping || !selectedField) return [];
    const groups = {};
    sorted.forEach((e) => {
      const cat = e.values[selectFieldForGrouping.id];
      const val = e.values[selectedField];
      if (cat === undefined || val === undefined || val === "") return;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(val);
    });
    return Object.entries(groups).map(([cat, vals]) => ({
      category: cat,
      average: Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)),
      count: vals.length,
    }));
  }, [sorted, selectFieldForGrouping, selectedField]);

  if (entries.length < 2) {
    return <p className="text-sm text-stone-600" style={{ fontFamily: "system-ui, sans-serif" }}>Log a few more entries and trends will show up here.</p>;
  }

  return (
    <div className="space-y-6" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div>
        <label className="text-xs text-stone-700 block mb-2">Show trend for</label>
        <div className="flex flex-wrap gap-2">
          {numericFields.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedField(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs border ${selectedField === f.id ? "bg-stone-800 text-white border-stone-800" : "border-stone-300 text-stone-600"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="bg-white/70 rounded-xl border border-stone-200 p-4">
          <div className="flex items-center gap-1.5 mb-2 text-stone-600 text-xs"><TrendingUp size={13} /> Over time</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e2d8" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#78716c" />
              <YAxis tick={{ fontSize: 11 }} stroke="#78716c" width={24} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#92400e" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {selectFieldForGrouping && groupedData.length > 1 && (
        <div className="bg-white/70 rounded-xl border border-stone-200 p-4">
          <div className="text-stone-600 text-xs mb-2">
            Average {relevantField.label.toLowerCase()} by {selectFieldForGrouping.label.toLowerCase()}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={groupedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e2d8" />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} stroke="#78716c" />
              <YAxis tick={{ fontSize: 11 }} stroke="#78716c" width={24} />
              <Tooltip />
              <Bar dataKey="average" fill="#92400e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-stone-600 mt-2">{groupedData.map((g) => `${g.category}: n=${g.count}`).join(" · ")}</p>
        </div>
      )}

      <p className="text-[11px] text-stone-600">These are simple averages from your own logs, not a diagnosis — useful for noticing patterns to bring to a provider.</p>
    </div>
  );
}

// ---------- patterns (cross-entry-type, time-lagged) ----------

const FLARE_PRESETS = [
  { id: "painHigh", label: "Pain High/Extreme", test: (v) => v.pain === "High" || v.pain === "Extreme" },
  { id: "urgency", label: "Urgency present", test: (v) => v.urgency === true },
  { id: "bristolExtreme", label: "Bristol 1–2 or 6–7", test: (v) => typeof v.bristol === "number" && (v.bristol <= 2 || v.bristol >= 6) },
  { id: "colorConcern", label: "Stool color black/red", test: (v) => v.stoolColor === 1 || v.stoolColor === 6 },
  { id: "blood", label: "Blood / mucus present", test: (v) => v.bloodMucus === true },
];

function entryTimestamp(e) {
  return new Date(`${e.date}T${e.time || "00:00"}`).getTime();
}

function timeAgoLabel(entry) {
  const mins = Math.floor((Date.now() - entryTimestamp(entry)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isFlareEntry(entry, activeFlareTests) {
  if (entry.type === "symptom" || entry.type === "bowel") {
    return activeFlareTests.some((t) => t.test(entry.values || {}));
  }
  return false;
}

function PatternsTab({ entries, schema }) {
  const exposureCandidates = schema.filter(
    (f) => (f.type === "select" || f.type === "boolean") && f.types.includes("meal")
  );
  const [exposureId, setExposureId] = useState(exposureCandidates[0]?.id || null);
  const [windowHours, setWindowHours] = useState(24);
  const [activeFlareIds, setActiveFlareIds] = useState(FLARE_PRESETS.map((p) => p.id));

  const exposureField = schema.find((f) => f.id === exposureId);
  const activeFlareTests = FLARE_PRESETS.filter((p) => activeFlareIds.includes(p.id));

  const meals = useMemo(
    () => entries.filter((e) => e.type === "meal" && exposureField && e.values[exposureField.id] !== undefined),
    [entries, exposureField]
  );
  const flareEvents = useMemo(
    () => entries.filter((e) => isFlareEntry(e, activeFlareTests)).map((e) => entryTimestamp(e)).sort((a, b) => a - b),
    [entries, activeFlareTests]
  );

  const toggleFlare = (id) => {
    setActiveFlareIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const results = useMemo(() => {
    if (!exposureField) return [];
    const windowMs = windowHours * 60 * 60 * 1000;
    const groups = {};
    meals.forEach((meal) => {
      const cat = String(meal.values[exposureField.id]);
      const t = entryTimestamp(meal);
      const followedByFlare = flareEvents.some((ft) => ft > t && ft - t <= windowMs);
      if (!groups[cat]) groups[cat] = { total: 0, flared: 0 };
      groups[cat].total += 1;
      if (followedByFlare) groups[cat].flared += 1;
    });
    return Object.entries(groups)
      .map(([category, { total, flared }]) => ({
        category,
        pct: Number(((flared / total) * 100).toFixed(0)),
        total,
        flared,
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [meals, flareEvents, exposureField, windowHours]);

  if (exposureCandidates.length === 0) {
    return (
      <p className="text-sm text-stone-600" style={{ fontFamily: "system-ui, sans-serif" }}>
        Add a choice-type field to meals (like fat level) to start finding patterns here.
      </p>
    );
  }

  return (
    <div className="space-y-6" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div>
        <label className="text-xs text-stone-700 block mb-2">What did you eat?</label>
        <div className="flex flex-wrap gap-2">
          {exposureCandidates.map((f) => (
            <button
              key={f.id}
              onClick={() => setExposureId(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs border ${exposureId === f.id ? "bg-stone-800 text-white border-stone-800" : "border-stone-300 text-stone-600"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-stone-700 block mb-2">Counts as a flare if</label>
        <div className="flex flex-wrap gap-2">
          {FLARE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => toggleFlare(p.id)}
              className={`px-2.5 py-1 rounded-md text-xs border ${activeFlareIds.includes(p.id) ? "bg-amber-800 text-white border-amber-800" : "border-stone-300 text-stone-700"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-stone-700 block mb-2">Look for a flare within</label>
        <div className="flex gap-2">
          {[12, 24, 48, 72].map((h) => (
            <button
              key={h}
              onClick={() => setWindowHours(h)}
              className={`px-3 py-1.5 rounded-full text-xs border ${windowHours === h ? "bg-stone-800 text-white border-stone-800" : "border-stone-300 text-stone-600"}`}
            >
              {h}h
            </button>
          ))}
        </div>
      </div>

      {meals.length === 0 ? (
        <p className="text-sm text-stone-600">No meals logged with "{exposureField?.label}" set yet.</p>
      ) : activeFlareTests.length === 0 ? (
        <p className="text-sm text-stone-600">Pick at least one flare condition above.</p>
      ) : (
        <div className="bg-white/70 rounded-xl border border-stone-200 p-4">
          <div className="text-stone-600 text-xs mb-2">
            % of meals followed by a flare within {windowHours}h, by {exposureField.label.toLowerCase()}
          </div>
          <ResponsiveContainer width="100%" height={Math.max(140, results.length * 40)}>
            <BarChart data={results} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e2d8" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#78716c" unit="%" />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} stroke="#78716c" width={70} />
              <Tooltip formatter={(v, n, p) => [`${v}% (${p.payload.flared}/${p.payload.total})`, "followed by flare"]} />
              <Bar dataKey="pct" fill="#92400e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-stone-600 mt-2">
            {results.map((r) => `${r.category}: ${r.flared}/${r.total} meals`).join(" · ")}
          </p>
        </div>
      )}

      <p className="text-[11px] text-stone-600">
        This counts co-occurrence in your own log within a time window — it can't tell you the fat level caused the flare, only that they showed up together. Low counts (n) make percentages unreliable; look for patterns that hold up across many meals, and bring anything that stands out to your care team.
      </p>
    </div>
  );
}

// ---------- export ----------

function formatEntryLine(entry, fieldById) {
  const typeLabel = ENTRY_TYPES.find((t) => t.id === entry.type)?.label || entry.type;
  const parts = Object.entries(entry.values || {})
    .map(([fid, val]) => {
      const f = fieldById[fid];
      if (!f || isBlankValue(val)) return null;
      return `${f.label}: ${displayValue(val)}`;
    })
    .filter(Boolean);
  return `${entry.date} ${entry.time} — ${typeLabel} — ${parts.join(", ") || "(no fields filled in)"}`;
}

function buildPlainTextExport(entries, schema) {
  const fieldById = Object.fromEntries(schema.map((f) => [f.id, f]));
  const sorted = [...entries].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const header =
    `Home Base export — ${entries.length} entries, ${sorted[0]?.date || "?"} to ${sorted[sorted.length - 1]?.date || "?"}\n` +
    `Columns per line: date, time, entry type, then each logged field as "label: value".\n` +
    `Bristol stool scale: 1-2 hard/lumpy, 3-4 normal, 5-7 loose/watery.\n\n`;
  return header + sorted.map((e) => formatEntryLine(e, fieldById)).join("\n");
}

function buildJsonExport(entries, schema) {
  return JSON.stringify({ schema, entries }, null, 2);
}

function csvEscape(val) {
  const str = val === undefined || val === null ? "" : String(val);
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function buildCsvExport(entries, schema) {
  const header = ["date", "time", "entry_type", ...schema.map((f) => f.label)];
  const sorted = [...entries].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const rows = sorted.map((e) => {
    const typeLabel = ENTRY_TYPES.find((t) => t.id === e.type)?.label || e.type;
    const cells = [e.date, e.time, typeLabel];
    schema.forEach((f) => {
      const val = e.values ? e.values[f.id] : undefined;
      cells.push(isBlankValue(val) ? "" : displayValue(val));
    });
    return cells;
  });
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

function ExportTab({ entries, schema }) {
  const [format, setFormat] = useState("text");
  const [copied, setCopied] = useState(false);

  const content = useMemo(() => {
    if (format === "csv") return buildCsvExport(entries, schema);
    if (format === "json") return buildJsonExport(entries, schema);
    return buildPlainTextExport(entries, schema);
  }, [format, entries, schema]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const mimeByFormat = { text: "text/plain", csv: "text/csv", json: "application/json" };
  const extByFormat = { text: "txt", csv: "csv", json: "json" };

  const download = () => {
    const blob = new Blob([content], { type: mimeByFormat[format] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `home-base-export.${extByFormat[format]}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (entries.length === 0) {
    return (
      <p className="text-sm text-stone-600" style={{ fontFamily: "system-ui, sans-serif" }}>
        Nothing to export yet — log a few entries first.
      </p>
    );
  }

  return (
    <div className="space-y-4" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div>
        <p className="text-xs text-stone-700 mb-2">
          This app can only analyze within its own charts. To ask a full Claude conversation to dig into your data
          freely, use Plain text. To open your log in Excel/Sheets, use CSV. Copy or download whichever you need.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFormat("text")}
            className={`px-3 py-1.5 rounded-full text-xs border ${format === "text" ? "bg-stone-800 text-white border-stone-800" : "border-stone-300 text-stone-600"}`}
          >
            Plain text (for Claude)
          </button>
          <button
            onClick={() => setFormat("csv")}
            className={`px-3 py-1.5 rounded-full text-xs border ${format === "csv" ? "bg-stone-800 text-white border-stone-800" : "border-stone-300 text-stone-600"}`}
          >
            CSV (for Excel/Sheets)
          </button>
          <button
            onClick={() => setFormat("json")}
            className={`px-3 py-1.5 rounded-full text-xs border ${format === "json" ? "bg-stone-800 text-white border-stone-800" : "border-stone-300 text-stone-600"}`}
          >
            Raw JSON (backup)
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={copy} className="flex-1 py-2.5 rounded-xl bg-amber-800 text-white text-sm font-medium hover:bg-amber-900 flex items-center justify-center gap-1.5">
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy to clipboard"}
        </button>
        <button onClick={download} className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-600 text-sm flex items-center justify-center gap-1.5 hover:border-stone-400">
          <Download size={14} /> Download file
        </button>
      </div>

      <textarea
        readOnly
        value={content}
        rows={14}
        className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs font-mono bg-white/60 text-stone-600"
        onFocus={(e) => e.target.select()}
      />

      <p className="text-[11px] text-stone-600">
        Nothing here leaves your device automatically — this only prepares the text. You decide where to paste or
        send it. CSV has one row per entry and one column per field, ready to paste straight into a spreadsheet.
        The JSON version is a full backup (schema + entries) in case you ever want to move this data somewhere else.
      </p>
    </div>
  );
}
