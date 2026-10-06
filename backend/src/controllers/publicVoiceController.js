const { createSpeechAudio, generateVoiceReply } = require("../services/customerVoiceService");

async function speakVoice(req, res) {
  try {
    const text = String(req.body?.text || "").trim();
    const lang = String(req.body?.lang || "en").toLowerCase() === "hi" ? "hi" : "en";
    const skipPolish = Boolean(req.body?.skipPolish);

    if (!text) {
      return res.status(400).json({ message: "Text is required." });
    }

    const { audio, speechText } = await createSpeechAudio(text, lang, { skipPolish });
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("X-Speech-Text", encodeURIComponent(speechText.slice(0, 500)));
    return res.send(audio);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Voice synthesis failed." });
  }
}

async function replyVoice(req, res) {
  try {
    const message = String(req.body?.message || "").trim();
    const lang = String(req.body?.lang || "en").toLowerCase() === "hi" ? "hi" : "en";
    const context = req.body?.context || {};

    if (!message) {
      return res.status(400).json({ message: "Message is required." });
    }

    const reply = await generateVoiceReply({ message, lang, context });
    const { audio, speechText } = await createSpeechAudio(reply, lang);

    return res.json({
      reply,
      speechText,
      audioBase64: audio.toString("base64")
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Voice reply failed." });
  }
}

module.exports = {
  speakVoice,
  replyVoice
};
