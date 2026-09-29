const db = require("./database");
db.run("ALTER TABLE checkins ADD COLUMN status TEXT DEFAULT 'completed'", (e) => {
  console.log(e ? e.message : "column added");
  process.exit(0);
});