import type { ProductType, Rarity } from "../generate";

type Phase = "idle" | "vending" | "revealed" | "reality";

const VISIT_KEY = "impossible-vm-visits";
const MARK_KEY = "impossible-vm-visit-marked";

let markedThisLoad = false;

const IDLE_LINES: Readout[] = [
  { label: "Waiting", text: "Insert a coin.", detail: "The coil chooses. You do not.", tone: "calm" },
  { label: "Stock", text: "The next object is unknown.", detail: "Even the machine has not seen it yet.", tone: "calm" },
  { label: "Warm", text: "The coil is still warm.", detail: "Someone stood here not long ago.", tone: "calm" },
  { label: "Hold", text: "Please wait.", detail: "A choice is already turning inside.", tone: "calm" },
  { label: "Still", text: "Do not shake the case.", detail: "What is in the coil is not fastened down.", tone: "calm" },
  { label: "No change", text: "Change is not available.", detail: "The coin is the whole of the trade.", tone: "calm" },
  { label: "One", text: "One item only.", detail: "The flap opens once, then it means it.", tone: "calm" },
  { label: "Listen", text: "Listen.", detail: "Some of the stock can only be heard.", tone: "calm" },
];

const FAULT_LINES: Readout[] = [
  { label: "Fault", text: "The count is wrong.", detail: "I tried to keep this one. It left anyway.", tone: "fault" },
  { label: "Fault", text: "I tried to keep it.", detail: "The coil gave it up before I could close.", tone: "fault" },
  { label: "Fault", text: "Do not look at the glass.", detail: "What is coming was not on the shelf.", tone: "fault" },
  { label: "Fault", text: "That was not in the coil.", detail: "The machine is dispensing something it did not stock.", tone: "fault" },
];

export const VOICE = {
  welcome: "Welcome, stranger.",
  returned: "You came back.",
  fond: "You seem to like these.",
  regret: "I shouldn't have given you that.",
  coin: "The coin is accepted.",
  dispensing: "The coil is turning.",
  rare: "The lights know.",
  legendary: "Something heavy is turning.",
} as const;

export type ReadoutTone = "calm" | "warn" | "fault";

export type Readout = {
  label: string;
  text: string;
  detail: string;
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

export function idleLine(now: number): Readout {
  const slot = Math.floor(now / 8000);
  return IDLE_LINES[hashSlot(slot) % IDLE_LINES.length] ?? IDLE_LINES[0];
}

export function faultLine(seed: string): Readout {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return FAULT_LINES[(hash >>> 0) % FAULT_LINES.length] ?? FAULT_LINES[0];
}

function toneFor(rarity: Rarity | null): ReadoutTone {
  if (rarity === "impossible") return "fault";
  if (rarity === "legendary" || rarity === "rare") return "warn";
  return "calm";
}

function aboutProduct(type: ProductType, rarity: Rarity | null, title: string): Readout {
  const tone = toneFor(rarity);
  const weight =
    rarity === "impossible"
      ? "I shouldn't have given you that."
      : rarity === "legendary"
        ? "Something heavy turned to let it out."
        : rarity === "rare"
          ? "The lights knew before the coil did."
          : "This exact one will not come again.";

  if (type === "memory") {
    return { label: "Memory", text: title, detail: `You were not there. ${weight}`, tone };
  }
  if (type === "letter") {
    return { label: "Unsent", text: title, detail: `A later you wrote it, and never posted it. ${weight}`, tone };
  }
  if (type === "sound") {
    return { label: "Signal", text: title, detail: `No chart lists this place. ${weight}`, tone };
  }
  if (type === "creature") {
    return { label: "Alive", text: title, detail: `It is awake on the plinth. ${weight}`, tone };
  }
  if (type === "prize") {
    return { label: "Won", text: title, detail: "It is out of the case. The next prize moves up.", tone };
  }
  return { label: "Five seconds", text: title, detail: `Stay until the room returns. ${weight}`, tone };
}

export function displayLine(input: {
  phase: Phase;
  rarity: Rarity | null;
  type: ProductType | null;
  title: string | null;
  seed: string | null;
  visits: number;
  discoveries: number;
  impossibleKept: boolean;
  vendStarted: number;
  now: number;
}): Readout {
  const vending = input.phase === "vending";
  const elapsed = vending ? input.now - input.vendStarted : Number.POSITIVE_INFINITY;
  const showing = input.phase === "revealed" || input.phase === "reality";

  if (vending && elapsed < 700) {
    return { label: "Coin", text: VOICE.coin, detail: "Now it has to give you something.", tone: "calm" };
  }

  if (vending && input.rarity === "impossible") {
    return input.seed ? faultLine(input.seed) : FAULT_LINES[0];
  }

  if (vending && input.rarity === "legendary") {
    return { label: "Legendary", text: VOICE.legendary, detail: "The case is working harder than it should.", tone: "warn" };
  }

  if (vending && input.rarity === "rare") {
    return { label: "Rare", text: VOICE.rare, detail: "Hold still. It is almost through the flap.", tone: "warn" };
  }

  if (vending) {
    return { label: "Dispensing", text: VOICE.dispensing, detail: "One object. Then the flap closes.", tone: "calm" };
  }

  if (showing && input.type && input.title) {
    return aboutProduct(input.type, input.rarity, input.title);
  }

  if (input.impossibleKept) {
    return {
      label: "Regret",
      text: VOICE.regret,
      detail: "It is still in the cabinet. I count it whenever you return.",
      tone: "fault",
    };
  }

  if (input.discoveries >= 3) {
    return {
      label: `${input.discoveries} kept`,
      text: VOICE.fond,
      detail: "The cabinet is starting to know your hand.",
      tone: "calm",
    };
  }

  if (input.visits === 2) {
    return {
      label: "Returned",
      text: VOICE.returned,
      detail: "The coil kept a little warmth from last time.",
      tone: "calm",
    };
  }

  if (input.visits <= 1) {
    return {
      label: "First visit",
      text: VOICE.welcome,
      detail: "Nothing in the case has happened to anyone yet.",
      tone: "calm",
    };
  }

  return idleLine(input.now);
}
