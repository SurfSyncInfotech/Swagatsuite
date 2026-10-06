const {
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
} = require("../models/menuModel");

const REALISTIC_MENU_ITEMS = [
  { name: "Paneer Tikka", price: 249, category: "Starters", imageUrl: "https://images.pexels.com/photos/2474661/pexels-photo-2474661.jpeg", description: "Char-grilled paneer cubes with capsicum and onion.", available: true },
  { name: "Veg Seekh Kebab", price: 229, category: "Starters", imageUrl: "https://images.pexels.com/photos/4553111/pexels-photo-4553111.jpeg", description: "Spiced vegetable seekh kebabs served hot.", available: true },
  { name: "Chilli Paneer", price: 239, category: "Starters", imageUrl: "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg", description: "Indo-Chinese style paneer in spicy sauce.", available: true },
  { name: "Corn Cheese Balls", price: 199, category: "Starters", imageUrl: "https://images.pexels.com/photos/461198/pexels-photo-461198.jpeg", description: "Crispy fried corn and cheese balls.", available: true },
  { name: "Hara Bhara Kebab", price: 209, category: "Starters", imageUrl: "https://images.pexels.com/photos/5938/food-salad-healthy-lunch.jpg", description: "Spinach and peas patties with mint dip.", available: true },
  { name: "Paneer Butter Masala", price: 329, category: "Main Course", imageUrl: "https://images.pexels.com/photos/7625056/pexels-photo-7625056.jpeg", description: "Paneer in rich buttery tomato gravy.", available: true },
  { name: "Dal Makhani", price: 279, category: "Main Course", imageUrl: "https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg", description: "Slow-cooked black lentils with cream.", available: true },
  { name: "Veg Biryani", price: 289, category: "Main Course", imageUrl: "https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg", description: "Fragrant basmati rice with vegetables.", available: true },
  { name: "Kadhai Paneer", price: 319, category: "Main Course", imageUrl: "https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg", description: "Paneer with capsicum in kadhai masala.", available: true },
  { name: "Butter Naan Basket", price: 179, category: "Main Course", imageUrl: "https://images.pexels.com/photos/2232/vegetables-italian-pizza-restaurant.jpg", description: "Assorted naan basket served with butter.", available: true },
  { name: "Fresh Lime Soda", price: 99, category: "Beverages", imageUrl: "https://images.pexels.com/photos/96974/pexels-photo-96974.jpeg", description: "Classic sweet and salted lime soda.", available: true },
  { name: "Cold Coffee", price: 149, category: "Beverages", imageUrl: "https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg", description: "Blended coffee with milk and ice cream.", available: true },
  { name: "Masala Chaas", price: 89, category: "Beverages", imageUrl: "https://images.pexels.com/photos/5946631/pexels-photo-5946631.jpeg", description: "Spiced buttermilk for a refreshing finish.", available: true },
  { name: "Virgin Mojito", price: 129, category: "Beverages", imageUrl: "https://images.pexels.com/photos/109275/pexels-photo-109275.jpeg", description: "Mint, lemon and soda cooler.", available: true },
  { name: "Mango Shake", price: 139, category: "Beverages", imageUrl: "https://images.pexels.com/photos/1337825/pexels-photo-1337825.jpeg", description: "Creamy mango milkshake.", available: true },
  { name: "Gulab Jamun", price: 139, category: "Desserts", imageUrl: "https://images.pexels.com/photos/3026808/pexels-photo-3026808.jpeg", description: "Soft jamuns in warm sugar syrup.", available: true },
  { name: "Rasmalai", price: 159, category: "Desserts", imageUrl: "https://images.pexels.com/photos/3026807/pexels-photo-3026807.jpeg", description: "Chenna patties in saffron milk.", available: true },
  { name: "Brownie with Ice Cream", price: 209, category: "Desserts", imageUrl: "https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg", description: "Warm brownie topped with vanilla scoop.", available: true },
  { name: "Kulfi Falooda", price: 189, category: "Desserts", imageUrl: "https://images.pexels.com/photos/2103949/pexels-photo-2103949.jpeg", description: "Traditional kulfi served with falooda.", available: true },
  { name: "Cheesecake Slice", price: 219, category: "Desserts", imageUrl: "https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg", description: "Creamy baked cheesecake portion.", available: true }
];

async function ensureMenuSeed(restaurantId) {
  let categories = await listCategories(restaurantId);
  if (!categories.length) {
    const defaults = ["Starters", "Main Course", "Beverages", "Desserts"];
    for (const name of defaults) {
      await createCategory(restaurantId, name);
    }
    categories = await listCategories(restaurantId);
  }

  const existingItems = await listItems(restaurantId, "", "all");
  const existingNames = new Set(
    existingItems.map((item) => String(item.name || "").trim().toLowerCase())
  );

  const categoryByName = new Map(categories.map((category) => [category.name, category.id]));
  for (const item of REALISTIC_MENU_ITEMS) {
    if (existingNames.has(item.name.toLowerCase())) continue;
    const categoryId = categoryByName.get(item.category);
    if (!categoryId) continue;
    await createItem(restaurantId, {
      categoryId,
      name: item.name,
      price: item.price,
      description: item.description,
      imageUrl: item.imageUrl,
      available: item.available
    });
    existingNames.add(item.name.toLowerCase());
  }
}

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

async function getCategories(req, res) {
  try {
    const restaurant = await resolveRestaurant(req, res);
    if (!restaurant) return;
    await ensureMenuSeed(restaurant.id);
    const rows = await listCategories(restaurant.id);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function addCategory(req, res) {
  try {
    const restaurant = await resolveRestaurant(req, res);
    if (!restaurant) return;
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ message: "Category name is required." });
    const id = await createCategory(restaurant.id, name);
    return res.status(201).json({ id, name });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function editCategory(req, res) {
  try {
    const restaurant = await resolveRestaurant(req, res);
    if (!restaurant) return;
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ message: "Category name is required." });
    const updated = await updateCategory(restaurant.id, Number(req.params.categoryId), name);
    if (!updated) return res.status(404).json({ message: "Category not found." });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function removeCategory(req, res) {
  try {
    const restaurant = await resolveRestaurant(req, res);
    if (!restaurant) return;
    const deleted = await deleteCategory(restaurant.id, Number(req.params.categoryId));
    if (!deleted) return res.status(404).json({ message: "Category not found." });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function getItems(req, res) {
  try {
    const restaurant = await resolveRestaurant(req, res);
    if (!restaurant) return;
    await ensureMenuSeed(restaurant.id);
    const search = String(req.query?.search || "").trim();
    const availability = String(req.query?.availability || "all").trim();
    const rows = await listItems(restaurant.id, search, availability);
    return res.json(rows.map((row) => ({
      id: row.id,
      name: row.name,
      price: Number(row.price),
      description: row.description || "",
      imageUrl: row.image_url || "",
      available: Boolean(row.available),
      categoryId: row.category_id,
      category: row.category
    })));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function addItem(req, res) {
  try {
    const restaurant = await resolveRestaurant(req, res);
    if (!restaurant) return;
    const payload = {
      name: String(req.body?.name || "").trim(),
      price: Number(req.body?.price || 0),
      categoryId: Number(req.body?.categoryId || 0),
      description: String(req.body?.description || "").trim(),
      imageUrl: String(req.body?.imageUrl || "").trim(),
      available: Boolean(req.body?.available)
    };
    if (!payload.name || !payload.price || !payload.categoryId || !payload.imageUrl) {
      return res.status(400).json({ message: "Missing required item fields." });
    }
    const id = await createItem(restaurant.id, payload);
    return res.status(201).json({ id });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function editItem(req, res) {
  try {
    const restaurant = await resolveRestaurant(req, res);
    if (!restaurant) return;
    const payload = {
      name: String(req.body?.name || "").trim(),
      price: Number(req.body?.price || 0),
      categoryId: Number(req.body?.categoryId || 0),
      description: String(req.body?.description || "").trim(),
      imageUrl: String(req.body?.imageUrl || "").trim(),
      available: Boolean(req.body?.available)
    };
    if (!payload.name || !payload.price || !payload.categoryId || !payload.imageUrl) {
      return res.status(400).json({ message: "Missing required item fields." });
    }
    const updated = await updateItem(restaurant.id, Number(req.params.itemId), payload);
    if (!updated) return res.status(404).json({ message: "Item not found." });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function removeItem(req, res) {
  try {
    const restaurant = await resolveRestaurant(req, res);
    if (!restaurant) return;
    const deleted = await deleteItem(restaurant.id, Number(req.params.itemId));
    if (!deleted) return res.status(404).json({ message: "Item not found." });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function patchItemAvailability(req, res) {
  try {
    const restaurant = await resolveRestaurant(req, res);
    if (!restaurant) return;
    const updated = await updateItemAvailability(
      restaurant.id,
      Number(req.params.itemId),
      Boolean(req.body?.available)
    );
    if (!updated) return res.status(404).json({ message: "Item not found." });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function patchItemPrice(req, res) {
  try {
    const restaurant = await resolveRestaurant(req, res);
    if (!restaurant) return;
    const price = Number(req.body?.price || 0);
    if (!price) return res.status(400).json({ message: "Valid price is required." });
    const updated = await updateItemPrice(restaurant.id, Number(req.params.itemId), price);
    if (!updated) return res.status(404).json({ message: "Item not found." });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  getCategories,
  addCategory,
  editCategory,
  removeCategory,
  getItems,
  addItem,
  editItem,
  removeItem,
  patchItemAvailability,
  patchItemPrice
};
