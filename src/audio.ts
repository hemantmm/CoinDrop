import type { Rarity, SoundPayload } from "./generate";
import type { GiftTopic } from "./stock";

type AudioCtor = typeof AudioContext;

type PlanetVoice = {
  stopped: boolean;
  master: GainNode;
  oscA: OscillatorNode;
  oscB: OscillatorNode;
  noise: AudioBufferSourceNode;
  lfo: OscillatorNode;
  step: number;
};

type HumVoice = {
  gain: GainNode;
  oscA: OscillatorNode;
  oscB: OscillatorNode;
  air: AudioBufferSourceNode;
};

let context: AudioContext | null = null;
let masterBus: GainNode | null = null;
let planet: PlanetVoice | null = null;
let planetTimer: number | null = null;
let hum: HumVoice | null = null;
let analyser: AnalyserNode | null = null;
let noiseCache: AudioBuffer | null = null;
let muted = false;
const bins = new Uint8Array(64);

function audioCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const native = window.AudioContext as AudioCtor | undefined;
  if (native) return native;
  const legacy = (window as Window & { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  return legacy ?? null;
}

function getContext(): AudioContext | null {
  const Ctor = audioCtor();
  if (!Ctor) return null;
  if (!context) {
    context = new Ctor();
    masterBus = context.createGain();
    masterBus.gain.value = muted ? 0.0001 : 1;
    masterBus.connect(context.destination);
  }
  return context;
}

function getOut(ctx: AudioContext): AudioNode {
  if (!masterBus) {
    masterBus = ctx.createGain();
    masterBus.gain.value = muted ? 0.0001 : 1;
    masterBus.connect(ctx.destination);
  }
  return masterBus;
}

function whiteNoise(ctx: AudioContext): AudioBuffer {
  if (noiseCache && noiseCache.sampleRate === ctx.sampleRate) return noiseCache;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  noiseCache = buffer;
  return buffer;
}

function tone(
  ctx: AudioContext,
  when: number,
  frequency: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  destination: AudioNode,
) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, when);
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(gain, when + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(amp).connect(destination);
  osc.start(when);
  osc.stop(when + duration + 0.025);
}

function click(ctx: AudioContext, when: number, frequency: number, gain: number, q = 0.7) {
  const out = getOut(ctx);
  tone(ctx, when, frequency, 0.085, "triangle", gain, out);
  const src = ctx.createBufferSource();
  src.buffer = whiteNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(Math.min(5500, frequency * 2.2), when);
  filter.Q.value = q;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain * 0.48, when);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.055);
  src.connect(filter).connect(amp).connect(out);
  src.start(when);
  src.stop(when + 0.07);
}

export function isAudioMuted(): boolean {
  return muted;
}

export function setAudioMuted(next: boolean): void {
  muted = next;
  if (context && masterBus) {
    masterBus.gain.setTargetAtTime(muted ? 0.0001 : 1, context.currentTime, 0.04);
  }
}

export function toggleAudioMuted(): boolean {
  setAudioMuted(!muted);
  return muted;
}

export function startAmbientHum(): void {
  const ctx = getContext();
  if (!ctx || hum) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.018, now + 1.2);
  gain.connect(out);

  const oscA = ctx.createOscillator();
  oscA.type = "sine";
  oscA.frequency.value = 60;
  const gA = ctx.createGain();
  gA.gain.value = 0.55;
  oscA.connect(gA).connect(gain);

  const oscB = ctx.createOscillator();
  oscB.type = "triangle";
  oscB.frequency.value = 120;
  const gB = ctx.createGain();
  gB.gain.value = 0.16;
  oscB.connect(gB).connect(gain);

  const air = ctx.createBufferSource();
  air.buffer = whiteNoise(ctx);
  air.loop = true;
  const airFilter = ctx.createBiquadFilter();
  airFilter.type = "lowpass";
  airFilter.frequency.value = 340;
  const gAir = ctx.createGain();
  gAir.gain.value = 0.28;
  air.connect(airFilter).connect(gAir).connect(gain);

  oscA.start(now);
  oscB.start(now);
  air.start(now);

  hum = { gain, oscA, oscB, air };
}

export function stopAmbientHum(): void {
  if (!hum || !context) return;
  const active = hum;
  hum = null;
  const now = context.currentTime;
  active.gain.gain.setTargetAtTime(0.0001, now, 0.15);
  window.setTimeout(() => {
    try {
      active.oscA.stop();
      active.oscB.stop();
      active.air.stop();
    } catch {
      /* ignore already stopped */
    }
  }, 350);
}

export function unlockAudio(): void {
  const ctx = getContext();
  if (ctx && ctx.state === "suspended") void ctx.resume();
  if (!muted) startAmbientHum();
}

export function playClunk(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  const thump = ctx.createOscillator();
  const amp = ctx.createGain();
  thump.type = "sine";
  thump.frequency.setValueAtTime(160, now);
  thump.frequency.exponentialRampToValueAtTime(42, now + 0.22);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(0.28, now + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  thump.connect(amp).connect(out);
  thump.start(now);
  thump.stop(now + 0.32);
  click(ctx, now + 0.02, 240, 0.12);
}

export function playCommonReveal(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  click(ctx, now, 380, 0.12);
  click(ctx, now + 0.04, 520, 0.09);
  tone(ctx, now + 0.08, 440, 0.22, "sine", 0.05, out);
  tone(ctx, now + 0.2, 554.37, 0.35, "sine", 0.06, out);
}

export function playRareShimmer(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  const notes = [587.33, 739.99, 880, 1108.73, 1318.51, 1661.22];
  notes.forEach((freq, idx) => {
    tone(ctx, now + idx * 0.055, freq, 0.38, "sine", 0.065, out);
    tone(ctx, now + idx * 0.055 + 0.015, freq * 1.5, 0.24, "triangle", 0.03, out);
  });
  click(ctx, now + 0.35, 1200, 0.05);
}

export function playLegendaryFanfare(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  const fanfare = [
    { freq: 261.63, at: 0, dur: 0.22 },
    { freq: 392.0, at: 0.12, dur: 0.25 },
    { freq: 523.25, at: 0.24, dur: 0.3 },
    { freq: 659.25, at: 0.38, dur: 0.35 },
    { freq: 783.99, at: 0.52, dur: 0.45 },
    { freq: 1046.5, at: 0.68, dur: 1.1 },
  ];
  fanfare.forEach((note) => {
    tone(ctx, now + note.at, note.freq, note.dur, "triangle", 0.08, out);
    tone(ctx, now + note.at, note.freq * 1.002, note.dur, "sine", 0.07, out);
    tone(ctx, now + note.at + 0.01, note.freq * 2, note.dur * 0.6, "sine", 0.03, out);
  });
  const glissando = [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.51, 1567.98, 2093.0];
  glissando.forEach((f, i) => {
    tone(ctx, now + 0.8 + i * 0.045, f, 0.32, "sine", 0.04, out);
  });
}

export function playImpossibleMalfunction(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  click(ctx, now, 120, 0.2);
  click(ctx, now + 0.06, 880, 0.15);
  click(ctx, now + 0.12, 340, 0.18);
  click(ctx, now + 0.18, 1400, 0.14);
  click(ctx, now + 0.28, 220, 0.2);

  const dropOsc = ctx.createOscillator();
  const dropAmp = ctx.createGain();
  dropOsc.type = "sawtooth";
  dropOsc.frequency.setValueAtTime(680, now + 0.05);
  dropOsc.frequency.exponentialRampToValueAtTime(55, now + 0.8);
  dropAmp.gain.setValueAtTime(0.0001, now + 0.05);
  dropAmp.gain.exponentialRampToValueAtTime(0.12, now + 0.12);
  dropAmp.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
  dropOsc.connect(dropAmp).connect(out);
  dropOsc.start(now + 0.05);
  dropOsc.stop(now + 0.9);

  tone(ctx, now + 0.45, 46.25, 1.8, "sine", 0.14, out);
  tone(ctx, now + 0.6, 932.33, 1.4, "sine", 0.06, out);
  tone(ctx, now + 0.7, 1244.5, 1.6, "triangle", 0.05, out);
}

export function playStinger(rarity: Rarity): void {
  if (rarity === "common" || rarity === "uncommon") {
    playCommonReveal();
  } else if (rarity === "rare") {
    playRareShimmer();
  } else if (rarity === "legendary") {
    playLegendaryFanfare();
  } else if (rarity === "impossible") {
    playImpossibleMalfunction();
  }
}

export function playTopicSelect(topic: GiftTopic): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;

  if (topic === "technology") {
    tone(ctx, now, 523.25, 0.08, "sine", 0.07, out);
    tone(ctx, now + 0.06, 783.99, 0.1, "triangle", 0.08, out);
    tone(ctx, now + 0.12, 1046.5, 0.16, "sine", 0.07, out);
  } else if (topic === "audio") {
    tone(ctx, now, 440, 0.12, "triangle", 0.06, out);
    tone(ctx, now + 0.05, 554.37, 0.14, "sine", 0.07, out);
    tone(ctx, now + 0.1, 659.25, 0.18, "sine", 0.08, out);
    tone(ctx, now + 0.15, 880, 0.22, "sine", 0.06, out);
  } else if (topic === "snacks") {
    tone(ctx, now, 587.33, 0.08, "sine", 0.07, out);
    tone(ctx, now + 0.06, 739.99, 0.09, "sine", 0.08, out);
    tone(ctx, now + 0.12, 880, 0.11, "triangle", 0.08, out);
    tone(ctx, now + 0.18, 1174.66, 0.18, "sine", 0.08, out);
  } else if (topic === "style") {
    tone(ctx, now, 329.63, 0.07, "triangle", 0.08, out);
    tone(ctx, now + 0.05, 493.88, 0.08, "triangle", 0.07, out);
    tone(ctx, now + 0.1, 659.25, 0.14, "sine", 0.09, out);
    tone(ctx, now + 0.16, 987.77, 0.18, "sine", 0.06, out);
  }
}

export function playKidsCheer(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  const notes = [659.25, 783.99, 987.77, 1046.5, 1318.5];
  notes.forEach((freq, idx) => {
    tone(ctx, now + idx * 0.04, freq, 0.12, "sine", 0.05, out);
    tone(ctx, now + idx * 0.04 + 0.015, freq * 1.5, 0.08, "triangle", 0.025, out);
  });
}

export function playCoinPickup(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  tone(ctx, now, 2100, 0.045, "sine", 0.08, out);
  tone(ctx, now + 0.015, 3150, 0.07, "triangle", 0.05, out);
}

export function playCoinInsertDrop(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  // Coin edge hits slot lip
  click(ctx, now + 0.12, 2400, 0.09, 2.2);
  tone(ctx, now + 0.13, 2860, 0.06, "sine", 0.08, out);
  // Tumbling down coin validator chute
  click(ctx, now + 0.28, 1780, 0.1, 1.8);
  tone(ctx, now + 0.29, 2240, 0.05, "sine", 0.07, out);
  click(ctx, now + 0.42, 1340, 0.09, 1.5);
  // Solenoid gate & credit accepted chime
  click(ctx, now + 0.56, 620, 0.15, 0.9);
  tone(ctx, now + 0.58, 1318.5, 0.09, "sine", 0.085, out);
  tone(ctx, now + 0.65, 1760, 0.15, "sine", 0.09, out);
}

export function playCoinReturn(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  click(ctx, now, 520, 0.14);
  tone(ctx, now + 0.08, 1960, 0.07, "sine", 0.09, out);
  click(ctx, now + 0.13, 1480, 0.11, 1.5);
  tone(ctx, now + 0.2, 2340, 0.1, "sine", 0.08, out);
  click(ctx, now + 0.25, 920, 0.12, 1.0);
}

export function playErrorBuzz(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  tone(ctx, now, 190, 0.11, "sawtooth", 0.045, out);
  tone(ctx, now + 0.14, 155, 0.16, "sawtooth", 0.045, out);
}

export function playKeypadBeep(char: string = "A"): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  click(ctx, now, 980, 0.07, 1.2);
  const freqs: Record<string, number> = {
    A: 852,
    B: 770,
    C: 697,
    D: 941,
    "1": 1209,
    "2": 1336,
    "3": 1477,
    "4": 1633,
    VEND: 1046.5,
    CLR: 440,
  };
  const freq = freqs[char] ?? 880;
  tone(ctx, now + 0.01, freq, 0.065, "triangle", 0.07, out);
  tone(ctx, now + 0.01, freq * 1.5, 0.045, "sine", 0.025, out);
}

export function playRouletteTick(step = 0): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  const scale = [784, 880, 988, 1046.5, 1174.7];
  const f = scale[step % scale.length] ?? 880;
  click(ctx, now, 1100, 0.05);
  tone(ctx, now, f, 0.045, "sine", 0.055, out);
}

export function playCoilWhir(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  // DC gearmotor spool + subtle harmonic
  const motor = ctx.createOscillator();
  const amp = ctx.createGain();
  motor.type = "sawtooth";
  motor.frequency.setValueAtTime(92, now);
  motor.frequency.linearRampToValueAtTime(124, now + 0.22);
  motor.frequency.setValueAtTime(118, now + 1.35);
  motor.frequency.linearRampToValueAtTime(84, now + 1.55);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 380;
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(0.048, now + 0.14);
  amp.gain.exponentialRampToValueAtTime(0.032, now + 1.35);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + 1.58);
  motor.connect(filter).connect(amp).connect(out);
  motor.start(now);
  motor.stop(now + 1.6);

  tone(ctx, now + 0.02, 182, 1.4, "triangle", 0.028, out);
  // Helical notch ticks
  for (let i = 0; i < 6; i += 1) {
    click(ctx, now + 0.18 + i * 0.22, 460 + i * 24, 0.055, 1.1);
  }
}

export function playTeeterCreak(): void {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  click(ctx, now, 740, 0.13, 1.8);
  click(ctx, now + 0.11, 660, 0.11, 1.6);
  click(ctx, now + 0.23, 590, 0.14, 1.7);
  click(ctx, now + 0.36, 520, 0.12, 1.6);
}

export function playNudgeThump(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  const thump = ctx.createOscillator();
  const amp = ctx.createGain();
  thump.type = "sine";
  thump.frequency.setValueAtTime(115, now);
  thump.frequency.exponentialRampToValueAtTime(34, now + 0.2);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(0.42, now + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
  thump.connect(amp).connect(out);
  thump.start(now);
  thump.stop(now + 0.26);
  click(ctx, now, 320, 0.18);
  click(ctx, now + 0.04, 1180, 0.08, 2.0);
  tone(ctx, now + 0.09, 260, 0.08, "sawtooth", 0.035, out);
}

export function playBinThud(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  // Brief chute baffle tap before bottom impact
  click(ctx, now, 520, 0.12, 1.4);
  // Heavy damped bin landing thump
  const thump = ctx.createOscillator();
  const amp = ctx.createGain();
  thump.type = "sine";
  thump.frequency.setValueAtTime(150, now + 0.09);
  thump.frequency.exponentialRampToValueAtTime(36, now + 0.34);
  amp.gain.setValueAtTime(0.0001, now + 0.09);
  amp.gain.exponentialRampToValueAtTime(0.42, now + 0.105);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
  thump.connect(amp).connect(out);
  thump.start(now + 0.09);
  thump.stop(now + 0.4);
  // Delivery flap clatter & bounce
  click(ctx, now + 0.11, 310, 0.18);
  click(ctx, now + 0.18, 220, 0.12);
  click(ctx, now + 0.25, 360, 0.08);
}

export function playFlapOpen(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  tone(ctx, now, 380, 0.1, "triangle", 0.075, out);
  click(ctx, now + 0.025, 540, 0.15);
  click(ctx, now + 0.085, 820, 0.12);
}

export function playCapsulePop(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  click(ctx, now, 1550, 0.22);
  click(ctx, now + 0.015, 760, 0.24);
  tone(ctx, now + 0.03, 987.77, 0.16, "sine", 0.12, out);
  tone(ctx, now + 0.08, 1318.51, 0.22, "triangle", 0.095, out);
}

export function playKidCoinCheer(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  [783.99, 1046.5, 1318.51, 1567.98].forEach((f, i) => {
    tone(ctx, now + i * 0.05, f, 0.16, "sine", 0.055, out);
  });
}

export function playEngineStart(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  tone(ctx, now, 110, 0.35, "sine", 0.08, out);
  tone(ctx, now + 0.08, 164.81, 0.4, "sine", 0.07, out);
  tone(ctx, now + 0.16, 220, 0.45, "triangle", 0.06, out);
  tone(ctx, now + 0.24, 329.63, 0.5, "sine", 0.05, out);
}

export function playCarLock(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  tone(ctx, now, 2200, 0.04, "sine", 0.08, out);
  tone(ctx, now + 0.09, 2600, 0.06, "sine", 0.09, out);
}

export function playParkingBeep(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  tone(ctx, now, 1800, 0.05, "sine", 0.05, out);
  tone(ctx, now + 0.1, 1800, 0.05, "sine", 0.05, out);
}

export function playNavChime(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  tone(ctx, now, 659.25, 0.14, "sine", 0.07, out);
  tone(ctx, now + 0.1, 830.61, 0.22, "sine", 0.07, out);
}

export function playMallFanfare(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  const freqs = [523.25, 659.25, 783.99, 1046.5];
  freqs.forEach((f, i) => {
    tone(ctx, now + i * 0.07, f, 0.25, "sine", 0.06, out);
    tone(ctx, now + i * 0.07 + 0.02, f * 1.5, 0.12, "triangle", 0.025, out);
  });
}

export function playElevatorDing(): void {
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);
  const now = ctx.currentTime;
  tone(ctx, now, 1046.5, 0.35, "sine", 0.09, out);
  tone(ctx, now + 0.16, 783.99, 0.5, "sine", 0.08, out);
}

export function startPlanet(patch: SoundPayload): void {
  stopPlanet();
  const ctx = getContext();
  if (!ctx) return;
  const out = getOut(ctx);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 0.4);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(patch.filterCutoff, ctx.currentTime);
  filter.Q.value = 0.8;

  const gate = ctx.createGain();
  gate.gain.value = 0.18;

  const scope = ctx.createAnalyser();
  scope.fftSize = 128;
  analyser = scope;

  master.connect(filter).connect(gate).connect(scope).connect(out);

  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  oscA.type = "sine";
  oscB.type = "triangle";
  oscA.frequency.value = patch.fundamental;
  oscB.frequency.value = patch.fundamental * 1.5;
  const gainA = ctx.createGain();
  const gainB = ctx.createGain();
  gainA.gain.value = 0.22;
  gainB.gain.value = 0.07;
  oscA.connect(gainA).connect(master);
  oscB.connect(gainB).connect(master);
  oscA.start();
  oscB.start();

  const noise = ctx.createBufferSource();
  noise.buffer = whiteNoise(ctx);
  noise.loop = true;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = patch.noiseAmount * 0.35;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = Math.max(240, patch.filterCutoff * 0.65);
  noiseFilter.Q.value = 1.4;
  noise.connect(noiseFilter).connect(noiseGain).connect(master);
  noise.start();

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = patch.lfoRate;
  lfoGain.gain.value = patch.filterCutoff * 0.35;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();

  const voice: PlanetVoice = {
    stopped: false,
    master,
    oscA,
    oscB,
    noise,
    lfo,
    step: 0,
  };
  planet = voice;

  const tick = () => {
    if (!planet || planet.stopped || planet !== voice) return;
    const step = voice.step % patch.rhythm.length;
    const on = patch.rhythm[step] === 1;
    const at = ctx.currentTime;
    gate.gain.cancelScheduledValues(at);
    gate.gain.setTargetAtTime(on ? 0.85 : 0.12, at, 0.03);
    const semi = patch.scale[voice.step % patch.scale.length] ?? 0;
    const freq = patch.fundamental * 2 ** (semi / 12);
    oscA.frequency.setTargetAtTime(freq, at, 0.04);
    oscB.frequency.setTargetAtTime(freq * 1.498, at, 0.05);
    voice.step += 1;
    planetTimer = window.setTimeout(tick, patch.stepMs);
  };
  tick();
}

export function stopPlanet(): void {
  if (planetTimer !== null) {
    window.clearTimeout(planetTimer);
    planetTimer = null;
  }
  const voice = planet;
  planet = null;
  analyser = null;
  if (!voice) return;
  voice.stopped = true;
  const ctx = getContext();
  if (ctx) voice.master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
  window.setTimeout(() => {
    try {
      voice.oscA.stop();
      voice.oscB.stop();
      voice.noise.stop();
      voice.lfo.stop();
    } catch {
      /* nodes already stopped */
    }
  }, 220);
}

export function getPlanetLevel(): number {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(bins);
  let sum = 0;
  for (let i = 0; i < bins.length; i += 1) {
    const sample = ((bins[i] ?? 128) - 128) / 128;
    sum += sample * sample;
  }
  return Math.min(1, Math.sqrt(sum / bins.length) * 3.4);
}
