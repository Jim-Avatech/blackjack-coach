import { describe, expect, it } from "vitest";
import { parseCards } from "../src/engine/cards";
import {
  canDouble,
  canSplit,
  canSurrender,
  evaluate,
  isBlackjack,
  isBust,
  isFinished,
  isPair,
  pairRank,
  emptyHand,
} from "../src/engine/hand";
import type { HandState } from "../src/engine/types";

function hand(spec: string, extra: Partial<HandState> = {}): HandState {
  return { ...emptyHand(10), cards: parseCards(spec), ...extra };
}

describe("evaluate", () => {
  it("counts hard totals", () => {
    expect(evaluate(parseCards("10h 7c"))).toEqual({ total: 17, soft: false, softAces: 0 });
    expect(evaluate(parseCards("7h 7c 7s"))).toEqual({ total: 21, soft: false, softAces: 0 });
    expect(evaluate(parseCards("Kh Qd"))).toEqual({ total: 20, soft: false, softAces: 0 });
  });

  it("counts soft totals and reduces aces", () => {
    expect(evaluate(parseCards("Ah 6c"))).toEqual({ total: 17, soft: true, softAces: 1 });
    expect(evaluate(parseCards("Ah As"))).toEqual({ total: 12, soft: true, softAces: 1 });
    expect(evaluate(parseCards("Ah 9c 9d"))).toEqual({ total: 19, soft: false, softAces: 0 });
    expect(evaluate(parseCards("Ah 6c 10d"))).toEqual({ total: 17, soft: false, softAces: 0 });
    expect(evaluate(parseCards("Ah As 9d"))).toEqual({ total: 21, soft: true, softAces: 1 });
    expect(evaluate(parseCards("Ah As Ad Ac"))).toEqual({ total: 14, soft: true, softAces: 1 });
  });

  it("detects busts and blackjack", () => {
    expect(isBust(parseCards("10h 10c 5d"))).toBe(true);
    expect(isBust(parseCards("Ah 10c 10d"))).toBe(false);
    expect(isBlackjack(hand("Ah Jh"))).toBe(true);
    expect(isBlackjack(hand("Ah Jh", { fromSplit: true }))).toBe(false);
    expect(isBlackjack(hand("Ah 5c 5d"))).toBe(false);
    expect(isBlackjack(hand("Ah 10c"))).toBe(true);
    expect(isFinished(hand("Ah Jh"))).toBe(true);
    expect(isFinished(hand("10h 10c 5d"))).toBe(true);
  });

  it("detects pairs including mixed 10-value cards", () => {
    expect(isPair(parseCards("8h 8c"))).toBe(true);
    expect(isPair(parseCards("Ah As"))).toBe(true);
    expect(isPair(parseCards("10h Kd"))).toBe(true);
    expect(isPair(parseCards("Jh Qd"))).toBe(true);
    expect(isPair(parseCards("8h 7c"))).toBe(false);
    expect(pairRank(parseCards("Ah As"))).toBe(1);
    expect(pairRank(parseCards("10h Kd"))).toBe(10);
  });
});

describe("legal actions", () => {
  const bank = { das: true, doubleOn: "any" as const, hitSplitAces: false, bankroll: 100 };

  it("doubles only on two cards with enough bankroll", () => {
    expect(canDouble(hand("9h 2c"), bank)).toBe(true);
    expect(canDouble(hand("9h 2c 3d"), bank)).toBe(false);
    expect(canDouble(hand("9h 2c"), { ...bank, bankroll: 5 })).toBe(false);
    expect(canDouble(hand("Ah 7c"), { ...bank, doubleOn: "9-11" })).toBe(false);
    expect(canDouble(hand("8h 3c"), { ...bank, doubleOn: "9-11" })).toBe(true);
    expect(canDouble(hand("6h 2c"), { ...bank, doubleOn: "9-11" })).toBe(false);
    expect(canDouble(hand("8h 2c"), { ...bank, doubleOn: "10-11" })).toBe(true);
    expect(canDouble(hand("6h 3c"), { ...bank, doubleOn: "10-11" })).toBe(false);
    expect(canDouble(hand("9h 2c", { fromSplit: true }), { ...bank, das: false })).toBe(false);
    expect(canDouble(hand("9h 2c", { fromSplit: true }), { ...bank, das: true })).toBe(true);
  });

  it("splits pairs with max-hands and resplit-aces rules", () => {
    const opts = { das: true, resplitAces: false, maxHands: 4 as const, currentHands: 1, bankroll: 100 };
    expect(canSplit(hand("8h 8c"), opts)).toBe(true);
    expect(canSplit(hand("Ah As"), opts)).toBe(true);
    expect(canSplit(hand("Ah As", { fromSplitAces: true }), opts)).toBe(false);
    expect(canSplit(hand("Ah As", { fromSplitAces: true }), { ...opts, resplitAces: true })).toBe(
      true,
    );
    expect(canSplit(hand("8h 8c"), { ...opts, currentHands: 4 })).toBe(false);
    expect(canSplit(hand("8h 7c"), opts)).toBe(false);
  });

  it("surrenders only late, first two, not after split", () => {
    expect(canSurrender(hand("10h 6c"), "late")).toBe(true);
    expect(canSurrender(hand("10h 6c"), "none")).toBe(false);
    expect(canSurrender(hand("10h 6c", { fromSplit: true }), "late")).toBe(false);
    expect(canSurrender(hand("10h 5c 2d"), "late")).toBe(false);
  });
});
