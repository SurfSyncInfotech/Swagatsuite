const pool = require("../db/pool");

function parseItemsJson(raw) {
  if (!raw) return [];
  try {
    const text =
      typeof raw === "string"
        ? raw
        : typeof Buffer !== "undefined" && Buffer.isBuffer(raw)
          ? raw.toString("utf8")
          : String(raw);
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

function normalizeInvoiceRow(row) {
  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    orderId: row.order_id,
    tableLabel: row.table_label || "",
    customerName: row.customer_name || "",
    customerPhone: row.customer_phone || "",
    customerEmail: row.customer_email || "",
    items: parseItemsJson(row.items_json),
    subTotal: Number(row.sub_total || 0),
    gstPercent: Number(row.gst_percent || 0),
    gstAmount: Number(row.gst_amount || 0),
    total: Number(row.total || 0),
    paymentMode: row.payment_mode || "Online",
    paymentStatus: row.payment_status || "Unpaid",
    createdAt: row.created_at
  };
}

async function getRestaurantByCode(restaurantCode) {
  const [rows] = await pool.query(
    "SELECT id, name, logo_url, address, city, state, pincode, gst_number FROM restaurants WHERE restaurant_code = ? LIMIT 1",
    [restaurantCode]
  );
  return rows[0] || null;
}

async function getInvoiceByRestaurantAndOrder(restaurantId, orderId) {
  const [rows] = await pool.query(
    "SELECT * FROM invoices WHERE restaurant_id = ? AND order_id = ? LIMIT 1",
    [restaurantId, orderId]
  );
  return rows[0] ? normalizeInvoiceRow(rows[0]) : null;
}

async function listInvoicesByRestaurant(restaurantId) {
  const [rows] = await pool.query(
    "SELECT * FROM invoices WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 400",
    [restaurantId]
  );
  return rows.map(normalizeInvoiceRow);
}

async function createInvoiceFromOrder(restaurantId, orderId) {
  const existing = await getInvoiceByRestaurantAndOrder(restaurantId, orderId);
  if (existing) return existing;

  const [orderRows] = await pool.query(
    `
    SELECT id, table_label, customer_name, customer_phone, customer_email, amount, items_json
    FROM orders
    WHERE id = ? AND restaurant_id = ? AND status = 'Served'
    LIMIT 1
    `,
    [orderId, restaurantId]
  );
  const order = orderRows[0];
  if (!order) return null;

  const parsedItems = parseItemsJson(order.items_json);
  const items = parsedItems.length
    ? parsedItems.map((line) => {
        const qty = Number(line.qty || 1);
        const unitPrice = Number(line.unitPrice || line.price || 0);
        const lineTotal = Number(line.lineTotal || qty * unitPrice || 0);
        return {
          itemId: Number(line.itemId || 0),
          name: line.name || "Item",
          qty,
          unitPrice,
          lineTotal
        };
      })
    : [
        {
          itemId: 0,
          name: "Order Total",
          qty: 1,
          unitPrice: Number(order.amount || 0),
          lineTotal: Number(order.amount || 0)
        }
      ];

  let subTotal = items.reduce((sum, row) => sum + Number(row.lineTotal || 0), 0);
  if (!subTotal) subTotal = Number(order.amount || 0);
  const gstPercent = 18;
  const gstAmount = Number(((subTotal * gstPercent) / 100).toFixed(2));
  const total = Number((subTotal + gstAmount).toFixed(2));

  // Concurrency-safe invoice generation:
  // Retry on duplicate key (invoice_no/order_id) caused by parallel requests.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const [[maxRow]] = await pool.query(
        "SELECT MAX(invoice_no) AS maxNo FROM invoices WHERE restaurant_id = ?",
        [restaurantId]
      );
      const invoiceNo = Math.max(1200, Number(maxRow.maxNo || 1200)) + 1;

      const [insertRes] = await pool.query(
        `
        INSERT INTO invoices (
          restaurant_id, order_id, invoice_no,
          table_label, customer_name, customer_phone, customer_email,
          items_json, sub_total, gst_percent, gst_amount, total,
          payment_mode, payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Online', 'Unpaid')
        `,
        [
          restaurantId,
          orderId,
          invoiceNo,
          order.table_label || "",
          order.customer_name || "",
          order.customer_phone || "",
          order.customer_email || "",
          JSON.stringify(items),
          subTotal,
          gstPercent,
          gstAmount,
          total
        ]
      );

      const [rows] = await pool.query("SELECT * FROM invoices WHERE id = ? LIMIT 1", [insertRes.insertId]);
      return rows[0] ? normalizeInvoiceRow(rows[0]) : null;
    } catch (error) {
      if (error?.code !== "ER_DUP_ENTRY") throw error;
      const existingNow = await getInvoiceByRestaurantAndOrder(restaurantId, orderId);
      if (existingNow) return existingNow;
      if (attempt === 3) throw error;
    }
  }
  return null;
}

async function markInvoicePaidForOrder(restaurantId, orderId) {
  await pool.query(
    "UPDATE invoices SET payment_status = 'Paid' WHERE order_id = ? AND restaurant_id = ? AND payment_status = 'Unpaid'",
    [orderId, restaurantId]
  );
}

async function updateInvoicePaymentStatus(restaurantId, invoiceId, paymentStatus) {
  await pool.query(
    "UPDATE invoices SET payment_status = ? WHERE id = ? AND restaurant_id = ?",
    [paymentStatus, invoiceId, restaurantId]
  );
  const [rows] = await pool.query("SELECT * FROM invoices WHERE id = ? AND restaurant_id = ? LIMIT 1", [invoiceId, restaurantId]);
  return rows[0] ? normalizeInvoiceRow(rows[0]) : null;
}

async function getInvoiceForTableOrder(orderId, restaurantCode, tableToken) {
  const [rows] = await pool.query(
    `
    SELECT i.*
    FROM invoices i
    INNER JOIN orders o ON o.id = i.order_id
    INNER JOIN restaurants r ON r.id = i.restaurant_id
    INNER JOIN restaurant_tables t ON t.id = o.table_id
    WHERE i.order_id = ?
      AND r.restaurant_code = ?
      AND t.qr_token = ?
    LIMIT 1
    `,
    [orderId, restaurantCode, tableToken]
  );
  return rows[0] ? normalizeInvoiceRow(rows[0]) : null;
}

async function deleteInvoiceByRestaurant(restaurantId, invoiceId) {
  const [result] = await pool.query(
    "DELETE FROM invoices WHERE id = ? AND restaurant_id = ?",
    [invoiceId, restaurantId]
  );
  return Number(result.affectedRows || 0) > 0;
}

module.exports = {
  getRestaurantByCode,
  getInvoiceByRestaurantAndOrder,
  listInvoicesByRestaurant,
  createInvoiceFromOrder,
  markInvoicePaidForOrder,
  updateInvoicePaymentStatus,
  getInvoiceForTableOrder,
  deleteInvoiceByRestaurant
};

