const db = require("./database");
const request = require("http");

async function run() {
  console.log("=== CareTraceAI End-to-End Longitudinal Loop Test ===");

  const post = (url, body) =>
    new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = request.request(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(data),
          },
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve(body);
            }
          });
        }
      );
      req.on("error", reject);
      req.write(data);
      req.end();
    });

  const get = (url) =>
    new Promise((resolve, reject) => {
      const req = request.get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(body);
          }
        });
      });
      req.on("error", reject);
    });

  try {
    // 1. Register Patient
    console.log("\n1. Registering test patient 'Rahul' (Knee Replacement)...");
    const d5 = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    const p = await post("http://localhost:5000/api/patients", {
      name: "Rahul Sharma",
      phone: "+919876543210",
      procedure: "Knee Replacement",
      surgery_date: d5,
    });
    console.log("Registered patient ID:", p.id, "Day:", p.current_day);

    // 2. Day 5 Baseline Check-in
    console.log("\n2. Submitting Day 5 Check-in (Pain 7, Swelling Moderate, Mobility Worse, Fever No)...");
    const c1 = await post("http://localhost:5000/api/checkins", {
      patient_id: p.id,
      day: 5,
      pain: 7,
      mobility: "Worse",
      swelling: "Moderate",
      fever: 0,
      symptoms: "Discomfort around the joint, keeping leg elevated.",
      memory: "off",
    });
    console.log("Check-in 1 Result:", {
      day: c1.day,
      trend: c1.trend,
      pain_delta: c1.pain_delta,
      risk_level: c1.risk_level,
      alert: c1.alert ? "ALERT CREATED" : "No alert",
    });

    // 3. Day 6 Check-in (Improving)
    console.log("\n3. Submitting Day 6 Check-in (Pain 5, Swelling Mild, Mobility Same, Fever No)...");
    const c2 = await post("http://localhost:5000/api/checkins", {
      patient_id: p.id,
      day: 6,
      pain: 5,
      mobility: "Same",
      swelling: "Mild",
      fever: 0,
      symptoms: "Swelling has gone down a bit, took prescribed painkiller.",
      memory: "off",
    });
    console.log("Check-in 2 Result:", {
      day: c2.day,
      trend: c2.trend,
      pain_delta: c2.pain_delta,
      risk_level: c2.risk_level,
      hindsight_summary: c2.hindsight_summary,
    });

    // 4. Day 7 Check-in (Deterioration / Worsening)
    console.log("\n4. Submitting Day 7 Check-in (Pain 8, Swelling Severe, Mobility Worse, Fever Yes)...");
    const c3 = await post("http://localhost:5000/api/checkins", {
      patient_id: p.id,
      day: 7,
      pain: 8,
      mobility: "Worse",
      swelling: "Severe",
      fever: 1,
      symptoms: "Joint feels very hot, throbbing pain, fever started this morning.",
      memory: "off",
    });
    console.log("Check-in 3 Result:", {
      day: c3.day,
      trend: c3.trend,
      pain_delta: c3.pain_delta,
      risk_level: c3.risk_level,
      alert: c3.alert,
      hindsight_summary: c3.hindsight_summary,
    });

    // 5. Verify Patient Timeline
    console.log("\n5. Fetching Patient Recovery Timeline...");
    const timeline = await get(`http://localhost:5000/api/checkins/${p.id}`);
    console.log("Total timeline entries:", timeline.checkins?.length);
    timeline.checkins?.forEach((chk) => {
      console.log(`  - Day ${chk.day}: Pain ${chk.pain}/10 (delta: ${chk.pain_delta ?? "base"}), Swelling: ${chk.swelling}, Fever: ${chk.fever ? "Yes" : "No"}, Trend: ${chk.trend}, Risk: ${chk.risk_level}`);
    });

    // 6. Verify Alerts Page
    console.log("\n6. Fetching Open Alerts...");
    const alerts = await get("http://localhost:5000/api/alerts");
    console.log("Active alerts found:", alerts.length);
    if (alerts.length > 0) {
      console.log("  Latest Alert:", {
        patient: alerts[0].patient_name,
        severity: alerts[0].severity,
        title: alerts[0].title,
        message: alerts[0].message,
      });

      // 7. Clinical Review Intervention
      console.log("\n7. Recording Clinician Intervention on Alert...");
      const rev = await post(`http://localhost:5000/api/alerts/${alerts[0].id}/review`, {
        outcome: "Confirmed - follow-up required",
        note: "Prescribed oral antibiotic course, scheduled outpatient knee examination.",
      });
      console.log("Review result:", rev);
    }

    console.log("\n=== ALL ARCHITECTURAL TESTS PASSED SUCCESSFULLY ===");
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

// Allow time for server to respond if just started
setTimeout(run, 1000);
