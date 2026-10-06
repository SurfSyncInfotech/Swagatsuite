import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { FiPlus, FiMinus, FiShoppingBag, FiX, FiCheck, FiChevronRight, FiEye, FiBell, FiDroplet, FiGrid, FiUser } from "react-icons/fi";
import { api } from "./config/api";
import { playOrderPlacedSuccess, playOrderReadyForPickupChime, playServiceRequestChime, unlockWebAudio } from "./utils/sounds";
import { downloadInvoicePdfDocument } from "./utils/invoicePrint";
import CustomerChatbot from "./components/CustomerChatbot";
import { loyaltyPhoneStorageKey } from "./components/CustomerLoyaltyCard";
import { LOYALTY_ENABLED } from "./config/features";
import "./CustomerMenu.css";

function normalizeLoyaltyPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function readLoyaltyPhone(restaurantCode) {
  if (!restaurantCode) return "";
  try {
    return normalizeLoyaltyPhone(localStorage.getItem(loyaltyPhoneStorageKey(restaurantCode)));
  } catch {
    return "";
  }
}

function saveLoyaltyPhone(restaurantCode, phone) {
  if (!restaurantCode || !phone) return;
  try {
    localStorage.setItem(loyaltyPhoneStorageKey(restaurantCode), phone);
  } catch {
    /* ignore */
  }
}

function clearLoyaltyPhone(restaurantCode) {
  if (!restaurantCode) return;
  try {
    localStorage.removeItem(loyaltyPhoneStorageKey(restaurantCode));
  } catch {
    /* ignore */
  }
}

function orderStampSessionKey(orderId) {
  return `restro_qr_order_stamp_done_${orderId}`;
}

function markOrderStampSessionDone(orderId) {
  if (!orderId) return;
  try {
    sessionStorage.setItem(orderStampSessionKey(orderId), "1");
  } catch {
    /* ignore */
  }
}

function isOrderStampSessionDone(orderId) {
  if (!orderId) return false;
  try {
    return sessionStorage.getItem(orderStampSessionKey(orderId)) === "1";
  } catch {
    return false;
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch (_e) {
    return String(iso);
  }
}

const ORDER_STATUSES = ["Placed", "Preparing", "Ready", "Served", "Completed"];

function orderStorageKey(restaurantCode, token) {
  return `restro_qr_table_order_${restaurantCode}_${token}`;
}

function statusDisplayTagline(status) {
  const map = {
    Placed: "Your order is confirmed · we're on it",
    Preparing: "Kitchen is preparing your order",
    Ready: "Please collect from the counter when ready",
    Served: "Served — enjoy your meal",
    Completed: "Thank you for dining with us"
  };
  return map[status] || map.Placed;
}

function readStoredOrderIdFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search);
    const rc = p.get("restaurant") || "";
    const tk = p.get("token") || "";
    if (!rc || !tk) return null;
    const raw = localStorage.getItem(orderStorageKey(rc, tk));
    if (!raw) return null;
    const id = Number(JSON.parse(raw)?.orderId);
    return id > 0 ? id : null;
  } catch {
    return null;
  }
}

function removeStoredOrderForTable(restaurantCode, token) {
  try {
    localStorage.removeItem(orderStorageKey(restaurantCode, token));
  } catch (_e) {
    /* ignore */
  }
}

function reviewStorageKey(orderId) {
  return `restro_qr_order_review_${orderId}`;
}

const EMPTY_LOYALTY = {
  stampsInCycle: 0,
  stampsPerReward: 5,
  rewardsPending: 0,
  totalStampsEarned: 0,
  totalRewardsEarned: 0,
  totalRewardsRedeemed: 0,
  rewardValueInr: 500,
  history: []
};

function emptyLoyaltyForPhone(phone) {
  return { phone, ...EMPTY_LOYALTY };
}

function resetForNextCustomerSession({
  restaurantCode,
  token,
  orderId,
  setStoredOrderId,
  setTrackingOrder,
  setInvoiceData
}) {
  if (orderId) markOrderStampSessionDone(orderId);
  removeStoredOrderForTable(restaurantCode, token);
  setStoredOrderId(null);
  setTrackingOrder(null);
  setInvoiceData(null);
  window.setTimeout(() => {
    window.location.reload();
  }, 1200);
}

export default function CustomerMenu() {
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState(null);
  const [table, setTable] = useState(null);
  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [cart, setCart] = useState({});
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "", email: "" });
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [storedOrderId, setStoredOrderId] = useState(readStoredOrderIdFromUrl);
  const [statusOpening, setStatusOpening] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [polledOrderStatus, setPolledOrderStatus] = useState("");
  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceLoadingType, setServiceLoadingType] = useState("");
  const [loyaltyPhone, setLoyaltyPhone] = useState("");
  const [loyalty, setLoyalty] = useState(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltyRedeeming, setLoyaltyRedeeming] = useState(false);
  const prevStatusRef = useRef("");
  const loyaltyStampBaselineRef = useRef({ totalStampsEarned: 0, rewardsPending: 0 });

  const params = new URLSearchParams(window.location.search);
  const restaurantCode = params.get("restaurant") || "";
  const token = params.get("token") || "";

  useEffect(() => {
    setLoyaltyPhone(readLoyaltyPhone(restaurantCode));
  }, [restaurantCode]);

  const applyLoyaltyUpdate = useCallback((next, { silent = false } = {}) => {
    if (!LOYALTY_ENABLED || !next) return;
    const baseline = loyaltyStampBaselineRef.current;
    setLoyalty(next);

    if (!silent) {
      if (next.rewardsPending > baseline.rewardsPending) {
        toast.success("You unlocked a free meal worth ₹500!");
        void unlockWebAudio().then(() => playOrderPlacedSuccess());
      } else if (next.totalStampsEarned > baseline.totalStampsEarned) {
        toast.success(`Stamp earned! ${next.stampsInCycle}/5 toward your free ₹500 meal.`);
        void unlockWebAudio().then(() => playOrderPlacedSuccess());
      }
    }

    loyaltyStampBaselineRef.current = {
      totalStampsEarned: next.totalStampsEarned ?? 0,
      rewardsPending: next.rewardsPending ?? 0
    };
  }, []);

  const fetchLoyaltyViaOrder = useCallback(
    async (phone, orderId) => {
      if (!LOYALTY_ENABLED) return null;
      const oid = Number(orderId || trackingOrder?.orderId || storedOrderId || 0);
      if (!oid || !restaurantCode || !token || phone.length < 10) return null;
      const { data } = await api.get(`/public/orders/${oid}`, {
        params: { restaurant: restaurantCode, token, phone }
      });
      return data.loyalty || null;
    },
    [restaurantCode, token, trackingOrder?.orderId, storedOrderId]
  );

  const fetchLoyalty = useCallback(
    async (phoneOverride, { silent = false } = {}) => {
      if (!LOYALTY_ENABLED) return;
      const phone = normalizeLoyaltyPhone(phoneOverride || loyaltyPhone);
      if (!restaurantCode || phone.length < 10) return;
      const orderId = storedOrderId || trackingOrder?.orderId;

      if (!orderId) {
        setLoyalty(emptyLoyaltyForPhone(phone));
        return;
      }

      setLoyaltyLoading(true);
      try {
        const fromOrder = await fetchLoyaltyViaOrder(phone, orderId);
        const next = fromOrder || emptyLoyaltyForPhone(phone);
        if (fromOrder && !silent) applyLoyaltyUpdate(fromOrder);
        else setLoyalty(next);
      } catch (_e) {
        setLoyalty(emptyLoyaltyForPhone(phone));
      } finally {
        setLoyaltyLoading(false);
      }
    },
    [restaurantCode, loyaltyPhone, storedOrderId, trackingOrder?.orderId, fetchLoyaltyViaOrder, applyLoyaltyUpdate]
  );

  /** Refresh stamps as soon as the menu loads when this table has a stored order. */
  useEffect(() => {
    if (!LOYALTY_ENABLED || !restaurantCode || !token || !storedOrderId) return;
    let cancelled = false;

    const refreshStampsOnLanding = async () => {
      const phone = normalizeLoyaltyPhone(loyaltyPhone);
      try {
        const { data } = await api.get(`/public/orders/${storedOrderId}`, {
          params: {
            restaurant: restaurantCode,
            token,
            ...(phone.length >= 10 ? { phone } : {})
          }
        });
        if (cancelled) return;

        const orderPhone = normalizeLoyaltyPhone(data.customerPhone || "");
        if (orderPhone.length >= 10 && !loyaltyPhone) {
          saveLoyaltyPhone(restaurantCode, orderPhone);
          setLoyaltyPhone(orderPhone);
        }

        if (data.loyalty) {
          applyLoyaltyUpdate(data.loyalty, { silent: true });
          return;
        }

        const activePhone = normalizeLoyaltyPhone(loyaltyPhone || data.customerPhone || "");
        if (activePhone.length >= 10) {
          const fromOrder = await fetchLoyaltyViaOrder(activePhone, storedOrderId);
          if (!cancelled && fromOrder) {
            applyLoyaltyUpdate(fromOrder, { silent: true });
          } else if (!cancelled) {
            setLoyalty(emptyLoyaltyForPhone(activePhone));
          }
        }
      } catch (_e) {
        /* periodic fetchLoyalty will retry */
      }
    };

    void refreshStampsOnLanding();
    return () => {
      cancelled = true;
    };
  }, [restaurantCode, token, storedOrderId, loyaltyPhone, fetchLoyaltyViaOrder, applyLoyaltyUpdate]);

  useEffect(() => {
    if (!LOYALTY_ENABLED || !restaurantCode || loyaltyPhone.length < 10) return;
    void fetchLoyalty(loyaltyPhone, { silent: true });
  }, [restaurantCode, loyaltyPhone, storedOrderId, fetchLoyalty]);

  useEffect(() => {
    if (!LOYALTY_ENABLED || !restaurantCode || loyaltyPhone.length < 10) return;
    const timer = window.setInterval(() => fetchLoyalty(loyaltyPhone, { silent: true }), 12000);
    return () => window.clearInterval(timer);
  }, [restaurantCode, loyaltyPhone, storedOrderId, fetchLoyalty]);

  const linkLoyaltyPhone = (rawPhone) => {
    const phone = normalizeLoyaltyPhone(rawPhone);
    if (phone.length < 10) {
      toast.error("Enter a valid 10-digit mobile number.");
      return;
    }
    saveLoyaltyPhone(restaurantCode, phone);
    setLoyaltyPhone(phone);
    void fetchLoyalty(phone);
  };

  const refreshLoyaltyAndNotify = useCallback(
    async (phoneRaw, orderId) => {
      if (!LOYALTY_ENABLED) return;
      const phone = normalizeLoyaltyPhone(phoneRaw);
      if (!restaurantCode || phone.length < 10) return;
      if (orderId && isOrderStampSessionDone(orderId)) return;

      saveLoyaltyPhone(restaurantCode, phone);
      setLoyaltyPhone(phone);

      try {
        const next = await fetchLoyaltyViaOrder(phone, orderId);
        if (!next) return;
        applyLoyaltyUpdate(next);
      } catch (_e) {
        /* retry on next poll */
      }
    },
    [restaurantCode, fetchLoyaltyViaOrder, applyLoyaltyUpdate]
  );

  useEffect(() => {
    if (!loyalty) return;
    loyaltyStampBaselineRef.current = {
      totalStampsEarned: loyalty.totalStampsEarned ?? 0,
      rewardsPending: loyalty.rewardsPending ?? 0
    };
  }, [loyalty?.totalStampsEarned, loyalty?.rewardsPending]);

  const redeemLoyaltyReward = async () => {
    if (!restaurantCode || !token || loyaltyPhone.length < 10) return;
    setLoyaltyRedeeming(true);
    try {
      const { data } = await api.post("/public/loyalty/redeem", {
        restaurantCode,
        token,
        phone: loyaltyPhone
      });
      setLoyalty(data.loyalty || null);
      toast.success(data.message || "Reward ready to use at the counter.");
      void unlockWebAudio().then(() => playOrderPlacedSuccess());
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not redeem reward.");
    } finally {
      setLoyaltyRedeeming(false);
    }
  };

  useEffect(() => {
    if (!restaurantCode || !token) {
      setStoredOrderId(null);
      return;
    }
    try {
      const raw = localStorage.getItem(orderStorageKey(restaurantCode, token));
      if (!raw) {
        setStoredOrderId(null);
        return;
      }
      const id = Number(JSON.parse(raw)?.orderId);
      setStoredOrderId(id > 0 ? id : null);
    } catch (_e) {
      setStoredOrderId(null);
    }
  }, [restaurantCode, token]);

  useEffect(() => {
    if (!restaurantCode || !token) {
      setLoading(false);
      toast.error("Invalid QR link.");
      return;
    }
    api
      .get("/public/menu", { params: { restaurant: restaurantCode, token } })
      .then((response) => {
        const incomingRestaurant = response.data?.restaurant || {};
        setRestaurant({
          ...incomingRestaurant,
          logoUrl: incomingRestaurant.logoUrl || incomingRestaurant.logo_url || ""
        });
        setTable(response.data.table);
        setItems(response.data.items || []);
      })
      .catch((error) => {
        toast.error(error.response?.data?.message || "Menu could not be loaded.");
      })
      .finally(() => setLoading(false));
  }, [restaurantCode, token]);

  useEffect(() => {
    const base = restaurant?.name?.trim() || "Restaurant Menu";
    document.title = table?.name ? `${base} - ${table.name}` : base;
  }, [restaurant?.name, table?.name]);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(items.filter((i) => i.available).map((item) => item.category)))],
    [items]
  );

  const visibleItems = useMemo(() => {
    const base = items.filter((item) => item.available);
    return base.filter((item) => activeCategory === "all" || item.category === activeCategory);
  }, [items, activeCategory]);

  const cartRows = useMemo(
    () =>
      Object.entries(cart)
        .map(([itemId, qty]) => {
          const item = items.find((x) => x.id === Number(itemId));
          return item && item.available ? { item, qty } : null;
        })
        .filter(Boolean),
    [cart, items]
  );

  const total = useMemo(
    () => cartRows.reduce((sum, row) => sum + Number(row.item.price) * Number(row.qty), 0),
    [cartRows]
  );

  const changeQty = (itemId, nextQty) => {
    setCart((prev) => {
      const qty = Math.max(0, nextQty);
      if (!qty) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: qty };
    });
  };

  const openCheckout = () => {
    if (!cartRows.length) {
      toast.error("Add items to cart first.");
      return;
    }
    setCheckoutOpen(true);
  };

  const submitOrder = async () => {
    const name = customerForm.name.trim();
    const phone = customerForm.phone.replace(/\D/g, "");
    const email = customerForm.email.trim();
    if (name.length < 2) {
      toast.error("Please enter your name.");
      return;
    }
    if (phone.length < 10) {
      toast.error("Enter a valid phone number (at least 10 digits).");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }

    setPlacingOrder(true);
    try {
      const response = await api.post("/public/orders", {
        restaurantCode,
        token,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        items: cartRows.map((row) => ({ itemId: row.item.id, qty: row.qty }))
      });
      toast.success(response.data?.message || "Order placed.");
      void unlockWebAudio().then(() => playOrderPlacedSuccess());
      setCheckoutOpen(false);
      setCart({});
      setCustomerForm({ name: "", phone: "", email: "" });
      const oid = response.data?.orderId;
      if (oid) {
        try {
          localStorage.setItem(orderStorageKey(restaurantCode, token), JSON.stringify({ orderId: oid }));
        } catch (_e) {
          /* ignore quota */
        }
        setStoredOrderId(oid);
        prevStatusRef.current = "Placed";
        setTrackingOrder({
          orderId: oid,
          amount: response.data?.amount,
          tableLabel: response.data?.table,
          status: "Placed",
          createdAt: new Date().toISOString(),
          items: [],
          customerName: name,
          customerPhone: phone,
          customerEmail: email
        });
        saveLoyaltyPhone(restaurantCode, phone);
        setLoyaltyPhone(phone);
        void fetchLoyalty(phone);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not place order.");
    } finally {
      setPlacingOrder(false);
    }
  };

  const applyOrderPollData = useCallback((data) => {
    setTrackingOrder((prev) => ({
      ...prev,
      ...data,
      orderId: data.orderId,
      amount: data.amount,
      status: data.status,
      tableLabel: data.tableLabel,
      createdAt: data.createdAt,
      items: data.items || [],
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerEmail: data.customerEmail
    }));
  }, []);

  const fetchOrderStatus = useCallback(async () => {
    if (!trackingOrder?.orderId || !restaurantCode || !token) return;
    try {
      const phone = normalizeLoyaltyPhone(loyaltyPhone || trackingOrder?.customerPhone || "");
      const { data } = await api.get(`/public/orders/${trackingOrder.orderId}`, {
        params: {
          restaurant: restaurantCode,
          token,
          ...(phone.length >= 10 ? { phone } : {})
        }
      });

      applyOrderPollData(data);
      setPolledOrderStatus(data.status || "");
      if (data.loyalty) {
        applyLoyaltyUpdate(data.loyalty, { silent: true });
      }

      const prev = prevStatusRef.current;
      if (data.status === "Ready" && prev !== "Ready") {
        void unlockWebAudio().then(() => playOrderReadyForPickupChime());
      }
      if (data.status === "Completed" && prev !== "Completed") {
        void refreshLoyaltyAndNotify(
          data.customerPhone || trackingOrder?.customerPhone || loyaltyPhone,
          data.orderId || trackingOrder?.orderId
        );
      }
      prevStatusRef.current = data.status;

      try {
        const invoiceRes = await api.get(`/public/orders/${data.orderId}/invoice`, {
          params: { restaurant: restaurantCode, token }
        });
        setInvoiceData(invoiceRes.data?.invoice || null);
      } catch (_invoiceErr) {
        setInvoiceData(null);
      }
    } catch (_e) {
      // silent fail while polling
    }
  }, [
    trackingOrder?.orderId,
    trackingOrder?.customerPhone,
    restaurantCode,
    token,
    loyaltyPhone,
    refreshLoyaltyAndNotify,
    applyOrderPollData,
    applyLoyaltyUpdate
  ]);

  useEffect(() => {
    if (!trackingOrder?.orderId) return;
    fetchOrderStatus();
    const id = window.setInterval(fetchOrderStatus, 4000);
    return () => window.clearInterval(id);
  }, [trackingOrder?.orderId, fetchOrderStatus]);

  /** While on the menu, poll stored order so “Completed” clears local session for the next guest. */
  useEffect(() => {
    if (!restaurantCode || !token) return;
    if (!storedOrderId || trackingOrder) return;

    const checkCompletedWhileOnMenu = async () => {
      try {
        const phone = normalizeLoyaltyPhone(loyaltyPhone);
        const { data } = await api.get(`/public/orders/${storedOrderId}`, {
          params: {
            restaurant: restaurantCode,
            token,
            ...(phone.length >= 10 ? { phone } : {})
          }
        });
        setPolledOrderStatus(data.status || "");
        if (data.loyalty) {
          applyLoyaltyUpdate(data.loyalty, { silent: true });
        }
        if (data.status === "Completed" && !isOrderStampSessionDone(data.orderId)) {
          void refreshLoyaltyAndNotify(data.customerPhone || loyaltyPhone, data.orderId);
        }
        if (data.status === "Completed") {
          setTrackingOrder((prev) =>
            prev?.orderId === data.orderId
              ? { ...prev, ...data, status: "Completed" }
              : {
                  orderId: data.orderId,
                  amount: data.amount,
                  status: "Completed",
                  tableLabel: data.tableLabel,
                  createdAt: data.createdAt,
                  items: data.items || [],
                  customerName: data.customerName,
                  customerPhone: data.customerPhone,
                  customerEmail: data.customerEmail
                }
          );
        }
      } catch (error) {
        if (error.response?.status === 404) {
          removeStoredOrderForTable(restaurantCode, token);
          setStoredOrderId(null);
        }
      }
    };

    checkCompletedWhileOnMenu();
    const timer = window.setInterval(checkCompletedWhileOnMenu, 8000);
    return () => window.clearInterval(timer);
  }, [restaurantCode, token, storedOrderId, trackingOrder, loyaltyPhone, refreshLoyaltyAndNotify]);

  useEffect(() => {
    if (!restaurantCode || !token || !storedOrderId) return;
    const loadInvoice = () => {
      api
        .get(`/public/orders/${storedOrderId}/invoice`, {
          params: { restaurant: restaurantCode, token }
        })
        .then((res) => {
          setInvoiceData(res.data?.invoice || null);
        })
        .catch(() => {
          setInvoiceData(null);
        });
    };
    loadInvoice();
    const timer = window.setInterval(loadInvoice, 4000);
    return () => window.clearInterval(timer);
  }, [restaurantCode, token, storedOrderId]);

  const activeOrderIdForReview = Number(
    trackingOrder?.orderId || invoiceData?.orderId || storedOrderId || 0
  );

  useEffect(() => {
    if (!activeOrderIdForReview) return;
    try {
      const raw = localStorage.getItem(reviewStorageKey(activeOrderIdForReview));
      setReviewSubmitted(raw === "1");
    } catch (_e) {
      setReviewSubmitted(false);
    }
  }, [activeOrderIdForReview]);

  const openStoredOrderStatus = async () => {
    const id = storedOrderId;
    if (!id || !restaurantCode || !token) return;
    setStatusOpening(true);
    try {
      const { data } = await api.get(`/public/orders/${id}`, {
        params: { restaurant: restaurantCode, token }
      });
      if (data.status === "Completed") {
        prevStatusRef.current = "Completed";
        setPolledOrderStatus("Completed");
        setTrackingOrder({
          orderId: data.orderId || id,
          amount: data.amount,
          status: "Completed",
          tableLabel: data.tableLabel,
          createdAt: data.createdAt,
          items: data.items || [],
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail
        });
        try {
          const invoiceRes = await api.get(`/public/orders/${id}/invoice`, {
            params: { restaurant: restaurantCode, token }
          });
          setInvoiceData(invoiceRes.data?.invoice || null);
        } catch (_e) {
          setInvoiceData(null);
        }
        void refreshLoyaltyAndNotify(data.customerPhone || loyaltyPhone, data.orderId || id);
        return;
      }
      prevStatusRef.current = data.status || "";
      setPolledOrderStatus(data.status || "");
      setTrackingOrder({
        orderId: data.orderId,
        amount: data.amount,
        status: data.status,
        tableLabel: data.tableLabel,
        createdAt: data.createdAt,
        items: data.items || [],
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail
      });
      try {
        const invoiceRes = await api.get(`/public/orders/${data.orderId}/invoice`, {
          params: { restaurant: restaurantCode, token }
        });
        setInvoiceData(invoiceRes.data?.invoice || null);
      } catch (_invoiceErr) {
        setInvoiceData(null);
      }
    } catch (_e) {
      toast.error("Could not load this order. It may be invalid for this table.");
      removeStoredOrderForTable(restaurantCode, token);
      setStoredOrderId(null);
    } finally {
      setStatusOpening(false);
    }
  };

  const rawStatusIndex = trackingOrder ? ORDER_STATUSES.indexOf(trackingOrder.status) : -1;
  const statusIndex = rawStatusIndex < 0 ? 0 : rawStatusIndex;
  const showMenuOrderCta = Boolean(storedOrderId) && !trackingOrder;
  const addToCartVoice = (itemId, qty) => {
    setCart((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + Math.max(1, Number(qty) || 1)
    }));
  };

  const placeVoiceOrder = async ({ name, phone, email }) => {
    if (!cartRows.length) {
      throw new Error("Cart empty");
    }
    setPlacingOrder(true);
    try {
      const response = await api.post("/public/orders", {
        restaurantCode,
        token,
        customerName: name.trim(),
        customerPhone: phone.replace(/\D/g, ""),
        customerEmail: (email || "").trim() || `guest.${phone.replace(/\D/g, "")}@swagatsuite.order`,
        items: cartRows.map((row) => ({ itemId: row.item.id, qty: row.qty }))
      });
      setCheckoutOpen(false);
      setCart({});
      setCustomerForm({ name: "", phone: "", email: "" });
      const oid = response.data?.orderId;
      if (oid) {
        try {
          localStorage.setItem(orderStorageKey(restaurantCode, token), JSON.stringify({ orderId: oid }));
        } catch (_e) {
          /* ignore */
        }
        setStoredOrderId(oid);
        prevStatusRef.current = "Placed";
        setTrackingOrder({
          orderId: oid,
          amount: response.data?.amount,
          tableLabel: response.data?.table,
          status: "Placed",
          createdAt: new Date().toISOString(),
          items: [],
          customerName: name,
          customerPhone: phone,
          customerEmail: email
        });
        saveLoyaltyPhone(restaurantCode, phone);
        setLoyaltyPhone(phone);
        void fetchLoyalty(phone);
      }
      toast.success(response.data?.message || "Order placed.");
      void unlockWebAudio().then(() => playOrderPlacedSuccess());
    } finally {
      setPlacingOrder(false);
    }
  };

  const isOrderCompleted = (trackingOrder?.status || polledOrderStatus) === "Completed";
  const invoiceSettled = invoiceData?.paymentStatus === "Paid" || isOrderCompleted;
  const showPayInvoiceBtn = Boolean(
    invoiceData?.id && invoiceData.paymentStatus === "Unpaid" && !isOrderCompleted
  );
  const canSubmitReview = Boolean(!reviewSubmitted && isOrderCompleted);

  const finishSessionAfterReview = useCallback(
    (orderId) => {
      resetForNextCustomerSession({
        restaurantCode,
        token,
        orderId,
        setStoredOrderId,
        setTrackingOrder,
        setInvoiceData
      });
    },
    [restaurantCode, token]
  );

  const submitVoiceReview = async ({ rating, comment }) => {
    if (!activeOrderIdForReview) {
      toast.error("Order not found for review.");
      return false;
    }
    setReviewSubmitting(true);
    try {
      await api.post(`/public/orders/${activeOrderIdForReview}/review`, {
        restaurantCode,
        token,
        rating: Number(rating || 5),
        comment: comment || ""
      });
      setReviewSubmitted(true);
      setReviewOpen(false);
      setReviewForm({ rating: Number(rating || 5), comment: comment || "" });
      try {
        localStorage.setItem(reviewStorageKey(activeOrderIdForReview), "1");
      } catch (_e) {}
      toast.success("Thanks for your review! Table is ready for the next guest.");
      finishSessionAfterReview(activeOrderIdForReview);
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not submit review.");
      return false;
    } finally {
      setReviewSubmitting(false);
    }
  };

  const downloadInvoicePdf = async () => {
    if (!invoiceData || invoiceDownloading) return;
    setInvoiceDownloading(true);
    try {
      await downloadInvoicePdfDocument({ invoice: invoiceData, restaurant });
      toast.success("Invoice downloaded.");
    } catch (_err) {
      toast.error("Could not download invoice. Please try again.");
    } finally {
      setInvoiceDownloading(false);
    }
  };

  const submitReview = async () => {
    if (!activeOrderIdForReview) {
      toast.error("Order not found for review.");
      return;
    }
    setReviewSubmitting(true);
    try {
      await api.post(`/public/orders/${activeOrderIdForReview}/review`, {
        restaurantCode,
        token,
        rating: Number(reviewForm.rating || 5),
        comment: reviewForm.comment || ""
      });
      setReviewSubmitted(true);
      setReviewOpen(false);
      try {
        localStorage.setItem(reviewStorageKey(activeOrderIdForReview), "1");
      } catch (_e) {}
      toast.success("Thanks for your review! Table is ready for the next guest.");
      finishSessionAfterReview(activeOrderIdForReview);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not submit review.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const sendServiceRequest = async (requestType) => {
    if (!restaurantCode || !token) return;
    setServiceLoadingType(requestType);
    try {
      await api.post("/public/service-requests", {
        restaurantCode,
        token,
        requestType
      });
      void unlockWebAudio().then(() => playServiceRequestChime());
      setServiceOpen(false);
      const labels = {
        water: "पानी का अनुरोध भेज दिया गया। / Water request sent.",
        tissue: "टिशू का अनुरोध भेज दिया गया। / Tissue request sent.",
        waiter: "वेटर को बुलाया गया। / Waiter called."
      };
      toast.success(labels[requestType] || "Request sent.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not send request.");
    } finally {
      setServiceLoadingType("");
    }
  };

  return (
    <div className="customer-page">
      <Toaster position="top-center" />

      {checkoutOpen ? (
        <div className="customer-modal-backdrop" role="presentation" onClick={() => !placingOrder && setCheckoutOpen(false)}>
          <div className="customer-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <header className="customer-modal-head">
              <h2>Your details</h2>
              <button type="button" className="customer-modal-close" onClick={() => setCheckoutOpen(false)} disabled={placingOrder}>
                <FiX />
              </button>
            </header>
            <p className="customer-modal-hint">We need this to confirm your order.</p>
            <label className="customer-field">
              <span>Full name</span>
              <input
                type="text"
                autoComplete="name"
                value={customerForm.name}
                onChange={(e) => setCustomerForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Your name"
              />
            </label>
            <label className="customer-field">
              <span>Contact number</span>
              <input
                type="tel"
                autoComplete="tel"
                inputMode="numeric"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="10+ digit mobile number"
              />
            </label>
            <label className="customer-field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={customerForm.email}
                onChange={(e) => setCustomerForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="you@example.com"
              />
            </label>
            <button type="button" className="customer-modal-submit" onClick={submitOrder} disabled={placingOrder}>
              {placingOrder ? "Placing order..." : "Confirm & place order"}
            </button>
          </div>
        </div>
      ) : null}

      {trackingOrder ? (
        <div className="customer-tracking customer-tracking-display">
          <div
            className={[
              "customer-display-board",
              trackingOrder.status === "Placed" && "is-placed",
              trackingOrder.status === "Preparing" && "is-preparing",
              trackingOrder.status === "Ready" && "is-ready",
              trackingOrder.status === "Served" && "is-served",
              trackingOrder.status === "Completed" && "is-completed"
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="customer-display-board-glow" aria-hidden />
            <p className="customer-display-kicker">Live kitchen status</p>
            <div className="customer-display-table-pill" title="Your table">
              <span className="customer-display-table-value">{trackingOrder.tableLabel || "—"}</span>
            </div>
            <h1 className="customer-display-status-mega">{trackingOrder.status}</h1>
            <p className="customer-display-tagline">{statusDisplayTagline(trackingOrder.status)}</p>
            <p className="customer-display-order-meta">
              Order #{trackingOrder.orderId}
              {trackingOrder.createdAt ? <span className="customer-display-dot"> · </span> : null}
              {formatTime(trackingOrder.createdAt)}
            </p>

            <div className={`customer-display-pipeline ${trackingOrder.status === "Ready" ? "is-ready" : ""}`}>
              {ORDER_STATUSES.map((s, i) => {
                const orderComplete = trackingOrder.status === "Completed";
                const isCurrent = !orderComplete && trackingOrder.status === s;
                const stepDone = orderComplete || i < statusIndex;
                const showCheck = stepDone;
                return (
                  <div
                    key={s}
                    className={`customer-display-pipeline-step ${stepDone ? "past" : ""} ${isCurrent ? "current" : ""}`}
                  >
                    <span className="customer-display-pipeline-dot">{showCheck ? <FiCheck /> : i + 1}</span>
                    <span className="customer-display-pipeline-label">{s}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="customer-tracking-details-card">
            <h2 className="customer-details-heading">Your order</h2>
            {trackingOrder.items?.length ? (
              <ul className="customer-tracking-items">
                {trackingOrder.items.map((line) => (
                  <li key={`${line.itemId}-${line.name}`}>
                    <span>
                      {line.name} × {line.qty}
                    </span>
                    <span>{formatCurrency(line.lineTotal)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="customer-details-empty">Line items will appear here once synced.</p>
            )}
            <div className="customer-tracking-total">
              <span>Total</span>
              <strong>{formatCurrency(trackingOrder.amount)}</strong>
            </div>
            <div className="customer-tracking-actions">
              {canSubmitReview ? (
                <button
                  type="button"
                  className="customer-review-btn customer-review-btn-primary"
                  onClick={() => setReviewOpen(true)}
                  disabled={reviewSubmitted}
                >
                  {reviewSubmitted ? "Review Submitted" : "Submit Review"}
                </button>
              ) : null}
              {invoiceSettled ? (
                <button type="button" className="customer-review-btn" onClick={() => setInvoiceModalOpen(true)}>
                  {invoiceData?.paymentStatus === "Paid" ? "Download Invoice" : "View Invoice"}
                </button>
              ) : null}
              <button
                type="button"
                className="customer-back-menu"
                onClick={() => {
                  setTrackingOrder(null);
                }}
              >
                Place Another Order
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPayInvoiceBtn && invoiceData?.paymentStatus === "Unpaid" ? (
        <button
          type="button"
          className="customer-pay-invoice-btn unpaid blink"
          onClick={() => {
            setInvoiceModalOpen(true);
          }}
        >
          Pay Invoice
        </button>
      ) : null}

      {canSubmitReview ? (
        <button
          type="button"
          className={`customer-pay-invoice-btn ${reviewSubmitted ? "review-submitted" : "review-cta blink"}`}
          onClick={() => setReviewOpen(true)}
          disabled={reviewSubmitted}
        >
          {reviewSubmitted ? "Review Submitted" : "Submit Review"}
        </button>
      ) : invoiceSettled ? (
        <button
          type="button"
          className="customer-pay-invoice-btn review-submitted"
          onClick={() => {
            setInvoiceModalOpen(true);
          }}
        >
          View Invoice
        </button>
      ) : null}

      {invoiceModalOpen && invoiceData ? (
        <div className="customer-modal-backdrop" role="presentation" onClick={() => setInvoiceModalOpen(false)}>
          <div className="customer-modal invoice-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <header className="customer-modal-head">
              <h2>Invoice #{invoiceData.invoiceNo}</h2>
              <button type="button" className="customer-modal-close" onClick={() => setInvoiceModalOpen(false)}>
                <FiX />
              </button>
            </header>
            {restaurant?.logoUrl || restaurant?.logo_url ? (
              <div className="invoice-modal-logo-wrap">
                <img
                  src={restaurant?.logoUrl || restaurant?.logo_url}
                  alt="Restaurant logo"
                  className="invoice-modal-logo"
                />
              </div>
            ) : null}
            <p className="customer-modal-hint">Order #{invoiceData.orderId} · {invoiceData.paymentStatus}</p>
            <ul className="customer-tracking-items">
              {(invoiceData.items || []).map((line, idx) => (
                <li key={`${line.name}-${idx}`}>
                  <span>{line.name} × {line.qty}</span>
                  <span>{formatCurrency(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="customer-tracking-total">
              <span>GST (18%)</span>
              <strong>{formatCurrency(invoiceData.gstAmount)}</strong>
            </div>
            <div className="customer-tracking-total">
              <span>Total Amount</span>
              <strong>{formatCurrency(invoiceData.total)}</strong>
            </div>
            {invoiceSettled ? (
              <>
                <button
                  type="button"
                  className="customer-modal-submit"
                  onClick={downloadInvoicePdf}
                  disabled={invoiceDownloading}
                >
                  {invoiceDownloading ? "Preparing PDF..." : "Download Invoice"}
                </button>
                {canSubmitReview ? (
                  <button type="button" className="customer-review-btn" onClick={() => setReviewOpen(true)}>
                    Submit Review
                  </button>
                ) : null}
              </>
            ) : (
              <p className="customer-modal-hint">Please pay at counter.</p>
            )}
          </div>
        </div>
      ) : null}

      {reviewOpen ? (
        <div className="customer-modal-backdrop" role="presentation" onClick={() => !reviewSubmitting && setReviewOpen(false)}>
          <div className="customer-modal invoice-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <header className="customer-modal-head">
              <h2>समीक्षा / Submit Review</h2>
              <button type="button" className="customer-modal-close" onClick={() => setReviewOpen(false)} disabled={reviewSubmitting}>
                <FiX />
              </button>
            </header>
            <p className="customer-modal-hint">
              टाइप करें या चैटबॉट माइक से रेटिंग और अनुभव बोलिए। · Type here or speak your rating via the chatbot mic.
            </p>
            <label className="customer-field">
              <span>Rating</span>
              <select
                value={reviewForm.rating}
                onChange={(e) => setReviewForm((p) => ({ ...p, rating: Number(e.target.value) }))}
              >
                <option value={5}>5 - Excellent</option>
                <option value={4}>4 - Good</option>
                <option value={3}>3 - Okay</option>
                <option value={2}>2 - Poor</option>
                <option value={1}>1 - Bad</option>
              </select>
            </label>
            <label className="customer-field">
              <span>Comment (optional)</span>
              <input
                type="text"
                value={reviewForm.comment}
                onChange={(e) => setReviewForm((p) => ({ ...p, comment: e.target.value }))}
                placeholder="Tell us about your experience"
              />
            </label>
            <button type="button" className="customer-modal-submit" onClick={submitReview} disabled={reviewSubmitting}>
              {reviewSubmitting ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </div>
      ) : null}

      {!trackingOrder ? (
        <>
          <header className="customer-hero">
            <button
              type="button"
              className="customer-bell-btn"
              onClick={() => {
                void unlockWebAudio().then(() => playServiceRequestChime());
                setServiceOpen(true);
              }}
            >
              <FiBell />
              <span className="customer-bell-text blink">Tap bell</span>
              <span className="customer-bell-dot" />
            </button>
            {restaurant?.logoUrl || restaurant?.logo_url ? (
              <div className="customer-logo-wrap">
                <img src={restaurant.logoUrl || restaurant.logo_url} alt="" className="customer-logo" />
              </div>
            ) : (
              <h1 className="customer-title-fallback">{restaurant?.name || "Menu"}</h1>
            )}
            {restaurant?.logoUrl || restaurant?.logo_url ? <p className="customer-title-under">{restaurant?.name}</p> : null}
            <p className="customer-sub">{table ? `Table · ${table.name}` : "Scan a valid table QR"}</p>
          </header>

          {showMenuOrderCta ? (
            <div className="customer-order-cta-wrap">
              <button
                type="button"
                className="customer-order-cta"
                onClick={openStoredOrderStatus}
                disabled={statusOpening}
              >
                <span className="customer-order-cta-icon">
                  <FiEye />
                </span>
                <span className="customer-order-cta-text">
                  <strong>{statusOpening ? "Opening…" : "View my order status"}</strong>
                  <small>
                    Order #{storedOrderId}
                    {table?.name ? ` · ${table.name}` : ""}
                  </small>
                </span>
                <FiChevronRight className="customer-order-cta-chevron" />
              </button>
            </div>
          ) : null}

          {loading ? (
            <main className="customer-main customer-loading">
              <div className="customer-spinner" />
              <p>Loading menu...</p>
            </main>
          ) : (
            <main className="customer-main">
              <div className="category-scroll">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={`category-pill ${activeCategory === category ? "active" : ""}`}
                    onClick={() => setActiveCategory(category)}
                  >
                    {category === "all" ? "All" : category}
                  </button>
                ))}
              </div>

              <section className="customer-item-grid">
                {visibleItems.map((item) => (
                  <article key={item.id} className="customer-item-card">
                    <div className="customer-item-image-wrap">
                      <img src={item.imageUrl || "https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg"} alt="" loading="lazy" />
                    </div>
                    <div className="item-content">
                      <h3>{item.name}</h3>
                      <p>{item.description || "Chef’s special"}</p>
                      <div className="item-bottom">
                        <strong>{formatCurrency(item.price)}</strong>
                        <div className="qty-control">
                          <button type="button" aria-label="Decrease" onClick={() => changeQty(item.id, (cart[item.id] || 0) - 1)}>
                            <FiMinus />
                          </button>
                          <span>{cart[item.id] || 0}</span>
                          <button type="button" aria-label="Increase" onClick={() => changeQty(item.id, (cart[item.id] || 0) + 1)}>
                            <FiPlus />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            </main>
          )}

          <footer className="cart-bar">
            <div>
              <strong>{formatCurrency(total)}</strong>
              <p>{cartRows.length ? `${cartRows.length} dish types · ${cartRows.reduce((s, r) => s + r.qty, 0)} items` : "Cart empty"}</p>
            </div>
            <button type="button" onClick={openCheckout} disabled={placingOrder || !cartRows.length}>
              <FiShoppingBag /> Place order
            </button>
          </footer>
        </>
      ) : null}

      <CustomerChatbot
        restaurant={restaurant}
        table={table}
        items={items}
        cartRows={cartRows}
        total={total}
        trackingOrder={trackingOrder}
        invoiceData={invoiceData}
        storedOrderId={storedOrderId}
        reviewSubmitted={reviewSubmitted}
        categories={categories}
        loyalty={loyalty}
        loyaltyPhone={loyaltyPhone}
        loyaltyLoading={loyaltyLoading}
        onLoyaltyPhoneSubmit={linkLoyaltyPhone}
        onLoyaltyRedeem={redeemLoyaltyReward}
        loyaltyRedeeming={loyaltyRedeeming}
        showLoyalty={false}
        hasCartBar={!trackingOrder && !loading}
        showPayInvoiceBtn={showPayInvoiceBtn}
        invoiceModalOpen={invoiceModalOpen}
        reviewOpen={reviewOpen}
        checkoutOpen={checkoutOpen}
        serviceOpen={serviceOpen}
        onOpenCheckout={openCheckout}
        onOpenInvoice={() => setInvoiceModalOpen(true)}
        onOpenReview={() => setReviewOpen(true)}
        onOpenService={() => {
          void unlockWebAudio().then(() => playServiceRequestChime());
          setServiceOpen(true);
        }}
        onSendServiceRequest={sendServiceRequest}
        onAddToCart={addToCartVoice}
        onVoicePlaceOrder={placeVoiceOrder}
        onSubmitVoiceReview={submitVoiceReview}
        canSubmitReview={canSubmitReview}
      />

      {serviceOpen ? (
        <div className="customer-modal-backdrop" role="presentation" onClick={() => !serviceLoadingType && setServiceOpen(false)}>
          <div className="customer-modal invoice-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <header className="customer-modal-head">
              <h2>सेवा / Call Service</h2>
              <button type="button" className="customer-modal-close" onClick={() => setServiceOpen(false)} disabled={Boolean(serviceLoadingType)}>
                <FiX />
              </button>
            </header>
            <p className="customer-modal-hint">अपनी टेबल के लिए चुनिए · Select what you need at your table.</p>
            <div className="service-requests-grid">
              <button
                type="button"
                className="service-request-btn water"
                onClick={() => sendServiceRequest("water")}
                disabled={Boolean(serviceLoadingType)}
              >
                <span className="service-request-icon"><FiDroplet /></span>
                <span className="service-request-text">
                  <strong>{serviceLoadingType === "water" ? "भेज रहे हैं…" : "पानी / Water"}</strong>
                  <small>पीने का पानी · Drinking water</small>
                </span>
              </button>
              <button
                type="button"
                className="service-request-btn tissue"
                onClick={() => sendServiceRequest("tissue")}
                disabled={Boolean(serviceLoadingType)}
              >
                <span className="service-request-icon"><FiGrid /></span>
                <span className="service-request-text">
                  <strong>{serviceLoadingType === "tissue" ? "भेज रहे हैं…" : "टिशू / Tissue"}</strong>
                  <small>नैपकिन · Napkins</small>
                </span>
              </button>
              <button
                type="button"
                className="service-request-btn waiter"
                onClick={() => sendServiceRequest("waiter")}
                disabled={Boolean(serviceLoadingType)}
              >
                <span className="service-request-icon"><FiUser /></span>
                <span className="service-request-text">
                  <strong>{serviceLoadingType === "waiter" ? "भेज रहे हैं…" : "वेटर / Call Waiter"}</strong>
                  <small>कर्मचारी बुलाइए · Ask staff to come</small>
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
