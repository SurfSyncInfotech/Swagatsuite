const pool = require("../db/pool");

async function getRestaurantProfileByCode(restaurantCode) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      restaurant_code,
      name,
      owner_name,
      email,
      contact,
      password,
      address,
      city,
      state,
      pincode,
      gst_number,
      logo_url,
      plan,
      subscription_start_date,
      subscription_end_date,
      active
    FROM restaurants
    WHERE restaurant_code = ?
    LIMIT 1
    `,
    [restaurantCode]
  );
  return rows[0] || null;
}

async function updateRestaurantProfileByCode(restaurantCode, payload) {
  const safe = {
    restaurant_code: String(payload?.restaurant_code || "").trim(),
    name: String(payload?.name || "").trim(),
    owner_name: String(payload?.owner_name || "").trim(),
    email: String(payload?.email || "").trim(),
    contact: String(payload?.contact || "").trim(),
    password: String(payload?.password || "").trim(),
    address: String(payload?.address || "").trim(),
    city: String(payload?.city || "").trim(),
    state: String(payload?.state || "").trim(),
    pincode: String(payload?.pincode || "").trim(),
    gst_number: String(payload?.gst_number || "").trim() || null,
    logo_url: String(payload?.logo_url || "").trim() || null,
    plan: String(payload?.plan || "Free").trim() || "Free",
    subscription_start_date: payload?.subscription_start_date || null,
    subscription_end_date: payload?.subscription_end_date || null
  };

  await pool.query(
    `
    UPDATE restaurants
    SET
      restaurant_code = ?,
      name = ?,
      owner_name = ?,
      email = ?,
      contact = ?,
      password = COALESCE(NULLIF(?, ''), password),
      address = ?,
      city = ?,
      state = ?,
      pincode = ?,
      gst_number = ?,
      logo_url = ?,
      plan = ?,
      subscription_start_date = ?,
      subscription_end_date = ?
    WHERE restaurant_code = ?
    `,
    [
      safe.restaurant_code || restaurantCode,
      safe.name,
      safe.owner_name,
      safe.email,
      safe.contact,
      safe.password,
      safe.address,
      safe.city,
      safe.state,
      safe.pincode,
      safe.gst_number,
      safe.logo_url,
      safe.plan,
      safe.plan === "Free" ? null : safe.subscription_start_date,
      safe.plan === "Free" ? null : safe.subscription_end_date,
      restaurantCode
    ]
  );

  return await getRestaurantProfileByCode(safe.restaurant_code || restaurantCode);
}

module.exports = {
  getRestaurantProfileByCode,
  updateRestaurantProfileByCode
};

