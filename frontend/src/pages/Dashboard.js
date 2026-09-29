import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { getStats, getPatients, getHindsightFeed, getHindsightLog } from "../api";

const RISK_COLORS = {
  Low: "#22c55e",
  High: "#f59e0b",
  Critical: "#f43f5e",
};

function Avatar({ name, color = "#0f766e", size = 34 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: color + "18",
        color,
        border: `1.5px solid ${color}30`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 800,
      }}
    >
      {name?.charAt(0).toUpperCase()}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
  accent,
  icon,
  trend,
}) {
  return (
    <div
      className="stat-card fade-up"
      style={{
        "--stat-accent": accent || color,
        minHeight: 145,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 13,
        }}
      >
        <span className="stat-card-label">{label}</span>

        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: color + "15",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>

      <div
        className="stat-card-value"
        style={{
          color,
          fontSize: 36,
        }}
      >
        {value ?? "0"}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginTop: 7,
        }}
      >
        <div className="stat-card-sub">{sub}</div>

        {trend && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color,
              background: color + "12",
              borderRadius: 999,
              padding: "3px 7px",
            }}
          >
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}

function RiskBadge({ level }) {
  const map = {
    Low: "badge badge-success",
    High: "badge badge-warn",
    Critical: "badge badge-danger",
  };

  return (
    <span className={map[level] || "badge badge-info"}>
      {level || "Unknown"}
    </span>
  );
}

function buildTrendData(patients) {
  if (!patients.length) return [];

  const counts = {};

  patients.forEach((p) => {
    const d = p.created_at
      ? new Date(p.created_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        })
      : new Date().toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        });

    counts[d] = (counts[d] || 0) + 1;
  });

  let running = 0;

  return Object.entries(counts).map(([date, count]) => {
    running += count;

    return {
      date,
      count,
      total: running,
    };
  });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: "#083344",
        border: "1px solid rgba(103,232,249,.18)",
        borderRadius: 10,
        padding: "9px 12px",
        fontSize: 11,
        boxShadow: "0 10px 25px rgba(0,0,0,.18)",
      }}
    >
      <div
        style={{
          color: "rgba(255,255,255,.55)",
          marginBottom: 4,
          fontSize: 10,
        }}
      >
        {label}
      </div>

      {payload.map((p) => (
        <div
          key={p.name}
          style={{
            color: "#67e8f9",
            fontWeight: 800,
          }}
        >
          {p.value} patients
        </div>
      ))}
    </div>
  );
};

function UsersIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// eslint-disable-next-line no-unused-vars
function WarningIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CriticalIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function MemoryIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3a7 7 0 0 0-4 12.75V19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.25A7 7 0 0 0 12 3Z" />
      <path d="M9 19h6" />
      <path d="M9 11h6" />
    </svg>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [patients, setPatients] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [hindsightLog, setHindsightLog] = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);

  const refresh = async () => {
    try {
      const [s, p, feed] = await Promise.all([
        getStats(),
        getPatients(),
        getHindsightFeed(10).catch(() => [])
      ]);

      setStats(s);
      setAll(p);
      setPatients(p.slice(0, 5));
      setActivityFeed(feed || []);
      if (!selectedPatientId && p.length > 0) {
        setSelectedPatientId(p[0].id);
      }
      setError("");
    } catch {
      setError(
        "Cannot reach backend — make sure node server.js is running"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();

    const id = setInterval(refresh, 8000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedPatientId) return;
    let isMounted = true;
    getHindsightLog(selectedPatientId)
      .then((data) => {
        if (isMounted) setHindsightLog(data);
      })
      .catch((err) => console.log("Hindsight log load warning:", err.message));
    return () => {
      isMounted = false;
    };
  }, [selectedPatientId]);

  const trendData = buildTrendData(all);

  const low = stats
    ? Math.max(
        0,
        stats.total - stats.high_risk - stats.critical
      )
    : 0;

  const pieData = stats
    ? [
        { name: "Low", value: low },
        {
          name: "High",
          value: stats.high_risk,
        },
        {
          name: "Critical",
          value: stats.critical,
        },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        paddingBottom: 30,
      }}
    >
      {/* ERROR */}
      {error && (
        <div
          style={{
            background: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            borderRadius: 12,
            padding: "12px 16px",
            fontSize: 12,
            color: "var(--danger-text)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <CriticalIcon />
          {error}
        </div>
      )}

      {/* DASHBOARD INTRO */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 18,
          marginBottom: 2,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 5,
            }}
          >
            <span
              className="pulse"
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#10b981",
              }}
            />

            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "#0f766e",
              }}
            >
              Live patient monitoring
            </span>
          </div>

          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-.025em",
              color: "var(--text-primary)",
            }}
          >
            Recovery overview
          </div>

          <div
            style={{
              fontSize: 11.5,
              color: "var(--text-muted)",
              marginTop: 3,
            }}
          >
            A longitudinal view of patient recovery and risk.
          </div>
        </div>

        <Link
          to="/workflows"
          style={{
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 12px",
            borderRadius: 10,
            background: "var(--brand-light)",
            border: "1px solid var(--brand-mid)",
            color: "var(--brand)",
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          <MemoryIcon />
          Hindsight simulator
        </Link>
      </div>

      {/* HOSPITAL EXECUTIVE METRICS RIBBON */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 12,
        }}
      >
        <StatCard
          label="Active Monitoring"
          value={stats?.active_patients ?? all.length}
          sub={`Total enrolled: ${stats?.total_patients ?? all.length}`}
          color="#0f766e"
          accent="#0f766e"
          icon={<UsersIcon />}
        />

        <StatCard
          label="Today's Check-ins"
          value={`${stats?.today_completed ?? 0} / ${stats?.active_patients ?? all.length}`}
          sub={`${stats?.today_pending ?? 0} pending today`}
          color="#0284c7"
          accent="#0284c7"
          icon={<CheckIcon />}
        />

        <StatCard
          label="Recovery Trajectory"
          value={`${stats?.patients_improving ?? stats?.trends?.improving ?? 0} ↗`}
          sub={`${stats?.patients_worsening ?? stats?.trends?.worsening ?? 0} worsening alerts`}
          color="#16a34a"
          accent="#16a34a"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
            </svg>
          }
        />

        <StatCard
          label="Clinical Alerts"
          value={stats?.active_alerts ?? stats?.critical ?? 0}
          sub={`${stats?.critical ?? 0} critical · ${stats?.high_risk ?? 0} high`}
          color="#f43f5e"
          accent="#f43f5e"
          icon={<CriticalIcon />}
        />

        <StatCard
          label="Protocol Adherence"
          value={`${stats?.completion_rate ?? 85}%`}
          sub="10-day completion rate"
          color="#8b5cf6"
          accent="#8b5cf6"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
            </svg>
          }
        />
      </div>

      {/* 4-PHASE HINDSIGHT ACTIVITY INSPECTOR */}
      <div className="card fade-up" style={{ padding: 22, background: "linear-gradient(145deg, #091e2b 0%, #061822 100%)", border: "1px solid rgba(103,232,249,0.18)", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(103,232,249,0.15)", color: "#67e8f9", display: "grid", placeItems: "center" }}>
              <MemoryIcon />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                Hindsight Activity Inspector
                <span style={{ fontSize: 10, fontWeight: 700, background: "rgba(16,185,129,0.2)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)", padding: "2px 8px", borderRadius: 999 }}>
                  Persistent Memory Active
                </span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                4-Phase Longitudinal Reasoning: RECALL → CURRENT EVENT → DELTA ANALYSIS → RETAIN
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>Inspect Patient:</span>
            <select
              value={selectedPatientId || ""}
              onChange={(e) => setSelectedPatientId(Number(e.target.value))}
              style={{
                background: "#0e2d3e",
                color: "#67e8f9",
                border: "1px solid rgba(103,232,249,0.3)",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 11.5,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              {all.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} {p.name} ({p.procedure || p.procedure_name || "General"}) — Day {p.current_day || 1}
                </option>
              ))}
            </select>
            {selectedPatientId && (
              <Link
                to={`/patients/${selectedPatientId}`}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#083344",
                  background: "#a5f3fc",
                  padding: "6px 12px",
                  borderRadius: 8,
                  textDecoration: "none"
                }}
              >
                Patient File →
              </Link>
            )}
          </div>
        </div>

        {/* 4-Phase Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {/* Phase 1: RECALL */}
          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(103,232,249,0.15)", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#67e8f9", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Phase 1 · Recall
              </span>
              <span style={{ fontSize: 14 }}>🔍</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
              Historical Recovery Context
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: "0 0 10px 0", lineHeight: 1.45 }}>
              {hindsightLog?.recent_memories?.length > 1
                ? hindsightLog.recent_memories[1].memory_text.slice(0, 130) + "…"
                : "Baseline surgical data established. Memory store initialized."}
            </p>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6 }}>
              Source: SQLite hindsight_memories + Vectorize
            </div>
          </div>

          {/* Phase 2: CURRENT EVENT */}
          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(129,140,248,0.2)", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Phase 2 · Current Event
              </span>
              <span style={{ fontSize: 14 }}>📥</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
              Today's Patient Check-in
            </div>
            {hindsightLog?.latest_checkins?.[0] ? (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
                <div><strong>Day:</strong> {hindsightLog.latest_checkins[0].day}</div>
                <div><strong>Pain:</strong> {hindsightLog.latest_checkins[0].pain}/10 · <strong>Mobility:</strong> {hindsightLog.latest_checkins[0].mobility || "Same"}</div>
                <div><strong>Swelling:</strong> {hindsightLog.latest_checkins[0].swelling || "None"} · <strong>Fever:</strong> {hindsightLog.latest_checkins[0].fever ? "Yes" : "No"}</div>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>
                Awaiting Day 1 WhatsApp check-in submission.
              </p>
            )}
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6, marginTop: 8 }}>
              Via WhatsApp recovery trigger
            </div>
          </div>

          {/* Phase 3: DELTA ANALYSIS */}
          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Phase 3 · Delta Analysis
              </span>
              <span style={{ fontSize: 14 }}>⚖️</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
              Longitudinal Delta & Risk
            </div>
            {hindsightLog?.latest_checkins?.[0] ? (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", lineHeight: 1.5 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                  <span style={{
                    padding: "1px 6px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 800,
                    background: hindsightLog.latest_checkins[0].trend === "improving" ? "#166534" : hindsightLog.latest_checkins[0].trend === "worsening" ? "#991b1b" : "#1e40af",
                    color: "#fff"
                  }}>
                    {hindsightLog.latest_checkins[0].trend?.toUpperCase() || "STABLE"}
                  </span>
                  <span style={{ fontSize: 10.5, color: "#fbbf24", fontWeight: 700 }}>
                    Risk: {hindsightLog.latest_checkins[0].risk_level || "Low"}
                  </span>
                </div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.7)" }}>
                  {hindsightLog.latest_checkins[0].hindsight_summary
                    ? hindsightLog.latest_checkins[0].hindsight_summary.slice(0, 95) + "…"
                    : `Pain delta: ${hindsightLog.latest_checkins[0].pain_delta ?? 0}`}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: 0 }}>
                Delta engine awaiting baseline delta.
              </p>
            )}
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6, marginTop: 8 }}>
              Evaluates pain delta, mobility & fever shift
            </div>
          </div>

          {/* Phase 4: RETAIN */}
          <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Phase 4 · Retain
              </span>
              <span style={{ fontSize: 14 }}>🧠</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
              Persistent Memory Committed
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", margin: "0 0 10px 0", lineHeight: 1.45 }}>
              {hindsightLog?.recent_memories?.[0]
                ? hindsightLog.recent_memories[0].memory_text.slice(0, 130) + "…"
                : "Active memory ledger ready to record recovery milestones."}
            </p>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6 }}>
              Total durable memories: {hindsightLog?.total_memories ?? 0}
            </div>
          </div>
        </div>

        {/* Recent Hospital-Wide Longitudinal Activity Feed */}
        {activityFeed.length > 0 && (
          <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                📡 Hospital-Wide Live Recovery Stream
              </span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
                Latest verified check-ins
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 8 }}>
              {activityFeed.slice(0, 3).map((item) => (
                <div
                  key={item.checkin_id}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontSize: 11
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: "#fff" }}>{item.patient_name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: item.trend === "improving" ? "#34d399" : item.trend === "worsening" ? "#f87171" : "#60a5fa" }}>
                      Day {item.day} · {item.trend?.toUpperCase() || "STABLE"}
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.hindsight_summary || `Pain ${item.pain}/10 · Mobility: ${item.mobility}`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CHARTS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 285px",
          gap: 13,
        }}
      >
        {/* PATIENT GROWTH */}
        <div className="card fade-up">
          <div className="card-header">
            <div>
              <div className="card-title">
                Patient Growth
              </div>

              <div className="card-subtitle">
                Cumulative registrations over time
              </div>
            </div>

            <div
              style={{
                padding: "5px 8px",
                borderRadius: 7,
                background: "var(--brand-light)",
                color: "var(--brand)",
                fontSize: 9,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: ".05em",
              }}
            >
              Live
            </div>
          </div>

          <div style={{ padding: "17px 15px 14px" }}>
            {trendData.length < 2 ? (
              <div
                style={{
                  height: 160,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 13,
                    display: "grid",
                    placeItems: "center",
                    background: "var(--brand-light)",
                    color: "var(--brand)",
                  }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>

                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                  }}
                >
                  Add patients to see growth chart
                </span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart
                  data={trendData}
                  margin={{
                    top: 4,
                    right: 8,
                    left: -24,
                    bottom: 0,
                  }}
                >
                  <defs>
                    <linearGradient
                      id="g1"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#0f766e"
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="100%"
                        stopColor="#0f766e"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="date"
                    tick={{
                      fontSize: 10,
                      fill: "var(--text-muted)",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    tick={{
                      fontSize: 10,
                      fill: "var(--text-muted)",
                    }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />

                  <Tooltip content={<CustomTooltip />} />

                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#0f766e"
                    strokeWidth={2.5}
                    fill="url(#g1)"
                    dot={{
                      r: 4,
                      fill: "#0f766e",
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* RISK SPLIT */}
        <div className="card fade-up">
          <div className="card-header">
            <div>
              <div className="card-title">
                Risk Split
              </div>

              <div className="card-subtitle">
                Current patient breakdown
              </div>
            </div>
          </div>

          <div style={{ padding: 15 }}>
            {pieData.length === 0 ? (
              <div
                style={{
                  height: 160,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                  }}
                >
                  No data yet
                </span>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={125}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={56}
                      dataKey="value"
                      paddingAngle={4}
                      strokeWidth={0}
                    >
                      {pieData.map((e) => (
                        <Cell
                          key={e.name}
                          fill={RISK_COLORS[e.name]}
                        />
                      ))}
                    </Pie>

                    <Tooltip
                      formatter={(v, n) => [v, n]}
                      contentStyle={{
                        background: "#083344",
                        border:
                          "1px solid rgba(255,255,255,.12)",
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                      itemStyle={{ color: "#fff" }}
                      labelStyle={{
                        color: "rgba(255,255,255,.5)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 5,
                  }}
                >
                  {[
                    { name: "Low", val: low },
                    {
                      name: "High",
                      val: stats?.high_risk,
                    },
                    {
                      name: "Critical",
                      val: stats?.critical,
                    },
                  ]
                    .filter((d) => d.val > 0)
                    .map((d) => (
                      <div
                        key={d.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent:
                            "space-between",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background:
                                RISK_COLORS[d.name],
                            }}
                          />

                          <span
                            style={{
                              fontSize: 11,
                              color:
                                "var(--text-secondary)",
                            }}
                          >
                            {d.name}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color:
                                RISK_COLORS[d.name],
                            }}
                          >
                            {d.val}
                          </span>

                          <span
                            style={{
                              fontSize: 9,
                              color:
                                "var(--text-muted)",
                            }}
                          >
                            (
                            {Math.round(
                              (d.val /
                                (stats?.total || 1)) *
                                100
                            )}
                            %)
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* RECENT PATIENTS */}
      <div className="card fade-up">
        <div className="card-header">
          <div>
            <div className="card-title">
              Recent Patients
            </div>

            <div className="card-subtitle">
              Latest 5 registered patients
            </div>
          </div>

          <Link
            to="/patients"
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: "var(--brand)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            View all

            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>

        {loading ? (
          <div
            style={{
              padding: 48,
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 12,
            }}
          >
            Loading patients…
          </div>
        ) : patients.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                display: "grid",
                placeItems: "center",
                margin: "0 auto 10px",
                background: "var(--brand-light)",
                color: "var(--brand)",
              }}
            >
              <UsersIcon />
            </div>

            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 4,
              }}
            >
              No patients yet
            </div>

            <Link
              to="/patients"
              style={{
                fontSize: 12,
                color: "var(--brand)",
                textDecoration: "none",
              }}
            >
              Register your first patient →
            </Link>
          </div>
        ) : (
          <table className="aura-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Procedure</th>
                <th>Surgery Date</th>
                <th>Risk Level</th>
                <th>Check-in</th>
              </tr>
            </thead>

            <tbody>
              {patients.map((p) => (
                <tr
                  key={p.id}
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    (window.location.href = `/patients/${p.id}`)
                  }
                >
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Avatar
                        name={p.name}
                        color="#0f766e"
                      />

                      <div>
                        <div
                          style={{
                            fontWeight: 700,
                            color:
                              "var(--text-primary)",
                            fontSize: 12,
                          }}
                        >
                          {p.name}
                        </div>

                        <div
                          style={{
                            fontSize: 10,
                            color:
                              "var(--text-muted)",
                            marginTop: 1,
                          }}
                        >
                          {p.phone}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td>
                    {p.procedure_name || (
                      <span
                        style={{
                          color: "var(--text-muted)",
                        }}
                      >
                        —
                      </span>
                    )}
                  </td>

                  <td>
                    {p.surgery_date ? (
                      new Date(
                        p.surgery_date
                      ).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    ) : (
                      <span
                        style={{
                          color: "var(--text-muted)",
                        }}
                      >
                        —
                      </span>
                    )}
                  </td>

                  <td>
                    <RiskBadge
                      level={p.risk_level}
                    />
                  </td>

                  <td>
                    {p.last_checkin ? (
                      new Date(
                        p.last_checkin
                      ).toLocaleDateString(
                        "en-IN"
                      )
                    ) : (
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--text-muted)",
                        }}
                      >
                        Not yet
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}