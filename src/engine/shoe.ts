import { RANKS, SUITS, makeCard } from "./cards";
import type { Card } from "./types";

/** Fisher–Yates shuffle. Pass a RNG for deterministic tests. */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export function buildDecks(decks: number): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push(makeCard(rank, suit, `${d}-${rank}-${suit}`));
      }
    }
  }
  return cards;
}

export class Shoe {
  private cards: Card[] = [];
  private discarded: Card[] = [];
  private cutIndex = 0;
  private needsShuffle = false;
  readonly decks: number;
  /** Penetration: shuffle after this fraction of the shoe has been dealt. */
  readonly penetration: number;
  private rng: () => number;

  constructor(decks: number, penetration = 0.75, rng: () => number = Math.random) {
    this.decks = decks;
    this.penetration = penetration;
    this.rng = rng;
    this.reshuffle();
  }

  get remaining(): number {
    return this.cards.length;
  }

  get total(): number {
    return this.decks * 52;
  }

  get shouldShuffle(): boolean {
    return this.needsShuffle;
  }

  /** Cards still in the shoe (front is next to deal). For tests / drills. */
  get stack(): readonly Card[] {
    return this.cards;
  }

  reshuffle(): void {
    this.cards = shuffle([...this.cards, ...this.discarded, ...buildDecks(0)], this.rng);
    // rebuild fresh so discarded + remaining always equals a full set
    this.cards = shuffle(buildDecks(this.decks), this.rng);
    this.discarded = [];
    // Cut card around the penetration point, with a little jitter.
    const jitter = Math.floor((this.rng() - 0.5) * this.total * 0.06);
    this.cutIndex = Math.floor(this.total * (1 - this.penetration)) + jitter;
    if (this.cutIndex < 20) this.cutIndex = 20;
    if (this.cutIndex > this.total - 20) this.cutIndex = this.total - 20;
    this.needsShuffle = false;
    // Burn one card, casino style.
    if (this.cards.length) this.discarded.push(this.cards.pop()!);
  }

  draw(): Card {
    if (this.cards.length === 0) this.reshuffle();
    const card = this.cards.pop()!;
    if (this.cards.length <= this.cutIndex) this.needsShuffle = true;
    return card;
  }

  discard(cards: Card | Card[]): void {
    if (Array.isArray(cards)) this.discarded.push(...cards);
    else this.discarded.push(cards);
  }

  /**
   * Force the next cards to be dealt (front of deal = end of array).
   * Used by drill mode and tests. Cards are taken from the remaining shoe
   * when possible, otherwise injected (tests only).
   */
  stackNext(next: Card[]): void {
    // Push in reverse so the first item is drawn first.
    for (let i = next.length - 1; i >= 0; i--) {
      this.cards.push(next[i]!);
    }
  }

  /** Remove a card matching rank+suit from the remaining shoe (for drills). */
  takeMatching(wanted: Card): Card | undefined {
    const i = this.cards.findIndex((c) => c.rank === wanted.rank && c.suit === wanted.suit);
    if (i < 0) return undefined;
    const [card] = this.cards.splice(i, 1);
    return card;
  }
}

/** Mulberry32 — tiny seeded RNG for tests and drill variety. */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
