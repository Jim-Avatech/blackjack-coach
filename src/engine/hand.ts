import { isTenValue, rankValue } from "./cards";
import type { Card, HandState } from "./types";

export function emptyHand(bet = 0): HandState {
  return {
    cards: [],
    bet,
    doubled: false,
    surrendered: false,
    fromSplit: false,
    fromSplitAces: false,
    stood: false,
    insurance: 0,
  };
}

export interface HandValue {
  total: number;
  soft: boolean;
  /** Number of aces still counted as 11. 0 or 1 in valid hands. */
  softAces: number;
}

export function evaluate(cards: Card[]): HandValue {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += rankValue(c.rank);
    if (c.rank === "A") aces += 1;
  }
  let softAces = aces;
  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces -= 1;
  }
  return { total, soft: softAces > 0, softAces };
}

export function isBust(cards: Card[]): boolean {
  return evaluate(cards).total > 21;
}

/** Two-card 21 that did not come from a split. Split 21 is just 21. */
export function isBlackjack(hand: HandState): boolean {
  return (
    hand.cards.length === 2 &&
    !hand.fromSplit &&
    evaluate(hand.cards).total === 21
  );
}

export function isPair(cards: Card[]): boolean {
  if (cards.length !== 2) return false;
  const [a, b] = cards;
  if (!a || !b) return false;
  // Tens: any two 10-value cards count as a pair (never split them anyway).
  if (isTenValue(a.rank) && isTenValue(b.rank)) return true;
  return a.rank === b.rank;
}

/** Pair rank used in strategy charts: 1=A, 2–9, 10=tens. */
export function pairRank(cards: Card[]): number | null {
  if (!isPair(cards)) return null;
  const v = rankValue(cards[0]!.rank);
  return v === 11 ? 1 : v;
}

export function isFinished(hand: HandState): boolean {
  if (hand.stood || hand.surrendered || hand.doubled) return true;
  if (isBust(hand.cards)) return true;
  if (isBlackjack(hand)) return true;
  if (evaluate(hand.cards).total === 21) return true;
  return false;
}

export function canHit(hand: HandState, hitSplitAces: boolean): boolean {
  if (isFinished(hand)) return false;
  if (hand.fromSplitAces && !hitSplitAces) return false;
  return true;
}

export function canStand(hand: HandState): boolean {
  return !hand.surrendered && !isBust(hand.cards) && !hand.stood;
}

export function canDouble(
  hand: HandState,
  opts: {
    das: boolean;
    doubleOn: "any" | "9-11" | "10-11";
    hitSplitAces: boolean;
    bankroll: number;
  },
): boolean {
  if (hand.cards.length !== 2) return false;
  if (hand.stood || hand.surrendered || hand.doubled) return false;
  if (hand.fromSplit && !opts.das) return false;
  if (hand.fromSplitAces && !opts.hitSplitAces) return false;
  if (opts.bankroll < hand.bet) return false;
  const { total, soft } = evaluate(hand.cards);
  if (opts.doubleOn === "any") return true;
  // Soft hands: "9-11 only" refers to hard totals of the two cards. A soft
  // 18 is 18, so it is not allowed. Hard 9–11 only.
  if (soft) return false;
  if (opts.doubleOn === "9-11") return total >= 9 && total <= 11;
  return total >= 10 && total <= 11;
}

export function canSplit(
  hand: HandState,
  opts: {
    das: boolean;
    resplitAces: boolean;
    maxHands: number;
    currentHands: number;
    bankroll: number;
  },
): boolean {
  if (hand.cards.length !== 2) return false;
  if (hand.stood || hand.surrendered || hand.doubled) return false;
  if (!isPair(hand.cards)) return false;
  if (opts.currentHands >= opts.maxHands) return false;
  if (opts.bankroll < hand.bet) return false;
  if (hand.fromSplitAces && !opts.resplitAces) return false;
  const pr = pairRank(hand.cards);
  if (pr === 1 && hand.fromSplit && !opts.resplitAces) return false;
  return true;
}

/** Late surrender: first two cards, not after a split, and only before drawing. */
export function canSurrender(
  hand: HandState,
  surrender: "none" | "late",
): boolean {
  if (surrender !== "late") return false;
  if (hand.cards.length !== 2) return false;
  if (hand.fromSplit) return false;
  if (hand.stood || hand.surrendered || hand.doubled) return false;
  return true;
}

export function cloneHand(hand: HandState): HandState {
  return {
    ...hand,
    cards: hand.cards.slice(),
  };
}
