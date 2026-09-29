// "New Message Notification.mp3" (provided by Juan) — served from
// public/sounds/. Falls back to a synthesized two-tone chime if the file
// ever fails to load, so a missing/corrupt asset never silently disables
// the alert entirely.
let cachedAudio: HTMLAudioElement | null = null;

// HTMLAudioElement defaults to volume 1.0 (max) — never explicitly set
// before, so every alert played at full blast regardless of the device's
// own volume. 0.45 keeps it clearly audible in a kitchen without being
// jarring on a phone/tablet held closer to someone's ear.
const CHIME_VOLUME = 0.45;

export function playNewOrderChime() {
  try {
    if (!cachedAudio) {
      cachedAudio = new Audio('/sounds/new-order.mp3');
    }
    cachedAudio.volume = CHIME_VOLUME;
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
      gain.gain.linearRampToValueAtTime(CHIME_VOLUME * 0.4, now + i * 0.15 + 0.02);
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
