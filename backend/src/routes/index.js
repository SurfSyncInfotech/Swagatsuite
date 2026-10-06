const express = require("express");
const authRoutes = require("./authRoutes");
const adminRoutes = require("./adminRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const planRoutes = require("./planRoutes");
const restaurantRoutes = require("./restaurantRoutes");
const publicRoutes = require("./publicRoutes");
const leadRoutes = require("./leadRoutes");
const whatsappWebhookRoutes = require("./whatsappWebhookRoutes");
const { health } = require("../controllers/healthController");

const router = express.Router();

router.get("/", health);
router.use("/api/auth", authRoutes);
router.use("/api/admin", adminRoutes);
router.use("/api/dashboard", dashboardRoutes);
router.use("/api/plans", planRoutes);
router.use("/api/restaurants", restaurantRoutes);
router.use("/api/public", publicRoutes);
router.use("/api/leads", leadRoutes);
router.use("/api/webhooks/whatsapp/smartping", whatsappWebhookRoutes);

module.exports = router;
