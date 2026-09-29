const db = require("./database");
db.serialize(() => {
  db.run("DELETE FROM patients");
  db.run("DELETE FROM checkins");
  db.run("DELETE FROM reviews");
  const d = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const s = db.prepare("INSERT INTO patients (name, phone, procedure, surgery_date) VALUES (?,?,?,?)");
  s.run("Ravi Kumar", "+910000000001", "Knee replacement", d(5));
  s.run("Anjali Rao", "+910000000002", "Appendectomy", d(3));
  s.finalize(() => { console.log("Seeded 2 synthetic patients."); db.close(); });
});