const pool = require("../db/pool");

async function getAllRestaurants() {
  const [rows] = await pool.query(`
    SELECT
      id, restaurant_code, name, owner_name, email, contact, password, address, city, state, pincode, gst_number,
      logo_url, plan, subscription_start_date, subscription_end_date, active, created_at
    FROM restaurants
    ORDER BY id DESC
  `);
  return rows;
}

async function getRestaurantById(id) {
  const [rows] = await pool.query("SELECT * FROM restaurants WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
}

async function createRestaurant(payload) {
  const [result] = await pool.query(
    `
    INSERT INTO restaurants (
      restaurant_code, name, owner_name, email, contact, password, address, city, state, pincode, gst_number,
      logo_url, plan, subscription_start_date, subscription_end_date, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `,
    [
      payload.restaurantCode,
      payload.name,
      payload.ownerName,
      payload.email,
      payload.contact,
      payload.password,
      payload.address,
      payload.city,
      payload.state,
      payload.pincode,
      payload.gstNumber || null,
      payload.logoUrl || null,
      payload.plan,
      payload.subscriptionStartDate,
      payload.subscriptionEndDate
    ]
  );
  return result.insertId;
}

async function updateRestaurant(id, payload) {
  await pool.query(
    `
    UPDATE restaurants
    SET
      name = ?,
      owner_name = ?,
      email = ?,
      contact = ?,
      password = ?,
      address = ?,
      city = ?,
      state = ?,
      pincode = ?,
      gst_number = ?,
      logo_url = ?,
      plan = ?,
      subscription_start_date = ?,
      subscription_end_date = ?
    WHERE id = ?
    `,
    [
      payload.name,
      payload.ownerName,
      payload.email,
      payload.contact,
      payload.password,
      payload.address,
      payload.city,
      payload.state,
      payload.pincode,
      payload.gstNumber || null,
      payload.logoUrl || null,
      payload.plan,
      payload.subscriptionStartDate,
      payload.subscriptionEndDate,
      id
    ]
  );
}

async function toggleRestaurantStatus(id, active) {
  await pool.query("UPDATE restaurants SET active = ? WHERE id = ?", [active, id]);
}

async function deleteRestaurantOrders(id) {
  await pool.query("DELETE FROM orders WHERE restaurant_id = ?", [id]);
}

async function deleteRestaurant(id) {
  await pool.query("DELETE FROM restaurants WHERE id = ?", [id]);
}

async function getRestaurantForLoginAs(id) {
  const [rows] = await pool.query(
    "SELECT id, restaurant_code, name, owner_name, email, contact, plan, active FROM restaurants WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] || null;
}

async function getRestaurantsMissingCode() {
  const [rows] = await pool.query(
    "SELECT id FROM restaurants WHERE restaurant_code IS NULL OR restaurant_code = ''"
  );
  return rows;
}

async function backfillRestaurantCodeAndPassword(id, code, password) {
  await pool.query(
    "UPDATE restaurants SET restaurant_code = ?, password = COALESCE(password, ?) WHERE id = ?",
    [code, password, id]
  );
}

module.exports = {
  getAllRestaurants,
  getRestaurantById,
  createRestaurant,
  updateRestaurant,
  toggleRestaurantStatus,
  deleteRestaurantOrders,
  deleteRestaurant,
  getRestaurantForLoginAs,
  getRestaurantsMissingCode,
  backfillRestaurantCodeAndPassword
};
