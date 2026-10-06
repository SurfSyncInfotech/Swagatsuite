import { api } from "../config/api";
import { findAllMenuItemsInQuery } from "./hindiMenuMatching";

const HINDI_NUMBERS = {
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  paanch: 5,
  chhe: 6,
  saat: 7,
  aath: 8,
  nau: 9,
  das: 10,
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  पाँच: 5,
  छह: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  दस: 10
};

export const VOICE_LOCALES = {
  en: "en-IN",
  hi: "hi-IN"
};

export function isVoiceSupported() {
  return typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
}

export function stripMarkdownForSpeech(text) {
  return String(text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/[•#*_]/g, "")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatInrSpeech(value, lang = "en") {
  const n = Number(value || 0);
  return lang === "hi" ? `${Math.round(n)} रुपये` : `rupees ${Math.round(n)}`;
}

let speakQueue = Promise.resolve();
let currentAudio = null;

const INDIAN_VOICE_HINTS = [
  "neerja",
  "swara",
  "kajal",
  "pallavi",
  "ravi",
  "prabhat",
  "lekha",
  "hi-in",
  "en-in",
  "india",
  "hindi",
  "google india"
];

function scoreIndianVoice(voice, lang) {
  const locale = VOICE_LOCALES[lang] || VOICE_LOCALES.en;
  const l = String(voice?.lang || "").toLowerCase();
  const name = String(voice?.name || "").toLowerCase();
  let score = 0;

  if (l === locale.toLowerCase()) score += 200;
  else if (l.includes("-in")) score += 120;
  else if (lang === "hi" && l.startsWith("hi")) score += 80;
  else if (lang === "en" && l.startsWith("en")) score += 40;

  for (const hint of INDIAN_VOICE_HINTS) {
    if (name.includes(hint)) score += 30;
  }

  return score;
}

function pickIndianVoice(voices, lang) {
  if (!voices?.length) return null;
  return [...voices].sort((a, b) => scoreIndianVoice(b, lang) - scoreIndianVoice(a, lang))[0];
}

function loadBrowserVoices() {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve([]);
      return;
    }

    const existing = window.speechSynthesis.getVoices();
    if (existing.length) {
      resolve(existing);
      return;
    }

    const onVoices = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      resolve(window.speechSynthesis.getVoices());
    };

    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
    window.setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      resolve(window.speechSynthesis.getVoices());
    }, 600);
  });
}

async function speakWithBrowser(clean, lang) {
  if (!clean || typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }

  const voices = await loadBrowserVoices();
  const preferred = pickIndianVoice(voices, lang);

  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = VOICE_LOCALES[lang] || VOICE_LOCALES.en;
    utter.rate = lang === "hi" ? 0.88 : 0.9;
    utter.pitch = 1;
    if (preferred) utter.voice = preferred;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.speak(utter);
  });
}

export function stopSpeaking() {
  speakQueue = Promise.resolve();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function speakText(text, lang = "en", options = {}) {
  const clean = stripMarkdownForSpeech(text);
  if (!clean) return Promise.resolve();

  speakQueue = speakQueue.then(async () => {
    try {
      const response = await api.post(
        "/public/voice/speak",
        { text: clean, lang, skipPolish: Boolean(options.skipPolish) },
        { responseType: "blob", timeout: 90000 }
      );

      const url = URL.createObjectURL(response.data);
      await new Promise((resolve, reject) => {
        const audio = new Audio(url);
        currentAudio = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          currentAudio = null;
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          currentAudio = null;
          reject(new Error("Audio playback failed."));
        };
        void audio.play().catch(reject);
      });
    } catch (_error) {
      await speakWithBrowser(clean, lang);
    }
  });

  return speakQueue;
}

export function createSpeechRecognizer({ lang, onResult, onError, onEnd }) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.lang = VOICE_LOCALES[lang] || VOICE_LOCALES.en;
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    onResult?.(transcript.trim());
  };
  recognition.onerror = (event) => onError?.(event);
  recognition.onend = () => onEnd?.();

  return recognition;
}

export function parseQuantityFromSpeech(text) {
  const q = normalizeSpeech(text);
  const digit = q.match(/\b(\d{1,2})\b/);
  if (digit) return Number(digit[1]);
  for (const [word, val] of Object.entries(HINDI_NUMBERS)) {
    if (q.includes(` ${word} `) || q.startsWith(`${word} `) || q.endsWith(` ${word}`)) return val;
  }
  return 1;
}

export function normalizeSpeech(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isStopVoiceCommand(text) {
  const q = normalizeSpeech(text);
  if (!q) return false;
  if (/^(stop|wait|pause|chup|ruk|ruko|rukiye|bas|quiet|silence)$/.test(q)) return true;
  return (
    /\b(stop|wait|pause)\b/.test(q) ||
    /ruk\s*jai?ye?/.test(q) ||
    /ruk\s*jao?/.test(q) ||
    /ruk\s*ja/.test(q) ||
    /band\s*kar/.test(q) ||
    /chup\s*ho/.test(q) ||
    /bas\s*kar/.test(q) ||
    /बंद\s*कर/.test(q) ||
    /रुक\s*जा/.test(q) ||
    /रुकिए|रुकिये|रुको/.test(q) ||
    /चुप/.test(q)
  );
}

export function isYesVoiceCommand(text) {
  const q = normalizeSpeech(text);
  if (!q) return false;
  if (/^(yes|yeah|yep|yup|correct|right|ok|okay|sure|ha|haan|han|ji|theek|ठीक|हाँ|हां|हा|जी|सही|बिल्कुल|haa|haan ji|ji haan)$/.test(q)) {
    return true;
  }
  return (
    /\b(yes|yeah|yep|yup|correct|right|okay|sure|haan|han|ha)\b/.test(q) ||
    /(हाँ|हां|हा|जी|सही|ठीक|बिल्कुल)/.test(q)
  );
}

export function isNoVoiceCommand(text) {
  const q = normalizeSpeech(text);
  if (!q) return false;
  if (/^(no|nope|nah|wrong|galat|nahi|na|नहीं|नही|गलत)$/.test(q)) return true;
  return (
    /\b(no|nope|nah|wrong|galat|nahi|na)\b/.test(q) ||
    /(नहीं|नही|गलत)/.test(q)
  );
}

const RATING_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  paanch: 5,
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  पाँच: 5
};

export function extractRatingFromSpeech(text) {
  const q = normalizeSpeech(text);
  if (!q) return 0;
  const digit = q.match(/\b([1-5])\b/);
  if (digit) return Number(digit[1]);
  for (const [word, val] of Object.entries(RATING_WORDS)) {
    if (q.includes(word)) return val;
  }
  return 0;
}

export function findItemsInSpeech(text, items) {
  return findAllMenuItemsInQuery(text, items, 1);
}

export { getProfessionalWelcome } from "./customerChatbot";

export function voiceMessages(lang) {
  const en = {
    pickLanguage: "Choose English or Hindi to hear voice replies.",
    welcome: (name) => getProfessionalWelcome(name, "en"),
    listening: "I am listening. Please speak now.",
    menuIntro: (count) => `Here is our full menu with prices. We have ${count} items available.`,
    added: (name, qty, total) =>
      `Added ${qty} ${name} to your order. Your cart total is ${formatInrSpeech(total, "en")}.`,
    confirmAdd: (name, qty) =>
      `I understood ${qty} ${name}. Is that correct? Please say yes or no.`,
    confirmAddMultiple: (hits) => {
      const list = Array.isArray(hits)
        ? hits.map((h) => (h.qty > 1 ? `${h.qty} ${h.item?.name || h.name}` : h.item?.name || h.name)).join(", ")
        : String(hits || "");
      return `I understood ${list}. Is that correct? Please say yes or no.`;
    },
    addedConfirmed: (name, qty, total) =>
      `Done. Added ${qty} ${name}. Your cart total is ${formatInrSpeech(total, "en")}.`,
    addedMultipleConfirmed: (names, total) =>
      `Done. Added ${names}. Your cart total is ${formatInrSpeech(total, "en")}.`,
    retryAddItem: "Okay, please say the item name and quantity again clearly.",
    confirmOrder: (rows, cartTotal) => {
      const lines = rows.map((r) => `${r.qty} ${r.item.name}`).join(", ");
      return `Your order is ${lines}. Total ${formatInrSpeech(cartTotal, "en")}. Is this correct? Say yes to proceed or no to change.`;
    },
    retryOrder: "Okay, tell me what you would like to add or change.",
    confirmUnclear: "Please say yes or no.",
    itemNotFound:
      "Sorry, I could not find that dish. Please say the item name clearly, for example two butter chicken.",
    emptyCart: "Your cart is empty. Please tell me what you would like to eat first.",
    askName: "May I know your name please?",
    askPhone: "Please tell me your ten digit mobile number.",
    couldNotHearName: "Sorry, I could not catch your name. Please say your name again.",
    couldNotHearPhone: "Sorry, I could not catch your mobile number. Please say your ten digit number again.",
    askEmail:
      "Please say your email address. For example, john at the rate gmail dot com.",
    couldNotHearEmail:
      "Sorry, I could not catch your email. Please say it like john at the rate gmail dot com.",
    confirmOrderDetails: (name, phone, email) =>
      `I have your name as ${name}, mobile ${phone}, and email ${email}. Is this correct? Please say yes or no.`,
    retryOrderDetails: "Okay, let's collect your details again. Please tell me your name.",
    orderPlaced: "Your order has been placed. I will keep you updated on the status.",
    status: (status, tag) => `Your order status is ${status}. ${tag}`,
    payInvoice: "Your bill is ready. Please tap Pay Invoice on the left, or pay at the counter.",
    invoiceReady: "Your bill has been generated. Please tap Pay Invoice to view your bill.",
    review: "Your order is complete. Please tap Submit Review and share your feedback.",
    reviewPrompt:
      "Your order is completed. Please share a review. Tap Submit Review, or tell me your rating from 1 to 5 and your experience.",
    askReviewRating: "Please tell me your rating from 1 to 5 stars.",
    askReviewComment: "Thank you. Please tell me about your experience in a few words.",
    couldNotHearRating: "Sorry, I did not catch the rating. Please say a number from 1 to 5.",
    reviewThanks: "Thank you for your review. We appreciate your feedback.",
    thankYou: "Thank you for visiting us. We hope to serve you again soon.",
    invoicePaid: "Your bill is paid. You can download the invoice from View Invoice.",
    notUnderstood: "Sorry, I did not understand. You can say menu, order food, order status, or pay invoice."
  };

  const hi = {
    pickLanguage: "आवाज़ में जवाब सुनने के लिए English या हिंदी चुनिए।",
    welcome: (name) => getProfessionalWelcome(name, "hi"),
    listening: "मैं सुन रहा हूँ। अब बोलिए।",
    menuIntro: (count) => `यह हमारा पूरा मेनू दाम के साथ है। कुल ${count} व्यंजन उपलब्ध हैं।`,
    menuVoicePrompt: (count) =>
      `यह हमारा मेनू है, कुल ${count} व्यंजन उपलब्ध हैं। आप स्क्रीन पर मेनू देख सकते हैं। कृपया बताइए, आप क्या ऑर्डर करना चाहेंगे? मैं आपकी सहायता के लिए उपलब्ध हूँ।`,
    added: (name, qty, total) =>
      `${qty} ${name} आपके ऑर्डर में जोड़ दिया गया है। कुल राशि ${formatInrSpeech(total, "hi")} है।`,
    confirmAdd: (name, qty) =>
      `मैंने समझा ${qty} ${name}। क्या यह सही है? कृपया हाँ या नहीं बोलिए।`,
    confirmAddMultiple: (hits) => {
      const list = Array.isArray(hits)
        ? hits.map((h) => (h.qty > 1 ? `${h.qty} ${h.item?.name || h.name}` : h.item?.name || h.name)).join(", ")
        : String(hits || "");
      return `मैंने समझा: ${list}। क्या यह सही है? कृपया हाँ या नहीं बोलिए।`;
    },
    addedConfirmed: (name, qty, total) =>
      `ठीक है, ${qty} ${name} जोड़ दिया गया। कुल राशि ${formatInrSpeech(total, "hi")} है।`,
    addedMultipleConfirmed: (names, total) =>
      `ठीक है, ${names} जोड़ दिए गए। कुल राशि ${formatInrSpeech(total, "hi")} है।`,
    retryAddItem: "ठीक है, कृपया व्यंजन का नाम और मात्रा फिर से बोलिए।",
    confirmOrder: (rows, cartTotal) => {
      const lines = rows.map((r) => `${r.qty} ${r.item.name}`).join(", ");
      return `आपका ऑर्डर है: ${lines}। कुल ${formatInrSpeech(cartTotal, "hi")}। क्या यह सही है? आगे बढ़ने के लिए हाँ बोलिए, बदलने के लिए नहीं।`;
    },
    retryOrder: "ठीक है, बताइए आप क्या जोड़ना या बदलना चाहते हैं।",
    confirmUnclear: "कृपया हाँ या नहीं बोलिए।",
    itemNotFound:
      "माफ़ कीजिए, यह व्यंजन नहीं मिला। कृपया नाम फिर से बोलिए, जैसे दो बटर चिकन।",
    emptyCart: "आपका कार्ट खाली है। पहले बताइए आप क्या खाना चाहेंगे।",
    askName: "कृपया अपना नाम बताइए।",
    askPhone: "कृपया अपना दस अंकों का मोबाइल नंबर बोलिए।",
    couldNotHearName: "माफ़ कीजिए, नाम समझ नहीं आया। कृपया अपना नाम फिर से बोलिए।",
    couldNotHearPhone: "माफ़ कीजिए, मोबाइल नंबर समझ नहीं आया। कृपया दस अंकों का नंबर फिर से बोलिए।",
    askEmail:
      "कृपया अपना ईमेल बताइए। जैसे, rahul at the rate gmail dot com।",
    couldNotHearEmail:
      "माफ़ कीजिए, ईमेल समझ नहीं आया। कृपया फिर से बोलिए — जैसे rahul at the rate gmail dot com।",
    confirmOrderDetails: (name, phone, email) =>
      `आपका नाम ${name}, मोबाइल ${phone}, और ईमेल ${email} है। क्या यह सही है? कृपया हाँ या नहीं बोलिए।`,
    retryOrderDetails: "ठीक है, आपकी जानकारी फिर से लेते हैं। कृपया अपना नाम बताइए।",
    orderPlaced: "आपका ऑर्डर हो गया है। मैं स्थिति की जानकारी देता रहूँगा।",
    status: (status, tag) => `आपके ऑर्डर की स्थिति ${status} है। ${tag}`,
    payInvoice: "आपका बिल तैयार है। बाएँ तरफ Pay Invoice दबाइए, या काउंटर पर भुगतान कीजिए।",
    invoiceReady: "आपका बिल तैयार हो गया है। कृपया Pay Invoice दबाकर बिल देखिए।",
    review: "आपका ऑर्डर पूरा हो गया। कृपया Submit Review दबाकर अपना अनुभव साझा कीजिए।",
    reviewPrompt:
      "आपका ऑर्डर पूरा (Completed) हो गया। कृपया समीक्षा दीजिए। Submit Review दबाइए, या 1 से 5 तक रेटिंग और अपना अनुभव बोलिए।",
    askReviewRating: "कृपया 1 से 5 तक अपनी रेटिंग बोलिए।",
    askReviewComment: "धन्यवाद। कृपया अपना अनुभव कुछ शब्दों में बोलिए।",
    couldNotHearRating: "माफ़ कीजिए, रेटिंग समझ नहीं आई। कृपया 1 से 5 तक कोई अंक बोलिए।",
    reviewThanks: "आपकी समीक्षा के लिए धन्यवाद।",
    thankYou: "हमारे रेस्तरां में आने के लिए धन्यवाद। फिर मिलेंगे।",
    invoicePaid: "बिल का भुगतान हो चुका है। View Invoice से रसीद डाउनलोड कर सकते हैं।",
    notUnderstood: "माफ़ कीजिए, समझ नहीं आया। मेनू, ऑर्डर, स्थिति या बिल कहकर पूछिए।"
  };

  return lang === "hi" ? hi : en;
}

export function statusVoiceLine(status, lang) {
  const mapEn = {
    Placed: "We have received your order.",
    Preparing: "The kitchen is preparing your food.",
    Ready: "Your order is ready for pickup.",
    Served: "Enjoy your meal.",
    Completed: "Your order is complete."
  };
  const mapHi = {
    Placed: "हमें आपका ऑर्डर मिल गया है।",
    Preparing: "रसोई में आपका खाना बन रहा है।",
    Ready: "आपका ऑर्डर तैयार है, कृपया काउंटर से लीजिए।",
    Served: "खाने का आनंद लीजिए।",
    Completed: "आपका ऑर्डर पूरा हो गया है।"
  };
  const map = lang === "hi" ? mapHi : mapEn;
  return map[status] || "";
}

export function guestEmailFromPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "").slice(-10);
  return `guest.${digits || Date.now()}@swagatsuite.order`;
}

export function looksLikeNonNameIntent(q) {
  return /(menu|price|order|coffee|bill|status|invoice|review|thank|hello|hi|hey|namaste|मेनू|ऑर्डर|काफी|बिल|स्थिति|दाम|खाना|नमस्ते)/i.test(
    String(q || "")
  );
}

export function extractPhoneFromSpeech(text) {
  const digits = String(text || "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return "";
}

const DEVANAGARI_CONSONANTS = {
  क: "k",
  ख: "kh",
  ग: "g",
  घ: "gh",
  ङ: "ng",
  च: "ch",
  छ: "chh",
  ज: "j",
  झ: "jh",
  ञ: "ny",
  ट: "t",
  ठ: "th",
  ड: "d",
  ढ: "dh",
  ण: "n",
  त: "t",
  थ: "th",
  द: "d",
  ध: "dh",
  न: "n",
  प: "p",
  फ: "ph",
  ब: "b",
  भ: "bh",
  म: "m",
  य: "y",
  र: "r",
  ल: "l",
  व: "v",
  श: "sh",
  ष: "sh",
  स: "s",
  ह: "h",
  क़: "q",
  ख़: "kh",
  ग़: "gh",
  ज़: "z",
  ड़: "d",
  ढ़: "dh",
  फ़: "f",
  य़: "y"
};

const DEVANAGARI_MATRAS = {
  "\u093e": "a",
  "\u093f": "i",
  "\u0940": "i",
  "\u0941": "u",
  "\u0942": "u",
  "\u0943": "ri",
  "\u0947": "e",
  "\u0948": "ai",
  "\u094b": "o",
  "\u094c": "au",
  "\u0949": "o",
  "\u0945": "e"
};

const DEVANAGARI_VOWELS = {
  अ: "a",
  आ: "a",
  इ: "i",
  ई: "i",
  उ: "u",
  ऊ: "u",
  ऋ: "ri",
  ए: "e",
  ऐ: "ai",
  ओ: "o",
  औ: "au",
  ऑ: "o",
  ऍ: "e"
};

export function transliterateDevanagariToAscii(text) {
  let out = "";
  for (const ch of String(text || "")) {
    if (/[a-zA-Z0-9._%+-]/.test(ch)) {
      out += ch.toLowerCase();
      continue;
    }
    if (/\s/.test(ch)) continue;
    if (DEVANAGARI_CONSONANTS[ch]) {
      out += DEVANAGARI_CONSONANTS[ch];
      continue;
    }
    if (DEVANAGARI_MATRAS[ch]) {
      out += DEVANAGARI_MATRAS[ch];
      continue;
    }
    if (DEVANAGARI_VOWELS[ch]) {
      out += DEVANAGARI_VOWELS[ch];
      continue;
    }
    if (ch === "\u094d" || ch === "\u0901") continue;
    if (ch === "\u0902") out += "n";
  }
  return out;
}

const HINDI_EMAIL_LOCAL_ALIASES = {
  "\u0915\u0947\u092f\u0930": "care"
};

function cleanEmailLocalPart(text) {
  const raw = String(text || "").trim();
  if (HINDI_EMAIL_LOCAL_ALIASES[raw]) return HINDI_EMAIL_LOCAL_ALIASES[raw];
  return transliterateDevanagariToAscii(raw).replace(/[^a-z0-9._%+-]/gi, "");
}

function cleanEmailDomainPart(text) {
  let domain = transliterateDevanagariToAscii(text).toLowerCase();
  domain = domain.replace(/\s+/g, "").replace(/[^a-z0-9.-]/gi, "");
  return domain;
}

function buildEmailFromParts(localRaw, domainRaw) {
  const local = cleanEmailLocalPart(localRaw);
  const domain = cleanEmailDomainPart(domainRaw);
  if (!local || !domain.includes(".")) return "";
  const email = `${local}@${domain}`;
  return isValidEmail(email) ? email.toLowerCase() : "";
}

export function normalizeSpokenEmailText(text) {
  let s = String(text || "").trim();
  if (!s) return "";

  s = s.replace(
    /\b(my email is|email is|email id is|my email id is|email address is|mera email|mera email id|ईमेल|ईमेल आईडी)\b/gi,
    " "
  );

  s = s.replace(
    /attherate|at\s*the\s*rate\s*of|at\s*the\s*rate|at\s*rate|एट\s*द\s*रेट|एट\s*रेट|एट\s*द?\s*रेट|(?:^|\s)एट(?=\s|द|$)/gi,
    "@"
  );
  s = s.replace(/\brate\b/gi, "@");
  s = s.replace(/\bat\b/gi, "@");
  s = s.replace(/\b(dot|period|point|डॉट|डट)\b/gi, ".");
  s = s.replace(/\b(underscore|under\s*score)\b/gi, "_");
  s = s.replace(/\b(hyphen|dash)\b/gi, "-");

  s = s.replace(/\s*@\s*/g, "@");
  s = s.replace(/\s*\.\s*/g, ".");
  s = s.replace(/[@.]+/g, (m) => m[0]);
  s = s.replace(/\s+/g, "");

  return s;
}

export function isValidEmail(email) {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(String(email || "").trim());
}

export function extractEmailFromSpeech(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  const atMatch = raw.match(/^(.+?)@(.+)$/);
  if (atMatch) {
    const email = buildEmailFromParts(atMatch[1], atMatch[2]);
    if (email) return email;
  }

  const normalized = normalizeSpokenEmailText(raw);
  const atIdx = normalized.indexOf("@");
  if (atIdx > 0) {
    const email = buildEmailFromParts(normalized.slice(0, atIdx), normalized.slice(atIdx + 1));
    if (email) return email;
  }

  const match = normalized.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

export function extractNameFromSpeech(text, lang) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  const q = normalizeSpeech(raw);
  if (lang === "hi") {
    const m = q.match(/(?:mera naam|naam hai|main|मेरा नाम|नाम है|मैं)\s+(.+)/i);
    if (m) return capitalize(m[1].trim());
  }
  const m = q.match(/(?:my name is|i am|i'm|name is)\s+(.+)/i);
  if (m) return capitalize(m[1].trim());
  return capitalize(raw.split(" ").slice(0, 4).join(" "));
}

function capitalize(s) {
  const v = String(s || "").trim();
  if (!v) return "";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export function buildMenuSpeechText(ctx, lang, limit = 18) {
  if (!ctx.items?.length) {
    return lang === "hi" ? "मेनू अभी उपलब्ध नहीं है।" : "The menu is not available right now.";
  }
  const slice = ctx.items.slice(0, limit);
  const lines = slice.map((item) => {
    const price = Math.round(Number(item.price || 0));
    return lang === "hi" ? `${item.name}, ${price} रुपये` : `${item.name}, ${price} rupees`;
  });
  const intro =
    lang === "hi"
      ? `हमारे मेनू में ${ctx.items.length} व्यंजन हैं।`
      : `Our menu has ${ctx.items.length} items.`;
  const more =
    ctx.items.length > limit
      ? lang === "hi"
        ? ` और ${ctx.items.length - limit} और व्यंजन भी उपलब्ध हैं।`
        : ` and ${ctx.items.length - limit} more items are also available.`
      : "";
  return `${intro} ${lines.join(". ")}.${more}`;
}
