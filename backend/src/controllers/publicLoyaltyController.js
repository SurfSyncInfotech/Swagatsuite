const { getLoyaltyByPhone, redeemReward, normalizePhone } = require("../models/loyaltyModel");
const { getRestaurantByCode, getTableByToken } = require("../models/publicMenuModel");

const EMPTY_LOYALTY = {
  stampsInCycle: 0,
  stampsPerReward: 5,
  rewardsPending: 0,
  totalStampsEarned: 0,
  totalRewardsEarned: 0,
  totalRewardsRedeemed: 0,
  rewardValueInr: 500,
  history: []
};

async function getPublicLoyalty(req, res) {
  try {
    const restaurantCode = String(req.query?.restaurant || "").trim();
    const phone = normalizePhone(req.query?.phone);
    if (!restaurantCode || phone.length < 10) {
      return res.status(400).json({ message: "Restaurant code and valid 10-digit phone are required." });
    }

    const restaurant = await getRestaurantByCode(restaurantCode);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found." });

    const loyalty = await getLoyaltyByPhone(restaurantCode, phone);
    return res.json({ loyalty: loyalty || { phone, ...EMPTY_LOYALTY } });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function redeemPublicLoyaltyReward(req, res) {
  try {
    const restaurantCode = String(req.body?.restaurantCode || "").trim();
    const token = String(req.body?.token || "").trim();
    const phone = normalizePhone(req.body?.phone);

    if (!restaurantCode || !token || phone.length < 10) {
      return res.status(400).json({ message: "Restaurant, table token and phone are required." });
    }

    const restaurant = await getRestaurantByCode(restaurantCode);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found." });

    const table = await getTableByToken(restaurant.id, token);
    if (!table || !table.active) {
      return res.status(403).json({ message: "Invalid table session." });
    }

    const result = await redeemReward(restaurantCode, phone);
    if (!result.ok) {
      if (result.reason === "no_reward") {
        return res.status(400).json({ message: "No free meal reward available to redeem." });
      }
      return res.status(400).json({ message: "Could not redeem reward." });
    }

    const loyalty = await getLoyaltyByPhone(restaurantCode, phone);
    return res.json({
      success: true,
      message: `Free meal (up to ₹${result.rewardValueInr}) marked for redemption. Show this to staff when ordering.`,
      loyalty: loyalty || { phone, ...EMPTY_LOYALTY }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  getPublicLoyalty,
  redeemPublicLoyaltyReward
};
