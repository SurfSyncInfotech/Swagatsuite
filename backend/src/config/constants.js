const DB_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "restro_admin",
  password: process.env.DB_PASSWORD || "restro_admin_4510",
  database: process.env.DB_NAME || "restro_qr_app",
  waitForConnections: true,
  connectionLimit: 10
};

const APP_STATE = {
  port: process.env.PORT || 4510,
  superAdminEmail: "superadmin@4510",
  superAdminPassword: "surfsync@4510"
};

module.exports = {
  DB_CONFIG,
  APP_STATE
};
