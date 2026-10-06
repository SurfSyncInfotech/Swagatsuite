/** Hindi / Hinglish food terms mapped to English menu tokens for matching. */
const FOOD_ALIASES = {
  kulfi: ["कुल्फी", "कुल्फि", "kulfi", "kulfee"],
  falooda: ["फालूदा", "फलूदा", "faluda", "falooda"],
  rasmalai: ["रसमलाई", "रसमालाई", "rasmalai", "ras malai"],
  paneer: ["पनीर", "panir", "paner"],
  chicken: ["चिकन", "मुर्ग", "मुर्गी", "chiken"],
  biryani: ["बिरयानी", "बिरयाणी", "biriyani", "briyani"],
  tikka: ["टिक्का", "tika"],
  kebab: ["कबाब", "कबाब", "kebob", "kabob"],
  seekh: ["सीख", "seek"],
  chilli: ["चिली", "मिर्च", "chili", "chilly"],
  cheese: ["चीज", "चीज़", "cheez"],
  corn: ["कॉर्न", "मकई", "makai"],
  veg: ["वेज", "शाकाहारी", "vegetarian"],
  hara: ["हरा", "haraa"],
  bhara: ["भरा", "bharaa"],
  coffee: ["काफी", "coffee", "cafe", "कॉफी"],
  tea: ["चाय", "chai", "चा"],
  water: ["पानी", "pani"],
  juice: ["जूस", "रस"],
  lassi: ["लassi", "लस्सी"],
  shake: ["शेक", "milkshake"],
  burger: ["बर्गर"],
  pizza: ["पिज़्जा", "पिज्जा"],
  pasta: ["पास्ता"],
  noodles: ["नूडल्स", "चाउमीन", "chowmein", "noodle"],
  rice: ["चावल", "chawal"],
  dal: ["दाल", "daal"],
  roti: ["रोटी", "roti"],
  naan: ["नान", "nan"],
  paratha: ["पराठा", "paratha", "parantha"],
  dosa: ["डोसा", "dossa"],
  idli: ["इडली", "idly"],
  samosa: ["समोसा"],
  pakora: ["पकोड़ा", "pakoda", "pakora"],
  sandwich: ["सैंडविच"],
  soup: ["सूप"],
  salad: ["सलाद"],
  ice: ["आइस", "ice"],
  cream: ["क्रीम"],
  chocolate: ["चॉकलेट", "choclate"],
  vanilla: ["वेनिला"],
  strawberry: ["स्ट्रॉबेरी"],
  mango: ["आम", "aam"],
  butter: ["बटर"],
  grilled: ["ग्रिल्ड", "grill"],
  fried: ["फ्राइड", "तला"],
  masala: ["मसाला"],
  curry: ["करी", "kadhi"],
  korma: ["कोरमा"],
  malai: ["मलाई", "malai"],
  kofta: ["कोफ्ता", "kofta"],
  pulao: ["पुलाव", "pulav", "pilaf"],
  thali: ["थाली"],
  combo: ["कॉम्बो"],
  special: ["स्पेशल", "खास"],
  sweet: ["मिठाई", "dessert", "डेज़र्ट"],
  gulab: ["गुलाब"],
  jamun: ["जामुन"],
  jalebi: ["जलेबी"],
  halwa: ["हलवा", "halva"],
  kheer: ["खीर"],
  rabri: ["रबड़ी", "rabdi"],
  brownie: ["ब्राउनी"],
  cake: ["केक"],
  pastry: ["पेस्ट्री"],
  waffle: ["वॉफ़ल", "waffle"],
  pancake: ["पैनकेक"],
  espresso: ["एस्प्रेसो"],
  latte: ["लट्टे", "लाते"],
  cappuccino: ["कैपुचिनो", "cappucino"],
  mocha: ["मोका"],
  frappe: ["फ्रैपे"],
  smoothie: ["स्मूदी"],
  lemonade: ["नींबू पानी", "nimbu pani"],
  soda: ["सोडा"],
  cola: ["कोला"],
  fries: ["फ्राइज", "finger chips"],
  chips: ["चिप्स"],
  momo: ["मोमो", "dimsum"],
  manchurian: ["मंचूरियन"],
  schezwan: ["सिचुआन", "schezwan"],
  tandoori: ["तंदूरी"],
  afghani: ["अफगानी"],
  hyderabadi: ["हैदराबादी"],
  lucknowi: ["लखनवी"],
  amritsari: ["अमृतसरी"]
};

const QTY_WORDS = {
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
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
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

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAliasLookup() {
  const lookup = new Map();
  for (const [english, forms] of Object.entries(FOOD_ALIASES)) {
    lookup.set(english, english);
    for (const form of forms) {
      lookup.set(normalize(form), english);
    }
  }
  return lookup;
}

const ALIAS_LOOKUP = buildAliasLookup();

function expandToken(token) {
  const normalized = normalize(token);
  const english = ALIAS_LOOKUP.get(normalized) || normalized;
  const aliases = FOOD_ALIASES[english] || [];
  return new Set([normalized, english, ...aliases.map(normalize)]);
}

function parseQuantityFromSegment(text) {
  const q = normalize(text);
  const digit = q.match(/\b(\d{1,2})\b/);
  if (digit) return Number(digit[1]);
  for (const [word, val] of Object.entries(QTY_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(q) || q.startsWith(`${word} `) || q.endsWith(` ${word}`)) {
      return val;
    }
  }
  return 1;
}

function splitQuerySegments(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const parts = raw
    .split(/\s+(?:and|aur|और|plus|then|fir|फिर|with|saath|साथ)\s+|\s*,\s*|\s+&\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [raw];
}

function queryTokens(text) {
  const raw = String(text || "");
  const tokens = normalize(raw).split(/\s+/).filter((t) => t.length > 1);
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const form of expandToken(token)) expanded.add(form);
  }
  for (const [english, forms] of Object.entries(FOOD_ALIASES)) {
    if (raw.toLowerCase().includes(english) || normalize(raw).includes(english)) expanded.add(english);
    for (const form of forms) {
      if (raw.includes(form) || normalize(raw).includes(normalize(form))) {
        expanded.add(english);
        expanded.add(normalize(form));
      }
    }
  }
  return { raw, normalized: normalize(raw), tokens: expanded };
}

function requiredPartHits(partCount) {
  if (partCount <= 1) return 1;
  if (partCount === 2) return 2;
  return Math.max(2, partCount - 1);
}

function itemMentionedInQuery(item, query) {
  const nameNorm = normalize(item?.name || "");
  if (!nameNorm) return { matched: false, score: 0 };

  if (query.normalized.includes(nameNorm) || query.raw.toLowerCase().includes(String(item.name).toLowerCase())) {
    return { matched: true, score: 120 + nameNorm.length };
  }

  const nameParts = nameNorm.split(/\s+/).filter((t) => t.length > 1);
  let hits = 0;
  for (const part of nameParts) {
    for (const form of expandToken(part)) {
      if (form.length < 2 && !/[\u0900-\u097F]/.test(form)) continue;
      if (query.normalized.includes(form) || query.raw.includes(form)) {
        hits += 1;
        break;
      }
    }
  }

  const required = requiredPartHits(nameParts.length);
  if (hits >= required) {
    return { matched: true, score: 40 + hits * 20 + nameNorm.length };
  }

  return { matched: false, score: 0 };
}

function filterDistinctItems(list) {
  return list.filter((a, i, arr) => {
    const aNorm = normalize(a.item.name);
    return !arr.some((b, j) => {
      if (j === i) return false;
      const bNorm = normalize(b.item.name);
      return bNorm.includes(aNorm) && b.item.name.length > a.item.name.length;
    });
  });
}

function findMatchesInText(text, items) {
  const query = queryTokens(text);
  if (!query.normalized) return [];

  const matches = [];
  for (const item of items || []) {
    const { matched, score } = itemMentionedInQuery(item, query);
    if (matched && score >= 25) matches.push({ item, score });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches;
}

/**
 * Find all menu items mentioned in Hindi, Hinglish, or English speech/text.
 * @returns {{ item: object, qty: number }[]}
 */
export function findAllMenuItemsInQuery(text, items, defaultQty = 1) {
  const merged = new Map();

  const addHit = (item, qty) => {
    const q = Math.max(1, Number(qty) || 1);
    const prev = merged.get(item.id);
    if (prev) prev.qty += q;
    else merged.set(item.id, { item, qty: q });
  };

  const segments = splitQuerySegments(text);

  if (segments.length > 1) {
    for (const segment of segments) {
      const qty = parseQuantityFromSegment(segment) || defaultQty;
      const matches = findMatchesInText(segment, items);
      if (!matches.length) continue;
      addHit(matches[0].item, qty);
    }
  } else {
    const wholeQty = parseQuantityFromSegment(text) || defaultQty;
    const matches = findMatchesInText(text, items);
    for (const row of matches) {
      addHit(row.item, wholeQty);
    }
  }

  return filterDistinctItems([...merged.values()]);
}

export function findBestMenuItemInQuery(text, items, defaultQty = 1) {
  const all = findAllMenuItemsInQuery(text, items, defaultQty);
  return all.length ? [all[0]] : [];
}

export function formatItemListForConfirm(hits) {
  return hits
    .map((h) => (h.qty > 1 ? `${h.qty} ${h.item.name}` : h.item.name))
    .join(", ");
}
