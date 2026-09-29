const express = require("express");
const router = express.Router();
const twilio = require("twilio");
const db = require("../database");
const { runCheckins } = require("../cron");
const { getTemplateForProcedure, formatWhatsAppMessage } = require("../services/questions");

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

const all = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || sid.includes("xxx") || sid.length < 10) return null;
  return twilio(sid, token);
}

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

/**
 * POST /api/sms/whatsapp-trigger
 * Hospital staff triggers a daily recovery check-in to patient WhatsApp.
 * Accurately reports whether message was dispatched live or simulated.
 */
const whatsappTriggerHandler = async (req, res) => {
  try {
    const { patient_id, custom_message } = req.body;
    if (!patient_id) {
      return res.status(400).json({ error: "patient_id is required" });
    }

    const patient = await get("SELECT * FROM patients WHERE id = ?", [patient_id]);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const baseDate = patient.discharge_date || patient.surgery_date;
    const day = calculateRecoveryDay(baseDate);

    const clientBase = process.env.CLIENT_URL || "http://localhost:3000";
    const checkinUrl = `${clientBase}/checkin/${patient.id}`;

    // Get treatment-specific question template
    const template = await getTemplateForProcedure(patient.procedure);
    const defaultMsg = formatWhatsAppMessage(patient, day, template, checkinUrl);
    const messageText = custom_message || defaultMsg;

    let cleanPhone = String(patient.phone || "").replace(/\s|-/g, "");
    if (!cleanPhone.startsWith("+")) {
      cleanPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    }
    const waPhone = cleanPhone.replace("+", "");
    const whatsappWebUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(messageText)}`;

    const client = getTwilioClient();
    let twilioResult = null;
    let provider = "simulation";
    let deliveryStatus = "simulated";
    let isSimulation = true;

    if (client && process.env.TWILIO_FROM_NUMBER) {
      try {
        provider = "twilio";
        const fromNumber = process.env.TWILIO_FROM_NUMBER.startsWith("whatsapp:")
          ? process.env.TWILIO_FROM_NUMBER
          : `whatsapp:${process.env.TWILIO_FROM_NUMBER}`;
        const toNumber = `whatsapp:+${waPhone}`;

        twilioResult = await client.messages.create({
          body: messageText,
          from: fromNumber,
          to: toNumber,
        });
        isSimulation = false;
        deliveryStatus = twilioResult.status || "delivered";
        console.log(`✅ Live WhatsApp sent to ${patient.name} (${toNumber}) via Twilio (SID: ${twilioResult.sid})`);
      } catch (twErr) {
        console.warn(`⚠️ Twilio dispatch failed (${twErr.message}). Recording in simulation mode.`);
        provider = "simulation";
        deliveryStatus = "simulated";
        isSimulation = true;
      }
    } else {
      provider = "simulation";
      deliveryStatus = "simulated";
      isSimulation = true;
      console.log(`📱 [Simulated WhatsApp Trigger] Generated for ${patient.name} (${waPhone}): Day ${day}`);
    }

    // Log to sms_log table with comprehensive audit metadata
    await run(
      `INSERT INTO sms_log (patient_id, phone, message, message_type, provider, status, delivery_status, scheduled_time, sent_time, day_number)
       VALUES (?, ?, ?, 'checkin_trigger', ?, 'sent', ?, datetime('now'), datetime('now'), ?)`,
      [patient.id, patient.phone, messageText, provider, deliveryStatus, day]
    );

    res.json({
      success: true,
      patient_id: patient.id,
      patient_name: patient.name,
      day,
      message: messageText,
      whatsapp_url: whatsappWebUrl,
      checkin_url: checkinUrl,
      provider,
      delivery_status: deliveryStatus,
      is_simulation: isSimulation,
      twilio_sid: twilioResult?.sid || null,
    });
  } catch (err) {
    console.error("WhatsApp trigger error:", err);
    res.status(500).json({ error: err.message });
  }
};

router.post("/whatsapp-trigger", whatsappTriggerHandler);
router.post("/trigger-whatsapp", whatsappTriggerHandler);

/**
 * POST /api/sms/whatsapp-summary
 * Dispatches 10-day / milestone clinical recovery report to patient or doctor WhatsApp.
 */
router.post("/whatsapp-summary", async (req, res) => {
  try {
    const { patient_id, summary_text, milestone_day } = req.body;
    if (!patient_id) {
      return res.status(400).json({ error: "patient_id is required" });
    }

    const patient = await get("SELECT * FROM patients WHERE id = ?", [patient_id]);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    const checkins = await all(
      `SELECT * FROM checkins WHERE patient_id = ? AND status = 'completed' ORDER BY day ASC`,
      [patient.id]
    );

    const latest = checkins.length ? checkins[checkins.length - 1] : null;
    const baseline = checkins.length ? checkins[0] : null;
    const targetDay = milestone_day || latest?.day || 10;

    let messageText = summary_text;
    if (!messageText) {
      const deltaStr = baseline && latest
        ? `${baseline.pain}/10 → ${latest.pain}/10 (${latest.pain - baseline.pain > 0 ? "+" : ""}${latest.pain - baseline.pain} pts)`
        : "Initial phase";

      messageText = `🏥 *CareTraceAI Recovery Evaluation Report*
Patient: *${patient.name}*
Procedure: ${patient.procedure || "Surgery"}
Period: *Day 1 to Day ${targetDay} Post-Op*

📊 *Longitudinal Recovery Trajectory:*
• Pain Progression: ${deltaStr}
• Mobility: ${latest?.mobility || "Stable"}
• Swelling: ${latest?.swelling || "None"}
• Fever: ${latest?.fever ? "Reported ⚠️" : "No fever"}
• Overall Trajectory: *${(latest?.trend || "stable").toUpperCase()}*

📋 *Hindsight Clinical Assessment:*
${latest?.hindsight_summary || "Patient has completed initial post-operative monitoring with clinical oversight."}

Hospital Care Team: CareTraceAI Recovery Monitoring System`;
    }

    let cleanPhone = String(patient.phone || "").replace(/\s|-/g, "");
    if (!cleanPhone.startsWith("+")) {
      cleanPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    }
    const waPhone = cleanPhone.replace("+", "");
    const whatsappWebUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(messageText)}`;

    const client = getTwilioClient();
    let twilioResult = null;
    let provider = "simulation";
    let deliveryStatus = "simulated";
    let isSimulation = true;

    if (client && process.env.TWILIO_FROM_NUMBER) {
      try {
        provider = "twilio";
        const fromNumber = process.env.TWILIO_FROM_NUMBER.startsWith("whatsapp:")
          ? process.env.TWILIO_FROM_NUMBER
          : `whatsapp:${process.env.TWILIO_FROM_NUMBER}`;
        const toNumber = `whatsapp:+${waPhone}`;

        twilioResult = await client.messages.create({
          body: messageText,
          from: fromNumber,
          to: toNumber,
        });
        isSimulation = false;
        deliveryStatus = twilioResult.status || "delivered";
      } catch (twErr) {
        console.warn(`⚠️ Twilio live summary failed: ${twErr.message}`);
      }
    }

    await run(
      `INSERT INTO sms_log (patient_id, phone, message, message_type, provider, status, delivery_status, sent_time, day_number)
       VALUES (?, ?, ?, 'milestone_summary', ?, 'sent', ?, datetime('now'), ?)`,
      [patient.id, patient.phone, messageText, provider, deliveryStatus, targetDay]
    );

    res.json({
      success: true,
      patient_id: patient.id,
      patient_name: patient.name,
      day: targetDay,
      message: messageText,
      whatsapp_url: whatsappWebUrl,
      provider,
      delivery_status: deliveryStatus,
      is_simulation: isSimulation,
    });
  } catch (err) {
    console.error("WhatsApp summary error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sms/test — send a test SMS/WhatsApp
router.post("/test", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone number required" });

  const client = getTwilioClient();
  if (!client) return res.status(503).json({ error: "Twilio not configured (Running in simulation mode)" });

  try {
    await client.messages.create({
      body: "✅ CareTraceAI test message — integration active!",
      from: process.env.TWILIO_FROM_NUMBER,
      to: phone.startsWith("+") ? phone : `+91${phone}`,
    });
    res.json({ success: true, message: "Test SMS sent successfully" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/sms/trigger — manually trigger cron check-ins
router.post("/trigger", async (_req, res) => {
  try {
    await runCheckins();
    res.json({ success: true, message: "Automated daily check-in cron execution triggered" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/sms/log — fetch notification history
router.get("/log", async (_req, res) => {
  try {
    const rows = await all(
      `SELECT s.*, p.name as patient_name
       FROM sms_log s
       LEFT JOIN patients p ON s.patient_id = p.id
       ORDER BY s.id DESC LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sms/log/:patientId — notification history for one patient
router.get("/log/:patientId", async (req, res) => {
  try {
    const rows = await all(
      "SELECT * FROM sms_log WHERE patient_id = ? ORDER BY id DESC",
      [req.params.patientId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;