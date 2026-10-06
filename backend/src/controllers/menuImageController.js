const { generateFoodItemImage } = require("../services/foodImageGenerator");

async function generateMenuItemImage(req, res) {
  try {
    const name = String(req.body?.name || "").trim();
    if (name.length < 2) {
      return res.status(400).json({ message: "Item name is required to generate an image (min 2 characters)." });
    }

    const description = String(req.body?.description || "").trim();
    const category = String(req.body?.category || "").trim();

    const result = await generateFoodItemImage({ name, description, category });
    return res.json({
      success: true,
      imageUrl: result.imageUrl,
      provider: result.provider
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Could not generate food image."
    });
  }
}

module.exports = {
  generateMenuItemImage
};
