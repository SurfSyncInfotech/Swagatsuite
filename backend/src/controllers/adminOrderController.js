const {
  createInvoiceFromOrder,
  markInvoicePaidForOrder
} = require("../models/invoiceModel");
const { awardStampForCompletedOrder, STAMP_ELIGIBLE_STATUSES } = require("../models/loyaltyModel");
const {
  listOrdersByRestaurantCode,
  updateOrderStatus,
  deleteOrderByRestaurantCode,
  createManualServedOrderByRestaurantCode,
  ORDER_STATUSES
} = require("../models/adminOrderModel");
const pool = require("../db/pool");
const { normalizePhone } = require("../models/loyaltyModel");

function parseItemsJson(raw) {
  if (raw == null || raw === "") return [];
  try {
    const text =
      typeof raw === "string"
        ? raw
        : typeof Buffer !== "undefined" && Buffer.isBuffer(raw)
          ? raw.toString("utf8")
          : String(raw);
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

async function getRestaurantOrders(req, res) {
  try {
    const { restaurantCode } = req.params;
    if (!restaurantCode) return res.status(400).json({ message: "Restaurant code required." });

    const result = await listOrdersByRestaurantCode(restaurantCode);
    if (!result) return res.status(404).json({ message: "Restaurant not found." });

    return res.json({
      orders: result.orders.map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        status: row.status,
        tableId: row.tableId ?? row.table_id ?? null,
        tableLabel: row.tableLabel ?? row.table_label ?? "",
        createdAt: row.createdAt ?? row.created_at,
        customerName: row.customerName ?? row.customer_name ?? "",
        customerPhone: row.customerPhone ?? row.customer_phone ?? "",
        customerEmail: row.customerEmail ?? row.customer_email ?? "",
        items: parseItemsJson(row.itemsJson ?? row.items_json)
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function patchRestaurantOrderStatus(req, res) {
  try {
    const { restaurantCode, orderId } = req.params;
    const status = String(req.body?.status || "").trim();
    if (!restaurantCode || !orderId) {
      return res.status(400).json({ message: "Restaurant code and order id are required." });
    }
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${ORDER_STATUSES.join(", ")}` });
    }

    const result = await updateOrderStatus(restaurantCode, Number(orderId), status);
    if (!result.ok) return res.status(404).json({ message: "Order not found." });

    if (status === "Completed") {
      try {
        const [restRows] = await pool.query(
          "SELECT id FROM restaurants WHERE restaurant_code = ? LIMIT 1",
          [restaurantCode]
        );
        if (restRows[0]?.id) {
          await markInvoicePaidForOrder(restRows[0].id, Number(orderId));
        }
      } catch (payErr) {
        console.error("[invoice] auto-mark paid on complete failed:", payErr.message);
      }
    }

    let loyaltyStamp = null;
    if (STAMP_ELIGIBLE_STATUSES.includes(status)) {
      try {
        loyaltyStamp = await awardStampForCompletedOrder(restaurantCode, Number(orderId));
      } catch (loyaltyErr) {
        console.error("[loyalty] stamp award on status update failed:", loyaltyErr.message);
        loyaltyStamp = { awarded: false, error: loyaltyErr.message };
      }
    }

    return res.json({ success: true, status, loyaltyStamp });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function deleteRestaurantOrder(req, res) {
  try {
    const { restaurantCode, orderId } = req.params;
    if (!restaurantCode || !orderId) {
      return res.status(400).json({ message: "Restaurant code and order id are required." });
    }
    const result = await deleteOrderByRestaurantCode(restaurantCode, Number(orderId));
    if (!result.ok) return res.status(404).json({ message: "Order not found." });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  getRestaurantOrders,
  patchRestaurantOrderStatus,
  deleteRestaurantOrder,
  createManualServedOrder
};

async function createManualServedOrder(req, res) {
  try {
    const { restaurantCode } = req.params;
    if (!restaurantCode) return res.status(400).json({ message: "Restaurant code required." });

    const tableLabel = String(req.body?.tableLabel || "").trim();
    const customerName = String(req.body?.customerName || "").trim();
    const customerPhone = normalizePhone(req.body?.customerPhone);
    const customerEmail = String(req.body?.customerEmail || "").trim();
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!rawItems.length) return res.status(400).json({ message: "At least 1 item is required." });

    const items = rawItems.map((line) => {
      const name = String(line?.name || "").trim() || "Item";
      const qty = Math.max(1, Number(line?.qty || 1));
      const unitPrice = Math.max(0, Number(line?.unitPrice ?? line?.price ?? 0));
      const lineTotal = Number((qty * unitPrice).toFixed(2));
      return { itemId: 0, name, qty, unitPrice, lineTotal };
    });
    const subTotal = items.reduce((sum, row) => sum + Number(row.lineTotal || 0), 0);
    if (!subTotal) return res.status(400).json({ message: "Order total is invalid." });

    const created = await createManualServedOrderByRestaurantCode(restaurantCode, {
      amount: subTotal,
      tableLabel: tableLabel || null,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      customerEmail: customerEmail || null,
      itemsJson: JSON.stringify(items)
    });
    if (!created) return res.status(404).json({ message: "Restaurant not found." });

    // Immediately generate invoice using existing flow
    const invoice = await createInvoiceFromOrder(created.restaurantId, created.orderId);
    if (!invoice) return res.status(500).json({ message: "Invoice could not be created." });

    return res.status(201).json({ success: true, orderId: created.orderId, invoice });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}
