const { addActivity } = require("../models/activityModel");
const {
  getAllPlans,
  createPlan,
  updatePlan,
  assignPlanToRestaurant
} = require("../models/planModel");
const { getRestaurantById } = require("../models/restaurantModel");

function normalizeDateInput(value) {
  if (!value) return null;
  const asString = String(value);
  return asString.includes("T") ? asString.slice(0, 10) : asString;
}

async function listPlans(_req, res) {
  try {
    const plans = await getAllPlans();
    return res.json(plans);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function createPlanHandler(req, res) {
  try {
    const { name, price, currency = "INR", features = [] } = req.body;
    if (!name) return res.status(400).json({ message: "Plan name is required." });
    const planId = await createPlan({ name, price: Number(price || 0), currency, features });
    await addActivity("plan_created", `${name} plan created`);
    const plans = await getAllPlans();
    return res.status(201).json(plans.find((plan) => plan.id === planId));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function updatePlanHandler(req, res) {
  try {
    const { name, price, currency = "INR", features = [], isActive = true } = req.body;
    if (!name) return res.status(400).json({ message: "Plan name is required." });
    await updatePlan(req.params.id, { name, price: Number(price || 0), currency, features, isActive });
    await addActivity("plan_updated", `${name} plan updated`);
    const plans = await getAllPlans();
    return res.json(plans.find((plan) => String(plan.id) === String(req.params.id)));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function assignPlanHandler(req, res) {
  try {
    const { restaurantId, planName, startDate, endDate } = req.body;
    if (!restaurantId || !planName) {
      return res.status(400).json({ message: "Restaurant and plan are required." });
    }
    const restaurant = await getRestaurantById(restaurantId);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found." });

    const useDates = String(planName).toLowerCase() !== "free";
    await assignPlanToRestaurant({
      restaurantId,
      planName,
      startDate: useDates ? normalizeDateInput(startDate) : null,
      endDate: useDates ? normalizeDateInput(endDate) : null
    });
    await addActivity("plan_assigned", `${planName} assigned to ${restaurant.name}`);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  listPlans,
  createPlanHandler,
  updatePlanHandler,
  assignPlanHandler
};
