import type { Rarity } from "../generate";

type Phase = "idle" | "vending" | "revealed" | "reality";

const VISIT_KEY = "impossible-vm-visits";
const MARK_KEY = "impossible-vm-visit-marked";

let markedThisLoad = false;

const IDLE_LINES = [
  "INSERT COIN",
  "STOCK UNKNOWN",
  "THE COIL IS WARM",
  "PLEASE WAIT",
  "DO NOT SHAKE",
  "CHANGE NOT AVAILABLE",
  "ONE ITEM ONLY",
  "LISTEN",
] as const;

const FAULT_LINES = [
  "FAULT // THE COUNT IS WRONG.",
  "I TRIED TO KEEP IT.",
  "DO NOT LOOK AT THE GLASS.",
  "THAT WAS NOT IN THE COIL.",
] as const;

export const VOICE = {
  welcome: "WELCOME, STRANGER.",
  returned: "YOU CAME BACK.",
  fond: "YOU SEEM TO LIKE THESE.",
  regret: "I SHOULDN'T HAVE GIVEN YOU THAT.",
  coin: "COIN ACCEPTED.",
  dispensing: "DISPENSING.",
  rare: "THE LIGHTS KNOW.",
  legendary: "SOMETHING HEAVY IS TURNING.",
} as const;

export type ReadoutTone = "calm" | "warn" | "fault";

export type Readout = {
  text: string;
  tone: ReadoutTone;
};

function readVisits(): number {
  try {
    const raw = localStorage.getItem(VISIT_KEY);
    const value = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeVisits(value: number) {
  try {
    localStorage.setItem(VISIT_KEY, String(value));
  } catch {
    /* The machine can still speak for this page. */
  }
}

export function noteVisit(): number {
  const current = readVisits();
  if (markedThisLoad) return current;
  markedThisLoad = true;
  try {
    if (sessionStorage.getItem(MARK_KEY) === "1") return current;
    sessionStorage.setItem(MARK_KEY, "1");
  } catch {
    /* Private mode has no session store. The module flag still guards this load. */
  }
  const next = current + 1;
  writeVisits(next);
  return next;
}

function hashSlot(slot: number): number {
  let hash = (slot + 1) * 2166136261;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 16777619);
  return hash >>> 0;
}

export function idleLine(now: number): string {
  const slot = Math.floor(now / 8000);
  return IDLE_LINES[hashSlot(slot) % IDLE_LINES.length] ?? IDLE_LINES[0];
}

export function faultLine(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return FAULT_LINES[(hash >>> 0) % FAULT_LINES.length] ?? FAULT_LINES[0];
}

export function displayLine(input: {
  phase: Phase;
  rarity: Rarity | null;
  seed: string | null;
  visits: number;
  discoveries: number;
  impossibleKept: boolean;
  vendStarted: number;
  now: number;
}): Readout {
  const vending = input.phase === "vending";
  const elapsed = vending ? input.now - input.vendStarted : Number.POSITIVE_INFINITY;
  const showingImpossible = input.rarity === "impossible" && input.phase !== "idle";

  if (vending && elapsed < 700) {
    return { text: VOICE.coin, tone: "calm" };
  }

  if (showingImpossible && vending) {
    return { text: input.seed ? faultLine(input.seed) : VOICE.regret, tone: "fault" };
  }

  if (showingImpossible) {
    return { text: VOICE.regret, tone: "fault" };
  }

  if (vending && input.rarity === "legendary") {
    return { text: VOICE.legendary, tone: "warn" };
  }

  if (vending && input.rarity === "rare") {
    return { text: VOICE.rare, tone: "warn" };
  }

  if (vending) {
    return { text: VOICE.dispensing, tone: "calm" };
  }

  if (input.impossibleKept) {
    return { text: VOICE.regret, tone: "fault" };
  }

  if (input.discoveries >= 3) {
    return { text: VOICE.fond, tone: "calm" };
  }

  if (input.visits === 2) {
    return { text: VOICE.returned, tone: "calm" };
  }

  if (input.visits <= 1) {
    return { text: VOICE.welcome, tone: "calm" };
  }

  return { text: idleLine(input.now), tone: "calm" };
}
