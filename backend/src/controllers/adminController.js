const {
  getRestaurantByCredentials,
  getRestaurantByCode,
  getRestaurantOrderStats,
  getRestaurantTrendData
} = require("../models/adminModel");

async function adminLogin(req, res) {
  try {
    const identifier = String(req.body?.email || req.body?.identifier || "").trim();
    const password = String(req.body?.password || "").trim();
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Email/Restaurant ID and password are required." });
    }

    const restaurant = await getRestaurantByCredentials(identifier, password);
    if (!restaurant) {
      return res.status(401).json({ success: false, message: "Invalid credentials." });
    }
    if (!restaurant.active) {
      return res.status(403).json({ success: false, message: "Your account is disabled. Contact superadmin." });
    }

    return res.json({
      success: true,
      token: `admin-${restaurant.restaurant_code}-${Date.now()}`,
      restaurant
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getAdminDashboard(req, res) {
  try {
    const { restaurantCode } = req.params;
    const restaurant = await getRestaurantByCode(restaurantCode);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found." });

    const stats = await getRestaurantOrderStats(restaurant.id);
    const trends = await getRestaurantTrendData(restaurant.id);

    return res.json({
      restaurant,
      ...stats,
      orderTrend: trends.orderTrend,
      revenueTrend: trends.revenueTrend
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  adminLogin,
  getAdminDashboard
};
