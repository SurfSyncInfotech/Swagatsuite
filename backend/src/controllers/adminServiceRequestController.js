const {
  listServiceRequestsByRestaurantCode,
  updateServiceRequestStatusByRestaurantCode
} = require("../models/serviceRequestModel");

async function getRestaurantServiceRequests(req, res) {
  try {
    const restaurantCode = String(req.params.restaurantCode || "").trim();
    if (!restaurantCode) {
      return res.status(400).json({ message: "restaurantCode is required." });
    }
    const requests = await listServiceRequestsByRestaurantCode(restaurantCode);
    const liveCount = requests.filter((row) => String(row.status) !== "Completed").length;
    return res.json({ requests, liveCount });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function patchRestaurantServiceRequestStatus(req, res) {
  try {
    const restaurantCode = String(req.params.restaurantCode || "").trim();
    const requestId = Number(req.params.requestId || 0);
    const status = String(req.body?.status || "").trim();
    if (!restaurantCode || !requestId || !status) {
      return res.status(400).json({ message: "restaurantCode, requestId and status are required." });
    }
    if (!["Acknowledged", "Completed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }
    const ok = await updateServiceRequestStatusByRestaurantCode({
      restaurantCode,
      requestId,
      status
    });
    if (!ok) {
      return res.status(404).json({ message: "Service request not found." });
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  getRestaurantServiceRequests,
  patchRestaurantServiceRequestStatus
};
