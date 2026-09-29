import { useCallback, useEffect, useState } from "react";
import API from "../caretraceApi";
import { Link } from "react-router-dom";

const riskMeta = {
  High: {
    color: "#f59e0b",
    bg: "rgba(245,158,11,.10)",
    label: "Needs monitoring",
  },
  Critical: {
    color: "#f43f5e",
    bg: "rgba(244,63,94,.10)",
    label: "Urgent attention",
  },
};

function AlertIcon({ critical = false }) {
  const color = critical ? "#f43f5e" : "#f59e0b";

  return (
    <div
      style={{
        width: 42,
        height: 42,
        borderRadius: 12,
        background: critical ? "rgba(244,63,94,.12)" : "rgba(245,158,11,.12)",
        color,
        display: "grid",
        placeItems: "center",
        fontSize: 20,
        fontWeight: 900,
      }}
    >
      {critical ? "!" : "⚠"}
    </div>
  );
}

function StatCard({ title, value, subtitle, color }) {
  return (
    <div
      className="card fade-up"
      style={{
        padding: 17,
        borderTop: `3px solid ${color}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: 9,
            textTransform: "uppercase",
            letterSpacing: ".08em",
            fontWeight: 800,
            color: "var(--text-muted)",
          }}
        >
          {title}
        </div>

        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
          }}
        />
      </div>

      <div
        style={{
          color,
          fontSize: 30,
          fontWeight: 800,
          marginTop: 8,
          letterSpacing: "-.03em",
        }}
      >
        {value}
      </div>

      <div
        style={{
          fontSize: 10,
          color: "var(--text-muted)",
          marginTop: 3,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

export default function Alerts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [filter, setFilter] = useState("All");

  const load = useCallback(async () => {
    try {
      // First try fetching alerts from the dedicated /api/alerts route
      const { data: alertsData } = await API.get("/alerts");

      if (Array.isArray(alertsData) && alertsData.length > 0) {
        const mapped = alertsData.map((a) => ({
          alert_id: a.id,
          id: a.patient_id,
          name: a.patient_name,
          phone: a.patient_phone,
          procedure_name: a.procedure_name,
          risk_level: a.severity === "critical" ? "Critical" : "High",
          alert_title: a.title,
          alert_message: a.message,
          alert_status: a.status,
          created_at: a.created_at,
          latest: {
            id: a.checkin_id,
            day: a.checkin_day,
            pain: a.pain,
            pain_delta: a.pain_delta,
            mobility: a.mobility,
            swelling: a.swelling,
            fever: a.fever,
            trend: a.trend,
            hindsight_summary: a.hindsight_summary,
            explanation: a.checkin_explanation || a.message,
            message: a.symptoms || a.message,
          },
        }));
        setItems(mapped);
      } else {
        // Fallback: check flagged patients
        const { data } = await API.get("/patients");
        const flagged = data.filter((p) =>
          ["High", "Critical"].includes(p.risk_level)
        );

        const withLatest = await Promise.all(
          flagged.map(async (p) => {
            try {
              const res = await API.get(`/checkins/${p.id}`);
              const c = res.data?.checkins || res.data;
              const latest = Array.isArray(c) ? c[c.length - 1] : res.data?.summary?.latest;
              return {
                ...p,
                latest: latest || null,
              };
            } catch {
              return { ...p, latest: null };
            }
          })
        );
        setItems(withLatest);
      }
    } catch (e) {
      console.error("Alerts load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (p, outcome) => {
    setReviewing(p.alert_id || p.id);

    try {
      if (p.alert_id) {
        await API.post(`/alerts/${p.alert_id}/review`, {
          outcome,
          note: `Staff reviewed via Alerts dashboard. Outcome: ${outcome}`,
        });
      } else {
        await API.post("/checkins/review", {
          checkin_id: p.latest?.id,
          patient_id: p.id,
          outcome,
          note: `Staff review: ${outcome}`,
        });
      }

      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setReviewing(null);
    }
  };

  const critical = items.filter((p) => p.risk_level === "Critical").length;
  const high = items.filter((p) => p.risk_level === "High").length;

  const visible =
    filter === "All"
      ? items
      : items.filter((p) => p.risk_level === filter);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        maxWidth: 1080,
        paddingBottom: 30,
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 6,
            }}
          >
            <span
              className="pulse"
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: items.length ? "#f43f5e" : "#22c55e",
              }}
            />

            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: ".1em",
                color: items.length ? "#b45309" : "#15803d",
                textTransform: "uppercase",
              }}
            >
              {items.length ? "Clinical attention required" : "Monitoring clear"}
            </span>
          </div>

          <div className="page-title">Clinical Alerts</div>

          <div className="page-subtitle">
            Longitudinal recovery deteriorations flagged for medical staff review and intervention.
          </div>
        </div>

        <Link
          to="/workflows"
          style={{
            textDecoration: "none",
            color: "var(--brand)",
            background: "var(--brand-light)",
            border: "1px solid var(--brand-mid)",
            borderRadius: 10,
            padding: "9px 12px",
            fontSize: 11,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          Check-in Simulator →
        </Link>
      </div>

      {/* SUMMARY */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <StatCard
          title="Active alerts"
          value={items.length}
          subtitle="Current elevated-risk patients"
          color="#0f766e"
        />

        <StatCard
          title="High risk"
          value={high}
          subtitle="Patients needing monitoring"
          color="#f59e0b"
        />

        <StatCard
          title="Critical"
          value={critical}
          subtitle="Requires urgent clinical review"
          color="#f43f5e"
        />
      </div>

      {/* HINDSIGHT EXPLANATION */}
      <div
        style={{
          background: "linear-gradient(135deg,#083344,#0f4c5c)",
          borderRadius: 14,
          padding: 16,
          color: "#fff",
          border: "1px solid rgba(103,232,249,.14)",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "rgba(103,232,249,.15)",
            color: "#67e8f9",
            display: "grid",
            placeItems: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          🧠
        </div>

        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "#a5f3fc", letterSpacing: ".06em" }}>
            HINDSIGHT LONGITUDINAL MEMORY LAYER
          </div>

          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.75)", marginTop: 2, lineHeight: 1.5 }}>
            Alerts are generated when recovery indicators deteriorate compared to the patient's earlier baseline. Recorded clinical decisions are retained back into memory.
          </div>
        </div>
      </div>

      {/* FILTERS */}
      <div
        className="card"
        style={{
          padding: 8,
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {["All", "High", "Critical"].map((r) => {
          const count =
            r === "All" ? items.length : r === "High" ? high : critical;

          return (
            <button
              key={r}
              onClick={() => setFilter(r)}
              style={{
                border: filter === r ? "none" : "1px solid var(--border-md)",
                background: filter === r ? "var(--brand)" : "transparent",
                color: filter === r ? "#fff" : "var(--text-secondary)",
                borderRadius: 8,
                padding: "7px 13px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {r} <span style={{ opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* ALERT LIST */}
      {loading ? (
        <div className="card" style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
          Loading alerts…
        </div>
      ) : visible.length === 0 ? (
        <div className="card" style={{ padding: 50, textAlign: "center" }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              margin: "0 auto 12px",
              display: "grid",
              placeItems: "center",
              background: "rgba(34,197,94,.12)",
              color: "#22c55e",
              fontSize: 22,
            }}
          >
            ✓
          </div>

          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>
            No elevated-risk alerts
          </div>

          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
            All active patients are currently within normal post-operative baseline.
          </div>
        </div>
      ) : (
        visible.map((p) => {
          const meta = riskMeta[p.risk_level] || riskMeta.High;
          const isCritical = p.risk_level === "Critical";

          return (
            <div
              key={p.alert_id || p.id}
              className="card fade-up"
              style={{
                overflow: "hidden",
                borderLeft: `4px solid ${meta.color}`,
              }}
            >
              <div style={{ padding: 18 }}>
                {/* PATIENT HEADER */}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
                    <AlertIcon critical={isCritical} />

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Link
                          to={`/patients/${p.id}`}
                          style={{
                            color: "var(--text-primary)",
                            textDecoration: "none",
                            fontSize: 15,
                            fontWeight: 800,
                          }}
                        >
                          {p.name}
                        </Link>

                        <span
                          style={{
                            color: meta.color,
                            background: meta.bg,
                            borderRadius: 999,
                            padding: "3px 8px",
                            fontSize: 9.5,
                            fontWeight: 800,
                            textTransform: "uppercase",
                          }}
                        >
                          {p.risk_level}
                        </span>

                        {p.alert_title && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: isCritical ? "#be123c" : "#b45309" }}>
                            • {p.alert_title}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                        {p.procedure_name || "General Surgery"} · Phone: {p.phone} · Patient #{p.id}
                      </div>
                    </div>
                  </div>

                  <Link
                    to={`/patients/${p.id}`}
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: "var(--brand)",
                      textDecoration: "none",
                      padding: "5px 10px",
                      borderRadius: 8,
                      background: "var(--brand-light)",
                      border: "1px solid var(--brand-mid)",
                      alignSelf: "flex-start",
                    }}
                  >
                    View Patient Timeline →
                  </Link>
                </div>

                {/* CHECK-IN & COMPARISON */}
                {p.latest ? (
                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "110px 1fr", gap: 12 }}>
                    <div
                      style={{
                        background: "var(--surface)",
                        borderRadius: 10,
                        padding: 10,
                        textAlign: "center",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 800 }}>
                        Check-in
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", marginTop: 3 }}>
                        Day {p.latest.day || 1}
                      </div>
                      <div style={{ fontSize: 10.5, color: meta.color, fontWeight: 800, marginTop: 2 }}>
                        Pain {p.latest.pain}/10
                        {p.latest.pain_delta !== null && p.latest.pain_delta !== undefined && (
                          <span style={{ marginLeft: 3 }}>
                            ({p.latest.pain_delta >= 0 ? `+${p.latest.pain_delta}` : p.latest.pain_delta})
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ background: "var(--surface)", borderRadius: 10, padding: 12, border: "1px solid var(--border)" }}>
                      {/* Longitudinal Deterioration Summary */}
                      {p.latest.hindsight_summary && (
                        <div style={{ fontSize: 11.5, color: "var(--text-primary)", lineHeight: 1.5, marginBottom: 8, fontWeight: 500 }}>
                          <span style={{ color: "#0f766e", fontWeight: 800 }}>Longitudinal Hindsight: </span>
                          {p.latest.hindsight_summary}
                        </div>
                      )}

                      {/* Clinical explanation */}
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.45 }}>
                        <strong style={{ color: "var(--text-primary)" }}>Clinical Reason: </strong>
                        {p.latest.explanation || p.alert_message || "Elevated recovery risk detected."}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "var(--surface)", color: "var(--text-muted)", fontSize: 11 }}>
                    {p.alert_message || "Alert generated based on clinical risk indicators."}
                  </div>
                )}

                {/* CLINICAL ACTIONS */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: "1px solid var(--border)",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
                    Clinical review decisions update patient status and are retained in longitudinal memory.
                  </span>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      disabled={reviewing === (p.alert_id || p.id)}
                      onClick={() => review(p, "Confirmed - follow-up required")}
                      style={{
                        border: "none",
                        background: meta.color,
                        color: "#fff",
                        borderRadius: 8,
                        padding: "7px 12px",
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: "pointer",
                        opacity: reviewing === (p.alert_id || p.id) ? 0.6 : 1,
                      }}
                    >
                      {reviewing === (p.alert_id || p.id) ? "Saving…" : "Confirm Follow-up"}
                    </button>

                    <button
                      disabled={reviewing === (p.alert_id || p.id)}
                      onClick={() => review(p, "Medication / Pain adjusted")}
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: "6px 10px" }}
                    >
                      Adjust Medication
                    </button>

                    <button
                      disabled={reviewing === (p.alert_id || p.id)}
                      onClick={() => review(p, "False alarm")}
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: "6px 10px", color: "var(--text-muted)" }}
                    >
                      False Alarm
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}