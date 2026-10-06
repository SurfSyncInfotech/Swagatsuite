const pool = require("../db/pool");

async function createServiceRequest({ restaurantCode, token, requestType }) {
  const [rows] = await pool.query(
    `
    SELECT
      r.id AS restaurant_id,
      t.id AS table_id,
      t.table_name
    FROM restaurants r
    INNER JOIN restaurant_tables t ON t.restaurant_id = r.id
    WHERE r.restaurant_code = ? AND t.qr_token = ? AND t.active = 1
    LIMIT 1
    `,
    [restaurantCode, token]
  );
  const row = rows[0];
  if (!row) return { ok: false, reason: "table_not_found" };

  const [existingRows] = await pool.query(
    `
    SELECT id
    FROM service_requests
    WHERE restaurant_id = ? AND table_id = ? AND request_type = ? AND status IN ('Pending', 'Acknowledged')
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [row.restaurant_id, row.table_id, requestType]
  );
  if (existingRows[0]) return { ok: false, reason: "already_pending" };

  const [insertRes] = await pool.query(
    `
    INSERT INTO service_requests (
      restaurant_id, table_id, request_type, status
    ) VALUES (?, ?, ?, 'Pending')
    `,
    [row.restaurant_id, row.table_id, requestType]
  );

  return {
    ok: true,
    requestId: insertRes.insertId,
    tableName: row.table_name
  };
}

async function listServiceRequestsByRestaurantCode(restaurantCode) {
  const [rows] = await pool.query(
    `
    SELECT
      sr.id,
      sr.request_type AS requestType,
      sr.status,
      sr.created_at AS createdAt,
      sr.acknowledged_at AS acknowledgedAt,
      sr.completed_at AS completedAt,
      t.table_name AS tableLabel
    FROM service_requests sr
    INNER JOIN restaurants r ON r.id = sr.restaurant_id
    INNER JOIN restaurant_tables t ON t.id = sr.table_id
    WHERE r.restaurant_code = ?
    ORDER BY
      CASE WHEN sr.status = 'Completed' THEN 1 ELSE 0 END ASC,
      sr.created_at DESC
    LIMIT 200
    `,
    [restaurantCode]
  );
  return rows;
}

async function updateServiceRequestStatusByRestaurantCode({
  restaurantCode,
  requestId,
  status
}) {
  if (!["Acknowledged", "Completed"].includes(status)) {
    return null;
  }
  const [result] = await pool.query(
    `
    UPDATE service_requests sr
    INNER JOIN restaurants r ON r.id = sr.restaurant_id
    SET
      sr.status = ?,
      sr.acknowledged_at = CASE
        WHEN ? = 'Acknowledged' AND sr.acknowledged_at IS NULL THEN CURRENT_TIMESTAMP
        ELSE sr.acknowledged_at
      END,
      sr.completed_at = CASE
        WHEN ? = 'Completed' THEN CURRENT_TIMESTAMP
        ELSE sr.completed_at
      END
    WHERE r.restaurant_code = ? AND sr.id = ?
    `,
    [status, status, status, restaurantCode, requestId]
  );
  return result.affectedRows > 0;
}

module.exports = {
  createServiceRequest,
  listServiceRequestsByRestaurantCode,
  updateServiceRequestStatusByRestaurantCode
};

