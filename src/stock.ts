import { hashSerial } from "./rng";
import type { PrizePayload, Product, Rarity } from "./generate";

const KEY = "impossible-vm-mall-stock-v2";
export const STOCK_COUNT = 16;

type MallPrize = {
  name: string;
  kind: string;
  topic: GiftTopic;
  detail: string;
  rarity: Rarity;
  color: string;
  shape: "phone" | "laptop" | "watch" | "chocolate" | "buds" | "shoes";
};

export type GiftTopic = "technology" | "audio" | "snacks" | "style";

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
  { name: "iPhone", kind: "Phone", topic: "technology", detail: "A sealed phone. The kids are looking at it. Only your coin can take it.", rarity: "legendary", color: "#f5f5f7", shape: "phone" },
  { name: "MacBook", kind: "Laptop", topic: "technology", detail: "A closed laptop, still in the sleeve.", rarity: "legendary", color: "#d7d7dc", shape: "laptop" },
  { name: "Smartwatch", kind: "Wearable", topic: "technology", detail: "A steel smartwatch, charged and ready.", rarity: "rare", color: "#d9dde3", shape: "watch" },
  { name: "Pocket Camera", kind: "Camera", topic: "technology", detail: "A tiny instant camera with one picture left inside.", rarity: "uncommon", color: "#d7d7dc", shape: "phone" },
  { name: "Earbuds", kind: "Audio", topic: "audio", detail: "A boxed pair, still in the plastic.", rarity: "uncommon", color: "#eceae4", shape: "buds" },
  { name: "Studio Headphones", kind: "Headphones", topic: "audio", detail: "Soft padded headphones, folded into their case.", rarity: "rare", color: "#6f8299", shape: "buds" },
  { name: "Pocket Speaker", kind: "Speaker", topic: "audio", detail: "A little speaker ready to fill the room with your song.", rarity: "common", color: "#6a8c83", shape: "buds" },
  { name: "Music Player", kind: "Player", topic: "audio", detail: "A pocket music player with a playlist already loaded.", rarity: "uncommon", color: "#e1bd73", shape: "phone" },
  { name: "Chocolate", kind: "Sweet", topic: "snacks", detail: "A bar in gold foil.", rarity: "common", color: "#6b3e22", shape: "chocolate" },
  { name: "Gummy Bears", kind: "Candy", topic: "snacks", detail: "A bright little bag of fruit gummies.", rarity: "common", color: "#e57954", shape: "chocolate" },
  { name: "Cookie Box", kind: "Treat", topic: "snacks", detail: "Two warm cookies wrapped up for the road.", rarity: "uncommon", color: "#bd8650", shape: "chocolate" },
  { name: "Popcorn", kind: "Snack", topic: "snacks", detail: "A tiny tub of freshly popped, buttery popcorn.", rarity: "common", color: "#f2cf68", shape: "chocolate" },
  { name: "Sneakers", kind: "Shoes", topic: "style", detail: "One pair, tags still on.", rarity: "uncommon", color: "#f4f1ea", shape: "shoes" },
  { name: "Sunglasses", kind: "Accessory", topic: "style", detail: "A pair of dark lenses in a polished case.", rarity: "rare", color: "#8d7860", shape: "watch" },
  { name: "Cap", kind: "Accessory", topic: "style", detail: "A soft cap with a little embroidered star.", rarity: "common", color: "#b75d53", shape: "shoes" },
  { name: "Backpack", kind: "Bag", topic: "style", detail: "A small canvas backpack with room for the important things.", rarity: "uncommon", color: "#58715d", shape: "laptop" },
];

export type StockSlot = {
  index: number;
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
