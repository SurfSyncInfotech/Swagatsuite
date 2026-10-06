const pool = require("../db/pool");

async function getAllPlans() {
  const [rows] = await pool.query(
    `
    SELECT id, name, price, currency, features_json, is_active, created_at
    FROM plans
    ORDER BY id DESC
    `
  );
  return rows.map((row) => ({
    ...row,
    features: row.features_json ? JSON.parse(row.features_json) : []
  }));
}

async function createPlan({ name, price, currency, features }) {
  const [result] = await pool.query(
    `
    INSERT INTO plans (name, price, currency, features_json, is_active)
    VALUES (?, ?, ?, ?, 1)
    `,
    [name, price, currency, JSON.stringify(features || [])]
  );
  return result.insertId;
}

async function updatePlan(planId, { name, price, currency, features, isActive }) {
  await pool.query(
    `
    UPDATE plans
    SET name = ?, price = ?, currency = ?, features_json = ?, is_active = ?
    WHERE id = ?
    `,
    [name, price, currency, JSON.stringify(features || []), isActive ? 1 : 0, planId]
  );
}

async function assignPlanToRestaurant({ restaurantId, planName, startDate, endDate }) {
  await pool.query(
    `
    UPDATE restaurants
    SET plan = ?, subscription_start_date = ?, subscription_end_date = ?
    WHERE id = ?
    `,
    [planName, startDate || null, endDate || null, restaurantId]
  );
}

module.exports = {
  getAllPlans,
  createPlan,
  updatePlan,
  assignPlanToRestaurant
};
