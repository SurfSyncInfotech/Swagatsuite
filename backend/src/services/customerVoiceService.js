const MAX_TTS_CHARS = 3800;

const INDIAN_TTS_INSTRUCTIONS = {
  en: [
    "Voice: Warm, welcoming Indian restaurant host speaking educated Indian English.",
    "Accent: Natural Indian English as spoken in urban India — clear, polite, melodic intonation.",
    "Tone: Friendly, respectful, and helpful — like greeting guests at an Indian restaurant.",
    "Delivery: Moderate pace with natural pauses. Easy for elderly guests to follow."
  ].join(" "),
  hi: [
    "Voice: Warm, welcoming Indian restaurant host speaking natural Hindi.",
    "Accent: Authentic Indian Hindi pronunciation with natural rhythm and respectful tone.",
    "Pronunciation: Speak Hindi sentences in Hindi, but pronounce every menu and dish name in clear English (Latin names as written).",
    "Tone: सादर, मधुर और सहायक — जैसे भारतीय रेस्तरां में मेहमानों का स्वागत।",
    "Delivery: Moderate pace, clear articulation, conversational Indian Hindi."
  ].join(" ")
};

function getApiKey() {
  return String(process.env.OPENAI_API_KEY || "").trim();
}

function splitForSpeech(text) {
  const chunks = [];
  let remaining = String(text || "").trim();
  while (remaining.length > MAX_TTS_CHARS) {
    const slice = remaining.slice(0, MAX_TTS_CHARS);
    const breakAt = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("। "), slice.lastIndexOf(", "));
    const cut = breakAt > 200 ? breakAt + 1 : MAX_TTS_CHARS;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function callChatCompletion(messages, { maxTokens = 500, temperature = 0.6 } = {}) {
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
      temperature,
      max_tokens: maxTokens
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI chat request failed.");
  }

  return String(data?.choices?.[0]?.message?.content || "").trim();
}

async function polishForSpeech(text, lang) {
  const input = String(text || "").trim();
  if (!input) return "";

  const isHindi = lang === "hi";
  const system = isHindi
    ? [
        "You prepare Hindi text for a natural human-like restaurant voice assistant in India.",
        "Rewrite connective phrases in fluent conversational Indian Hindi using Devanagari.",
        "CRITICAL: Keep every menu item, dish, and food name in ORIGINAL ENGLISH exactly as in the input (Latin letters). Never translate or transliterate dish names.",
        "Use complete words and full sentences — never spell letter by letter.",
        "Sound warm, simple, and respectful — like a polite Indian restaurant host helping an elderly guest.",
        "For prices say 'रुपये' with the number.",
        "No markdown, no bullets, no emojis. Output only what should be spoken aloud."
      ].join(" ")
    : [
        "You prepare English text for a natural human-like restaurant voice assistant in India.",
        "Rewrite in warm conversational Indian English — clear, polite phrasing common in Indian hospitality.",
        "Sound friendly and respectful — like a helpful Indian restaurant host speaking to an elderly guest.",
        "No markdown, no bullets, no emojis. Output only what should be spoken aloud."
      ].join(" ");

  const polished = await callChatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: input }
    ],
    { maxTokens: 900, temperature: 0.5 }
  );

  return polished || input;
}

async function synthesizeChunk(text, lang) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("OpenAI API key is not configured.");

  const voice = lang === "hi"
    ? process.env.OPENAI_TTS_VOICE_HI || "coral"
    : process.env.OPENAI_TTS_VOICE_EN || "coral";

  const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
  const supportsInstructions = model.includes("gpt-4o-mini-tts");

  const body = {
    model,
    voice,
    input: text,
    response_format: "mp3",
    speed: lang === "hi" ? 0.92 : 0.95
  };

  if (supportsInstructions) {
    const customKey = lang === "hi" ? "OPENAI_TTS_INSTRUCTIONS_HI" : "OPENAI_TTS_INSTRUCTIONS_EN";
    body.instructions = String(process.env[customKey] || INDIAN_TTS_INSTRUCTIONS[lang] || "").trim();
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error?.message || "OpenAI speech synthesis failed.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
}

async function createSpeechAudio(text, lang, options = {}) {
  const input = String(text || "").trim();
  const hasEnglishNames = /[A-Za-z]{2,}/.test(input);
  const skipPolish = Boolean(options.skipPolish) || (lang === "hi" && hasEnglishNames);
  const polished = skipPolish ? input : await polishForSpeech(input, lang);
  const chunks = splitForSpeech(polished);
  const buffers = [];
  for (const chunk of chunks) {
    buffers.push(await synthesizeChunk(chunk, lang));
  }
  return {
    audio: Buffer.concat(buffers),
    speechText: polished
  };
}

async function generateVoiceReply({ message, lang, context }) {
  const isHindi = lang === "hi";
  const system = isHindi
    ? [
        "You are Swagat Suite restaurant voice assistant helping elderly non-technical guests in India, in Hindi.",
        "Reply ONLY in natural Indian Hindi (Devanagari) — full sentences, warm and human.",
        "CRITICAL: Always keep menu item and dish names in original English exactly as on the menu — never translate dish names to Hindi.",
        "Help with menu, ordering, order status, bill payment, and reviews.",
        "Keep replies concise for speech (under 120 words unless listing menu).",
        "When listing menu items, group naturally with prices in rupees.",
        "Never use markdown or bullet symbols in reply."
      ].join(" ")
    : [
        "You are Swagat Suite restaurant voice assistant helping elderly non-technical guests in India.",
        "Reply in warm natural Indian English with complete sentences — polite, clear hospitality tone.",
        "Help with menu, ordering, order status, bill payment, and reviews.",
        "Keep replies concise for speech unless listing menu.",
        "Never use markdown or bullet symbols in reply."
      ].join(" ");

  const contextJson = JSON.stringify(context || {}, null, 0);
  const reply = await callChatCompletion(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: `Restaurant context JSON:\n${contextJson}\n\nGuest said: ${message}\n\nReply for voice:`
      }
    ],
    { maxTokens: 700, temperature: 0.55 }
  );

  return reply;
}

module.exports = {
  createSpeechAudio,
  generateVoiceReply,
  polishForSpeech
};
