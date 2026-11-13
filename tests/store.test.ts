import { afterEach, describe, expect, it } from "vitest";
import { parseCards } from "../src/engine/cards";
import { emptyHand } from "../src/engine/hand";
import { DEFAULT_RULES } from "../src/engine/types";
import { spotLabel, youBookLine } from "../src/strategy/explain";
import {
  accuracy,
  dealerKey,
  emptyStats,
  load,
  migrateStats,
  recordDecision,
  recordRound,
  resultsCounted,
  save,
  type Stats,
} from "../src/store";

function memoryStorage() {
  const mem: Record<string, string> = {};
  const storage = {
    getItem: (k: string) => (k in mem ? mem[k]! : null),
    setItem: (k: string, v: string) => {
      mem[k] = v;
    },
    removeItem: (k: string) => {
      delete mem[k];
    },
    clear: () => {
      for (const k of Object.keys(mem)) delete mem[k];
    },
    key: (i: number) => Object.keys(mem)[i] ?? null,
    get length() {
      return Object.keys(mem).length;
    },
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  return storage;
}

afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* no storage */
  }
});

describe("accuracy", () => {
  it("is correct decisions / total decisions, rounded, and null when none", () => {
    expect(accuracy({ decisions: 0, correct: 0 })).toBeNull();
    expect(accuracy({ decisions: 31, correct: 22 })).toBe(71);
    expect(accuracy({ decisions: 3, correct: 2 })).toBe(67);
    expect(accuracy({ decisions: 1, correct: 0 })).toBe(0);
    expect(accuracy({ decisions: 1, correct: 1 })).toBe(100);
  });
});

describe("recordDecision", () => {
  it("counts every decision, grows a streak on correct, and breaks it on a miss", () => {
    let s = emptyStats();
    s = recordDecision(s, "hard", true);
    s = recordDecision(s, "hard", true);
    s = recordDecision(s, "soft", true);
    expect(s.decisions).toBe(3);
    expect(s.correct).toBe(3);
    expect(s.streak).toBe(3);
    expect(s.bestStreak).toBe(3);
    expect(s.byKind.hard).toEqual({ decisions: 2, correct: 2 });
    expect(s.byKind.soft).toEqual({ decisions: 1, correct: 1 });

    s = recordDecision(s, "pair", false, {
      spot: "Pair of 8s vs 10",
      you: "stand",
      book: "split",
      why: "Always split 8s.",
      dealerUp: 10,
    });
    expect(s.correct).toBe(3);
    expect(s.decisions).toBe(4);
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBe(3);
    expect(s.byKind.pair).toEqual({ decisions: 1, correct: 0 });
    expect(s.mistakes).toHaveLength(1);
    expect(s.mistakes[0]!.spot).toBe("Pair of 8s vs 10");
    expect(s.mistakes[0]!.you).toBe("stand");
    expect(s.mistakes[0]!.book).toBe("split");
    expect(s.byDealer["10"]).toEqual({ decisions: 1, correct: 0 });

    s = recordDecision(s, "hard", true, { spot: "Hard 12 vs 3", you: "hit", book: "hit", why: "", dealerUp: 3 });
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(3);
    expect(s.byDealer["3"]).toEqual({ decisions: 1, correct: 1 });
  });

  it("keeps only the 10 most recent mistakes, newest first", () => {
    let s = emptyStats();
    for (let i = 0; i < 12; i++) {
      s = recordDecision(s, "hard", false, {
        spot: `Hard ${12 + (i % 5)} vs ${2 + (i % 9)}`,
        you: "stand",
        book: "hit",
        why: `why ${i}`,
        dealerUp: 2 + (i % 9),
      });
    }
    expect(s.mistakes).toHaveLength(10);
    expect(s.mistakes[0]!.why).toBe("why 11");
    expect(s.mistakes[9]!.why).toBe("why 2");
    expect(s.decisions).toBe(12);
    expect(s.correct).toBe(0);
  });

  it("does not record a mistake on a correct play", () => {
    let s = emptyStats();
    s = recordDecision(s, "insurance", true, {
      spot: "Insurance vs A",
      you: "insurance_no",
      book: "insurance_no",
      why: "",
      dealerUp: 1,
    });
    expect(s.mistakes).toHaveLength(0);
    expect(s.byDealer.A).toEqual({ decisions: 1, correct: 1 });
    expect(s.byKind.insurance).toEqual({ decisions: 1, correct: 1 });
  });
});

describe("recordRound", () => {
  it("tracks hands, net chips, and win/loss/push including splits", () => {
    let s = emptyStats(1000);
    s = recordRound(s, { net: 20, outcomes: ["win"], bankroll: 1020 });
    s = recordRound(s, { net: -10, outcomes: ["bust"], bankroll: 1010 });
    s = recordRound(s, { net: 0, outcomes: ["push"], bankroll: 1010 });
    s = recordRound(s, { net: 15, outcomes: ["blackjack"], bankroll: 1025 });
    s = recordRound(s, { net: 10, outcomes: ["win", "dealer_bust"], bankroll: 1035 });
    expect(s.handsPlayed).toBe(5);
    expect(s.netChips).toBe(35);
    expect(s.highBankroll).toBe(1035);
    expect(s.results.wins).toBe(4); // win, blackjack, win, dealer_bust
    expect(s.results.losses).toBe(1);
    expect(s.results.pushes).toBe(1);
    expect(s.results.blackjacks).toBe(1);
    expect(s.results.busts).toBe(1);
    expect(s.results.dealerBusts).toBe(1);
    expect(resultsCounted(s.results)).toBe(6);
  });
});

describe("migrateStats", () => {
  it("keeps existing accuracy and streaks, filling new fields", () => {
    const old = {
      handsPlayed: 12,
      decisions: 31,
      correct: 22,
      streak: 4,
      bestStreak: 9,
      byKind: {
        hard: { decisions: 20, correct: 15 },
        soft: { decisions: 6, correct: 4 },
        pair: { decisions: 4, correct: 3 },
        surrender: { decisions: 1, correct: 0 },
        insurance: { decisions: 0, correct: 0 },
      },
      netChips: 80,
      highBankroll: 1200,
    };
    const s = migrateStats(old, 990);
    expect(s.decisions).toBe(31);
    expect(s.correct).toBe(22);
    expect(s.streak).toBe(4);
    expect(s.bestStreak).toBe(9);
    expect(s.handsPlayed).toBe(12);
    expect(s.netChips).toBe(80);
    expect(s.highBankroll).toBe(1200);
    expect(s.byKind.hard).toEqual({ decisions: 20, correct: 15 });
    expect(s.byKind.surrender).toEqual({ decisions: 1, correct: 0 });
    expect(s.mistakes).toEqual([]);
    expect(s.results.wins).toBe(0);
    expect(s.byDealer["10"].decisions).toBe(0);
    expect(s.byDealer.A.correct).toBe(0);
  });

  it("survives missing or partial byKind and junk values", () => {
    const s = migrateStats({ decisions: 5, correct: "nope", byKind: { hard: { decisions: 5 } } });
    expect(s.decisions).toBe(5);
    expect(s.correct).toBe(0);
    expect(s.byKind.hard).toEqual({ decisions: 5, correct: 0 });
    expect(s.byKind.soft).toEqual({ decisions: 0, correct: 0 });
    expect(s.mistakes).toEqual([]);
  });
});

describe("load/save", () => {
  it("migrates a v1 localStorage blob without wiping counts", () => {
    memoryStorage();
    localStorage.setItem(
      "bj-coach-v1",
      JSON.stringify({
        rules: { ...DEFAULT_RULES },
        bankroll: 990,
        stats: {
          handsPlayed: 8,
          decisions: 10,
          correct: 7,
          streak: 2,
          bestStreak: 5,
          byKind: {
            hard: { decisions: 8, correct: 6 },
            soft: { decisions: 2, correct: 1 },
            pair: { decisions: 0, correct: 0 },
            surrender: { decisions: 0, correct: 0 },
            insurance: { decisions: 0, correct: 0 },
          },
          netChips: -20,
          highBankroll: 1000,
        },
        seenHelp: true,
        pendingBet: 10,
      }),
    );
    const p = load();
    expect(p.stats.decisions).toBe(10);
    expect(p.stats.correct).toBe(7);
    expect(p.stats.streak).toBe(2);
    expect(p.stats.mistakes).toEqual([]);
    expect(p.stats.results.losses).toBe(0);
    expect(p.seenHelp).toBe(true);
    expect(p.bankroll).toBe(990);

    const next: Stats = recordDecision(p.stats, "hard", false, {
      spot: "Hard 16 vs 10",
      you: "stand",
      book: "hit",
      why: "Hit stiff 16 vs 10.",
      dealerUp: 10,
    });
    save({ ...p, stats: next });
    const again = load();
    expect(again.stats.decisions).toBe(11);
    expect(again.stats.correct).toBe(7);
    expect(again.stats.mistakes).toHaveLength(1);
    expect(again.stats.mistakes[0]!.spot).toBe("Hard 16 vs 10");
  });
});

describe("dealerKey", () => {
  it("maps ace and tens", () => {
    expect(dealerKey(1)).toBe("A");
    expect(dealerKey(11)).toBe("A");
    expect(dealerKey(10)).toBe("10");
    expect(dealerKey(13)).toBe("10");
    expect(dealerKey(7)).toBe("7");
  });
});

describe("spot labels", () => {
  const hand = (spec: string) => ({ ...emptyHand(10), cards: parseCards(spec) });

  it("names hard, soft, pair, and insurance spots in plain words", () => {
    expect(spotLabel(hand("10h 2c"), 3, "hard")).toBe("Hard 12 vs 3");
    expect(spotLabel(hand("Ah 7c"), 9, "soft")).toBe("Soft 18 vs 9");
    expect(spotLabel(hand("8h 8c"), 10, "pair")).toBe("Pair of 8s vs 10");
    expect(spotLabel(hand("Ah As"), 1, "pair")).toBe("Pair of Aces vs A");
    expect(spotLabel(hand("Kh Qd"), 6, "pair")).toBe("Pair of 10s vs 6");
    expect(spotLabel(hand("Ah 10c"), 1, "insurance")).toBe("Insurance vs A");
    expect(spotLabel(hand("10h 6c"), 10, "surrender")).toBe("Hard 16 vs 10");
  });

  it("writes the recent-mistake line the way the panel shows it", () => {
    expect(youBookLine("stand", "hit")).toBe("you stood, book says hit");
    expect(youBookLine("hit", "stand")).toBe("you hit, book says stand");
    expect(youBookLine("insurance_yes", "insurance_no")).toBe(
      "you took insurance, book says refuse insurance",
    );
  });
});
