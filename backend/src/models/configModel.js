const pool = require("../db/pool");

async function upsertConfigValue(key, value) {
  await pool.query(
    `
    INSERT INTO app_config (config_key, config_value)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)
    `,
    [key, value]
  );
}

async function getConfigValue(key) {
  const [rows] = await pool.query(
    "SELECT config_value FROM app_config WHERE config_key = ? LIMIT 1",
    [key]
  );
  return rows[0]?.config_value || null;
}

module.exports = {
  upsertConfigValue,
  getConfigValue
};
