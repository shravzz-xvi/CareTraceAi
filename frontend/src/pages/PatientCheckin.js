import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getPatient, getPatientQuestions, submitCheckin } from "../api";

export default function PatientCheckin() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [procedureData, setProcedureData] = useState(null);
  const [treatmentAnswers, setTreatmentAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Form State
  const [pain, setPain] = useState(3);
  const [mobility, setMobility] = useState("Same");
  const [swelling, setSwelling] = useState("Mild");
  const [fever, setFever] = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [notes, setNotes] = useState("");

  const QUICK_TAGS = [
    "Wound clean and dry",
    "Took medication on time",
    "Mild stiffness",
    "Feeling dizzy or nauseous",
    "Redness around wound",
    "Calf or lower leg soreness",
  ];

  useEffect(() => {
    let isMounted = true;
    async function fetchPatientData() {
      try {
        setLoading(true);
        const [patRes, qRes] = await Promise.allSettled([
          getPatient(id, { skipAuthRedirect: true }),
          getPatientQuestions(id)
        ]);

        if (patRes.status === "fulfilled" && isMounted) {
          setPatient(patRes.value);
          setError(null);
        } else if (isMounted) {
          setError("Unable to load recovery record. Please check your link or contact the hospital.");
        }

        if (qRes.status === "fulfilled" && isMounted && qRes.value) {
          setProcedureData(qRes.value);
          const rawQuestions = qRes.value.questions || qRes.value.treatment_specific_questions || [];
          const specific = rawQuestions.filter(
            (q) => !["pain", "mobility", "swelling", "fever", "symptoms"].includes(q.id)
          );
          if (specific.length > 0) {
            const defaults = {};
            specific.forEach((q, idx) => {
              const qKey = q.id || `q_${idx}`;
              if (q.options && q.options.length > 0) {
                defaults[qKey] = q.options[0];
              }
            });
            setTreatmentAnswers(defaults);
          }
        }
      } catch (err) {
        console.error("Failed to load patient:", err);
        if (isMounted) setError("Unable to load recovery record. Please check your link or contact the hospital.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchPatientData();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleTreatmentChange = (questionId, optionVal) => {
    setTreatmentAnswers((prev) => ({
      ...prev,
      [questionId]: optionVal
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patient) return;

    setSubmitting(true);
    setError(null);

    const treatmentAnswersList = Object.entries(treatmentAnswers)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" | ");

    const fullSymptoms = [
      ...selectedTags,
      treatmentAnswersList ? `[Specific Responses: ${treatmentAnswersList}]` : "",
      notes.trim()
    ].filter(Boolean).join(". ");

    try {
      const response = await submitCheckin(
        {
          patient_id: patient.id,
          day: patient.current_day || 1,
          pain: Number(pain),
          mobility,
          swelling,
          fever: Number(fever),
          symptoms: fullSymptoms,
          treatment_answers: treatmentAnswers,
          message: notes.trim() || `Day ${patient.current_day || 1} check-in submitted via WhatsApp link.`
        },
        { skipAuthRedirect: true }
      );

      setResult(response);
    } catch (err) {
      console.error("Submission failed:", err);
      setError("Failed to submit check-in. Please try again or reach your hospital helpline.");
    } finally {
      setSubmitting(false);
    }
  };

  const getPainDescriptor = (p) => {
    if (p === 0) return { label: "No Pain", emoji: "😄", color: "#16a34a" };
    if (p <= 3) return { label: "Mild Discomfort", emoji: "🙂", color: "#22c55e" };
    if (p <= 6) return { label: "Moderate Pain", emoji: "😐", color: "#f59e0b" };
    if (p <= 8) return { label: "Severe Pain", emoji: "😣", color: "#ea580c" };
    return { label: "Extreme Pain", emoji: "😫", color: "#dc2626" };
  };

  const currentPainMeta = getPainDescriptor(Number(pain));

  if (loading) {
    return (
      <div style={pageStyles.container}>
        <div style={pageStyles.card}>
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={pageStyles.spinner} />
            <h2 style={{ fontSize: 18, color: "var(--text-primary, #0f172a)", marginTop: 16 }}>
              Loading your recovery check-in…
            </h2>
            <p style={{ color: "var(--text-muted, #64748b)", fontSize: 13, marginTop: 6 }}>
              Connecting to hospital care network
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !patient) {
    return (
      <div style={pageStyles.container}>
        <div style={pageStyles.card}>
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 18, color: "#dc2626", fontWeight: 800 }}>Check-in Not Available</h2>
            <p style={{ color: "var(--text-secondary, #334155)", fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
              {error}
            </p>
            <div style={{ marginTop: 24 }}>
              <a href="tel:108" style={pageStyles.emergencyBtn}>
                📞 Emergency Helpline
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Submission Complete View
  if (result) {
    const isWorsening = result.trend === "worsening" || result.risk_level === "Critical" || result.risk_level === "High";

    return (
      <div style={pageStyles.container}>
        <div style={{ ...pageStyles.card, maxWidth: 540 }}>
          {/* Header Banner */}
          <div
            style={{
              padding: "24px 20px",
              background: isWorsening
                ? "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
                : "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
              color: "#ffffff",
              borderRadius: "16px 16px 0 0",
              textAlign: "center"
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 8 }}>
              {isWorsening ? "⚠️" : "✅"}
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
              {isWorsening ? "Check-in Logged — Clinical Alert Triggered" : "Check-in Successfully Recorded"}
            </h1>
            <p style={{ fontSize: 12.5, opacity: 0.9, marginTop: 6, margin: 0 }}>
              Day {result.day} Post-Op · {patient.name}
            </p>
          </div>

          <div style={{ padding: 24 }}>
            {/* Trend & Risk Summary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
                textAlign: "center",
                marginBottom: 20
              }}
            >
              <div style={pageStyles.miniMetric}>
                <span style={pageStyles.miniMetricLabel}>Recorded Pain</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: currentPainMeta.color }}>
                  {pain} / 10
                </span>
                <span style={{ fontSize: 10, color: "var(--text-muted, #64748b)" }}>
                  {result.pain_delta !== null
                    ? `Delta: ${result.pain_delta > 0 ? "+" : ""}${result.pain_delta}`
                    : "Baseline"}
                </span>
              </div>

              <div style={pageStyles.miniMetric}>
                <span style={pageStyles.miniMetricLabel}>Mobility</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary, #0f172a)", marginTop: 2 }}>
                  {mobility}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-muted, #64748b)" }}>
                  Activity status
                </span>
              </div>

              <div style={pageStyles.miniMetric}>
                <span style={pageStyles.miniMetricLabel}>Observed Trend</span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    color: result.trend === "improving" ? "#16a34a" : result.trend === "worsening" ? "#dc2626" : "#2563eb"
                  }}
                >
                  {result.trend}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-muted, #64748b)" }}>
                  Risk: {result.risk_level}
                </span>
              </div>
            </div>

            {/* Hindsight Context Box */}
            <div
              style={{
                background: "rgba(15,118,110,0.06)",
                border: "1px solid rgba(15,118,110,0.2)",
                borderRadius: 12,
                padding: "16px 18px",
                marginBottom: 20
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>🧠</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#0f766e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Hindsight Longitudinal Memory Engine
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary, #334155)", lineHeight: 1.55, margin: 0 }}>
                {result.hindsight_summary || "Baseline established. Your metrics are saved for continuous longitudinal comparison across your recovery journey."}
              </p>
            </div>

            {/* Next Step / Guidance */}
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: isWorsening ? "#fef2f2" : "#f0fdf4",
                border: `1px solid ${isWorsening ? "#fecaca" : "#bbf7d0"}`,
                marginBottom: 24
              }}
            >
              <h3 style={{ fontSize: 13, fontWeight: 800, color: isWorsening ? "#991b1b" : "#166534", margin: "0 0 6px 0" }}>
                {isWorsening ? "📋 Next Care Instructions" : "🎉 Care Team Note"}
              </h3>
              <p style={{ fontSize: 12, color: isWorsening ? "#7f1d1d" : "#14532d", margin: 0, lineHeight: 1.5 }}>
                {isWorsening
                  ? "Your care team at the hospital has been notified of your elevated symptoms. A clinical staff member may contact you. Please keep your leg elevated and rest."
                  : "Thank you for updating your surgical team! Your recovery trajectory is logged. Continue your prescribed recovery protocol and stay hydrated."}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => {
                  setResult(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                style={pageStyles.secondaryBtn}
              >
                ✏️ Edit or Submit Another Update
              </button>

              <div style={{ textAlign: "center", marginTop: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted, #64748b)" }}>
                  Need urgent help? Call hospital care desk at <strong>+91 98765 43210</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyles.container}>
      <div style={{ ...pageStyles.card, maxWidth: 540 }}>
        {/* Header */}
        <div style={pageStyles.header}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={pageStyles.headerChip}>
              🏥 CareTraceAI Patient Portal
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
              WhatsApp Verified
            </span>
          </div>

          <h1 style={{ fontSize: 20, fontWeight: 800, margin: "14px 0 4px 0", color: "#ffffff" }}>
            Hi {patient?.name || "Patient"} 👋
          </h1>
          <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.4 }}>
            Day {patient?.current_day || 1} post-op · {patient?.procedure || patient?.procedure_name || "Surgery Recovery"}
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 22px" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary, #334155)", marginTop: 0, marginBottom: 20, lineHeight: 1.5 }}>
            Please submit your daily recovery status. Your responses are directly compared against your surgical baseline by your hospital care team.
          </p>

          {/* 1. Pain Slider */}
          <div style={pageStyles.section}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={pageStyles.sectionTitle}>
                1. What is your pain level right now?
              </label>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: currentPainMeta.color,
                  background: `${currentPainMeta.color}15`,
                  padding: "3px 10px",
                  borderRadius: 999,
                  border: `1px solid ${currentPainMeta.color}30`
                }}
              >
                {currentPainMeta.emoji} {pain} / 10 ({currentPainMeta.label})
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={pain}
              onChange={(e) => setPain(Number(e.target.value))}
              style={{
                width: "100%",
                accentColor: currentPainMeta.color,
                height: 8,
                cursor: "pointer",
                margin: "12px 0 8px 0"
              }}
            />

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--text-muted, #64748b)" }}>
              <span>0 (No Pain)</span>
              <span>3 (Mild)</span>
              <span>5 (Moderate)</span>
              <span>8 (Severe)</span>
              <span>10 (Extreme)</span>
            </div>
          </div>

          {/* 2. Mobility Status */}
          <div style={pageStyles.section}>
            <label style={pageStyles.sectionTitle}>
              2. How is your mobility today compared to yesterday?
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
              {[
                { val: "Better", icon: "🚶", label: "Better", sub: "Moving easier" },
                { val: "Same", icon: "⚖️", label: "Same", sub: "No change" },
                { val: "Worse", icon: "⚠️", label: "Worse", sub: "More stiffness" },
              ].map((opt) => {
                const active = mobility === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setMobility(opt.val)}
                    style={{
                      padding: "12px 6px",
                      borderRadius: 10,
                      border: active ? "2px solid #0f766e" : "1px solid var(--border, #e2e8f0)",
                      background: active ? "rgba(15,118,110,0.08)" : "var(--surface, #ffffff)",
                      color: active ? "#0f766e" : "var(--text-primary, #0f172a)",
                      fontWeight: active ? 800 : 600,
                      cursor: "pointer",
                      textAlign: "center",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{opt.icon}</div>
                    <div style={{ fontSize: 12 }}>{opt.label}</div>
                    <div style={{ fontSize: 9.5, color: "var(--text-muted, #64748b)", marginTop: 2 }}>{opt.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Swelling */}
          <div style={pageStyles.section}>
            <label style={pageStyles.sectionTitle}>
              3. Is there swelling around the surgical site?
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 10 }}>
              {[
                { val: "None", label: "None", color: "#16a34a" },
                { val: "Mild", label: "Mild", color: "#22c55e" },
                { val: "Moderate", label: "Moderate", color: "#f59e0b" },
                { val: "Severe", label: "Severe", color: "#dc2626" },
              ].map((opt) => {
                const active = swelling === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setSwelling(opt.val)}
                    style={{
                      padding: "10px 4px",
                      borderRadius: 9,
                      border: active ? `2px solid ${opt.color}` : "1px solid var(--border, #e2e8f0)",
                      background: active ? `${opt.color}15` : "var(--surface, #ffffff)",
                      color: active ? opt.color : "var(--text-primary, #0f172a)",
                      fontWeight: active ? 800 : 600,
                      fontSize: 11.5,
                      cursor: "pointer",
                      textAlign: "center"
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Fever */}
          <div style={pageStyles.section}>
            <label style={pageStyles.sectionTitle}>
              4. Have you experienced fever, chills, or high body temperature?
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setFever(0)}
                style={{
                  padding: "11px 12px",
                  borderRadius: 10,
                  border: fever === 0 ? "2px solid #16a34a" : "1px solid var(--border, #e2e8f0)",
                  background: fever === 0 ? "rgba(22,163,74,0.08)" : "var(--surface, #ffffff)",
                  color: fever === 0 ? "#16a34a" : "var(--text-primary, #0f172a)",
                  fontWeight: fever === 0 ? 800 : 600,
                  fontSize: 12.5,
                  cursor: "pointer"
                }}
              >
                🟢 No Fever (Normal)
              </button>

              <button
                type="button"
                onClick={() => setFever(1)}
                style={{
                  padding: "11px 12px",
                  borderRadius: 10,
                  border: fever === 1 ? "2px solid #dc2626" : "1px solid var(--border, #e2e8f0)",
                  background: fever === 1 ? "rgba(220,38,38,0.08)" : "var(--surface, #ffffff)",
                  color: fever === 1 ? "#dc2626" : "var(--text-primary, #0f172a)",
                  fontWeight: fever === 1 ? 800 : 600,
                  fontSize: 12.5,
                  cursor: "pointer"
                }}
              >
                🔴 Yes, Fever / Chills
              </button>
            </div>
          </div>

          {/* 5. Procedure-Specific Questions */}
          {(() => {
            const specificQuestions = (procedureData?.questions || procedureData?.treatment_specific_questions || []).filter(
              (q) => !["pain", "mobility", "swelling", "fever", "symptoms"].includes(q.id)
            );

            if (specificQuestions.length === 0) return null;

            return (
              <div style={pageStyles.section}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <label style={pageStyles.sectionTitle}>
                    5. {procedureData?.template_title || "Procedure-Specific Questions"}
                  </label>
                  <span style={{ fontSize: 10.5, fontWeight: 700, background: "rgba(15,118,110,0.1)", color: "#0f766e", padding: "2px 8px", borderRadius: 999 }}>
                    Tailored Protocol
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {specificQuestions.map((q, idx) => {
                    const qKey = q.id || `q_${idx}`;
                    const currentAnswer = treatmentAnswers[qKey] || q.options?.[0];
                    const qTitle = q.text || q.question;
                    const opts = q.options || ["Yes", "No"];

                    return (
                      <div
                        key={qKey}
                        style={{
                          background: "var(--surface, #f8fafc)",
                          border: "1px solid var(--border, #e2e8f0)",
                          borderRadius: 10,
                          padding: 12
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary, #0f172a)", marginBottom: 8 }}>
                          {idx + 1}. {qTitle}
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {opts.map((opt) => {
                            const isSelected = currentAnswer === opt;
                            const isWarning = (q.alert_if && q.alert_if.includes(opt)) || opt.toLowerCase().includes("unable") || opt.toLowerCase().includes("pus") || opt.toLowerCase().includes("drainage") || opt.toLowerCase().includes("breathless");

                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleTreatmentChange(qKey, opt)}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 8,
                                  border: isSelected
                                    ? (isWarning ? "1.5px solid #dc2626" : "1.5px solid #0f766e")
                                    : "1px solid var(--border, #cbd5e1)",
                                  background: isSelected
                                    ? (isWarning ? "rgba(239,68,68,0.12)" : "rgba(15,118,110,0.12)")
                                    : "#ffffff",
                                  color: isSelected
                                    ? (isWarning ? "#b91c1c" : "#0f766e")
                                    : "var(--text-secondary, #334155)",
                                  fontSize: 11,
                                  fontWeight: isSelected ? 700 : 500,
                                  cursor: "pointer",
                                  textAlign: "left",
                                  transition: "all 0.12s ease"
                                }}
                              >
                                {isSelected ? "● " : "○ "}{opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* 6. Quick Tags & Notes */}
          <div style={pageStyles.section}>
            <label style={pageStyles.sectionTitle}>
              6. Any additional symptoms or notes for your surgical team?
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {QUICK_TAGS.map((tag) => {
                const selected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: "6px 11px",
                      borderRadius: 999,
                      border: selected ? "1px solid #0f766e" : "1px solid var(--border, #e2e8f0)",
                      background: selected ? "#0f766e" : "var(--surface, #ffffff)",
                      color: selected ? "#ffffff" : "var(--text-secondary, #334155)",
                      fontSize: 11,
                      fontWeight: selected ? 700 : 500,
                      cursor: "pointer",
                      transition: "all 0.12s ease"
                    }}
                  >
                    {selected ? "✓ " : "+ "}{tag}
                  </button>
                );
              })}
            </div>

            <textarea
              className="aura-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tell your doctor anything else: e.g. wound status, pain relief response, questions..."
              style={{
                width: "100%",
                marginTop: 10,
                fontSize: 12,
                borderRadius: 9,
                resize: "vertical",
                boxSizing: "border-box"
              }}
            />
          </div>

          {error && (
            <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 12, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            style={pageStyles.primaryBtn}
          >
            {submitting ? "Analyzing & Transmitting…" : "Submit Recovery Feedback →"}
          </button>

          <p style={{ textAlign: "center", fontSize: 10.5, color: "var(--text-muted, #64748b)", marginTop: 14, marginBottom: 0 }}>
            🔒 Transmitted directly to hospital clinical dashboard using CareTraceAI Hindsight
          </p>
        </form>
      </div>
    </div>
  );
}

const pageStyles = {
  container: {
    minHeight: "100vh",
    background: "var(--bg, #f8fafc)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px 14px",
    fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
    boxSizing: "border-box"
  },
  card: {
    width: "100%",
    maxWidth: 500,
    background: "var(--card, #ffffff)",
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    border: "1px solid var(--border, #e2e8f0)",
    overflow: "hidden"
  },
  header: {
    background: "linear-gradient(135deg, #0f766e 0%, #115e59 100%)",
    padding: "22px 22px 20px 22px",
    color: "#ffffff"
  },
  headerChip: {
    display: "inline-block",
    padding: "3px 9px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.18)",
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: "0.03em"
  },
  section: {
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: 700,
    color: "var(--text-primary, #0f172a)",
    display: "block"
  },
  primaryBtn: {
    width: "100%",
    padding: "13px",
    borderRadius: 10,
    background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
    color: "#ffffff",
    fontWeight: 800,
    fontSize: 14,
    border: "none",
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(15,118,110,0.25)",
    transition: "all 0.15s ease"
  },
  secondaryBtn: {
    width: "100%",
    padding: "11px",
    borderRadius: 10,
    background: "var(--surface, #f1f5f9)",
    color: "var(--text-primary, #0f172a)",
    fontWeight: 700,
    fontSize: 12.5,
    border: "1px solid var(--border, #cbd5e1)",
    cursor: "pointer"
  },
  emergencyBtn: {
    display: "inline-block",
    padding: "10px 18px",
    background: "#dc2626",
    color: "#ffffff",
    borderRadius: 8,
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 12
  },
  miniMetric: {
    background: "var(--surface, #f8fafc)",
    border: "1px solid var(--border, #e2e8f0)",
    borderRadius: 10,
    padding: "10px 6px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },
  miniMetricLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--text-muted, #64748b)",
    textTransform: "uppercase",
    marginBottom: 2
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid #e2e8f0",
    borderTopColor: "#0f766e",
    borderRadius: "50%",
    margin: "0 auto",
    animation: "spin 0.8s linear infinite"
  }
};
