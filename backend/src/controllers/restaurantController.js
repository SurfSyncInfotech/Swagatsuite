const { addActivity } = require("../models/activityModel");
const {
  getAllRestaurants,
  getRestaurantById,
  createRestaurant,
  updateRestaurant,
  toggleRestaurantStatus,
  deleteRestaurantOrders,
  deleteRestaurant,
  getRestaurantForLoginAs
} = require("../models/restaurantModel");
const { generatePassword, generateRestaurantCode } = require("../utils/generators");

function normalizeDateInput(value) {
  if (!value) return null;
  const asString = String(value);
  return asString.includes("T") ? asString.slice(0, 10) : asString;
}

async function listRestaurants(_req, res) {
  try {
    const rows = await getAllRestaurants();
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function getRestaurant(req, res) {
  try {
    const row = await getRestaurantById(req.params.id);
    if (!row) return res.status(404).json({ message: "Restaurant not found." });
    return res.json(row);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function createRestaurantHandler(req, res) {
  try {
    const body = req.body;
    if (!body.name || !body.ownerName || !body.email || !body.contact || !body.address || !body.city || !body.state || !body.pincode) {
      return res.status(400).json({ message: "Required fields are missing." });
    }

    const plan = body.plan || "Free";
    const payload = {
      ...body,
      plan,
      restaurantCode: body.restaurantCode || generateRestaurantCode(),
      password: body.password || generatePassword(),
      subscriptionStartDate: plan === "Free" ? null : normalizeDateInput(body.subscriptionStartDate),
      subscriptionEndDate: plan === "Free" ? null : normalizeDateInput(body.subscriptionEndDate)
    };

    const id = await createRestaurant(payload);
    await addActivity("restaurant_added", `${body.name} added with ${plan} plan`);
    const row = await getRestaurantById(id);
    return res.status(201).json(row);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function updateRestaurantHandler(req, res) {
  try {
    const body = req.body;
    const plan = body.plan || "Free";
    const payload = {
      ...body,
      plan,
      subscriptionStartDate: plan === "Free" ? null : normalizeDateInput(body.subscriptionStartDate),
      subscriptionEndDate: plan === "Free" ? null : normalizeDateInput(body.subscriptionEndDate)
    };

    await updateRestaurant(req.params.id, payload);
    const row = await getRestaurantById(req.params.id);
    if (!row) return res.status(404).json({ message: "Restaurant not found." });
    await addActivity("restaurant_updated", `Restaurant ${body.name} updated`);
    return res.json(row);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function toggleStatus(req, res) {
  try {
    const row = await getRestaurantById(req.params.id);
    if (!row) return res.status(404).json({ message: "Restaurant not found." });
    const nextActive = row.active ? 0 : 1;
    await toggleRestaurantStatus(req.params.id, nextActive);
    await addActivity("restaurant_status", `${row.name} marked as ${nextActive ? "active" : "inactive"}`);
    return res.json({ success: true, active: Boolean(nextActive) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function deleteRestaurantHandler(req, res) {
  try {
    const row = await getRestaurantById(req.params.id);
    if (!row) return res.status(404).json({ message: "Restaurant not found." });
    await deleteRestaurantOrders(req.params.id);
    await deleteRestaurant(req.params.id);
    await addActivity("restaurant_deleted", `${row.name} deleted`);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function loginAsRestaurant(req, res) {
  try {
    const row = await getRestaurantForLoginAs(req.params.id);
    if (!row) return res.status(404).json({ message: "Restaurant not found." });
    if (!row.active) return res.status(400).json({ message: "Restaurant is disabled." });
    return res.json({
      success: true,
      token: `admin-${row.restaurant_code}-${Date.now()}`,
      redirectPath: `/admin?restaurant=${row.restaurant_code}`,
      restaurant: row
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  listRestaurants,
  getRestaurant,
  createRestaurantHandler,
  updateRestaurantHandler,
  toggleStatus,
  deleteRestaurantHandler,
  loginAsRestaurant
};
