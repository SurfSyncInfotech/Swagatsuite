const pool = require("../db/pool");

async function getRestaurantByCode(restaurantCode) {
  const [rows] = await pool.query(
    "SELECT id FROM restaurants WHERE restaurant_code = ? LIMIT 1",
    [restaurantCode]
  );
  return rows[0] || null;
}

async function listCategories(restaurantId) {
  const [rows] = await pool.query(
    "SELECT id, name FROM menu_categories WHERE restaurant_id = ? ORDER BY name ASC",
    [restaurantId]
  );
  return rows;
}

async function createCategory(restaurantId, name) {
  const [result] = await pool.query(
    "INSERT INTO menu_categories (restaurant_id, name) VALUES (?, ?)",
    [restaurantId, name]
  );
  return result.insertId;
}

async function updateCategory(restaurantId, categoryId, name) {
  const [result] = await pool.query(
    "UPDATE menu_categories SET name = ? WHERE id = ? AND restaurant_id = ?",
    [name, categoryId, restaurantId]
  );
  return result.affectedRows;
}

async function deleteCategory(restaurantId, categoryId) {
  const [result] = await pool.query(
    "DELETE FROM menu_categories WHERE id = ? AND restaurant_id = ?",
    [categoryId, restaurantId]
  );
  return result.affectedRows;
}

async function listItems(restaurantId, search, availability) {
  const filters = ["mi.restaurant_id = ?"];
  const params = [restaurantId];

  if (search) {
    filters.push("(LOWER(mi.name) LIKE ? OR LOWER(mc.name) LIKE ?)");
    params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
  }

  if (availability === "available") {
    filters.push("mi.available = 1");
  } else if (availability === "out") {
    filters.push("mi.available = 0");
  }

  const [rows] = await pool.query(
    `
    SELECT
      mi.id,
      mi.name,
      mi.price,
      mi.description,
      mi.image_url,
      mi.available,
      mi.category_id,
      mc.name AS category
    FROM menu_items mi
    INNER JOIN menu_categories mc
      ON mc.id = mi.category_id
      AND mc.restaurant_id = mi.restaurant_id
    WHERE ${filters.join(" AND ")}
    ORDER BY mi.id DESC
    `,
    params
  );
  return rows;
}

async function createItem(restaurantId, payload) {
  const [result] = await pool.query(
    `
    INSERT INTO menu_items (restaurant_id, category_id, name, price, description, image_url, available)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      restaurantId,
      payload.categoryId,
      payload.name,
      payload.price,
      payload.description || null,
      payload.imageUrl,
      payload.available ? 1 : 0
    ]
  );
  return result.insertId;
}

async function updateItem(restaurantId, itemId, payload) {
  const [result] = await pool.query(
    `
    UPDATE menu_items
    SET category_id = ?, name = ?, price = ?, description = ?, image_url = ?, available = ?
    WHERE id = ? AND restaurant_id = ?
    `,
    [
      payload.categoryId,
      payload.name,
      payload.price,
      payload.description || null,
      payload.imageUrl,
      payload.available ? 1 : 0,
      itemId,
      restaurantId
    ]
  );
  return result.affectedRows;
}

async function deleteItem(restaurantId, itemId) {
  const [result] = await pool.query(
    "DELETE FROM menu_items WHERE id = ? AND restaurant_id = ?",
    [itemId, restaurantId]
  );
  return result.affectedRows;
}

async function updateItemAvailability(restaurantId, itemId, available) {
  const [result] = await pool.query(
    "UPDATE menu_items SET available = ? WHERE id = ? AND restaurant_id = ?",
    [available ? 1 : 0, itemId, restaurantId]
  );
  return result.affectedRows;
}

async function updateItemPrice(restaurantId, itemId, price) {
  const [result] = await pool.query(
    "UPDATE menu_items SET price = ? WHERE id = ? AND restaurant_id = ?",
    [price, itemId, restaurantId]
  );
  return result.affectedRows;
}

module.exports = {
  getRestaurantByCode,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listItems,
  createItem,
  updateItem,
  deleteItem,
  updateItemAvailability,
  updateItemPrice
};
