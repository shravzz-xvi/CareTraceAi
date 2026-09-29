const ORDER = ["Low", "High", "Critical"];

const CRITICAL_RED_FLAGS = [
  "chest pain",
  "shortness of breath",
  "breathless",
  "heavy bleeding",
  "bleeding profusely",
  "fainted",
  "unconscious",
  "pus",
  "purulent discharge",
  "wound opened",
  "dehiscence"
];

const HIGH_WARNING_SIGNS = [
  "foul odor",
  "foul smelling",
  "vomiting",
  "persistent nausea",
  "spreading redness",
  "calf pain",
  "leg swelling",
  "calf swelling",
  "cannot bear weight",
  "chills"
];

const SYSTEM_PROMPT = `You are a clinical decision support intelligence engine for post-surgery recovery monitoring (CareTraceAI).
You do NOT diagnose or prescribe treatment.
Compare today's recovery check-in with this patient's own longitudinal history and baseline.
Assess the recovery trajectory based on objective clinical indicators:
- Pain level (0-10) and change (delta) from previous check-in
- Mobility changes
- Swelling progression
- Fever presence or new emergence
- Reported complications or red flag symptoms

Return ONLY valid JSON with keys:
{
  "risk_level": "Low" | "High" | "Critical",
  "explanation": "1-2 sentences citing specific previous-vs-current indicator changes and clinical reasoning.",
  "trend": "improving" | "stable" | "worsening"
}`;

/**
 * Deterministic clinical risk evaluation.
 * Configured clinical decision support logic that guarantees patient safety.
 */
function evaluateClinicalRisk({
  patient,
  day,
  pain = 0,
  mobility = "",
  swelling = "",
  fever = 0,
  symptoms = "",
  message = "",
  hindsight = {},
  previous = null
}) {
  const currentPain = Number(pain) || 0;
  const isFever = Number(fever) === 1;
  const mob = String(mobility || "").toLowerCase();
  const swl = String(swelling || "").toLowerCase();
  const textContent = `${message} ${symptoms}`.toLowerCase();
  const painDelta = hindsight.pain_delta !== undefined && hindsight.pain_delta !== null
    ? hindsight.pain_delta
    : previous ? currentPain - (previous.pain || 0) : 0;
  const trend = hindsight.trend || "stable";

  const hasCriticalRedFlag = CRITICAL_RED_FLAGS.some((flag) => textContent.includes(flag));
  const hasHighWarning = HIGH_WARNING_SIGNS.some((sign) => textContent.includes(sign));

  let level = "Low";
  const clinicalReasons = [];

  // Critical checks
  if (hasCriticalRedFlag) {
    level = "Critical";
    const matched = CRITICAL_RED_FLAGS.filter((flag) => textContent.includes(flag));
    clinicalReasons.push(`Reported red flag symptom: "${matched.join(', ')}"`);
  } else if (isFever && (currentPain >= 7 || swl === "severe" || mob === "worse" || mob === "poor")) {
    level = "Critical";
    clinicalReasons.push(
      `Fever combined with ${currentPain >= 7 ? `high pain (${currentPain}/10)` : ""}${swl === "severe" ? " severe swelling" : ""}${mob === "worse" || mob === "poor" ? " deteriorating mobility" : ""}`.trim()
    );
  } else if (currentPain >= 9) {
    level = "Critical";
    clinicalReasons.push(`Intractable severe pain (${currentPain}/10)`);
  } else if (painDelta >= 4) {
    level = "Critical";
    clinicalReasons.push(`Acute pain spike of +${painDelta} points (from ${previous?.pain || 0} to ${currentPain})`);
  } else if (currentPain >= 8 && swl === "severe") {
    level = "Critical";
    clinicalReasons.push(`Severe pain (${currentPain}/10) with severe swelling`);
  }

  // High checks (if not already Critical)
  if (level !== "Critical") {
    if (hasHighWarning) {
      level = "High";
      const matched = HIGH_WARNING_SIGNS.filter((sign) => textContent.includes(sign));
      clinicalReasons.push(`Reported clinical warning: "${matched.join(', ')}"`);
    } else if (isFever) {
      level = "High";
      clinicalReasons.push("Fever reported");
    } else if (currentPain >= 7) {
      level = "High";
      clinicalReasons.push(`High pain score (${currentPain}/10)`);
    } else if (swl === "severe") {
      level = "High";
      clinicalReasons.push("Severe swelling reported");
    } else if (painDelta >= 2 && trend === "worsening") {
      level = "High";
      clinicalReasons.push(`Pain increased by +${painDelta} points with worsening trend`);
    } else if ((mob === "worse" || mob === "poor") && currentPain >= 5) {
      level = "High";
      clinicalReasons.push(`Impaired mobility accompanied by moderate pain (${currentPain}/10)`);
    } else if (trend === "worsening") {
      level = "High";
      clinicalReasons.push("Multiple recovery indicators deteriorated compared to prior baseline");
    }
  }

  // Generate clear explanation
  let explanation = "";
  if (level === "Critical") {
    explanation = `Urgent clinical attention required: ${clinicalReasons.join("; ")}. Recovery status indicates potential post-operative complication.`;
  } else if (level === "High") {
    explanation = `Elevated recovery risk: ${clinicalReasons.join("; ")}. Clinical monitoring and staff follow-up recommended.`;
  } else {
    if (trend === "improving") {
      explanation = `Recovery progressing normally. Patient demonstrates positive trajectory with ${painDelta < 0 ? `pain decreasing (${Math.abs(painDelta)} pt drop)` : "improving recovery signs"}.`;
    } else {
      explanation = `Recovery indicators stable. Pain (${currentPain}/10) and physical signs are within expected post-surgical baseline for Day ${day}.`;
    }
  }

  return {
    risk_level: level,
    explanation,
    trend
  };
}

/**
 * Main assess function.
 * Evaluates clinical rules and enriches with LLM if available,
 * strictly enforcing clinical safety floors.
 */
async function assess({
  patient,
  day,
  message = "",
  pain = 0,
  mobility = "",
  swelling = "",
  fever = 0,
  symptoms = "",
  history = [],
  recentHistory = [],
  previous = null,
  hindsight = {}
}) {
  const clinicalEvaluation = evaluateClinicalRisk({
    patient,
    day,
    pain,
    mobility,
    swelling,
    fever,
    symptoms,
    message,
    hindsight,
    previous
  });

  const floorRisk = clinicalEvaluation.risk_level;
  let finalResult = { ...clinicalEvaluation };

  // If GROQ API key is configured, optionally enrich the explanation
  if (process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes("your_")) {
    try {
      const historyContext = history.length
        ? history.map((h) => `- ${h}`).join("\n")
        : recentHistory.length
        ? recentHistory.map((r) => `- Day ${r.day}: pain ${r.pain}/10, swelling ${r.swelling || "n/a"}, fever ${r.fever ? "yes" : "no"}, trend ${r.trend}`).join("\n")
        : "(No prior check-in history)";

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.LLM_MODEL || "llama-3.3-70b-versatile",
          temperature: 0.1,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content:
                `Patient: ${patient.name}, Procedure: ${patient.procedure || patient.procedure_name || "Post-op"}, Recovery Day ${day}.\n` +
                `Prior longitudinal history:\n${historyContext}\n\n` +
                `Today's check-in:\n` +
                `- Pain: ${pain}/10 (delta: ${hindsight.pain_delta ?? "baseline"})\n` +
                `- Mobility: ${mobility || "not stated"}\n` +
                `- Swelling: ${swelling || "not stated"}\n` +
                `- Fever: ${fever ? "Yes" : "No"}\n` +
                `- Symptoms/Update: "${message} ${symptoms}".\n` +
                `Configured clinical rules determined risk: ${floorRisk}, trend: ${clinicalEvaluation.trend}.`
            }
          ]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data.choices?.[0]?.message?.content || "";
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.risk_level && ORDER.includes(parsed.risk_level)) {
            // Never allow LLM to downgrade below deterministic clinical safety floor
            const parsedIdx = ORDER.indexOf(parsed.risk_level);
            const floorIdx = ORDER.indexOf(floorRisk);
            const enforcedLevel = parsedIdx >= floorIdx ? parsed.risk_level : floorRisk;

            finalResult = {
              risk_level: enforcedLevel,
              explanation: parsed.explanation || clinicalEvaluation.explanation,
              trend: parsed.trend || clinicalEvaluation.trend
            };
          }
        }
      }
    } catch (err) {
      console.log("LLM assessment enrichment skipped (using clinical rule engine):", err.message);
    }
  }

  // Ensure risk level cannot be lower than floor
  if (ORDER.indexOf(finalResult.risk_level) < ORDER.indexOf(floorRisk)) {
    finalResult.risk_level = floorRisk;
  }

  return finalResult;
}

module.exports = { assess, evaluateClinicalRisk };