export type Rng = {
  next: () => number;
  int: (max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (probability: number) => boolean;
  range: (min: number, max: number) => number;
};

export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: string): Rng {
  const next = mulberry32(hashSeed(seed));
  return {
    next,
    int(max: number) {
      return Math.floor(next() * max);
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(next() * items.length)]!;
    },
    chance(probability: number) {
      return next() < probability;
    },
    range(min: number, max: number) {
      return min + next() * (max - min);
    },
  };
}

export function hashSerial(seed: string): string {
  const n = hashSeed(`serial:${seed}`) % 1_000_000;
  return `#${n.toString().padStart(6, "0")}`;
}

export function isSeed(value: string): boolean {
  return /^[a-z0-9]{1,24}$/i.test(value);
}

export function makeSeed(): string {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  const time = Date.now().toString(36);
  const noise = (bytes[0]!.toString(36) + bytes[1]!.toString(36)).slice(0, 10);
  return `${time}${noise}`.slice(0, 20);
}
