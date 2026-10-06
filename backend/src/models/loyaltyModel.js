const pool = require("../db/pool");

const STAMPS_PER_REWARD = 5;
const REWARD_VALUE_INR = 500;
/** Orders at this status count as a successful visit for loyalty stamps. */
const STAMP_ELIGIBLE_STATUSES = ["Completed"];

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

async function getRestaurantIdByCode(restaurantCode) {
  const [rows] = await pool.query(
    "SELECT id FROM restaurants WHERE restaurant_code = ? LIMIT 1",
    [restaurantCode]
  );
  return rows[0]?.id || null;
}

async function getOrderForStamp(restaurantId, orderId) {
  const [rows] = await pool.query(
    `
    SELECT id, customer_phone, status
    FROM orders
    WHERE id = ? AND restaurant_id = ? AND status = 'Completed'
    LIMIT 1
    `,
    [orderId, restaurantId]
  );
  return rows[0] || null;
}

/** Backfill stamps for served/completed orders that were never credited (e.g. before loyalty existed). */
async function syncMissingStampsForPhone(restaurantCode, phoneRaw) {
  const restaurantId = await getRestaurantIdByCode(restaurantCode);
  if (!restaurantId) return { synced: 0 };

  const phone = normalizePhone(phoneRaw);
  if (phone.length < 10) return { synced: 0 };

  const [orders] = await pool.query(
    `
    SELECT o.id, o.customer_phone
    FROM orders o
    LEFT JOIN loyalty_stamp_orders lso ON lso.order_id = o.id
    WHERE o.restaurant_id = ?
      AND o.status = 'Completed'
      AND lso.id IS NULL
    ORDER BY o.created_at ASC
    LIMIT 40
    `,
    [restaurantId]
  );

  let synced = 0;
  for (const order of orders) {
    if (normalizePhone(order.customer_phone) !== phone) continue;
    const result = await awardStampForCompletedOrder(restaurantCode, order.id);
    if (result.awarded) synced += 1;
  }
  return { synced };
}

async function awardStampForCompletedOrder(restaurantCode, orderId) {
  const restaurantId = await getRestaurantIdByCode(restaurantCode);
  if (!restaurantId) return { awarded: false };

  const order = await getOrderForStamp(restaurantId, orderId);
  if (!order) return { awarded: false };

  const phone = normalizePhone(order.customer_phone);
  if (phone.length < 10) return { awarded: false };

  const [existing] = await pool.query("SELECT id FROM loyalty_stamp_orders WHERE order_id = ? LIMIT 1", [
    orderId
  ]);
  if (existing.length) return { awarded: false, alreadyStamped: true };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [loyaltyRows] = await conn.query(
      `
      SELECT id, stamps_in_cycle, rewards_pending, total_stamps_earned, total_rewards_earned
      FROM customer_loyalty
      WHERE restaurant_id = ? AND customer_phone = ?
      LIMIT 1
      FOR UPDATE
      `,
      [restaurantId, phone]
    );

    let loyaltyId;
    let stampsInCycle = 0;
    let rewardsPending = 0;

    if (loyaltyRows[0]) {
      loyaltyId = loyaltyRows[0].id;
      stampsInCycle = Number(loyaltyRows[0].stamps_in_cycle || 0);
      rewardsPending = Number(loyaltyRows[0].rewards_pending || 0);
    } else {
      const [inserted] = await conn.query(
        `
        INSERT INTO customer_loyalty (restaurant_id, customer_phone, stamps_in_cycle, rewards_pending)
        VALUES (?, ?, 0, 0)
        `,
        [restaurantId, phone]
      );
      loyaltyId = inserted.insertId;
    }

    const nextStamp = stampsInCycle + 1;
    let rewardUnlocked = false;
    let newStampsInCycle = nextStamp;

    if (nextStamp >= STAMPS_PER_REWARD) {
      rewardUnlocked = true;
      newStampsInCycle = 0;
      rewardsPending += 1;
    }

    await conn.query(
      `
      UPDATE customer_loyalty
      SET
        stamps_in_cycle = ?,
        rewards_pending = ?,
        total_stamps_earned = total_stamps_earned + 1,
        total_rewards_earned = total_rewards_earned + ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [newStampsInCycle, rewardsPending, rewardUnlocked ? 1 : 0, loyaltyId]
    );

    await conn.query(
      `
      INSERT INTO loyalty_stamp_orders (
        restaurant_id, loyalty_id, order_id, customer_phone,
        stamp_number, reward_unlocked
      ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [restaurantId, loyaltyId, orderId, phone, nextStamp, rewardUnlocked ? 1 : 0]
    );

    await conn.commit();

    return {
      awarded: true,
      stampsInCycle: newStampsInCycle,
      stampEarned: nextStamp,
      rewardUnlocked,
      rewardsPending,
      stampsPerReward: STAMPS_PER_REWARD,
      rewardValueInr: REWARD_VALUE_INR
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

function normalizeLoyaltyRow(row) {
  if (!row) return null;
  return {
    stampsInCycle: Number(row.stamps_in_cycle || 0),
    stampsPerReward: STAMPS_PER_REWARD,
    rewardsPending: Number(row.rewards_pending || 0),
    totalStampsEarned: Number(row.total_stamps_earned || 0),
    totalRewardsEarned: Number(row.total_rewards_earned || 0),
    totalRewardsRedeemed: Number(row.total_rewards_redeemed || 0),
    rewardValueInr: REWARD_VALUE_INR
  };
}

async function getLoyaltyByPhone(restaurantCode, phoneRaw) {
  const restaurantId = await getRestaurantIdByCode(restaurantCode);
  if (!restaurantId) return null;

  const phone = normalizePhone(phoneRaw);
  if (phone.length < 10) return null;

  try {
    await syncMissingStampsForPhone(restaurantCode, phone);
  } catch (syncErr) {
    console.error("[loyalty] sync missing stamps failed:", syncErr.message);
  }

  const [rows] = await pool.query(
    `
    SELECT stamps_in_cycle, rewards_pending, total_stamps_earned,
           total_rewards_earned, total_rewards_redeemed
    FROM customer_loyalty
    WHERE restaurant_id = ? AND customer_phone = ?
    LIMIT 1
    `,
    [restaurantId, phone]
  );

  const base = normalizeLoyaltyRow(rows[0]) || {
    stampsInCycle: 0,
    stampsPerReward: STAMPS_PER_REWARD,
    rewardsPending: 0,
    totalStampsEarned: 0,
    totalRewardsEarned: 0,
    totalRewardsRedeemed: 0,
    rewardValueInr: REWARD_VALUE_INR
  };

  const [history] = await pool.query(
    `
    SELECT
      lso.order_id AS orderId,
      lso.stamp_number AS stampNumber,
      lso.reward_unlocked AS rewardUnlocked,
      lso.created_at AS earnedAt,
      o.amount AS orderAmount,
      o.table_label AS tableLabel
    FROM loyalty_stamp_orders lso
    INNER JOIN orders o ON o.id = lso.order_id
    WHERE lso.restaurant_id = ? AND lso.customer_phone = ?
    ORDER BY lso.created_at DESC
    LIMIT 30
    `,
    [restaurantId, phone]
  );

  return {
    phone,
    ...base,
    history: history.map((row) => ({
      orderId: row.orderId,
      stampNumber: Number(row.stampNumber),
      rewardUnlocked: Boolean(row.rewardUnlocked),
      earnedAt: row.earnedAt,
      orderAmount: Number(row.orderAmount || 0),
      tableLabel: row.tableLabel || ""
    }))
  };
}

async function redeemReward(restaurantCode, phoneRaw) {
  const restaurantId = await getRestaurantIdByCode(restaurantCode);
  if (!restaurantId) return { ok: false, reason: "restaurant" };

  const phone = normalizePhone(phoneRaw);
  if (phone.length < 10) return { ok: false, reason: "phone" };

  const [rows] = await pool.query(
    `
    SELECT id, rewards_pending
    FROM customer_loyalty
    WHERE restaurant_id = ? AND customer_phone = ?
    LIMIT 1
  `,
    [restaurantId, phone]
  );
  const row = rows[0];
  if (!row || Number(row.rewards_pending || 0) < 1) {
    return { ok: false, reason: "no_reward" };
  }

  await pool.query(
    `
    UPDATE customer_loyalty
    SET
      rewards_pending = rewards_pending - 1,
      total_rewards_redeemed = total_rewards_redeemed + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [row.id]
  );

  return { ok: true, rewardValueInr: REWARD_VALUE_INR };
}

async function adminRedeemRewardByLoyaltyId(restaurantCode, loyaltyId) {
  const restaurantId = await getRestaurantIdByCode(restaurantCode);
  if (!restaurantId) return { ok: false, reason: "restaurant" };

  const [rows] = await pool.query(
    `
    SELECT id, rewards_pending, customer_phone
    FROM customer_loyalty
    WHERE id = ? AND restaurant_id = ?
    LIMIT 1
    `,
    [loyaltyId, restaurantId]
  );
  const row = rows[0];
  if (!row || Number(row.rewards_pending || 0) < 1) {
    return { ok: false, reason: "no_reward" };
  }

  await pool.query(
    `
    UPDATE customer_loyalty
    SET
      rewards_pending = rewards_pending - 1,
      total_rewards_redeemed = total_rewards_redeemed + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [row.id]
  );

  return { ok: true, rewardValueInr: REWARD_VALUE_INR, phone: row.customer_phone };
}

async function syncAllMissingStampsForRestaurant(restaurantCode) {
  const restaurantId = await getRestaurantIdByCode(restaurantCode);
  if (!restaurantId) return { synced: 0 };

  const [orders] = await pool.query(
    `
    SELECT o.id
    FROM orders o
    LEFT JOIN loyalty_stamp_orders lso ON lso.order_id = o.id
    WHERE o.restaurant_id = ?
      AND o.status = 'Completed'
      AND lso.id IS NULL
    ORDER BY o.created_at ASC
    LIMIT 80
    `,
    [restaurantId]
  );

  let synced = 0;
  for (const order of orders) {
    const result = await awardStampForCompletedOrder(restaurantCode, order.id);
    if (result.awarded) synced += 1;
  }
  return { synced };
}

async function listLoyaltyOverviewForRestaurant(restaurantCode) {
  const restaurantId = await getRestaurantIdByCode(restaurantCode);
  if (!restaurantId) return null;

  try {
    await syncAllMissingStampsForRestaurant(restaurantCode);
  } catch (syncErr) {
    console.error("[loyalty] admin overview stamp sync failed:", syncErr.message);
  }

  const [members] = await pool.query(
    `
    SELECT
      id,
      customer_phone,
      stamps_in_cycle,
      rewards_pending,
      total_stamps_earned,
      total_rewards_earned,
      total_rewards_redeemed,
      updated_at
    FROM customer_loyalty
    WHERE restaurant_id = ?
    ORDER BY rewards_pending DESC, total_rewards_earned DESC, updated_at DESC
  `,
    [restaurantId]
  );

  const [rewardEvents] = await pool.query(
    `
    SELECT
      lso.id,
      lso.order_id,
      lso.customer_phone,
      lso.stamp_number,
      lso.created_at,
      o.table_label,
      o.amount,
      o.customer_name
    FROM loyalty_stamp_orders lso
    INNER JOIN orders o ON o.id = lso.order_id
    WHERE lso.restaurant_id = ? AND lso.reward_unlocked = 1
    ORDER BY lso.created_at DESC
    LIMIT 150
  `,
    [restaurantId]
  );

  const [recentStamps] = await pool.query(
    `
    SELECT
      lso.id,
      lso.order_id,
      lso.customer_phone,
      lso.stamp_number,
      lso.reward_unlocked,
      lso.created_at,
      o.table_label,
      o.amount,
      o.customer_name
    FROM loyalty_stamp_orders lso
    INNER JOIN orders o ON o.id = lso.order_id
    WHERE lso.restaurant_id = ?
    ORDER BY lso.created_at DESC
    LIMIT 150
  `,
    [restaurantId]
  );

  const normalizedMembers = members.map((row) => ({
    id: row.id,
    phone: row.customer_phone,
    stampsInCycle: Number(row.stamps_in_cycle || 0),
    rewardsPending: Number(row.rewards_pending || 0),
    totalStampsEarned: Number(row.total_stamps_earned || 0),
    totalRewardsEarned: Number(row.total_rewards_earned || 0),
    totalRewardsRedeemed: Number(row.total_rewards_redeemed || 0),
    updatedAt: row.updated_at
  }));

  const pendingRewards = normalizedMembers.reduce((sum, row) => sum + row.rewardsPending, 0);

  return {
    stampsPerReward: STAMPS_PER_REWARD,
    rewardValueInr: REWARD_VALUE_INR,
    summary: {
      totalMembers: normalizedMembers.length,
      pendingRewards,
      totalRewardsEarned: normalizedMembers.reduce((sum, row) => sum + row.totalRewardsEarned, 0),
      totalRewardsRedeemed: normalizedMembers.reduce((sum, row) => sum + row.totalRewardsRedeemed, 0),
      activeStamping: normalizedMembers.filter((row) => row.stampsInCycle > 0).length
    },
    members: normalizedMembers,
    rewardEvents: rewardEvents.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      phone: row.customer_phone,
      stampNumber: Number(row.stamp_number),
      earnedAt: row.created_at,
      tableLabel: row.table_label || "",
      orderAmount: Number(row.amount || 0),
      customerName: row.customer_name || ""
    })),
    recentStamps: recentStamps.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      phone: row.customer_phone,
      stampNumber: Number(row.stamp_number),
      rewardUnlocked: Boolean(row.reward_unlocked),
      earnedAt: row.created_at,
      tableLabel: row.table_label || "",
      orderAmount: Number(row.amount || 0),
      customerName: row.customer_name || ""
    }))
  };
}

async function hasStampForOrder(orderId) {
  const [rows] = await pool.query("SELECT id FROM loyalty_stamp_orders WHERE order_id = ? LIMIT 1", [
    orderId
  ]);
  return rows.length > 0;
}

module.exports = {
  STAMPS_PER_REWARD,
  REWARD_VALUE_INR,
  STAMP_ELIGIBLE_STATUSES,
  normalizePhone,
  awardStampForCompletedOrder,
  syncMissingStampsForPhone,
  syncAllMissingStampsForRestaurant,
  getLoyaltyByPhone,
  redeemReward,
  adminRedeemRewardByLoyaltyId,
  listLoyaltyOverviewForRestaurant,
  hasStampForOrder
};
