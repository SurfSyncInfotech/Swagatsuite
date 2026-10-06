const pool = require("../db/pool");

const STATUSES = ["Placed", "Preparing", "Ready", "Served", "Completed"];

async function listOrdersByRestaurantCode(restaurantCode) {
  const [restRows] = await pool.query("SELECT id FROM restaurants WHERE restaurant_code = ? LIMIT 1", [
    restaurantCode
  ]);
  const restaurant = restRows[0];
  if (!restaurant) return null;

  const [rows] = await pool.query(
    `
    SELECT
      o.id AS id,
      o.amount AS amount,
      o.status AS status,
      o.table_id AS tableId,
      o.table_label AS tableLabel,
      o.created_at AS createdAt,
      o.customer_name AS customerName,
      o.customer_phone AS customerPhone,
      o.customer_email AS customerEmail,
      o.items_json AS itemsJson
    FROM orders o
    WHERE o.restaurant_id = ?
    ORDER BY o.created_at DESC
    LIMIT 300
    `,
    [restaurant.id]
  );
  return { restaurantId: restaurant.id, orders: rows };
}

async function updateOrderStatus(restaurantCode, orderId, status) {
  if (!STATUSES.includes(status)) return { ok: false, reason: "invalid_status" };

  const [result] = await pool.query(
    `
    UPDATE orders o
    INNER JOIN restaurants r ON r.id = o.restaurant_id
    SET o.status = ?
    WHERE o.id = ? AND r.restaurant_code = ?
    `,
    [status, orderId, restaurantCode]
  );
  return { ok: Number(result.affectedRows) > 0 };
}

async function deleteOrderByRestaurantCode(restaurantCode, orderId) {
  const [result] = await pool.query(
    `
    DELETE o
    FROM orders o
    INNER JOIN restaurants r ON r.id = o.restaurant_id
    WHERE o.id = ? AND r.restaurant_code = ?
    `,
    [orderId, restaurantCode]
  );
  return { ok: Number(result.affectedRows) > 0 };
}

async function createManualServedOrderByRestaurantCode(restaurantCode, payload) {
  const [restRows] = await pool.query("SELECT id FROM restaurants WHERE restaurant_code = ? LIMIT 1", [
    restaurantCode
  ]);
  const restaurant = restRows[0];
  if (!restaurant) return null;

  const amount = Number(payload.amount || 0);
  const itemsJson = payload.itemsJson || null;

  const [result] = await pool.query(
    `
    INSERT INTO orders (
      restaurant_id, amount, status, table_id, table_label,
      customer_name, customer_phone, customer_email, items_json
    ) VALUES (?, ?, 'Served', NULL, ?, ?, ?, ?, ?)
    `,
    [
      restaurant.id,
      amount,
      payload.tableLabel || null,
      payload.customerName || null,
      payload.customerPhone || null,
      payload.customerEmail || null,
      itemsJson
    ]
  );
  return { restaurantId: restaurant.id, orderId: result.insertId };
}

module.exports = {
  listOrdersByRestaurantCode,
  updateOrderStatus,
  deleteOrderByRestaurantCode,
  createManualServedOrderByRestaurantCode,
  ORDER_STATUSES: STATUSES
};
