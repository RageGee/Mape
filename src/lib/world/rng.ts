// Deterministic seeded random number generation.
// Every generator stage forks from one of these so worlds are 100% reproducible.

export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function subSeed(seed: number, tag: string): number {
  return (seed ^ hashString(tag)) >>> 0;
}

export class Rng {
  readonly seed: number;
  private readonly nextFn: () => number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.nextFn = mulberry32(this.seed);
  }

  // arrow property so the function can be detached (e.g. passed to SimplexNoise)
  readonly next = (): number => {
    return this.nextFn();
  };

  float(min = 0, max = 1): number {
    return min + this.nextFn() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  chance(p: number): boolean {
    return this.nextFn() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.nextFn() * arr.length)];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.nextFn() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  weighted<T>(items: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const it of items) total += it[1];
    let roll = this.nextFn() * total;
    for (const it of items) {
      roll -= it[1];
      if (roll <= 0) return it[0];
    }
    return items[items.length - 1][0];
  }

  gaussian(mean = 0, sd = 1): number {
    // Box–Muller
    const u = Math.max(this.nextFn(), 1e-9);
    const v = this.nextFn();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + z * sd;
  }

  fork(tag: string): Rng {
    return new Rng(subSeed(this.seed, tag));
  }
}
