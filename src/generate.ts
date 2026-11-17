import {
  IMPOSSIBLE_TRAITS,
  TRAIT_POOL,
  writeCreature,
  writeLetter,
  writeMemory,
  writeReality,
  writeSound,
} from "./copy";
import { hashSerial, makeRng, type Rng } from "./rng";

export type Rarity = "common" | "uncommon" | "rare" | "legendary" | "impossible";
export type ProductType = "memory" | "sound" | "creature" | "letter" | "reality";

export type MemoryPayload = ReturnType<typeof writeMemory>;
export type LetterPayload = ReturnType<typeof writeLetter>;
export type CreaturePayload = ReturnType<typeof writeCreature>;
export type SoundPayload = ReturnType<typeof writeSound>;
export type RealityPayload = ReturnType<typeof writeReality>;
export type Payload = MemoryPayload | LetterPayload | CreaturePayload | SoundPayload | RealityPayload;

export type Product = {
  seed: string;
  type: ProductType;
  rarity: Rarity;
  title: string;
  line: string;
  traits: string[];
  serial: string;
  payload: Payload;
};

export const RARITY_WEIGHTS: readonly { rarity: Rarity; weight: number }[] = [
  { rarity: "common", weight: 0.4 },
  { rarity: "uncommon", weight: 0.3 },
  { rarity: "rare", weight: 0.18 },
  { rarity: "legendary", weight: 0.09 },
  { rarity: "impossible", weight: 0.03 },
];

export const PRODUCT_TYPES: readonly ProductType[] = [
  "memory",
  "sound",
  "creature",
  "letter",
  "reality",
];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#b7b1a8",
  uncommon: "#8dceac",
  rare: "#8eb6f2",
  legendary: "#e0b15a",
  impossible: "#e7b4ff",
};

export const TYPE_LABEL: Record<ProductType, string> = {
  memory: "Memory",
  sound: "Planetary sound",
  creature: "Creature",
  letter: "Letter",
  reality: "Alternate reality",
};

function rollRarity(rng: Rng): Rarity {
  let cursor = rng.next();
  for (const entry of RARITY_WEIGHTS) {
    cursor -= entry.weight;
    if (cursor < 0) return entry.rarity;
  }
  return "impossible";
}

function rollTraits(rng: Rng, type: ProductType, rarity: Rarity): string[] {
  const pool = [...TRAIT_POOL[type]];
  const count = 2 + rng.int(3);
  const traits: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const index = rng.int(pool.length);
    const [trait] = pool.splice(index, 1);
    if (trait) traits.push(trait);
  }
  if (rarity === "impossible") traits.push(rng.pick(IMPOSSIBLE_TRAITS));
  return traits;
}

function describeCreature(payload: CreaturePayload): string {
  const eyes = payload.eyeCount === 1 ? "one-eyed" : `${payload.eyeCount}-eyed`;
  const horns = payload.horns === 0 ? "hornless" : `${payload.horns}-horned`;
  return `${payload.limbCount}-limbed, ${eyes}, ${horns}`;
}

function titleFor(type: ProductType, payload: Payload): string {
  switch (type) {
    case "memory":
      return payload.kind === "memory" ? `A memory of ${payload.place}` : "A memory";
    case "sound":
      return payload.kind === "sound" ? `Signal from ${payload.planet}` : "A signal";
    case "creature":
      return payload.kind === "creature" ? payload.name : "A creature";
    case "letter":
      return payload.kind === "letter" ? `Letter from ${payload.year}` : "A letter";
    case "reality":
      return "Five seconds of another sky";
  }
}

function lineFor(type: ProductType, payload: Payload, traits: string[]): string {
  switch (payload.kind) {
    case "memory":
      return payload.detail;
    case "sound":
      return `${payload.planet}: ${payload.notes.join(", ")}.`;
    case "creature":
      return `${describeCreature(payload)}. ${traits[0] ? `It is ${traits[0]}.` : ""}`.trim();
    case "letter":
      return payload.body;
    case "reality":
      return payload.rule;
    default:
      return type;
  }
}

export function generate(seed: string): Product {
  const rng = makeRng(seed);
  const rarity = rollRarity(rng);
  const type = rng.pick(PRODUCT_TYPES);
  const traits = rollTraits(rng, type, rarity);
  const payload = (() => {
    switch (type) {
      case "memory":
        return writeMemory(rng);
      case "letter":
        return writeLetter(rng);
      case "creature":
        return writeCreature(rng);
      case "sound":
        return writeSound(rng);
      case "reality":
        return writeReality(rng);
    }
  })();

  return {
    seed,
    type,
    rarity,
    title: titleFor(type, payload),
    line: lineFor(type, payload, traits),
    traits,
    serial: hashSerial(seed),
    payload,
  };
}

export function isHighRarity(rarity: Rarity): boolean {
  return rarity === "legendary" || rarity === "impossible";
}
