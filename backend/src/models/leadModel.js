const pool = require("../db/pool");

const QUALIFICATION_FIELDS = new Set([
  "business_type",
  "outlet_count",
  "challenge",
  "order_method",
  "implement_timeline",
  "demo_interest"
]);

async function createLead({ name, restaurantName, phone, email, source }) {
  const [result] = await pool.query(
    `
    INSERT INTO landing_leads (name, restaurant_name, phone, email, source)
    VALUES (?, ?, ?, ?, ?)
    `,
    [name, restaurantName, phone, email, source || "landing_page"]
  );
  return result.insertId;
}

async function listLeads() {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      name,
      restaurant_name,
      phone,
      email,
      source,
      business_type,
      outlet_count,
      challenge,
      order_method,
      implement_timeline,
      demo_interest,
      website_status,
      whatsapp_step,
      whatsapp_last_error,
      created_at
    FROM landing_leads
    ORDER BY created_at DESC
    LIMIT 1000
    `
  );
  return rows;
}

async function deleteLead(id) {
  const [result] = await pool.query("DELETE FROM landing_leads WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

async function updateLeadWhatsAppStep(id, step, error = null) {
  await pool.query(
    `
    UPDATE landing_leads
    SET whatsapp_step = ?, whatsapp_last_error = ?
    WHERE id = ?
    `,
    [step, error, id]
  );
}

async function updateLeadQualificationField(id, field, value) {
  if (!QUALIFICATION_FIELDS.has(field)) {
    throw new Error(`Invalid qualification field: ${field}`);
  }
  await pool.query(`UPDATE landing_leads SET \`${field}\` = ? WHERE id = ?`, [value, id]);
}

function phoneMatchClause() {
  return `
    REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', ''), '.', '') = ?
    OR REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', ''), '.', '') = ?
    OR REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', ''), '.', '') = ?
  `;
}

function phoneVariants(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const last10 = digits.slice(-10);
  const with91 = last10.length === 10 ? `91${last10}` : digits;
  return [digits, with91, last10];
}

async function getActiveLeadByPhone(phone, step) {
  const [digits, with91, last10] = phoneVariants(phone);

  const [rows] = await pool.query(
    `
    SELECT
      id, name, restaurant_name, phone, email,
      business_type, outlet_count, challenge, order_method,
      implement_timeline, demo_interest, website_status, whatsapp_step
    FROM landing_leads
    WHERE whatsapp_step = ?
      AND (${phoneMatchClause()})
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [step, digits, with91, last10]
  );

  return rows[0] || null;
}

async function getLatestLeadByPhone(phone) {
  const [digits, with91, last10] = phoneVariants(phone);

  const [rows] = await pool.query(
    `
    SELECT
      id, name, restaurant_name, phone, email,
      business_type, outlet_count, challenge, order_method,
      implement_timeline, demo_interest, website_status, whatsapp_step
    FROM landing_leads
    WHERE (${phoneMatchClause()})
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [digits, with91, last10]
  );

  return rows[0] || null;
}

module.exports = {
  createLead,
  listLeads,
  deleteLead,
  updateLeadWhatsAppStep,
  updateLeadQualificationField,
  getActiveLeadByPhone,
  getLatestLeadByPhone
};
