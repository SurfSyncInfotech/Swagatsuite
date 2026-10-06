const { listReviewsByRestaurantCode } = require("../models/reviewModel");

async function getRestaurantReviews(req, res) {
  try {
    const restaurantCode = String(req.params?.restaurantCode || "").trim();
    if (!restaurantCode) return res.status(400).json({ message: "Restaurant code required." });
    const reviews = await listReviewsByRestaurantCode(restaurantCode);
    return res.json({ reviews });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  getRestaurantReviews
};

