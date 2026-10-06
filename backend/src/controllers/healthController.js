function health(_req, res) {
  res.json({ message: "Restro QR backend is running.", version: "v1" });
}

module.exports = {
  health
};
