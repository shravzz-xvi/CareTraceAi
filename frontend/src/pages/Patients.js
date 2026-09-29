import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPatients, addPatient, deletePatient, triggerWhatsApp } from "../api";

function RiskBadge({ level }) {
  const map = { Low: "badge badge-success", High: "badge badge-warn", Critical: "badge badge-danger" };
  return <span className={map[level] || "badge badge-info"}>{level || "Low"}</span>;
}

function TrendBadge({ trend }) {
  const t = (trend || "stable").toLowerCase();
  if (t === "improving") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: "rgba(34,197,94,0.12)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.25)" }}>
        <span style={{ fontSize: 13, lineHeight: 1 }}>↓</span> Improving
      </span>
    );
  }
  if (t === "worsening") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: "rgba(239,68,68,0.12)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.25)" }}>
        <span style={{ fontSize: 13, lineHeight: 1 }}>↑</span> Worsening
      </span>
    );
  }
  if (t === "baseline") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: "rgba(139,92,246,0.12)", color: "#7c3aed", border: "1px solid rgba(139,92,246,0.25)" }}>
        ★ Baseline
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: "rgba(100,116,139,0.12)", color: "#475569", border: "1px solid rgba(100,116,139,0.25)" }}>
      ↔ Stable
    </span>
  );
}

function Avatar({ name, color = "#6366f1", size = 34 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: color + "15", color, border: `1.5px solid ${color}25`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700,
    }}>{name?.charAt(0).toUpperCase()}</div>
  );
}

function MonitoringStatusBadge({ status }) {
  const s = (status || "active").toLowerCase();
  if (s === "active") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: "rgba(16,185,129,0.12)", color: "#059669", border: "1px solid rgba(16,185,129,0.25)" }}>
        ● Active
      </span>
    );
  }
  if (s === "paused") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: "rgba(245,158,11,0.12)", color: "#d97706", border: "1px solid rgba(245,158,11,0.25)" }}>
        ❚❚ Paused
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: "rgba(99,102,241,0.12)", color: "#4f46e5", border: "1px solid rgba(99,102,241,0.25)" }}>
      ✓ Completed
    </span>
  );
}

const EMPTY = {
  name: "",
  phone: "",
  procedure_name: "",
  surgery_date: new Date().toISOString().slice(0, 10),
  discharge_date: new Date().toISOString().slice(0, 10),
  monitoring_days: 10,
  risk_level: "Low",
  clinical_notes: ""
};
const AVATAR_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#f43f5e"];

// Common medical procedures for suggestions
const PROCEDURE_SUGGESTIONS = [
  "Knee Replacement","Hip Replacement","Spinal Fusion","Appendectomy",
  "Cardiac Bypass Surgery","Coronary Angioplasty","Gallbladder Removal",
  "Hernia Repair","Cataract Surgery","Hysterectomy","Prostatectomy",
  "Kidney Transplant","Liver Transplant","Bone Marrow Transplant",
  "Chemotherapy","Dialysis","Coronary Angiography","Endoscopy",
  "Colonoscopy","Tonsillectomy","Thyroidectomy","Mastectomy",
  "Cesarean Section","Laparoscopy","Arthroscopy",
];

function exportCSV(patients) {
  const headers = ["ID","Name","Phone","Procedure","Surgery Date","Risk Level","Last Check-in","Registered"];
  const rows = patients.map(p => [
    p.id, p.name, p.phone,
    p.procedure_name || "",
    p.surgery_date   || "",
    p.risk_level     || "Low",
    p.last_checkin   ? new Date(p.last_checkin).toLocaleDateString("en-IN") : "",
    p.created_at     ? new Date(p.created_at).toLocaleDateString("en-IN")   : "",
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `aura-patients-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}



 function validate(form) {
  const errs = {};

  // Name
  if (!form.name.trim()) {
    errs.name = "Full name is required";
  } else if (!/^[a-zA-Z\s'.]{2,60}$/.test(form.name.trim())) {
    errs.name = "Name should contain only letters";
  } else if (form.name.trim().length < 3) {
    errs.name = "Enter a valid full name (at least 3 characters)";
  }

  // Phone
  const phone = form.phone.replace(/\s|-/g, "");
  if (!phone) {
    errs.phone = "Phone number is required";
  } else if (!/^[6-9]\d{9}$/.test(phone)) {
    errs.phone = "Enter a valid 10-digit Indian mobile number (starts with 6–9)";
  }

  // Procedure — catches gibberish like jdgfhnf, fgdb, xyz
  if (form.procedure_name.trim()) {
    const proc = form.procedure_name.trim();
    if (!/^[a-zA-Z\s\-()/.,]{3,100}$/.test(proc)) {
      errs.procedure_name = "Procedure must contain only letters (e.g. Knee Replacement)";
    } else {
      const words = proc.split(/\s+/).filter(w => w.length > 0);
      const hasVowel     = w => /[aeiouAEIOU]/.test(w);
      const invalidWords = words.filter(w => w.length >= 3 && !hasVowel(w));
      const hasLongWord  = words.some(w => w.length >= 4);
      const consonantRun = /[^aeiouAEIOU\s\-()/.,]{5,}/;

      if (invalidWords.length > 0) {
        errs.procedure_name = `"${invalidWords[0]}" is not a valid medical term — please enter a real procedure`;
      } else if (!hasLongWord) {
        errs.procedure_name = "Enter a complete procedure name (e.g. Appendectomy, Knee Replacement)";
      } else if (consonantRun.test(proc)) {
        errs.procedure_name = "Enter a valid procedure name (e.g. Cardiac Surgery, Hip Replacement)";
      }
    }
  }

  // Surgery date
  if (form.surgery_date) {
    const d   = new Date(form.surgery_date);
    const now = new Date();
    const min = new Date(); min.setFullYear(now.getFullYear() - 5);
    const max = new Date(); max.setFullYear(now.getFullYear() + 2);
    if (isNaN(d.getTime())) {
      errs.surgery_date = "Enter a valid date";
    } else if (d < min) {
      errs.surgery_date = "Surgery date cannot be more than 5 years ago";
    } else if (d > max) {
      errs.surgery_date = "Surgery date cannot be more than 2 years in the future";
    }
  }

  return errs;
}
function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {msg}
    </div>
  );
}

export default function Patients() {
  const [patients, setPatients]       = useState([]);
  const [form, setForm]               = useState(EMPTY);
  const [errors, setErrors]           = useState({});
  const [showForm, setShowForm]       = useState(false);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [search, setSearch]           = useState("");
  const [filterRisk, setFilterRisk]   = useState("All");
  const [sortBy, setSortBy]           = useState("newest");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [waModal, setWaModal]         = useState({ isOpen: false, loading: false, patient: null, data: null, error: null, copied: false });

  const handleTriggerWhatsApp = async (e, patient) => {
    e.preventDefault(); e.stopPropagation();
    setWaModal({ isOpen: true, loading: true, patient, data: null, error: null, copied: false });
    try {
      const res = await triggerWhatsApp(patient.id);
      setWaModal(prev => ({ ...prev, loading: false, data: res }));
    } catch (err) {
      setWaModal(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setWaModal(prev => ({ ...prev, copied: true }));
    setTimeout(() => setWaModal(prev => ({ ...prev, copied: false })), 2500);
  };

  const load = async () => {
    try { const d = await getPatients(); setPatients(d); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Live field validation
  const handleChange = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
    // Clear error as user types
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));

    // Procedure suggestions
    if (key === "procedure_name" && value.length >= 2) {
      const filtered = PROCEDURE_SUGGESTIONS.filter(s =>
        s.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 5));
    } else if (key === "procedure_name") {
      setSuggestions([]);
    }
  };

  const handleSubmit = async () => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      await addPatient({
        ...form,
        phone: form.phone.replace(/\s|-/g, ""),
        procedure_name: form.procedure_name.trim() || null,
        monitoring_days: Number(form.monitoring_days) || 10,
        discharge_date: form.discharge_date || form.surgery_date || null,
        clinical_notes: form.clinical_notes || null
      });
      setForm(EMPTY); setErrors({}); setSuggestions([]);
      setShowForm(false); setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (e, id, name) => {
    e.preventDefault(); e.stopPropagation();
    if (!window.confirm(`Remove ${name}? This cannot be undone.`)) return;
    try { await deletePatient(id); setPatients(p => p.filter(x => x.id !== id)); }
    catch (e) { console.error(e); }
  };

  const filtered = patients
    .filter(p => {
      const q = search.toLowerCase();
      return (
        (p.name?.toLowerCase().includes(q) || p.phone?.includes(q) || p.procedure_name?.toLowerCase().includes(q))
        && (filterRisk === "All" || p.risk_level === filterRisk)
      );
    })
    .sort((a, b) => {
      if (sortBy === "newest") return b.id - a.id;
      if (sortBy === "oldest") return a.id - b.id;
      if (sortBy === "name")   return a.name?.localeCompare(b.name);
      if (sortBy === "risk") {
        const r = { Critical: 0, High: 1, Low: 2 };
        return (r[a.risk_level] ?? 3) - (r[b.risk_level] ?? 3);
      }
      return 0;
    });

  const counts = { All: patients.length, Low: 0, High: 0, Critical: 0 };
  patients.forEach(p => { if (counts[p.risk_level] !== undefined) counts[p.risk_level]++; });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Success toast */}
      {saveSuccess && (
        <div className="fade-in" style={{
          position: "fixed", top: 24, right: 24, zIndex: 100,
          background: "#0f172a", color: "#fff", borderRadius: 12,
          padding: "14px 20px", display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.24)", border: "1px solid rgba(255,255,255,0.1)",
          fontSize: 13, fontWeight: 500,
        }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          Patient registered successfully in Active Monitoring
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="page-title">Hospital Patient Registry</div>
          <div className="page-subtitle">{patients.length} patient{patients.length !== 1 ? "s" : ""} enrolled in post-surgery recovery monitoring</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-ghost" onClick={() => exportCSV(patients)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
          <button className="btn-primary" onClick={() => { setShowForm(v => !v); setErrors({}); setForm(EMPTY); setSuggestions([]); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {showForm ? "Cancel" : "Add Patient"}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card fade-up" style={{ padding: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "var(--font-display)", color: "var(--text-primary)", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--brand-light)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            </div>
            Enroll New Patient in Post-Surgery Monitoring
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>

            {/* Name */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Full Name <span style={{ color: "var(--danger-dot)" }}>*</span>
              </label>
              <input className="aura-input" placeholder="e.g. Ramesh Kumar"
                value={form.name}
                onChange={e => handleChange("name", e.target.value)}
                style={{ borderColor: errors.name ? "var(--danger-dot)" : undefined }}
              />
              <FieldError msg={errors.name} />
            </div>

            {/* Phone */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                WhatsApp Mobile Number <span style={{ color: "var(--danger-dot)" }}>*</span>
              </label>
              <input className="aura-input" placeholder="e.g. 9876543210" type="tel" maxLength={10}
                value={form.phone}
                onChange={e => handleChange("phone", e.target.value.replace(/\D/g, ""))}
                style={{ borderColor: errors.phone ? "var(--danger-dot)" : undefined }}
              />
              <FieldError msg={errors.phone} />
              {form.phone && !errors.phone && form.phone.length === 10 && (
                <div style={{ fontSize: 11, color: "var(--success-text)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Valid mobile number
                </div>
              )}
            </div>

            {/* Procedure with autocomplete */}
            <div style={{ position: "relative" }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Procedure / Treatment
              </label>
              <input className="aura-input" placeholder="e.g. Knee Replacement"
                value={form.procedure_name}
                onChange={e => handleChange("procedure_name", e.target.value)}
                onBlur={() => setTimeout(() => setSuggestions([]), 200)}
                style={{ borderColor: errors.procedure_name ? "var(--danger-dot)" : undefined }}
              />
              <FieldError msg={errors.procedure_name} />

              {/* Autocomplete dropdown */}
              {suggestions.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                  background: "var(--card)", border: "1px solid var(--border-md)",
                  borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                  marginTop: 2, overflow: "hidden",
                }}>
                  {suggestions.map(s => (
                    <div key={s}
                      onMouseDown={() => { handleChange("procedure_name", s); setSuggestions([]); }}
                      style={{
                        padding: "9px 14px", fontSize: 12, cursor: "pointer",
                        color: "var(--text-primary)", borderBottom: "1px solid var(--border)",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--brand-light)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Surgery date */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Surgery Date
              </label>
              <input type="date" className="aura-input"
                value={form.surgery_date}
                onChange={e => handleChange("surgery_date", e.target.value)}
                style={{ borderColor: errors.surgery_date ? "var(--danger-dot)" : undefined }}
              />
              <FieldError msg={errors.surgery_date} />
            </div>

            {/* Discharge date */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Discharge Date
              </label>
              <input type="date" className="aura-input"
                value={form.discharge_date}
                onChange={e => handleChange("discharge_date", e.target.value)}
              />
            </div>

            {/* Monitoring Duration */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Monitoring Plan (Days)
              </label>
              <input type="number" min={1} max={90} className="aura-input"
                value={form.monitoring_days}
                onChange={e => handleChange("monitoring_days", e.target.value)}
              />
            </div>

            {/* Risk level */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Initial Risk Level
              </label>
              <select className="aura-input" style={{ cursor: "pointer" }}
                value={form.risk_level}
                onChange={e => handleChange("risk_level", e.target.value)}>
                <option value="Low">🟢 Low — Standard recovery</option>
                <option value="High">🟡 High — Elevated watch</option>
                <option value="Critical">🔴 Critical — Intensive watch</option>
              </select>
            </div>

            {/* Clinical Notes / Instructions */}
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Clinical Instructions & Recovery Parameters
              </label>
              <input className="aura-input" placeholder="e.g. Total knee arthroplasty, watch for DVT signs, calf swelling, ROM exercises"
                value={form.clinical_notes}
                onChange={e => handleChange("clinical_notes", e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: 14, fontSize: 11.5, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>ℹ️</span> Newly enrolled patients will automatically receive daily WhatsApp recovery questionnaires at 9:00 AM.
          </div>

          {/* Validation summary */}
          {Object.keys(errors).length > 0 && (
            <div style={{ marginTop: 16, background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--danger-text)" }}>
              ⚠️ Please fix {Object.keys(errors).length} error{Object.keys(errors).length > 1 ? "s" : ""} above before submitting.
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
            <button className="btn-primary" onClick={handleSubmit} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : "Enroll & Start Monitoring"}
            </button>
            <button className="btn-ghost" onClick={() => { setShowForm(false); setForm(EMPTY); setErrors({}); setSuggestions([]); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Search + filter + sort */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input className="aura-input" style={{ paddingLeft: 34 }} placeholder="Search name, phone, procedure…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["All","Low","High","Critical"].map(r => (
            <button key={r} onClick={() => setFilterRisk(r)} style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: filterRisk === r ? "none" : "1px solid var(--border-md)",
              background: filterRisk === r ? "var(--brand)" : "var(--card)",
              color: filterRisk === r ? "#fff" : "var(--text-secondary)", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              {r}
              <span style={{ fontSize: 10, fontWeight: 700, background: filterRisk === r ? "rgba(255,255,255,0.2)" : "var(--surface)", color: filterRisk === r ? "#fff" : "var(--text-muted)", padding: "1px 5px", borderRadius: 10 }}>
                {counts[r]}
              </span>
            </button>
          ))}
        </div>
        <select className="aura-input" style={{ width: "auto", cursor: "pointer", fontSize: 12 }}
          value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
          <option value="risk">Risk (Critical first)</option>
        </select>
      </div>

      {/* Table */}
      <div className="card fade-up">
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading patients…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>No patients found</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {search || filterRisk !== "All" ? "Try adjusting your search or filter" : "Add your first patient to get started"}
            </div>
          </div>
        ) : (
          <table className="aura-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Patient</th>
                <th>Procedure</th>
                <th>Recovery Day</th>
                <th>Monitoring</th>
                <th>Trend</th>
                <th>Risk</th>
                <th>Last Check-in</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => window.location.href = `/patients/${p.id}`}>
                  <td style={{ color: "var(--text-muted)", fontWeight: 500, width: 48 }}>#{p.id}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <Avatar name={p.name} color={AVATAR_COLORS[p.id % AVATAR_COLORS.length]} />
                      <div>
                        <Link to={`/patients/${p.id}`} style={{ fontWeight: 600, color: "var(--brand)", fontSize: 13, textDecoration: "none" }} onClick={e => e.stopPropagation()}>{p.name}</Link>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{p.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{p.procedure_name || p.procedure || <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td>
                    <span style={{ display: "inline-block", padding: "2px 7px", borderRadius: 6, background: "var(--brand-light)", color: "var(--brand)", fontWeight: 700, fontSize: 11 }}>
                      Day {p.current_day || 1} of {p.monitoring_days || 10}
                    </span>
                  </td>
                  <td>
                    <MonitoringStatusBadge status={p.monitoring_status} />
                  </td>
                  <td><TrendBadge trend={p.trend} /></td>
                  <td><RiskBadge level={p.risk_level}/></td>
                  <td style={{ fontSize: 12 }}>{p.last_checkin ? new Date(p.last_checkin).toLocaleDateString("en-IN") : <span style={{ color: "var(--text-muted)" }}>Not yet</span>}</td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button
                        onClick={(e) => handleTriggerWhatsApp(e, p)}
                        style={{
                          padding: "4px 8px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                          background: "rgba(34,197,94,0.12)", color: "#16a34a",
                          border: "1px solid rgba(34,197,94,0.25)", cursor: "pointer",
                          display: "inline-flex", alignItems: "center", gap: 4
                        }}
                        title="Trigger recovery feedback via WhatsApp"
                      >
                        📱 WhatsApp
                      </button>
                      <Link to={`/patients/${p.id}`} onClick={e => e.stopPropagation()} style={{
                        padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                        background: "var(--brand-light)", color: "var(--brand)",
                        border: "1px solid rgba(15,118,110,0.2)", textDecoration: "none",
                        display: "inline-flex", alignItems: "center", gap: 4,
                      }}>Timeline</Link>
                      <button className="btn-danger" onClick={e => handleDelete(e, p.id, p.name)} style={{ fontSize: 11 }}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filtered.length > 0 && (
          <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Showing {filtered.length} of {patients.length} patients</span>
            <button className="btn-ghost" onClick={() => exportCSV(filtered)} style={{ fontSize: 11, padding: "5px 12px", display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export filtered
            </button>
          </div>
        )}
      </div>

      {/* WHATSAPP TRIGGER MODAL */}
      {waModal.isOpen && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(3px)", zIndex: 9999, display: "flex",
            alignItems: "center", justifyContent: "center", padding: 16
          }}
          onClick={() => setWaModal(prev => ({ ...prev, isOpen: false }))}
        >
          <div
            style={{
              background: "var(--card, #ffffff)", borderRadius: 16, maxWidth: 480,
              width: "100%", padding: "24px 22px", boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              border: "1px solid var(--border)"
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
                  📱 WhatsApp Check-in Trigger
                </h3>
                <p style={{ margin: "2px 0 0 0", fontSize: 11.5, color: "var(--text-muted)" }}>
                  Patient: {waModal.patient?.name} ({waModal.patient?.phone})
                </p>
              </div>
              <button
                onClick={() => setWaModal(prev => ({ ...prev, isOpen: false }))}
                style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            {waModal.loading ? (
              <div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                Generating direct WhatsApp check-in link…
              </div>
            ) : waModal.error ? (
              <div style={{ padding: 12, background: "#fef2f2", color: "#dc2626", borderRadius: 8, fontSize: 12 }}>
                {waModal.error}
              </div>
            ) : (
              <div>
                <div style={{
                  background: "var(--surface, #f8fafc)", border: "1px solid var(--border)",
                  borderRadius: 10, padding: 12, fontSize: 11.5, color: "var(--text-primary)",
                  whiteSpace: "pre-wrap", lineHeight: 1.5, maxHeight: 160, overflowY: "auto", marginBottom: 14
                }}>
                  {waModal.data?.message}
                </div>

                {waModal.data?.checkin_url && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>
                      Direct Patient Portal URL:
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        readOnly value={waModal.data.checkin_url}
                        style={{
                          flex: 1, fontSize: 11, padding: "7px 10px", borderRadius: 8,
                          border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)"
                        }}
                      />
                      <button
                        onClick={() => copyToClipboard(waModal.data.checkin_url)}
                        style={{
                          padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)",
                          background: waModal.copied ? "#22c55e" : "var(--card)",
                          color: waModal.copied ? "#ffffff" : "var(--text-primary)",
                          fontSize: 11, fontWeight: 700, cursor: "pointer"
                        }}
                      >
                        {waModal.copied ? "✓ Copied" : "Copy Link"}
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  {waModal.data?.whatsapp_url && (
                    <a
                      href={waModal.data.whatsapp_url} target="_blank" rel="noopener noreferrer"
                      style={{
                        flex: 1, padding: "11px", background: "#22c55e", color: "#ffffff",
                        borderRadius: 10, textAlign: "center", fontWeight: 800, fontSize: 12,
                        textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6
                      }}
                    >
                      Open in WhatsApp Web
                    </a>
                  )}
                  {waModal.data?.checkin_url && (
                    <a
                      href={waModal.data.checkin_url} target="_blank" rel="noopener noreferrer"
                      style={{
                        padding: "11px 14px", background: "var(--surface)", color: "var(--brand)",
                        border: "1px solid var(--brand-mid)", borderRadius: 10, fontWeight: 700,
                        fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center"
                      }}
                    >
                      Test Portal →
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}