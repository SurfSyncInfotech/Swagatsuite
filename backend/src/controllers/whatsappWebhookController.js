const {
  handleInboundTextReply,
  handleQualificationReply
} = require("../services/leadWhatsAppFlowService");

const VERIFY_TOKEN = process.env.SMARTPING_WEBHOOK_VERIFY_TOKEN || "swagatsuite_whatsapp_verify";

function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.status(403).json({ message: "Webhook verification failed." });
}

function extractInboundMessages(body) {
  const messages = [];

  const entries = Array.isArray(body?.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value || {};
      const inbound = Array.isArray(value.messages) ? value.messages : [];
      for (const message of inbound) {
        messages.push(message);
      }
    }
  }

  return messages;
}

async function receiveWebhook(req, res) {
  try {
    const messages = extractInboundMessages(req.body);

    for (const message of messages) {
      const phone = message?.from;
      if (!phone) continue;

      const interactive = message?.interactive;

      if (interactive?.type === "list_reply" && interactive.list_reply?.id) {
        await handleQualificationReply(phone, interactive.list_reply.id);
        continue;
      }

      if (interactive?.type === "button_reply" && interactive.button_reply?.id) {
        await handleQualificationReply(phone, interactive.button_reply.id);
        continue;
      }

      if (message.type === "text" && message.text?.body) {
        await handleInboundTextReply(phone, message.text.body);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("WhatsApp webhook error:", error.message);
    return res.status(200).json({ success: true });
  }
}

module.exports = {
  verifyWebhook,
  receiveWebhook
};
