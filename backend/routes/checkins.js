const express = require("express");
const router = express.Router();

const db = require("../database");
const { retain, recall, retainClinicianReview } = require("../services/memory");
const { assess } = require("../services/risk");

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

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */

function calculateDay(patient, requestedDay) {
  if (requestedDay !== undefined && requestedDay !== null && requestedDay !== "") {
    return Number(requestedDay);
  }

  if (!patient.surgery_date) return 1;

  const surgery = new Date(patient.surgery_date);
  if (Number.isNaN(surgery.getTime())) return 1;

  const now = new Date();
  surgery.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((now.getTime() - surgery.getTime()) / 86400000);
  return Math.max(1, diffDays);
}

function numberOrDefault(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

const SWELLING_RANKS = { none: 0, mild: 1, moderate: 2, severe: 3 };
const MOBILITY_RANKS = { better: 3, good: 3, same: 2, moderate: 2, worse: 1, poor: 1 };

/**
 * Longitudinal Hindsight Engine comparison.
 * Compares current observation with previous historical check-in.
 */
function compareWithPrevious(current, previous) {
  if (!previous) {
    const summary = [
      "Initial Baseline Established:",
      `Pain: ${current.pain}/10`,
      `Mobility: ${current.mobility || "Not specified"}`,
      `Swelling: ${current.swelling || "None"}`,
      `Fever: ${current.fever ? "Yes" : "No"}`
    ].join(" · ");

    return {
      trend: "baseline",
      pain_delta: null,
      changes: [],
      previous_snapshot: null,
      current_snapshot: {
        pain: current.pain,
        mobility: current.mobility || "Not recorded",
        swelling: current.swelling || "None",
        fever: current.fever ? "Yes" : "No",
        symptoms: current.symptoms || "None reported"
      },
      summary
    };
  }

  const currentPain = numberOrDefault(current.pain);
  const previousPain = numberOrDefault(previous.pain);
  const painDelta = currentPain - previousPain;

  const currentMob = normalizeText(current.mobility).toLowerCase();
  const previousMob = normalizeText(previous.mobility).toLowerCase();

  const currentSwl = normalizeText(current.swelling).toLowerCase();
  const previousSwl = normalizeText(previous.swelling).toLowerCase();

  const currentFever = Number(current.fever) ? 1 : 0;
  const previousFever = Number(previous.fever) ? 1 : 0;

  const changes = [];

  // Pain delta
  if (painDelta > 0) {
    changes.push(`Pain increased: ${previousPain} → ${currentPain} (+${painDelta})`);
  } else if (painDelta < 0) {
    changes.push(`Pain decreased: ${previousPain} → ${currentPain} (${painDelta})`);
  } else {
    changes.push(`Pain unchanged: ${currentPain}/10`);
  }

  // Mobility change
  if (currentMob && previousMob && currentMob !== previousMob) {
    changes.push(`Mobility: ${previous.mobility} → ${current.mobility}`);
  }

  // Swelling change
  if (currentSwl && previousSwl && currentSwl !== previousSwl) {
    changes.push(`Swelling: ${previous.swelling} → ${current.swelling}`);
  }

  // Fever change
  if (currentFever !== previousFever) {
    changes.push(
      currentFever === 1
        ? "Fever: No → Yes (fever appeared)"
        : "Fever: Yes → No (fever resolved)"
    );
  } else if (currentFever === 1) {
    changes.push("Fever: Persistent fever reported");
  }

  // Symptoms change
  const currentSym = normalizeText(current.symptoms);
  const previousSym = normalizeText(previous.symptoms);
  if (currentSym && currentSym.toLowerCase() !== previousSym.toLowerCase()) {
    changes.push(`New symptoms: "${currentSym}"`);
  }

  // Trend determination based on longitudinal deltas
  let worseningScore = 0;
  let improvingScore = 0;

  if (painDelta >= 2) worseningScore += 2;
  else if (painDelta === 1) worseningScore += 0.5;
  else if (painDelta <= -2) improvingScore += 2;
  else if (painDelta === -1) improvingScore += 1;

  if (currentFever === 1 && previousFever === 0) worseningScore += 3;
  if (currentFever === 0 && previousFever === 1) improvingScore += 2;

  const curSwlRank = SWELLING_RANKS[currentSwl] ?? 1;
  const prevSwlRank = SWELLING_RANKS[previousSwl] ?? 1;
  if (curSwlRank > prevSwlRank) worseningScore += (curSwlRank - prevSwlRank);
  else if (curSwlRank < prevSwlRank) improvingScore += (prevSwlRank - curSwlRank);

  const curMobRank = MOBILITY_RANKS[currentMob] ?? 2;
  const prevMobRank = MOBILITY_RANKS[previousMob] ?? 2;
  if (curMobRank < prevMobRank) worseningScore += (prevMobRank - curMobRank);
  else if (curMobRank > prevMobRank) improvingScore += (curMobRank - prevMobRank);

  let trend = "stable";
  if (worseningScore >= 2 || (worseningScore > improvingScore && worseningScore >= 1.5)) {
    trend = "worsening";
  } else if (improvingScore >= 2 || (improvingScore > worseningScore && improvingScore >= 1.5)) {
    trend = "improving";
  }

  // Structured Hindsight Summary
  const prevDetails = `Pain ${previousPain}/10, ${previous.swelling || "no"} swelling, ${previousFever ? "fever reported" : "no fever"}`;
  const currDetails = `Pain ${currentPain}/10, ${current.swelling || "no"} swelling, ${currentFever ? "fever reported" : "no fever"}`;

  const summary = `Previous: ${prevDetails}. Current: ${currDetails}. Observed trend: ${trend.toUpperCase()}. Changes: ${changes.join("; ")}.`;

  return {
    trend,
    pain_delta: painDelta,
    changes,
    previous_snapshot: {
      pain: previousPain,
      mobility: previous.mobility || "Not recorded",
      swelling: previous.swelling || "None",
      fever: previousFever ? "Yes" : "No",
      symptoms: previous.symptoms || "None"
    },
    current_snapshot: {
      pain: currentPain,
      mobility: current.mobility || "Not recorded",
      swelling: current.swelling || "None",
      fever: currentFever ? "Yes" : "No",
      symptoms: current.symptoms || "None"
    },
    summary
  };
}

/* ---------------------------------------------------------
   POST /api/checkins
   Create and evaluate a daily recovery check-in
--------------------------------------------------------- */
router.post("/", async (req, res) => {
  try {
    const {
      patient_id,
      message = "",
      pain = 0,
      mobility = "",
      swelling = "",
      fever = 0,
      symptoms = "",
      treatment_answers,
      treatment_answers_json,
      memory = "on"
    } = req.body;

    if (!patient_id) {
      return res.status(400).json({ error: "patient_id is required" });
    }

    const patient = await get("SELECT * FROM patients WHERE id = ?", [patient_id]);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const day = calculateDay(patient, req.body.day);

    const serializedTreatmentAnswers = treatment_answers_json
      ? (typeof treatment_answers_json === 'string' ? treatment_answers_json : JSON.stringify(treatment_answers_json))
      : (treatment_answers ? JSON.stringify(treatment_answers) : null);

    // Retrieve previous completed check-in for longitudinal recall
    const previous = await get(
      `SELECT * FROM checkins
       WHERE patient_id = ? AND status = 'completed'
       ORDER BY day DESC, id DESC
       LIMIT 1`,
      [patient_id]
    );

    const current = {
      pain: Math.min(10, Math.max(0, numberOrDefault(pain))),
      mobility: normalizeText(mobility) || (previous?.mobility || "Same"),
      swelling: normalizeText(swelling) || (previous?.swelling || "None"),
      fever: Number(fever) === 1 ? 1 : 0,
      symptoms: normalizeText(symptoms)
    };

    // Longitudinal Hindsight Engine comparison
    const comparison = compareWithPrevious(current, previous);

    // Recent longitudinal window (last 7 check-ins)
    const recentHistory = await all(
      `SELECT * FROM checkins
       WHERE patient_id = ? AND status = 'completed'
       ORDER BY day DESC, id DESC
       LIMIT 7`,
      [patient_id]
    );

    // External Hindsight/memory recall
    let memories = [];
    if (memory !== "off") {
      try {
        memories = await recall(
          patient,
          `Post-op recovery Day ${day}. Current update: ${message}. Pain: ${current.pain}/10. Mobility: ${current.mobility}. Swelling: ${current.swelling}. Fever: ${current.fever ? "yes" : "no"}. Symptoms: ${current.symptoms}. Trend: ${comparison.trend}.`
        );
      } catch (memoryError) {
        console.log("External memory recall unavailable:", memoryError.message);
        memories = [];
      }
    }

    // Clinical Risk Assessment
    const riskResult = await assess({
      patient,
      day,
      message,
      pain: current.pain,
      mobility: current.mobility,
      swelling: current.swelling,
      fever: current.fever,
      symptoms: current.symptoms,
      history: memories,
      recentHistory,
      previous,
      hindsight: comparison
    });

    const riskLevel = riskResult.risk_level || "Low";
    const trend = comparison.trend || riskResult.trend || "stable";

    // Insert completed check-in into database
    const ins = await run(
      `INSERT INTO checkins
       (
         patient_id, day, message, pain, mobility, swelling,
         fever, symptoms, risk_level, explanation, trend,
         hindsight_summary, pain_delta, status, treatment_answers_json, completed_at
       )
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
      [
        patient_id,
        day,
        message,
        current.pain,
        current.mobility,
        current.swelling,
        current.fever,
        current.symptoms,
        riskLevel,
        riskResult.explanation || "",
        trend,
        comparison.summary,
        comparison.pain_delta,
        "completed",
        serializedTreatmentAnswers
      ]
    );

    const checkinId = ins.lastID;

    // Update patient's current risk level and last_checkin
    await run(
      `UPDATE patients
       SET risk_level = ?,
           last_checkin = datetime('now')
       WHERE id = ?`,
      [riskLevel, patient_id]
    );

    // Alert Generation Engine
    // Triggered automatically when risk is High or Critical, or when acute worsening is detected
    let alert = null;
    if (riskLevel === "High" || riskLevel === "Critical") {
      const severity = riskLevel.toLowerCase();
      const alertTitle =
        riskLevel === "Critical"
          ? `🚨 Critical Recovery Alert — Day ${day}`
          : `⚠️ Elevated Risk Warning — Day ${day}`;

      const alertMessage = [
        comparison.summary,
        riskResult.explanation || "",
        current.symptoms ? `Reported symptoms: "${current.symptoms}".` : ""
      ]
        .filter(Boolean)
        .join(" ");

      const alertIns = await run(
        `INSERT INTO alerts
         (patient_id, checkin_id, severity, title, message, status)
         VALUES (?,?,?,?,?,'open')`,
        [patient_id, checkinId, severity, alertTitle, alertMessage]
      );

      alert = {
        id: alertIns.lastID,
        severity,
        title: alertTitle,
        message: alertMessage,
        status: "open"
      };
    }

    // Retain memory into external Hindsight client (non-blocking)
    try {
      await retain(
        patient,
        `Day ${day} check-in: Pain ${current.pain}/10 (delta: ${comparison.pain_delta ?? "baseline"}), Mobility ${current.mobility}, Swelling ${current.swelling}, Fever ${current.fever ? "yes" : "no"}, Symptoms: ${current.symptoms || "none"}. Trend: ${trend}, Risk: ${riskLevel}. ${comparison.summary}${serializedTreatmentAnswers ? ` Procedure answers: ${serializedTreatmentAnswers}` : ''}`,
        {
          event_type: "daily_checkin",
          day_number: day,
          context: {
            pain: current.pain,
            mobility: current.mobility,
            swelling: current.swelling,
            fever: current.fever,
            symptoms: current.symptoms,
            treatment_answers: serializedTreatmentAnswers,
            trend,
            risk_level: riskLevel
          }
        }
      );
    } catch (memErr) {
      console.log("Memory retain skipped:", memErr.message);
    }

    res.json({
      checkin_id: checkinId,
      patient_id,
      day,
      risk_level: riskLevel,
      trend,
      pain_delta: comparison.pain_delta,
      hindsight_summary: comparison.summary,
      changes: comparison.changes,
      previous_snapshot: comparison.previous_snapshot,
      current_snapshot: comparison.current_snapshot,
      explanation: riskResult.explanation || "",
      memories_used: memories,
      alert,
      status: "completed"
    });
  } catch (e) {
    console.error("Check-in creation error:", e);
    res.status(500).json({ error: e.message || "Unable to create check-in" });
  }
});

/* ---------------------------------------------------------
   POST /api/checkins/review
   Doctor/staff records a clinical review or intervention
--------------------------------------------------------- */
router.post("/review", async (req, res) => {
  try {
    const { checkin_id, patient_id, outcome, note = "", clinician_name = "Attending Clinician", alert_id } = req.body;

    const patient = await get("SELECT * FROM patients WHERE id = ?", [patient_id]);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    // Determine day number and alert title from checkin or alert
    let dayNumber = 1;
    let alertTitle = "Clinical Recovery Alert";
    if (checkin_id) {
      const chk = await get("SELECT day FROM checkins WHERE id = ?", [checkin_id]);
      if (chk && chk.day) dayNumber = chk.day;
    }
    if (alert_id) {
      const alt = await get("SELECT title FROM alerts WHERE id = ?", [alert_id]);
      if (alt && alt.title) alertTitle = alt.title;
    }

    const reviewIns = await run(
      `INSERT INTO reviews (checkin_id, patient_id, outcome, note)
       VALUES (?,?,?,?)`,
      [checkin_id || null, patient_id, outcome, note]
    );

    // If an alert_id or checkin_id is provided, update alert status to reviewed
    if (alert_id) {
      await run(
        `UPDATE alerts
         SET status = 'reviewed'
         WHERE id = ?`,
        [alert_id]
      );
    } else if (checkin_id) {
      await run(
        `UPDATE alerts
         SET status = 'reviewed'
         WHERE checkin_id = ? AND patient_id = ?`,
        [checkin_id, patient_id]
      );
    }

    // When clinician marks as False alarm or Resolved, reset patient risk to Low
    if (outcome === "False alarm" || outcome === "Resolved") {
      await run("UPDATE patients SET risk_level = 'Low' WHERE id = ?", [patient_id]);
      await run("UPDATE alerts SET status = 'dismissed' WHERE patient_id = ? AND status = 'open'", [patient_id]);
    } else if (outcome === "Confirmed concern") {
      // Clinician confirmed acute concern
      await run("UPDATE patients SET risk_level = 'High' WHERE id = ?", [patient_id]);
    }

    // Retain review outcome in persistent Hindsight memory
    try {
      await retainClinicianReview(patient, {
        outcome,
        note: clinician_name ? `[${clinician_name}] ${note}` : note,
        alert_title: alertTitle,
        day_number: dayNumber
      });
    } catch (memErr) {
      console.log("Memory retain review skipped:", memErr.message);
    }

    res.json({ ok: true, review_id: reviewIns.lastID, outcome, note });
  } catch (e) {
    console.error("Review error:", e);
    res.status(500).json({ error: e.message });
  }
});

/* ---------------------------------------------------------
   GET /api/checkins/:patientId
   Patient longitudinal recovery timeline
--------------------------------------------------------- */
router.get("/:patientId", async (req, res) => {
  try {
    const rows = await all(
      `SELECT * FROM checkins
       WHERE patient_id = ?
       ORDER BY day ASC, id ASC`,
      [req.params.patientId]
    );

    const completed = rows.filter((r) => r.status === "completed");
    const latest = completed.length ? completed[completed.length - 1] : null;
    const previous = completed.length > 1 ? completed[completed.length - 2] : null;

    const trendCounts = completed.reduce(
      (acc, row) => {
        const tr = row.trend || "stable";
        if (acc[tr] !== undefined) acc[tr]++;
        return acc;
      },
      { improving: 0, stable: 0, worsening: 0, baseline: 0 }
    );

    // Provide both array and summary structure for maximum flexibility
    res.json({
      checkins: rows,
      summary: {
        total: rows.length,
        completed: completed.length,
        latest,
        previous,
        trend_counts: trendCounts
      }
    });
  } catch (e) {
    console.error("Check-in history error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;