const crypto = require("crypto");
const pool = require("../db/pool");

async function getRestaurantByCode(restaurantCode) {
  const [rows] = await pool.query(
    "SELECT id FROM restaurants WHERE restaurant_code = ? LIMIT 1",
    [restaurantCode]
  );
  return rows[0] || null;
}

async function listTables(restaurantId) {
  const [rows] = await pool.query(
    `
    SELECT id, table_name, qr_token, active, created_at
    FROM restaurant_tables
    WHERE restaurant_id = ?
    ORDER BY id ASC
    `,
    [restaurantId]
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.table_name,
    qrToken: row.qr_token,
    active: Boolean(row.active),
    createdAt: row.created_at
  }));
}

async function createTable(restaurantId, name) {
  const qrToken = crypto.randomUUID();
  const [result] = await pool.query(
    `
    INSERT INTO restaurant_tables (restaurant_id, table_name, qr_token, active)
    VALUES (?, ?, ?, 1)
    `,
    [restaurantId, name, qrToken]
  );
  return { id: result.insertId, name, qrToken, active: true };
}

async function bulkCreateTables(restaurantId, count) {
  const [rows] = await pool.query(
    "SELECT table_name FROM restaurant_tables WHERE restaurant_id = ?",
    [restaurantId]
  );
  const existing = new Set(rows.map((row) => String(row.table_name).toLowerCase()));
  const payload = [];
  let number = 1;
  while (payload.length < count) {
    const candidate = `Table ${number}`;
    if (!existing.has(candidate.toLowerCase())) {
      payload.push([restaurantId, candidate, crypto.randomUUID(), 1]);
      existing.add(candidate.toLowerCase());
    }
    number += 1;
  }
  if (payload.length) {
    await pool.query(
      `
      INSERT INTO restaurant_tables (restaurant_id, table_name, qr_token, active)
      VALUES ?
      `,
      [payload]
    );
  }
}

async function renameTable(restaurantId, tableId, name) {
  const [result] = await pool.query(
    "UPDATE restaurant_tables SET table_name = ? WHERE id = ? AND restaurant_id = ?",
    [name, tableId, restaurantId]
  );
  return result.affectedRows;
}

async function setTableActive(restaurantId, tableId, active) {
  const [result] = await pool.query(
    "UPDATE restaurant_tables SET active = ? WHERE id = ? AND restaurant_id = ?",
    [active ? 1 : 0, tableId, restaurantId]
  );
  return result.affectedRows;
}

async function deleteTable(restaurantId, tableId) {
  const [result] = await pool.query(
    "DELETE FROM restaurant_tables WHERE id = ? AND restaurant_id = ?",
    [tableId, restaurantId]
  );
  return result.affectedRows;
}

module.exports = {
  getRestaurantByCode,
  listTables,
  createTable,
  bulkCreateTables,
  renameTable,
  setTableActive,
  deleteTable
};
