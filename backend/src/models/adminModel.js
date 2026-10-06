const pool = require("../db/pool");

function toIsoDateLabel(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return raw;
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getDateParts(value) {
  const iso = toIsoDateLabel(value);
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return {
      isoDate: iso,
      day: "",
      monthShort: "",
      monthName: ""
    };
  }
  const month = Number(match[2]);
  const day = String(Number(match[3]));
  const dt = new Date(2000, month - 1, Number(match[3]));
  return {
    isoDate: iso,
    day,
    monthShort: dt.toLocaleDateString("en-IN", { month: "short" }),
    monthName: dt.toLocaleDateString("en-IN", { month: "long" })
  };
}

async function getRestaurantByCredentials(identifier, password) {
  const [rows] = await pool.query(
    `
    SELECT
      id, restaurant_code, name, owner_name, email, contact, logo_url, plan, subscription_end_date, active,
      address, city, state, pincode, gst_number
    FROM restaurants
    WHERE (LOWER(TRIM(email)) = LOWER(TRIM(?)) OR LOWER(TRIM(restaurant_code)) = LOWER(TRIM(?)))
      AND TRIM(password) = TRIM(?)
    ORDER BY active DESC, id DESC
    LIMIT 1
    `,
    [identifier, identifier, password]
  );
  return rows[0] || null;
}

async function getRestaurantByCode(restaurantCode) {
  const [rows] = await pool.query(
    `
    SELECT
      id, restaurant_code, name, owner_name, email, contact, logo_url, plan, subscription_end_date, active,
      address, city, state, pincode, gst_number
    FROM restaurants
    WHERE restaurant_code = ?
    LIMIT 1
    `,
    [restaurantCode]
  );
  return rows[0] || null;
}

async function getRestaurantOrderStats(restaurantId) {
  const [[ordersToday]] = await pool.query(
    "SELECT COUNT(*) AS total FROM orders WHERE restaurant_id = ? AND DATE(created_at) = CURDATE()",
    [restaurantId]
  );
  const [[revenueToday]] = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM orders WHERE restaurant_id = ? AND DATE(created_at) = CURDATE()",
    [restaurantId]
  );
  const [[activeOrders]] = await pool.query(
    "SELECT COUNT(*) AS total FROM orders WHERE restaurant_id = ? AND status IN ('Placed', 'Preparing', 'Ready')",
    [restaurantId]
  );

  return {
    ordersToday: Number(ordersToday.total || 0),
    revenueToday: Number(revenueToday.total || 0),
    activeOrders: Number(activeOrders.total || 0)
  };
}

async function getRestaurantTrendData(restaurantId) {
  const [orderTrend] = await pool.query(
    `
    SELECT DATE(created_at) AS label, COUNT(*) AS total
    FROM orders
    WHERE restaurant_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(created_at)
    ORDER BY label ASC
    `,
    [restaurantId]
  );

  const [revenueTrend] = await pool.query(
    `
    SELECT DATE(created_at) AS label, COALESCE(SUM(amount), 0) AS total
    FROM orders
    WHERE restaurant_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(created_at)
    ORDER BY label ASC
    `,
    [restaurantId]
  );

  return {
    orderTrend: orderTrend.map((row) => {
      const parts = getDateParts(row.label);
      return {
        label: parts.isoDate,
        isoDate: parts.isoDate,
        day: parts.day,
        monthShort: parts.monthShort,
        monthName: parts.monthName,
        total: Number(row.total)
      };
    }),
    revenueTrend: revenueTrend.map((row) => {
      const parts = getDateParts(row.label);
      return {
        label: parts.isoDate,
        isoDate: parts.isoDate,
        day: parts.day,
        monthShort: parts.monthShort,
        monthName: parts.monthName,
        total: Number(row.total)
      };
    })
  };
}

module.exports = {
  getRestaurantByCredentials,
  getRestaurantByCode,
  getRestaurantOrderStats,
  getRestaurantTrendData
};
