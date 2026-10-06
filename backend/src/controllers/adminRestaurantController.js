const {
  getRestaurantProfileByCode,
  updateRestaurantProfileByCode
} = require("../models/adminRestaurantModel");

async function getAdminRestaurantProfile(req, res) {
  try {
    const restaurantCode = String(req.params?.restaurantCode || "").trim();
    if (!restaurantCode) return res.status(400).json({ message: "Restaurant code required." });
    const row = await getRestaurantProfileByCode(restaurantCode);
    if (!row) return res.status(404).json({ message: "Restaurant not found." });
    return res.json({ restaurant: row });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function updateAdminRestaurantProfile(req, res) {
  try {
    const restaurantCode = String(req.params?.restaurantCode || "").trim();
    if (!restaurantCode) return res.status(400).json({ message: "Restaurant code required." });
    const body = req.body || {};
    if (!body.name || !body.owner_name || !body.email || !body.contact || !body.address || !body.city || !body.state || !body.pincode) {
      return res.status(400).json({ message: "Required profile fields are missing." });
    }
    const updated = await updateRestaurantProfileByCode(restaurantCode, req.body || {});
    if (!updated) return res.status(404).json({ message: "Restaurant not found." });
    return res.json({ restaurant: updated, success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  getAdminRestaurantProfile,
  updateAdminRestaurantProfile
};

