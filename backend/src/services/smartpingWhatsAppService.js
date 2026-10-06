const API_KEY = process.env.SMARTPING_API_KEY || "";
const PHONE_NUMBER_ID = process.env.SMARTPING_PHONE_NUMBER_ID || "";
const API_BASE_URL = (process.env.SMARTPING_API_BASE_URL || "https://partnersv1.pinbot.ai/v3").replace(/\/$/, "");
const WELCOME_TEMPLATE_NAME = process.env.SMARTPING_WELCOME_TEMPLATE_NAME || "swagatsuite_lead_welcome";
const WELCOME_TEMPLATE_LANGUAGE = process.env.SMARTPING_WELCOME_TEMPLATE_LANGUAGE || "en";

// Reply buttons allow max 3. Questions with 4+ options use list messages.
const QUESTIONS = {
  q1: {
    step: "q1_sent",
    field: "business_type",
    body: "What best describes your business?",
    button: "Select type",
    section: "Business type",
    type: "list",
    options: [
      { id: "type_restaurant", title: "Restaurant" },
      { id: "type_cafe", title: "Cafe" },
      { id: "type_cloud_kitchen", title: "Cloud Kitchen" },
      { id: "type_hotel", title: "Hotel" },
      { id: "type_fine_dining", title: "Fine Dining" },
      { id: "type_other", title: "Other" }
    ]
  },
  q2: {
    step: "q2_sent",
    field: "outlet_count",
    body: "How many outlets do you currently operate?",
    button: "Select outlets",
    section: "Outlets",
    type: "list",
    options: [
      { id: "outlets_1", title: "1 Outlet" },
      { id: "outlets_2_5", title: "2-5 Outlets" },
      { id: "outlets_6_10", title: "6-10 Outlets" },
      { id: "outlets_10plus", title: "10+ Outlets" },
      { id: "outlets_planning", title: "Planning to Open" }
    ]
  },
  q3: {
    step: "q3_sent",
    field: "challenge",
    body: "Which challenge are you facing today?",
    button: "Select challenge",
    section: "Challenges",
    type: "list",
    options: [
      { id: "chal_manual", title: "Manual Orders" },
      { id: "chal_billing", title: "Slow Billing" },
      { id: "chal_kitchen", title: "Kitchen Delays" },
      { id: "chal_no_qr", title: "No QR Ordering" },
      { id: "chal_reports", title: "Need Better Reports" },
      { id: "chal_multiple", title: "Multiple Problems" }
    ]
  },
  q4: {
    step: "q4_sent",
    field: "order_method",
    body: "How do you currently take customer orders?",
    button: "Select method",
    section: "Order method",
    type: "list",
    options: [
      { id: "order_pen", title: "Pen & Paper" },
      { id: "order_pos", title: "POS System" },
      { id: "order_whatsapp", title: "WhatsApp" },
      { id: "order_qr", title: "QR Menu" },
      { id: "order_other", title: "Other Software" }
    ]
  },
  q5: {
    step: "q5_sent",
    field: "implement_timeline",
    body: "When are you planning to implement a restaurant management system?",
    button: "Select timeline",
    section: "Timeline",
    type: "list",
    options: [
      { id: "time_immediate", title: "Immediately" },
      { id: "time_30days", title: "Within 30 Days" },
      { id: "time_1_3months", title: "1-3 Months" },
      { id: "time_exploring", title: "Just Exploring" }
    ]
  },
  q6: {
    step: "q6_sent",
    field: "demo_interest",
    body: "Would you like a FREE Live Demo?",
    type: "button",
    options: [
      { id: "demo_yes", title: "Yes" },
      { id: "demo_later", title: "Schedule Later" },
      { id: "demo_info", title: "Need More Info" }
    ]
  }
};

const OPTION_LABELS = Object.fromEntries(
  Object.values(QUESTIONS).flatMap((q) => q.options.map((opt) => [opt.id, opt.title]))
);

const OPTION_TO_QUESTION = Object.fromEntries(
  Object.entries(QUESTIONS).flatMap(([key, q]) => q.options.map((opt) => [opt.id, key]))
);

const QUESTION_ORDER = ["q1", "q2", "q3", "q4", "q5", "q6"];

function isConfigured() {
  return Boolean(API_KEY && PHONE_NUMBER_ID);
}

function normalizeIndianPhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";

  // Strip leading 00 international prefix (e.g. 0091...)
  if (digits.startsWith("00")) digits = digits.slice(2);

  // Common Indian mobile forms
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;

  // Already includes country code longer than 12 (keep as-is if looks valid)
  if (digits.length >= 11 && digits.length <= 15) return digits;

  return digits;
}

function formatFetchError(error) {
  const cause = error?.cause;
  const parts = [error?.message || "fetch failed"];
  if (cause) {
    const details = [cause.code, cause.errno, cause.syscall, cause.hostname, cause.message]
      .filter(Boolean)
      .join(" ");
    if (details) parts.push(details);
  }
  return parts.join(": ");
}

async function postMessage(payload) {
  if (!isConfigured()) {
    throw new Error("SmartPing WhatsApp is not configured.");
  }

  const url = `${API_BASE_URL}/${PHONE_NUMBER_ID}/messages`;
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: API_KEY
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    });
  } catch (error) {
    throw new Error(`SmartPing request failed (${url}): ${formatFetchError(error)}`);
  }

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message = data?.error?.message || data?.message || text || `SmartPing request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

async function sendTemplateMessage(to, templateName, { headerParams = [], bodyParams = [], headerImageUrl = "" } = {}) {
  const components = [];

  if (headerImageUrl) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "image",
          image: { link: String(headerImageUrl) }
        }
      ]
    });
  } else if (headerParams.length) {
    components.push({
      type: "header",
      parameters: headerParams.map((value) => ({
        type: "text",
        text: String(value)
      }))
    });
  }

  if (bodyParams.length) {
    components.push({
      type: "body",
      parameters: bodyParams.map((value) => ({
        type: "text",
        text: String(value)
      }))
    });
  }

  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: WELCOME_TEMPLATE_LANGUAGE },
      components
    }
  });
}

// WhatsApp text headers are max 60 chars total (static template text + {{1}}).
const HEADER_NAME_MAX_LEN = Number(process.env.SMARTPING_WELCOME_HEADER_NAME_MAX || 12);
const WELCOME_HEADER_IMAGE_URL = process.env.SMARTPING_WELCOME_HEADER_IMAGE_URL || "";

function formatWelcomeName(leadName, maxLen = HEADER_NAME_MAX_LEN) {
  const raw = String(leadName || "").trim();
  if (!raw) return "there";

  const firstName = raw.split(/\s+/)[0] || raw;
  if (firstName.length <= maxLen) return firstName;
  return firstName.slice(0, Math.max(1, maxLen));
}

async function sendWelcomeMessage(to, leadName) {
  // New "swagatsuite1" template: static image header + fixed body (no {{1}}).
  // Set SMARTPING_WELCOME_NAME_PLACEMENT=none for that template.
  const namePlacement = String(process.env.SMARTPING_WELCOME_NAME_PLACEMENT || "none").toLowerCase();
  const nameValue = formatWelcomeName(leadName);

  if (WELCOME_HEADER_IMAGE_URL) {
    return sendTemplateMessage(to, WELCOME_TEMPLATE_NAME, { headerImageUrl: WELCOME_HEADER_IMAGE_URL });
  }

  if (namePlacement === "body") {
    return sendTemplateMessage(to, WELCOME_TEMPLATE_NAME, { bodyParams: [nameValue] });
  }
  if (namePlacement === "header") {
    return sendTemplateMessage(to, WELCOME_TEMPLATE_NAME, { headerParams: [nameValue] });
  }

  // none — static image + fixed text, no parameters
  return sendTemplateMessage(to, WELCOME_TEMPLATE_NAME, {});
}

async function sendListQuestion(to, question) {
  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: question.body },
      footer: { text: "SwagatSuite" },
      action: {
        button: question.button.slice(0, 20),
        sections: [
          {
            title: question.section.slice(0, 24),
            rows: question.options.map((opt) => ({
              id: opt.id,
              title: opt.title.slice(0, 24)
            }))
          }
        ]
      }
    }
  });
}

async function sendButtonQuestion(to, question) {
  return postMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: question.body },
      footer: { text: "SwagatSuite" },
      action: {
        buttons: question.options.map((opt) => ({
          type: "reply",
          reply: {
            id: opt.id,
            title: opt.title.slice(0, 20)
          }
        }))
      }
    }
  });
}

async function sendQuestion(to, questionKey) {
  const question = QUESTIONS[questionKey];
  if (!question) throw new Error(`Unknown question: ${questionKey}`);
  if (question.type === "button") return sendButtonQuestion(to, question);
  return sendListQuestion(to, question);
}

async function sendTextMessage(to, body) {
  return postMessage({
    messaging_product: "whatsapp",
    preview_url: false,
    recipient_type: "individual",
    to,
    type: "text",
    text: { body }
  });
}

async function sendCompletionMessage(to, answers = {}) {
  const lines = [
    "Thank you for sharing your details.",
    "",
    `Business: ${answers.business_type || "—"}`,
    `Outlets: ${answers.outlet_count || "—"}`,
    `Challenge: ${answers.challenge || "—"}`,
    `Orders: ${answers.order_method || "—"}`,
    `Timeline: ${answers.implement_timeline || "—"}`,
    `Demo: ${answers.demo_interest || "—"}`,
    "",
    "Our team will contact you shortly."
  ];
  return sendTextMessage(to, lines.join("\n"));
}

function getOptionLabel(id) {
  return OPTION_LABELS[id] || id;
}

function getQuestionKeyForOption(optionId) {
  return OPTION_TO_QUESTION[optionId] || null;
}

function getNextQuestionKey(questionKey) {
  const index = QUESTION_ORDER.indexOf(questionKey);
  if (index < 0 || index >= QUESTION_ORDER.length - 1) return null;
  return QUESTION_ORDER[index + 1];
}

module.exports = {
  isConfigured,
  normalizeIndianPhone,
  sendWelcomeMessage,
  sendQuestion,
  sendTextMessage,
  sendCompletionMessage,
  getOptionLabel,
  getQuestionKeyForOption,
  getNextQuestionKey,
  QUESTIONS,
  QUESTION_ORDER
};
