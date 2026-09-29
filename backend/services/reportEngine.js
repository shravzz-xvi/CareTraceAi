const db = require("../database");
const { getPatientMemories } = require("./memory");

const get = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
  );

const all = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );

const run = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this);
    })
  );

/**
 * Generate a comprehensive 10-day (or configurable milestone) Recovery Report
 * for hospital staff and patient records.
 */
async function generateRecoveryReport(patientId, options = {}) {
  const patient = await get("SELECT * FROM patients WHERE id = ?", [patientId]);
  if (!patient) throw new Error("Patient not found");

  const monitoringDays = options.monitoring_days || patient.monitoring_days || 10;

  // Retrieve checkins up to monitoring period
  const checkins = await all(
    `SELECT * FROM checkins
     WHERE patient_id = ? AND status = 'completed' AND day <= ?
     ORDER BY day ASC, id ASC`,
    [patientId, monitoringDays]
  );

  // Retrieve all alerts
  const alerts = await all(
    `SELECT * FROM alerts WHERE patient_id = ? ORDER BY id ASC`,
    [patientId]
  );

  // Retrieve all clinician reviews
  const reviews = await all(
    `SELECT * FROM reviews WHERE patient_id = ? ORDER BY id ASC`,
    [patientId]
  );

  // Retrieve all Hindsight memories
  const memories = await getPatientMemories(patientId);

  const totalCheckins = checkins.length;
  const completionRate = monitoringDays > 0 ? Math.min(100, Math.round((totalCheckins / monitoringDays) * 100)) : 100;

  if (totalCheckins === 0) {
    return {
      patient_id: patient.id,
      patient_name: patient.name,
      procedure: patient.procedure || "Post-op Care",
      monitoring_period: `Days 1–${monitoringDays}`,
      total_checkins: 0,
      completion_rate: 0,
      final_trend: "Insufficient data",
      executive_summary: `No daily check-ins recorded for ${patient.name} during the monitoring period.`,
      hindsight_analysis: "No recovery memories accumulated.",
      checkins: [],
      alerts: [],
      reviews: []
    };
  }

  const startCheckin = checkins[0];
  const endCheckin = checkins[checkins.length - 1];

  const startPain = startCheckin.pain;
  const endPain = endCheckin.pain;
  const totalPainSum = checkins.reduce((acc, c) => acc + (Number(c.pain) || 0), 0);
  const avgPain = Number((totalPainSum / totalCheckins).toFixed(1));
  const painDeltaTotal = endPain - startPain;

  const painTrend = painDeltaTotal < 0
    ? "Decreasing (Favorable)"
    : painDeltaTotal > 0
    ? "Increasing (Elevated)"
    : "Stable";

  // Mobility progression
  const mobilityProgression = checkins.map((c) => ({
    day: c.day,
    mobility: c.mobility || "Not recorded",
    pain: c.pain
  }));

  // Symptom resolution & fever occurrences
  const feverCount = checkins.filter((c) => c.fever === 1).length;
  const severeSwellingCount = checkins.filter((c) => String(c.swelling).toLowerCase() === "severe").length;

  // Determine final trend
  let finalTrend = "Stable";
  const recentDeteriorations = checkins.filter((c) => c.trend === "worsening").length;
  const recentImprovements = checkins.filter((c) => c.trend === "improving").length;

  if (endCheckin.trend === "improving" || (recentImprovements > recentDeteriorations && painDeltaTotal <= 0)) {
    finalTrend = "Improving";
  } else if (endCheckin.trend === "worsening" || recentDeteriorations > 1 || endCheckin.risk_level === "Critical") {
    finalTrend = "Worsening";
  } else if (recentDeteriorations > 0 && recentImprovements > 0) {
    finalTrend = "Mixed";
  }

  // Synthesize clinical Hindsight analysis
  const hindsightNarrative = [
    `Patient ${patient.name} completed ${totalCheckins} check-in(s) over ${monitoringDays} post-operative days (${completionRate}% adherence).`,
    `Initial baseline on Day ${startCheckin.day} recorded pain at ${startPain}/10 with ${startCheckin.mobility || "baseline"} mobility.`,
    painDeltaTotal < 0
      ? `Pain steadily declined to ${endPain}/10 by Day ${endCheckin.day} (overall reduction of ${Math.abs(painDeltaTotal)} points, avg: ${avgPain}/10).`
      : painDeltaTotal > 0
      ? `Pain escalated to ${endPain}/10 by Day ${endCheckin.day} (+${painDeltaTotal} points increase, avg: ${avgPain}/10).`
      : `Pain remained constant at ${endPain}/10 (avg: ${avgPain}/10).`,
    feverCount > 0 ? `Fever was observed in ${feverCount} check-in(s) during recovery.` : "No post-operative fever was detected.",
    alerts.length > 0 ? `${alerts.length} clinical alert(s) were flagged and evaluated.` : "No high-risk clinical alerts were triggered.",
    reviews.length > 0 ? `Hospital staff recorded ${reviews.length} clinical review intervention(s).` : "No urgent clinician interventions were required.",
    `Final recovery trajectory is classified as ${finalTrend.toUpperCase()}.`
  ].join(" ");

  const executiveSummary = `Comprehensive ${monitoringDays}-Day Post-Surgery Recovery Evaluation for ${patient.name} (${patient.procedure || "Surgery"}). Trajectory: ${finalTrend}. Pain: ${startPain}/10 → ${endPain}/10 (${painDeltaTotal > 0 ? "+" : ""}${painDeltaTotal} pts). Mobility: ${endCheckin.mobility || "Stable"}. Swelling: ${endCheckin.swelling || "None"}.`;

  const reportData = {
    patient_id: patient.id,
    patient_name: patient.name,
    phone: patient.phone,
    procedure: patient.procedure || "Post-op Care",
    surgery_date: patient.surgery_date,
    discharge_date: patient.discharge_date || patient.surgery_date,
    monitoring_days: monitoringDays,
    monitoring_period: `Days 1–${monitoringDays}`,
    total_checkins: totalCheckins,
    completion_rate: completionRate,
    start_pain: startPain,
    end_pain: endPain,
    avg_pain: avgPain,
    pain_delta_total: painDeltaTotal,
    pain_trend: painTrend,
    mobility_progression: mobilityProgression,
    final_mobility: endCheckin.mobility || "Stable",
    final_swelling: endCheckin.swelling || "None",
    fever_count: feverCount,
    severe_swelling_count: severeSwellingCount,
    alerts_count: alerts.length,
    open_alerts_count: alerts.filter((a) => a.status === "open").length,
    reviews_count: reviews.length,
    final_trend: finalTrend,
    hindsight_memories_count: memories.length,
    hindsight_analysis: hindsightNarrative,
    executive_summary: executiveSummary,
    checkins,
    alerts,
    reviews,
    generated_at: new Date().toISOString()
  };

  // Persist into reports table
  try {
    await run(
      `INSERT INTO reports
       (patient_id, milestone_day, report_type, completion_rate, start_pain, end_pain, avg_pain, pain_trend, mobility_trend, final_trend, summary_json, executive_summary, hindsight_analysis)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patient.id,
        monitoringDays,
        "10_day_recovery_report",
        completionRate,
        startPain,
        endPain,
        avgPain,
        painTrend,
        endCheckin.mobility || "Stable",
        finalTrend,
        JSON.stringify(reportData),
        executiveSummary,
        hindsightNarrative
      ]
    );
  } catch (repErr) {
    console.warn("Report save warning:", repErr.message);
  }

  return reportData;
}

module.exports = {
  generateRecoveryReport
};
