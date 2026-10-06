const { createLead, listLeads, deleteLead } = require("../models/leadModel");
const { startLeadWhatsAppFlow } = require("../services/leadWhatsAppFlowService");

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

async function submitLead(req, res) {
  try {
    const name = String(req.body?.name || "").trim();
    const restaurantName = String(req.body?.restaurantName || "").trim();
    const phone = String(req.body?.phone || "").replace(/\D/g, "");
    const email = String(req.body?.email || "").trim();
    const source = String(req.body?.source || "landing_page").trim();

    if (!name || name.length < 2) {
      return res.status(400).json({ message: "Please enter your name." });
    }
    if (!restaurantName || restaurantName.length < 2) {
      return res.status(400).json({ message: "Please enter restaurant name." });
    }
    if (phone.length < 10) {
      return res.status(400).json({ message: "Please enter a valid phone number." });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    const id = await createLead({ name, restaurantName, phone, email, source });

    startLeadWhatsAppFlow({ id, name, phone }).catch((error) => {
      console.error(`WhatsApp flow failed for lead ${id}:`, error.message);
    });

    return res.status(201).json({ success: true, id, message: "Thank you. Our team will contact you shortly." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function getLeads(_req, res) {
  try {
    const rows = await listLeads();
    return res.json({
      leads: rows.map((row) => ({
        id: row.id,
        name: row.name,
        restaurantName: row.restaurant_name,
        phone: row.phone,
        email: row.email,
        source: row.source,
        businessType: row.business_type,
        outletCount: row.outlet_count,
        challenge: row.challenge,
        orderMethod: row.order_method,
        implementTimeline: row.implement_timeline,
        demoInterest: row.demo_interest,
        websiteStatus: row.website_status,
        whatsappStep: row.whatsapp_step,
        whatsappLastError: row.whatsapp_last_error,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

async function removeLead(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid lead id." });
    }
    const deleted = await deleteLead(id);
    if (!deleted) {
      return res.status(404).json({ message: "Lead not found." });
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  submitLead,
  getLeads,
  removeLead
};
