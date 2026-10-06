const express = require("express");
const {
  listPlans,
  createPlanHandler,
  updatePlanHandler,
  assignPlanHandler
} = require("../controllers/planController");

const router = express.Router();

router.get("/", listPlans);
router.post("/", createPlanHandler);
router.put("/:id", updatePlanHandler);
router.post("/assign", assignPlanHandler);

module.exports = router;
