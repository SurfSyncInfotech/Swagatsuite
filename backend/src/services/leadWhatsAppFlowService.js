const {
  isConfigured,
  normalizeIndianPhone,
  sendWelcomeMessage,
  sendQuestion,
  sendCompletionMessage,
  sendTextMessage,
  getOptionLabel,
  getQuestionKeyForOption,
  getNextQuestionKey,
  QUESTIONS,
  QUESTION_ORDER
} = require("./smartpingWhatsAppService");
const { replyAboutSwagatSuite } = require("./whatsappAiService");
const {
  updateLeadWhatsAppStep,
  updateLeadQualificationField,
  getActiveLeadByPhone,
  getLatestLeadByPhone
} = require("../models/leadModel");

async function sendWithRetry(label, fn, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.error(
        `WhatsApp ${label} attempt ${i + 1}/${attempts} failed:`,
        error.message,
        error.cause ? `(cause: ${error.cause.code || error.cause.message || error.cause})` : ""
      );
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 800 * (i + 1)));
      }
    }
  }
  throw lastError;
}

function isQualificationStep(step) {
  return QUESTION_ORDER.some((key) => QUESTIONS[key].step === step);
}

function buildAnswers(lead) {
  return {
    business_type: lead.business_type,
    outlet_count: lead.outlet_count,
    challenge: lead.challenge,
    order_method: lead.order_method,
    implement_timeline: lead.implement_timeline,
    demo_interest: lead.demo_interest
  };
}

async function startLeadWhatsAppFlow({ id, name, phone }) {
  if (!isConfigured()) {
    await updateLeadWhatsAppStep(id, "failed", "SmartPing WhatsApp is not configured.");
    return;
  }

  const to = normalizeIndianPhone(phone);
  if (!to || to.length < 12) {
    await updateLeadWhatsAppStep(
      id,
      "failed",
      `Invalid phone for WhatsApp (normalized: ${to || "empty"}).`
    );
    return;
  }

  try {
    await sendWithRetry("welcome", () => sendWelcomeMessage(to, name));
    await updateLeadWhatsAppStep(id, "welcome_sent");
  } catch (error) {
    await updateLeadWhatsAppStep(id, "failed", `Welcome failed: ${error.message}`);
    throw error;
  }
}

async function handleInboundTextReply(phone, messageText) {
  const to = normalizeIndianPhone(phone);
  const lead = await getLatestLeadByPhone(to);
  if (!lead) return null;

  const text = String(messageText || "").trim();

  if (lead.whatsapp_step === "welcome_sent") {
    await sendWithRetry("q1", () => sendQuestion(to, "q1"));
    await updateLeadWhatsAppStep(lead.id, "q1_sent");
    return lead;
  }

  if (lead.whatsapp_step === "completed") {
    try {
      await replyAboutSwagatSuite({ phone: to, lead, userMessage: text });
    } catch (error) {
      console.error(`WhatsApp AI reply failed for lead ${lead.id}:`, error.message);
      await sendTextMessage(
        to,
        "Sorry, I could not process that right now. Email hello@surfsyncinfotech.com or call +91 94296 94356."
      );
    }
    return lead;
  }

  if (isQualificationStep(lead.whatsapp_step)) {
    await sendTextMessage(to, "Please tap an option on the question above to continue.");
    return lead;
  }

  return lead;
}

async function handleQualificationReply(phone, optionId) {
  const questionKey = getQuestionKeyForOption(optionId);
  if (!questionKey) return null;

  const question = QUESTIONS[questionKey];
  const to = normalizeIndianPhone(phone);
  let lead = await getActiveLeadByPhone(to, question.step);
  if (!lead) lead = await getLatestLeadByPhone(to);
  if (!lead) return null;

  if (lead.whatsapp_step !== question.step) {
    return null;
  }

  const label = getOptionLabel(optionId);
  await updateLeadQualificationField(lead.id, question.field, label);

  lead = { ...lead, [question.field]: label };

  const nextKey = getNextQuestionKey(questionKey);
  if (nextKey) {
    await sendWithRetry(nextKey, () => sendQuestion(to, nextKey));
    await updateLeadWhatsAppStep(lead.id, QUESTIONS[nextKey].step);
    return lead;
  }

  await sendCompletionMessage(to, buildAnswers(lead));
  await updateLeadWhatsAppStep(lead.id, "completed");
  return lead;
}

module.exports = {
  startLeadWhatsAppFlow,
  handleInboundTextReply,
  handleQualificationReply
};
