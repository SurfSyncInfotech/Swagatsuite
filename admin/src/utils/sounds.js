/** Short notification tones using one shared Web Audio context (avoids autoplay / resume issues). */

let sharedCtx = null;

/**
 * Call after a user gesture (click, touchend) so the browser allows audio.
 * Also call when opening the Orders screen or after login.
 */
export function unlockWebAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return Promise.resolve();
  if (!sharedCtx) {
    sharedCtx = new AudioCtx();
  }
  if (sharedCtx.state === "suspended") {
    return sharedCtx.resume().catch(() => {});
  }
  return Promise.resolve();
}

async function getActiveContext() {
  await unlockWebAudio();
  return sharedCtx;
}

async function playTone({ frequency = 880, durationMs = 180, type = "sine", gain = 0.12 }) {
  try {
    const ctx = await getActiveContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.02);
    g.gain.linearRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.04);
  } catch (_e) {
    // Autoplay policy or missing API
  }
}

export async function playAdminNewOrderChime() {
  await playTone({ frequency: 784, durationMs: 120, type: "triangle", gain: 0.14 });
  setTimeout(() => {
    playTone({ frequency: 988, durationMs: 160, type: "triangle", gain: 0.12 });
  }, 130);
}

/** Service bell sound for customer tap and admin alerts. */
export async function playServiceRequestChime() {
  await playTone({ frequency: 1046.5, durationMs: 90, type: "triangle", gain: 0.12 });
  setTimeout(() => {
    playTone({ frequency: 1318.5, durationMs: 120, type: "triangle", gain: 0.1 });
  }, 90);
  setTimeout(() => {
    playTone({ frequency: 1567.98, durationMs: 180, type: "sine", gain: 0.09 });
  }, 210);
}

/** After customer confirms order — bright ascending “success” (food-app style). */
export async function playOrderPlacedSuccess() {
  await playTone({ frequency: 659.25, durationMs: 70, type: "triangle", gain: 0.11 });
  setTimeout(() => playTone({ frequency: 880, durationMs: 75, type: "triangle", gain: 0.1 }), 70);
  setTimeout(() => playTone({ frequency: 1046.5, durationMs: 100, type: "sine", gain: 0.095 }), 150);
  setTimeout(() => playTone({ frequency: 1318.5, durationMs: 180, type: "triangle", gain: 0.08 }), 240);
}

/** Order is ready to collect / pick up. */
export async function playOrderReadyForPickupChime() {
  await playTone({ frequency: 523.25, durationMs: 100, type: "sine", gain: 0.12 });
  setTimeout(() => playTone({ frequency: 659.25, durationMs: 120, type: "triangle", gain: 0.1 }), 95);
  setTimeout(() => playTone({ frequency: 783.99, durationMs: 220, type: "sine", gain: 0.09 }), 200);
  setTimeout(() => playTone({ frequency: 1046.5, durationMs: 320, type: "triangle", gain: 0.07 }), 360);
}

/** Order marked served — warm “complete” resolution. */
export async function playOrderServedChime() {
  await playTone({ frequency: 987.77, durationMs: 110, type: "triangle", gain: 0.1 });
  setTimeout(() => playTone({ frequency: 783.99, durationMs: 130, type: "sine", gain: 0.095 }), 105);
  setTimeout(() => playTone({ frequency: 659.25, durationMs: 160, type: "triangle", gain: 0.085 }), 235);
  setTimeout(() => playTone({ frequency: 523.25, durationMs: 380, type: "sine", gain: 0.065 }), 380);
}

/** @deprecated use playOrderReadyForPickupChime */
export async function playCustomerOrderReadyChime() {
  return playOrderReadyForPickupChime();
}

/** Customer sent a chatbot message. */
export async function playChatbotQueryChime() {
  await playTone({ frequency: 620, durationMs: 55, type: "sine", gain: 0.09 });
  setTimeout(() => playTone({ frequency: 740, durationMs: 70, type: "triangle", gain: 0.08 }), 50);
}

/** Chatbot reply appeared. */
export async function playChatbotReplyChime() {
  await playTone({ frequency: 880, durationMs: 60, type: "triangle", gain: 0.085 });
  setTimeout(() => playTone({ frequency: 1108.73, durationMs: 95, type: "sine", gain: 0.075 }), 65);
}
