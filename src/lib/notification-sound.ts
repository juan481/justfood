// "New Message Notification.mp3" (provided by Juan) — served from
// public/sounds/. Falls back to a synthesized two-tone chime if the file
// ever fails to load, so a missing/corrupt asset never silently disables
// the alert entirely.
let cachedAudio: HTMLAudioElement | null = null;

export function playNewOrderChime() {
  try {
    if (!cachedAudio) {
      cachedAudio = new Audio('/sounds/new-order.mp3');
    }
    cachedAudio.currentTime = 0;
    cachedAudio.play().catch(() => playFallbackChime());
  } catch {
    playFallbackChime();
  }
}

function playFallbackChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.25, now + i * 0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.3);
    });
  } catch {
    // Autoplay can be blocked before the first user interaction — the
    // visual alert banner still shows regardless, this is a nice-to-have.
  }
}
