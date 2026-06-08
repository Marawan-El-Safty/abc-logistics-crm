export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    const playTone = (freq, startAt, duration, gain = 0.8, type = 'sine') => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.connect(vol);
      vol.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
      vol.gain.setValueAtTime(0, ctx.currentTime + startAt);
      vol.gain.linearRampToValueAtTime(gain, ctx.currentTime + startAt + 0.01);
      vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration);
      osc.start(ctx.currentTime + startAt);
      osc.stop(ctx.currentTime + startAt + duration);
    };

    // Three-tone alert: ascending G5 → B5 → D6, loud and clear
    playTone(784, 0,    0.18, 0.8);
    playTone(988, 0.2,  0.18, 0.8);
    playTone(1175, 0.4, 0.35, 0.9);

    setTimeout(() => ctx.close(), 1000);
  } catch (_) {}
}
