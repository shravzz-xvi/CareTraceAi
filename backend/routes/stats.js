const express = require("express");
const router = express.Router();
const db = require("../database");

const all = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );

// GET /api/stats & GET /api/stats/summary — Live monitoring metrics for dashboard
const getStatsHandler = async (_req, res) => {
  try {
    const patients = await all("SELECT id, risk_level, monitoring_status, last_checkin FROM patients");
    const total = patients.length;
    const active_patients = patients.filter((r) => (r.monitoring_status || "active") === "active").length;
    const paused_patients = patients.filter((r) => r.monitoring_status === "paused").length;
    const completed_patients = patients.filter((r) => r.monitoring_status === "completed").length;

    const high_risk = patients.filter((r) => r.risk_level === "High").length;
    const critical = patients.filter((r) => r.risk_level === "Critical").length;
    const low = Math.max(0, total - high_risk - critical);

    // Today's completed check-ins (completed today or within the last 24 hours)
    const todayCompletedRows = await all(`
      SELECT COUNT(DISTINCT patient_id) as count
      FROM checkins
      WHERE status = 'completed'
        AND (date(completed_at) = date('now') OR completed_at >= datetime('now', '-24 hours'))
    `);
    const today_completed = todayCompletedRows[0]?.count || 0;

    // Today's pending check-ins
    const today_pending = Math.max(0, active_patients - today_completed);

    // Latest trend counts
    const checkinTrends = await all(`
      SELECT trend, COUNT(*) as count
      FROM (
        SELECT patient_id, trend
        FROM checkins
        WHERE status = 'completed'
        GROUP BY patient_id
        HAVING day = MAX(day)
      )
      GROUP BY trend
    `);

    const trends = {
      improving: 0,
      stable: 0,
      worsening: 0
    };
    checkinTrends.forEach((row) => {
      if (row.trend && trends[row.trend] !== undefined) {
        trends[row.trend] = row.count;
      }
    });

    // Active open alerts
    const alertRows = await all("SELECT COUNT(*) as count FROM alerts WHERE status = 'open'");
    const active_alerts = alertRows[0]?.count || 0;

    // Total completed check-ins & completion rate
    const checkinCountRows = await all("SELECT COUNT(*) as count FROM checkins WHERE status = 'completed'");
    const totalCompletedCheckins = checkinCountRows[0]?.count || 0;
    const denominator = Math.max(1, (active_patients + completed_patients) * 4);
    const completion_rate = Math.min(100, Math.max(15, Math.round((totalCompletedCheckins / denominator) * 100)));

    res.json({
      total,
      total_patients: total,
      active_patients,
      paused_patients,
      completed_patients,
      today_completed,
      today_pending,
      high_risk,
      critical,
      low,
      trends,
      patients_improving: trends.improving,
      patients_stable: trends.stable,
      patients_worsening: trends.worsening,
      active_alerts,
      completion_rate
    });
  } catch (err) {
    console.error("Stats error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

router.get("/", getStatsHandler);
router.get("/summary", getStatsHandler);

module.exports = router;