import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../caretraceApi";

const DEMO_SCENARIOS = [
  {
    name: "Step 1 · Day 1 Baseline (Knee Replacement)",
    day: 1,
    pain: 4,
    mobility: "Same",
    swelling: "Mild",
    fever: 0,
    symptoms: "Mild soreness around dressing, resting in bed. Baseline established.",
  },
  {
    name: "Step 2 · Day 2 Normal Recovery",
    day: 2,
    pain: 3,
    mobility: "Better",
    swelling: "None",
    fever: 0,
    symptoms: "Able to walk to bathroom with walker, pain manageable.",
  },
  {
    name: "Step 3 · Day 3 Acute Deterioration (Triggers Alert)",
    day: 3,
    pain: 7,
    mobility: "Worse",
    swelling: "Moderate",
    fever: 1,
    symptoms: "Incision is noticeably warm and painful, feeling chills since morning, slight fluid leakage.",
  },
  {
    name: "Step 4 · Day 4 Post-Intervention Improvement",
    day: 4,
    pain: 4,
    mobility: "Better",
    swelling: "Mild",
    fever: 0,
    symptoms: "Fever gone after medication, walking easier, swelling reduced.",
  },
];

const PROCEDURE_HINTS = {
  "knee replacement": "Monitored signs: Joint flexion, weight-bearing tolerance, calf tenderness, knee effusion.",
  "hip replacement": "Monitored signs: Ambulation stability, groin pain, limb length perception, hematoma.",
  "appendectomy": "Monitored signs: Abdominal distension, nausea, incision redness, bowel function return.",
  "cardiac bypass": "Monitored signs: Sternal stability, shortness of breath, leg graft site swelling, chest heaviness.",
};

const riskStyles = {
  Low: {
    background: "rgba(34,197,94,0.12)",
    color: "#16a34a",
    border: "rgba(34,197,94,0.25)",
    dot: "#10b981",
  },
  High: {
    background: "rgba(245,158,11,0.12)",
    color: "#b45309",
    border: "rgba(245,158,11,0.25)",
    dot: "#f59e0b",
  },
  Critical: {
    background: "rgba(244,63,94,0.14)",
    color: "#be123c",
    border: "rgba(244,63,94,0.3)",
    dot: "#f43f5e",
  },
};

export default function Workflows() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [form, setForm] = useState({
    patient_id: "",
    day: 1,
    pain: 5,
    mobility: "Same",
    swelling: "Mild",
    fever: 0,
    symptoms: "",
    message: "",
  });

  const [memory, setMemory] = useState(true);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadPatients = useCallback(async () => {
    try {
      const res = await API.get("/patients");
      setPatients(res.data);
      if (res.data[0]) {
        setSelectedPatient(res.data[0]);
        setForm((f) => ({
          ...f,
          patient_id: res.data[0].id,
          day: res.data[0].current_day || 1,
        }));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const handlePatientChange = (patientId) => {
    const found = patients.find((p) => String(p.id) === String(patientId));
    setSelectedPatient(found || null);
    setForm((f) => ({
      ...f,
      patient_id: patientId,
      day: found?.current_day || 1,
    }));
  };

  const applyScenario = (scen) => {
    setForm((f) => ({
      ...f,
      day: scen.day,
      pain: scen.pain,
      mobility: scen.mobility,
      swelling: scen.swelling,
      fever: scen.fever,
      symptoms: scen.symptoms,
      message: scen.symptoms,
    }));
  };

  const sendCheckin = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await API.post("/checkins", {
        patient_id: Number(form.patient_id),
        day: Number(form.day),
        pain: Number(form.pain),
        mobility: form.mobility,
        swelling: form.swelling,
        fever: Number(form.fever),
        symptoms: form.symptoms,
        message: form.message || form.symptoms,
        memory: memory ? "on" : "off",
      });

      setResult(res.data);
      // Refresh patient list to update current day and risk
      await loadPatients();
    } catch (e) {
      setError(
        e.response?.data?.error || e.message || "Failed to process check-in."
      );
    } finally {
      setLoading(false);
    }
  };

  const risk = result?.risk_level && riskStyles[result.risk_level]
    ? riskStyles[result.risk_level]
    : riskStyles.Low;

  const procHintKey = Object.keys(PROCEDURE_HINTS).find((k) =>
    (selectedPatient?.procedure || selectedPatient?.procedure_name || "")
      .toLowerCase()
      .includes(k)
  );

  return (
    <div style={{ maxWidth: 1050, margin: "0 auto", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span className="pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "#0f766e" }} />
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#0f766e" }}>
              DEMO & TESTING HARNESS
            </span>
          </div>

          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-.03em" }}>
            Check-in Simulator
          </h1>

          <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
            Simulate sequential post-surgery daily check-ins to test longitudinal Hindsight recall, trend calculation, and automatic alert generation.
          </p>
        </div>

        {/* Hindsight indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: memory ? "rgba(16,185,129,0.1)" : "var(--surface)", border: `1px solid ${memory ? "rgba(16,185,129,0.3)" : "var(--border)"}`, color: memory ? "#047857" : "var(--text-muted)" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: memory ? "#10b981" : "#94a3b8" }} />
          <span style={{ fontSize: 11, fontWeight: 800 }}>HINDSIGHT ENGINE: {memory ? "ACTIVE" : "OFF"}</span>
        </div>
      </div>

      {/* Simulator Form Card */}
      <div className="card fade-up" style={{ padding: 24, marginBottom: 20 }}>
        {/* Scenario Quick-Picks */}
        <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
            1-Click Demonstration Scenarios
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {DEMO_SCENARIOS.map((scen, idx) => (
              <button
                key={idx}
                type="button"
                className="btn-ghost"
                onClick={() => applyScenario(scen)}
                style={{ fontSize: 11.5, padding: "6px 12px", background: "var(--surface)", fontWeight: 700 }}
              >
                {scen.name}
              </button>
            ))}
          </div>
        </div>

        {/* Patient Selection & Day */}
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr", gap: 14, marginBottom: 18 }}>
          <div>
            <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
              Select Patient
            </label>
            <select
              className="aura-input"
              value={form.patient_id}
              onChange={(e) => handlePatientChange(e.target.value)}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.procedure || p.procedure_name || "General"} (Surgery: {p.surgery_date || "N/A"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
              Recovery Day
            </label>
            <input
              type="number"
              min="1"
              max="90"
              className="aura-input"
              value={form.day}
              onChange={(e) => setForm({ ...form, day: e.target.value })}
            />
          </div>
        </div>

        {/* Procedure specific hint */}
        {selectedPatient && (
          <div style={{ background: "rgba(15,118,110,0.06)", border: "1px solid rgba(15,118,110,0.18)", borderRadius: 10, padding: "10px 14px", marginBottom: 18, fontSize: 11.5, color: "#0f766e" }}>
            <strong>Procedure Context:</strong> {selectedPatient.procedure || selectedPatient.procedure_name || "General Surgery"}
            <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>
              {procHintKey ? PROCEDURE_HINTS[procHintKey] : "Standard post-operative recovery metrics apply."}
            </span>
          </div>
        )}

        {/* Daily Recovery Questions (Section 4 of Architecture) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 18 }}>
          {/* Pain Score */}
          <div style={{ background: "var(--surface)", padding: 14, borderRadius: 12, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>
                1. Pain Score (1-10)
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: form.pain >= 7 ? "#dc2626" : "var(--brand)" }}>
                {form.pain} / 10
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={form.pain}
              onChange={(e) => setForm({ ...form, pain: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "#0f766e", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "var(--text-muted)", marginTop: 2 }}>
              <span>0 (None)</span>
              <span>5 (Moderate)</span>
              <span>10 (Severe)</span>
            </div>
          </div>

          {/* Mobility */}
          <div style={{ background: "var(--surface)", padding: 14, borderRadius: 12, border: "1px solid var(--border)" }}>
            <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
              2. Mobility
            </label>
            <select
              className="aura-input"
              value={form.mobility}
              onChange={(e) => setForm({ ...form, mobility: e.target.value })}
            >
              <option value="Better">🟢 Better (Improved movement)</option>
              <option value="Same">🟡 Same (Expected baseline)</option>
              <option value="Worse">🔴 Worse (Restricted / Deteriorating)</option>
            </select>
          </div>

          {/* Swelling */}
          <div style={{ background: "var(--surface)", padding: 14, borderRadius: 12, border: "1px solid var(--border)" }}>
            <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
              3. Swelling
            </label>
            <select
              className="aura-input"
              value={form.swelling}
              onChange={(e) => setForm({ ...form, swelling: e.target.value })}
            >
              <option value="None">🟢 None</option>
              <option value="Mild">🟡 Mild</option>
              <option value="Moderate">🟠 Moderate</option>
              <option value="Severe">🔴 Severe (Tense / Edematous)</option>
            </select>
          </div>

          {/* Fever */}
          <div style={{ background: "var(--surface)", padding: 14, borderRadius: 12, border: "1px solid var(--border)" }}>
            <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
              4. Fever Status
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setForm({ ...form, fever: 0 })}
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  border: Number(form.fever) === 0 ? "2px solid #16a34a" : "1px solid var(--border)",
                  background: Number(form.fever) === 0 ? "rgba(34,197,94,0.15)" : "var(--card)",
                  color: Number(form.fever) === 0 ? "#16a34a" : "var(--text-secondary)",
                }}
              >
                ✓ No Fever
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, fever: 1 })}
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  border: Number(form.fever) === 1 ? "2px solid #dc2626" : "1px solid var(--border)",
                  background: Number(form.fever) === 1 ? "rgba(239,68,68,0.15)" : "var(--card)",
                  color: Number(form.fever) === 1 ? "#dc2626" : "var(--text-secondary)",
                }}
              >
                🚨 Fever &gt; 100.4°
              </button>
            </div>
          </div>
        </div>

        {/* Symptoms & Notes */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
            5. Patient Notes / Free Text Symptoms
          </label>
          <textarea
            className="aura-input"
            rows="3"
            placeholder="e.g. Incision dressing dry, slight redness, pain manageable with paracetamol..."
            value={form.symptoms}
            onChange={(e) => setForm({ ...form, symptoms: e.target.value, message: e.target.value })}
            style={{ resize: "vertical" }}
          />
        </div>

        {/* Bottom action bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 11.5, color: "var(--text-secondary)" }}>
            <input
              type="checkbox"
              checked={memory}
              onChange={(e) => setMemory(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#0f766e" }}
            />
            <span>Include Hindsight longitudinal recall in assessment</span>
          </label>

          <button
            onClick={sendCheckin}
            disabled={loading}
            className="btn-primary"
            style={{ fontSize: 12.5, padding: "10px 18px", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Analysing with Hindsight…" : "Simulate Recovery Check-in →"}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", color: "#be123c", borderRadius: 10, padding: "12px 16px", marginBottom: 18, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Simulation Result */}
      {result && (
        <div className="card fade-up" style={{ padding: 24, border: `2px solid ${result.alert ? "#f43f5e" : "#0f766e"}` }}>
          {/* Real-time Alert Notification Banner */}
          {result.alert && (
            <div
              style={{
                background: "linear-gradient(135deg, rgba(244,63,94,0.12), rgba(244,63,94,0.06))",
                border: "1.5px solid #f43f5e",
                borderRadius: 12,
                padding: "14px 18px",
                marginBottom: 20,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#be123c", fontWeight: 800, fontSize: 14 }}>
                  <span>🚨</span> {result.alert.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-primary)", marginTop: 4 }}>
                  {result.alert.message}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <Link
                  to="/alerts"
                  className="btn-primary"
                  style={{ background: "#be123c", borderColor: "#be123c", fontSize: 11, padding: "7px 12px", textDecoration: "none" }}
                >
                  View Alerts Page →
                </Link>
                <Link
                  to={`/patients/${result.patient_id}`}
                  className="btn-ghost"
                  style={{ fontSize: 11, padding: "7px 12px", textDecoration: "none" }}
                >
                  View Patient Timeline →
                </Link>
              </div>
            </div>
          )}

          {/* Assessment Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid var(--border)" }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                ASSESSMENT OUTPUT (DAY {result.day})
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: risk.background,
                    color: risk.color,
                    border: `1px solid ${risk.border}`,
                    fontWeight: 800,
                    fontSize: 12,
                    textTransform: "uppercase",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: risk.dot }} />
                  Risk Level: {result.risk_level}
                </span>

                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 12px",
                    borderRadius: 999,
                    background:
                      result.trend === "improving"
                        ? "rgba(34,197,94,0.12)"
                        : result.trend === "worsening"
                        ? "rgba(239,68,68,0.12)"
                        : "var(--surface)",
                    color:
                      result.trend === "improving"
                        ? "#16a34a"
                        : result.trend === "worsening"
                        ? "#dc2626"
                        : "var(--text-secondary)",
                    fontWeight: 800,
                    fontSize: 12,
                    textTransform: "uppercase",
                  }}
                >
                  {result.trend === "improving" ? "↓" : result.trend === "worsening" ? "↑" : "↔"} Trend: {result.trend}
                </span>

                {result.pain_delta !== null && result.pain_delta !== undefined && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700 }}>
                    Pain Delta: {result.pain_delta >= 0 ? `+${result.pain_delta}` : result.pain_delta} pts
                  </span>
                )}
              </div>
            </div>

            <Link
              to={`/patients/${result.patient_id}`}
              style={{ fontSize: 12, color: "var(--brand)", fontWeight: 700, textDecoration: "none" }}
            >
              Open Full Patient Timeline →
            </Link>
          </div>

          {/* HINDSIGHT ENGINE SUMMARY BOX (Section 7 of Architecture) */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(8,51,68,0.06), rgba(15,118,110,0.08))",
              border: "1px solid rgba(15,118,110,0.25)",
              borderRadius: 12,
              padding: 18,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 800, color: "#0f766e", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
              <span>🧠</span> HINDSIGHT SUMMARY & LONGITUDINAL COMPARISON
            </div>

            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6, fontWeight: 500 }}>
              {result.hindsight_summary}
            </div>

            {/* Side-by-side snapshot if previous check-in was recalled */}
            {result.previous_snapshot && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(15,118,110,0.15)" }}>
                <div style={{ background: "rgba(255,255,255,0.7)", padding: 10, borderRadius: 8, fontSize: 11.5 }}>
                  <div style={{ fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", fontSize: 10, marginBottom: 4 }}>
                    Earlier Baseline:
                  </div>
                  <div>• Pain: {result.previous_snapshot.pain}/10</div>
                  <div>• Swelling: {result.previous_snapshot.swelling}</div>
                  <div>• Fever: {result.previous_snapshot.fever}</div>
                </div>

                <div style={{ background: "rgba(255,255,255,0.7)", padding: 10, borderRadius: 8, fontSize: 11.5 }}>
                  <div style={{ fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", fontSize: 10, marginBottom: 4 }}>
                    Today's Observation:
                  </div>
                  <div>• Pain: {result.current_snapshot?.pain}/10</div>
                  <div>• Swelling: {result.current_snapshot?.swelling}</div>
                  <div>• Fever: {result.current_snapshot?.fever}</div>
                </div>
              </div>
            )}
          </div>

          {/* Clinical Rationale */}
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            <strong>Configured Clinical Rationale:</strong> {result.explanation}
          </div>
        </div>
      )}
    </div>
  );
}