const pool = require("../db/pool");

async function getRestaurantByCode(restaurantCode) {
  const [rows] = await pool.query(
    "SELECT id, name, logo_url, address, city, state, pincode, gst_number FROM restaurants WHERE restaurant_code = ? AND active = 1 LIMIT 1",
    [restaurantCode]
  );
  return rows[0] || null;
}

async function getTableByToken(restaurantId, token) {
  const [rows] = await pool.query(
    `
    SELECT id, table_name, active
    FROM restaurant_tables
    WHERE restaurant_id = ? AND qr_token = ?
    LIMIT 1
    `,
    [restaurantId, token]
  );
  return rows[0] || null;
}

async function getMenuItems(restaurantId) {
  const [rows] = await pool.query(
    `
    SELECT
      mi.id,
      mi.name,
      mi.price,
      mi.description,
      mi.image_url,
      mi.available,
      mc.name AS category
    FROM menu_items mi
    INNER JOIN menu_categories mc ON mc.id = mi.category_id
    WHERE mi.restaurant_id = ?
    ORDER BY mc.name ASC, mi.name ASC
    `,
    [restaurantId]
  );
  return rows;
}

async function getMenuItemsByIds(restaurantId, itemIds) {
  if (!itemIds.length) return [];
  const placeholders = itemIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `
    SELECT id, name, price, available
    FROM menu_items
    WHERE restaurant_id = ? AND id IN (${placeholders})
    `,
    [restaurantId, ...itemIds]
  );
  return rows;
}

async function createOrder({
  restaurantId,
  amount,
  tableId,
  tableLabel,
  customerName,
  customerPhone,
  customerEmail,
  itemsJson
}) {
  const [result] = await pool.query(
    `
    INSERT INTO orders (
      restaurant_id, amount, status, table_id, table_label,
      customer_name, customer_phone, customer_email, items_json
    )
    VALUES (?, ?, 'Placed', ?, ?, ?, ?, ?, ?)
    `,
    [
      restaurantId,
      amount,
      tableId || null,
      tableLabel || null,
      customerName || null,
      customerPhone || null,
      customerEmail || null,
      itemsJson || null
    ]
  );
  return result.insertId;
}

async function getOrderForTable(orderId, restaurantCode, tableToken) {
  const [rows] = await pool.query(
    `
    SELECT
      o.id,
      o.amount,
      o.status,
      o.table_label,
      o.created_at,
      o.items_json,
      o.customer_name,
      o.customer_phone,
      o.customer_email
    FROM orders o
    INNER JOIN restaurant_tables t ON t.id = o.table_id
    INNER JOIN restaurants r ON r.id = o.restaurant_id
    WHERE o.id = ?
      AND r.restaurant_code = ?
      AND t.qr_token = ?
    LIMIT 1
    `,
    [orderId, restaurantCode, tableToken]
  );
  return rows[0] || null;
}

module.exports = {
  getRestaurantByCode,
  getTableByToken,
  getMenuItems,
  getMenuItemsByIds,
  createOrder,
  getOrderForTable
};
