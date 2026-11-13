import type { Card, DealerUp, Rank, Suit } from "./types";

export const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
export const RANKS: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export function rankValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (rank === "K" || rank === "Q" || rank === "J" || rank === "10") return 10;
  return Number(rank);
}

/** 1 for ace, 10 for T/J/Q/K, face value otherwise — used as dealer upcard keys. */
export function dealerUpValue(card: Card): DealerUp {
  const v = rankValue(card.rank);
  return (v === 11 ? 1 : v) as DealerUp;
}

/** Same pip value (tens group together for pairing? no — see isPair). */
export function isTenValue(rank: Rank): boolean {
  return rankValue(rank) === 10;
}

export function makeCard(rank: Rank, suit: Suit, id?: string): Card {
  return { rank, suit, id: id ?? `${rank}${suit[0]}-${Math.random().toString(36).slice(2, 8)}` };
}

export function cardLabel(card: Card): string {
  const suitMark =
    card.suit === "spades"
      ? "♠"
      : card.suit === "hearts"
        ? "♥"
        : card.suit === "diamonds"
          ? "♦"
          : "♣";
  return `${card.rank}${suitMark}`;
}

export function isRed(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

/** Parse strings like "As", "Td", "10h", "KH", "A♠". */
export function parseCard(spec: string, id?: string): Card {
  const s = spec.trim();
  const suitChar = s[s.length - 1].toLowerCase();
  const suitMap: Record<string, Suit> = {
    s: "spades",
    h: "hearts",
    d: "diamonds",
    c: "clubs",
    "♠": "spades",
    "♥": "hearts",
    "♦": "diamonds",
    "♣": "clubs",
  };
  const suit = suitMap[suitChar];
  if (!suit) throw new Error(`Bad card suit: ${spec}`);
  let rankPart = s.slice(0, -1).toUpperCase();
  if (rankPart === "T") rankPart = "10";
  if (!(RANKS as string[]).includes(rankPart)) throw new Error(`Bad card rank: ${spec}`);
  return makeCard(rankPart as Rank, suit, id ?? spec);
}

export function parseCards(specs: string): Card[] {
  return specs
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((s, i) => parseCard(s, `${s}-${i}`));
}
