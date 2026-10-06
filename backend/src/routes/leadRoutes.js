const express = require("express");
const { submitLead, getLeads, removeLead } = require("../controllers/leadController");

const router = express.Router();

router.post("/", submitLead);
router.get("/", getLeads);
router.post("/:id/delete", removeLead);
router.delete("/:id", removeLead);

module.exports = router;
