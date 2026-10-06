const dns = require("dns");
// Production VPS often resolves IPv6 first; SmartPing may be unreachable over IPv6.
dns.setDefaultResultOrder("ipv4first");

require("dotenv").config();

const app = require("./src/app");
const { APP_STATE } = require("./src/config/constants");
const { initDb } = require("./src/services/dbInitService");

app.listen(APP_STATE.port, async () => {
  try {
    await initDb();
    console.log(`Backend running on http://localhost:${APP_STATE.port}`);
  } catch (error) {
    console.error("DB init failed:", error.message);
    process.exit(1);
  }
});
