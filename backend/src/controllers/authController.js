const { APP_STATE } = require("../config/constants");
const { getConfigValue, upsertConfigValue } = require("../models/configModel");

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const currentPassword = await getConfigValue("superadmin_password");

    if (email === APP_STATE.superAdminEmail && password === currentPassword) {
      return res.json({
        success: true,
        token: `superadmin-${Date.now()}`,
        user: { name: "SHIVAM BHARDWAJ", email: APP_STATE.superAdminEmail }
      });
    }

    return res.status(401).json({ success: false, message: "Invalid credentials." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function resetPassword(req, res) {
  try {
    const { email, newPassword } = req.body;
    if (email !== APP_STATE.superAdminEmail) {
      return res.status(400).json({ success: false, message: "Invalid user for reset." });
    }
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }
    await upsertConfigValue("superadmin_password", newPassword);
    return res.json({ success: true, message: "Password reset successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  login,
  resetPassword
};
