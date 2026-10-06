function buildFoodImagePrompt({ name, description, category }) {
  const dish = String(name || "restaurant dish").trim();
  const categoryPart = category ? `${category} course` : "restaurant dish";
  const descPart = description ? String(description).trim().slice(0, 140) : "";
  return [
    `Professional appetizing food photography of "${dish}"`,
    categoryPart,
    descPart,
    "single plated serving, soft natural lighting, shallow depth of field, clean background, high resolution menu photo, no text, no watermark, no people, no hands"
  ]
    .filter(Boolean)
    .join(", ");
}

async function generateWithOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_IMAGE_MODEL || "dall-e-3";
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
      quality: "standard"
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI image generation failed.");
  }

  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image data.");
  return `data:image/png;base64,${b64}`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 90000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function generateWithPollinations(prompt) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true&enhance=true`;
  const response = await fetchWithTimeout(url, {
    headers: { "User-Agent": "RestroQR-FoodImage/1.0" }
  });

  if (!response.ok) {
    throw new Error("AI image service is unavailable. Try again in a moment.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("Empty image received from AI service.");

  const contentType = (response.headers.get("content-type") || "image/jpeg").split(";")[0];
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

async function generateFoodItemImage({ name, description, category }) {
  const prompt = buildFoodImagePrompt({ name, description, category });

  if (process.env.OPENAI_API_KEY) {
    try {
      const imageUrl = await generateWithOpenAI(prompt);
      if (imageUrl) return { imageUrl, provider: "openai" };
    } catch (error) {
      if (process.env.FOOD_IMAGE_OPENAI_ONLY === "true") throw error;
      console.warn("[foodImage] OpenAI failed, using fallback:", error.message);
    }
  }

  const imageUrl = await generateWithPollinations(prompt);
  return { imageUrl, provider: "pollinations" };
}

module.exports = {
  buildFoodImagePrompt,
  generateFoodItemImage
};
