import { describe, expect, it } from "vitest";
import { parseCards } from "../src/engine/cards";
import { emptyHand } from "../src/engine/hand";
import { blackjackMultiplier, settleHand, settleInsurance } from "../src/engine/payouts";
import {
  evaluatePerfectPairs,
  evaluateTwentyOnePlusThree,
  sideBetNet,
} from "../src/engine/sidebets";
import type { HandState } from "../src/engine/types";

function H(spec: string, extra: Partial<HandState> = {}): HandState {
  return { ...emptyHand(10), cards: parseCards(spec), ...extra };
}

describe("main-bet payouts", () => {
  const r32 = { blackjackPayout: "3:2" as const };
  const r65 = { blackjackPayout: "6:5" as const };

  it("pays 3:2 and 6:5 blackjack only on unsplit two-card 21", () => {
    expect(blackjackMultiplier("3:2")).toBe(1.5);
    expect(blackjackMultiplier("6:5")).toBe(1.2);
    expect(settleHand(H("Ah Jh"), { cards: parseCards("10d 8c") }, r32)).toMatchObject({
      outcome: "blackjack",
      net: 15,
    });
    expect(settleHand(H("Ah Jh"), { cards: parseCards("10d 8c") }, r65)).toMatchObject({
      outcome: "blackjack",
      net: 12,
    });
    expect(
      settleHand(H("Ah Jh", { fromSplit: true }), { cards: parseCards("10d 8c") }, r32),
    ).toMatchObject({ outcome: "win", net: 10 });
    expect(settleHand(H("Ah 5c 5d"), { cards: parseCards("10d 8c") }, r32)).toMatchObject({
      outcome: "win",
      net: 10,
    });
  });

  it("pushes two blackjacks and player BJ vs dealer BJ", () => {
    expect(settleHand(H("Ah Jh"), { cards: parseCards("Ad 10c") }, r32)).toMatchObject({
      outcome: "push",
      net: 0,
    });
  });

  it("handles wins, losses, busts, pushes, doubles, surrenders", () => {
    expect(settleHand(H("10h 9c"), { cards: parseCards("10d 7c") }, r32)).toMatchObject({
      outcome: "win",
      net: 10,
    });
    expect(settleHand(H("10h 8c"), { cards: parseCards("10d 9c") }, r32)).toMatchObject({
      outcome: "lose",
      net: -10,
    });
    expect(settleHand(H("10h 8c"), { cards: parseCards("10d 8s") }, r32)).toMatchObject({
      outcome: "push",
      net: 0,
    });
    expect(settleHand(H("10h 10c 5d"), { cards: parseCards("10d 6c") }, r32)).toMatchObject({
      outcome: "bust",
      net: -10,
    });
    expect(settleHand(H("10h 8c"), { cards: parseCards("10d 6c 8s") }, r32)).toMatchObject({
      outcome: "dealer_bust",
      net: 10,
    });
    expect(
      settleHand(H("9h 2c 10d", { doubled: true, bet: 20 }), { cards: parseCards("10d 7c") }, r32),
    ).toMatchObject({ outcome: "win", net: 20 });
    expect(settleHand(H("10h 6c", { surrendered: true }), { cards: parseCards("Ad 10c") }, r32)).toMatchObject({
      outcome: "surrender",
      net: -5,
    });
  });

  it("settles insurance at 2:1", () => {
    expect(settleInsurance(5, true)).toBe(10);
    expect(settleInsurance(5, false)).toBe(-5);
    expect(settleInsurance(0, true)).toBe(0);
  });
});

describe("Perfect Pairs", () => {
  it("pays perfect, colored, and mixed, and nothing otherwise", () => {
    expect(evaluatePerfectPairs(parseCards("Ah As"))).toEqual({ kind: "mixed", payout: 6 });
    expect(evaluatePerfectPairs(parseCards("Ah Ad"))).toEqual({ kind: "colored", payout: 12 });
    expect(evaluatePerfectPairs(parseCards("Ah 2h"))).toBeNull();
    // Perfect: same rank same suit — only possible with multiple decks.
    const a = parseCards("Ah")[0]!;
    const b = { ...parseCards("Ah")[0]!, id: "other" };
    expect(evaluatePerfectPairs([a, b])).toEqual({ kind: "perfect", payout: 25 });
    expect(sideBetNet(10, evaluatePerfectPairs([a, b]))).toBe(250);
    expect(sideBetNet(10, null)).toBe(-10);
  });
});

describe("21+3", () => {
  it("detects flush, straight, trips, straight flush, suited trips", () => {
    // flush: 2h 7h + 9h
    expect(evaluateTwentyOnePlusThree(parseCards("2h 7h"), parseCards("9h")[0]!)).toEqual({
      kind: "flush",
      payout: 5,
    });
    // straight: 2h 3c + 4d
    expect(evaluateTwentyOnePlusThree(parseCards("2h 3c"), parseCards("4d")[0]!)).toEqual({
      kind: "straight",
      payout: 10,
    });
    // A-2-3 straight
    expect(evaluateTwentyOnePlusThree(parseCards("Ah 2c"), parseCards("3d")[0]!)).toEqual({
      kind: "straight",
      payout: 10,
    });
    // Q-K-A straight
    expect(evaluateTwentyOnePlusThree(parseCards("Qh Kc"), parseCards("Ad")[0]!)).toEqual({
      kind: "straight",
      payout: 10,
    });
    // K-A-2 is NOT a straight
    expect(evaluateTwentyOnePlusThree(parseCards("Kh Ac"), parseCards("2d")[0]!)).toBeNull();
    // trips
    expect(evaluateTwentyOnePlusThree(parseCards("7h 7c"), parseCards("7d")[0]!)).toEqual({
      kind: "trips",
      payout: 30,
    });
    // straight flush
    expect(evaluateTwentyOnePlusThree(parseCards("5h 6h"), parseCards("7h")[0]!)).toEqual({
      kind: "straightFlush",
      payout: 40,
    });
    // suited trips (multi-deck)
    const t1 = parseCards("9h")[0]!;
    const t2 = { ...parseCards("9h")[0]!, id: "b" };
    const t3 = { ...parseCards("9h")[0]!, id: "c" };
    expect(evaluateTwentyOnePlusThree([t1, t2], t3)).toEqual({
      kind: "suitedTrips",
      payout: 100,
    });
    // nothing
    expect(evaluateTwentyOnePlusThree(parseCards("2h 8c"), parseCards("Kd")[0]!)).toBeNull();
  });
});
