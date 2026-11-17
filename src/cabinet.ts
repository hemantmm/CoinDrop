import type { Product, ProductType, Rarity } from "./generate";
import { isSeed } from "./rng";

const KEY = "impossible-vm-cabinet";
const LIMIT = 48;

export type CabinetItem = {
  seed: string;
  type: ProductType;
  rarity: Rarity;
  title: string;
  serial: string;
  acquiredAt: number;
};

function validItem(value: unknown): value is CabinetItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CabinetItem>;
  return typeof item.seed === "string" && isSeed(item.seed) && typeof item.title === "string";
}

export function loadCabinet(): CabinetItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validItem);
  } catch {
    return [];
  }
}

export function remember(product: Product): CabinetItem[] {
  const next: CabinetItem = {
    seed: product.seed,
    type: product.type,
    rarity: product.rarity,
    title: product.title,
    serial: product.serial,
    acquiredAt: Date.now(),
  };
  let items = [next];
  try {
    items = [next, ...loadCabinet().filter((item) => item.seed !== product.seed)].slice(0, LIMIT);
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    return items;
  }
  return items;
}

export function shareUrl(seed: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("seed", seed);
  return url.toString();
}
