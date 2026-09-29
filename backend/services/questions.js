const db = require("../database");

const get = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
  );

const all = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );

// Keyword matcher to procedure template key
function matchProcedureKey(procedureName = "") {
  const p = String(procedureName).toLowerCase();
  if (p.includes("knee") || p.includes("acl") || p.includes("arthroscop") || p.includes("tibia")) {
    return "knee_replacement";
  }
  if (p.includes("hip") || p.includes("pelvis") || p.includes("femur")) {
    return "hip_replacement";
  }
  if (
    p.includes("append") ||
    p.includes("gallbladder") ||
    p.includes("cholecyst") ||
    p.includes("hernia") ||
    p.includes("abdom") ||
    p.includes("c-section") ||
    p.includes("cesarean") ||
    p.includes("laparoscop")
  ) {
    return "abdominal";
  }
  if (
    p.includes("cardiac") ||
    p.includes("bypass") ||
    p.includes("angioplast") ||
    p.includes("heart") ||
    p.includes("coronary") ||
    p.includes("stern") ||
    p.includes("valve")
  ) {
    return "cardiac_bypass";
  }
  return "general";
}

async function getTemplateForProcedure(procedureName) {
  const key = matchProcedureKey(procedureName);
  const row = await get("SELECT * FROM question_templates WHERE procedure_key = ?", [key]);

  if (row) {
    return {
      ...row,
      questions: JSON.parse(row.questions_json || "[]")
    };
  }

  // Fallback template
  const fallbackRow = await get("SELECT * FROM question_templates WHERE procedure_key = 'general'");
  if (fallbackRow) {
    return {
      ...fallbackRow,
      questions: JSON.parse(fallbackRow.questions_json || "[]")
    };
  }

  return {
    procedure_key: "general",
    title: "Post-Operative Recovery Protocol",
    description: "General post-operative monitoring",
    questions: [
      { id: "pain", text: "Pain level (0–10)", type: "scale_0_10", category: "pain" },
      { id: "mobility", text: "Mobility vs yesterday (Better / Same / Worse)", type: "choice", category: "mobility" },
      { id: "swelling", text: "Swelling around surgical area (None / Mild / Moderate / Severe)", type: "choice", category: "swelling" },
      { id: "fever", text: "Any fever or chills (No / Yes)", type: "boolean", category: "fever" },
      { id: "symptoms", text: "Any complications or specific symptoms?", type: "text", category: "symptoms" }
    ]
  };
}

function formatWhatsAppMessage(patient, day, template, checkinUrl) {
  const questions = template.questions || [];
  const questionLines = questions.slice(0, 5).map((q, idx) => `${idx + 1}. ${q.text}`).join("\n");

  return `🏥 *CareTraceAI Post-Surgery Monitoring*
Hi ${patient.name}, this is your recovery care team checking in on *Day ${day}* post ${patient.procedure || patient.procedure_name || "surgery"}.

Protocol: *${template.title}*

Please submit your daily recovery report here:
👉 ${checkinUrl}

*Daily Assessment Questions:*
${questionLines}

Your response is evaluated against your surgical baseline by your clinical team.`;
}

module.exports = {
  matchProcedureKey,
  getTemplateForProcedure,
  formatWhatsAppMessage
};
