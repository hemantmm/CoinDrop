import { hashSerial } from "./rng";
import type { PrizePayload, Product, Rarity } from "./generate";

const KEY = "impossible-vm-mall-stock-v2";
export const STOCK_COUNT = 16;

export const COIL_CODES = [
  "A1", "A2", "A3", "A4",
  "B1", "B2", "B3", "B4",
  "C1", "C2", "C3", "C4",
  "D1", "D2", "D3", "D4",
] as const;

export type CoilCode = (typeof COIL_CODES)[number];

type MallPrize = {
  name: string;
  kind: string;
  topic: GiftTopic;
  detail: string;
  rarity: Rarity;
  color: string;
  shape: "phone" | "laptop" | "watch" | "chocolate" | "buds" | "shoes" | "anomaly";
};

export type GiftTopic = "technology" | "audio" | "snacks" | "style";
export type CoinPlayer = "Dad" | "Leo" | "Maya";
export type PlayStep =
  | "need_coin"
  | "coin_entering"
  | "select_item"
  | "vending"
  | "in_tray"
  | "revealed";

export type GiftTopicInfo = {
  id: GiftTopic;
  label: string;
  description: string;
  icon: string;
  vibe: string;
  kidsSay: string;
  kidsVote: string;
  accent: string;
};

export const GIFT_TOPICS: GiftTopicInfo[] = [
  {
    id: "technology",
    label: "Technology",
    description: "Devices and gadgets",
    icon: "⚡",
    vibe: "Cyber Grid",
    kidsSay: "Leo: 'Look at the phone, Dad! Can we get it?!' · Maya: 'Check out the tiny camera!'",
    kidsVote: "👦 Leo's #1 Pick",
    accent: "#00f5ff",
  },
  {
    id: "audio",
    label: "Audio",
    description: "Music for the road",
    icon: "🎧",
    vibe: "Synthwave Beat",
    kidsSay: "Maya: 'The headphones are so pretty!' · Leo: 'We need that speaker for our room!'",
    kidsVote: "👧 Maya's Favorite",
    accent: "#bf5af2",
  },
  {
    id: "snacks",
    label: "Snacks",
    description: "A little something sweet",
    icon: "🍫",
    vibe: "Golden Candy Shop",
    kidsSay: "Maya: 'CHOCOLATE! Please dad, the gold bar!!' · Leo: 'Look at the gummy bears!!'",
    kidsVote: "👧 Maya's Cravings",
    accent: "#ff9e3b",
  },
  {
    id: "style",
    label: "Style",
    description: "Something to wear",
    icon: "👟",
    vibe: "Streetwear Neon",
    kidsSay: "Leo: 'Those sneakers are so fire!!' · Maya: 'The cap with the star looks so cute!'",
    kidsVote: "👦 Leo's Street Vibe",
    accent: "#00ff88",
  },
];

const PRIZES: MallPrize[] = [
  // Technology
  { name: "Pocket Camera", kind: "Camera", topic: "technology", detail: "A tiny retro camera with one picture left inside.", rarity: "common", color: "#9ca3af", shape: "phone" },
  { name: "Smartwatch", kind: "Wearable", topic: "technology", detail: "A polished steel smartwatch with biometric sensors.", rarity: "rare", color: "#00f5ff", shape: "watch" },
  { name: "Gold Edition iPhone", kind: "Flagship Phone", topic: "technology", detail: "Sealed gold titanium flagship. Maya and Leo are staring in pure disbelief.", rarity: "legendary", color: "#ffd700", shape: "phone" },
  { name: "Quantum Singularity Device", kind: "Reality Anomaly", topic: "technology", detail: "A device that bends time and space around itself. The glass displays constellations from other galaxies.", rarity: "impossible", color: "#e7b4ff", shape: "anomaly" },

  // Audio
  { name: "Pocket Speaker", kind: "Speaker", topic: "audio", detail: "A compact travel speaker ready to fill the car with your song.", rarity: "common", color: "#6a8c83", shape: "buds" },
  { name: "Studio Neon Headphones", kind: "Headphones", topic: "audio", detail: "Padded studio monitors with glowing acoustic trim.", rarity: "rare", color: "#bf5af2", shape: "buds" },
  { name: "Gilded Hi-Fi Player", kind: "Hi-Fi Player", topic: "audio", detail: "Precision audiophile player carved from brushed brass. Golden acoustics.", rarity: "legendary", color: "#facc15", shape: "phone" },
  { name: "Void Harmonic Resonator", kind: "Cosmic Audio", topic: "audio", detail: "Captures echoes from parallel timelines. Emits a hypnotic multidimensional hum.", rarity: "impossible", color: "#d946ef", shape: "anomaly" },

  // Snacks
  { name: "Milk Chocolate Bar", kind: "Sweet", topic: "snacks", detail: "A classic chocolate bar in a bright foil wrapper.", rarity: "common", color: "#6b3e22", shape: "chocolate" },
  { name: "Artisan Macaron Box", kind: "Confection", topic: "snacks", detail: "Delicate lavender and pistachio macarons nestled in silk ribbon.", rarity: "rare", color: "#f472b6", shape: "chocolate" },
  { name: "Pure 24K Gold Foil Truffle", kind: "Luxury Treat", topic: "snacks", detail: "A golden master confection wrapped in genuine edible 24k gold leaf.", rarity: "legendary", color: "#ffd700", shape: "chocolate" },
  { name: "Infinite Starlight Confection", kind: "Celestial Candy", topic: "snacks", detail: "A crystalline prism filled with liquid stardust. It glows brighter the closer you look.", rarity: "impossible", color: "#c084fc", shape: "anomaly" },

  // Style
  { name: "Star Cap", kind: "Accessory", topic: "style", detail: "A soft cotton cap with a little embroidered star.", rarity: "common", color: "#b75d53", shape: "shoes" },
  { name: "Designer Neon Sunglasses", kind: "Eyewear", topic: "style", detail: "Gradient polarized lenses with iridescent frames.", rarity: "rare", color: "#00ff88", shape: "watch" },
  { name: "Golden Chronograph Watch", kind: "Luxury Timepiece", topic: "style", detail: "Heavy 18k solid gold links and diamond-cut bezels. A genuine heirloom.", rarity: "legendary", color: "#eab308", shape: "watch" },
  { name: "Zero-Gravity Chrono-Sneakers", kind: "Dimensional Gear", topic: "style", detail: "Hovering 2 inches above the ground, these shoes warp gravity in their immediate perimeter.", rarity: "impossible", color: "#e879f9", shape: "anomaly" },
];

export type StockSlot = {
  index: number;
  code: string;
  product: Product;
  claimed: boolean;
  topic: GiftTopic;
  color: string;
  shape: MallPrize["shape"];
};

export type DayStock = {
  day: string;
  slots: StockSlot[];
  next: StockSlot | null;
  remaining: number;
  soldOut: boolean;
};

function dayKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}${month}${date}`;
}

function prizesFor(): MallPrize[] {
  return PRIZES;
}

function asProduct(prize: MallPrize, seed: string): Product {
  const payload: PrizePayload = { kind: "prize", name: prize.name, detail: prize.detail };
  return {
    seed,
    type: "prize",
    rarity: prize.rarity,
    title: prize.name,
    line: prize.detail,
    traits: [prize.kind],
    serial: hashSerial(seed),
    payload,
  };
}

function readClaimed(day: string): Set<number> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return new Set();
    const saved = parsed as { day?: unknown; claimed?: unknown };
    if (saved.day !== day || !Array.isArray(saved.claimed)) return new Set();
    return new Set(
      saved.claimed.filter((value): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) < STOCK_COUNT),
    );
  } catch {
    return new Set();
  }
}

function writeClaimed(day: string, claimed: Set<number>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ day, claimed: [...claimed] }));
  } catch {
    /* The window can still show today's stock for this page. */
  }
}

export function todayStock(now = new Date()): DayStock {
  const day = dayKey(now);
  const claimed = readClaimed(day);
  const slots = prizesFor().map((prize, index) => ({
    index,
    code: COIL_CODES[index] ?? `S${index + 1}`,
    product: asProduct(prize, `m${day}${index}`),
    claimed: claimed.has(index),
    topic: prize.topic,
    color: prize.color,
    shape: prize.shape,
  }));
  const next = slots.find((slot) => !slot.claimed) ?? null;
  const remaining = slots.filter((slot) => !slot.claimed).length;
  return { day, slots, next, remaining, soldOut: remaining === 0 };
}

export function claimSlot(index: number, now = new Date()) {
  const day = dayKey(now);
  const claimed = readClaimed(day);
  claimed.add(index);
  writeClaimed(day, claimed);
}
