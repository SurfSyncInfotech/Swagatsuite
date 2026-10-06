const { getInvoiceForTableOrder } = require("../models/invoiceModel");

async function getPublicInvoiceForOrder(req, res) {
  try {
    const orderId = Number(req.params?.orderId || 0);
    const restaurantCode = String(req.query?.restaurant || "").trim();
    const token = String(req.query?.token || "").trim();
    if (!orderId || !restaurantCode || !token) {
      return res.status(400).json({ message: "Order id, restaurant and token are required." });
    }
    const invoice = await getInvoiceForTableOrder(orderId, restaurantCode, token);
    if (!invoice) return res.status(404).json({ message: "Invoice not available yet." });
    return res.json({ invoice });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  getPublicInvoiceForOrder
};

