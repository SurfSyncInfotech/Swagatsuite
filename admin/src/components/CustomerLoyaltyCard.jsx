import { useEffect, useState } from "react";
import { FiAward, FiGift, FiX } from "react-icons/fi";
import "./CustomerLoyaltyCard.css";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

export function loyaltyPhoneStorageKey(restaurantCode) {
  return `restro_qr_loyalty_phone_${restaurantCode}`;
}

export default function CustomerLoyaltyCard({
  loyalty,
  loading,
  phone,
  onPhoneSubmit,
  onRedeem,
  redeeming,
  open,
  onOpenChange
}) {
  const [phoneInput, setPhoneInput] = useState(phone || "");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setPhoneInput(phone || "");
  }, [phone]);

  const stampsPerReward = loyalty?.stampsPerReward ?? 5;
  const stampsInCycle = loyalty?.stampsInCycle ?? 0;
  const rewardsPending = loyalty?.rewardsPending ?? 0;
  const rewardValue = loyalty?.rewardValueInr ?? 500;
  const progressPct = Math.min(100, Math.round((stampsInCycle / stampsPerReward) * 100));

  const close = () => onOpenChange?.(false);

  const fabLabel = !phone
    ? "Stamps"
    : rewardsPending > 0
      ? `${rewardsPending} reward${rewardsPending > 1 ? "s" : ""}`
      : `${stampsInCycle}/${stampsPerReward}`;

  return (
    <div className="customer-loyalty-dock">
      {open ? (
        <section className="customer-loyalty-panel" role="dialog" aria-label="Loyalty stamp card">
          <header className="customer-loyalty-panel-head">
            <div className="customer-loyalty-panel-title">
              <span className="customer-loyalty-panel-icon" aria-hidden>
                <FiAward />
              </span>
              <div>
                <h3>Stamp rewards</h3>
                <p>5 orders · free meal {formatCurrency(rewardValue)}</p>
              </div>
            </div>
            <button type="button" className="customer-loyalty-panel-close" onClick={close} aria-label="Close stamps">
              <FiX />
            </button>
          </header>

          {!phone ? (
            <div className="customer-loyalty-panel-body">
              <p className="customer-loyalty-lead">
                अपना मोबाइल नंबर दर्ज करिए — स्टैम्प आपके नंबर से जुड़ जाएंगे और किसी भी समय देखे जा सकते हैं।
                <br />
                Enter your mobile — stamps link to your number and can be viewed anytime.
              </p>
              <form
                className="customer-loyalty-phone-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  onPhoneSubmit?.(phoneInput);
                }}
              >
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="10-digit mobile"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                />
                <button type="submit">Track</button>
              </form>
            </div>
          ) : (
            <div className="customer-loyalty-panel-body">
              <div className="customer-loyalty-progress-wrap">
                <div className="customer-loyalty-progress-meta">
                  <span>{loading ? "Syncing…" : `${stampsInCycle} of ${stampsPerReward} stamps`}</span>
                  <span className="customer-loyalty-progress-pct">{progressPct}%</span>
                </div>
                <div className="customer-loyalty-progress-track">
                  <span className="customer-loyalty-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              </div>

              <div className="customer-loyalty-stamps-row" aria-label={`${stampsInCycle} of ${stampsPerReward} stamps`}>
                {Array.from({ length: stampsPerReward }, (_, idx) => {
                  const filled = idx < stampsInCycle;
                  return (
                    <div key={idx} className={`customer-loyalty-stamp-slot ${filled ? "filled" : ""}`}>
                      <span className="customer-loyalty-stamp-circle">{filled ? "✓" : idx + 1}</span>
                      {idx < stampsPerReward - 1 ? <span className="customer-loyalty-stamp-connector" aria-hidden /> : null}
                    </div>
                  );
                })}
              </div>

              {rewardsPending > 0 ? (
                <div className="customer-loyalty-reward-card">
                  <FiGift className="customer-loyalty-reward-icon" />
                  <div className="customer-loyalty-reward-copy">
                    <strong>Reward ready!</strong>
                    <span>Free order up to {formatCurrency(rewardValue)}</span>
                  </div>
                  <button type="button" className="customer-loyalty-redeem-btn" onClick={onRedeem} disabled={redeeming}>
                    {redeeming ? "…" : "Redeem"}
                  </button>
                </div>
              ) : (
                <p className="customer-loyalty-next-hint">
                  {stampsPerReward - stampsInCycle} more completed order
                  {stampsPerReward - stampsInCycle === 1 ? "" : "s"} to unlock your free meal.
                </p>
              )}

              <div className="customer-loyalty-mini-stats">
                <div>
                  <small>Total stamps</small>
                  <strong>{loyalty?.totalStampsEarned ?? 0}</strong>
                </div>
                <div>
                  <small>Earned</small>
                  <strong>{loyalty?.totalRewardsEarned ?? 0}</strong>
                </div>
                <div>
                  <small>Redeemed</small>
                  <strong>{loyalty?.totalRewardsRedeemed ?? 0}</strong>
                </div>
              </div>

              <button type="button" className="customer-loyalty-history-toggle" onClick={() => setShowHistory((v) => !v)}>
                {showHistory ? "Hide history" : "View stamp history"}
              </button>

              {showHistory ? (
                <ul className="customer-loyalty-history">
                  {loyalty?.history?.length ? (
                    loyalty.history.map((row) => (
                      <li key={row.orderId}>
                        <span>
                          #{row.orderId}
                          {row.rewardUnlocked ? " · Reward" : ` · Stamp ${row.stampNumber}`}
                        </span>
                        <span>{formatWhen(row.earnedAt)}</span>
                      </li>
                    ))
                  ) : (
                    <li className="customer-loyalty-history-empty">No stamps yet — complete an order first.</li>
                  )}
                </ul>
              ) : null}

              <p className="customer-loyalty-phone-foot">Linked: {phone} · यह नंबर किसी भी डिवाइस पर दर्ज करने पर स्टैम्प दिखेंगे</p>
            </div>
          )}
        </section>
      ) : null}

      <button
        type="button"
        className={`customer-loyalty-fab ${open ? "is-open" : ""} ${rewardsPending > 0 ? "has-reward" : ""}`}
        onClick={() => onOpenChange?.(!open)}
        aria-expanded={open}
        aria-label={open ? "Close stamp card" : "Open stamp card"}
      >
        <span className="customer-loyalty-fab-icon">
          <FiAward />
        </span>
        <span className="customer-loyalty-fab-copy">
          <strong>Stamps</strong>
          <small>{fabLabel}</small>
        </span>
        {phone ? (
          <span className="customer-loyalty-fab-dots" aria-hidden>
            {Array.from({ length: stampsPerReward }, (_, i) => (
              <span key={i} className={i < stampsInCycle ? "on" : ""} />
            ))}
          </span>
        ) : null}
        {rewardsPending > 0 ? <span className="customer-loyalty-fab-badge">{rewardsPending}</span> : null}
      </button>
    </div>
  );
}
