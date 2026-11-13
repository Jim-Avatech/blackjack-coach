import { isRed, rankValue } from "./cards";
import type { Card } from "./types";

/** Perfect Pairs — player's first two cards. Common 6-deck paytable. */
export const PERFECT_PAIRS_PAYTABLE = {
  perfect: 25, // same rank, same suit
  colored: 12, // same rank, same color, different suit
  mixed: 6, // same rank, different color
} as const;

export type PerfectPairsKind = "perfect" | "colored" | "mixed";

export function evaluatePerfectPairs(cards: Card[]): {
  kind: PerfectPairsKind;
  payout: number;
} | null {
  if (cards.length < 2) return null;
  const a = cards[0]!;
  const b = cards[1]!;
  if (a.rank !== b.rank) return null;
  if (a.suit === b.suit) return { kind: "perfect", payout: PERFECT_PAIRS_PAYTABLE.perfect };
  if (isRed(a.suit) === isRed(b.suit))
    return { kind: "colored", payout: PERFECT_PAIRS_PAYTABLE.colored };
  return { kind: "mixed", payout: PERFECT_PAIRS_PAYTABLE.mixed };
}

/** 21+3 — player's two cards + dealer upcard, 3-card poker. Common paytable. */
export const TWENTY_ONE_PLUS_THREE_PAYTABLE = {
  suitedTrips: 100,
  straightFlush: 40,
  trips: 30,
  straight: 10,
  flush: 5,
} as const;

export type TwentyOnePlusThreeKind =
  | "suitedTrips"
  | "straightFlush"
  | "trips"
  | "straight"
  | "flush";

function pokerRank(card: Card): number {
  // Face cards keep their poker order (not blackjack's 10).
  // Ace high = 14, also usable as 1 for A-2-3.
  if (card.rank === "A") return 14;
  if (card.rank === "K") return 13;
  if (card.rank === "Q") return 12;
  if (card.rank === "J") return 11;
  return rankValue(card.rank);
}

function isConsecutive(ranks: number[]): boolean {
  const s = [...ranks].sort((a, b) => a - b);
  if (s[0] === s[1] || s[1] === s[2]) return false;
  if (s[0]! + 1 === s[1] && s[1]! + 1 === s[2]) return true;
  // A-2-3: 2,3,14
  if (s[0] === 2 && s[1] === 3 && s[2] === 14) return true;
  // Q-K-A: 12,13,14 already caught by +1. J-Q-K too.
  // K-A-2 is NOT a straight.
  return false;
}

export function evaluateTwentyOnePlusThree(
  player: Card[],
  dealerUp: Card,
): { kind: TwentyOnePlusThreeKind; payout: number } | null {
  if (player.length < 2) return null;
  const cards = [player[0]!, player[1]!, dealerUp];
  const ranks = cards.map(pokerRank);
  const suits = cards.map((c) => c.suit);
  const flush = suits[0] === suits[1] && suits[1] === suits[2];
  const trips = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  const straight = isConsecutive(ranks);

  if (trips && flush)
    return { kind: "suitedTrips", payout: TWENTY_ONE_PLUS_THREE_PAYTABLE.suitedTrips };
  if (straight && flush)
    return { kind: "straightFlush", payout: TWENTY_ONE_PLUS_THREE_PAYTABLE.straightFlush };
  if (trips) return { kind: "trips", payout: TWENTY_ONE_PLUS_THREE_PAYTABLE.trips };
  if (straight) return { kind: "straight", payout: TWENTY_ONE_PLUS_THREE_PAYTABLE.straight };
  if (flush) return { kind: "flush", payout: TWENTY_ONE_PLUS_THREE_PAYTABLE.flush };
  return null;
}

export function sideBetNet(
  bet: number,
  result: { payout: number } | null,
): number {
  if (bet <= 0) return 0;
  if (!result) return -bet;
  return bet * result.payout;
}
