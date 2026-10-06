const pool = require("../db/pool");
const { APP_STATE, DB_CONFIG } = require("../config/constants");
const { upsertConfigValue, getConfigValue } = require("../models/configModel");
const { addActivity } = require("../models/activityModel");
const {
  getRestaurantsMissingCode,
  backfillRestaurantCodeAndPassword
} = require("../models/restaurantModel");
const { generatePassword, generateRestaurantCode } = require("../utils/generators");

const REALISTIC_MENU_ITEMS = [
  { name: "Paneer Tikka", price: 249, category: "Starters", imageUrl: "https://images.pexels.com/photos/2474661/pexels-photo-2474661.jpeg", description: "Char-grilled paneer cubes with capsicum and onion.", available: 1 },
  { name: "Veg Seekh Kebab", price: 229, category: "Starters", imageUrl: "https://images.pexels.com/photos/4553111/pexels-photo-4553111.jpeg", description: "Spiced vegetable seekh kebabs served hot.", available: 1 },
  { name: "Chilli Paneer", price: 239, category: "Starters", imageUrl: "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg", description: "Indo-Chinese style paneer in spicy sauce.", available: 1 },
  { name: "Corn Cheese Balls", price: 199, category: "Starters", imageUrl: "https://images.pexels.com/photos/461198/pexels-photo-461198.jpeg", description: "Crispy fried corn and cheese balls.", available: 1 },
  { name: "Hara Bhara Kebab", price: 209, category: "Starters", imageUrl: "https://images.pexels.com/photos/5938/food-salad-healthy-lunch.jpg", description: "Spinach and peas patties with mint dip.", available: 1 },

  { name: "Paneer Butter Masala", price: 329, category: "Main Course", imageUrl: "https://images.pexels.com/photos/7625056/pexels-photo-7625056.jpeg", description: "Paneer in rich buttery tomato gravy.", available: 1 },
  { name: "Dal Makhani", price: 279, category: "Main Course", imageUrl: "https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg", description: "Slow-cooked black lentils with cream.", available: 1 },
  { name: "Veg Biryani", price: 289, category: "Main Course", imageUrl: "https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg", description: "Fragrant basmati rice with vegetables.", available: 1 },
  { name: "Kadhai Paneer", price: 319, category: "Main Course", imageUrl: "https://images.pexels.com/photos/5560763/pexels-photo-5560763.jpeg", description: "Paneer with capsicum in kadhai masala.", available: 1 },
  { name: "Butter Naan Basket", price: 179, category: "Main Course", imageUrl: "https://images.pexels.com/photos/2232/vegetables-italian-pizza-restaurant.jpg", description: "Assorted naan basket served with butter.", available: 1 },

  { name: "Fresh Lime Soda", price: 99, category: "Beverages", imageUrl: "https://images.pexels.com/photos/96974/pexels-photo-96974.jpeg", description: "Classic sweet and salted lime soda.", available: 1 },
  { name: "Cold Coffee", price: 149, category: "Beverages", imageUrl: "https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg", description: "Blended coffee with milk and ice cream.", available: 1 },
  { name: "Masala Chaas", price: 89, category: "Beverages", imageUrl: "https://images.pexels.com/photos/5946631/pexels-photo-5946631.jpeg", description: "Spiced buttermilk for a refreshing finish.", available: 1 },
  { name: "Virgin Mojito", price: 129, category: "Beverages", imageUrl: "https://images.pexels.com/photos/109275/pexels-photo-109275.jpeg", description: "Mint, lemon and soda cooler.", available: 1 },
  { name: "Mango Shake", price: 139, category: "Beverages", imageUrl: "https://images.pexels.com/photos/1337825/pexels-photo-1337825.jpeg", description: "Creamy mango milkshake.", available: 1 },

  { name: "Gulab Jamun", price: 139, category: "Desserts", imageUrl: "https://images.pexels.com/photos/3026808/pexels-photo-3026808.jpeg", description: "Soft jamuns in warm sugar syrup.", available: 1 },
  { name: "Rasmalai", price: 159, category: "Desserts", imageUrl: "https://images.pexels.com/photos/3026807/pexels-photo-3026807.jpeg", description: "Chenna patties in saffron milk.", available: 1 },
  { name: "Brownie with Ice Cream", price: 209, category: "Desserts", imageUrl: "https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg", description: "Warm brownie topped with vanilla scoop.", available: 1 },
  { name: "Kulfi Falooda", price: 189, category: "Desserts", imageUrl: "https://images.pexels.com/photos/2103949/pexels-photo-2103949.jpeg", description: "Traditional kulfi served with falooda.", available: 1 },
  { name: "Cheesecake Slice", price: 219, category: "Desserts", imageUrl: "https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg", description: "Creamy baked cheesecake portion.", available: 1 }
];

async function addColumnIfMissing(tableName, columnName, definition) {
  const [rows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    `,
    [DB_CONFIG.database, tableName, columnName]
  );
  if (!Number(rows[0].total)) {
    await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function backfillRestaurantCodes() {
  const rows = await getRestaurantsMissingCode();
  for (const row of rows) {
    await backfillRestaurantCodeAndPassword(row.id, generateRestaurantCode(), generatePassword());
  }
}

async function seedData() {
  const [restaurantCountRows] = await pool.query("SELECT COUNT(*) AS total FROM restaurants");
  const restaurantCount = Number(restaurantCountRows[0].total || 0);

  if (restaurantCount === 0) {
    const sampleRestaurants = [
      [generateRestaurantCode(), "Spice Garden", "Aarav", "spice@restro.com", "+919990000001", generatePassword(), "MG Road, Bengaluru", "Bengaluru", "Karnataka", "560001", "29ABCDE1234F1Z5", "Pro", "2026-01-01", "2026-12-31", 1],
      [generateRestaurantCode(), "Urban Tawa", "Sana", "urban@restro.com", "+919990000002", generatePassword(), "Connaught Place, Delhi", "New Delhi", "Delhi", "110001", "", "Basic", "2026-02-01", "2026-11-30", 1],
      [generateRestaurantCode(), "Cafe Mint", "Ishaan", "mint@restro.com", "+919990000003", generatePassword(), "Bandra West, Mumbai", "Mumbai", "Maharashtra", "400050", "", "Free", null, null, 1],
      [generateRestaurantCode(), "Royal Dine", "Mira", "royal@restro.com", "+919990000004", generatePassword(), "Civil Lines, Jaipur", "Jaipur", "Rajasthan", "302006", "08ABCDE1234F1Z7", "Pro", "2026-01-10", "2027-01-09", 1],
      [generateRestaurantCode(), "Tandoor Hub", "Kabir", "tandoor@restro.com", "+919990000005", generatePassword(), "Bopal, Ahmedabad", "Ahmedabad", "Gujarat", "380058", "", "Basic", "2026-01-01", "2026-06-30", 0]
    ];

    await pool.query(
      `
      INSERT INTO restaurants (
        restaurant_code, name, owner_name, email, contact, password, address, city, state, pincode, gst_number,
        plan, subscription_start_date, subscription_end_date, active
      ) VALUES ?
      `,
      [sampleRestaurants]
    );

    const [restaurantRows] = await pool.query("SELECT id FROM restaurants");
    const orders = [];
    for (const row of restaurantRows) {
      for (let i = 0; i < 12; i += 1) {
        const amount = (Math.random() * 1400 + 200).toFixed(2);
        const statuses = ["Placed", "Preparing", "Ready", "Served", "Completed"];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        orders.push([row.id, amount, status]);
      }
    }

    await pool.query("INSERT INTO orders (restaurant_id, amount, status) VALUES ?", [orders]);
    await addActivity("restaurant_added", "Spice Garden onboarded with Pro plan");
    await addActivity("plan_upgraded", "Urban Tawa upgraded from Free to Basic");
    await addActivity("high_order", "Royal Dine received a large order worth INR 5,450");
    await addActivity("restaurant_added", "Cafe Mint started on Free plan");
  }

  const [planCountRows] = await pool.query("SELECT COUNT(*) AS total FROM plans");
  if (!Number(planCountRows[0].total || 0)) {
    await pool.query(
      `
      INSERT INTO plans (name, price, currency, features_json, is_active)
      VALUES
      ('Free', 0, 'INR', '["Basic dashboard","Up to 50 orders/month"]', 1),
      ('Basic', 999, 'INR', '["Unlimited orders","Menu management","Table QR generation"]', 1),
      ('Pro', 2499, 'INR', '["Everything in Basic","Advanced analytics","Priority support","Online payments"]', 1)
      `
    );
  }

  const password = await getConfigValue("superadmin_password");
  if (!password) {
    await upsertConfigValue("superadmin_password", APP_STATE.superAdminPassword);
  }

  const [restaurantRows] = await pool.query("SELECT id FROM restaurants");
  for (const restaurant of restaurantRows) {
    const [[categoryCountRow]] = await pool.query(
      "SELECT COUNT(*) AS total FROM menu_categories WHERE restaurant_id = ?",
      [restaurant.id]
    );
    if (!Number(categoryCountRow.total || 0)) {
      await pool.query(
        "INSERT INTO menu_categories (restaurant_id, name) VALUES ?",
        [[
          [restaurant.id, "Starters"],
          [restaurant.id, "Main Course"],
          [restaurant.id, "Beverages"],
          [restaurant.id, "Desserts"]
        ]]
      );
    }

    const [[itemCountRow]] = await pool.query(
      "SELECT COUNT(*) AS total FROM menu_items WHERE restaurant_id = ?",
      [restaurant.id]
    );
    if (!Number(itemCountRow.total || 0)) {
      const [categoryRows] = await pool.query(
        "SELECT id, name FROM menu_categories WHERE restaurant_id = ?",
        [restaurant.id]
      );
      const categoryIdByName = new Map(categoryRows.map((row) => [row.name, row.id]));
      const menuItemRows = REALISTIC_MENU_ITEMS
        .map((item) => [
          restaurant.id,
          categoryIdByName.get(item.category),
          item.name,
          item.price,
          item.description,
          item.imageUrl,
          item.available
        ])
        .filter((row) => Number(row[1]));
      if (menuItemRows.length) {
        await pool.query(
          `
          INSERT INTO menu_items (restaurant_id, category_id, name, price, description, image_url, available)
          VALUES ?
          `,
          [menuItemRows]
        );
      }
    }
  }
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_config (
      id INT PRIMARY KEY AUTO_INCREMENT,
      config_key VARCHAR(100) UNIQUE NOT NULL,
      config_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plans (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL UNIQUE,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      features_json TEXT,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INT PRIMARY KEY AUTO_INCREMENT,
      restaurant_code VARCHAR(40) UNIQUE,
      name VARCHAR(120) NOT NULL,
      owner_name VARCHAR(120) NOT NULL,
      email VARCHAR(140),
      contact VARCHAR(30) NOT NULL,
      password VARCHAR(120),
      address VARCHAR(255) NOT NULL,
      city VARCHAR(120),
      state VARCHAR(120),
      pincode VARCHAR(12),
      gst_number VARCHAR(30),
      logo_url LONGTEXT,
      plan VARCHAR(60) NOT NULL DEFAULT 'Free',
      subscription_start_date DATE NULL,
      subscription_end_date DATE NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT PRIMARY KEY AUTO_INCREMENT,
      restaurant_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status ENUM('Placed', 'Preparing', 'Ready', 'Served', 'Completed') NOT NULL DEFAULT 'Placed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activities (
      id INT PRIMARY KEY AUTO_INCREMENT,
      event_type VARCHAR(80) NOT NULL,
      description VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INT PRIMARY KEY AUTO_INCREMENT,
      restaurant_id INT NOT NULL,
      order_id INT NOT NULL,
      invoice_no INT NOT NULL,
      table_label VARCHAR(120) NULL,
      customer_name VARCHAR(120) NULL,
      customer_phone VARCHAR(30) NULL,
      customer_email VARCHAR(140) NULL,
      items_json LONGTEXT NULL,
      sub_total DECIMAL(10,2) NOT NULL DEFAULT 0,
      gst_percent DECIMAL(5,2) NOT NULL DEFAULT 18,
      gst_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      total DECIMAL(10,2) NOT NULL DEFAULT 0,
      payment_mode VARCHAR(40) NOT NULL DEFAULT 'Online',
      payment_status ENUM('Paid','Unpaid') NOT NULL DEFAULT 'Unpaid',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_invoice_order (order_id),
      UNIQUE KEY unique_invoice_no_per_restaurant (restaurant_id, invoice_no),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_categories (
      id INT PRIMARY KEY AUTO_INCREMENT,
      restaurant_id INT NOT NULL,
      name VARCHAR(120) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_category_per_restaurant (restaurant_id, name),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INT PRIMARY KEY AUTO_INCREMENT,
      restaurant_id INT NOT NULL,
      category_id INT NOT NULL,
      name VARCHAR(160) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      description TEXT,
      image_url LONGTEXT NOT NULL,
      available TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE CASCADE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id INT PRIMARY KEY AUTO_INCREMENT,
      restaurant_id INT NOT NULL,
      table_name VARCHAR(120) NOT NULL,
      qr_token VARCHAR(80) NOT NULL UNIQUE,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_table_name_per_restaurant (restaurant_id, table_name),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS landing_leads (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      restaurant_name VARCHAR(160) NOT NULL,
      phone VARCHAR(30) NOT NULL,
      email VARCHAR(160) NOT NULL,
      source VARCHAR(80) NOT NULL DEFAULT 'landing_page',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INT PRIMARY KEY AUTO_INCREMENT,
      restaurant_id INT NOT NULL,
      order_id INT NOT NULL UNIQUE,
      table_id INT NULL,
      customer_name VARCHAR(120) NULL,
      rating TINYINT NOT NULL,
      comment TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_loyalty (
      id INT PRIMARY KEY AUTO_INCREMENT,
      restaurant_id INT NOT NULL,
      customer_phone VARCHAR(20) NOT NULL,
      stamps_in_cycle TINYINT UNSIGNED NOT NULL DEFAULT 0,
      rewards_pending INT UNSIGNED NOT NULL DEFAULT 0,
      total_stamps_earned INT UNSIGNED NOT NULL DEFAULT 0,
      total_rewards_earned INT UNSIGNED NOT NULL DEFAULT 0,
      total_rewards_redeemed INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_loyalty_phone (restaurant_id, customer_phone),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS loyalty_stamp_orders (
      id INT PRIMARY KEY AUTO_INCREMENT,
      restaurant_id INT NOT NULL,
      loyalty_id INT NOT NULL,
      order_id INT NOT NULL,
      customer_phone VARCHAR(20) NOT NULL,
      stamp_number TINYINT UNSIGNED NOT NULL,
      reward_unlocked TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_stamp_order (order_id),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
      FOREIGN KEY (loyalty_id) REFERENCES customer_loyalty(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_requests (
      id INT PRIMARY KEY AUTO_INCREMENT,
      restaurant_id INT NOT NULL,
      table_id INT NOT NULL,
      request_type ENUM('water','tissue','waiter') NOT NULL,
      status ENUM('Pending','Acknowledged','Completed') NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      acknowledged_at TIMESTAMP NULL,
      completed_at TIMESTAMP NULL,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
      FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE CASCADE
    )
  `);

  await addColumnIfMissing("restaurants", "restaurant_code", "VARCHAR(40) UNIQUE");
  await addColumnIfMissing("restaurants", "email", "VARCHAR(140)");
  await addColumnIfMissing("restaurants", "password", "VARCHAR(120)");
  await addColumnIfMissing("restaurants", "city", "VARCHAR(120)");
  await addColumnIfMissing("restaurants", "state", "VARCHAR(120)");
  await addColumnIfMissing("restaurants", "pincode", "VARCHAR(12)");
  await addColumnIfMissing("restaurants", "gst_number", "VARCHAR(30)");
  await addColumnIfMissing("restaurants", "logo_url", "LONGTEXT");
  await pool.query("ALTER TABLE restaurants MODIFY COLUMN logo_url LONGTEXT");
  await addColumnIfMissing("restaurants", "subscription_start_date", "DATE NULL");
  await addColumnIfMissing("restaurants", "subscription_end_date", "DATE NULL");
  await addColumnIfMissing("restaurants", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
  await addColumnIfMissing("orders", "table_id", "INT NULL");
  await addColumnIfMissing("orders", "table_label", "VARCHAR(120) NULL");
  await addColumnIfMissing("orders", "customer_name", "VARCHAR(120) NULL");
  await addColumnIfMissing("orders", "customer_phone", "VARCHAR(30) NULL");
  await addColumnIfMissing("orders", "customer_email", "VARCHAR(140) NULL");
  await addColumnIfMissing("orders", "items_json", "LONGTEXT NULL");
  await addColumnIfMissing("landing_leads", "business_type", "VARCHAR(80) NULL");
  await addColumnIfMissing("landing_leads", "outlet_count", "VARCHAR(80) NULL");
  await addColumnIfMissing("landing_leads", "challenge", "VARCHAR(80) NULL");
  await addColumnIfMissing("landing_leads", "order_method", "VARCHAR(80) NULL");
  await addColumnIfMissing("landing_leads", "implement_timeline", "VARCHAR(80) NULL");
  await addColumnIfMissing("landing_leads", "demo_interest", "VARCHAR(80) NULL");
  await addColumnIfMissing("landing_leads", "website_status", "VARCHAR(80) NULL");
  await addColumnIfMissing("landing_leads", "whatsapp_step", "VARCHAR(30) NOT NULL DEFAULT 'pending'");
  await addColumnIfMissing("landing_leads", "whatsapp_last_error", "TEXT NULL");
  await pool.query("ALTER TABLE restaurants MODIFY COLUMN plan VARCHAR(60) NOT NULL DEFAULT 'Free'");

  await seedData();
  await backfillRestaurantCodes();
}

module.exports = {
  initDb
};
