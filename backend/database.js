const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "./aura.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("Database connection error:", err.message);
  else console.log("Connected to SQLite database at:", dbPath);
});

db.serialize(() => {
  // 1. Patients table
  db.run(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      procedure TEXT,
      surgery_date TEXT,
      discharge_date TEXT,
      expected_recovery_days INTEGER DEFAULT 14,
      monitoring_days INTEGER DEFAULT 10,
      monitoring_status TEXT DEFAULT 'active',
      clinical_notes TEXT,
      recovery_parameters TEXT,
      risk_level TEXT DEFAULT 'Low',
      last_checkin TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Checkins table
  db.run(`
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      day INTEGER,
      message TEXT,
      pain INTEGER,
      mobility TEXT,
      swelling TEXT,
      fever INTEGER DEFAULT 0,
      symptoms TEXT,
      treatment_answers_json TEXT,
      risk_level TEXT DEFAULT 'Low',
      explanation TEXT,
      trend TEXT DEFAULT 'stable',
      hindsight_summary TEXT,
      pain_delta INTEGER,
      status TEXT DEFAULT 'completed',
      missed INTEGER DEFAULT 0,
      scheduled_for TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. Reviews table
  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkin_id INTEGER,
      patient_id INTEGER,
      alert_id INTEGER,
      clinician_name TEXT DEFAULT 'Dr. Staff',
      outcome TEXT,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Alerts table
  db.run(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      checkin_id INTEGER,
      severity TEXT DEFAULT 'high',
      title TEXT,
      message TEXT,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 5. SMS / WhatsApp Messages log table
  db.run(`
    CREATE TABLE IF NOT EXISTS sms_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      phone TEXT,
      message TEXT,
      message_type TEXT DEFAULT 'checkin_trigger',
      provider TEXT DEFAULT 'simulation',
      status TEXT DEFAULT 'sent',
      delivery_status TEXT DEFAULT 'simulated',
      scheduled_time TEXT,
      sent_time TEXT,
      response_time TEXT,
      day_number INTEGER,
      sent_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 6. Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 7. Question Templates table
  db.run(`
    CREATE TABLE IF NOT EXISTS question_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      procedure_key TEXT UNIQUE,
      category TEXT,
      title TEXT,
      description TEXT,
      questions_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 8. Hindsight Memories table (Persistent local audit memory layer)
  db.run(`
    CREATE TABLE IF NOT EXISTS hindsight_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      day_number INTEGER,
      event_type TEXT,
      memory_text TEXT,
      context_json TEXT,
      recalled_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 9. Periodic Recovery Reports table (10-day & milestone summaries)
  db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      milestone_day INTEGER DEFAULT 10,
      report_type TEXT DEFAULT '10_day_recovery_report',
      completion_rate REAL,
      start_pain INTEGER,
      end_pain INTEGER,
      avg_pain REAL,
      pain_trend TEXT,
      mobility_trend TEXT,
      final_trend TEXT,
      summary_json TEXT,
      executive_summary TEXT,
      hindsight_analysis TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // -------------------------------------------------------------
  // Safe Pragmatic Schema Migrations for Existing aura.db Tables
  // -------------------------------------------------------------

  // Helper to add missing columns safely
  function ensureColumns(table, columns) {
    db.all(`PRAGMA table_info(${table})`, [], (err, existing) => {
      if (err || !existing) return;
      const names = new Set(existing.map((c) => c.name));
      columns.forEach(({ name, type }) => {
        if (!names.has(name)) {
          db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`, (alterErr) => {
            if (!alterErr) {
              console.log(`✅ Added column '${name}' to table '${table}'.`);
            }
          });
        }
      });
    });
  }

  // Patients migrations
  ensureColumns("patients", [
    { name: "discharge_date", type: "TEXT" },
    { name: "expected_recovery_days", type: "INTEGER DEFAULT 14" },
    { name: "monitoring_days", type: "INTEGER DEFAULT 10" },
    { name: "monitoring_status", type: "TEXT DEFAULT 'active'" },
    { name: "clinical_notes", type: "TEXT" },
    { name: "recovery_parameters", type: "TEXT" },
    { name: "created_at", type: "TEXT" },
  ]);

  // Checkins migrations
  ensureColumns("checkins", [
    { name: "mobility", type: "TEXT" },
    { name: "swelling", type: "TEXT" },
    { name: "fever", type: "INTEGER DEFAULT 0" },
    { name: "symptoms", type: "TEXT" },
    { name: "treatment_answers_json", type: "TEXT" },
    { name: "trend", type: "TEXT DEFAULT 'stable'" },
    { name: "hindsight_summary", type: "TEXT" },
    { name: "pain_delta", type: "INTEGER" },
    { name: "status", type: "TEXT DEFAULT 'completed'" },
    { name: "missed", type: "INTEGER DEFAULT 0" },
    { name: "scheduled_for", type: "TEXT" },
    { name: "completed_at", type: "TEXT" },
  ]);

  // SMS / WhatsApp log migrations
  ensureColumns("sms_log", [
    { name: "message_type", type: "TEXT DEFAULT 'checkin_trigger'" },
    { name: "provider", type: "TEXT DEFAULT 'simulation'" },
    { name: "delivery_status", type: "TEXT DEFAULT 'simulated'" },
    { name: "scheduled_time", type: "TEXT" },
    { name: "sent_time", type: "TEXT" },
    { name: "response_time", type: "TEXT" },
  ]);

  // Reviews migrations
  ensureColumns("reviews", [
    { name: "alert_id", type: "INTEGER" },
    { name: "clinician_name", type: "TEXT DEFAULT 'Dr. Staff'" },
  ]);

  // Seed default clinical question templates if table is empty
  db.get("SELECT COUNT(*) as count FROM question_templates", [], (err, row) => {
    if (!err && row && row.count === 0) {
      console.log("🌱 Seeding treatment-specific recovery question templates...");

      const templates = [
        {
          procedure_key: "knee_replacement",
          category: "orthopedic",
          title: "Knee Replacement & Lower Limb Protocol",
          description: "Tracks joint flexion, weight bearing, calf tenderness, incision effusion, and walking mobility.",
          questions: [
            { id: "pain", text: "How would you rate your knee pain today (0–10)?", type: "scale_0_10", category: "pain" },
            { id: "mobility", text: "How is your walking and knee movement compared with yesterday?", type: "choice", options: ["Better", "Same", "Worse"], category: "mobility" },
            { id: "weight_bearing", text: "Can you bear weight or walk with recommended support?", type: "choice", options: ["Yes, comfortably", "Yes, with difficulty", "Unable to bear weight"], category: "treatment_specific" },
            { id: "swelling", text: "Is there swelling or tightness around the knee or calf?", type: "choice", options: ["None", "Mild", "Moderate", "Severe"], category: "swelling" },
            { id: "fever", text: "Do you have any fever, shivering, or feeling abnormally hot?", type: "boolean", options: ["No", "Yes"], category: "fever" },
            { id: "symptoms", text: "Any warmth around wound, discharge, or calf pain?", type: "text", category: "symptoms" }
          ]
        },
        {
          procedure_key: "hip_replacement",
          category: "orthopedic",
          title: "Total Hip Arthroplasty Protocol",
          description: "Focuses on gait stability, groin pain, limb comfort, and incision healing.",
          questions: [
            { id: "pain", text: "How would you rate your hip or groin pain today (0–10)?", type: "scale_0_10", category: "pain" },
            { id: "mobility", text: "Is transferring (sitting to standing) and walking easier, same, or harder?", type: "choice", options: ["Better", "Same", "Worse"], category: "mobility" },
            { id: "exercise", text: "Were you able to do your gentle prescribed hip exercises?", type: "choice", options: ["Yes, completed", "Partial", "Too painful / Unable"], category: "treatment_specific" },
            { id: "swelling", text: "Any swelling around the hip or down the leg?", type: "choice", options: ["None", "Mild", "Moderate", "Severe"], category: "swelling" },
            { id: "fever", text: "Any fever or chills?", type: "boolean", options: ["No", "Yes"], category: "fever" },
            { id: "symptoms", text: "Any numbness, wound drainage, or clicking sensation?", type: "text", category: "symptoms" }
          ]
        },
        {
          procedure_key: "abdominal",
          category: "general_surgery",
          title: "Abdominal & Laparoscopic Surgery Protocol",
          description: "Applicable to Appendectomy, Gallbladder removal, Hernia repair, and C-Section.",
          questions: [
            { id: "pain", text: "What is your surgical site or abdominal pain level (0–10)?", type: "scale_0_10", category: "pain" },
            { id: "mobility", text: "Are you able to walk around and stand up upright?", type: "choice", options: ["Better", "Same", "Worse"], category: "mobility" },
            { id: "nausea_bloat", text: "Any nausea, vomiting, or severe abdominal bloating?", type: "choice", options: ["None", "Mild nausea", "Vomiting / Severe bloating"], category: "treatment_specific" },
            { id: "wound_drainage", text: "Is the surgical incision clean and dry, or is there redness/drainage?", type: "choice", options: ["Clean and dry", "Slight redness", "Pus / Active fluid drainage"], category: "wound" },
            { id: "fever", text: "Have you experienced fever or high body temperature?", type: "boolean", options: ["No", "Yes"], category: "fever" },
            { id: "symptoms", text: "Any other symptoms or changes in bowel movements?", type: "text", category: "symptoms" }
          ]
        },
        {
          procedure_key: "cardiac_bypass",
          category: "cardiac",
          title: "Cardiac Bypass & Cardiothoracic Protocol",
          description: "Focuses on sternal healing, shortness of breath, palpitations, and leg vein harvest site.",
          questions: [
            { id: "pain", text: "Chest or incision discomfort level (0–10)?", type: "scale_0_10", category: "pain" },
            { id: "mobility", text: "Ability to take short gentle walks and deep breaths today?", type: "choice", options: ["Better", "Same", "Worse"], category: "mobility" },
            { id: "breathing", text: "Any shortness of breath while resting or lying down?", type: "choice", options: ["Breathing comfortably", "Mild breathless on movement", "Shortness of breath at rest"], category: "treatment_specific" },
            { id: "swelling", text: "Any sudden swelling in your legs, ankles, or incision?", type: "choice", options: ["None", "Mild", "Moderate", "Severe"], category: "swelling" },
            { id: "fever", text: "Any fever or chills?", type: "boolean", options: ["No", "Yes"], category: "fever" },
            { id: "symptoms", text: "Any palpitations, dizziness, or chest tightness?", type: "text", category: "symptoms" }
          ]
        },
        {
          procedure_key: "general",
          category: "general",
          title: "Standard Post-Operative Recovery Protocol",
          description: "Comprehensive recovery tracking for general surgical interventions.",
          questions: [
            { id: "pain", text: "What is your overall pain level right now (0–10)?", type: "scale_0_10", category: "pain" },
            { id: "mobility", text: "How is your mobility and energy compared with yesterday?", type: "choice", options: ["Better", "Same", "Worse"], category: "mobility" },
            { id: "swelling", text: "Is there swelling or puffiness around the surgical area?", type: "choice", options: ["None", "Mild", "Moderate", "Severe"], category: "swelling" },
            { id: "fever", text: "Do you have a fever, chills, or temperature?", type: "boolean", options: ["No", "Yes"], category: "fever" },
            { id: "wound", text: "Is the surgical dressing intact and dry?", type: "choice", options: ["Dry and intact", "Slight bleeding/stain", "Significant drainage"], category: "wound" },
            { id: "symptoms", text: "Any new symptoms, dizziness, or medication side-effects?", type: "text", category: "symptoms" }
          ]
        }
      ];

      templates.forEach((t) => {
        db.run(
          `INSERT INTO question_templates (procedure_key, category, title, description, questions_json)
           VALUES (?, ?, ?, ?, ?)`,
          [t.procedure_key, t.category, t.title, t.description, JSON.stringify(t.questions)]
        );
      });
    }
  });
});

module.exports = db;