import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  getPatients,
  updatePatient,
  deletePatient,
  getCheckins,
  reviewCheckin,
  manageMonitoring,
  getRecoveryReport,
  generateRecoveryReport,
  sendWhatsAppSummary
} from "../api";

const BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";
function getToken() { return localStorage.getItem("aura_token") || ""; }

function MonitoringStatusBadge({ status }) {
  const s = (status || "active").toLowerCase();
  if (s === "active") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: "rgba(16,185,129,0.12)", color: "#059669", border: "1px solid rgba(16,185,129,0.25)" }}>
        ● Active Monitoring
      </span>
    );
  }
  if (s === "paused") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: "rgba(245,158,11,0.12)", color: "#d97706", border: "1px solid rgba(245,158,11,0.25)" }}>
        ❚❚ Monitoring Paused
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: "rgba(99,102,241,0.12)", color: "#4f46e5", border: "1px solid rgba(99,102,241,0.25)" }}>
      ✓ Monitoring Completed
    </span>
  );
}

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

function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {msg}
    </div>
  );
}

function validateEdit(form) {
  const errs = {};
  if (!form.name?.trim()) errs.name = "Name is required";
  else if (form.name.trim().length < 3 || !/^[a-zA-Z\s'.]{2,60}$/.test(form.name.trim()))
    errs.name = "Name must contain only letters";
  const ph = (form.phone || "").replace(/\s|-/g, "");
  if (!ph) errs.phone = "Phone is required";
  else if (!/^[6-9]\d{9}$/.test(ph)) errs.phone = "Enter a valid 10-digit Indian mobile number";
  return errs;
}

// PDF Generator
function generatePDF(patient, checkins = [], smsLog = []) {
  const now = new Date().toLocaleString("en-IN");
  const riskColor = { Low: "#166534", High: "#92400e", Critical: "#991b1b" }[patient.risk_level] || "#0f766e";

  const timelineRows = checkins.length === 0
    ? `<tr><td colspan="5" style="text-align:center;color:#6b7280;padding:20px">No recovery check-ins recorded yet</td></tr>`
    : checkins.map(c => `
        <tr>
          <td><strong>Day ${c.day}</strong></td>
          <td>Pain: ${c.pain}/10 ${c.pain_delta !== null && c.pain_delta !== undefined ? `(${c.pain_delta >= 0 ? '+' : ''}${c.pain_delta})` : ''}</td>
          <td>${c.swelling || 'None'} / ${c.fever ? 'Fever YES' : 'No fever'}</td>
          <td><span style="font-weight:700;text-transform:uppercase">${c.trend || 'stable'}</span></td>
          <td><span style="font-weight:700;color:${c.risk_level === 'Critical' ? '#be123c' : c.risk_level === 'High' ? '#b45309' : '#15803d'}">${c.risk_level}</span></td>
        </tr>
        ${c.hindsight_summary ? `<tr><td colspan="5" style="font-size:11px;color:#475569;background:#f8fafc;padding:6px 12px"><em>Hindsight:</em> ${c.hindsight_summary}</td></tr>` : ''}
      `).join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>CareTraceAI Report — ${patient.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; font-size: 13px; line-height: 1.6; background: #fff; }
    .page { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #0f766e; margin-bottom: 24px; }
    .brand-name { font-size: 22px; font-weight: 800; color: #0f766e; }
    .brand-sub  { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .06em; }
    .report-meta { text-align: right; font-size: 11px; color: #6b7280; }
    .patient-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
    .section-title { font-size: 12px; font-weight: 700; color: #0f766e; text-transform: uppercase; letter-spacing: .08em; margin: 20px 0 10px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 700; color: #475569; background: #f1f5f9; }
    td { padding: 9px 12px; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
    .footer { margin-top: 30px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="brand-name">CareTraceAI</div>
      <div class="brand-sub">Post-Surgery Recovery Intelligence</div>
    </div>
    <div class="report-meta">
      <strong>Clinical Recovery Dossier</strong>
      Generated: ${now}<br/>
      Patient ID: #${patient.id}
    </div>
  </div>

  <div class="patient-card">
    <h2 style="font-size:18px;margin-bottom:6px">${patient.name}</h2>
    <div>Phone: ${patient.phone} · Procedure: <strong>${patient.procedure || patient.procedure_name || "General"}</strong></div>
    <div>Surgery Date: ${patient.surgery_date ? new Date(patient.surgery_date).toLocaleDateString("en-IN") : "—"} · Current Risk: <span style="color:${riskColor};font-weight:700">${patient.risk_level || "Low"}</span></div>
  </div>

  <div class="section-title">Longitudinal Recovery Timeline</div>
  <table>
    <thead><tr><th>Timeline</th><th>Pain</th><th>Swelling / Fever</th><th>Trend</th><th>Risk</th></tr></thead>
    <tbody>${timelineRows}</tbody>
  </table>

  <div class="footer">
    <span>CareTraceAI Hospital Monitoring System · Confidential Clinical Record</span>
    <span>${now}</span>
  </div>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 800);
}

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [checkinSummary, setCheckinSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [saveMsg, setSaveMsg] = useState("");

  const [smsLog, setSmsLog] = useState([]);
  const [smsLoading, setSmsLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Review intervention state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedCheckin, setSelectedCheckin] = useState(null);
  const [reviewOutcome, setReviewOutcome] = useState("Confirmed concern");
  const [reviewNote, setReviewNote] = useState("");
  const [clinicianName, setClinicianName] = useState("Dr. Staff");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Monitoring & Report states
  const [reportData, setReportData] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [waSending, setWaSending] = useState(false);

  const loadPatientData = useCallback(async () => {
    try {
      const all = await getPatients();
      const found = all.find((p) => String(p.id) === String(id));
      if (found) {
        setPatient(found);
        setForm(found);
      }

      // Fetch recovery checkins
      const cRes = await getCheckins(id);
      if (cRes && cRes.checkins) {
        setCheckins(cRes.checkins);
        setCheckinSummary(cRes.summary);
      } else if (Array.isArray(cRes)) {
        setCheckins(cRes);
      }
    } catch (e) {
      console.error("Error loading patient data:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadSmsLog = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/sms/log/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const d = await res.json();
        setSmsLog(Array.isArray(d) ? d : []);
      }
    } catch {
      setSmsLog([]);
    } finally {
      setSmsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPatientData();
    loadSmsLog();
  }, [loadPatientData, loadSmsLog]);

  const handleChange = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await manageMonitoring(id, { status: newStatus });
      setSaveMsg(`Monitoring status set to: ${newStatus.toUpperCase()}`);
      setTimeout(() => setSaveMsg(""), 3000);
      await loadPatientData();
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleOpenReport = async () => {
    setShowReportModal(true);
    setLoadingReport(true);
    try {
      const res = await getRecoveryReport(id);
      if (res && res.report) {
        setReportData(res.report);
      } else {
        const gen = await generateRecoveryReport(id);
        setReportData(gen.report);
      }
    } catch (err) {
      console.error("Report load error:", err);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleGenerateReport = async () => {
    setLoadingReport(true);
    try {
      const gen = await generateRecoveryReport(id);
      setReportData(gen.report);
      setSaveMsg("10-Day Recovery Report generated successfully!");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err) {
      console.error("Generate error:", err);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleSendWhatsAppReport = async () => {
    if (!reportData) return;
    setWaSending(true);
    try {
      await sendWhatsAppSummary(patient.id, reportData.monitoring_days || 10, reportData.clinical_trajectory_narrative);
      setSaveMsg("10-Day Summary dispatched via WhatsApp!");
      setTimeout(() => setSaveMsg(""), 3500);
      loadSmsLog();
    } catch (err) {
      console.error("WhatsApp summary error:", err);
    } finally {
      setWaSending(false);
    }
  };

  const handleSave = async () => {
    const errs = validateEdit(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      const updated = await updatePatient(id, {
        ...form,
        procedure: form.procedure || form.procedure_name,
      });
      setPatient(updated);
      setForm(updated);
      setEditing(false);
      setErrors({});
      setSaveMsg("Patient details updated successfully!");
      setTimeout(() => setSaveMsg(""), 3000);
      loadPatientData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Permanently remove ${patient.name}? This will remove all recovery records.`)) return;
    try {
      await deletePatient(id);
      navigate("/patients");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadReport = () => {
    setGenerating(true);
    setTimeout(() => {
      generatePDF(patient, checkins, smsLog);
      setGenerating(false);
    }, 300);
  };

  const openReviewModal = (chk) => {
    setSelectedCheckin(chk || (checkins.length ? checkins[checkins.length - 1] : null));
    setShowReviewModal(true);
  };

  const handleRecordReview = async () => {
    setSubmittingReview(true);
    try {
      await reviewCheckin({
        checkin_id: selectedCheckin?.id || null,
        patient_id: patient.id,
        outcome: reviewOutcome,
        note: reviewNote,
        clinician_name: clinicianName
      });

      setSaveMsg("Clinical intervention recorded and retained in persistent Hindsight memory!");
      setTimeout(() => setSaveMsg(""), 3500);
      setShowReviewModal(false);
      setReviewNote("");
      await loadPatientData();
    } catch (e) {
      console.error("Failed to record review:", e);
    } finally {
      setSubmittingReview(false);
    }
  };

  const daysSince = patient?.surgery_date
    ? Math.max(1, Math.floor((Date.now() - new Date(patient.surgery_date).getTime()) / 86400000))
    : null;

  if (loading) {
    return <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading patient dossier…</div>;
  }

  if (!patient) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Patient not found</div>
        <Link to="/patients" style={{ fontSize: 13, color: "var(--brand)", textDecoration: "none" }}>← Back to Patients</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 960, margin: "0 auto", paddingBottom: 40 }}>
      {/* Back Link */}
      <Link to="/" style={{ fontSize: 12, color: "var(--brand)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5, width: "fit-content" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Dashboard
      </Link>

      {/* Toast Notice */}
      {saveMsg && (
        <div className="fade-in" style={{ position: "fixed", top: 24, right: 24, zIndex: 100, background: "#0f172a", color: "#fff", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.24)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 13 }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          {saveMsg}
        </div>
      )}

      {/* PATIENT HEADER CARD */}
      <div className="card fade-up" style={{ padding: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ width: 62, height: 62, borderRadius: 18, flexShrink: 0, background: "linear-gradient(135deg,#0f766e,#06b6d4)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, boxShadow: "0 6px 20px rgba(15,118,110,0.25)" }}>
            {patient.name?.charAt(0).toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              {patient.name}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 3 }}>
              {patient.phone} · Patient #{patient.id}
              {daysSince !== null && (
                <span style={{ marginLeft: 8, background: "var(--brand-light)", color: "var(--brand)", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                  Day {daysSince} post-surgery
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <MonitoringStatusBadge status={patient.monitoring_status} />
            <RiskBadge level={patient.risk_level} />
            <TrendBadge trend={patient.trend || checkinSummary?.latest?.trend} />

            {/* Monitoring Status Controls */}
            {patient.monitoring_status !== "active" ? (
              <button
                onClick={() => handleStatusChange("active")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  background: "rgba(16,185,129,0.12)",
                  color: "#059669",
                  border: "1px solid rgba(16,185,129,0.25)",
                  cursor: "pointer"
                }}
              >
                ▶ Activate Monitoring
              </button>
            ) : (
              <button
                onClick={() => handleStatusChange("paused")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  background: "rgba(245,158,11,0.12)",
                  color: "#d97706",
                  border: "1px solid rgba(245,158,11,0.25)",
                  cursor: "pointer"
                }}
              >
                ⏸ Pause
              </button>
            )}

            {patient.monitoring_status !== "completed" && (
              <button
                onClick={() => handleStatusChange("completed")}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  background: "rgba(99,102,241,0.12)",
                  color: "#4f46e5",
                  border: "1px solid rgba(99,102,241,0.25)",
                  cursor: "pointer"
                }}
              >
                ✓ Complete Plan
              </button>
            )}

            {/* 10-Day Recovery Report Button */}
            <button
              onClick={handleOpenReport}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11.5,
                fontWeight: 700,
                padding: "8px 12px",
                borderRadius: 8,
                background: "var(--brand-light)",
                color: "var(--brand)",
                border: "1px solid var(--brand-mid)",
                cursor: "pointer"
              }}
            >
              📋 10-Day Report
            </button>

            {/* Record Clinical Review Action */}
            <button
              className="btn-primary"
              onClick={() => openReviewModal(null)}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, padding: "8px 12px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Clinical Review / Intervention
            </button>

            {/* Download PDF button */}
            <button className="btn-ghost" onClick={handleDownloadReport} disabled={generating} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {generating ? "Generating…" : "PDF Report"}
            </button>

            <button className="btn-ghost" onClick={() => { setEditing((v) => !v); setForm(patient); setErrors({}); }} style={{ fontSize: 11.5 }}>
              {editing ? "Cancel" : "Edit Details"}
            </button>
          </div>
        </div>

        {editing ? (
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: "var(--text-primary)" }}>Edit Clinical Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { key: "name", label: "Full Name", type: "text", placeholder: "Patient name" },
                { key: "phone", label: "Phone Number", type: "tel", placeholder: "10-digit number" },
                { key: "procedure", label: "Procedure / Surgery", type: "text", placeholder: "e.g. Knee Replacement" },
                { key: "surgery_date", label: "Surgery Date", type: "date", placeholder: "" },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase" }}>{label}</label>
                  <input
                    type={type}
                    className="aura-input"
                    placeholder={placeholder}
                    value={form[key] || ""}
                    onChange={(e) => handleChange(key, e.target.value)}
                    style={{ borderColor: errors[key] ? "var(--danger-dot)" : undefined }}
                  />
                  <FieldError msg={errors[key]} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: 5, textTransform: "uppercase" }}>Risk Override</label>
                <select className="aura-input" value={form.risk_level || "Low"} onChange={(e) => handleChange("risk_level", e.target.value)}>
                  <option value="Low">🟢 Low — Stable</option>
                  <option value="High">🟡 High — Monitor closely</option>
                  <option value="Critical">🔴 Critical — Urgent</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button className="btn-ghost" onClick={() => { setEditing(false); setForm(patient); setErrors({}); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, background: "var(--surface)", padding: 14, borderRadius: 12, border: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Procedure</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginTop: 3 }}>{patient.procedure || patient.procedure_name || "General Surgery"}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Surgery Date</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginTop: 3 }}>
                {patient.surgery_date ? new Date(patient.surgery_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Last Check-in</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginTop: 3 }}>
                {patient.last_checkin ? new Date(patient.last_checkin).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "None recorded"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Check-ins Logged</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)", marginTop: 3 }}>
                {checkins.length} completed
              </div>
            </div>
          </div>
        )}
      </div>

      {/* POST-SURGERY RECOVERY TIMELINE */}
      <div className="card fade-up" style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
              Post-Surgery Recovery Timeline
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
              Longitudinal tracking: daily check-in deltas, Hindsight comparisons, and trend detection
            </div>
          </div>

          <Link
            to="/workflows"
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--brand)",
              background: "var(--brand-light)",
              border: "1px solid var(--brand-mid)",
              padding: "6px 10px",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            + Simulate Check-in
          </Link>
        </div>

        {checkins.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", background: "var(--surface)", borderRadius: 12 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📅</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
              No check-ins recorded yet
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", maxWidth: 440, margin: "0 auto 14px" }}>
              Daily follow-up is scheduled for Day 1 through Day 30 post-surgery. You can simulate Day 1 using the Check-in Simulator.
            </div>
            <Link to="/workflows" className="btn-primary" style={{ display: "inline-flex", textDecoration: "none", fontSize: 12, padding: "8px 14px" }}>
              Launch Check-in Simulator →
            </Link>
          </div>
        ) : (
          <div style={{ position: "relative", paddingLeft: 20 }}>
            {/* Vertical Timeline Guide Line */}
            <div
              style={{
                position: "absolute",
                top: 15,
                bottom: 15,
                left: 28,
                width: 2,
                background: "var(--border-md)",
                zIndex: 0,
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {checkins.map((chk, index) => {
                const painDelta = chk.pain_delta;
                const isCritical = chk.risk_level === "Critical";
                const isHigh = chk.risk_level === "High";
                const borderAccent = isCritical ? "#f43f5e" : isHigh ? "#f59e0b" : "var(--border)";

                return (
                  <div
                    key={chk.id || index}
                    style={{
                      position: "relative",
                      zIndex: 1,
                      display: "flex",
                      gap: 16,
                    }}
                  >
                    {/* Node Dot / Day Indicator */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: isCritical
                          ? "rgba(244,63,94,0.15)"
                          : isHigh
                          ? "rgba(245,158,11,0.15)"
                          : "var(--card)",
                        border: `2.5px solid ${isCritical ? "#f43f5e" : isHigh ? "#f59e0b" : "#0f766e"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 11,
                        color: isCritical ? "#be123c" : isHigh ? "#b45309" : "#0f766e",
                        flexShrink: 0,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      }}
                    >
                      D{chk.day}
                    </div>

                    {/* Check-in Content Card */}
                    <div
                      style={{
                        flex: 1,
                        background: "var(--card)",
                        border: `1.5px solid ${borderAccent}`,
                        borderRadius: 14,
                        padding: 16,
                        boxShadow: "0 3px 12px rgba(0,0,0,0.04)",
                      }}
                    >
                      {/* Top Bar of Card */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>
                            Recovery Day {chk.day}
                          </span>
                          <RiskBadge level={chk.risk_level} />
                          <TrendBadge trend={chk.trend} />
                        </div>

                        <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                          {chk.completed_at || chk.created_at
                            ? new Date(chk.completed_at || chk.created_at).toLocaleString("en-IN", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </div>
                      </div>

                      {/* Physical Metrics Grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        {/* Pain Score */}
                        <div style={{ background: "var(--surface)", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Pain Score</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: chk.pain >= 7 ? "#dc2626" : "var(--text-primary)", marginTop: 2 }}>
                            {chk.pain}/10
                            {painDelta !== null && painDelta !== undefined && (
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  marginLeft: 6,
                                  color: painDelta > 0 ? "#dc2626" : painDelta < 0 ? "#16a34a" : "var(--text-muted)",
                                }}
                              >
                                {painDelta > 0 ? `↑ +${painDelta}` : painDelta < 0 ? `↓ ${painDelta}` : "↔ no change"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Mobility */}
                        <div style={{ background: "var(--surface)", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Mobility</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>
                            {chk.mobility || "Not recorded"}
                          </div>
                        </div>

                        {/* Swelling */}
                        <div style={{ background: "var(--surface)", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Swelling</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: chk.swelling === "severe" ? "#dc2626" : "var(--text-primary)", marginTop: 2 }}>
                            {chk.swelling ? chk.swelling.charAt(0).toUpperCase() + chk.swelling.slice(1) : "None"}
                          </div>
                        </div>

                        {/* Fever */}
                        <div style={{ background: "var(--surface)", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Fever</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: chk.fever ? "#dc2626" : "#16a34a", marginTop: 2 }}>
                            {chk.fever ? "🚨 Yes (Fever >100.4°F)" : "✓ No Fever"}
                          </div>
                        </div>
                      </div>

                      {/* Patient message / symptoms */}
                      {(chk.message || chk.symptoms) && (
                        <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5, background: "rgba(0,0,0,0.02)", padding: "8px 10px", borderRadius: 8 }}>
                          <strong>Patient note:</strong> "{chk.message || chk.symptoms}"
                        </div>
                      )}

                      {/* Hindsight Summary Panel */}
                      {chk.hindsight_summary && (
                        <div
                          style={{
                            background: "linear-gradient(135deg, rgba(8,51,68,0.04), rgba(15,118,110,0.06))",
                            border: "1px solid rgba(15,118,110,0.18)",
                            borderRadius: 10,
                            padding: "10px 12px",
                            marginBottom: 8,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 800, color: "#0f766e", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                            <span>🧠</span> HINDSIGHT LONGITUDINAL RECALL
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--text-primary)", lineHeight: 1.5 }}>
                            {chk.hindsight_summary}
                          </div>
                        </div>
                      )}

                      {/* Clinical explanation */}
                      {chk.explanation && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.45, marginTop: 4 }}>
                          <strong style={{ color: "var(--text-secondary)" }}>Clinical rationale:</strong> {chk.explanation}
                        </div>
                      )}

                      {/* Action to review */}
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                        <button
                          className="btn-ghost"
                          onClick={() => openReviewModal(chk)}
                          style={{ fontSize: 11, padding: "4px 8px", color: "var(--brand)" }}
                        >
                          Record Review for Day {chk.day} →
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* SMS History Card */}
      <div className="card fade-up">
        <div className="card-header">
          <div>
            <div className="card-title">Daily WhatsApp / SMS Notification Log</div>
            <div className="card-subtitle">Automated daily check-in triggers sent to {patient.name}</div>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{smsLog.length} message{smsLog.length !== 1 ? "s" : ""}</span>
        </div>
        {smsLoading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Loading messages…</div>
        ) : smsLog.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📱</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>No automated messages triggered yet</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Triggers fire daily at 9:00 AM via cron or manual simulator</div>
          </div>
        ) : (
          <table className="aura-table">
            <thead><tr><th>Day</th><th>Status</th><th>Notification Text</th><th>Sent At</th></tr></thead>
            <tbody>
              {smsLog.map((log) => (
                <tr key={log.id}>
                  <td><span style={{ background: "var(--brand-light)", color: "var(--brand)", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>Day {log.day_number}</span></td>
                  <td><span className={log.status === "sent" ? "badge badge-success" : "badge badge-danger"}>{log.status}</span></td>
                  <td style={{ fontSize: 11, color: "var(--text-secondary)", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.message}</td>
                  <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{log.sent_at ? new Date(log.sent_at).toLocaleString("en-IN") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Danger Zone */}
      <div className="card fade-up" style={{ border: "1px solid var(--danger-border)", padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--danger-text)", marginBottom: 4, display: "flex", alignItems: "center", gap: 7 }}>
          ⚠️ Danger Zone
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Permanently remove this patient and their complete recovery history.</div>
          <button className="btn-danger" onClick={handleDelete} style={{ fontSize: 12, padding: "7px 12px" }}>Delete Patient</button>
        </div>
      </div>

      {/* CLINICAL REVIEW / INTERVENTION MODAL */}
      {showReviewModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setShowReviewModal(false)}
        >
          <div
            className="card fade-up"
            style={{
              maxWidth: 520,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
                Record Clinical Review & Intervention
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
              Your clinical determination is evaluated with past longitudinal memory and stored into persistent Hindsight memory.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                  Attending Clinician
                </label>
                <input
                  className="aura-input"
                  value={clinicianName}
                  onChange={(e) => setClinicianName(e.target.value)}
                  placeholder="e.g. Dr. Staff"
                />
              </div>

              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                  Clinical Outcome
                </label>
                <select
                  className="aura-input"
                  value={reviewOutcome}
                  onChange={(e) => setReviewOutcome(e.target.value)}
                >
                  <option value="Confirmed concern">🚨 Confirmed Concern (Elevate Risk)</option>
                  <option value="False alarm">🟢 False Alarm (Reset Risk to Low)</option>
                  <option value="Resolved">✓ Resolved (Condition Addressed)</option>
                  <option value="Medication adjusted">💊 Medication / Pain Protocol Adjusted</option>
                  <option value="Hospital visit recommended">🏥 Hospital Visit Recommended</option>
                  <option value="Routine recovery ongoing">📋 Routine Recovery Ongoing</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                Clinical Assessment Notes
              </label>
              <textarea
                className="aura-input"
                rows="4"
                placeholder="e.g. Telephonic review conducted. Verified wound is dry. Prescribed oral analgesic adjustment. Retained in Hindsight."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                style={{ resize: "vertical", minHeight: 90 }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button className="btn-ghost" onClick={() => setShowReviewModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleRecordReview}
                disabled={submittingReview}
                style={{ opacity: submittingReview ? 0.7 : 1 }}
              >
                {submittingReview ? "Saving…" : "Save Clinical Decision"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10-DAY RECOVERY REPORT MODAL */}
      {showReportModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setShowReportModal(false)}
        >
          <div
            className="card fade-up"
            style={{
              maxWidth: 680,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 26,
              boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>📋</span>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
                    10-Day Periodic Recovery Report
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  {patient.name} · {patient.procedure || "Surgery"} · ID #{patient.id}
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            {loadingReport ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Generating comprehensive 10-day recovery analysis…
              </div>
            ) : !reportData ? (
              <div style={{ padding: 30, textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No report generated yet.</p>
                <button className="btn-primary" onClick={handleGenerateReport}>Generate 10-Day Report Now</button>
              </div>
            ) : (
              <div>
                {/* Metrics Summary Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Check-in Adherence</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#0f766e", marginTop: 4 }}>
                      {reportData.metrics?.completion_adherence || 100}%
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {reportData.metrics?.total_checkins || checkins.length} check-ins completed
                    </div>
                  </div>

                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Pain Trajectory</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>
                      {reportData.metrics?.starting_pain ?? 4}/10 → {reportData.metrics?.ending_pain ?? 1}/10
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      Avg Pain: {reportData.metrics?.average_pain ?? 2}/10
                    </div>
                  </div>

                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Mobility Status</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#16a34a", marginTop: 4, textTransform: "capitalize" }}>
                      {reportData.metrics?.mobility_progression || "Progressive"}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      Fever reports: {reportData.metrics?.fever_episodes || 0}
                    </div>
                  </div>
                </div>

                {/* Narrative Box */}
                <div style={{ background: "rgba(15,118,110,0.06)", border: "1px solid rgba(15,118,110,0.2)", borderRadius: 12, padding: 16, marginBottom: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, color: "#0f766e", textTransform: "uppercase", marginBottom: 6 }}>
                    <span>🧠</span> Clinical Trajectory Narrative (Hindsight Engine)
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.6, margin: 0 }}>
                    {reportData.clinical_trajectory_narrative}
                  </p>
                </div>

                {/* Complications & Reviews Summary */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 20 }}>
                  <div><strong>Clinical Alerts Recorded:</strong> {reportData.alerts_count || 0} alerts</div>
                  <div><strong>Clinician Interventions:</strong> {reportData.reviews_count || 0} recorded reviews</div>
                  <div><strong>Report Timestamp:</strong> {reportData.generated_at ? new Date(reportData.generated_at).toLocaleString("en-IN") : "Recent"}</div>
                </div>

                {/* Report Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn-primary"
                      onClick={handleSendWhatsAppReport}
                      disabled={waSending}
                      style={{ fontSize: 11.5, padding: "8px 12px", display: "flex", alignItems: "center", gap: 5 }}
                    >
                      📱 {waSending ? "Sending…" : "Send to Patient WhatsApp"}
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={handleGenerateReport}
                      disabled={loadingReport}
                      style={{ fontSize: 11.5 }}
                    >
                      🔄 Regenerate Analysis
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn-ghost" onClick={handleDownloadReport} style={{ fontSize: 11.5 }}>
                      🖨️ PDF Report
                    </button>
                    <button className="btn-ghost" onClick={() => setShowReportModal(false)}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}