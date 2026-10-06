
import { useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import JSZip from "jszip";
import QRCode from "qrcode";
import {
  FiBell,
  FiCheck,
  FiDownload,
  FiEdit2,
  FiFileText,
  FiHome,
  FiLayers,
  FiLogOut,
  FiMenu,
  FiPackage,
  FiPlus,
  FiSearch,
  FiMessageSquare,
  FiTrash2,
  FiX,
  FiGrid,
  FiShoppingBag,
  FiZap,
  FiAward
} from "react-icons/fi";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";
import { api } from "./config/api";
import { API_BASE_URL } from "./config/api";
import { LOYALTY_ENABLED } from "./config/features";
import { playAdminNewOrderChime, playServiceRequestChime, unlockWebAudio } from "./utils/sounds";
import { downloadInvoicePdfDocument, printInvoiceDocument } from "./utils/invoicePrint";
import swagatLogo from "../../frontend/public/swagatsuite.png";
import LoyaltyRewardsPage from "./components/LoyaltyRewardsPage";
import "./App.css";

const ORDER_STATUS_OPTIONS = ["Placed", "Preparing", "Ready", "Served", "Completed"];

const ADMIN_STORAGE_KEY = "restro_admin_auth";

const MENUS = [
  { key: "dashboard", label: "Dashboard", icon: FiHome },
  { key: "orders", label: "Orders Management", icon: FiPackage },
  { key: "menu", label: "Menu Management", icon: FiShoppingBag },
  { key: "tables", label: "Generate QR Menus", icon: FiGrid },
  { key: "invoices", label: "Generate Invoice", icon: FiFileText },
  { key: "reviews", label: "Reviews", icon: FiMessageSquare },
  { key: "loyalty", label: "Loyalty Rewards", icon: FiAward },
  { key: "service", label: "Service Requests", icon: FiBell },
  { key: "analytics", label: "Analytics", icon: FiLayers },
  { key: "settings", label: "Settings", icon: FiBell }
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function normalizeName(value) {
  return String(value || "").trim();
}

function formatDateDisplay(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatTimeDisplay(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function calcTrendPercent(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  const prev = Number(points[points.length - 2]?.total || 0);
  const next = Number(points[points.length - 1]?.total || 0);
  if (!prev) return next ? 100 : 0;
  return ((next - prev) / prev) * 100;
}

function formatCompact(value) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(Number(value || 0));
}

function parseMonthDayLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const mmdd = raw.match(/^(\d{2})-(\d{2})$/);
  if (mmdd) {
    const month = Number(mmdd[1]);
    const day = Number(mmdd[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { month, day };
    }
  }
  const yyyymmdd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) {
    const month = Number(yyyymmdd[2]);
    const day = Number(yyyymmdd[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { month, day };
    }
  }
  return null;
}

function formatTrendLabel(value, range = "week", detailed = false) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = parseMonthDayLabel(raw);
  if (parsed) {
    const dt = new Date(2000, parsed.month - 1, parsed.day);
    const monthName = dt.toLocaleDateString("en-IN", { month: detailed ? "long" : "short" });
    if (range === "month") {
      return monthName;
    }
    return `${String(parsed.day).padStart(2, "0")} ${monthName}`;
  }
  const token = raw.split(/\s+/)[0]?.toLowerCase() || "";
  const monthMap = {
    jan: "January",
    january: "January",
    feb: "February",
    february: "February",
    mar: "March",
    march: "March",
    apr: "April",
    april: "April",
    may: "May",
    jun: "June",
    june: "June",
    jul: "July",
    july: "July",
    aug: "August",
    august: "August",
    sep: "September",
    sept: "September",
    september: "September",
    oct: "October",
    october: "October",
    nov: "November",
    november: "November",
    dec: "December",
    december: "December"
  };
  const expanded = monthMap[token] || raw;
  return range === "month" && !detailed ? expanded.slice(0, 3) : expanded;
}

function DashboardTooltip({ active, payload, label, range = "week" }) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value || 0);
  const prevValue = Number(payload[1]?.value ?? value);
  const trend = prevValue ? ((value - prevValue) / prevValue) * 100 : 0;
  const point = payload[0]?.payload || {};
  const niceLabel = point?.monthName
    ? (range === "month" ? point.monthName : `${point.day || ""} ${point.monthName}`.trim())
    : formatTrendLabel(label, range, true);
  return (
    <div className="dashboard-tooltip">
      <p className="dashboard-tooltip-label">{niceLabel || "Period"}</p>
      <div className="dashboard-tooltip-value">{formatCompact(value)}</div>
      <p className={`dashboard-tooltip-trend ${trend >= 0 ? "up" : "down"}`}>
        {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
      </p>
    </div>
  );
}

function MiniSparkline({ data = [], color = "#7C3AED" }) {
  return (
    <div className="kpi-mini-sparkline">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`miniSpark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="total"
            stroke={color}
            strokeWidth={2}
            fill={`url(#miniSpark-${color.replace("#", "")})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function buildRestaurantAddress(restaurant) {
  if (!restaurant) return "";
  const parts = [
    restaurant.address,
    restaurant.city,
    restaurant.state,
    restaurant.pincode
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  return parts.join(", ");
}

function App() {
  const [searchParams] = useSearchParams();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [headerSearch, setHeaderSearch] = useState("");
  const [loginForm, setLoginForm] = useState({ identifier: "", password: "" });
  const [restaurant, setRestaurant] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    restaurant_code: "",
    name: "",
    owner_name: "",
    email: "",
    contact: "",
    password: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    gst_number: "",
    logo_url: "",
    plan: "Free",
    subscription_start_date: "",
    subscription_end_date: ""
  });
  const [dashboard, setDashboard] = useState({
    ordersToday: 0,
    revenueToday: 0,
    activeOrders: 0,
    orderTrend: [],
    revenueTrend: []
  });
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardRange, setDashboardRange] = useState("week");
  const [animatedKpis, setAnimatedKpis] = useState({
    ordersToday: 0,
    revenueToday: 0,
    activeOrders: 0
  });
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [generatingItemImage, setGeneratingItemImage] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [itemForm, setItemForm] = useState({
    name: "",
    price: "",
    category: "",
    description: "",
    imageUrl: "",
    available: true
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [quickPriceEditId, setQuickPriceEditId] = useState(null);
  const [quickPriceValue, setQuickPriceValue] = useState("");
  const [activeMenuView, setActiveMenuView] = useState("overview");
  const [invoiceMenuView, setInvoiceMenuView] = useState("served");
  const [manualInvoiceOpen, setManualInvoiceOpen] = useState(false);
  const [manualInvoiceSaving, setManualInvoiceSaving] = useState(false);
  const [walkInCategory, setWalkInCategory] = useState("all");
  const [manualInvoiceForm, setManualInvoiceForm] = useState({
    tableLabel: "",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    items: [{ name: "", qty: 1, unitPrice: 0 }]
  });
  const [tables, setTables] = useState([]);
  const [bulkTableCount, setBulkTableCount] = useState("10");
  const [manualTableName, setManualTableName] = useState("");
  const [qrMap, setQrMap] = useState({});
  const [ordersList, setOrdersList] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersView, setOrdersView] = useState("live");
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [serviceActionRequestId, setServiceActionRequestId] = useState(0);
  const [loyaltyOverview, setLoyaltyOverview] = useState(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltyRedeemId, setLoyaltyRedeemId] = useState(0);
  const loyaltyPollBootstrappedRef = useRef(false);
  const prevPendingRewardsRef = useRef(0);
  const [invoiceGeneratingOrderIds, setInvoiceGeneratingOrderIds] = useState([]);
  const ordersPollBootstrappedRef = useRef(false);
  const maxSeenOrderIdRef = useRef(0);
  const servicePollBootstrappedRef = useRef(false);
  const maxSeenServiceRequestIdRef = useRef(0);

  const fetchCategories = async (restaurantCode) => {
    const response = await api.get(`/admin/menu/${restaurantCode}/categories`);
    setCategories(response.data || []);
    return response.data || [];
  };

  const fetchItems = async (restaurantCode) => {
    const response = await api.get(`/admin/menu/${restaurantCode}/items`);
    setItems(response.data || []);
    return response.data || [];
  };

  const loadMenuManagement = async (restaurantCode) => {
    const loadedCategories = await fetchCategories(restaurantCode);
    await fetchItems(restaurantCode);
    setItemForm((prev) => ({ ...prev, category: prev.category || loadedCategories[0]?.name || "" }));
  };

  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setRestaurant(parsed.restaurant);
      setIsLoggedIn(true);
    }
  }, []);

  const loadDashboard = async (restaurantCode) => {
    setDashboardLoading(true);
    try {
      const response = await api.get(`/admin/dashboard/${restaurantCode}`);
      setRestaurant(response.data.restaurant);
      setDashboard({
        ordersToday: response.data.ordersToday,
        revenueToday: response.data.revenueToday,
        activeOrders: response.data.activeOrders,
        orderTrend: response.data.orderTrend,
        revenueTrend: response.data.revenueTrend
      });
    } finally {
      setDashboardLoading(false);
    }
  };

  const loadRestaurantProfile = async (restaurantCode) => {
    try {
      const response = await api.get(`/admin/restaurant/${restaurantCode}`);
      const loaded = response.data?.restaurant || null;
      if (loaded) setRestaurant(loaded);
      return loaded;
    } catch (error) {
      if (error.response?.status !== 404 || !restaurant?.id) throw error;
      const fallback = await api.get(`/restaurants/${restaurant.id}`);
      const loaded = fallback.data || null;
      if (loaded) setRestaurant(loaded);
      return loaded;
    }
  };

  const loadInvoices = async (restaurantCode) => {
    const response = await api.get(`/admin/invoices/${restaurantCode}`);
    const rows = response.data?.invoices || [];
    setInvoices(rows);
    return rows;
  };

  const loadReviews = async (restaurantCode) => {
    const response = await api.get(`/admin/reviews/${restaurantCode}`);
    const rows = response.data?.reviews || [];
    setReviews(rows);
    return rows;
  };

  const buildTableQrValue = (table) => {
    const params = new URLSearchParams({
      restaurant: restaurant?.restaurant_code || "",
      table: table.name,
      token: table.qrToken
    });
    return `${window.location.origin}/menu?${params.toString()}`;
  };

  const regenerateQrMap = async (tableRows) => {
    const entries = await Promise.all(
      tableRows.map(async (table) => {
        const dataUrl = await QRCode.toDataURL(buildTableQrValue(table), {
          width: 220,
          margin: 1
        });
        return [table.id, dataUrl];
      })
    );
    setQrMap(Object.fromEntries(entries));
  };

  const fetchTables = async (restaurantCode) => {
    const response = await api.get(`/admin/tables/${restaurantCode}`);
    const rows = response.data || [];
    setTables(rows);
    await regenerateQrMap(rows);
  };

  useEffect(() => {
    if (searchParams.get("autoLogin") !== "1") return;
    const restaurantCode = searchParams.get("restaurant");
    const token = searchParams.get("token");
    if (!restaurantCode || !token) return;

    const safeAuthState = {
      token,
      restaurant: {
        restaurant_code: restaurantCode,
        name: searchParams.get("name") || "",
        owner_name: searchParams.get("owner") || "",
        email: searchParams.get("email") || "",
        plan: searchParams.get("plan") || "Free",
        subscription_end_date: searchParams.get("endDate") || null,
        active: searchParams.get("active") === "1"
      }
    };

    try {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(safeAuthState));
    } catch (_storageError) {
      // Keep session in memory if browser blocks storage.
    }

    setRestaurant(safeAuthState.restaurant);
    setIsLoggedIn(true);
    toast.success("Logged in as restaurant from superadmin.");
  }, [searchParams]);

  useEffect(() => {
    if (!isLoggedIn || !restaurant?.restaurant_code) return;
    loadDashboard(restaurant.restaurant_code).catch(() => {
      toast.error("Dashboard could not be loaded.");
    });
  }, [isLoggedIn, restaurant?.restaurant_code]);

  useEffect(() => {
    if (!isLoggedIn || activeMenu !== "profile" || !restaurant?.restaurant_code) return;
    loadRestaurantProfile(restaurant.restaurant_code).catch(() => {
      toast.error("Profile could not be loaded.");
    });
  }, [isLoggedIn, activeMenu, restaurant?.restaurant_code]);

  useEffect(() => {
    const restaurantCode = searchParams.get("restaurant");
    if (!restaurantCode || !isLoggedIn) return;
    loadDashboard(restaurantCode).catch(() => {});
  }, [searchParams, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !restaurant?.restaurant_code || activeMenu !== "menu") return;
    loadMenuManagement(restaurant.restaurant_code).catch(() => {
      toast.error("Menu data could not be loaded.");
    });
  }, [isLoggedIn, restaurant?.restaurant_code, activeMenu]);

  useEffect(() => {
    if (!isLoggedIn || !restaurant?.restaurant_code || activeMenu !== "tables") return;
    fetchTables(restaurant.restaurant_code).catch(() => {
      toast.error("Tables could not be loaded.");
    });
  }, [isLoggedIn, restaurant?.restaurant_code, activeMenu]);

  useEffect(() => {
    ordersPollBootstrappedRef.current = false;
    maxSeenOrderIdRef.current = 0;
    servicePollBootstrappedRef.current = false;
    maxSeenServiceRequestIdRef.current = 0;
    loyaltyPollBootstrappedRef.current = false;
    prevPendingRewardsRef.current = 0;
  }, [restaurant?.restaurant_code]);

  useEffect(() => {
    if (!LOYALTY_ENABLED && activeMenu === "loyalty") {
      setActiveMenu("dashboard");
    }
  }, [activeMenu]);

  useEffect(() => {
    if (!isLoggedIn || !restaurant?.restaurant_code) return;

    const loadOrders = async () => {
      const isOrdersScreen = activeMenu === "orders";
      if (isOrdersScreen) setOrdersLoading(true);
      try {
        const response = await api.get(`/admin/orders/${restaurant.restaurant_code}`);
        const list = response.data.orders || [];
        const maxId = list.reduce((m, o) => Math.max(m, Number(o.id) || 0), 0);
        if (ordersPollBootstrappedRef.current && maxId > maxSeenOrderIdRef.current) {
          const newestId = list.find((o) => Number(o.id) === maxId);
          void unlockWebAudio().then(() => playAdminNewOrderChime());
          toast.success(`New order #${maxId}${newestId?.tableLabel ? ` · ${newestId.tableLabel}` : ""}`, { duration: 5000 });
        }
        ordersPollBootstrappedRef.current = true;
        maxSeenOrderIdRef.current = Math.max(maxSeenOrderIdRef.current, maxId);
        setOrdersList(list);
      } catch (_e) {
        if (activeMenu === "orders") {
          toast.error("Orders could not be loaded.");
        }
      } finally {
        if (isOrdersScreen) setOrdersLoading(false);
      }
    };

    loadOrders();
    const timer = window.setInterval(loadOrders, 4000);
    return () => window.clearInterval(timer);
  }, [isLoggedIn, restaurant?.restaurant_code, activeMenu]);

  useEffect(() => {
    if (!isLoggedIn || !restaurant?.restaurant_code) return;

    const loadServiceRequests = async () => {
      try {
        const response = await api.get(`/admin/service-requests/${restaurant.restaurant_code}`);
        const list = response.data?.requests || [];
        const maxId = list.reduce((m, row) => Math.max(m, Number(row.id) || 0), 0);
        if (servicePollBootstrappedRef.current && maxId > maxSeenServiceRequestIdRef.current) {
          const newest = list.find((row) => Number(row.id) === maxId);
          void unlockWebAudio().then(() => playServiceRequestChime());
          toast.success(
            `Service request${newest?.tableLabel ? ` · ${newest.tableLabel}` : ""}${newest?.requestType ? ` · ${String(newest.requestType).toUpperCase()}` : ""}`,
            { duration: 5000 }
          );
        }
        servicePollBootstrappedRef.current = true;
        maxSeenServiceRequestIdRef.current = Math.max(maxSeenServiceRequestIdRef.current, maxId);
        setServiceRequests(list);
      } catch (_e) {
        // Keep UI quiet for polling failures.
      }
    };

    loadServiceRequests();
    const timer = window.setInterval(loadServiceRequests, 4000);
    return () => window.clearInterval(timer);
  }, [isLoggedIn, restaurant?.restaurant_code]);

  useEffect(() => {
    if (!LOYALTY_ENABLED || !isLoggedIn || !restaurant?.restaurant_code) return;

    const loadLoyalty = async () => {
      const onLoyaltyScreen = activeMenu === "loyalty";
      if (onLoyaltyScreen) setLoyaltyLoading(true);
      try {
        const response = await api.get(`/admin/loyalty/${restaurant.restaurant_code}`);
        const data = response.data || null;
        const pending = Number(data?.summary?.pendingRewards || 0);
        if (loyaltyPollBootstrappedRef.current && pending > prevPendingRewardsRef.current) {
          toast.success(
            `Customer completed ${data?.stampsPerReward ?? 5} stamps — ${pending} reward${pending === 1 ? "" : "s"} ready to redeem`,
            { duration: 6000 }
          );
        }
        loyaltyPollBootstrappedRef.current = true;
        prevPendingRewardsRef.current = pending;
        setLoyaltyOverview(data);
      } catch (_e) {
        if (onLoyaltyScreen) toast.error("Loyalty data could not be loaded.");
      } finally {
        if (onLoyaltyScreen) setLoyaltyLoading(false);
      }
    };

    loadLoyalty();
    const timer = window.setInterval(loadLoyalty, 6000);
    return () => window.clearInterval(timer);
  }, [isLoggedIn, restaurant?.restaurant_code, activeMenu]);

  useEffect(() => {
    if (!isLoggedIn || !restaurant?.restaurant_code || (activeMenu !== "invoices" && activeMenu !== "orders")) return;
    loadInvoices(restaurant.restaurant_code).catch(() => {
      toast.error("Invoices could not be loaded.");
    });
  }, [isLoggedIn, restaurant?.restaurant_code, activeMenu]);

  useEffect(() => {
    if (!isLoggedIn || !restaurant?.restaurant_code || activeMenu !== "reviews") return;
    loadReviews(restaurant.restaurant_code).catch(() => {
      toast.error("Reviews could not be loaded.");
    });
  }, [isLoggedIn, restaurant?.restaurant_code, activeMenu]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const onPointer = () => {
      void unlockWebAudio();
    };
    document.addEventListener("pointerdown", onPointer, { passive: true });
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [isLoggedIn]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post("/admin/login", {
        identifier: loginForm.identifier.trim(),
        password: loginForm.password.trim()
      });
      if (response.data?.success) {
        void unlockWebAudio();
        const safeAuthState = {
          token: response.data.token,
          restaurant: {
            id: response.data.restaurant?.id,
            restaurant_code: response.data.restaurant?.restaurant_code,
            name: response.data.restaurant?.name,
            owner_name: response.data.restaurant?.owner_name,
            email: response.data.restaurant?.email,
            plan: response.data.restaurant?.plan,
            subscription_end_date: response.data.restaurant?.subscription_end_date,
            active: response.data.restaurant?.active
          }
        };
        try {
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(safeAuthState));
        } catch (_storageError) {
          // Allow login even if browser storage is full.
          toast.error("Session persistence is full. Logged in without refresh persistence.");
        }
        setRestaurant(response.data.restaurant);
        setIsLoggedIn(true);
        toast.success("Welcome to Swagat Suite Admin Panel.");
      }
    } catch (error) {
      const responseData = error.response?.data;
      const backendMessage =
        typeof responseData === "string" ? responseData : responseData?.message;

      if (error.code === "ERR_NETWORK") {
        toast.error(`Cannot connect to backend (${API_BASE_URL}).`);
        return;
      }
      if (error.code === "ECONNABORTED") {
        toast.error("Request timed out. Please try again.");
        return;
      }
      toast.error(backendMessage || error.message || "Login failed.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_STORAGE_KEY);
    setIsLoggedIn(false);
    setRestaurant(null);
  };

  useEffect(() => {
    if (!restaurant) return;
    setProfileForm({
      restaurant_code: restaurant?.restaurant_code || "",
      name: restaurant?.name || "",
      owner_name: restaurant?.owner_name || "",
      email: restaurant?.email || "",
      contact: restaurant?.contact || "",
      password: restaurant?.password || "",
      address: restaurant?.address || "",
      city: restaurant?.city || "",
      state: restaurant?.state || "",
      pincode: restaurant?.pincode || "",
      gst_number: restaurant?.gst_number || "",
      logo_url: restaurant?.logo_url || "",
      plan: restaurant?.plan || "Free",
      subscription_start_date: restaurant?.subscription_start_date ? String(restaurant.subscription_start_date).slice(0, 10) : "",
      subscription_end_date: restaurant?.subscription_end_date ? String(restaurant.subscription_end_date).slice(0, 10) : ""
    });
  }, [restaurant]);

  const handleProfileLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileForm((prev) => ({ ...prev, logo_url: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!restaurant?.restaurant_code) return;
    setProfileSaving(true);
    try {
      let updated = null;
      try {
        const response = await api.put(`/admin/restaurant/${restaurant.restaurant_code}`, profileForm);
        updated = response.data?.restaurant || null;
      } catch (error) {
        if (error.response?.status !== 404 || !restaurant?.id) throw error;
        const fallbackPayload = {
          name: profileForm.name,
          ownerName: profileForm.owner_name,
          email: profileForm.email,
          contact: profileForm.contact,
          password: profileForm.password,
          restaurantCode: profileForm.restaurant_code,
          address: profileForm.address,
          city: profileForm.city,
          state: profileForm.state,
          pincode: profileForm.pincode,
          gstNumber: profileForm.gst_number,
          logoUrl: profileForm.logo_url,
          plan: profileForm.plan || "Free",
          subscriptionStartDate: profileForm.subscription_start_date || null,
          subscriptionEndDate: profileForm.subscription_end_date || null
        };
        const fallback = await api.put(`/restaurants/${restaurant.id}`, fallbackPayload);
        updated = fallback.data || null;
      }
      if (updated) {
        setRestaurant(updated);
        try {
          const saved = localStorage.getItem(ADMIN_STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({ ...parsed, restaurant: updated }));
          }
        } catch (_e) {}
      }
      toast.success("Profile updated.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const initials = useMemo(() => {
    const name = restaurant?.owner_name || "Owner";
    return name
      .split(" ")
      .map((chunk) => chunk[0]?.toUpperCase())
      .slice(0, 2)
      .join("");
  }, [restaurant?.owner_name]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.category.toLowerCase().includes(normalizedSearch);
      const matchesFilter =
        stockFilter === "all" ||
        (stockFilter === "available" && item.available) ||
        (stockFilter === "out" && !item.available);
      return matchesSearch && matchesFilter;
    });
  }, [items, searchTerm, stockFilter]);

  const servedOrders = useMemo(
    () =>
      ordersList
        .filter((row) => row.tableId != null)
        .filter((row) => String(row.status || "").toLowerCase() === "served"),
    [ordersList]
  );

  const walkInCategories = useMemo(() => {
    const cats = Array.from(new Set(items.map((it) => it.category).filter(Boolean)));
    return ["all", ...cats];
  }, [items]);

  const walkInVisibleItems = useMemo(() => {
    const list = items.filter((it) => it.available);
    if (walkInCategory === "all") return list;
    return list.filter((it) => it.category === walkInCategory);
  }, [items, walkInCategory]);

  const qrOrdersOnly = useMemo(
    () => ordersList.filter((row) => row.tableId != null),
    [ordersList]
  );

  const liveOrdersOnly = useMemo(
    () => qrOrdersOnly.filter((row) => String(row.status || "").toLowerCase() !== "completed"),
    [qrOrdersOnly]
  );

  const historyOrdersOnly = useMemo(
    () => qrOrdersOnly.filter((row) => String(row.status || "").toLowerCase() === "completed"),
    [qrOrdersOnly]
  );

  const newPlacedOrdersCount = useMemo(
    () => qrOrdersOnly.filter((row) => String(row.status || "").toLowerCase() === "placed").length,
    [qrOrdersOnly]
  );

  const liveOrdersCount = liveOrdersOnly.length;
  const liveServiceRequestsCount = useMemo(
    () => serviceRequests.filter((row) => String(row.status || "").toLowerCase() !== "completed").length,
    [serviceRequests]
  );

  const pendingLoyaltyRewardsCount = useMemo(
    () => Number(loyaltyOverview?.summary?.pendingRewards || 0),
    [loyaltyOverview]
  );
  const orderTrendPercent = useMemo(() => calcTrendPercent(dashboard.orderTrend), [dashboard.orderTrend]);
  const revenueTrendPercent = useMemo(() => calcTrendPercent(dashboard.revenueTrend), [dashboard.revenueTrend]);
  const activeTrendPercent = useMemo(
    () => calcTrendPercent((dashboard.orderTrend || []).slice(-3)),
    [dashboard.orderTrend]
  );
  const ordersTrendData = useMemo(
    () => (dashboardRange === "month" ? (dashboard.orderTrend || []).slice(-30) : (dashboard.orderTrend || []).slice(-7)),
    [dashboard.orderTrend, dashboardRange]
  );
  const revenueTrendData = useMemo(
    () => (dashboardRange === "month" ? (dashboard.revenueTrend || []).slice(-30) : (dashboard.revenueTrend || []).slice(-7)),
    [dashboard.revenueTrend, dashboardRange]
  );
  const miniOrdersData = useMemo(() => (ordersTrendData || []).slice(-10), [ordersTrendData]);
  const miniRevenueData = useMemo(() => (revenueTrendData || []).slice(-10), [revenueTrendData]);
  const liveActivityItems = useMemo(() => {
    const orderEntries = liveOrdersOnly.slice(0, 5).map((row) => ({
      id: `order-${row.id}`,
      kind: "order",
      label: `${row.tableLabel || "Table"} ordered ${(row.items && row.items[0]?.name) || "items"}`,
      status: String(row.status || "Placed")
    }));
    const serviceEntries = serviceRequests
      .filter((row) => String(row.status || "").toLowerCase() !== "completed")
      .slice(0, 5)
      .map((row) => ({
        id: `service-${row.id}`,
        kind: "service",
        label: `${row.tableLabel || "Table"} requested ${String(row.requestType || "").toLowerCase()}`,
        status: String(row.status || "Pending")
      }));
    return [...serviceEntries, ...orderEntries].slice(0, 8);
  }, [liveOrdersOnly, serviceRequests]);
  const kitchenStatusCounts = useMemo(() => {
    const counts = { Placed: 0, Preparing: 0, Ready: 0, Served: 0 };
    liveOrdersOnly.forEach((row) => {
      const status = String(row.status || "");
      if (Object.prototype.hasOwnProperty.call(counts, status)) {
        counts[status] += 1;
      }
    });
    return counts;
  }, [liveOrdersOnly]);

  useEffect(() => {
    const duration = 700;
    const start = performance.now();
    const from = { ...animatedKpis };
    const to = {
      ordersToday: Number(dashboard.ordersToday || 0),
      revenueToday: Number(dashboard.revenueToday || 0),
      activeOrders: Number(dashboard.activeOrders || 0)
    };
    let raf = 0;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setAnimatedKpis({
        ordersToday: Math.round(from.ordersToday + (to.ordersToday - from.ordersToday) * eased),
        revenueToday: Math.round(from.revenueToday + (to.revenueToday - from.revenueToday) * eased),
        activeOrders: Math.round(from.activeOrders + (to.activeOrders - from.activeOrders) * eased)
      });
      if (progress < 1) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard.ordersToday, dashboard.revenueToday, dashboard.activeOrders]);

  const activeOrdersByTable = useMemo(() => {
    const map = new Map();
    qrOrdersOnly.forEach((row) => {
      const tableLabel = String(row.tableLabel || "").trim();
      const status = String(row.status || "").toLowerCase();
      if (!tableLabel || status === "completed") return;
      map.set(tableLabel, (map.get(tableLabel) || 0) + 1);
    });
    return map;
  }, [qrOrdersOnly]);

  const placedOrdersByTable = useMemo(() => {
    const map = new Map();
    qrOrdersOnly.forEach((row) => {
      const tableLabel = String(row.tableLabel || "").trim();
      const status = String(row.status || "").toLowerCase();
      if (!tableLabel || status !== "placed") return;
      map.set(tableLabel, (map.get(tableLabel) || 0) + 1);
    });
    return map;
  }, [qrOrdersOnly]);

  const invoiceByOrderId = useMemo(() => {
    const map = new Map();
    invoices.forEach((invoice) => {
      map.set(Number(invoice.orderId), invoice);
    });
    return map;
  }, [invoices]);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId) || null,
    [invoices, selectedInvoiceId]
  );

  const resetItemForm = () => {
    setItemForm({
      name: "",
      price: "",
      category: categories[0]?.name || "",
      description: "",
      imageUrl: "",
      available: true
    });
    setEditingItemId(null);
  };

  const openAddItemModal = () => {
    resetItemForm();
    setItemModalOpen(true);
  };

  const openEditItemModal = (item) => {
    setEditingItemId(item.id);
    setItemForm({
      name: item.name,
      price: String(item.price),
      category: item.category,
      description: item.description || "",
      imageUrl: item.imageUrl || "",
      available: Boolean(item.available)
    });
    setItemModalOpen(true);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setItemForm((prev) => ({ ...prev, imageUrl: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateItemImage = async () => {
    const name = normalizeName(itemForm.name);
    if (name.length < 2) {
      toast.error("Enter the item name first, then generate an image.");
      return;
    }
    setGeneratingItemImage(true);
    try {
      const { data } = await api.post(
        "/admin/menu/generate-item-image",
        {
          name,
          description: normalizeName(itemForm.description),
          category: normalizeName(itemForm.category)
        },
        { timeout: 120000 }
      );
      if (!data?.imageUrl) {
        toast.error("No image was returned. Try again.");
        return;
      }
      setItemForm((prev) => ({ ...prev, imageUrl: data.imageUrl }));
      toast.success(
        data.provider === "openai" ? "AI image generated (OpenAI)." : "AI image generated."
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not generate image. Try upload instead.");
    } finally {
      setGeneratingItemImage(false);
    }
  };

  const handleSaveItem = async () => {
    if (!normalizeName(itemForm.name) || !Number(itemForm.price) || !normalizeName(itemForm.category) || !itemForm.imageUrl) {
      toast.error("Please fill all required item fields.");
      return;
    }
    const selectedCategory = categories.find((category) => category.name === itemForm.category);
    if (!selectedCategory) {
      toast.error("Please select a valid category.");
      return;
    }
    const payload = {
      name: normalizeName(itemForm.name),
      price: Number(itemForm.price),
      categoryId: selectedCategory.id,
      description: normalizeName(itemForm.description),
      imageUrl: itemForm.imageUrl,
      available: Boolean(itemForm.available)
    };
    try {
      if (editingItemId) {
        await api.put(`/admin/menu/${restaurant.restaurant_code}/items/${editingItemId}`, payload);
        toast.success("Item updated.");
      } else {
        await api.post(`/admin/menu/${restaurant.restaurant_code}/items`, payload);
        toast.success("Item created.");
      }
      await fetchItems(restaurant.restaurant_code);
      setItemModalOpen(false);
      resetItemForm();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save item.");
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await api.delete(`/admin/menu/${restaurant.restaurant_code}/items/${itemId}`);
      await fetchItems(restaurant.restaurant_code);
      toast.success("Item deleted.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete item.");
    }
  };

  const handleToggleItemAvailability = async (itemId, nextAvailable) => {
    try {
      await api.patch(`/admin/menu/${restaurant.restaurant_code}/items/${itemId}/availability`, {
        available: nextAvailable
      });
      await fetchItems(restaurant.restaurant_code);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update stock status.");
    }
  };

  const handleStartQuickPriceEdit = (item) => {
    setQuickPriceEditId(item.id);
    setQuickPriceValue(String(item.price));
  };

  const handleSaveQuickPrice = async (itemId) => {
    const parsedPrice = Number(quickPriceValue);
    if (!parsedPrice || parsedPrice <= 0) {
      toast.error("Enter a valid price.");
      return;
    }
    try {
      await api.patch(`/admin/menu/${restaurant.restaurant_code}/items/${itemId}/price`, {
        price: parsedPrice
      });
      await fetchItems(restaurant.restaurant_code);
      setQuickPriceEditId(null);
      setQuickPriceValue("");
      toast.success("Price updated.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update price.");
    }
  };

  const handleAddCategory = async () => {
    const name = normalizeName(newCategoryName);
    if (!name) return;
    try {
      await api.post(`/admin/menu/${restaurant.restaurant_code}/categories`, { name });
      await fetchCategories(restaurant.restaurant_code);
      setNewCategoryName("");
      toast.success("Category added.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not add category.");
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setCategoryDraft(category.name);
  };

  const handleSaveCategory = async (categoryId) => {
    const name = normalizeName(categoryDraft);
    if (!name) return;
    try {
      await api.put(`/admin/menu/${restaurant.restaurant_code}/categories/${categoryId}`, { name });
      await Promise.all([fetchCategories(restaurant.restaurant_code), fetchItems(restaurant.restaurant_code)]);
      setEditingCategoryId(null);
      setCategoryDraft("");
      toast.success("Category updated.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update category.");
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    try {
      await api.delete(`/admin/menu/${restaurant.restaurant_code}/categories/${categoryId}`);
      await Promise.all([fetchCategories(restaurant.restaurant_code), fetchItems(restaurant.restaurant_code)]);
      if (itemForm.category && !categories.some((cat) => cat.name === itemForm.category && cat.id !== categoryId)) {
        setItemForm((prev) => ({ ...prev, category: "" }));
      }
      toast.success("Category deleted.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete category.");
    }
  };

  const handleBulkAddTables = async () => {
    const count = Number(bulkTableCount || 0);
    if (!count || count < 1 || count > 200) {
      toast.error("Enter table count between 1 and 200.");
      return;
    }
    try {
      await api.post(`/admin/tables/${restaurant.restaurant_code}/bulk`, { count });
      await fetchTables(restaurant.restaurant_code);
      toast.success("Tables added.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not add tables.");
    }
  };

  const handleManualAddTable = async () => {
    const name = normalizeName(manualTableName);
    if (!name) {
      toast.error("Please enter table name.");
      return;
    }
    try {
      await api.post(`/admin/tables/${restaurant.restaurant_code}`, { name });
      setManualTableName("");
      await fetchTables(restaurant.restaurant_code);
      toast.success("Table added.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not add table.");
    }
  };

  const handleRenameTable = async (table) => {
    const next = window.prompt("Rename table", table.name);
    const name = normalizeName(next);
    if (!name || name === table.name) return;
    try {
      await api.put(`/admin/tables/${restaurant.restaurant_code}/${table.id}`, { name });
      await fetchTables(restaurant.restaurant_code);
      toast.success("Table renamed.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not rename table.");
    }
  };

  const handleDeleteTable = async (tableId) => {
    const confirmed = window.confirm("Delete this table?");
    if (!confirmed) return;
    try {
      await api.delete(`/admin/tables/${restaurant.restaurant_code}/${tableId}`);
      await fetchTables(restaurant.restaurant_code);
      toast.success("Table deleted.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete table.");
    }
  };

  const handleToggleTable = async (table) => {
    try {
      await api.patch(`/admin/tables/${restaurant.restaurant_code}/${table.id}/toggle`, {
        active: !table.active
      });
      await fetchTables(restaurant.restaurant_code);
      toast.success("Table status updated.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update table.");
    }
  };

  const downloadDataUrl = (dataUrl, fileName) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadSingleQr = (table) => {
    const dataUrl = qrMap[table.id];
    if (!dataUrl) return;
    downloadDataUrl(dataUrl, `${table.name.replace(/\s+/g, "-").toLowerCase()}-qr.png`);
  };

  const handleDownloadAllQrs = async () => {
    if (!tables.length) return;
    const zip = new JSZip();
    for (const table of tables) {
      const dataUrl = qrMap[table.id];
      if (!dataUrl) continue;
      const base64 = dataUrl.split(",")[1];
      zip.file(`${table.name.replace(/\s+/g, "-").toLowerCase()}-qr.png`, base64, { base64: true });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, "all-table-qrs.zip");
    URL.revokeObjectURL(url);
  };

  const renderTablesPage = () => (
    <section className="panel-card menu-management-page">
      <article className="menu-block menu-management-header">
        <div className="menu-header-row">
          <div>
            <h3>Tables & QR Codes</h3>
            <p className="menu-subtitle">Print and place QR codes on each table for customers to scan.</p>
          </div>
          <button type="button" className="solid-action-btn" onClick={handleDownloadAllQrs} disabled={!tables.length}>
            <FiDownload /> Download All (ZIP)
          </button>
        </div>
      </article>

      <div className="menu-grid single-view">
        <article className="menu-block">
          <div className="table-setup-row">
            <div className="table-setup-card">
              <h4>Bulk Add Tables</h4>
              <div className="inline-form-row">
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={bulkTableCount}
                  onChange={(e) => setBulkTableCount(e.target.value)}
                  placeholder="Number of tables"
                />
                <button type="button" className="solid-action-btn" onClick={handleBulkAddTables}>Add</button>
              </div>
            </div>
            <div className="table-setup-card">
              <h4>Manual Add</h4>
              <div className="inline-form-row">
                <input
                  value={manualTableName}
                  onChange={(e) => setManualTableName(e.target.value)}
                  placeholder="Table A1 / Outdoor 2"
                />
                <button type="button" className="solid-action-btn" onClick={handleManualAddTable}>Add</button>
              </div>
            </div>
          </div>

          {!tables.length ? (
            <div className="empty-items-state">
              <h4>No tables added yet</h4>
              <p>Create tables to generate unique QR codes automatically.</p>
              <button type="button" className="solid-action-btn" onClick={handleBulkAddTables}>
                <FiPlus /> Add Tables
              </button>
            </div>
          ) : (
            <div className="table-card-grid">
              {tables.map((table) => {
                const tableName = String(table.name || "").trim();
                const activeOrdersCount = activeOrdersByTable.get(tableName) || 0;
                const placedCount = placedOrdersByTable.get(tableName) || 0;
                return (
                <article
                  key={table.id}
                  className={`table-qr-card ${activeOrdersCount ? "has-active-order" : ""} ${placedCount ? "has-new-order" : ""}`}
                >
                  <div className="table-qr-preview">
                    {qrMap[table.id] ? <img src={qrMap[table.id]} alt={`${table.name} QR`} /> : null}
                  </div>
                  <div className="table-qr-meta">
                    <div className="table-name-wrap">
                      <strong>{table.name}</strong>
                      {activeOrdersCount ? (
                        <span className="table-order-badge">{activeOrdersCount} Order{activeOrdersCount > 1 ? "s" : ""}</span>
                      ) : null}
                      {placedCount ? <span className="table-new-badge">New</span> : null}
                    </div>
                    <span className={`status-pill ${table.active ? "active" : "inactive"}`}>
                      {table.active ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="mini-btn" onClick={() => handleDownloadSingleQr(table)}>
                      <FiDownload />
                    </button>
                    <button type="button" className="mini-btn" onClick={() => handleRenameTable(table)}>
                      <FiEdit2 />
                    </button>
                    <button type="button" className="mini-btn" onClick={() => handleToggleTable(table)}>
                      {table.active ? "Off" : "On"}
                    </button>
                    <button type="button" className="mini-btn danger" onClick={() => handleDeleteTable(table.id)}>
                      <FiTrash2 />
                    </button>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </section>
  );

  const handleOrderStatusChange = async (orderId, status) => {
    try {
      const { data } = await api.patch(`/admin/orders/${restaurant.restaurant_code}/${orderId}/status`, {
        status
      });
      setOrdersList((prev) =>
        prev.map((row) => (Number(row.id) === Number(orderId) ? { ...row, status } : row))
      );
      if (LOYALTY_ENABLED && data?.loyaltyStamp?.awarded) {
        toast.success(
          data.loyaltyStamp.rewardUnlocked
            ? status === "Completed"
              ? "Order completed — customer earned final stamp and unlocked a ₹500 reward!"
              : "Order served — customer earned a stamp and unlocked a ₹500 reward!"
            : status === "Completed"
              ? `Order completed — loyalty stamp ${data.loyaltyStamp.stampEarned}/5 credited.`
              : `Order updated — loyalty stamp ${data.loyaltyStamp.stampEarned}/5 credited.`
        );
      } else if (status === "Completed") {
        toast.success("Order completed.");
      } else {
        toast.success("Order status updated.");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update status.");
    }
  };

  const handleDeleteOrder = async (orderId) => {
    const confirmed = window.confirm("Delete this order?");
    if (!confirmed) return;
    try {
      await api.delete(`/admin/orders/${restaurant.restaurant_code}/${orderId}`);
      setOrdersList((prev) => prev.filter((row) => Number(row.id) !== Number(orderId)));
      await loadInvoices(restaurant.restaurant_code);
      toast.success("Order deleted.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete order.");
    }
  };

  const handleGenerateInvoice = async (order) => {
    const orderId = Number(order?.id);
    if (!orderId) return;
    if (invoiceGeneratingOrderIds.includes(orderId)) return;

    const existing = invoiceByOrderId.get(Number(order.id));
    if (existing) {
      setSelectedInvoiceId(existing.id);
      return;
    }
    setInvoiceGeneratingOrderIds((prev) => [...prev, orderId]);
    try {
      const response = await api.post(`/admin/invoices/${restaurant.restaurant_code}/from-order/${order.id}`);
      const created = response.data?.invoice;
      if (!created) throw new Error("Invoice could not be created.");
      await loadInvoices(restaurant.restaurant_code);
      setSelectedInvoiceId(created.id);
      toast.success(`Invoice #${created.invoiceNo} generated.`);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Could not generate invoice.");
    } finally {
      setInvoiceGeneratingOrderIds((prev) => prev.filter((id) => id !== orderId));
    }
  };

  const handleMarkInvoicePaid = async (invoiceId) => {
    try {
      await api.patch(`/admin/invoices/${restaurant.restaurant_code}/${invoiceId}/payment`, {
        paymentStatus: "Paid"
      });
      await loadInvoices(restaurant.restaurant_code);
      toast.success("Invoice marked as paid.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update payment status.");
    }
  };

  const handlePrintInvoice = (invoiceId) => {
    const invoice = invoices.find((row) => row.id === invoiceId);
    if (!invoice) return;
    setSelectedInvoiceId(invoiceId);
    printInvoiceDocument({ invoice, restaurant });
  };

  const handleDownloadInvoicePdf = (invoiceId) => {
    const invoice = invoices.find((row) => row.id === invoiceId);
    if (!invoice) return;
    setSelectedInvoiceId(invoiceId);
    downloadInvoicePdfDocument({ invoice, restaurant });
  };

  const handleDeleteInvoice = async (invoiceId) => {
    if (!restaurant?.restaurant_code) return;
    const confirmed = window.confirm("Delete this invoice?");
    if (!confirmed) return;
    try {
      await api.delete(`/admin/invoices/${restaurant.restaurant_code}/${invoiceId}`);
      await loadInvoices(restaurant.restaurant_code);
      if (selectedInvoiceId === invoiceId) setSelectedInvoiceId(null);
      toast.success("Invoice deleted.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete invoice.");
    }
  };

  const ordersForView = ordersView === "history" ? historyOrdersOnly : liveOrdersOnly;

  const renderOrdersManagement = () => (
    <section className="panel-card orders-management-page">
      <article className="menu-block menu-management-header">
        <div className="menu-header-row">
          <div>
            <h3>Orders</h3>
            <p className="menu-subtitle">
              Table QR orders from guests appear here as they come in. Use the status column to move each order from placed through to completed. Guest and item details are shown for new orders; older or test rows may only list table and total.
            </p>
          </div>
          <div className="subnav-row">
            <button
              type="button"
              className={`subnav-btn ${ordersView === "live" ? "active" : ""}`}
              onClick={() => setOrdersView("live")}
            >
              Live Orders{liveOrdersCount ? ` (${liveOrdersCount})` : ""}
            </button>
            <button
              type="button"
              className={`subnav-btn ${ordersView === "history" ? "active" : ""}`}
              onClick={() => setOrdersView("history")}
            >
              Order History{historyOrdersOnly.length ? ` (${historyOrdersOnly.length})` : ""}
            </button>
          </div>
        </div>
      </article>

      {ordersLoading && !ordersForView.length ? (
        <p className="orders-loading-msg">Loading orders…</p>
      ) : null}

      {!ordersForView.length && !ordersLoading ? (
        <div className="empty-items-state">
          <h4>{ordersView === "history" ? "No completed orders yet" : "No live orders right now"}</h4>
          <p>
            {ordersView === "history"
              ? "Completed orders will appear here automatically."
              : "New QR orders will appear here until they are completed."}
          </p>
        </div>
      ) : (
        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Table</th>
                <th>Customer</th>
                <th>Contact</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Time</th>
                <th>Invoice</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {ordersForView.map((row) => (
                <tr
                  key={row.id}
                  className={[
                    String(row.status || "").toLowerCase() !== "completed" ? "order-row-active" : ""
                  ].filter(Boolean).join(" ")}
                >
                  <td data-label="Order #">{row.id}</td>
                  <td data-label="Table">
                    <span className="orders-table-pill">{row.tableLabel || "—"}</span>
                    {String(row.status || "").toLowerCase() === "placed" ? (
                      <span className="order-placed-badge">New</span>
                    ) : null}
                  </td>
                  <td data-label="Customer">
                    <div className="orders-cell-stack">
                      {row.customerName || row.customerEmail ? (
                        <>
                          <span>{row.customerName || "—"}</span>
                          {row.customerEmail ? <small>{row.customerEmail}</small> : null}
                        </>
                      ) : (
                        <span className="orders-missing-meta">Not stored for this order</span>
                      )}
                    </div>
                  </td>
                  <td data-label="Contact">
                    {row.customerPhone ? (
                      row.customerPhone
                    ) : (
                      <span className="orders-missing-meta">—</span>
                    )}
                  </td>
                  <td data-label="Items">
                    {(row.items || []).length ? (
                      <ul className="orders-items-inline">
                        {(row.items || []).map((line, index) => (
                          <li key={`${row.id}-${line.itemId}-${line.name}`}>
                            {line.name} × {line.qty}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="orders-missing-meta">Not stored for this order</span>
                    )}
                  </td>
                  <td data-label="Amount">{formatCurrency(row.amount)}</td>
                  <td data-label="Status">
                    <select
                      className="orders-status-select"
                      value={row.status}
                      onChange={(e) => handleOrderStatusChange(row.id, e.target.value)}
                    >
                      {ORDER_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td data-label="Time">
                    {row.createdAt
                      ? String(row.createdAt).replace("T", " ").slice(0, 16)
                      : "—"}
                  </td>
                  <td data-label="Invoice">
                    {invoiceByOrderId.get(Number(row.id)) ? (
                      <button
                        type="button"
                        className="mini-action-text-btn"
                        onClick={() => setSelectedInvoiceId(invoiceByOrderId.get(Number(row.id)).id)}
                      >
                        Generated
                      </button>
                    ) : String(row.status || "").toLowerCase() === "served" ? (
                      <button
                        type="button"
                        className="mini-action-text-btn"
                        onClick={() => handleGenerateInvoice(row)}
                        disabled={Boolean(invoiceByOrderId.get(Number(row.id))) || invoiceGeneratingOrderIds.includes(Number(row.id))}
                      >
                        {invoiceByOrderId.get(Number(row.id))
                          ? "Generated"
                          : invoiceGeneratingOrderIds.includes(Number(row.id))
                            ? "Generating..."
                            : "Generate"}
                      </button>
                    ) : (
                      <span className="orders-missing-meta">Serve first</span>
                    )}
                  </td>
                  <td data-label="Action">
                    <button type="button" className="mini-btn danger" onClick={() => handleDeleteOrder(row.id)}>
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const renderInvoicesPage = () => (
    <section className="panel-card invoices-page">
      <article className="menu-block menu-management-header">
        <div className="menu-header-row">
          <div>
            <h3>Generate Invoice</h3>
            <p className="menu-subtitle">
              Automatic billing for served orders. Select a served order and generate the receipt in one click.
            </p>
          </div>
          <div className="subnav-row">
            <button
              type="button"
              className={`subnav-btn ${invoiceMenuView === "served" ? "active" : ""}`}
              onClick={() => setInvoiceMenuView("served")}
            >
              Served Orders
            </button>
            <button
              type="button"
              className={`subnav-btn ${invoiceMenuView === "invoices" ? "active" : ""}`}
              onClick={() => setInvoiceMenuView("invoices")}
            >
              Invoices
            </button>
            <button
              type="button"
              className="subnav-btn"
              onClick={() => {
                setManualInvoiceOpen(true);
                setWalkInCategory("all");
                if (restaurant?.restaurant_code && !items.length) {
                  fetchItems(restaurant.restaurant_code).catch(() => {});
                  fetchCategories(restaurant.restaurant_code).catch(() => {});
                }
              }}
            >
              Walk-in Invoice
            </button>
          </div>
        </div>
      </article>

      <div className="invoice-page-grid">
        {invoiceMenuView === "served" ? (
        <article className="menu-block">
          <h4 className="invoice-block-title">Served Orders</h4>
          {!servedOrders.length ? (
            <div className="empty-items-state">
              <h4>No served orders yet</h4>
              <p>Orders with status "Served" will appear here automatically.</p>
            </div>
          ) : (
            <div className="invoice-order-list">
              {servedOrders.map((order) => {
                const existing = invoiceByOrderId.get(Number(order.id));
                return (
                  <div key={order.id} className="invoice-order-row">
                    <div>
                      <strong>Order #{order.id}</strong>
                      <p>{order.tableLabel || "—"} • {order.customerName || "Guest"}</p>
                      <small>{formatCurrency(order.amount)}</small>
                    </div>
                    <button
                      type="button"
                      className="solid-action-btn"
                      onClick={() => handleGenerateInvoice(order)}
                      disabled={Boolean(existing) || invoiceGeneratingOrderIds.includes(Number(order.id))}
                    >
                      {existing
                        ? "Generated"
                        : invoiceGeneratingOrderIds.includes(Number(order.id))
                          ? "Generating..."
                          : "Generate"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </article>
        ) : null}
        {invoiceMenuView === "invoices" ? (
        <article className="menu-block">
          <h4 className="invoice-block-title">Invoices</h4>
          {!invoices.length ? (
            <p className="orders-missing-meta">No invoices generated yet.</p>
          ) : (
            <div className="invoice-history-list">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className={`invoice-history-row ${selectedInvoiceId === invoice.id ? "active" : ""}`}
                >
                  <button type="button" className="invoice-history-main" onClick={() => setSelectedInvoiceId(invoice.id)}>
                    <strong>Invoice #{invoice.invoiceNo}</strong>
                    <small>{formatDateDisplay(invoice.createdAt)} • {formatCurrency(invoice.total)}</small>
                  </button>
                  <div className="invoice-history-actions">
                    <button type="button" className="mini-btn" onClick={() => handlePrintInvoice(invoice.id)}>
                      Print
                    </button>
                    <button type="button" className="mini-btn" onClick={() => handleDownloadInvoicePdf(invoice.id)}>
                      PDF
                    </button>
                    {invoice.paymentStatus !== "Paid" ? (
                      <button type="button" className="mini-btn save" onClick={() => handleMarkInvoicePaid(invoice.id)}>
                        Paid
                      </button>
                    ) : null}
                    <button type="button" className="mini-btn danger" onClick={() => handleDeleteInvoice(invoice.id)}>
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
        ) : null}
      </div>

      {selectedInvoice && selectedInvoice.paymentStatus !== "Paid" ? (
        <section className="invoice-preview-wrap">
          <div className="thermal-invoice">
            {restaurant?.logo_url ? <img src={restaurant.logo_url} alt="Restaurant logo" className="invoice-logo" /> : null}
            <h4 className="invoice-restro-name">{restaurant?.name || "Restaurant"}</h4>
            {buildRestaurantAddress(restaurant) ? (
              <p className="invoice-restro-address">{buildRestaurantAddress(restaurant)}</p>
            ) : null}
            {restaurant?.gst_number ? (
              <p className="invoice-restro-gst">{`GSTIN: ${restaurant.gst_number}`}</p>
            ) : null}
            <div className="invoice-dash-line" />
            <div className="receipt-title">RECEIPT</div>
            <div className="invoice-meta-grid">
              <div className="invoice-meta-row"><span>Name</span><span>{selectedInvoice.customerName || "-"}</span></div>
              <div className="invoice-meta-row"><span>Table</span><span>{selectedInvoice.tableLabel || "-"}</span></div>
              <div className="invoice-meta-row"><span>Invoice No</span><span>{selectedInvoice.invoiceNo}</span></div>
              <div className="invoice-meta-row"><span>Date</span><span>{formatDateDisplay(selectedInvoice.createdAt)}</span></div>
            </div>
            <div className="invoice-dash-line" />
            <div className="invoice-item-head">
              <span>Item</span>
              <span>Price</span>
              <span>Qty</span>
              <span>Total</span>
            </div>
            {selectedInvoice.items.map((line, index) => (
              <div key={`${selectedInvoice.id}-${index}`} className="invoice-item-row">
                <span>{line.name}</span>
                <span>{formatCurrency(line.unitPrice ?? line.price)}</span>
                <span>{line.qty}</span>
                <span>{formatCurrency(line.lineTotal ?? line.subtotal)}</span>
              </div>
            ))}
            <div className="invoice-dash-line" />
            <div className="invoice-summary-row"><span>Sub-Total:</span><strong>{formatCurrency(selectedInvoice.subTotal)}</strong></div>
            <div className="invoice-summary-row"><span>GST (18%):</span><strong>{formatCurrency(selectedInvoice.gstAmount)}</strong></div>
            <div className="invoice-dash-line" />
            <div className="invoice-summary-row total"><span>Total:</span><strong>{formatCurrency(selectedInvoice.total)}</strong></div>
            <div className="invoice-summary-row"><span>Mode:</span><span>{selectedInvoice.paymentMode}</span></div>
            <div className="invoice-summary-row"><span>Status:</span><span>{selectedInvoice.paymentStatus}</span></div>
            <div className="invoice-dash-line" />
            <p className="invoice-save-line">**SAVE PAPER SAVE NATURE !!</p>
            <p className="invoice-time-line">Time: {formatTimeDisplay(selectedInvoice.createdAt)}</p>
          </div>
        </section>
      ) : null}
    </section>
  );

  const addManualLine = () => {
    setManualInvoiceForm((prev) => ({
      ...prev,
      items: [...prev.items, { name: "", qty: 1, unitPrice: 0 }]
    }));
  };

  const removeManualLine = (index) => {
    setManualInvoiceForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const saveManualInvoice = async () => {
    if (!restaurant?.restaurant_code) return;
    const customerName = String(manualInvoiceForm.customerName || "").trim();
    const customerPhone = String(manualInvoiceForm.customerPhone || "").replace(/\D/g, "");
    if (customerName.length < 2) {
      toast.error("Customer name is required.");
      return;
    }
    if (customerPhone.length < 10) {
      toast.error("Valid phone number is required.");
      return;
    }
    const items = (manualInvoiceForm.items || [])
      .map((row) => ({
        name: String(row.name || "").trim(),
        qty: Number(row.qty || 1),
        unitPrice: Number(row.unitPrice || 0)
      }))
      .filter((row) => row.name && row.qty > 0 && row.unitPrice >= 0);
    if (!items.length) {
      toast.error("Add at least 1 valid item.");
      return;
    }
    setManualInvoiceSaving(true);
    try {
      const response = await api.post(`/admin/orders/${restaurant.restaurant_code}/manual-served`, {
        tableLabel: manualInvoiceForm.tableLabel,
        customerName,
        customerPhone,
        customerEmail: manualInvoiceForm.customerEmail,
        items
      });
      const createdInvoice = response.data?.invoice;
      if (createdInvoice) {
        await loadInvoices(restaurant.restaurant_code);
        setSelectedInvoiceId(createdInvoice.id);
        setInvoiceMenuView("invoices");
      }
      await Promise.all([
        api.get(`/admin/orders/${restaurant.restaurant_code}`).then((r) => setOrdersList(r.data.orders || [])).catch(() => {})
      ]);
      toast.success("Invoice created.");
      setManualInvoiceOpen(false);
      setManualInvoiceForm({
        tableLabel: "",
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        items: [{ name: "", qty: 1, unitPrice: 0 }]
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not create manual invoice.");
    } finally {
      setManualInvoiceSaving(false);
    }
  };

  const renderProfilePage = () => (
    <section className="panel-card profile-page">
      <article className="menu-block menu-management-header">
        <div className="menu-header-row">
          <div>
            <h3>Profile</h3>
            <p className="menu-subtitle">View and edit your restaurant details.</p>
          </div>
          <div className="row-actions">
            <button type="button" className="solid-action-btn" onClick={handleSaveProfile} disabled={profileSaving}>
              {profileSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </article>

      <article className="menu-block profile-form-card">
        <h4>SECTION 1: BASIC DETAILS</h4>
        <div className="profile-form-grid">
          <label>
            Restaurant/Cafe Name
            <input value={profileForm.name} onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))} />
          </label>
          <label>
            Owner Name
            <input value={profileForm.owner_name} onChange={(e) => setProfileForm((p) => ({ ...p, owner_name: e.target.value }))} />
          </label>
          <label>
            Email
            <input type="email" value={profileForm.email} onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))} />
          </label>
          <label>
            Phone Number
            <input value={profileForm.contact} onChange={(e) => setProfileForm((p) => ({ ...p, contact: e.target.value }))} />
          </label>
          <label>
            Password
            <input value={profileForm.password} onChange={(e) => setProfileForm((p) => ({ ...p, password: e.target.value }))} />
          </label>
          <label>
            Restaurant ID
            <input value={profileForm.restaurant_code} onChange={(e) => setProfileForm((p) => ({ ...p, restaurant_code: e.target.value }))} />
          </label>
        </div>

        <h4>SECTION 2: BUSINESS INFO</h4>
        <div className="profile-form-grid">
          <label className="profile-span-2">
            Restaurant Address
            <input value={profileForm.address} onChange={(e) => setProfileForm((p) => ({ ...p, address: e.target.value }))} />
          </label>
          <label>
            City
            <input value={profileForm.city} onChange={(e) => setProfileForm((p) => ({ ...p, city: e.target.value }))} />
          </label>
          <label>
            State
            <input value={profileForm.state} onChange={(e) => setProfileForm((p) => ({ ...p, state: e.target.value }))} />
          </label>
          <label>
            Pincode
            <input value={profileForm.pincode} onChange={(e) => setProfileForm((p) => ({ ...p, pincode: e.target.value }))} />
          </label>
          <label>
            GSTIN (optional)
            <input value={profileForm.gst_number} onChange={(e) => setProfileForm((p) => ({ ...p, gst_number: e.target.value }))} />
          </label>
          <label>
            Logo (upload image)
            <input type="file" accept="image/*" onChange={handleProfileLogoUpload} />
          </label>
        </div>

      </article>
    </section>
  );

  const renderReviewsPage = () => (
    <section className="panel-card orders-management-page">
      <article className="menu-block menu-management-header">
        <div className="menu-header-row">
          <div>
            <h3>Reviews</h3>
            <p className="menu-subtitle">Customer feedback submitted after paid invoices.</p>
          </div>
        </div>
      </article>
      {!reviews.length ? (
        <div className="empty-items-state">
          <h4>No reviews yet</h4>
          <p>Paid customers can submit ratings from the customer link.</p>
        </div>
      ) : (
        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Table</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Rating</th>
                <th>Comment</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((row) => (
                <tr key={row.id}>
                  <td data-label="Order #">{row.orderId}</td>
                  <td data-label="Table">{row.tableLabel || "—"}</td>
                  <td data-label="Customer">{row.customerName || "Guest"}</td>
                  <td data-label="Phone">{row.customerPhone || "—"}</td>
                  <td data-label="Rating">{row.rating} / 5</td>
                  <td data-label="Comment">{row.comment || "—"}</td>
                  <td data-label="Date">{row.createdAt ? String(row.createdAt).replace("T", " ").slice(0, 16) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const handleLoyaltyRedeem = async (loyaltyId) => {
    if (!restaurant?.restaurant_code || !loyaltyId) return;
    setLoyaltyRedeemId(Number(loyaltyId));
    try {
      const response = await api.patch(
        `/admin/loyalty/${restaurant.restaurant_code}/${loyaltyId}/redeem`
      );
      if (response.data?.overview) {
        setLoyaltyOverview(response.data.overview);
        prevPendingRewardsRef.current = Number(response.data.overview?.summary?.pendingRewards || 0);
      }
      toast.success(response.data?.message || "Reward marked as redeemed.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not mark reward as redeemed.");
    } finally {
      setLoyaltyRedeemId(0);
    }
  };

  const handleServiceRequestStatus = async (requestId, status) => {
    if (!restaurant?.restaurant_code || !requestId) return;
    setServiceActionRequestId(Number(requestId));
    try {
      await api.patch(`/admin/service-requests/${restaurant.restaurant_code}/${requestId}/status`, { status });
      setServiceRequests((prev) =>
        prev.map((row) => (Number(row.id) === Number(requestId) ? { ...row, status } : row))
      );
      toast.success(`Request marked ${String(status).toLowerCase()}.`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update request.");
    } finally {
      setServiceActionRequestId(0);
    }
  };

  const renderServiceRequestsPage = () => (
    <section className="panel-card orders-management-page">
      <article className="menu-block menu-management-header">
        <div className="menu-header-row">
          <div>
            <h3>Service Requests</h3>
            <p className="menu-subtitle">Bell calls from customer link appear here in real-time.</p>
          </div>
        </div>
      </article>
      {!serviceRequests.length ? (
        <div className="empty-items-state">
          <h4>No service requests</h4>
          <p>Customer bell taps for water, tissue, or waiter will show here.</p>
        </div>
      ) : (
        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Table</th>
                <th>Type</th>
                <th>Status</th>
                <th>Time</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {serviceRequests.map((row) => {
                const status = String(row.status || "");
                const busy = Number(serviceActionRequestId) === Number(row.id);
                return (
                  <tr key={row.id}>
                    <td data-label="ID">#{row.id}</td>
                    <td data-label="Table">{row.tableLabel || "—"}</td>
                    <td data-label="Type">{String(row.requestType || "").toUpperCase()}</td>
                    <td data-label="Status">
                      <span className={`status-pill ${status === "Completed" ? "active" : "inactive"}`}>{status}</span>
                    </td>
                    <td data-label="Time">{row.createdAt ? String(row.createdAt).replace("T", " ").slice(0, 16) : "—"}</td>
                    <td data-label="Action">
                      <div className="invoice-history-actions">
                        {status === "Pending" ? (
                          <button
                            type="button"
                            className="mini-btn"
                            onClick={() => handleServiceRequestStatus(row.id, "Acknowledged")}
                            disabled={busy}
                          >
                            Ack
                          </button>
                        ) : null}
                        {status !== "Completed" ? (
                          <button
                            type="button"
                            className="mini-btn save"
                            onClick={() => handleServiceRequestStatus(row.id, "Completed")}
                            disabled={busy}
                          >
                            Done
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const renderMenuManagement = () => (
    <section className="panel-card menu-management-page">
      <article className="menu-block menu-management-header">
        <div className="menu-header-row">
          <div>
            <h3>Menu Management</h3>
            <p className="menu-subtitle">Manage categories, items, pricing and stock in one place</p>
          </div>
          <div className="subnav-row">
            <button
              type="button"
              className={`subnav-btn ${activeMenuView === "overview" ? "active" : ""}`}
              onClick={() => setActiveMenuView("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              className={`subnav-btn ${activeMenuView === "categories" ? "active" : ""}`}
              onClick={() => setActiveMenuView("categories")}
            >
              Categories
            </button>
            <button
              type="button"
              className={`subnav-btn ${activeMenuView === "items" ? "active" : ""}`}
              onClick={() => setActiveMenuView("items")}
            >
              Items
            </button>
          </div>
        </div>
      </article>

      <div className={`menu-grid ${activeMenuView === "overview" ? "" : "single-view"}`}>
        {activeMenuView !== "items" ? (
        <article className="menu-block categories-block">
          <div className="menu-header-row">
            <h3>Categories</h3>
          </div>
          <div className="category-add-row">
            <input
              placeholder="Add category"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
            <button className="solid-action-btn" type="button" onClick={handleAddCategory}>
              <FiPlus /> Add
            </button>
          </div>
          <div className="category-list">
            {categories.map((category) => (
              <div key={category.id} className="category-row">
                {editingCategoryId === category.id ? (
                  <input
                    value={categoryDraft}
                    onChange={(e) => setCategoryDraft(e.target.value)}
                  />
                ) : (
                  <strong>{category.name}</strong>
                )}
                <div className="row-actions">
                  {editingCategoryId === category.id ? (
                    <button type="button" className="mini-btn save" onClick={() => handleSaveCategory(category.id)}>
                      <FiCheck />
                    </button>
                  ) : (
                    <button type="button" className="mini-btn" onClick={() => handleEditCategory(category)}>
                      <FiEdit2 />
                    </button>
                  )}
                  <button type="button" className="mini-btn danger" onClick={() => handleDeleteCategory(category.id)}>
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
        ) : null}

        {activeMenuView !== "categories" ? (
        <article className="menu-block items-block">
          <div className="menu-header-row">
            <h3>Items List</h3>
            <div className="items-tools">
              <div className="search-wrap">
                <FiSearch />
                <input
                  placeholder="Search items"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="available">Available</option>
                <option value="out">Out of stock</option>
              </select>
              <button type="button" className="solid-action-btn" onClick={openAddItemModal}>
                <FiPlus /> Add Item
              </button>
            </div>
          </div>

          <div className="category-chip-row">
            {categories.map((category) => (
              <button
                key={`chip-${category.id}`}
                type="button"
                className={`category-chip ${searchTerm.toLowerCase() === category.name.toLowerCase() ? "active" : ""}`}
                onClick={() => setSearchTerm(category.name)}
              >
                {category.name}
              </button>
            ))}
            {searchTerm ? (
              <button type="button" className="category-chip clear" onClick={() => setSearchTerm("")}>
                Clear
              </button>
            ) : null}
          </div>

          <div className="items-card-grid">
            {filteredItems.length ? (
              filteredItems.map((item) => (
                <article key={item.id} className="menu-item-card">
                  <div className="menu-item-image-wrap">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="menu-item-image"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="menu-item-body">
                    <div className="menu-item-top">
                      <h4>{item.name}</h4>
                      <span className="menu-category-pill">{item.category}</span>
                    </div>
                    <p>{item.description || "No description added yet."}</p>
                    <div className="menu-item-footer">
                      <div>
                        {quickPriceEditId === item.id ? (
                          <div className="quick-price-edit">
                            <input
                              type="number"
                              min="1"
                              value={quickPriceValue}
                              onChange={(e) => setQuickPriceValue(e.target.value)}
                            />
                            <button type="button" className="mini-btn save" onClick={() => handleSaveQuickPrice(item.id)}>
                              <FiCheck />
                            </button>
                          </div>
                        ) : (
                          <button type="button" className="link-btn price-link" onClick={() => handleStartQuickPriceEdit(item)}>
                            {formatCurrency(item.price)}
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        className={`toggle-pill ${item.available ? "on" : "off"}`}
                        onClick={() => handleToggleItemAvailability(item.id, !item.available)}
                      >
                        {item.available ? "In stock" : "Out of stock"}
                      </button>
                    </div>
                    <div className="row-actions">
                      <button type="button" className="mini-btn" onClick={() => openEditItemModal(item)}>
                        <FiEdit2 />
                      </button>
                      <button type="button" className="mini-btn danger" onClick={() => handleDeleteItem(item.id)}>
                        <FiTrash2 />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-items-state">
                <h4>No items found</h4>
                <p>Start by adding your first menu item with image, category, and stock status.</p>
                <button type="button" className="solid-action-btn" onClick={openAddItemModal}>
                  <FiPlus /> Add First Item
                </button>
              </div>
            )}
          </div>
        </article>
        ) : null}
      </div>

    </section>
  );

  if (!isLoggedIn) {
    return (
      <div className="login-page">
        <div className="login-blob blob-left-top" />
        <div className="login-blob blob-right-top" />
        <div className="login-blob blob-left-bottom" />
        <div className="login-blob blob-right-bottom" />
        <Toaster position="top-right" />
        <form className="login-card" onSubmit={handleLogin}>
          <img src={swagatLogo} alt="Swagat Suite logo" className="admin-login-logo" />
          <p>Restaurant admin secure login</p>
          <label>
            Email or Restaurant ID
            <input
              type="text"
              value={loginForm.identifier}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, identifier: e.target.value }))}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </label>
          <button type="submit">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <Toaster position="top-right" />
      <header className="admin-header">
        <div className="logo-wrap">
          {restaurant?.logo_url ? (
            <img src={restaurant.logo_url} alt="Restaurant logo" className="restro-logo" />
          ) : (
            <div className="restro-logo fallback">
              <FiLayers />
            </div>
          )}
          <button className="icon-btn header-menu-btn" type="button" onClick={() => setSidebarOpen((p) => !p)}>
            <FiMenu />
          </button>
        </div>
        <form
          className="header-search-wrap"
          onSubmit={(e) => e.preventDefault()}
          role="search"
          aria-label="Search dashboard"
        >
          <FiSearch />
          <input
            value={headerSearch}
            onChange={(e) => setHeaderSearch(e.target.value)}
            placeholder="Search orders, menu, tables..."
          />
        </form>
        <div className="header-right">
          <button type="button" className="owner-meta owner-meta-btn" onClick={() => setActiveMenu("profile")}>
            <div className="initials">{initials}<span className="online-dot" /></div>
            <small>{restaurant?.owner_name}</small>
          </button>
          <button className="icon-btn header-bell-btn" type="button">
            <FiBell />
            {liveServiceRequestsCount ? <span className="header-bell-badge">{liveServiceRequestsCount}</span> : null}
          </button>
          <button className="icon-btn" type="button" onClick={handleLogout}><FiLogOut /></button>
        </div>
      </header>

      <div className="admin-layout">
        <aside className={`admin-sidebar ${sidebarOpen ? "open" : "closed"}`}>
          {MENUS.filter((menu) => LOYALTY_ENABLED || menu.key !== "loyalty").map((menu) => {
            const Icon = menu.icon;
            return (
              <button
                key={menu.key}
                type="button"
                className={`sidebar-item ${activeMenu === menu.key ? "active" : ""}`}
                onClick={() => {
                  if (menu.key === "orders") void unlockWebAudio();
                  setActiveMenu(menu.key);
                }}
              >
                <Icon />
                {sidebarOpen ? (
                  <span className="sidebar-label">
                    {menu.label}
                    {menu.key === "orders" && (newPlacedOrdersCount || liveOrdersCount) ? (
                      <span className="nav-badge" title="Live orders">
                        {liveOrdersCount}
                      </span>
                    ) : null}
                    {menu.key === "loyalty" && pendingLoyaltyRewardsCount ? (
                      <span className="nav-badge" title="Rewards ready to redeem">
                        {pendingLoyaltyRewardsCount}
                      </span>
                    ) : null}
                    {menu.key === "service" && liveServiceRequestsCount ? (
                      <span className="nav-badge" title="Service requests">
                        {liveServiceRequestsCount}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            );
          })}
        </aside>

        <main className="admin-content">
          {activeMenu === "dashboard" ? (
            <>
              <section className="dashboard-topbar">
                <div>
                  <h2 className="dashboard-title">Restaurant Command Center</h2>
                  <p className="dashboard-subtitle">Monitor revenue, orders, tables, and kitchen in real time.</p>
                </div>
                <div className="dashboard-quick-actions">
                  <button type="button" className="solid-action-btn" onClick={() => setActiveMenu("orders")}>+ New Order</button>
                  <button type="button" className="solid-action-btn" onClick={() => setActiveMenu("invoices")}>+ Generate Invoice</button>
                  <button
                    type="button"
                    className="solid-action-btn"
                    onClick={() => {
                      setActiveMenu("menu");
                      setActiveMenuView("items");
                    }}
                  >
                    + Add Menu Item
                  </button>
                </div>
              </section>

              <section className="kpi-grid premium">
                <article className={`kpi-card glow-purple ${dashboardLoading ? "kpi-skeleton" : ""}`}>
                  <h4>Orders Today</h4>
                  <h2>{dashboardLoading ? "..." : animatedKpis.ordersToday}</h2>
                  <p className={orderTrendPercent >= 0 ? "trend-up" : "trend-down"}>
                    {orderTrendPercent >= 0 ? "▲" : "▼"} {Math.abs(orderTrendPercent).toFixed(1)}%
                  </p>
                  <MiniSparkline data={miniOrdersData} color="#7C3AED" />
                </article>
                <article className={`kpi-card glow-pink ${dashboardLoading ? "kpi-skeleton" : ""}`}>
                  <h4>Today's Revenue</h4>
                  <h2>{dashboardLoading ? "..." : formatCurrency(animatedKpis.revenueToday)}</h2>
                  <p className={revenueTrendPercent >= 0 ? "trend-up" : "trend-down"}>
                    {revenueTrendPercent >= 0 ? "▲" : "▼"} {Math.abs(revenueTrendPercent).toFixed(1)}%
                  </p>
                  <MiniSparkline data={miniRevenueData} color="#A855F7" />
                </article>
                <article className={`kpi-card glow-blue ${dashboardLoading ? "kpi-skeleton" : ""}`}>
                  <h4>Active Orders</h4>
                  <h2>{dashboardLoading ? "..." : animatedKpis.activeOrders}</h2>
                  <p className={activeTrendPercent >= 0 ? "trend-up" : "trend-down"}>
                    {activeTrendPercent >= 0 ? "▲" : "▼"} {Math.abs(activeTrendPercent).toFixed(1)}%
                  </p>
                  <MiniSparkline data={miniOrdersData} color="#3B82F6" />
                </article>
                <article className="kpi-card glow-soft">
                  <h4>Plan & Active Till</h4>
                  <h2>{restaurant?.plan}</h2>
                  <p>{restaurant?.subscription_end_date ? String(restaurant.subscription_end_date).slice(0, 10) : "N/A"}</p>
                </article>
              </section>

              <section className="graph-grid premium-graphs">
                <article className="panel-card chart-card">
                  <div className="chart-head">
                    <h3>Orders Trend</h3>
                    <div className="subnav-row">
                      <button type="button" className={`subnav-btn ${dashboardRange === "week" ? "active" : ""}`} onClick={() => setDashboardRange("week")}>Weekly</button>
                      <button type="button" className={`subnav-btn ${dashboardRange === "month" ? "active" : ""}`} onClick={() => setDashboardRange("month")}>Monthly</button>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={ordersTrendData}>
                      <defs>
                        <linearGradient id="ordersArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        tickFormatter={(v) => formatTrendLabel(v, dashboardRange, false)}
                        tickMargin={8}
                      />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                      <Tooltip content={(props) => <DashboardTooltip {...props} range={dashboardRange} />} />
                      <Area type="monotone" dataKey="total" stroke="#7C3AED" strokeWidth={3} fill="url(#ordersArea)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </article>

                <article className="panel-card chart-card">
                  <h3>Revenue Trend</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={revenueTrendData}>
                      <defs>
                        <linearGradient id="revenueArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#A855F7" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#A855F7" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        tickFormatter={(v) => formatTrendLabel(v, dashboardRange, false)}
                        tickMargin={8}
                      />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                      <Tooltip content={(props) => <DashboardTooltip {...props} range={dashboardRange} />} />
                      <Area type="monotone" dataKey="total" stroke="#A855F7" strokeWidth={3} fill="url(#revenueArea)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </article>
              </section>

              <section className="dashboard-ops-grid premium-graphs">
                <article className="panel-card live-panel">
                  <h3>Live Activity</h3>
                  {!liveActivityItems.length ? (
                    <p className="orders-missing-meta">No live activity yet.</p>
                  ) : (
                    <div className="live-activity-list">
                      {liveActivityItems.map((entry) => (
                        <div key={entry.id} className="live-activity-row">
                          <span className={`live-dot ${entry.kind === "service" ? "service" : "order"}`} />
                          <div>
                            <strong>{entry.label}</strong>
                            <small>{entry.status}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
                <article className="panel-card live-panel">
                  <h3>Live Table Status</h3>
                  {!activeOrdersByTable.size ? (
                    <p className="orders-missing-meta">All tables are currently idle.</p>
                  ) : (
                    <div className="live-table-list">
                      {Array.from(activeOrdersByTable.entries()).slice(0, 8).map(([tableLabel, count]) => (
                        <div key={`table-live-${tableLabel}`} className="live-table-row">
                          <strong>{tableLabel}</strong>
                          <span className="table-order-badge pulse">{count} Active</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
                <article className="panel-card live-panel kitchen-panel">
                  <h3>Active Kitchen</h3>
                  <div className="kitchen-status-grid">
                    <div className="kitchen-status-chip placed">
                      <strong>{kitchenStatusCounts.Placed}</strong>
                      <span>Placed</span>
                    </div>
                    <div className="kitchen-status-chip preparing">
                      <strong>{kitchenStatusCounts.Preparing}</strong>
                      <span>Preparing</span>
                    </div>
                    <div className="kitchen-status-chip ready">
                      <strong>{kitchenStatusCounts.Ready}</strong>
                      <span>Ready</span>
                    </div>
                    <div className="kitchen-status-chip served">
                      <strong>{kitchenStatusCounts.Served}</strong>
                      <span>Served</span>
                    </div>
                  </div>
                </article>
              </section>
            </>
          ) : (
            activeMenu === "menu" ? (
              renderMenuManagement()
            ) : activeMenu === "tables" ? (
              renderTablesPage()
            ) : activeMenu === "orders" ? (
              renderOrdersManagement()
            ) : activeMenu === "invoices" ? (
              renderInvoicesPage()
            ) : activeMenu === "reviews" ? (
              renderReviewsPage()
            ) : activeMenu === "service" ? (
              renderServiceRequestsPage()
            ) : activeMenu === "loyalty" && LOYALTY_ENABLED ? (
              <LoyaltyRewardsPage
                overview={loyaltyOverview}
                loading={loyaltyLoading && !loyaltyOverview}
                redeemingId={loyaltyRedeemId}
                onRedeem={handleLoyaltyRedeem}
              />
            ) : activeMenu === "profile" ? (
              renderProfilePage()
            ) : (
              <section className="panel-card coming-soon-card">
                <h3>{MENUS.find((m) => m.key === activeMenu)?.label}</h3>
                <p>Coming Soon</p>
              </section>
            )
          )}
        </main>
      </div>

      {itemModalOpen ? (
        <div className="item-modal-overlay" onClick={() => setItemModalOpen(false)} role="presentation">
          <div
            className="item-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="menu-header-row">
              <h3 id="item-modal-title">{editingItemId ? "Edit Item" : "Add Item"}</h3>
              <button type="button" className="mini-btn" onClick={() => setItemModalOpen(false)} aria-label="Close">
                <FiX />
              </button>
            </div>
            <div className="item-form-grid">
              <label>
                Item Name *
                <input
                  value={itemForm.name}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label>
                Price *
                <input
                  type="number"
                  min="1"
                  value={itemForm.price}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, price: e.target.value }))}
                />
              </label>
              <label>
                Category *
                <select
                  value={itemForm.category}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, category: e.target.value }))}
                >
                  <option value="">Choose category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Description (optional)
                <textarea
                  rows={3}
                  value={itemForm.description}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </label>
              <label className="item-image-field">
                <span className="item-image-field-label">Item Image *</span>
                <div className="item-image-ai-row">
                  <button
                    type="button"
                    className="item-ai-image-btn"
                    onClick={handleGenerateItemImage}
                    disabled={generatingItemImage || !normalizeName(itemForm.name)}
                  >
                    <FiZap />
                    {generatingItemImage ? "Generating…" : "Generate with AI"}
                  </button>
                  <span className="item-image-or">or</span>
                  <label className="item-image-upload-btn">
                    Upload photo
                    <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
                  </label>
                </div>
                <p className="item-image-hint">
                  AI creates a menu-style photo from the item name{itemForm.category ? ` (${itemForm.category})` : ""}.
                </p>
                {itemForm.imageUrl ? (
                  <div className="item-image-preview-wrap">
                    <img src={itemForm.imageUrl} alt={itemForm.name || "Preview"} className="item-image-preview" />
                    <button
                      type="button"
                      className="item-image-clear-btn"
                      onClick={() => setItemForm((prev) => ({ ...prev, imageUrl: "" }))}
                    >
                      Remove image
                    </button>
                  </div>
                ) : null}
              </label>
              <label className="availability-field">
                Availability
                <button
                  type="button"
                  className={`toggle-pill ${itemForm.available ? "on" : "off"}`}
                  onClick={() => setItemForm((prev) => ({ ...prev, available: !prev.available }))}
                >
                  {itemForm.available ? "In stock" : "Out of stock"}
                </button>
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="solid-action-btn" onClick={handleSaveItem}>
                Save Item
              </button>
              <button type="button" className="ghost-action-btn" onClick={() => setItemModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {manualInvoiceOpen ? (
        <div className="item-modal-overlay" onClick={() => !manualInvoiceSaving && setManualInvoiceOpen(false)}>
          <div className="item-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="menu-header-row">
              <h3>Walk-in Invoice</h3>
              <button type="button" className="mini-btn" onClick={() => setManualInvoiceOpen(false)} disabled={manualInvoiceSaving}>
                <FiX />
              </button>
            </div>
            <div className="item-form-grid">
              <label>
                Table (optional)
                <input
                  value={manualInvoiceForm.tableLabel}
                  onChange={(e) => setManualInvoiceForm((p) => ({ ...p, tableLabel: e.target.value }))}
                  placeholder="Walk-in / Table 5"
                />
              </label>
              <label>
                Customer Name *
                <input
                  value={manualInvoiceForm.customerName}
                  onChange={(e) => setManualInvoiceForm((p) => ({ ...p, customerName: e.target.value }))}
                  placeholder="Customer name"
                />
              </label>
              <label>
                Phone *
                <input
                  value={manualInvoiceForm.customerPhone}
                  onChange={(e) => setManualInvoiceForm((p) => ({ ...p, customerPhone: e.target.value }))}
                  placeholder="Phone"
                />
              </label>
              <label>
                Email (optional)
                <input
                  value={manualInvoiceForm.customerEmail}
                  onChange={(e) => setManualInvoiceForm((p) => ({ ...p, customerEmail: e.target.value }))}
                  placeholder="Email"
                />
              </label>
            </div>
            <div className="manual-items-block">
              <div className="menu-header-row" style={{ marginTop: 10 }}>
                <h3 style={{ fontSize: 16 }}>Items</h3>
                <button type="button" className="solid-action-btn" onClick={addManualLine}>
                  <FiPlus /> Add Item
                </button>
              </div>
              <div className="walkin-pick-wrap">
                <div className="walkin-category-row">
                  {walkInCategories.map((c) => (
                    <button
                      key={`walkcat-${c}`}
                      type="button"
                      className={`walkin-cat-pill ${walkInCategory === c ? "active" : ""}`}
                      onClick={() => setWalkInCategory(c)}
                    >
                      {c === "all" ? "All" : c}
                    </button>
                  ))}
                </div>
                <div className="walkin-item-picks">
                  {walkInVisibleItems.slice(0, 30).map((it) => (
                    <button
                      key={`pick-${it.id}`}
                      type="button"
                      className="walkin-item-pill"
                      onClick={() =>
                        setManualInvoiceForm((p) => ({
                          ...p,
                          items: [...p.items, { name: it.name, qty: 1, unitPrice: Number(it.price || 0) }]
                        }))
                      }
                    >
                      {it.name} · ₹{Number(it.price || 0)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="manual-items-grid">
                <div className="manual-items-head">
                  <span>Item</span>
                  <span>Quantity</span>
                  <span>Price</span>
                  <span />
                </div>
                {(manualInvoiceForm.items || []).map((row, idx) => (
                  <div key={`manual-${idx}`} className="manual-item-row">
                    <input
                      placeholder="Item name"
                      value={row.name}
                      onChange={(e) =>
                        setManualInvoiceForm((p) => ({
                          ...p,
                          items: p.items.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r))
                        }))
                      }
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={row.qty}
                      onChange={(e) =>
                        setManualInvoiceForm((p) => ({
                          ...p,
                          items: p.items.map((r, i) => (i === idx ? { ...r, qty: Number(e.target.value) } : r))
                        }))
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Price"
                      value={row.unitPrice}
                      onChange={(e) =>
                        setManualInvoiceForm((p) => ({
                          ...p,
                          items: p.items.map((r, i) => (i === idx ? { ...r, unitPrice: Number(e.target.value) } : r))
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="mini-btn danger"
                      onClick={() => removeManualLine(idx)}
                      disabled={(manualInvoiceForm.items || []).length <= 1}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="solid-action-btn" onClick={saveManualInvoice} disabled={manualInvoiceSaving}>
                {manualInvoiceSaving ? "Creating..." : "Create Invoice"}
              </button>
              <button type="button" className="ghost-action-btn" onClick={() => setManualInvoiceOpen(false)} disabled={manualInvoiceSaving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
