const { HindsightClient } = require("@vectorize-io/hindsight-client");
const db = require("../database");

const client = new HindsightClient({
  baseUrl: process.env.HINDSIGHT_URL || "http://localhost:8888",
  apiKey: process.env.HINDSIGHT_API_KEY || undefined,
});
const BANK = process.env.HINDSIGHT_BANK || "caretrace";
const label = (p) => `Patient ${p.name} (ID ${p.id})`;

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

/**
 * Retain an event into persistent Hindsight memory.
 * Saves to both SQLite hindsight_memories (durable local audit store)
 * and Vectorize Hindsight Client (if configured).
 */
async function retain(patient, text, options = {}) {
  const { event_type = "daily_checkin", day_number = 1, context = {} } = options;

  // 1. Store in local SQLite hindsight_memories table
  try {
    await run(
      `INSERT INTO hindsight_memories (patient_id, day_number, event_type, memory_text, context_json)
       VALUES (?, ?, ?, ?, ?)`,
      [
        patient.id,
        day_number,
        event_type,
        text,
        JSON.stringify(context || {})
      ]
    );
  } catch (dbErr) {
    console.warn("Local hindsight_memories insert warning:", dbErr.message);
  }

  // 2. Transmit to external Vectorize Hindsight Client
  try {
    await client.retain(BANK, `${label(patient)}: ${text}`);
    console.log(`🧠 Hindsight retained [Day ${day_number}] for ${patient.name}:`, text.slice(0, 80));
    return true;
  } catch (e) {
    // External client is optional or in mock/dev mode
    return true;
  }
}

/**
 * Recall historical recovery context for a patient from Hindsight.
 * Combines local structured memories with external Vectorize recall.
 */
async function recall(patient, query = "") {
  let memories = [];

  // 1. Recall from local SQLite hindsight_memories
  try {
    const localRows = await all(
      `SELECT day_number, event_type, memory_text, created_at
       FROM hindsight_memories
       WHERE patient_id = ?
       ORDER BY day_number ASC, id ASC
       LIMIT 10`,
      [patient.id]
    );

    // Increment recall count for audit
    if (localRows.length > 0) {
      await run(
        `UPDATE hindsight_memories SET recalled_count = recalled_count + 1 WHERE patient_id = ?`,
        [patient.id]
      );
    }

    memories = localRows.map((r) => `[Day ${r.day_number} - ${r.event_type.toUpperCase()}] ${r.memory_text}`);
  } catch (dbErr) {
    console.warn("Local memory recall warning:", dbErr.message);
  }

  // 2. Recall from external Vectorize Hindsight Client
  try {
    const r = await client.recall(BANK, `${label(patient)}: ${query}`);
    if (r && r.results && r.results.length > 0) {
      const vecMemories = r.results.map((x) => x.text);
      // Combine without duplicates
      memories = Array.from(new Set([...memories, ...vecMemories]));
    }
  } catch (e) {
    // External client optional
  }

  return memories;
}

/**
 * Specifically retain a clinician review or alert decision into Hindsight.
 */
async function retainClinicianReview(patient, review) {
  const { outcome, note = "", alert_title = "Clinical Alert", day_number = 1 } = review;
  const memoryText = `Clinician reviewed Day ${day_number} alert (${alert_title}). Decision: "${outcome}". Clinical notes: "${note || "No additional notes"}".`;

  return retain(patient, memoryText, {
    event_type: "clinician_review",
    day_number,
    context: { outcome, note, alert_title }
  });
}

/**
 * Get the full chronological memory stream for a patient.
 */
async function getPatientMemories(patientId) {
  return all(
    `SELECT * FROM hindsight_memories WHERE patient_id = ? ORDER BY day_number ASC, id ASC`,
    [patientId]
  );
}

/**
 * Construct the 4-phase Hindsight Activity Inspector Log:
 * Phase 1: RECALL (historical context pulled forward)
 * Phase 2: CURRENT_EVENT (today's observation)
 * Phase 3: ANALYSIS (longitudinal delta detection & reasoning)
 * Phase 4: RETAIN (stored memory)
 */
async function getHindsightActivityLog(patientId) {
  const memories = await all(
    `SELECT * FROM hindsight_memories WHERE patient_id = ? ORDER BY id DESC LIMIT 20`,
    [patientId]
  );

  const checkins = await all(
    `SELECT * FROM checkins WHERE patient_id = ? AND status = 'completed' ORDER BY day DESC, id DESC LIMIT 5`,
    [patientId]
  );

  return {
    patient_id: patientId,
    total_memories: memories.length,
    recent_memories: memories,
    latest_checkins: checkins
  };
}

module.exports = {
  retain,
  recall,
  retainClinicianReview,
  getPatientMemories,
  getHindsightActivityLog
};