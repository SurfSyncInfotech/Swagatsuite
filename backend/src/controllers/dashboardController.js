const { getDashboardSummaryRows, getDashboardChartRows, getMonthlyRevenueRows, getWeeklyRevenueRows, getYearlyRevenueRows } = require("../models/dashboardModel");
const { groupByDate } = require("../utils/chart");

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatWeekLabel(period) {
  const date = new Date(`${String(period).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(period);
  return WEEKDAY_LABELS[date.getDay()];
}

async function getSummary(_req, res) {
  try {
    const { restaurantRow, orderRow, planRow, revenueRow } = await getDashboardSummaryRows();
    return res.json({
      totalRestaurants: Number(restaurantRow.total || 0),
      totalOrders: Number(orderRow.total || 0),
      totalPlansPurchased: Number(planRow.total || 0),
      totalRevenue: Number(revenueRow.total || 0)
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function getCharts(_req, res) {
  try {
    const data = await getDashboardChartRows();
    return res.json({
      revenueGrowth: groupByDate(data.revenueRows.map((x) => ({ ...x, period: String(x.period).slice(0, 10) })), "period"),
      ordersOverview: groupByDate(data.orderRows.map((x) => ({ ...x, period: String(x.period).slice(0, 10) })), "period"),
      restaurantActivity: data.activityRows.map((x) => ({
        label: String(x.period).slice(0, 10),
        active: Number(x.active || 0),
        new: Number(x.new_restaurants || 0),
        inactive: Number(x.inactive_restaurants || 0)
      })),
      planDistribution: data.planRows.map((x) => ({ label: x.label, value: Number(x.value) })),
      revenueByPlan: data.revenueByPlanRows.map((x) => ({ label: x.label, value: Number(x.value) })),
      topRestaurants: data.topRows.map((x) => ({ name: x.name, orders: Number(x.orders), revenue: Number(x.revenue) })),
      dropOffs: data.dropOffRows.map((x) => ({ label: x.label, value: Number(x.value || 0) })),
      recentActivity: data.recentRows.map((x) => ({
        label: String(x.event_type || "activity").replaceAll("_", " "),
        detail: x.description,
        at: x.created_at
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function getRevenueMonthly(req, res) {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const rows = await getMonthlyRevenueRows(year);
    const monthTotals = new Map(rows.map((row) => [Number(row.month), Number(row.total || 0)]));
    const data = MONTH_LABELS.map((label, idx) => ({
      label,
      value: Number((monthTotals.get(idx + 1) || 0).toFixed(2))
    }));
    return res.json({ year, data });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function getRevenueGrowth(req, res) {
  try {
    const range = String(req.query.range || "week").toLowerCase();
    const year = Number(req.query.year) || new Date().getFullYear();

    if (range === "month") {
      const rows = await getMonthlyRevenueRows(year);
      const monthTotals = new Map(rows.map((row) => [Number(row.month), Number(row.total || 0)]));
      const data = MONTH_LABELS.map((label, idx) => ({
        label,
        value: Number((monthTotals.get(idx + 1) || 0).toFixed(2))
      }));
      return res.json({ range, year, data });
    }

    if (range === "year") {
      const rows = await getYearlyRevenueRows();
      const data = rows.map((row) => ({
        label: String(row.period),
        value: Number(Number(row.total || 0).toFixed(2))
      }));
      return res.json({ range, year, data });
    }

    const rows = await getWeeklyRevenueRows();
    const data = rows.map((row) => ({
      label: formatWeekLabel(row.period),
      value: Number(Number(row.total || 0).toFixed(2))
    }));
    return res.json({ range: "week", year, data });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  getSummary,
  getCharts,
  getRevenueMonthly,
  getRevenueGrowth
};
