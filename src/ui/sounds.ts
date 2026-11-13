/** Tiny Web Audio beeps. Off by default; only plays after a user gesture once started. */

let ctx: AudioContext | null = null;
let enabled = false;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
  if (on) ensure();
}

function ensure(): AudioContext | null {
  if (!enabled) return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function beep(freq: number, dur: number, type: OscillatorType, gain = 0.08, at = 0): void {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sounds = {
  deal() {
    beep(420, 0.05, "square", 0.04);
    beep(520, 0.05, "square", 0.03, 0.04);
  },
  chip() {
    beep(880, 0.04, "square", 0.05);
  },
  correct() {
    beep(660, 0.07, "square", 0.07);
    beep(880, 0.1, "square", 0.06, 0.07);
  },
  wrong() {
    beep(200, 0.16, "square", 0.07);
  },
  win() {
    beep(523, 0.08, "square", 0.06);
    beep(659, 0.08, "square", 0.06, 0.08);
    beep(784, 0.14, "square", 0.07, 0.16);
  },
  lose() {
    beep(300, 0.1, "square", 0.05);
    beep(200, 0.16, "square", 0.05, 0.1);
  },
  click() {
    beep(700, 0.03, "square", 0.04);
  },
};
