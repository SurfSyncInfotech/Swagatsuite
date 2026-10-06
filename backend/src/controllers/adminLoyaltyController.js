const {
  listLoyaltyOverviewForRestaurant,
  adminRedeemRewardByLoyaltyId
} = require("../models/loyaltyModel");

async function getRestaurantLoyaltyOverview(req, res) {
  try {
    const { restaurantCode } = req.params;
    if (!restaurantCode) {
      return res.status(400).json({ message: "Restaurant code is required." });
    }

    const overview = await listLoyaltyOverviewForRestaurant(restaurantCode);
    if (!overview) return res.status(404).json({ message: "Restaurant not found." });

    return res.json(overview);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function markRestaurantLoyaltyRewardRedeemed(req, res) {
  try {
    const { restaurantCode, loyaltyId } = req.params;
    if (!restaurantCode || !loyaltyId) {
      return res.status(400).json({ message: "Restaurant code and loyalty id are required." });
    }

    const result = await adminRedeemRewardByLoyaltyId(restaurantCode, Number(loyaltyId));
    if (!result.ok) {
      if (result.reason === "no_reward") {
        return res.status(400).json({ message: "No pending reward for this customer." });
      }
      return res.status(400).json({ message: "Could not mark reward as redeemed." });
    }

    const overview = await listLoyaltyOverviewForRestaurant(restaurantCode);
    return res.json({
      success: true,
      message: `Reward (₹${result.rewardValueInr}) marked redeemed for ${result.phone}.`,
      overview
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  getRestaurantLoyaltyOverview,
  markRestaurantLoyaltyRewardRedeemed
};
