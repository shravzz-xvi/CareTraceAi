import { useState } from "react";

function Toggle({ enabled, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      aria-label="Toggle setting"
      style={{
        width: 42,
        height: 23,
        borderRadius: 999,
        border: "none",
        padding: 2,
        cursor: "pointer",
        background: enabled
          ? "var(--brand)"
          : "var(--border-md)",
        transition: "all .2s ease",
        display: "flex",
        alignItems: "center",
        justifyContent: enabled
          ? "flex-end"
          : "flex-start",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 19,
          height: 19,
          borderRadius: "50%",
          background: "#fff",
          boxShadow:
            "0 1px 4px rgba(0,0,0,.18)",
        }}
      />
    </button>
  );
}

function SettingRow({
  title,
  description,
  enabled,
  onChange,
  badge,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 18,
        padding: "14px 0",
        borderBottom:
          "1px solid var(--border)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 750,
              color: "var(--text-primary)",
            }}
          >
            {title}
          </div>

          {badge && (
            <span
              style={{
                fontSize: 8,
                fontWeight: 800,
                letterSpacing: ".06em",
                color: "#15803d",
                background:
                  "rgba(34,197,94,.09)",
                border:
                  "1px solid rgba(34,197,94,.18)",
                borderRadius: 999,
                padding: "3px 7px",
              }}
            >
              {badge}
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: 10,
            color: "var(--text-muted)",
            marginTop: 4,
            lineHeight: 1.45,
            maxWidth: 650,
          }}
        >
          {description}
        </div>
      </div>

      <Toggle
        enabled={enabled}
        onChange={onChange}
      />
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}) {
  return (
    <div
      className="card fade-up"
      style={{
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "16px 18px",
          borderBottom:
            "1px solid var(--border)",
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background:
              "var(--brand-light)",
            color: "var(--brand)",
            display: "grid",
            placeItems: "center",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color:
                "var(--text-primary)",
            }}
          >
            {title}
          </div>

          <div
            style={{
              fontSize: 10,
              color:
                "var(--text-muted)",
              marginTop: 3,
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 18px" }}>
        {children}
      </div>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  value,
  description,
  color,
}) {
  return (
    <div
      className="card fade-up"
      style={{
        padding: 16,
        borderTop:
          `3px solid ${color}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: 9,
            textTransform:
              "uppercase",
            letterSpacing: ".08em",
            fontWeight: 800,
            color:
              "var(--text-muted)",
          }}
        >
          {title}
        </div>

        <div
          style={{
            width: 31,
            height: 31,
            borderRadius: 9,
            background:
              `${color}12`,
            color,
            display: "grid",
            placeItems: "center",
            fontSize: 15,
          }}
        >
          {icon}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginTop: 11,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: color,
            boxShadow:
              `0 0 0 4px ${color}15`,
          }}
        />

        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            color:
              "var(--text-primary)",
          }}
        >
          {value}
        </span>
      </div>

      <div
        style={{
          fontSize: 10,
          color:
            "var(--text-muted)",
          marginTop: 5,
          lineHeight: 1.4,
        }}
      >
        {description}
      </div>
    </div>
  );
}

export default function Settings() {
  const [monitoring, setMonitoring] =
    useState({
      recoveryTracking: true,
      automaticRisk: true,
      missedCheckins: true,
    });

  const [checkins, setCheckins] =
    useState({
      scheduled: true,
      reminders: true,
      recoveryDays: true,
    });

  const [hindsight, setHindsight] =
    useState({
      longitudinal: true,
      previousContext: true,
      explanations: true,
    });

  const [alerts, setAlerts] =
    useState({
      highRisk: true,
      criticalRisk: true,
      reviewTracking: true,
    });

  const [dashboard, setDashboard] =
    useState({
      patientStats: true,
      recentCheckins: true,
      riskDistribution: true,
      hindsightIndicators: true,
    });

  const [saved, setSaved] =
    useState(false);

  const update = (
    setter,
    key,
    value
  ) => {
    setter((current) => ({
      ...current,
      [key]: value,
    }));

    setSaved(false);
  };

  const savePreferences = () => {
    /*
      UI preferences only.

      These controls intentionally do not
      call the backend because the current
      project does not expose a settings
      persistence endpoint for them.
    */

    localStorage.setItem(
      "caretrace_ui_preferences",
      JSON.stringify({
        monitoring,
        checkins,
        hindsight,
        alerts,
        dashboard,
      })
    );

    setSaved(true);

    setTimeout(
      () => setSaved(false),
      2500
    );
  };

  return (
    <div
      style={{
        maxWidth: 1080,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        paddingBottom: 35,
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "flex-end",
          gap: 18,
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
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background:
                  "#22c55e",
                boxShadow:
                  "0 0 0 4px rgba(34,197,94,.1)",
              }}
            />

            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing:
                  ".1em",
                textTransform:
                  "uppercase",
                color: "#15803d",
              }}
            >
              Care preferences
            </span>
          </div>

          <div className="page-title">
            Settings
          </div>

          <div className="page-subtitle">
            Configure how CareTraceAI
            monitors recovery, check-ins,
            alerts, and clinical context.
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={savePreferences}
          style={{
            minWidth: 125,
          }}
        >
          {saved
            ? "✓ Saved"
            : "Save Preferences"}
        </button>
      </div>

      {/* STATUS OVERVIEW */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0,1fr))",
          gap: 12,
        }}
      >
        <StatusCard
          icon="👤"
          title="Patient monitoring"
          value="Active"
          description="Recovery tracking and risk reassessment are enabled."
          color="#0f766e"
        />

        <StatusCard
          icon="✓"
          title="Check-ins"
          value="Scheduled"
          description="Patient recovery touchpoints are being monitored."
          color="#0e7490"
        />

        <StatusCard
          icon="🧠"
          title="Hindsight"
          value="Active"
          description="Longitudinal recovery context is available."
          color="#7c3aed"
        />
      </div>

      {/* HINDSIGHT HERO */}
      <div
        style={{
          background:
            "linear-gradient(135deg,#083344,#0f4c5c)",
          borderRadius: 15,
          padding: "17px 19px",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 13,
          border:
            "1px solid rgba(103,232,249,.14)",
          boxShadow:
            "0 10px 28px rgba(8,51,68,.12)",
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background:
              "rgba(103,232,249,.12)",
            display: "grid",
            placeItems: "center",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          🧠
        </div>

        <div
          style={{
            flex: 1,
          }}
        >
          <div
            style={{
              color: "#a5f3fc",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            Hindsight Recovery Intelligence
          </div>

          <div
            style={{
              color:
                "rgba(255,255,255,.65)",
              fontSize: 10,
              lineHeight: 1.5,
              marginTop: 4,
              maxWidth: 720,
            }}
          >
            CareTraceAI can surface previous
            recovery context alongside new
            check-ins so changes in patient
            status are easier to understand.
          </div>
        </div>

        <div
          style={{
            color: "#67e8f9",
            fontSize: 9,
            fontWeight: 800,
            border:
              "1px solid rgba(103,232,249,.25)",
            borderRadius: 999,
            padding: "6px 9px",
          }}
        >
          ACTIVE
        </div>
      </div>

      {/* PATIENT MONITORING */}
      <Section
        icon="👤"
        title="Patient Monitoring"
        subtitle="Control how recovery progress is monitored"
      >
        <SettingRow
          title="Recovery tracking"
          description="Track the patient's progress across recovery days and check-ins."
          enabled={
            monitoring.recoveryTracking
          }
          onChange={(v) =>
            update(
              setMonitoring,
              "recoveryTracking",
              v
            )
          }
          badge="CORE"
        />

        <SettingRow
          title="Automatic risk reassessment"
          description="Allow new check-in information to contribute to the patient's current risk status."
          enabled={
            monitoring.automaticRisk
          }
          onChange={(v) =>
            update(
              setMonitoring,
              "automaticRisk",
              v
            )
          }
        />

        <SettingRow
          title="Missed check-in monitoring"
          description="Keep missed or delayed patient check-ins visible for follow-up."
          enabled={
            monitoring.missedCheckins
          }
          onChange={(v) =>
            update(
              setMonitoring,
              "missedCheckins",
              v
            )
          }
        />
      </Section>

      {/* CHECK-IN PREFERENCES */}
      <Section
        icon="✓"
        title="Check-in Preferences"
        subtitle="Configure the patient recovery check-in experience"
      >
        <SettingRow
          title="Scheduled check-ins"
          description="Use the configured recovery schedule for patient check-ins."
          enabled={
            checkins.scheduled
          }
          onChange={(v) =>
            update(
              setCheckins,
              "scheduled",
              v
            )
          }
          badge="ACTIVE"
        />

        <SettingRow
          title="Patient reminders"
          description="Keep reminder behavior available for upcoming recovery check-ins."
          enabled={
            checkins.reminders
          }
          onChange={(v) =>
            update(
              setCheckins,
              "reminders",
              v
            )
          }
        />

        <SettingRow
          title="Recovery-day tracking"
          description="Display the patient's current recovery day when reviewing check-ins."
          enabled={
            checkins.recoveryDays
          }
          onChange={(v) =>
            update(
              setCheckins,
              "recoveryDays",
              v
            )
          }
        />

        <div
          style={{
            padding:
              "15px 0 17px",
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              color:
                "var(--text-muted)",
              textTransform:
                "uppercase",
              letterSpacing:
                ".07em",
              marginBottom: 9,
            }}
          >
            Recovery checkpoints
          </div>

          <div
            style={{
              display: "flex",
              gap: 7,
              flexWrap: "wrap",
            }}
          >
            {[1, 3, 7, 14, 30].map(
              (day, index) => (
                <div
                  key={day}
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: 6,
                    background:
                      "var(--brand-light)",
                    border:
                      "1px solid var(--brand-mid)",
                    color:
                      "var(--brand)",
                    borderRadius: 8,
                    padding:
                      "6px 9px",
                    fontSize: 10,
                    fontWeight: 750,
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius:
                        "50%",
                      background:
                        "var(--brand)",
                      color: "#fff",
                      display: "grid",
                      placeItems:
                        "center",
                      fontSize: 8,
                    }}
                  >
                    {index + 1}
                  </span>

                  Day {day}
                </div>
              )
            )}
          </div>
        </div>
      </Section>

      {/* HINDSIGHT */}
      <Section
        icon="🧠"
        title="Hindsight & Recovery Intelligence"
        subtitle="Control the clinical context displayed around recovery events"
      >
        <SettingRow
          title="Longitudinal patient context"
          description="Keep relevant previous recovery information available when reviewing a patient."
          enabled={
            hindsight.longitudinal
          }
          onChange={(v) =>
            update(
              setHindsight,
              "longitudinal",
              v
            )
          }
          badge="CORE"
        />

        <SettingRow
          title="Previous check-in context"
          description="Show earlier check-in information alongside the current recovery update."
          enabled={
            hindsight.previousContext
          }
          onChange={(v) =>
            update(
              setHindsight,
              "previousContext",
              v
            )
          }
        />

        <SettingRow
          title="Risk-change explanations"
          description="Keep the reason behind an elevated risk status visible during review."
          enabled={
            hindsight.explanations
          }
          onChange={(v) =>
            update(
              setHindsight,
              "explanations",
              v
            )
          }
        />

        <div
          style={{
            margin:
              "4px 0 17px",
            padding: 12,
            borderRadius: 10,
            background:
              "rgba(124,58,237,.06)",
            border:
              "1px solid rgba(124,58,237,.13)",
            color:
              "var(--text-secondary)",
            fontSize: 10,
            lineHeight: 1.5,
          }}
        >
          <strong
            style={{
              color: "#7c3aed",
            }}
          >
            Hindsight visibility:
          </strong>{" "}
          These preferences control what
          recovery context is displayed in the
          interface. They do not alter the
          underlying patient record.
        </div>
      </Section>

      {/* ALERTS */}
      <Section
        icon="⚠"
        title="Risk & Alerts"
        subtitle="Control visibility of elevated-risk recovery events"
      >
        <SettingRow
          title="High-risk alerts"
          description="Display patients whose current recovery assessment is classified as High risk."
          enabled={
            alerts.highRisk
          }
          onChange={(v) =>
            update(
              setAlerts,
              "highRisk",
              v
            )
          }
        />

        <SettingRow
          title="Critical-risk alerts"
          description="Keep Critical patients clearly visible for urgent review."
          enabled={
            alerts.criticalRisk
          }
          onChange={(v) =>
            update(
              setAlerts,
              "criticalRisk",
              v
            )
          }
          badge="PRIORITY"
        />

        <SettingRow
          title="Alert review tracking"
          description="Keep confirmation and review decisions visible in the alert workflow."
          enabled={
            alerts.reviewTracking
          }
          onChange={(v) =>
            update(
              setAlerts,
              "reviewTracking",
              v
            )
          }
        />
      </Section>

      {/* DASHBOARD */}
      <Section
        icon="▦"
        title="Dashboard & Summary"
        subtitle="Choose which recovery information remains visible on the dashboard"
      >
        <SettingRow
          title="Patient statistics"
          description="Show summary statistics such as patient counts and recovery status."
          enabled={
            dashboard.patientStats
          }
          onChange={(v) =>
            update(
              setDashboard,
              "patientStats",
              v
            )
          }
        />

        <SettingRow
          title="Recent check-ins"
          description="Keep recent patient check-ins visible in dashboard summaries."
          enabled={
            dashboard.recentCheckins
          }
          onChange={(v) =>
            update(
              setDashboard,
              "recentCheckins",
              v
            )
          }
        />

        <SettingRow
          title="Risk distribution"
          description="Display the distribution of current patient risk levels."
          enabled={
            dashboard.riskDistribution
          }
          onChange={(v) =>
            update(
              setDashboard,
              "riskDistribution",
              v
            )
          }
        />

        <SettingRow
          title="Hindsight indicators"
          description="Show when longitudinal recovery context is available for a patient."
          enabled={
            dashboard.hindsightIndicators
          }
          onChange={(v) =>
            update(
              setDashboard,
              "hindsightIndicators",
              v
            )
          }
          badge="NEW"
        />
      </Section>

      {/* SYSTEM INFORMATION */}
      <Section
        icon="ℹ"
        title="System Information"
        subtitle="Current CareTraceAI environment status"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0,1fr))",
            gap: 10,
            padding:
              "15px 0 18px",
          }}
        >
          {[
            [
              "CareTraceAI",
              "Operational",
              "#22c55e",
            ],
            [
              "Patient monitoring",
              "Active",
              "#0f766e",
            ],
            [
              "Check-in workflow",
              "Active",
              "#0e7490",
            ],
            [
              "Hindsight context",
              "Active",
              "#7c3aed",
            ],
          ].map(
            ([label, value, color]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                  gap: 10,
                  padding:
                    "11px 12px",
                  borderRadius: 9,
                  background:
                    "var(--surface)",
                  border:
                    "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color:
                      "var(--text-muted)",
                  }}
                >
                  {label}
                </span>

                <span
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: 6,
                    fontSize: 10,
                    fontWeight: 750,
                    color:
                      "var(--text-secondary)",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius:
                        "50%",
                      background:
                        color,
                    }}
                  />
                  {value}
                </span>
              </div>
            )
          )}
        </div>

        <div
          style={{
            paddingTop: 13,
            borderTop:
              "1px solid var(--border)",
            fontSize: 9,
            color:
              "var(--text-muted)",
          }}
        >
          CareTraceAI · Recovery
          monitoring workspace
        </div>
      </Section>

      {/* BOTTOM SAVE */}
      <div
        style={{
          display: "flex",
          justifyContent:
            "flex-end",
          alignItems: "center",
          gap: 10,
          paddingTop: 2,
        }}
      >
        {saved && (
          <span
            style={{
              fontSize: 10,
              color:
                "var(--success-text)",
              fontWeight: 700,
            }}
          >
            ✓ Preferences saved
          </span>
        )}

        <button
          className="btn-primary"
          onClick={savePreferences}
        >
          Save Preferences
        </button>
      </div>
    </div>
  );
}