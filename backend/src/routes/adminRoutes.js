const express = require("express");
const { adminLogin, getAdminDashboard } = require("../controllers/adminController");
const {
  getCategories,
  addCategory,
  editCategory,
  removeCategory,
  getItems,
  addItem,
  editItem,
  removeItem,
  patchItemAvailability,
  patchItemPrice
} = require("../controllers/menuController");
const { generateMenuItemImage } = require("../controllers/menuImageController");
const {
  getTables,
  addTable,
  addTablesBulk,
  updateTableName,
  toggleTable,
  removeTable
} = require("../controllers/tableController");
const {
  getRestaurantOrders,
  patchRestaurantOrderStatus,
  deleteRestaurantOrder,
  createManualServedOrder
} = require("../controllers/adminOrderController");
const {
  getRestaurantInvoices,
  generateInvoiceFromOrder,
  getInvoiceByOrder,
  patchInvoicePaymentStatus,
  deleteRestaurantInvoice
} = require("../controllers/adminInvoiceController");
const {
  getAdminRestaurantProfile,
  updateAdminRestaurantProfile
} = require("../controllers/adminRestaurantController");
const { getRestaurantReviews } = require("../controllers/adminReviewController");
const {
  getRestaurantServiceRequests,
  patchRestaurantServiceRequestStatus
} = require("../controllers/adminServiceRequestController");
const {
  getRestaurantLoyaltyOverview,
  markRestaurantLoyaltyRewardRedeemed
} = require("../controllers/adminLoyaltyController");

const router = express.Router();

router.post("/login", adminLogin);
router.get("/dashboard/:restaurantCode", getAdminDashboard);
router.get("/restaurant/:restaurantCode", getAdminRestaurantProfile);
router.put("/restaurant/:restaurantCode", updateAdminRestaurantProfile);
router.get("/menu/:restaurantCode/categories", getCategories);
router.post("/menu/:restaurantCode/categories", addCategory);
router.put("/menu/:restaurantCode/categories/:categoryId", editCategory);
router.delete("/menu/:restaurantCode/categories/:categoryId", removeCategory);
router.get("/menu/:restaurantCode/items", getItems);
router.post("/menu/:restaurantCode/items", addItem);
router.put("/menu/:restaurantCode/items/:itemId", editItem);
router.delete("/menu/:restaurantCode/items/:itemId", removeItem);
router.patch("/menu/:restaurantCode/items/:itemId/availability", patchItemAvailability);
router.patch("/menu/:restaurantCode/items/:itemId/price", patchItemPrice);
router.post("/menu/generate-item-image", generateMenuItemImage);
router.get("/tables/:restaurantCode", getTables);
router.post("/tables/:restaurantCode", addTable);
router.post("/tables/:restaurantCode/bulk", addTablesBulk);
router.put("/tables/:restaurantCode/:tableId", updateTableName);
router.patch("/tables/:restaurantCode/:tableId/toggle", toggleTable);
router.delete("/tables/:restaurantCode/:tableId", removeTable);
router.get("/orders/:restaurantCode", getRestaurantOrders);
router.post("/orders/:restaurantCode/manual-served", createManualServedOrder);
router.patch("/orders/:restaurantCode/:orderId/status", patchRestaurantOrderStatus);
router.delete("/orders/:restaurantCode/:orderId", deleteRestaurantOrder);
router.get("/invoices/:restaurantCode", getRestaurantInvoices);
router.get("/invoices/:restaurantCode/by-order/:orderId", getInvoiceByOrder);
router.post("/invoices/:restaurantCode/from-order/:orderId", generateInvoiceFromOrder);
router.patch("/invoices/:restaurantCode/:invoiceId/payment", patchInvoicePaymentStatus);
router.delete("/invoices/:restaurantCode/:invoiceId", deleteRestaurantInvoice);
router.get("/reviews/:restaurantCode", getRestaurantReviews);
router.get("/service-requests/:restaurantCode", getRestaurantServiceRequests);
router.patch("/service-requests/:restaurantCode/:requestId/status", patchRestaurantServiceRequestStatus);
router.get("/loyalty/:restaurantCode", getRestaurantLoyaltyOverview);
router.patch("/loyalty/:restaurantCode/:loyaltyId/redeem", markRestaurantLoyaltyRewardRedeemed);

module.exports = router;
