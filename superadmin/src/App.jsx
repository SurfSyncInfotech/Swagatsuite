
import { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiBell,
  FiCreditCard,
  FiEdit2,
  FiEye,
  FiHome,
  FiLogIn,
  FiLogOut,
  FiMenu,
  FiPlusCircle,
  FiPower,
  FiTrash2,
  FiUsers
} from "react-icons/fi";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import toast, { Toaster } from "react-hot-toast";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import swagatLogo from "../../frontend/public/swagatsuite.png";
import * as XLSX from "xlsx";
import { api } from "./config/api";
import "./App.css";

const AUTH_STORAGE_KEY = "restro_superadmin_auth";
const CARD_COLORS = ["#f973a5", "#58a6ff", "#39d9c6"];
const CHART_COLORS = ["#a855f7", "#22c55e", "#3b82f6"];
const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getAdminPanelBaseUrl() {
  const currentHost = window.location.hostname;
  const superadminPrefix = "superadmin.";
  const mappedAdminBase = currentHost.startsWith(superadminPrefix)
    ? `${window.location.protocol}//admin.${currentHost.slice(superadminPrefix.length)}`
    : "";

  const configuredUrl = import.meta.env.VITE_ADMIN_PANEL_URL;
  if (configuredUrl) {
    try {
      const parsedConfigured = new URL(configuredUrl);
      // If env accidentally points to current superadmin host, prefer admin sibling host.
      if (mappedAdminBase && parsedConfigured.hostname === currentHost) {
        return mappedAdminBase;
      }
      return configuredUrl.replace(/\/$/, "");
    } catch (_error) {
      // Fall through to safe host mapping.
    }
  }

  if (mappedAdminBase) return mappedAdminBase;

  if (window.location.hostname === "localhost" && window.location.port === "5173") {
    return `${window.location.protocol}//${window.location.hostname}:5174`;
  }

  return window.location.origin;
}

const SIDEBAR_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: FiHome },
  { key: "restaurant", label: "Add Restaurant", icon: FiPlusCircle },
  { key: "plan", label: "Plan Management", icon: FiCreditCard },
  { key: "leads", label: "Landing Leads", icon: FiUsers },
  { key: "alert", label: "Create Alert", icon: FiAlertCircle }
];

const INITIAL_LOGIN = {
  email: "",
  password: ""
};

function getDefaultRestaurantForm() {
  return {
    id: null,
    restaurantId: `RST-${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    name: "",
    ownerName: "",
    email: "",
    contact: "",
    password: `restro@${Math.random().toString(36).slice(2, 8)}`,
    address: "",
    city: "",
    state: "",
    pincode: "",
    gstNumber: "",
    logoUrl: "",
    plan: "Free",
    subscriptionStartDate: "",
    subscriptionEndDate: ""
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function normalizeChartsData(rawCharts) {
  const source = rawCharts || {};
  const revenueGrowth = Array.isArray(source.revenueGrowth) ? source.revenueGrowth : [];
  const ordersOverview = Array.isArray(source.ordersOverview) ? source.ordersOverview : [];
  const restaurantActivity = Array.isArray(source.restaurantActivity) ? source.restaurantActivity : [];
  const planDistribution = Array.isArray(source.planDistribution) ? source.planDistribution : [];
  const revenueByPlan = Array.isArray(source.revenueByPlan) ? source.revenueByPlan : [];
  const topRestaurants = Array.isArray(source.topRestaurants) ? source.topRestaurants : [];
  const dropOffs = Array.isArray(source.dropOffs) ? source.dropOffs : [];
  const recentActivity = Array.isArray(source.recentActivity) ? source.recentActivity : [];

  const safeRevenueGrowth = revenueGrowth.length >= 2
    ? revenueGrowth
    : WEEK_LABELS.map((label, idx) => ({ label, value: 28000 + idx * 4500 + (idx % 2) * 2500 }));
  const safeOrdersOverview = ordersOverview.length
    ? ordersOverview
    : WEEK_LABELS.map((label, idx) => ({ label, value: 30 + idx * 5 + (idx % 3) * 4 }));
  const safeRestaurantActivity = restaurantActivity.length
    ? restaurantActivity
    : WEEK_LABELS.map((label, idx) => ({
      label,
      active: 15 + idx,
      new: idx % 2 === 0 ? 2 : 1,
      inactive: idx % 3 === 0 ? 2 : 1
    }));
  const safePlanDistribution = planDistribution.length
    ? planDistribution
    : [
      { label: "Free", value: 18 },
      { label: "Basic", value: 11 },
      { label: "Pro", value: 6 }
    ];
  const safeRevenueByPlan = revenueByPlan.length
    ? revenueByPlan
    : [
      { label: "Free", value: 0 },
      { label: "Basic", value: 78000 },
      { label: "Pro", value: 146000 }
    ];
  const safeTopRestaurants = topRestaurants.length
    ? topRestaurants
    : [
      { label: "Urban Bites", value: 142 },
      { label: "Spice Villa", value: 126 },
      { label: "Cafe Aroma", value: 119 },
      { label: "Royal Tandoor", value: 104 }
    ];
  const safeDropOffs = dropOffs.length
    ? dropOffs
    : [
      { label: "No orders in last 7 days", value: 5 },
      { label: "Expired subscriptions", value: 3 }
    ];
  const safeRecentActivity = recentActivity.length
    ? recentActivity
    : [
      { label: "New restaurant added", detail: "Cafe Aroma onboarded" },
      { label: "Plan upgraded", detail: "Urban Bites moved to Pro plan" },
      { label: "Big order placed", detail: "Spice Villa received order worth INR 7,850" }
    ];

  return {
    revenueGrowth: safeRevenueGrowth,
    ordersOverview: safeOrdersOverview,
    restaurantActivity: safeRestaurantActivity,
    planDistribution: safePlanDistribution,
    revenueByPlan: safeRevenueByPlan,
    topRestaurants: safeTopRestaurants,
    dropOffs: safeDropOffs,
    recentActivity: safeRecentActivity
  };
}

function downloadExcel(filename, rows) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, filename);
}

function downloadPdf(filename, title, columns, rows) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [columns],
    body: rows
  });
  doc.save(filename);
}

function capitalizeFirst(text) {
  const value = String(text || "").trim();
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [impersonatedRestaurant, setImpersonatedRestaurant] = useState(null);
  const [loginForm, setLoginForm] = useState(INITIAL_LOGIN);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalRestaurants: 0,
    totalOrders: 0,
    totalPlansPurchased: 0,
    totalRevenue: 0
  });
  const [charts, setCharts] = useState(() => normalizeChartsData());
  const [revenueGrowthRange, setRevenueGrowthRange] = useState("week");
  const [revenueGrowthYear, setRevenueGrowthYear] = useState(() => new Date().getFullYear());
  const [revenueGrowthData, setRevenueGrowthData] = useState([]);
  const [revenueGrowthLoading, setRevenueGrowthLoading] = useState(false);
  const [resetForm, setResetForm] = useState({ newPassword: "", confirmPassword: "" });
  const [restaurantForm, setRestaurantForm] = useState(getDefaultRestaurantForm());
  const [restaurants, setRestaurants] = useState([]);
  const [plans, setPlans] = useState([]);
  const [planForm, setPlanForm] = useState({
    id: null,
    name: "",
    price: "",
    currency: "INR",
    featuresText: ""
  });
  const [assignForm, setAssignForm] = useState({
    restaurantId: "",
    planName: "",
    startDate: "",
    endDate: ""
  });
  const [isSubmittingRestaurant, setIsSubmittingRestaurant] = useState(false);
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [editingRestaurantId, setEditingRestaurantId] = useState(null);
  const [viewRestaurant, setViewRestaurant] = useState(null);
  const [activePlanView, setActivePlanView] = useState("assign");
  const [leads, setLeads] = useState([]);

  useEffect(() => {
    const savedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedAuth) {
      setIsLoggedIn(true);
    }
  }, []);

  const revenueYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, idx) => currentYear - idx);
  }, []);

  const revenueGrowthChartData = revenueGrowthData;

  const kpiCards = useMemo(
    () => [
      {
        title: "Total Restaurants Onboarded",
        value: summary.totalRestaurants,
        trend: "Growth in active partner base"
      },
      {
        title: "Total Orders",
        value: summary.totalOrders,
        trend: "Orders processed across all restaurants"
      },
      {
        title: "Total Plans Purchased",
        value: summary.totalPlansPurchased,
        trend: "Paid subscribers on Basic/Pro"
      },
      {
        title: "Total Revenue",
        value: formatCurrency(summary.totalRevenue),
        trend: "Revenue from served/completed orders"
      }
    ],
    [summary]
  );

  const planInsights = useMemo(() => {
    const normalizedPlans = plans.map((plan) => ({
      name: String(plan.name || "Free"),
      price: Number(plan.price || 0),
      currency: plan.currency || "INR"
    }));
    const allPlanNames = Array.from(
      new Set([
        ...normalizedPlans.map((plan) => plan.name),
        ...restaurants.map((restaurant) => String(restaurant.plan || "Free"))
      ])
    );

    const planCards = allPlanNames.map((planName) => {
      const purchasedCount = restaurants.filter(
        (restaurant) => String(restaurant.plan || "Free").toLowerCase() === planName.toLowerCase()
      ).length;
      const planMeta = normalizedPlans.find((plan) => plan.name.toLowerCase() === planName.toLowerCase());
      const amount = Number(planMeta?.price || 0) * purchasedCount;
      return {
        name: planName,
        purchasedCount,
        amount,
        currency: planMeta?.currency || "INR"
      };
    });

    const totalRevenueFromPlans = planCards.reduce((sum, card) => sum + Number(card.amount || 0), 0);
    return { planCards, totalRevenueFromPlans };
  }, [plans, restaurants]);

  const loadDashboard = async () => {
    const [summaryResponse, chartResponse] = await Promise.all([
      api.get("/dashboard/summary"),
      api.get("/dashboard/charts")
    ]);
    setSummary(summaryResponse.data);
    setCharts(normalizeChartsData(chartResponse.data));
  };

  const loadRevenueGrowth = async (range, year) => {
    setRevenueGrowthLoading(true);
    try {
      const response = await api.get("/dashboard/revenue-growth", { params: { range, year } });
      setRevenueGrowthData(Array.isArray(response.data?.data) ? response.data.data : []);
    } finally {
      setRevenueGrowthLoading(false);
    }
  };

  const loadRestaurants = async () => {
    const response = await api.get("/restaurants");
    setRestaurants(response.data);
  };

  const loadPlans = async () => {
    const response = await api.get("/plans");
    setPlans(response.data);
    setAssignForm((prev) => ({
      ...prev,
      planName: prev.planName || response.data[0]?.name || ""
    }));
  };

  const loadLeads = async () => {
    const response = await api.get("/leads");
    setLeads(response.data?.leads || []);
  };

  const handleDeleteLead = async (leadId) => {
    const shouldDelete = window.confirm("Delete this lead?");
    if (!shouldDelete) return;
    try {
      await api.post(`/leads/${leadId}/delete`);
      toast.success("Lead deleted.");
      await loadLeads();
    } catch (error) {
      toast.error(error.response?.data?.message || "Delete failed.");
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    Promise.all([loadDashboard(), loadRestaurants(), loadPlans(), loadLeads()]).catch(() => {
      toast.error("Could not load dashboard data.");
    });
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadRevenueGrowth(revenueGrowthRange, revenueGrowthYear).catch(() => {
      toast.error("Could not load revenue growth data.");
    });
  }, [isLoggedIn, revenueGrowthRange, revenueGrowthYear]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post("/auth/login", loginForm);
      if (response.data?.success) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(response.data));
        toast.success("Welcome to Swagat Suite Superadmin.");
        setIsLoggedIn(true);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsLoggedIn(false);
    setProfileOpen(false);
    setActiveMenu("dashboard");
    setImpersonatedRestaurant(null);
  };

  const handleResetPassword = async () => {
    if (!resetForm.newPassword || !resetForm.confirmPassword) {
      toast.error("Please fill both password fields.");
      return;
    }
    if (resetForm.newPassword !== resetForm.confirmPassword) {
      toast.error("Password and confirm password must match.");
      return;
    }
    try {
      const response = await api.post("/auth/reset-password", {
        email: "superadmin@4510",
        newPassword: resetForm.newPassword
      });
      if (response.data?.success) {
        toast.success("Password reset successful.");
        setResetOpen(false);
        setProfileOpen(false);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setIsLoggedIn(false);
        setLoginForm({ email: "superadmin@4510", password: resetForm.newPassword });
        setResetForm({ newPassword: "", confirmPassword: "" });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Password reset failed.");
    }
  };

  const setFormField = (key, value) => {
    setRestaurantForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "plan" && value === "Free") {
        next.subscriptionStartDate = "";
        next.subscriptionEndDate = "";
      }
      return next;
    });
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormField("logoUrl", String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  };

  const resetRestaurantForm = () => {
    setRestaurantForm(getDefaultRestaurantForm());
    setEditingRestaurantId(null);
  };

  const handleRestaurantSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingRestaurant(true);
    try {
      if (editingRestaurantId) {
        await api.put(`/restaurants/${editingRestaurantId}`, restaurantForm);
        toast.success("Restaurant updated.");
      } else {
        await api.post("/restaurants", restaurantForm);
        toast.success("Restaurant created.");
      }
      resetRestaurantForm();
      await Promise.all([loadRestaurants(), loadDashboard()]);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save restaurant.");
    } finally {
      setIsSubmittingRestaurant(false);
    }
  };

  const handleEditRestaurant = (restaurant) => {
    setEditingRestaurantId(restaurant.id);
    setRestaurantForm({
      id: restaurant.id,
      restaurantId: restaurant.restaurant_code || "",
      name: restaurant.name || "",
      ownerName: restaurant.owner_name || "",
      email: restaurant.email || "",
      contact: restaurant.contact || "",
      password: restaurant.password || "",
      address: restaurant.address || "",
      city: restaurant.city || "",
      state: restaurant.state || "",
      pincode: restaurant.pincode || "",
      gstNumber: restaurant.gst_number || "",
      logoUrl: restaurant.logo_url || "",
      plan: restaurant.plan || "Free",
      subscriptionStartDate: restaurant.subscription_start_date ? String(restaurant.subscription_start_date).slice(0, 10) : "",
      subscriptionEndDate: restaurant.subscription_end_date ? String(restaurant.subscription_end_date).slice(0, 10) : ""
    });
    setActiveMenu("restaurant");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteRestaurant = async (restaurantId) => {
    const shouldDelete = window.confirm("Delete this restaurant?");
    if (!shouldDelete) return;
    try {
      await api.delete(`/restaurants/${restaurantId}`);
      toast.success("Restaurant deleted.");
      await Promise.all([loadRestaurants(), loadDashboard()]);
    } catch (error) {
      toast.error(error.response?.data?.message || "Delete failed.");
    }
  };

  const handleToggleStatus = async (restaurantId) => {
    try {
      await api.patch(`/restaurants/${restaurantId}/toggle-status`);
      toast.success("Status updated.");
      await loadRestaurants();
    } catch (error) {
      toast.error(error.response?.data?.message || "Status update failed.");
    }
  };

  const handleLoginAsRestaurant = async (restaurantId) => {
    try {
      const response = await api.post(`/restaurants/${restaurantId}/login-as`);
      const restaurantData = response.data?.restaurant || {};
      const restaurantCode = restaurantData.restaurant_code;
      const relativeRedirectPath = response.data?.redirectPath || `/admin?restaurant=${restaurantCode}`;
      const adminBaseUrl = new URL(`${getAdminPanelBaseUrl()}/`);
      const redirectUrl = new URL(relativeRedirectPath, adminBaseUrl);
      // Force host to admin panel domain for production safety.
      redirectUrl.protocol = adminBaseUrl.protocol;
      redirectUrl.host = adminBaseUrl.host;
      redirectUrl.searchParams.set("autoLogin", "1");
      redirectUrl.searchParams.set("token", String(response.data?.token || ""));
      redirectUrl.searchParams.set("restaurant", String(restaurantCode || ""));
      redirectUrl.searchParams.set("name", String(restaurantData.name || ""));
      redirectUrl.searchParams.set("owner", String(restaurantData.owner_name || ""));
      redirectUrl.searchParams.set("email", String(restaurantData.email || ""));
      redirectUrl.searchParams.set("plan", String(restaurantData.plan || "Free"));
      redirectUrl.searchParams.set("active", restaurantData.active ? "1" : "0");
      redirectUrl.searchParams.set("endDate", String(restaurantData.subscription_end_date || ""));
      localStorage.setItem("restro_admin_auth", JSON.stringify({
        token: response.data.token || `admin-${Date.now()}`,
        restaurant: response.data.restaurant
      }));
      toast.success(`Redirecting as ${response.data.restaurant.name}`);
      window.location.href = redirectUrl.toString();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not login as restaurant.");
    }
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingPlan(true);
    try {
      const features = planForm.featuresText
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      const payload = {
        name: planForm.name.trim(),
        price: Number(planForm.price || 0),
        currency: planForm.currency,
        features
      };
      if (planForm.id) {
        await api.put(`/plans/${planForm.id}`, payload);
        toast.success("Plan updated successfully.");
      } else {
        await api.post("/plans", payload);
        toast.success("Plan created successfully.");
      }
      setPlanForm({ id: null, name: "", price: "", currency: "INR", featuresText: "" });
      await loadPlans();
    } catch (error) {
      toast.error(error.response?.data?.message || "Plan could not be saved.");
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  const handleEditPlan = (plan) => {
    setPlanForm({
      id: plan.id,
      name: plan.name,
      price: String(plan.price || ""),
      currency: plan.currency || "INR",
      featuresText: (plan.features || []).join("\n")
    });
  };

  const handleAssignPlan = async (e) => {
    e.preventDefault();
    try {
      await api.post("/plans/assign", {
        restaurantId: Number(assignForm.restaurantId),
        planName: assignForm.planName,
        startDate: assignForm.planName.toLowerCase() === "free" ? null : assignForm.startDate || null,
        endDate: assignForm.planName.toLowerCase() === "free" ? null : assignForm.endDate || null
      });
      toast.success("Plan assigned successfully.");
      await Promise.all([loadRestaurants(), loadDashboard()]);
      setAssignForm((prev) => ({ ...prev, startDate: "", endDate: "" }));
    } catch (error) {
      toast.error(error.response?.data?.message || "Plan assignment failed.");
    }
  };

  const exportRestaurantsToExcel = () => {
    const rows = restaurants.map((row) => ({
      Restaurant: row.name || "",
      Owner: row.owner_name || "",
      City: row.city || "",
      State: row.state || "",
      Phone: row.contact || "",
      Email: row.email || "",
      Plan: row.plan || "Free",
      Status: row.active ? "Active" : "Inactive"
    }));
    downloadExcel("restaurants.xlsx", rows);
  };

  const exportRestaurantsToPdf = () => {
    const columns = ["Restaurant", "Owner", "City/State", "Phone", "Email", "Plan", "Status"];
    const rows = restaurants.map((row) => [
      row.name || "",
      row.owner_name || "",
      `${row.city || ""} / ${row.state || ""}`,
      row.contact || "",
      row.email || "",
      row.plan || "Free",
      row.active ? "Active" : "Inactive"
    ]);
    downloadPdf("restaurants.pdf", "Restaurants", columns, rows);
  };

  const exportAssignedPlansToExcel = () => {
    const rows = restaurants.map((restaurant) => ({
      Restaurant: restaurant.name || "",
      Owner: restaurant.owner_name || "",
      Plan: restaurant.plan || "Free",
      StartDate: restaurant.subscription_start_date ? String(restaurant.subscription_start_date).slice(0, 10) : "N/A",
      EndDate: restaurant.subscription_end_date ? String(restaurant.subscription_end_date).slice(0, 10) : "N/A",
      Status: restaurant.active ? "Active" : "Inactive"
    }));
    downloadExcel("assigned-plans.xlsx", rows);
  };

  const exportAssignedPlansToPdf = () => {
    const columns = ["Restaurant", "Owner", "Plan", "Start Date", "End Date", "Status"];
    const rows = restaurants.map((restaurant) => [
      restaurant.name || "",
      restaurant.owner_name || "",
      restaurant.plan || "Free",
      restaurant.subscription_start_date ? String(restaurant.subscription_start_date).slice(0, 10) : "N/A",
      restaurant.subscription_end_date ? String(restaurant.subscription_end_date).slice(0, 10) : "N/A",
      restaurant.active ? "Active" : "Inactive"
    ]);
    downloadPdf("assigned-plans.pdf", "Assigned Plans", columns, rows);
  };

  const renderDashboard = () => (
    <>
      <section className="kpi-grid">
        {kpiCards.map((card, idx) => (
          <article key={card.title} className="kpi-card" style={{ background: CARD_COLORS[idx % 3] }}>
            <h4>{card.title}</h4>
            <h2>{card.value}</h2>
            <p>{card.trend}</p>
          </article>
        ))}
      </section>

      <section className="chart-card large">
        <div className="page-title-row">
          <h3>Revenue Growth Graph</h3>
          <div className="subnav-row">
            <button
              type="button"
              className={`subnav-btn ${revenueGrowthRange === "week" ? "active" : ""}`}
              onClick={() => setRevenueGrowthRange("week")}
            >
              Weekly
            </button>
            <button
              type="button"
              className={`subnav-btn ${revenueGrowthRange === "month" ? "active" : ""}`}
              onClick={() => setRevenueGrowthRange("month")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`subnav-btn ${revenueGrowthRange === "year" ? "active" : ""}`}
              onClick={() => setRevenueGrowthRange("year")}
            >
              Yearly
            </button>
            {revenueGrowthRange === "month" ? (
              <label className="revenue-year-filter">
                Year
                <select
                  value={revenueGrowthYear}
                  onChange={(e) => setRevenueGrowthYear(Number(e.target.value))}
                >
                  {revenueYearOptions.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={revenueGrowthChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip formatter={(value) => formatCurrency(value)} />
            <Legend />
            <Line
              dataKey="value"
              name="Revenue"
              stroke="#8b5cf6"
              strokeWidth={3}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
        {revenueGrowthLoading ? <p className="chart-loading-note">Loading revenue data...</p> : null}
      </section>

      <section className="half-grid">
        <article className="chart-card">
          <h3>Orders Overview</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={charts.ordersOverview}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#38bdf8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
        <article className="chart-card">
          <h3>Restaurant Activity</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={charts.restaurantActivity}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="active" stroke="#22c55e" fill="#86efac" fillOpacity={0.45} name="Active restaurants" />
              <Area type="monotone" dataKey="new" stroke="#6366f1" fill="#c7d2fe" fillOpacity={0.35} name="New restaurants" />
              <Area type="monotone" dataKey="inactive" stroke="#ef4444" fill="#fecaca" fillOpacity={0.3} name="Inactive restaurants" />
            </AreaChart>
          </ResponsiveContainer>
        </article>
      </section>

      <section className="half-grid">
        <article className="chart-card">
          <h3>Plan Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={charts.planDistribution} dataKey="value" nameKey="label" outerRadius={90} label>
                {charts.planDistribution.map((entry, index) => (
                  <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </article>
        <article className="chart-card">
          <h3>Revenue By Plan</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={charts.revenueByPlan}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>

      <section className="half-grid">
        <article className="chart-card">
          <h3>Drop-offs / Issues</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={charts.dropOffs}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" name="Restaurants" fill="#f43f5e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="chart-card">
          <h3>Recent Activity Feed</h3>
          <ul className="feed-list">
            {charts.recentActivity.map((item, idx) => (
              <li key={`${item.label}-${idx}`} className={`feed-item color-${idx % 5}`}>
                <strong>{capitalizeFirst(item.label)}</strong>
                <p>{item.detail || item.value || "Activity updated"}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </>
  );

  const renderRestaurantPage = () => (
    <>
      <section className="table-card">
        <div className="page-title-row">
          <h3>{editingRestaurantId ? "Edit Restaurant" : "Create Restaurant"}</h3>
          {editingRestaurantId ? (
            <button className="ghost-btn" type="button" onClick={resetRestaurantForm}>
              Cancel Edit
            </button>
          ) : null}
        </div>
        <form className="restaurant-form" onSubmit={handleRestaurantSubmit}>
          <h4>SECTION 1: BASIC DETAILS</h4>
          <div className="form-grid">
            <label>Restaurant/Cafe Name<input value={restaurantForm.name} onChange={(e) => setFormField("name", e.target.value)} required /></label>
            <label>Owner Name<input value={restaurantForm.ownerName} onChange={(e) => setFormField("ownerName", e.target.value)} required /></label>
            <label>Email ID<input type="email" value={restaurantForm.email} onChange={(e) => setFormField("email", e.target.value)} required /></label>
            <label>Phone Number<input value={restaurantForm.contact} onChange={(e) => setFormField("contact", e.target.value)} required /></label>
            <label>Password<input value={restaurantForm.password} onChange={(e) => setFormField("password", e.target.value)} required /></label>
            <label>
              Auto Restaurant ID
              <input value={restaurantForm.restaurantId} onChange={(e) => setFormField("restaurantId", e.target.value)} required />
            </label>
          </div>
          <h4>SECTION 2: BUSINESS INFO</h4>
          <div className="form-grid">
            <label>Restaurant Address<input value={restaurantForm.address} onChange={(e) => setFormField("address", e.target.value)} required /></label>
            <label>City<input value={restaurantForm.city} onChange={(e) => setFormField("city", e.target.value)} required /></label>
            <label>State<input value={restaurantForm.state} onChange={(e) => setFormField("state", e.target.value)} required /></label>
            <label>Pincode<input value={restaurantForm.pincode} onChange={(e) => setFormField("pincode", e.target.value)} required /></label>
            <label>GST Number (optional)<input value={restaurantForm.gstNumber} onChange={(e) => setFormField("gstNumber", e.target.value)} /></label>
            <label>
              Logo (upload image)
              <input type="file" accept="image/*" onChange={handleLogoUpload} />
            </label>
          </div>
          <h4>SECTION 3: PLAN & BILLING</h4>
          <div className="form-grid">
            <label>
              Select Plan
              <select value={restaurantForm.plan} onChange={(e) => setFormField("plan", e.target.value)}>
                <option value="Free">Free</option>
                <option value="Basic">Basic</option>
                <option value="Pro">Pro</option>
              </select>
            </label>
            {restaurantForm.plan !== "Free" ? (
              <>
                <label>Subscription Start Date<input type="date" value={restaurantForm.subscriptionStartDate} onChange={(e) => setFormField("subscriptionStartDate", e.target.value)} required /></label>
                <label>Subscription End Date<input type="date" value={restaurantForm.subscriptionEndDate} onChange={(e) => setFormField("subscriptionEndDate", e.target.value)} required /></label>
              </>
            ) : null}
          </div>
          <div className="form-actions">
            <button className="ghost-btn" type="button" onClick={() => setRestaurantForm((prev) => ({ ...prev, password: `restro@${Math.random().toString(36).slice(2, 8)}` }))}>
              Auto-generate Password
            </button>
            <button className="ghost-btn" type="button" onClick={() => setRestaurantForm((prev) => ({ ...prev, restaurantId: `RST-${Date.now().toString().slice(-6)}${Math.random().toString(36).slice(2, 5).toUpperCase()}` }))}>
              Auto-generate Restaurant ID
            </button>
            <button className="solid-btn create-restro-btn" type="submit" disabled={isSubmittingRestaurant}>
              {isSubmittingRestaurant ? "Saving..." : editingRestaurantId ? "Update Restaurant" : "Create Restaurant"}
            </button>
          </div>
        </form>
      </section>

      <section className="table-card">
        <div className="page-title-row">
          <h3>Restaurants</h3>
          <div className="table-export-row">
            <button type="button" className="ghost-btn" onClick={exportRestaurantsToExcel}>Export to Excel</button>
            <button type="button" className="ghost-btn" onClick={exportRestaurantsToPdf}>Export to PDF</button>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Restro Name</th>
                <th>Owner Name</th>
                <th>City/State</th>
                <th>Phone Number</th>
                <th>Email</th>
                <th>Plan</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.owner_name}</td>
                  <td>{row.city} / {row.state}</td>
                  <td>{row.contact}</td>
                  <td>{row.email}</td>
                  <td>
                    <span className={`pill ${row.plan.toLowerCase()}`}>{row.plan}</span>
                  </td>
                  <td>
                    <div className="action-row">
                      <button className="action-btn" title="Login as restaurant" onClick={() => handleLoginAsRestaurant(row.id)}><FiLogIn /></button>
                      <button className="action-btn" title={row.active ? "Disable" : "Enable"} onClick={() => handleToggleStatus(row.id)}><FiPower color={row.active ? "#16a34a" : "#ef4444"} /></button>
                      <button className="action-btn" title="Delete" onClick={() => handleDeleteRestaurant(row.id)}><FiTrash2 /></button>
                      <button className="action-btn" title="Edit" onClick={() => handleEditRestaurant(row)}><FiEdit2 /></button>
                      <button className="action-btn" title="View" onClick={() => setViewRestaurant(row)}><FiEye /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );

  const renderPlanPage = () => (
    <section className="plan-layout">
      <article className="table-card">
        <div className="page-title-row">
          <h3>Plan Management</h3>
          <div className="subnav-row">
            <button
              type="button"
              className={`subnav-btn ${activePlanView === "assign" ? "active" : ""}`}
              onClick={() => setActivePlanView("assign")}
            >
              Assign Plan
            </button>
            <button
              type="button"
              className={`subnav-btn ${activePlanView === "created" ? "active" : ""}`}
              onClick={() => setActivePlanView("created")}
            >
              Created Plans
            </button>
            <button
              type="button"
              className={`subnav-btn ${activePlanView === "assigned" ? "active" : ""}`}
              onClick={() => setActivePlanView("assigned")}
            >
              Assigned Plans
            </button>
          </div>
        </div>
        <div className="plan-insight-grid">
          {planInsights.planCards.map((plan) => (
            <div key={`plan-insight-${plan.name}`} className="plan-insight-card">
              <p className="plan-insight-label">{plan.name} Plan</p>
              <h4>{plan.purchasedCount}</h4>
              <span>Restaurants Purchased</span>
              <small>{formatCurrency(plan.amount)} from this plan</small>
            </div>
          ))}
          <div className="plan-insight-card revenue">
            <p className="plan-insight-label">Revenue from Plan Purchases</p>
            <h4>{formatCurrency(planInsights.totalRevenueFromPlans)}</h4>
            <span>Total Revenue</span>
            <small>Calculated from assigned paid plans</small>
          </div>
        </div>
      </article>

      {activePlanView === "assign" ? (
        <article className="table-card">
          <h3>Assign Plan</h3>
          <form className="restaurant-form" onSubmit={handleAssignPlan}>
            <div className="form-grid">
              <label>
                Select Restaurant
                <select
                  value={assignForm.restaurantId}
                  onChange={(e) => setAssignForm((prev) => ({ ...prev, restaurantId: e.target.value }))}
                  required
                >
                  <option value="">Choose restaurant</option>
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name} ({restaurant.owner_name})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Select Plan
                <select
                  value={assignForm.planName}
                  onChange={(e) => setAssignForm((prev) => ({ ...prev, planName: e.target.value }))}
                  required
                >
                  <option value="">Choose plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.name}>
                      {plan.name} - {plan.currency} {Number(plan.price || 0)}
                    </option>
                  ))}
                </select>
              </label>
              {assignForm.planName && assignForm.planName.toLowerCase() !== "free" ? (
                <>
                  <label>
                    Subscription Start Date
                    <input
                      type="date"
                      value={assignForm.startDate}
                      onChange={(e) => setAssignForm((prev) => ({ ...prev, startDate: e.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Subscription End Date
                    <input
                      type="date"
                      value={assignForm.endDate}
                      onChange={(e) => setAssignForm((prev) => ({ ...prev, endDate: e.target.value }))}
                      required
                    />
                  </label>
                </>
              ) : null}
            </div>
            <div className="form-actions">
              <button className="solid-btn create-restro-btn" type="submit">
                Assign Plan
              </button>
            </div>
          </form>
        </article>
      ) : null}

      {activePlanView === "created" ? (
        <>
          <article className="table-card">
            <h3>{planForm.id ? "Edit Plan" : "Create Plan"}</h3>
            <form className="restaurant-form" onSubmit={handlePlanSubmit}>
              <div className="form-grid">
                <label>
                  Plan Name
                  <input
                    value={planForm.name}
                    onChange={(e) => setPlanForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Price
                  <input
                    type="number"
                    min="0"
                    value={planForm.price}
                    onChange={(e) => setPlanForm((prev) => ({ ...prev, price: e.target.value }))}
                  />
                </label>
                <label>
                  Currency
                  <input
                    value={planForm.currency}
                    onChange={(e) => setPlanForm((prev) => ({ ...prev, currency: e.target.value }))}
                  />
                </label>
              </div>
              <label className="feature-textarea-wrap">
                Features (one per line)
                <textarea
                  rows={6}
                  value={planForm.featuresText}
                  onChange={(e) => setPlanForm((prev) => ({ ...prev, featuresText: e.target.value }))}
                  placeholder={"Unlimited orders\nAdvanced analytics\nPriority support"}
                />
              </label>
              <div className="form-actions">
                {planForm.id ? (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setPlanForm({ id: null, name: "", price: "", currency: "INR", featuresText: "" })}
                  >
                    Cancel Edit
                  </button>
                ) : null}
                <button className="solid-btn create-restro-btn" type="submit" disabled={isSubmittingPlan}>
                  {isSubmittingPlan ? "Saving..." : planForm.id ? "Update Plan" : "Create Plan"}
                </button>
              </div>
            </form>
          </article>

          <article className="table-card">
            <h3>Created Plans</h3>
            <div className="plan-grid">
              {plans.map((plan) => (
                <div key={plan.id} className="plan-card">
                  <div className="plan-top">
                    <h4>{plan.name}</h4>
                    <p>{plan.currency} {Number(plan.price || 0)}</p>
                  </div>
                  <ul>
                    {(plan.features || []).map((feature, idx) => (
                      <li key={`${plan.id}-${idx}`}>{feature}</li>
                    ))}
                  </ul>
                  <button className="ghost-btn" onClick={() => handleEditPlan(plan)}>Edit Plan</button>
                </div>
              ))}
            </div>
          </article>
        </>
      ) : null}

      {activePlanView === "assigned" ? (
        <article className="table-card">
          <div className="page-title-row">
            <h3>Assigned Plans</h3>
            <div className="table-export-row">
              <button type="button" className="ghost-btn" onClick={exportAssignedPlansToExcel}>Export to Excel</button>
              <button type="button" className="ghost-btn" onClick={exportAssignedPlansToPdf}>Export to PDF</button>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Restaurant</th>
                  <th>Owner</th>
                  <th>Plan</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {restaurants.length ? (
                  restaurants.map((restaurant) => (
                    <tr key={`assignment-${restaurant.id}`}>
                      <td>{restaurant.name}</td>
                      <td>{restaurant.owner_name}</td>
                      <td>
                        <span className={`pill ${String(restaurant.plan || "free").toLowerCase()}`}>
                          {restaurant.plan || "Free"}
                        </span>
                      </td>
                      <td>
                        {restaurant.subscription_start_date
                          ? String(restaurant.subscription_start_date).slice(0, 10)
                          : "N/A"}
                      </td>
                      <td>
                        {restaurant.subscription_end_date
                          ? String(restaurant.subscription_end_date).slice(0, 10)
                          : "N/A"}
                      </td>
                      <td>{restaurant.active ? "Active" : "Inactive"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>No restaurant assignments available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}
    </section>
  );

  const renderComingSoon = (title) => (
    <section className="table-card coming-soon-card">
      <h3>{title}</h3>
      <p>Coming Soon</p>
    </section>
  );

  const renderLeads = () => (
    <section className="table-card">
      <div className="page-title-row">
        <h3>Landing Page Leads</h3>
        <span className="pill basic">{leads.length} submissions</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Restaurant Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Business</th>
              <th>Outlets</th>
              <th>Challenge</th>
              <th>Orders</th>
              <th>Timeline</th>
              <th>Demo</th>
              <th>WhatsApp</th>
              <th>Submitted At</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {leads.length ? (
              leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.name}</td>
                  <td>{lead.restaurantName}</td>
                  <td>{lead.phone}</td>
                  <td>{lead.email}</td>
                  <td>{lead.businessType || "—"}</td>
                  <td>{lead.outletCount || "—"}</td>
                  <td>{lead.challenge || "—"}</td>
                  <td>{lead.orderMethod || "—"}</td>
                  <td>{lead.implementTimeline || "—"}</td>
                  <td>{lead.demoInterest || "—"}</td>
                  <td>{lead.whatsappStep || "—"}</td>
                  <td>{lead.createdAt ? String(lead.createdAt).replace("T", " ").slice(0, 16) : "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="action-btn"
                      title="Delete lead"
                      onClick={() => handleDeleteLead(lead.id)}
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={13}>No leads submitted yet.</td>
              </tr>
            )}
          </tbody>
        </table>
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
        <div className="login-dots dots-left" />
        <div className="login-dots dots-right" />
        <Toaster position="top-right" />
        <form className="login-card" onSubmit={handleLogin}>
          <img src={swagatLogo} alt="Swagat Suite logo" className="superadmin-logo login-logo" />
          <p>Superadmin secure login</p>
          <label>
            Email
            <input type="text" value={loginForm.email} onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))} />
          </label>
          <label>
            Password
            <input type="password" value={loginForm.password} onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))} />
          </label>
          <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Login"}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Toaster position="top-right" />
      <header className="top-header">
        <div className="left-header">
          <button className="icon-btn" onClick={() => setSidebarOpen((prev) => !prev)}>
            <FiMenu />
          </button>
          <img src={swagatLogo} alt="Swagat Suite logo" className="superadmin-logo header-logo" />
        </div>
        <div className="right-header">
          <div className="profile-wrap">
            <button className="profile-btn" type="button" onClick={() => setProfileOpen((prev) => !prev)}>
              <div className="profile-avatar-wrap">
                <div className="profile-avatar-initial">S</div>
                <span className="online-dot" />
              </div>
              <strong>SUPERADMIN</strong>
            </button>
            {profileOpen ? (
              <div className="profile-dropdown">
                <p className="email-line">superadmin@4510</p>
                <button onClick={() => setResetOpen((prev) => !prev)}>Reset Password</button>
                {resetOpen ? (
                  <div className="reset-panel">
                    <input type="password" placeholder="New Password" value={resetForm.newPassword} onChange={(e) => setResetForm((prev) => ({ ...prev, newPassword: e.target.value }))} />
                    <input type="password" placeholder="Confirm Password" value={resetForm.confirmPassword} onChange={(e) => setResetForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} />
                    <button className="solid-btn" onClick={handleResetPassword}>Confirm Reset</button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="header-actions">
            <button className="icon-btn" type="button"><FiBell /></button>
            <button className="icon-btn" type="button" onClick={handleLogout}><FiLogOut /></button>
          </div>
        </div>
      </header>

      <div className="layout">
        <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} className={`sidebar-item ${activeMenu === item.key ? "active" : ""}`} onClick={() => setActiveMenu(item.key)}>
                <Icon />
                {sidebarOpen ? <span>{item.label}</span> : null}
              </button>
            );
          })}
        </aside>

        <main className="dashboard-content">
          {activeMenu === "dashboard" && renderDashboard()}
          {activeMenu === "restaurant" && renderRestaurantPage()}
          {activeMenu === "restaurant-dashboard" && renderComingSoon("Restaurant Dashboard")}
          {activeMenu === "plan" && renderPlanPage()}
          {activeMenu === "leads" && renderLeads()}
          {activeMenu === "alert" && renderComingSoon("Create Alert")}
        </main>
      </div>

      {viewRestaurant ? (
        <div className="modal-overlay" onClick={() => setViewRestaurant(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{viewRestaurant.name}</h3>
              <span className={`pill ${String(viewRestaurant.plan || "Free").toLowerCase()}`}>{viewRestaurant.plan}</span>
            </div>
            <div className="modal-detail-grid">
              <p><strong>Restaurant ID:</strong> {viewRestaurant.restaurant_code}</p>
              <p><strong>Owner:</strong> {viewRestaurant.owner_name}</p>
              <p><strong>Email:</strong> {viewRestaurant.email}</p>
              <p><strong>Phone:</strong> {viewRestaurant.contact}</p>
              <p><strong>City / State:</strong> {viewRestaurant.city} / {viewRestaurant.state}</p>
              <p><strong>Pincode:</strong> {viewRestaurant.pincode}</p>
              <p><strong>GST:</strong> {viewRestaurant.gst_number || "N/A"}</p>
              <p><strong>Subscription:</strong> {viewRestaurant.subscription_start_date ? String(viewRestaurant.subscription_start_date).slice(0, 10) : "N/A"} - {viewRestaurant.subscription_end_date ? String(viewRestaurant.subscription_end_date).slice(0, 10) : "N/A"}</p>
            </div>
            <div className="modal-address">
              <strong>Address</strong>
              <p>{viewRestaurant.address}</p>
            </div>
            {viewRestaurant.logo_url ? <img src={viewRestaurant.logo_url} alt="Restaurant logo" className="logo-preview" /> : null}
            <div className="modal-footer">
              <button className="solid-btn modal-action-close" onClick={() => setViewRestaurant(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
