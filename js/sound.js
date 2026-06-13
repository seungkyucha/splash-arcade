// WebAudio 합성 사운드 — 모든 효과음/BGM을 오실레이터와 노이즈로 직접 생성한다.

let ctx = null;
let masterGain = null;
let bgmGain = null;
let bgmTimer = null;
let muted = false;

function ensureCtx() {
  // 브라우저 외 환경(테스트)에서는 무음 처리
  if (typeof window === 'undefined' || (!window.AudioContext && !window.webkitAudioContext)) {
    return null;
  }
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.16;
    bgmGain.connect(masterGain);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ensureCtx();
}

export function toggleMute() {
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function isMuted() { return muted; }

function tone(freq, dur, type = 'square', vol = 0.2, slideTo = null, when = 0) {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, vol = 0.3, lowpass = 1200, when = 0) {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(masterGain);
  src.start(t0);
}

export const sfx = {
  place() { tone(380, 0.1, 'sine', 0.25, 240); },
  pop() {
    noise(0.35, 0.4, 2000);
    tone(180, 0.25, 'sine', 0.3, 60);
  },
  pickup() {
    tone(660, 0.07, 'square', 0.15);
    tone(880, 0.1, 'square', 0.15, null, 0.07);
  },
  trap() { tone(520, 0.3, 'sine', 0.25, 180); },
  needle() {
    tone(900, 0.06, 'square', 0.2);
    tone(1400, 0.08, 'square', 0.2, null, 0.05);
  },
  die() {
    noise(0.5, 0.35, 1000);
    tone(440, 0.5, 'sawtooth', 0.2, 80);
  },
  boxBreak() { noise(0.2, 0.25, 3000); },
  win() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(f, 0.18, 'square', 0.2, null, i * 0.13));
  },
  lose() {
    const notes = [392, 330, 262, 196];
    notes.forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, null, i * 0.16));
  },
  select() { tone(740, 0.08, 'square', 0.18); },
  start() {
    tone(523, 0.1, 'square', 0.2);
    tone(784, 0.15, 'square', 0.2, null, 0.1);
  },
  tick() { tone(1000, 0.04, 'square', 0.1); },
};

// ---------- BGM: 짧은 오리지널 루프 멜로디 ----------
// C장조의 단순한 8마디 루프 (직접 작곡한 단순 진행)

const MELODY = [
  // [음정(Hz), 박자(16분음표 수)]
  [523, 2], [587, 2], [659, 2], [523, 2], [659, 2], [784, 4], [659, 2],
  [587, 2], [659, 2], [523, 2], [440, 2], [523, 4], [0, 4],
  [659, 2], [784, 2], [880, 2], [784, 2], [659, 2], [587, 4], [523, 2],
  [440, 2], [523, 2], [587, 2], [659, 2], [523, 4], [0, 4],
];
const BASS = [262, 220, 196, 247];

function playBgmLoop() {
  if (!ctx || muted) { scheduleNext(); return; }
  const c = ctx;
  const sixteenth = 0.13;
  let t = 0;
  for (const [freq, beats] of MELODY) {
    if (freq > 0) {
      const t0 = c.currentTime + t;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.5, t0);
      g.gain.exponentialRampToValueAtTime(0.01, t0 + beats * sixteenth * 0.95);
      osc.connect(g); g.connect(bgmGain);
      osc.start(t0); osc.stop(t0 + beats * sixteenth);
    }
    t += beats * sixteenth;
  }
  // 베이스
  const total = t;
  const barLen = total / 4;
  BASS.forEach((f, i) => {
    const t0 = c.currentTime + i * barLen;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = f / 2;
    g.gain.setValueAtTime(0.6, t0);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + barLen * 0.9);
    osc.connect(g); g.connect(bgmGain);
    osc.start(t0); osc.stop(t0 + barLen);
  });
  scheduleNext(total);
}

function scheduleNext(delay = 2) {
  bgmTimer = setTimeout(playBgmLoop, delay * 1000);
}

export function startBgm() {
  if (!ensureCtx()) return;
  stopBgm();
  playBgmLoop();
}

export function stopBgm() {
  if (bgmTimer) { clearTimeout(bgmTimer); bgmTimer = null; }
}
