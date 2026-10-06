const pool = require("../db/pool");

async function getDashboardSummaryRows() {
  const [[restaurantRow]] = await pool.query("SELECT COUNT(*) AS total FROM restaurants");
  const [[orderRow]] = await pool.query("SELECT COUNT(*) AS total FROM orders");
  const [[planRow]] = await pool.query(
    "SELECT COUNT(*) AS total FROM restaurants WHERE LOWER(plan) <> 'free'"
  );
  const [[revenueRow]] = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM orders WHERE status IN ('Served', 'Completed')"
  );

  return { restaurantRow, orderRow, planRow, revenueRow };
}

async function getDashboardChartRows() {
  const [revenueRows] = await pool.query(`
    SELECT DATE(created_at) AS period, SUM(amount) AS total
    FROM orders GROUP BY DATE(created_at) ORDER BY period ASC LIMIT 30
  `);
  const [orderRows] = await pool.query(`
    SELECT DATE(created_at) AS period, COUNT(*) AS total
    FROM orders GROUP BY DATE(created_at) ORDER BY period ASC LIMIT 30
  `);
  const [activityRows] = await pool.query(`
    WITH RECURSIVE days AS (
      SELECT DATE_SUB(CURDATE(), INTERVAL 6 DAY) AS period
      UNION ALL
      SELECT DATE_ADD(period, INTERVAL 1 DAY) FROM days WHERE period < CURDATE()
    )
    SELECT
      d.period,
      COALESCE((
        SELECT COUNT(DISTINCT o.restaurant_id)
        FROM orders o
        WHERE DATE(o.created_at) = d.period
      ), 0) AS active,
      COALESCE((
        SELECT COUNT(*)
        FROM restaurants r
        WHERE DATE(r.created_at) = d.period
      ), 0) AS new_restaurants,
      COALESCE((
        SELECT COUNT(*)
        FROM restaurants r
        WHERE r.active = 0
      ), 0) AS inactive_restaurants
    FROM days d
    ORDER BY d.period ASC
  `);
  const [planRows] = await pool.query(
    "SELECT plan AS label, COUNT(*) AS value FROM restaurants GROUP BY plan"
  );
  const [revenueByPlanRows] = await pool.query(`
    SELECT r.plan AS label, COALESCE(SUM(o.amount), 0) AS value
    FROM restaurants r LEFT JOIN orders o ON o.restaurant_id = r.id
    GROUP BY r.plan
  `);
  const [topRows] = await pool.query(`
    SELECT r.name, COUNT(o.id) AS orders, COALESCE(SUM(o.amount), 0) AS revenue
    FROM restaurants r LEFT JOIN orders o ON o.restaurant_id = r.id
    GROUP BY r.id ORDER BY revenue DESC LIMIT 5
  `);
  const [[noOrderDropOffRow]] = await pool.query(`
    SELECT COUNT(*) AS value
    FROM restaurants r
    LEFT JOIN (
      SELECT restaurant_id, MAX(created_at) AS last_order_at
      FROM orders
      GROUP BY restaurant_id
    ) o ON o.restaurant_id = r.id
    WHERE o.last_order_at IS NULL OR o.last_order_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
  `);
  const [[expiredSubscriptionRow]] = await pool.query(`
    SELECT COUNT(*) AS value
    FROM restaurants
    WHERE LOWER(plan) <> 'free'
      AND subscription_end_date IS NOT NULL
      AND DATE(subscription_end_date) < CURDATE()
  `);
  const dropOffRows = [
    { label: "No orders in last 7 days", value: Number(noOrderDropOffRow.value || 0) },
    { label: "Expired subscriptions", value: Number(expiredSubscriptionRow.value || 0) }
  ];
  const [recentRows] = await pool.query(`
    SELECT event_type, description, created_at
    FROM activities ORDER BY created_at DESC LIMIT 8
  `);

  return {
    revenueRows,
    orderRows,
    activityRows,
    planRows,
    revenueByPlanRows,
    topRows,
    dropOffRows,
    recentRows
  };
}

async function getMonthlyRevenueRows(year) {
  const [rows] = await pool.query(
    `SELECT MONTH(created_at) AS month, COALESCE(SUM(amount), 0) AS total
     FROM orders
     WHERE status IN ('Served', 'Completed') AND YEAR(created_at) = ?
     GROUP BY MONTH(created_at)
     ORDER BY month ASC`,
    [year]
  );
  return rows;
}

async function getWeeklyRevenueRows() {
  const [rows] = await pool.query(`
    WITH RECURSIVE days AS (
      SELECT DATE_SUB(CURDATE(), INTERVAL 6 DAY) AS period
      UNION ALL
      SELECT DATE_ADD(period, INTERVAL 1 DAY) FROM days WHERE period < CURDATE()
    )
    SELECT
      d.period,
      COALESCE(SUM(o.amount), 0) AS total
    FROM days d
    LEFT JOIN orders o
      ON DATE(o.created_at) = d.period
      AND o.status IN ('Served', 'Completed')
    GROUP BY d.period
    ORDER BY d.period ASC
  `);
  return rows;
}

async function getYearlyRevenueRows() {
  const [rows] = await pool.query(`
    SELECT YEAR(created_at) AS period, COALESCE(SUM(amount), 0) AS total
    FROM orders
    WHERE status IN ('Served', 'Completed')
    GROUP BY YEAR(created_at)
    ORDER BY period ASC
  `);
  return rows;
}

module.exports = {
  getDashboardSummaryRows,
  getDashboardChartRows,
  getMonthlyRevenueRows,
  getWeeklyRevenueRows,
  getYearlyRevenueRows
};
