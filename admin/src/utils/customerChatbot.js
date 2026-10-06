import { findAllMenuItemsInQuery } from "./hindiMenuMatching";
import { LOYALTY_ENABLED } from "../config/features";

function formatInr(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

function normalizeQuery(query) {
  return String(query || "")
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, words) {
  return words.some((w) => text.includes(w));
}

const GREETING_WORDS = [
  "hello",
  "hi",
  "hey",
  "hii",
  "helo",
  "namaste",
  "namaskar",
  "pranam",
  "नमस्ते",
  "नमस्कार",
  "प्रणाम",
  "स्वागत",
  "हेलो",
  "हाय",
  "हैलो"
];

export function detectChatLanguage(text) {
  const raw = String(text || "");
  if (/[\u0900-\u097F]/.test(raw)) return "hi";
  const q = normalizeQuery(raw);
  const hindiHints = [
    "namaste",
    "namaskar",
    "pranam",
    "kya",
    "hai",
    "mujhe",
    "chahiye",
    "dikhao",
    "dikhaiye",
    "khana",
    "bill",
    "aap",
    "kaise",
    "kripya",
    "dhanyavad",
    "shukriya",
    "menu",
    "order",
    "status"
  ];
  if (hindiHints.some((w) => q.includes(w))) return "hi";
  return "en";
}

export function getProfessionalWelcome(restaurantName, lang = "en") {
  const name = restaurantName || (lang === "hi" ? "हमारे रेस्तरां" : "our restaurant");
  if (lang === "hi") {
    return `${name} में आपका हार्दिक स्वागत है। कृपया अपना ऑर्डर बताइए, या यदि आप मेनू और उसके मूल्य जानना चाहते हैं, तो बताइए। मैं आपकी सहायता के लिए उपलब्ध हूँ।`;
  }
  return `Welcome to ${name}. Please tell me your order, or let me know if you would like to see the menu with prices. I am here to assist you.`;
}

export function buildCustomerChatContext({
  restaurant,
  table,
  items,
  cartRows,
  total,
  trackingOrder,
  invoiceData,
  storedOrderId,
  reviewSubmitted,
  categories,
  loyalty
}) {
  const availableItems = (items || []).filter((i) => i.available);
  return {
    restaurant: restaurant || null,
    table: table || null,
    items: availableItems,
    allItems: items || [],
    cartRows: cartRows || [],
    cartTotal: Number(total || 0),
    trackingOrder: trackingOrder || null,
    invoiceData: invoiceData || null,
    storedOrderId: storedOrderId || null,
    reviewSubmitted: Boolean(reviewSubmitted),
    categories: categories || [],
    loyalty: loyalty || null
  };
}

export function getSuggestedQuestions(ctx) {
  const chips = ["What's on the menu?", "Menu prices", "How do I order?"];
  if (ctx.cartRows.length) chips.unshift("What's in my cart?");
  if (ctx.trackingOrder) {
    chips.unshift("Order status?");
    chips.push("When will my order be ready?");
  } else if (ctx.storedOrderId) {
    chips.push("View my order");
  }
  if (ctx.invoiceData) chips.push("Invoice & payment");
  chips.push("Call waiter", "Need water", "Restaurant address");
  return [...new Set(chips)].slice(0, 6);
}

function restaurantAddress(restaurant) {
  if (!restaurant) return "";
  return [restaurant.address, restaurant.city, restaurant.state, restaurant.pincode].filter(Boolean).join(", ");
}

function menuSummary(ctx, limit = 12) {
  const lines = ctx.items.slice(0, limit).map((item) => `• ${item.name} (${item.category}) — ${formatInr(item.price)}`);
  const more = ctx.items.length > limit ? `\n…and ${ctx.items.length - limit} more items. Ask me about a dish by name.` : "";
  return lines.join("\n") + more;
}

function findMenuMatches(ctx, query) {
  const fromMatcher = findAllMenuItemsInQuery(query, ctx.items).map((row) => row.item);
  if (fromMatcher.length) return fromMatcher;

  const raw = String(query || "");
  const aliasRules = [
    { pattern: /काफी|coffee|cafe/i, itemPattern: /coffee|cafe|काफी|latte|espresso/i },
    { pattern: /चाय|chai|tea/i, itemPattern: /tea|chai|चाय/i },
    { pattern: /पानी|water/i, itemPattern: /water|पानी/i }
  ];

  for (const rule of aliasRules) {
    if (!rule.pattern.test(raw)) continue;
    const item = ctx.items.find((row) => rule.itemPattern.test(`${row.name} ${row.description || ""}`));
    if (item) return [item];
  }

  return [];
}

function cartSummary(ctx) {
  if (!ctx.cartRows.length) {
    return "Your cart is empty. Browse the menu, tap + on items, then use **Place order** at the bottom.";
  }
  const lines = ctx.cartRows.map((row) => `• ${row.item.name} × ${row.qty} — ${formatInr(row.item.price * row.qty)}`);
  const count = ctx.cartRows.reduce((s, r) => s + r.qty, 0);
  return `You have ${count} item(s):\n${lines.join("\n")}\n\n**Cart total:** ${formatInr(ctx.cartTotal)}`;
}

function orderStatusReply(ctx) {
  const order = ctx.trackingOrder;
  if (!order) {
    if (ctx.storedOrderId) {
      return {
        text: `You have order **#${ctx.storedOrderId}**. Tap **View my order status** on the menu, or ask me again after opening it.`,
        action: null
      };
    }
    return { text: "You don't have an active order yet. Add items to your cart and tap **Place order**.", action: null };
  }
  const items = (order.items || [])
    .map((line) => `• ${line.name} × ${line.qty} — ${formatInr(line.lineTotal)}`)
    .join("\n");
  return {
    text: [
      `**Order #${order.orderId}** · Table ${order.tableLabel || "—"}`,
      `**Status:** ${order.status}`,
      statusTagline(order.status),
      order.createdAt ? `Placed: ${formatWhen(order.createdAt)}` : "",
      items ? `\n**Items:**\n${items}` : "",
      `\n**Total:** ${formatInr(order.amount)}`
    ]
      .filter(Boolean)
      .join("\n"),
    action: null
  };
}

function statusTagline(status) {
  const map = {
    Placed: "We've received your order.",
    Preparing: "The kitchen is working on it.",
    Ready: "Head to the counter when you're ready to collect.",
    Served: "Enjoy your meal!",
    Completed: "This order is complete."
  };
  return map[status] || "";
}

function invoiceReply(ctx) {
  const inv = ctx.invoiceData;
  if (!inv) {
    return {
      text: "No invoice yet. Invoices are usually created after your order is **Served**. Check back on this page — it updates automatically.",
      action: null
    };
  }
  const lines = (inv.items || []).map((line) => `• ${line.name} × ${line.qty} — ${formatInr(line.lineTotal)}`);
  const paid = inv.paymentStatus === "Paid";
  return {
    text: [
      `**Invoice #${inv.invoiceNo}** for order #${inv.orderId}`,
      `**Payment:** ${inv.paymentStatus}${paid ? "" : " — please pay at the counter"}`,
      lines.length ? `\n**Items:**\n${lines.join("\n")}` : "",
      `**GST (18%):** ${formatInr(inv.gstAmount)}`,
      `**Total:** ${formatInr(inv.total)}`,
      paid
        ? "\nTap **View Invoice** (purple button) → **Download Invoice** for your PDF receipt."
        : "\nAfter paying at the counter, you can download the invoice from **View Invoice**."
    ].join("\n"),
    action: paid ? { type: "openInvoice" } : null
  };
}

function categoriesReply(ctx) {
  const cats = ctx.categories.filter((c) => c !== "all");
  if (!cats.length) return { text: "No categories found yet.", action: null };
  const counts = cats.map((cat) => {
    const n = ctx.items.filter((i) => i.category === cat).length;
    return `• ${cat} (${n} items)`;
  });
  return { text: `**Menu categories:**\n${counts.join("\n")}\n\nAsk e.g. "Show starters" or a dish name.`, action: null };
}

function categoryItemsReply(ctx, query) {
  const cats = ctx.categories.filter((c) => c !== "all");
  const match = cats.find((cat) => query.includes(cat.toLowerCase()));
  if (!match) return null;
  const list = ctx.items.filter((i) => i.category === match);
  if (!list.length) return { text: `No available items in **${match}** right now.`, action: null };
  const lines = list.slice(0, 15).map((item) => `• ${item.name} — ${formatInr(item.price)}`);
  const more = list.length > 15 ? `\n…${list.length - 15} more in this category.` : "";
  return { text: `**${match}:**\n${lines.join("\n")}${more}`, action: null };
}

function helpReply(ctx) {
  const tips = [
    "Browse the menu and use **+ / −** to add items",
    "Tap **Place order** and enter your name, phone & email",
    "Track live status on the order screen",
    "Tap the **bell** (top right) for water, tissue, or waiter",
    ctx.invoiceData ? "Use **View Invoice** for bill & download (when paid)" : null,
    ctx.trackingOrder?.status === "Completed" && !ctx.reviewSubmitted
      ? "When your order is **Completed**, tap **Submit Review**"
      : ctx.trackingOrder && !ctx.reviewSubmitted
        ? "After your order is **Completed**, you can **Submit Review**"
        : null
  ].filter(Boolean);
  return { text: `**I can help with:**\n${tips.map((t) => `• ${t}`).join("\n")}\n\nTry: menu, cart, order status, invoice, call waiter.`, action: null };
}

/**
 * @returns {{ text: string, action: null | { type: string, payload?: string } }}
 */
export function getCustomerChatReply(rawQuery, ctx, langHint) {
  const query = normalizeQuery(rawQuery);
  const lang = langHint || detectChatLanguage(rawQuery);
  if (!query) {
    return {
      text:
        lang === "hi"
          ? "कोई सवाल लिखिए या नीचे सुझाव चुनिए।"
          : "Type a question or tap a suggestion below.",
      action: null
    };
  }

  if (includesAny(query, GREETING_WORDS)) {
    const name = ctx.restaurant?.name || (lang === "hi" ? "हमारे रेस्तरां" : "our restaurant");
    return {
      text: getProfessionalWelcome(name, lang),
      action: null
    };
  }

  if (includesAny(query, ["help", "what can you", "how to use", "commands", "मदद", "सहायता", "क्या कर"])) {
    return helpReply(ctx);
  }

  if (includesAny(query, ["stamp", "stamps", "loyalty", "reward", "free meal", "500"])) {
    if (!LOYALTY_ENABLED) {
      return {
        text:
          lang === "hi"
            ? "स्टैम्प कार्ड अभी उपलब्ध नहीं है।"
            : "The stamp loyalty program is temporarily unavailable.",
        action: null
      };
    }
    const l = ctx.loyalty;
    if (!l?.phone) {
      return {
        text: "Link your **mobile number** in the **Digital stamp card** at the top to track stamps. Complete **5 orders** to unlock a free meal worth **₹500**.",
        action: null
      };
    }
    const pending = l.rewardsPending ?? 0;
    const stamps = l.stampsInCycle ?? 0;
    const per = l.stampsPerReward ?? 5;
    return {
      text: [
        `**Loyalty card:** ${stamps}/${per} stamps in current cycle.`,
        pending > 0
          ? `You have **${pending}** free meal reward${pending > 1 ? "s" : ""} (up to ₹${l.rewardValueInr ?? 500}) — tap **Use at counter** on your stamp card.`
          : `**${per - stamps}** more completed order${per - stamps === 1 ? "" : "s"} until your ₹${l.rewardValueInr ?? 500} reward.`,
        `Lifetime stamps: **${l.totalStampsEarned ?? 0}** · Rewards earned: **${l.totalRewardsEarned ?? 0}**`
      ].join("\n"),
      action: null
    };
  }

  if (includesAny(query, ["water", "drinking", "पानी", "प्यास"])) {
    return {
      text:
        lang === "hi"
          ? "मैंने स्टाफ को **पानी** का अनुरोध भेज दिया है।"
          : "I'll alert staff for **water** at your table. Sending your request now…",
      action: { type: "sendService", payload: "water" }
    };
  }
  if (includesAny(query, ["tissue", "napkin", "टिशू", "नैपकिन"])) {
    return {
      text:
        lang === "hi"
          ? "आपकी टेबल के लिए **टिशू** मंगा दिए गए हैं।"
          : "Requesting **tissues/napkins** for your table…",
      action: { type: "sendService", payload: "tissue" }
    };
  }
  if (includesAny(query, ["waiter", "staff", "server", "call service", "bell", "वेटर", "कर्मचारी", "स्टाफ"])) {
    return {
      text:
        lang === "hi"
          ? "आपकी टेबल के लिए **वेटर** बुलाया जा रहा है।"
          : "Calling a **waiter** to your table…",
      action: { type: "sendService", payload: "waiter" }
    };
  }
  if (includesAny(query, ["service", "assistance"])) {
    return {
      text: "Opening **Call Service** — choose water, tissue, or call waiter.",
      action: { type: "openService" }
    };
  }

  if (includesAny(query, ["address", "location", "where are you", "find you", "पता", "कहाँ", "कहां", "लोकेशन"])) {
    const addr = restaurantAddress(ctx.restaurant);
    return {
      text: addr
        ? `**${ctx.restaurant?.name || "Restaurant"}**\n${addr}${ctx.restaurant?.gst_number ? `\n\nGSTIN: ${ctx.restaurant.gst_number}` : ""}`
        : "Address is not listed for this restaurant. Please ask staff.",
      action: null
    };
  }

  if (includesAny(query, ["gst", "gstin", "tax id"])) {
    const gst = ctx.restaurant?.gst_number;
    return { text: gst ? `GSTIN: **${gst}**` : "GST number is not on file for this restaurant.", action: null };
  }

  if (includesAny(query, ["restaurant name", "who are you", "place name"]) || query === "name") {
    return { text: `You're dining at **${ctx.restaurant?.name || "this restaurant"}**.`, action: null };
  }

  if (includesAny(query, ["table", "which table", "my table"])) {
    return {
      text: ctx.table?.name
        ? `You're seated at **Table ${ctx.table.name}**.`
        : "Table info isn't available. Make sure you scanned the correct QR code.",
      action: null
    };
  }

  if (includesAny(query, ["cart", "basket", "what did i add", "my items", "कार्ट", "टोकरी", "क्या जोड़ा", "मैंने क्या"])) {
    return { text: cartSummary(ctx), action: null };
  }

  if (
    includesAny(query, [
      "place order",
      "how to order",
      "order food",
      "checkout",
      "submit order",
      "ऑर्डर",
      "आर्डर",
      "करना है",
      "मंगाओ",
      "चाहिए"
    ])
  ) {
    if (ctx.trackingOrder) {
      return { text: "You already have an order in progress. Use **Place Another Order** after this one is completed.", action: null };
    }
    if (!ctx.cartRows.length) {
      return { text: "Add items with **+** on the menu first, then tap **Place order** at the bottom.", action: null };
    }
    return {
      text: `Your cart total is **${formatInr(ctx.cartTotal)}**. Tap **Place order** at the bottom, then enter your name, phone & email.`,
      action: { type: "openCheckout" }
    };
  }

  if (includesAny(query, ["order status", "track order", "where is my order", "status of order", "my order", "ऑर्डर स्थिति", "ऑर्डर कहाँ", "ऑर्डर कहां", "मेरा ऑर्डर"])) {
    return orderStatusReply(ctx);
  }

  if (includesAny(query, ["ready", "pickup", "collect", "how long"])) {
    if (!ctx.trackingOrder) return orderStatusReply(ctx);
    if (ctx.trackingOrder.status === "Ready") {
      return { text: "Your order is **Ready**! Please collect it from the counter.", action: null };
    }
    if (ctx.trackingOrder.status === "Preparing") {
      return { text: "Your order is **Preparing**. We'll update you here when it's **Ready** for pickup.", action: null };
    }
    return orderStatusReply(ctx);
  }

  if (includesAny(query, ["invoice", "bill", "payment", "pay", "receipt", "download", "बिल", "भुगतान", "रसीद"])) {
    return invoiceReply(ctx);
  }

  if (includesAny(query, ["review", "rating", "feedback", "रिव्यू", "समीक्षा", "रेटिंग"])) {
    if (ctx.reviewSubmitted) {
      return {
        text: lang === "hi" ? "आप पहले ही समीक्षा भेज चुके हैं। धन्यवाद!" : "You've already submitted a review. Thank you!",
        action: null
      };
    }
    const canReview = ctx.trackingOrder?.status === "Completed";
    if (canReview) {
      return {
        text:
          lang === "hi"
            ? "कृपया **Submit Review** दबाइए, या माइक से 1 से 5 रेटिंग और अपना अनुभव बोलिए।"
            : "Tap **Submit Review**, or use the microphone to say your rating (1–5) and experience.",
        action: { type: "openReview" }
      };
    }
    return {
      text:
        lang === "hi"
          ? "समीक्षा ऑर्डर पूरा (Completed) होने के बाद उपलब्ध होगी।"
          : "Reviews are available after your order status is **Completed**.",
      action: null
    };
  }

  if (includesAny(query, ["category", "categories", "sections"])) {
    return categoriesReply(ctx);
  }

  const catReply = categoryItemsReply(ctx, query);
  if (catReply) return catReply;

  if (
    includesAny(query, [
      "menu",
      "food",
      "dishes",
      "eat",
      "price list",
      "what do you serve",
      "available",
      "मेनू",
      "मूल्य",
      "दाम",
      "दिखाइए",
      "दिखाओ",
      "खाना",
      "व्यंजन",
      "कीमत",
      "रेट"
    ])
  ) {
    if (ctx.items.length === 0) {
      return { text: "The menu is loading or empty. Pull down to refresh the page.", action: null };
    }
    if (query.includes("price") || query.includes("cost")) {
      return { text: `**Menu (${ctx.items.length} items):**\n${menuSummary(ctx)}`, action: null };
    }
    return {
      text: `**${ctx.items.length} dishes available.**\n${menuSummary(ctx)}\n\nAsk about any item by name, e.g. "price of paneer".`,
      action: null
    };
  }

  if (includesAny(query, ["price", "cost", "how much"])) {
    const matches = findMenuMatches(ctx, query);
    if (matches.length === 1) {
      const item = matches[0];
      return {
        text: `**${item.name}** — ${formatInr(item.price)}\n${item.description || item.category}`,
        action: null
      };
    }
    if (matches.length > 1) {
      const lines = matches.slice(0, 8).map((item) => `• ${item.name} — ${formatInr(item.price)}`);
      return { text: `Found ${matches.length} matches:\n${lines.join("\n")}`, action: null };
    }
  }

  const dishMatches = findMenuMatches(ctx, query);
  if (dishMatches.length === 1) {
    const item = dishMatches[0];
    return {
      text: `**${item.name}** — ${formatInr(item.price)} (${item.category})\n${item.description || "Available to order."}`,
      action: null
    };
  }
  if (dishMatches.length > 1) {
    const lines = dishMatches.slice(0, 8).map((item) => `• ${item.name} — ${formatInr(item.price)}`);
    return {
      text:
        lang === "hi"
          ? `मैंने ये व्यंजन पाए:\n${lines.join("\n")}\n\nजोड़ने के लिए नाम बोलिए या **हिंदी** माइक बटन का उपयोग करिए।`
          : `I found:\n${lines.join("\n")}`,
      action: null
    };
  }

  if (includesAny(query, ["veg", "vegetarian", "शाकाहारी", "वेज"])) {
    const veg = ctx.items.filter((i) => /veg/i.test(`${i.name} ${i.description} ${i.category}`));
    if (!veg.length) return { text: "I couldn't find items marked vegetarian. Ask staff for dietary options.", action: null };
    const lines = veg.slice(0, 10).map((item) => `• ${item.name} — ${formatInr(item.price)}`);
    return { text: `**Vegetarian-friendly picks:**\n${lines.join("\n")}`, action: null };
  }

  return {
    text:
      lang === "hi"
        ? "माफ़ कीजिए, मैं समझ नहीं पाया। **मेनू**, **कार्ट**, **ऑर्डर स्थिति**, **बिल**, **टेबल सेवा**, या **पता** पूछिए।"
        : "I'm not sure about that. Try asking about the **menu**, **cart**, **order status**, **invoice**, **table service**, or **restaurant address**.",
    action: null
  };
}

export function formatChatMarkdown(text) {
  return String(text || "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

export function getFullMenuText(ctx, lang = "en") {
  if (!ctx.items?.length) {
    return lang === "hi" ? "**मेनू अभी खाली है।**" : "**The menu is empty right now.**";
  }
  const lines = ctx.items.map((item) => {
    const price = formatInr(item.price);
    return lang === "hi" ? `${item.name} — ${price}` : `${item.name} — ${price}`;
  });
  const header =
    lang === "hi"
      ? `**पूरा मेनू (${ctx.items.length} व्यंजन):**`
      : `**Full menu (${ctx.items.length} items):**`;
  return `${header}\n${lines.map((l) => `• ${l}`).join("\n")}`;
}
