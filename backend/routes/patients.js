const express = require("express");
const router = express.Router();
const db = require("../database");
const { retain, getPatientMemories, getHindsightActivityLog } = require("../services/memory");
const { getTemplateForProcedure } = require("../services/questions");
const { generateRecoveryReport } = require("../services/reportEngine");

const all = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );

const get = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
  );

const run = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this);
    })
  );

function calculateRecoveryDay(startDate) {
  if (!startDate) return 1;
  const surgery = new Date(startDate);
  if (Number.isNaN(surgery.getTime())) return 1;
  const now = new Date();
  surgery.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((now.getTime() - surgery.getTime()) / 86400000);
  return Math.max(1, diff);
}

// GET /api/patients — List all patients with post-surgery monitoring plan & latest status
router.get("/", async (_req, res) => {
  try {
    const patients = await all("SELECT * FROM patients ORDER BY id DESC");

    // Enrich with latest check-in data (Day, Trend, Pain, Status)
    const enriched = await Promise.all(
      patients.map(async (p) => {
        const latestCheckin = await get(
          `SELECT day, trend, pain, mobility, swelling, fever, symptoms, created_at, hindsight_summary, status
           FROM checkins
           WHERE patient_id = ? AND status = 'completed'
           ORDER BY day DESC, id DESC LIMIT 1`,
          [p.id]
        );

        const currentDay = calculateRecoveryDay(p.discharge_date || p.surgery_date);
        const monitoringDays = p.monitoring_days || 10;
        const isComplete = p.monitoring_status === "completed" || currentDay > monitoringDays;

        return {
          ...p,
          procedure_name: p.procedure || p.procedure_name || "Post-op Care",
          procedure: p.procedure || p.procedure_name || "Post-op Care",
          current_day: latestCheckin ? latestCheckin.day : currentDay,
          monitoring_days: monitoringDays,
          monitoring_status: isComplete && p.monitoring_status !== "paused" ? "completed" : (p.monitoring_status || "active"),
          trend: latestCheckin?.trend || "stable",
          last_pain: latestCheckin?.pain ?? null,
          latest_checkin: latestCheckin || null
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error("List patients error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/patients/hindsight-feed — Live feed of longitudinal Hindsight check-in comparisons
router.get("/hindsight-feed", async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const rows = await all(
      `SELECT c.id as checkin_id, c.patient_id, c.day, c.pain, c.pain_delta,
              c.mobility, c.swelling, c.fever, c.symptoms, c.trend, c.risk_level,
              c.hindsight_summary, c.explanation, c.created_at,
              p.name as patient_name, p.phone as patient_phone,
              COALESCE(p.procedure, 'Post-op Care') as procedure_name,
              p.procedure,
              p.surgery_date,
              p.discharge_date,
              p.monitoring_status
       FROM checkins c
       JOIN patients p ON c.patient_id = p.id
       WHERE c.status = 'completed'
       ORDER BY c.id DESC
       LIMIT ?`,
      [limit]
    );

    const checkinIds = rows.map((r) => r.checkin_id);
    let alertMap = {};
    if (checkinIds.length > 0) {
      const placeholders = checkinIds.map(() => "?").join(",");
      const alerts = await all(
        `SELECT id, checkin_id, severity, title, status FROM alerts WHERE checkin_id IN (${placeholders})`,
        checkinIds
      );
      alerts.forEach((a) => {
        alertMap[a.checkin_id] = a;
      });
    }

    const feed = rows.map((r) => ({
      ...r,
      alert: alertMap[r.checkin_id] || null
    }));

    res.json(feed);
  } catch (err) {
    console.error("Hindsight feed error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/patients/:id/questions — Treatment-specific questionnaire tailored to this patient's procedure
router.get("/:id/questions", async (req, res) => {
  try {
    const patient = await get("SELECT * FROM patients WHERE id = ?", [req.params.id]);
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const template = await getTemplateForProcedure(patient.procedure);
    res.json({
      patient_id: patient.id,
      patient_name: patient.name,
      procedure: patient.procedure,
      template_title: template.title,
      description: template.description,
      procedure_key: template.procedure_key,
      questions: template.questions
    });
  } catch (err) {
    console.error("Get patient questions error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/patients/:id/hindsight-log — 4-phase Hindsight Inspector Log (RECALL -> CURRENT -> ANALYSIS -> RETAIN)
router.get("/:id/hindsight-log", async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const patient = await get("SELECT * FROM patients WHERE id = ?", [patientId]);
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const activity = await getHindsightActivityLog(patientId);
    res.json({
      ...activity,
      patient_name: patient.name,
      procedure: patient.procedure
    });
  } catch (err) {
    console.error("Hindsight log error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/patients/:id/report — Retrieve 10-day recovery report
router.get("/:id/report", async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const existing = await get(
      `SELECT * FROM reports WHERE patient_id = ? ORDER BY id DESC LIMIT 1`,
      [patientId]
    );

    if (existing && existing.summary_json) {
      return res.json(JSON.parse(existing.summary_json));
    }

    // If no pre-generated report exists, generate it dynamically
    const generated = await generateRecoveryReport(patientId, { monitoring_days: req.query.days || 10 });
    res.json(generated);
  } catch (err) {
    console.error("Get report error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/patients/:id/report/generate — Explicitly synthesize or regenerate 10-day report
router.post("/:id/report/generate", async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const monitoringDays = Number(req.body.monitoring_days) || 10;
    const report = await generateRecoveryReport(patientId, { monitoring_days: monitoringDays });
    res.json(report);
  } catch (err) {
    console.error("Generate report error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/patients/:id/monitoring — Hospital staff manages monitoring plan (activate, pause, resume, complete)
router.post("/:id/monitoring", async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const { action } = req.body; // 'activate', 'pause', 'resume', 'complete'

    const patient = await get("SELECT * FROM patients WHERE id = ?", [patientId]);
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    let newStatus = "active";
    if (action === "pause") newStatus = "paused";
    else if (action === "complete") newStatus = "completed";
    else if (action === "resume" || action === "activate") newStatus = "active";

    await run("UPDATE patients SET monitoring_status = ? WHERE id = ?", [newStatus, patientId]);

    // Retain monitoring status change in Hindsight memory
    try {
      await retain(
        patient,
        `Monitoring status changed to "${newStatus}" by clinical team. Action: "${action}".`,
        { event_type: "monitoring_status_change", day_number: calculateRecoveryDay(patient.surgery_date) }
      );
    } catch (e) {}

    res.json({ success: true, patient_id: patientId, monitoring_status: newStatus });
  } catch (err) {
    console.error("Monitoring action error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/patients/:id/milestone-summary — Synthesize multi-day recovery arc & milestone report
router.get("/:id/milestone-summary", async (req, res) => {
  try {
    const patientId = Number(req.params.id);
    const targetDay = req.query.day ? Number(req.query.day) : null;

    const patient = await get("SELECT * FROM patients WHERE id = ?", [patientId]);
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    let sql = `SELECT * FROM checkins WHERE patient_id = ? AND status = 'completed'`;
    const params = [patientId];
    if (targetDay) {
      sql += ` AND day <= ?`;
      params.push(targetDay);
    }
    sql += ` ORDER BY day ASC, id ASC`;

    const checkins = await all(sql, params);
    const alerts = await all(
      `SELECT * FROM alerts WHERE patient_id = ? ORDER BY id DESC`,
      [patientId]
    );

    const calculatedDay = calculateRecoveryDay(patient.discharge_date || patient.surgery_date);

    if (checkins.length === 0) {
      return res.json({
        patient_id: patient.id,
        patient_name: patient.name,
        procedure: patient.procedure || patient.procedure_name || "Post-op Care",
        milestone_day: targetDay || calculatedDay,
        total_checkins: 0,
        milestone_status: "Pending Check-ins",
        overall_pain_change: 0,
        baseline: null,
        latest: null,
        fever_episodes: 0,
        executive_summary: `Patient ${patient.name} has not submitted any recovery check-ins yet. Trigger a WhatsApp check-in to initiate baseline tracking.`,
        pain_trajectory: [],
        milestones: [],
        alerts: []
      });
    }

    const baseline = checkins[0];
    const latest = checkins[checkins.length - 1];
    const daysMonitored = latest.day;

    const painDelta = latest.pain - baseline.pain;
    const painTrajectory = checkins.map(c => ({
      day: c.day,
      pain: c.pain,
      mobility: c.mobility || "Not recorded",
      swelling: c.swelling || "None",
      fever: Boolean(c.fever),
      trend: c.trend || "stable",
      risk_level: c.risk_level || "Low",
      date: c.created_at
    }));

    const mobilities = [...new Set(checkins.map(c => c.mobility).filter(Boolean))];
    const swellingLevels = [...new Set(checkins.map(c => c.swelling).filter(Boolean))];
    const feverEvents = checkins.filter(c => c.fever === 1);

    const milestones = [
      { day: 3, title: "Day 3 Acute Baseline", description: "Early inflammation and pain stabilization check" },
      { day: 7, title: "Day 7 Early Recovery", description: "Mobility progression and wound healing milestone" },
      { day: 10, title: "Day 10 Clinical Report", description: "Comprehensive 10-day recovery evaluation & milestone" },
      { day: 14, title: "Day 14 Sub-acute Milestone", description: "Suture review and functional mobility transition" }
    ].map(m => {
      const match = checkins.find(c => c.day === m.day);
      const isReached = daysMonitored >= m.day;
      return {
        ...m,
        status: isReached ? (match ? "Completed" : "Past due") : "Upcoming",
        checkin: match || null
      };
    });

    let milestoneStatus = "On Track";
    if (latest.risk_level === "Critical" || alerts.some(a => a.status === "open" && a.severity === "critical")) {
      milestoneStatus = "Critical Attention";
    } else if (latest.risk_level === "High" || painDelta > 1 || latest.trend === "worsening") {
      milestoneStatus = "Needs Monitoring";
    } else if (painDelta < 0 || latest.trend === "improving") {
      milestoneStatus = "Progressing Well";
    }

    const feverSummary = feverEvents.length > 0
      ? `Fever was reported in ${feverEvents.length} check-in(s) (Day ${feverEvents.map(f => f.day).join(", ")}).`
      : "No fever episodes have been reported.";

    const mobSummary = `Mobility is currently ${latest.mobility || "stable"} (initial baseline: ${baseline.mobility || "baseline"}).`;
    const swlSummary = `Swelling is currently ${latest.swelling || "none"}.`;

    const painSummary = painDelta < 0
      ? `Pain has decreased from ${baseline.pain}/10 on Day ${baseline.day} to ${latest.pain}/10 on Day ${latest.day} (favorable reduction of ${Math.abs(painDelta)} points).`
      : painDelta > 0
      ? `Pain has increased from ${baseline.pain}/10 on Day ${baseline.day} to ${latest.pain}/10 on Day ${latest.day} (+${painDelta} points escalation).`
      : `Pain has remained stable at ${latest.pain}/10 from Day ${baseline.day} to Day ${latest.day}.`;

    const executiveSummary = [
      `Patient ${patient.name} is on Day ${latest.day} post ${patient.procedure || "surgery"}.`,
      painSummary,
      mobSummary,
      swlSummary,
      feverSummary,
      `Observed longitudinal trajectory: ${latest.trend.toUpperCase()} with overall milestone status rated as ${milestoneStatus.toUpperCase()}.`,
      alerts.filter(a => a.status === "open").length > 0
        ? `⚠️ There are currently ${alerts.filter(a => a.status === "open").length} open clinical alerts requiring clinician review.`
        : "All recovery parameters are within expected clinical tolerance."
    ].join(" ");

    res.json({
      patient_id: patient.id,
      patient_name: patient.name,
      phone: patient.phone,
      procedure: patient.procedure || patient.procedure_name || "Post-op Care",
      surgery_date: patient.surgery_date,
      discharge_date: patient.discharge_date,
      current_day: latest.day,
      milestone_day: targetDay || latest.day,
      milestone_status: milestoneStatus,
      total_checkins: checkins.length,
      baseline: {
        day: baseline.day,
        pain: baseline.pain,
        mobility: baseline.mobility,
        swelling: baseline.swelling,
        fever: baseline.fever,
        date: baseline.created_at
      },
      latest: {
        day: latest.day,
        pain: latest.pain,
        mobility: latest.mobility,
        swelling: latest.swelling,
        fever: latest.fever,
        trend: latest.trend,
        risk_level: latest.risk_level,
        symptoms: latest.symptoms,
        date: latest.created_at
      },
      overall_pain_change: painDelta,
      fever_episodes: feverEvents.length,
      mobilities,
      swelling_levels: swellingLevels,
      pain_trajectory: painTrajectory,
      milestones,
      alerts,
      open_alerts_count: alerts.filter(a => a.status === "open").length,
      executive_summary: executiveSummary
    });
  } catch (err) {
    console.error("Milestone summary error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/patients/:id — Single patient details
router.get("/:id", async (req, res) => {
  try {
    const p = await get("SELECT * FROM patients WHERE id = ?", [req.params.id]);
    if (!p) return res.status(404).json({ error: "Patient not found" });

    const latestCheckin = await get(
      `SELECT day, trend, pain, mobility, swelling, fever, symptoms, hindsight_summary, explanation, created_at
       FROM checkins
       WHERE patient_id = ? AND status = 'completed'
       ORDER BY day DESC, id DESC LIMIT 1`,
      [p.id]
    );

    const currentDay = calculateRecoveryDay(p.discharge_date || p.surgery_date);
    const monitoringDays = p.monitoring_days || 10;
    const isComplete = p.monitoring_status === "completed" || currentDay > monitoringDays;

    res.json({
      ...p,
      procedure_name: p.procedure || p.procedure_name || "Post-op Care",
      procedure: p.procedure || p.procedure_name || "Post-op Care",
      current_day: latestCheckin ? latestCheckin.day : currentDay,
      monitoring_days: monitoringDays,
      monitoring_status: isComplete && p.monitoring_status !== "paused" ? "completed" : (p.monitoring_status || "active"),
      trend: latestCheckin?.trend || "stable",
      last_pain: latestCheckin?.pain ?? null,
      latest_checkin: latestCheckin || null
    });
  } catch (err) {
    console.error("Get patient error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/patients — Hospital staff registers a newly discharged post-surgery patient
router.post("/", async (req, res) => {
  try {
    const {
      name,
      phone,
      procedure,
      procedure_name,
      surgery_date,
      discharge_date,
      expected_recovery_days = 14,
      monitoring_days = 10,
      clinical_notes = "",
      recovery_parameters = ""
    } = req.body;

    const finalProcedure = (procedure || procedure_name || "").trim() || "Post-operative Care";

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required." });
    }

    const cleanPhone = String(phone).replace(/\s|-/g, "");
    const surgDate = surgery_date || new Date().toISOString().slice(0, 10);
    const disDate = discharge_date || surgDate;

    const result = await run(
      `INSERT INTO patients
       (name, phone, procedure, surgery_date, discharge_date, expected_recovery_days, monitoring_days, monitoring_status, clinical_notes, recovery_parameters, risk_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 'Low')`,
      [
        name.trim(),
        cleanPhone,
        finalProcedure,
        surgDate,
        disDate,
        Number(expected_recovery_days) || 14,
        Number(monitoring_days) || 10,
        clinical_notes,
        typeof recovery_parameters === "object" ? JSON.stringify(recovery_parameters) : recovery_parameters
      ]
    );

    const newPatient = {
      id: result.lastID,
      name: name.trim(),
      phone: cleanPhone,
      procedure: finalProcedure,
      procedure_name: finalProcedure,
      surgery_date: surgDate,
      discharge_date: disDate,
      expected_recovery_days: Number(expected_recovery_days) || 14,
      monitoring_days: Number(monitoring_days) || 10,
      monitoring_status: "active",
      clinical_notes,
      risk_level: "Low",
      current_day: calculateRecoveryDay(disDate),
      trend: "stable",
      last_checkin: null
    };

    // Retain initial patient registration in Hindsight memory
    try {
      await retain(
        newPatient,
        `Patient ${name} registered following procedure "${finalProcedure}". Surgery date: ${surgDate}. Discharge date: ${disDate}. ${monitoring_days}-day WhatsApp monitoring plan initialized. Notes: "${clinical_notes || "None"}".`,
        { event_type: "registration", day_number: 0, context: { procedure: finalProcedure, surgDate, disDate, monitoring_days } }
      );
    } catch (memErr) {
      console.log("Memory retain note on registration:", memErr.message);
    }

    res.status(201).json(newPatient);
  } catch (err) {
    console.error("Create patient error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/patients/:id — Update patient details and monitoring parameters
router.put("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const {
      name,
      phone,
      procedure,
      procedure_name,
      surgery_date,
      discharge_date,
      expected_recovery_days,
      monitoring_days,
      monitoring_status,
      clinical_notes,
      recovery_parameters,
      risk_level
    } = req.body;

    const finalProcedure = (procedure || procedure_name || "").trim();

    const existing = await get("SELECT * FROM patients WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const updatedName = name ? name.trim() : existing.name;
    const updatedPhone = phone ? String(phone).replace(/\s|-/g, "") : existing.phone;
    const updatedProc = finalProcedure || existing.procedure;
    const updatedSurgDate = surgery_date !== undefined ? surgery_date : existing.surgery_date;
    const updatedDisDate = discharge_date !== undefined ? discharge_date : (existing.discharge_date || existing.surgery_date);
    const updatedRecoveryDays = expected_recovery_days !== undefined ? Number(expected_recovery_days) : existing.expected_recovery_days;
    const updatedMonDays = monitoring_days !== undefined ? Number(monitoring_days) : existing.monitoring_days;
    const updatedMonStatus = monitoring_status || existing.monitoring_status || "active";
    const updatedNotes = clinical_notes !== undefined ? clinical_notes : existing.clinical_notes;
    const updatedRisk = risk_level || existing.risk_level;

    await run(
      `UPDATE patients
       SET name = ?, phone = ?, procedure = ?, surgery_date = ?, discharge_date = ?,
           expected_recovery_days = ?, monitoring_days = ?, monitoring_status = ?,
           clinical_notes = ?, risk_level = ?
       WHERE id = ?`,
      [
        updatedName,
        updatedPhone,
        updatedProc,
        updatedSurgDate,
        updatedDisDate,
        updatedRecoveryDays,
        updatedMonDays,
        updatedMonStatus,
        updatedNotes,
        updatedRisk,
        id
      ]
    );

    const updated = await get("SELECT * FROM patients WHERE id = ?", [id]);
    res.json({
      ...updated,
      procedure_name: updated.procedure,
      current_day: calculateRecoveryDay(updated.discharge_date || updated.surgery_date)
    });
  } catch (err) {
    console.error("Update patient error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/patients/:id — Delete patient and cascade records
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await run("DELETE FROM checkins WHERE patient_id = ?", [id]);
    await run("DELETE FROM alerts WHERE patient_id = ?", [id]);
    await run("DELETE FROM reviews WHERE patient_id = ?", [id]);
    await run("DELETE FROM sms_log WHERE patient_id = ?", [id]);
    await run("DELETE FROM reports WHERE patient_id = ?", [id]);
    await run("DELETE FROM hindsight_memories WHERE patient_id = ?", [id]);

    const result = await run("DELETE FROM patients WHERE id = ?", [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.json({ message: "Patient and all longitudinal recovery records removed successfully." });
  } catch (err) {
    console.error("Delete patient error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;