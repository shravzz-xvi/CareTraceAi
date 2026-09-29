const cron = require("node-cron");
const twilio = require("twilio");
const db = require("./database");
const { getTemplateForProcedure, formatWhatsAppMessage } = require("./services/questions");
const { generateRecoveryReport } = require("./services/reportEngine");

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

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || sid.includes("xxx") || sid.length < 10) return null;
  return twilio(sid, token);
}

function calculateDay(startDateStr) {
  if (!startDateStr) return 1;
  const start = new Date(startDateStr);
  if (Number.isNaN(start.getTime())) return 1;
  const now = new Date();
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diff = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return Math.max(0, diff);
}

/**
 * Daily Automated WhatsApp Check-in Triggers
 * Runs at 9:00 AM every morning.
 * Safe against duplicate triggers (idempotent).
 */
async function runCheckins() {
  console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Executing CareTraceAI Daily WhatsApp Monitoring Trigger...`);

  try {
    const patients = await all(
      `SELECT * FROM patients WHERE monitoring_status = 'active'`
    );

    const clientBase = process.env.CLIENT_URL || "http://localhost:3000";
    const twilioClient = getTwilioClient();

    for (const patient of patients) {
      // Base date: discharge_date or surgery_date
      const baseDate = patient.discharge_date || patient.surgery_date;
      const daysSince = calculateDay(baseDate);

      // Do NOT send on Day 0 (day of discharge/surgery)
      if (daysSince < 1) {
        console.log(`⏳ Patient ${patient.name} discharged today (Day 0). Monitoring starts tomorrow at 9:00 AM.`);
        continue;
      }

      const monitoringDays = patient.monitoring_days || 10;

      // Check if monitoring period is completed
      if (daysSince > monitoringDays) {
        console.log(`🏁 Patient ${patient.name} completed ${monitoringDays}-day monitoring plan.`);
        await run(`UPDATE patients SET monitoring_status = 'completed' WHERE id = ?`, [patient.id]);
        try {
          await generateRecoveryReport(patient.id, { monitoring_days: monitoringDays });
        } catch (e) {
          console.warn("Auto-report generation note:", e.message);
        }
        continue;
      }

      // Idempotency check: check if Day X trigger was already sent today
      const alreadySent = await get(
        `SELECT id FROM sms_log WHERE patient_id = ? AND day_number = ? AND message_type = 'checkin_trigger'`,
        [patient.id, daysSince]
      );

      if (alreadySent) {
        console.log(`ℹ️ Day ${daysSince} WhatsApp check-in already sent to ${patient.name} (ID: ${patient.id}). Skipping duplicate.`);
        continue;
      }

      // Retrieve treatment-specific question template
      const template = await getTemplateForProcedure(patient.procedure);
      const checkinUrl = `${clientBase}/checkin/${patient.id}`;
      const messageText = formatWhatsAppMessage(patient, daysSince, template, checkinUrl);

      let cleanPhone = String(patient.phone || "").replace(/\s|-/g, "");
      if (!cleanPhone.startsWith("+")) {
        cleanPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      }
      const waPhone = cleanPhone.replace("+", "");

      let sendStatus = "sent";
      let deliveryStatus = "simulated";
      let provider = "simulation";

      if (twilioClient && process.env.TWILIO_FROM_NUMBER) {
        try {
          provider = "twilio";
          const fromNumber = process.env.TWILIO_FROM_NUMBER.startsWith("whatsapp:")
            ? process.env.TWILIO_FROM_NUMBER
            : `whatsapp:${process.env.TWILIO_FROM_NUMBER}`;
          const toNumber = `whatsapp:+${waPhone}`;

          const twRes = await twilioClient.messages.create({
            body: messageText,
            from: fromNumber,
            to: toNumber,
          });
          deliveryStatus = twRes.status || "delivered";
          console.log(`✅ Live WhatsApp sent to ${patient.name} (${toNumber}) via Twilio (SID: ${twRes.sid})`);
        } catch (twErr) {
          console.warn(`⚠️ Twilio live dispatch failed for ${patient.name}: ${twErr.message}. Falling back to simulation mode.`);
          deliveryStatus = "simulated";
          provider = "simulation";
        }
      } else {
        deliveryStatus = "simulated";
        provider = "simulation";
        console.log(`📱 [Simulated WhatsApp Trigger] Day ${daysSince} check-in sent to ${patient.name} (${waPhone}): "${messageText.slice(0, 60)}..."`);
      }

      // Record in sms_log table
      await run(
        `INSERT INTO sms_log (patient_id, phone, message, message_type, provider, status, delivery_status, scheduled_time, sent_time, day_number)
         VALUES (?, ?, ?, 'checkin_trigger', ?, ?, ?, datetime('now'), datetime('now'), ?)`,
        [patient.id, patient.phone, messageText, provider, sendStatus, deliveryStatus, daysSince]
      );
    }

    // Run missed check-in detection
    await detectMissedCheckins();
  } catch (err) {
    console.error("Scheduled check-in runner error:", err);
  }
}

/**
 * Detect missed check-ins
 * If a patient had a check-in trigger sent yesterday and no completed checkin exists for that day,
 * mark as missed on staff dashboard.
 */
async function detectMissedCheckins() {
  try {
    const yesterdayLogs = await all(
      `SELECT s.patient_id, s.day_number, s.sent_at, p.name
       FROM sms_log s
       JOIN patients p ON s.patient_id = p.id
       WHERE s.message_type = 'checkin_trigger'
         AND p.monitoring_status = 'active'
         AND datetime(s.sent_at) <= datetime('now', '-20 hours')
         AND s.day_number NOT IN (
           SELECT day FROM checkins WHERE patient_id = s.patient_id AND status = 'completed'
         )`
    );

    for (const miss of yesterdayLogs) {
      const exists = await get(
        `SELECT id FROM checkins WHERE patient_id = ? AND day = ? AND status = 'missed'`,
        [miss.patient_id, miss.day_number]
      );

      if (!exists) {
        await run(
          `INSERT INTO checkins (patient_id, day, message, status, missed, trend, risk_level, explanation, created_at)
           VALUES (?, ?, 'Missed check-in: No patient response within 24 hours of WhatsApp trigger.', 'missed', 1, 'stable', 'Low', 'Patient did not submit daily response. Monitoring team alerted.', datetime('now'))`,
          [miss.patient_id, miss.day_number]
        );
        console.log(`⚠️ Recorded missed check-in for ${miss.name} (Day ${miss.day_number}).`);
      }
    }
  } catch (e) {
    console.warn("Missed check-in detector note:", e.message);
  }
}

// Daily scheduled cron at 9:00 AM
try {
  cron.schedule("0 9 * * *", () => {
    runCheckins();
  });
  console.log("✅ Cron scheduler initialized — triggers daily WhatsApp check-ins at 9:00 AM");
} catch (e) {
  console.log("Cron schedule warning:", e.message);
}

module.exports = {
  runCheckins,
  detectMissedCheckins
};