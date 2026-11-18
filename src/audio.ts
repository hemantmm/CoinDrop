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

let context: AudioContext | null = null;
let planet: PlanetVoice | null = null;
let planetTimer: number | null = null;
let analyser: AnalyserNode | null = null;
let noiseCache: AudioBuffer | null = null;
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
  if (!context) context = new Ctor();
  return context;
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
  amp.gain.exponentialRampToValueAtTime(gain, when + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(amp).connect(destination);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

function click(ctx: AudioContext, when: number, frequency: number, gain: number) {
  tone(ctx, when, frequency, 0.09, "triangle", gain, ctx.destination);
  const src = ctx.createBufferSource();
  src.buffer = whiteNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1400, when);
  filter.Q.value = 0.7;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain * 0.45, when);
  amp.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
  src.connect(filter).connect(amp).connect(ctx.destination);
  src.start(when);
  src.stop(when + 0.08);
}

export function unlockAudio(): void {
  const ctx = getContext();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

export function playClunk(): void {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const thump = ctx.createOscillator();
  const amp = ctx.createGain();
  thump.type = "sine";
  thump.frequency.setValueAtTime(160, now);
  thump.frequency.exponentialRampToValueAtTime(42, now + 0.22);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(0.34, now + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
  thump.connect(amp).connect(ctx.destination);
  thump.start(now);
  thump.stop(now + 0.34);
  click(ctx, now + 0.02, 240, 0.12);
  click(ctx, now + 0.55, 180, 0.08);
  click(ctx, now + 1.45, 320, 0.1);
}

const CHORDS: Record<Rarity, number[]> = {
  common: [392, 493.88],
  uncommon: [392, 493.88, 587.33],
  rare: [329.63, 415.3, 493.88, 659.25],
  legendary: [261.63, 329.63, 392, 523.25],
  impossible: [233.08, 311.13, 369.99, 466.16, 622.25],
};

export function playStinger(rarity: Rarity): void {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const chord = CHORDS[rarity];
  const duration = rarity === "impossible" ? 1.8 : rarity === "legendary" ? 1.35 : 0.7;
  const peak = rarity === "impossible" ? 0.09 : rarity === "legendary" ? 0.08 : 0.06;
  chord.forEach((frequency, index) => {
    tone(ctx, now + index * 0.012, frequency, duration, "sine", peak, ctx.destination);
    if (rarity === "legendary" || rarity === "impossible") {
      tone(ctx, now + 0.22, frequency * 2, duration * 0.7, "triangle", peak * 0.35, ctx.destination);
    }
  });
  if (rarity === "impossible") {
    tone(ctx, now + 0.55, 932.33, 1.1, "sine", 0.05, ctx.destination);
  }
}

export function playTopicSelect(topic: GiftTopic): void {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  if (topic === "technology") {
    tone(ctx, now, 523.25, 0.08, "sine", 0.07, ctx.destination); // C5
    tone(ctx, now + 0.06, 783.99, 0.1, "triangle", 0.08, ctx.destination); // G5
    tone(ctx, now + 0.12, 1046.5, 0.16, "sine", 0.07, ctx.destination); // C6
  } else if (topic === "audio") {
    tone(ctx, now, 440, 0.12, "triangle", 0.06, ctx.destination); // A4
    tone(ctx, now + 0.05, 554.37, 0.14, "sine", 0.07, ctx.destination); // C#5
    tone(ctx, now + 0.10, 659.25, 0.18, "sine", 0.08, ctx.destination); // E5
    tone(ctx, now + 0.15, 880, 0.22, "sine", 0.06, ctx.destination); // A5
  } else if (topic === "snacks") {
    tone(ctx, now, 587.33, 0.08, "sine", 0.07, ctx.destination); // D5
    tone(ctx, now + 0.06, 739.99, 0.09, "sine", 0.08, ctx.destination); // F#5
    tone(ctx, now + 0.12, 880, 0.11, "triangle", 0.08, ctx.destination); // A5
    tone(ctx, now + 0.18, 1174.66, 0.18, "sine", 0.08, ctx.destination); // D6
  } else if (topic === "style") {
    tone(ctx, now, 329.63, 0.07, "triangle", 0.08, ctx.destination); // E4
    tone(ctx, now + 0.05, 493.88, 0.08, "triangle", 0.07, ctx.destination); // B4
    tone(ctx, now + 0.10, 659.25, 0.14, "sine", 0.09, ctx.destination); // E5
    tone(ctx, now + 0.16, 987.77, 0.18, "sine", 0.06, ctx.destination); // B5
  }
}

export function playKidsCheer(): void {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const notes = [659.25, 783.99, 987.77, 1046.5, 1318.5];
  notes.forEach((freq, idx) => {
    tone(ctx, now + idx * 0.04, freq, 0.12, "sine", 0.05, ctx.destination);
    tone(ctx, now + idx * 0.04 + 0.015, freq * 1.5, 0.08, "triangle", 0.025, ctx.destination);
  });
}

export function playCoinPickup(): void {
  const ctx = getContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, now, 1800, 0.04, "triangle", 0.07, ctx.destination);
  tone(ctx, now + 0.02, 2400, 0.07, "sine", 0.06, ctx.destination);
}

export function startPlanet(patch: SoundPayload): void {
  stopPlanet();
  const ctx = getContext();
  if (!ctx) return;

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

  master.connect(filter).connect(gate).connect(scope).connect(ctx.destination);

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
  return Math.min(1, Math.sqrt(sum / bins.length) * 5);
}
