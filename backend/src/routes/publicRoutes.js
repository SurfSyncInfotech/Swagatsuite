const express = require("express");
const { getQrMenu, placeQrOrder, getQrOrderStatus } = require("../controllers/publicMenuController");
const { getPublicInvoiceForOrder } = require("../controllers/publicInvoiceController");
const { submitOrderReview } = require("../controllers/publicReviewController");
const { createPublicServiceRequest } = require("../controllers/publicServiceRequestController");
const { getPublicLoyalty, redeemPublicLoyaltyReward } = require("../controllers/publicLoyaltyController");
const { speakVoice, replyVoice } = require("../controllers/publicVoiceController");

const router = express.Router();

router.get("/menu", getQrMenu);
router.post("/orders", placeQrOrder);
router.get("/orders/:orderId", getQrOrderStatus);
router.get("/orders/:orderId/invoice", getPublicInvoiceForOrder);
router.post("/orders/:orderId/review", submitOrderReview);
router.post("/service-requests", createPublicServiceRequest);
router.get("/loyalty", getPublicLoyalty);
router.post("/loyalty/redeem", redeemPublicLoyaltyReward);
router.post("/voice/speak", speakVoice);
router.post("/voice/reply", replyVoice);

module.exports = router;
