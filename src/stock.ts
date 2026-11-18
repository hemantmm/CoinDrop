import { hashSerial } from "./rng";
import type { PrizePayload, Product, Rarity } from "./generate";

const KEY = "impossible-vm-mall-stock";
export const STOCK_COUNT = 6;

type MallPrize = {
  name: string;
  kind: string;
  detail: string;
  rarity: Rarity;
  color: string;
  shape: "phone" | "laptop" | "watch" | "chocolate" | "buds" | "shoes";
};

const PRIZES: MallPrize[] = [
  { name: "iPhone", kind: "Phone", detail: "A sealed phone. The kids are looking at it. Only your coin can take it.", rarity: "legendary", color: "#f5f5f7", shape: "phone" },
  { name: "MacBook", kind: "Laptop", detail: "A closed laptop, still in the sleeve.", rarity: "legendary", color: "#d7d7dc", shape: "laptop" },
  { name: "Watch", kind: "Watch", detail: "A steel watch on a new strap.", rarity: "rare", color: "#d9dde3", shape: "watch" },
  { name: "Chocolate", kind: "Sweet", detail: "A bar in gold foil.", rarity: "common", color: "#6b3e22", shape: "chocolate" },
  { name: "Earbuds", kind: "Audio", detail: "A boxed pair, still in the plastic.", rarity: "uncommon", color: "#eceae4", shape: "buds" },
  { name: "Sneakers", kind: "Shoes", detail: "One pair, tags still on.", rarity: "uncommon", color: "#f4f1ea", shape: "shoes" },
];

export type StockSlot = {
  index: number;
  product: Product;
  claimed: boolean;
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
