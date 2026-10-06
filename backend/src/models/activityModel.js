const pool = require("../db/pool");

async function addActivity(eventType, description) {
  await pool.query(
    "INSERT INTO activities (event_type, description) VALUES (?, ?)",
    [eventType, description]
  );
}

module.exports = {
  addActivity
};
