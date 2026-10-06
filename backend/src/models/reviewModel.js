const pool = require("../db/pool");
const { markInvoicePaidForOrder } = require("./invoiceModel");

async function createReviewForOrder({ orderId, restaurantCode, token, rating, comment }) {
  const [rows] = await pool.query(
    `
    SELECT
      o.id AS order_id,
      o.restaurant_id,
      o.table_id,
      o.customer_name,
      o.status AS order_status
    FROM orders o
    INNER JOIN restaurants r ON r.id = o.restaurant_id
    INNER JOIN restaurant_tables t ON t.id = o.table_id AND t.qr_token = ?
    WHERE o.id = ? AND r.restaurant_code = ?
    LIMIT 1
    `,
    [token, orderId, restaurantCode]
  );
  const row = rows[0];
  if (!row) return { ok: false, reason: "order_not_found" };

  const status = String(row.order_status || "").trim();
  if (status.toLowerCase() !== "completed") {
    return { ok: false, reason: "order_not_complete", status };
  }

  const [existingRows] = await pool.query(
    "SELECT id FROM reviews WHERE order_id = ? LIMIT 1",
    [orderId]
  );
  if (existingRows[0]) return { ok: false, reason: "already_submitted" };

  await pool.query(
    `
    INSERT INTO reviews (
      restaurant_id, order_id, table_id, customer_name, rating, comment
    ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      row.restaurant_id,
      row.order_id,
      row.table_id,
      row.customer_name || "",
      rating,
      comment || ""
    ]
  );

  try {
    await markInvoicePaidForOrder(row.restaurant_id, orderId);
  } catch (payErr) {
    console.error("[review] auto-mark invoice paid failed:", payErr.message);
  }

  return { ok: true };
}

async function listReviewsByRestaurantCode(restaurantCode) {
  const [rows] = await pool.query(
    `
    SELECT
      rv.id,
      rv.order_id AS orderId,
      rv.customer_name AS customerName,
      o.customer_phone AS customerPhone,
      rv.rating,
      rv.comment,
      rv.created_at AS createdAt,
      o.table_label AS tableLabel
    FROM reviews rv
    INNER JOIN restaurants r ON r.id = rv.restaurant_id
    LEFT JOIN orders o ON o.id = rv.order_id
    WHERE r.restaurant_code = ?
    ORDER BY rv.created_at DESC
    LIMIT 400
    `,
    [restaurantCode]
  );
  return rows;
}

module.exports = {
  createReviewForOrder,
  listReviewsByRestaurantCode
};
