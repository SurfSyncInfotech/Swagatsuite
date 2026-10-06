import { FiAward, FiCheck } from "react-icons/fi";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatWhen(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function maskPhone(phone) {
  const raw = String(phone || "");
  if (raw.length < 6) return raw;
  return `${raw.slice(0, 3)}••••${raw.slice(-3)}`;
}

function StampDots({ filled, total }) {
  return (
    <div className="loyalty-admin-stamps" aria-label={`${filled} of ${total} stamps`}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={`loyalty-admin-stamp ${index < filled ? "filled" : ""}`} />
      ))}
    </div>
  );
}

export default function LoyaltyRewardsPage({
  overview,
  loading,
  redeemingId,
  onRedeem
}) {
  const stampsPerReward = overview?.stampsPerReward ?? 5;
  const rewardValue = overview?.rewardValueInr ?? 500;
  const summary = overview?.summary || {};
  const members = overview?.members || [];
  const rewardEvents = overview?.rewardEvents || [];
  const recentStamps = overview?.recentStamps || [];
  const pendingMembers = members.filter((row) => row.rewardsPending > 0);

  return (
    <section className="panel-card orders-management-page loyalty-rewards-page">
      <article className="menu-block menu-management-header">
        <div className="menu-header-row">
          <div>
            <h3>
              <FiAward className="loyalty-page-title-icon" aria-hidden /> Loyalty Rewards
            </h3>
            <p className="menu-subtitle">
              Customers earn 1 stamp per completed order. After {stampsPerReward} stamps they unlock a free meal worth{" "}
              {formatCurrency(rewardValue)}.
            </p>
          </div>
        </div>
      </article>

      <section className="loyalty-kpi-grid">
        <article className="loyalty-kpi-card">
          <span>Members</span>
          <strong>{loading ? "…" : summary.totalMembers ?? 0}</strong>
        </article>
        <article className="loyalty-kpi-card highlight">
          <span>Pending rewards</span>
          <strong>{loading ? "…" : summary.pendingRewards ?? 0}</strong>
        </article>
        <article className="loyalty-kpi-card">
          <span>Rewards earned</span>
          <strong>{loading ? "…" : summary.totalRewardsEarned ?? 0}</strong>
        </article>
        <article className="loyalty-kpi-card">
          <span>Redeemed at counter</span>
          <strong>{loading ? "…" : summary.totalRewardsRedeemed ?? 0}</strong>
        </article>
      </section>

      <article className="menu-block">
        <h4 className="loyalty-section-title">Ready to redeem ({pendingMembers.length})</h4>
        <p className="menu-subtitle">These customers completed {stampsPerReward} stamps and can claim their free meal.</p>
        {!pendingMembers.length ? (
          <div className="empty-items-state compact">
            <p>No pending rewards right now.</p>
          </div>
        ) : (
          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Phone</th>
                  <th>Progress</th>
                  <th>Pending</th>
                  <th>Total earned</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingMembers.map((row) => {
                  const busy = Number(redeemingId) === Number(row.id);
                  return (
                    <tr key={row.id}>
                      <td data-label="Phone">{maskPhone(row.phone)}</td>
                      <td data-label="Progress">
                        <StampDots filled={row.stampsInCycle} total={stampsPerReward} />
                      </td>
                      <td data-label="Pending">
                        <span className="loyalty-pending-badge">
                          {row.rewardsPending} × {formatCurrency(rewardValue)}
                        </span>
                      </td>
                      <td data-label="Total earned">{row.totalRewardsEarned}</td>
                      <td data-label="Action">
                        <button
                          type="button"
                          className="mini-btn save"
                          disabled={busy}
                          onClick={() => onRedeem(row.id)}
                        >
                          <FiCheck aria-hidden /> {busy ? "Saving…" : "Mark redeemed"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="menu-block">
        <h4 className="loyalty-section-title">Recent stamps ({recentStamps.length})</h4>
        <p className="menu-subtitle">Each completed order from a customer&apos;s mobile number earns one stamp.</p>
        {!recentStamps.length ? (
          <div className="empty-items-state compact">
            <p>No stamps recorded yet. Mark orders as Completed to credit stamps.</p>
          </div>
        ) : (
          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Phone</th>
                  <th>Order</th>
                  <th>Stamp</th>
                  <th>Table</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentStamps.map((row) => (
                  <tr key={`stamp-${row.id}`}>
                    <td data-label="When">{formatWhen(row.earnedAt)}</td>
                    <td data-label="Phone">{maskPhone(row.phone)}</td>
                    <td data-label="Order">
                      #{row.orderId}
                      {row.customerName ? ` · ${row.customerName}` : ""}
                    </td>
                    <td data-label="Stamp">
                      {row.stampNumber}/5
                      {row.rewardUnlocked ? " · Reward unlocked" : ""}
                    </td>
                    <td data-label="Table">{row.tableLabel || "—"}</td>
                    <td data-label="Amount">{formatCurrency(row.orderAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="menu-block">
        <h4 className="loyalty-section-title">5-stamp completions</h4>
        <p className="menu-subtitle">Recent orders that unlocked a reward.</p>
        {!rewardEvents.length ? (
          <div className="empty-items-state compact">
            <p>No reward unlocks yet.</p>
          </div>
        ) : (
          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Phone</th>
                  <th>Order</th>
                  <th>Table</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {rewardEvents.map((row) => (
                  <tr key={row.id}>
                    <td data-label="When">{formatWhen(row.earnedAt)}</td>
                    <td data-label="Phone">{maskPhone(row.phone)}</td>
                    <td data-label="Order">
                      #{row.orderId}
                      {row.customerName ? ` · ${row.customerName}` : ""}
                    </td>
                    <td data-label="Table">{row.tableLabel || "—"}</td>
                    <td data-label="Amount">{formatCurrency(row.orderAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {members.length ? (
        <article className="menu-block">
          <h4 className="loyalty-section-title">All members</h4>
          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Phone</th>
                  <th>Current cycle</th>
                  <th>Pending</th>
                  <th>Total stamps</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {members.map((row) => (
                  <tr key={`member-${row.id}`}>
                    <td data-label="Phone">{maskPhone(row.phone)}</td>
                    <td data-label="Current cycle">
                      <StampDots filled={row.stampsInCycle} total={stampsPerReward} />
                    </td>
                    <td data-label="Pending">{row.rewardsPending || "—"}</td>
                    <td data-label="Total stamps">{row.totalStampsEarned}</td>
                    <td data-label="Last activity">{formatWhen(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}
    </section>
  );
}
