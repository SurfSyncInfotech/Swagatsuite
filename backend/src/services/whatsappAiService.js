const SWAGATSUITE_KNOWLEDGE = require("../content/swagatsuiteKnowledge");
const { sendTextMessage, normalizeIndianPhone } = require("./smartpingWhatsAppService");

function getApiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

function detectReplyLanguage(text) {
  const raw = String(text || "");
  if (/[\u0900-\u097F]/.test(raw)) return "hinglish";

  const lower = raw.toLowerCase();
  const hinglishHints = [
    "kya", "hai", "kaise", "kitna", "kripya", "batao", "bataiye", "chahiye",
    "mujhe", "aap", "hum", "restaurant", "khana", "menu", "demo", "price",
    "rate", "kitne", "mein", "ke", "ka", "ki", "ko", "se", "nahi", "haan",
    "theek", "accha", "dhanyavad", "shukriya", "namaste"
  ];
  if (hinglishHints.some((w) => lower.includes(w))) return "hinglish";
  return "english";
}

async function callOpenAi(messages) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("OpenAI API key is not configured.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
      messages,
      temperature: 0.5,
      max_tokens: 450
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI request failed.");
  }

  return String(data?.choices?.[0]?.message?.content || "").trim();
}

function buildSystemPrompt(lang, lead) {
  const leadContext = lead
    ? `Lead name: ${lead.name || "Guest"}. Restaurant they entered: ${lead.restaurant_name || "not specified"}.`
    : "";

  if (lang === "hinglish") {
    return [
      "You are SwagatSuite WhatsApp sales assistant.",
      "Reply in natural Hinglish (Hindi + English mixed, Roman script only, no Devanagari).",
      "Be warm, professional, concise. Max 6 short sentences. No markdown.",
      "Answer only about SwagatSuite product, pricing, demo, setup, features, contact.",
      "If off-topic, politely redirect to SwagatSuite.",
      leadContext,
      "Knowledge:",
      SWAGATSUITE_KNOWLEDGE
    ].join("\n");
  }

  return [
    "You are SwagatSuite WhatsApp sales assistant.",
    "Reply in clear professional English. Max 6 short sentences. No markdown.",
    "Answer only about SwagatSuite product, pricing, demo, setup, features, contact.",
    "If off-topic, politely redirect to SwagatSuite.",
    leadContext,
    "Knowledge:",
    SWAGATSUITE_KNOWLEDGE
  ].join("\n");
}

async function replyAboutSwagatSuite({ phone, lead, userMessage }) {
  const to = normalizeIndianPhone(phone);
  const text = String(userMessage || "").trim();
  if (!to || !text) return null;

  const lang = detectReplyLanguage(text);
  const system = buildSystemPrompt(lang, lead);

  const reply = await callOpenAi([
    { role: "system", content: system },
    { role: "user", content: text }
  ]);

  if (!reply) return null;

  const clipped = reply.length > 1200 ? `${reply.slice(0, 1197)}...` : reply;
  await sendTextMessage(to, clipped);
  return clipped;
}

module.exports = {
  detectReplyLanguage,
  replyAboutSwagatSuite
};
