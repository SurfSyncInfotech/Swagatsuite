const express = require("express");
const {
  listRestaurants,
  getRestaurant,
  createRestaurantHandler,
  updateRestaurantHandler,
  toggleStatus,
  deleteRestaurantHandler,
  loginAsRestaurant
} = require("../controllers/restaurantController");

const router = express.Router();

router.get("/", listRestaurants);
router.get("/:id", getRestaurant);
router.post("/", createRestaurantHandler);
router.put("/:id", updateRestaurantHandler);
router.patch("/:id/toggle-status", toggleStatus);
router.delete("/:id", deleteRestaurantHandler);
router.post("/:id/login-as", loginAsRestaurant);

module.exports = router;
