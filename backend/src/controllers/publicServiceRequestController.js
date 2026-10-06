const { createServiceRequest } = require("../models/serviceRequestModel");

const ALLOWED_REQUESTS = ["water", "tissue", "waiter"];

async function createPublicServiceRequest(req, res) {
  try {
    const restaurantCode = String(req.body?.restaurantCode || "").trim();
    const token = String(req.body?.token || "").trim();
    const requestType = String(req.body?.requestType || "").trim().toLowerCase();

    if (!restaurantCode || !token || !requestType) {
      return res.status(400).json({ message: "restaurantCode, token and requestType are required." });
    }
    if (!ALLOWED_REQUESTS.includes(requestType)) {
      return res.status(400).json({ message: "Invalid request type." });
    }

    const result = await createServiceRequest({ restaurantCode, token, requestType });
    if (!result.ok) {
      if (result.reason === "already_pending") {
        return res.status(400).json({ message: "Same request is already pending for this table." });
      }
      return res.status(404).json({ message: "Table not found." });
    }
    return res.status(201).json({ success: true, requestId: result.requestId, tableName: result.tableName });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  createPublicServiceRequest
};

