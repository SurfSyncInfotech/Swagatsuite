const {
  getRestaurantByCode,
  listInvoicesByRestaurant,
  createInvoiceFromOrder,
  updateInvoicePaymentStatus,
  getInvoiceByRestaurantAndOrder,
  deleteInvoiceByRestaurant
} = require("../models/invoiceModel");

async function getRestaurantInvoices(req, res) {
  try {
    const restaurantCode = String(req.params?.restaurantCode || "").trim();
    if (!restaurantCode) return res.status(400).json({ message: "Restaurant code required." });
    const restaurant = await getRestaurantByCode(restaurantCode);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found." });
    const invoices = await listInvoicesByRestaurant(restaurant.id);
    return res.json({ invoices, restaurant });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function generateInvoiceFromOrder(req, res) {
  try {
    const restaurantCode = String(req.params?.restaurantCode || "").trim();
    const orderId = Number(req.params?.orderId || 0);
    if (!restaurantCode || !orderId) return res.status(400).json({ message: "Restaurant code and order id are required." });
    const restaurant = await getRestaurantByCode(restaurantCode);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found." });
    const invoice = await createInvoiceFromOrder(restaurant.id, orderId);
    if (!invoice) return res.status(404).json({ message: "Served order not found for invoice generation." });
    return res.json({ invoice, success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function getInvoiceByOrder(req, res) {
  try {
    const restaurantCode = String(req.params?.restaurantCode || "").trim();
    const orderId = Number(req.params?.orderId || 0);
    if (!restaurantCode || !orderId) return res.status(400).json({ message: "Restaurant code and order id are required." });
    const restaurant = await getRestaurantByCode(restaurantCode);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found." });
    const invoice = await getInvoiceByRestaurantAndOrder(restaurant.id, orderId);
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });
    return res.json({ invoice });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function patchInvoicePaymentStatus(req, res) {
  try {
    const restaurantCode = String(req.params?.restaurantCode || "").trim();
    const invoiceId = Number(req.params?.invoiceId || 0);
    const paymentStatus = String(req.body?.paymentStatus || "").trim() || "Unpaid";
    if (!restaurantCode || !invoiceId) return res.status(400).json({ message: "Restaurant code and invoice id are required." });
    if (!["Paid", "Unpaid"].includes(paymentStatus)) return res.status(400).json({ message: "paymentStatus must be Paid or Unpaid." });
    const restaurant = await getRestaurantByCode(restaurantCode);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found." });
    const invoice = await updateInvoicePaymentStatus(restaurant.id, invoiceId, paymentStatus);
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });
    return res.json({ invoice, success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function deleteRestaurantInvoice(req, res) {
  try {
    const restaurantCode = String(req.params?.restaurantCode || "").trim();
    const invoiceId = Number(req.params?.invoiceId || 0);
    if (!restaurantCode || !invoiceId) return res.status(400).json({ message: "Restaurant code and invoice id are required." });
    const restaurant = await getRestaurantByCode(restaurantCode);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found." });
    const ok = await deleteInvoiceByRestaurant(restaurant.id, invoiceId);
    if (!ok) return res.status(404).json({ message: "Invoice not found." });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  getRestaurantInvoices,
  generateInvoiceFromOrder,
  getInvoiceByOrder,
  patchInvoicePaymentStatus,
  deleteRestaurantInvoice
};

