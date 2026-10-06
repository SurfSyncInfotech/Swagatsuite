const express = require("express");
const { getSummary, getCharts, getRevenueMonthly, getRevenueGrowth } = require("../controllers/dashboardController");

const router = express.Router();

router.get("/summary", getSummary);
router.get("/charts", getCharts);
router.get("/revenue-monthly", getRevenueMonthly);
router.get("/revenue-growth", getRevenueGrowth);

module.exports = router;
