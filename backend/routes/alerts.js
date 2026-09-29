const express = require("express");
const router = express.Router();
const db = require("../database");
const { retain } = require("../services/memory");

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

// GET /api/alerts — Fetch alerts with patient and check-in context
router.get("/", async (req, res) => {
  try {
    const { status, severity } = req.query;
    let sql = `
      SELECT
        a.id,
        a.patient_id,
        a.checkin_id,
        a.severity,
        a.title,
        a.message,
        a.status,
        a.created_at,
        p.name AS patient_name,
        p.phone AS patient_phone,
        COALESCE(p.procedure, '') AS procedure_name,
        p.surgery_date,
        p.risk_level AS current_patient_risk,
        c.day AS checkin_day,
        c.pain,
        c.pain_delta,
        c.mobility,
        c.swelling,
        c.fever,
        c.symptoms,
        c.trend,
        c.hindsight_summary,
        c.explanation AS checkin_explanation
      FROM alerts a
      JOIN patients p ON a.patient_id = p.id
      LEFT JOIN checkins c ON a.checkin_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== "All") {
      sql += " AND a.status = ?";
      params.push(status);
    }
    if (severity && severity !== "All") {
      sql += " AND a.severity = ?";
      params.push(severity.toLowerCase());
    }

    sql += " ORDER BY a.id DESC LIMIT 100";

    const rows = await all(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("Fetch alerts error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alerts/count — Quick metrics for dashboard & badges
router.get("/count", async (req, res) => {
  try {
    const rows = await all("SELECT severity, status FROM alerts WHERE status = 'open'");
    const total_open = rows.length;
    const critical = rows.filter((r) => r.severity === "critical").length;
    const high = rows.filter((r) => r.severity === "high").length;
    res.json({ total_open, critical, high });
  } catch (err) {
    console.error("Alert count error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/:id/review — Doctor/Staff reviews an alert
router.post("/:id/review", async (req, res) => {
  try {
    const alertId = req.params.id;
    const { outcome, note = "" } = req.body;

    const alert = await get("SELECT * FROM alerts WHERE id = ?", [alertId]);
    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }

    const patient = await get("SELECT * FROM patients WHERE id = ?", [alert.patient_id]);

    // Record review in reviews table
    await run(
      `INSERT INTO reviews (checkin_id, patient_id, outcome, note)
       VALUES (?,?,?,?)`,
      [alert.checkin_id, alert.patient_id, outcome, note]
    );

    // Update alert status
    const newStatus = outcome === "False alarm" ? "dismissed" : "reviewed";
    await run("UPDATE alerts SET status = ? WHERE id = ?", [newStatus, alertId]);

    // If false alarm, reset patient risk level
    if (outcome === "False alarm") {
      await run("UPDATE patients SET risk_level = 'Low' WHERE id = ?", [alert.patient_id]);
    }

    // Retain memory of clinical decision
    if (patient) {
      try {
        await retain(
          patient,
          `Alert #${alertId} reviewed by clinical staff. Outcome: "${outcome}". Notes: "${note}". Alert status changed to ${newStatus}.`
        );
      } catch (memErr) {
        console.log("Memory retain skipped on review:", memErr.message);
      }
    }

    res.json({ success: true, alert_id: alertId, status: newStatus });
  } catch (err) {
    console.error("Alert review error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
