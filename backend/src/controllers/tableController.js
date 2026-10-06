const {
  getRestaurantByCode,
  listTables,
  createTable,
  bulkCreateTables,
  renameTable,
  setTableActive,
  deleteTable
} = require("../models/tableModel");

async function resolveRestaurant(req, res) {
  const restaurantCode = String(req.params.restaurantCode || "").trim();
  if (!restaurantCode) {
    res.status(400).json({ message: "Restaurant code is required." });
    return null;
  }
  const restaurant = await getRestaurantByCode(restaurantCode);
  if (!restaurant) {
    res.status(404).json({ message: "Restaurant not found." });
    return null;
  }
  return restaurant;
}

async function getTables(req, res) {
  try {
    const restaurant = await resolveRestaurant(req, res);
    if (!restaurant) return;
    return res.json(await listTables(restaurant.id));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function addTable(req, res) {
  try {
    const restaurant = await resolveRestaurant(req, res);
    if (!restaurant) return;
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ message: "Table name is required." });
    const table = await createTable(restaurant.id, name);
    return res.status(201).json(table);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function addTablesBulk(req, res) {
  try {
    const restaurant = await resolveRestaurant(req, res);
    if (!restaurant) return;
    const count = Number(req.body?.count || 0);
    if (!count || count < 1 || count > 200) {
      return res.status(400).json({ message: "Count must be between 1 and 200." });
    }
    await bulkCreateTables(restaurant.id, count);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function updateTableName(req, res) {
  try {
    const restaurant = await resolveRestaurant(req, res);
    if (!restaurant) return;
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ message: "Table name is required." });
    const updated = await renameTable(restaurant.id, Number(req.params.tableId), name);
    if (!updated) return res.status(404).json({ message: "Table not found." });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function toggleTable(req, res) {
  try {
    const restaurant = await resolveRestaurant(req, res);
    if (!restaurant) return;
    const updated = await setTableActive(
      restaurant.id,
      Number(req.params.tableId),
      Boolean(req.body?.active)
    );
    if (!updated) return res.status(404).json({ message: "Table not found." });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function removeTable(req, res) {
  try {
    const restaurant = await resolveRestaurant(req, res);
    if (!restaurant) return;
    const deleted = await deleteTable(restaurant.id, Number(req.params.tableId));
    if (!deleted) return res.status(404).json({ message: "Table not found." });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  getTables,
  addTable,
  addTablesBulk,
  updateTableName,
  toggleTable,
  removeTable
};
