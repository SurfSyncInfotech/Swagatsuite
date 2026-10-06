const {
  getRestaurantByCode,
  getTableByToken,
  getMenuItems,
  getMenuItemsByIds,
  createOrder,
  getOrderForTable
} = require("../models/publicMenuModel");
const { awardStampForCompletedOrder, STAMP_ELIGIBLE_STATUSES, hasStampForOrder, normalizePhone, getLoyaltyByPhone } = require("../models/loyaltyModel");

function isValidEmail(value) {
  const s = String(value || "").trim();
  if (!s) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function getQrMenu(req, res) {
  try {
    const restaurantCode = String(req.query?.restaurant || "").trim();
    const token = String(req.query?.token || "").trim();
    if (!restaurantCode || !token) {
      return res.status(400).json({ message: "Restaurant and table token are required." });
    }

    const restaurant = await getRestaurantByCode(restaurantCode);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found." });

    const table = await getTableByToken(restaurant.id, token);
    if (!table || !table.active) {
      return res.status(403).json({ message: "This table QR is inactive." });
    }

    const items = await getMenuItems(restaurant.id);
    return res.json({
      restaurant: {
        code: restaurantCode,
        name: restaurant.name,
        logoUrl: restaurant.logo_url || "",
        address: restaurant.address || "",
        city: restaurant.city || "",
        state: restaurant.state || "",
        pincode: restaurant.pincode || "",
        gst_number: restaurant.gst_number || ""
      },
      table: {
        id: table.id,
        name: table.table_name
      },
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        description: item.description || "",
        imageUrl: item.image_url || "",
        available: Boolean(item.available),
        category: item.category
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function placeQrOrder(req, res) {
  try {
    const restaurantCode = String(req.body?.restaurantCode || "").trim();
    const token = String(req.body?.token || "").trim();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const customerName = String(req.body?.customerName || "").trim();
    const customerPhone = normalizePhone(req.body?.customerPhone);
    const customerEmail = String(req.body?.customerEmail || "").trim();

    if (!restaurantCode || !token || !items.length) {
      return res.status(400).json({ message: "Restaurant, token and items are required." });
    }
    if (!customerName || customerName.length < 2) {
      return res.status(400).json({ message: "Please enter your name." });
    }
    if (customerPhone.length < 10) {
      return res.status(400).json({ message: "Please enter a valid contact number (at least 10 digits)." });
    }
    if (!customerEmail) {
      return res.status(400).json({ message: "Please enter your email address." });
    }
    if (!isValidEmail(customerEmail)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    const restaurant = await getRestaurantByCode(restaurantCode);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found." });
    const table = await getTableByToken(restaurant.id, token);
    if (!table || !table.active) {
      return res.status(403).json({ message: "This table QR is inactive." });
    }

    const itemIds = items.map((item) => Number(item.itemId)).filter((id) => id > 0);
    const dbItems = await getMenuItemsByIds(restaurant.id, itemIds);
    const dbMap = new Map(dbItems.map((item) => [item.id, item]));

    let total = 0;
    const lineItems = [];
    for (const reqItem of items) {
      const qty = Number(reqItem.qty || 0);
      const dbItem = dbMap.get(Number(reqItem.itemId));
      if (!dbItem || !dbItem.available || qty <= 0) {
        return res.status(400).json({ message: "One or more items are invalid or unavailable." });
      }
      const unit = Number(dbItem.price);
      const lineTotal = unit * qty;
      total += lineTotal;
      lineItems.push({
        itemId: dbItem.id,
        name: dbItem.name,
        qty,
        unitPrice: unit,
        lineTotal: Number(lineTotal.toFixed(2))
      });
    }
    if (!total) return res.status(400).json({ message: "Order total is invalid." });

    const itemsJson = JSON.stringify(lineItems);

    const orderId = await createOrder({
      restaurantId: restaurant.id,
      amount: total,
      tableId: table.id,
      tableLabel: table.table_name,
      customerName,
      customerPhone,
      customerEmail: customerEmail || null,
      itemsJson
    });
    return res.status(201).json({
      success: true,
      orderId,
      amount: Number(total.toFixed(2)),
      table: table.table_name,
      status: "Placed",
      message: `Order from ${table.table_name} placed successfully.`
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function getQrOrderStatus(req, res) {
  try {
    const orderId = Number(req.params?.orderId);
    const restaurantCode = String(req.query?.restaurant || "").trim();
    const token = String(req.query?.token || "").trim();
    if (!orderId || !restaurantCode || !token) {
      return res.status(400).json({ message: "Order id, restaurant and token are required." });
    }

    const row = await getOrderForTable(orderId, restaurantCode, token);
    if (!row) return res.status(404).json({ message: "Order not found." });

    let items = [];
    try {
      if (row.items_json) {
        const raw =
          typeof row.items_json === "string"
            ? row.items_json
            : Buffer.isBuffer(row.items_json)
              ? row.items_json.toString("utf8")
              : String(row.items_json);
        const parsed = JSON.parse(raw);
        items = Array.isArray(parsed) ? parsed : [];
      }
    } catch (_e) {
      items = [];
    }

    if (STAMP_ELIGIBLE_STATUSES.includes(String(row.status || ""))) {
      try {
        await awardStampForCompletedOrder(restaurantCode, orderId);
      } catch (loyaltyErr) {
        console.error("[loyalty] stamp on order poll failed:", loyaltyErr.message);
      }
    }

    const stampCredited = await hasStampForOrder(orderId);

    const phoneQuery = normalizePhone(req.query?.phone);
    let loyalty = null;
    if (phoneQuery.length >= 10) {
      try {
        loyalty = await getLoyaltyByPhone(restaurantCode, phoneQuery);
      } catch (loyaltyErr) {
        console.error("[loyalty] order poll loyalty fetch failed:", loyaltyErr.message);
      }
    }

    return res.json({
      orderId: row.id,
      amount: Number(row.amount),
      status: row.status,
      tableLabel: row.table_label || "",
      createdAt: row.created_at,
      customerName: row.customer_name || "",
      customerPhone: row.customer_phone || "",
      customerEmail: row.customer_email || "",
      items: Array.isArray(items) ? items : [],
      stampCredited,
      stampSessionDone: String(row.status || "") === "Completed",
      loyalty
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  getQrMenu,
  placeQrOrder,
  getQrOrderStatus
};
