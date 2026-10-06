const { createReviewForOrder } = require("../models/reviewModel");

async function submitOrderReview(req, res) {
  try {
    const orderId = Number(req.params?.orderId || 0);
    const restaurantCode = String(req.body?.restaurantCode || "").trim();
    const token = String(req.body?.token || "").trim();
    const rating = Number(req.body?.rating || 0);
    const comment = String(req.body?.comment || "").trim();

    if (!orderId || !restaurantCode || !token) {
      return res.status(400).json({ message: "Order, restaurant and token are required." });
    }
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5." });
    }

    const result = await createReviewForOrder({ orderId, restaurantCode, token, rating, comment });
    if (!result.ok) {
      if (result.reason === "order_not_complete") {
        const current = result.status ? ` Current status: ${result.status}.` : "";
        return res.status(400).json({
          message: `Review is available only after your order status is Completed.${current}`
        });
      }
      if (result.reason === "already_submitted") {
        return res.status(400).json({ message: "Review already submitted for this order." });
      }
      return res.status(404).json({ message: "Order not found for this table." });
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  submitOrderReview
};
