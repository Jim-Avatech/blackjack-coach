import { describe, expect, it } from "vitest";
import { parseCards, parseCard } from "../src/engine/cards";
import type { DealerUp, PlayerAction, TableRules } from "../src/engine/types";
import { DEFAULT_RULES } from "../src/engine/types";
import { getChartSet } from "../src/strategy/charts";
import type { ChartCode, ChartRow } from "../src/strategy/types";
import { bookInsurance, bookPlayFromCards } from "../src/strategy/basic";
import { displayChart } from "../src/strategy/display";
import { explainPlay } from "../src/strategy/explain";
import { emptyHand } from "../src/engine/hand";

const UPS: DealerUp[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1];

function row(s: string): ChartRow {
  // tokens separated by space
  const parts = s.trim().split(/\s+/) as ChartCode[];
  if (parts.length !== 10) throw new Error(`bad row ${s}`);
  return parts as ChartRow;
}

function expectChart(
  actual: Record<number, ChartRow>,
  expected: Record<number, string>,
  label: string,
) {
  for (const [k, s] of Object.entries(expected)) {
    const key = Number(k);
    expect(actual[key], `${label} missing row ${key}`).toBeDefined();
    expect(actual[key], `${label} row ${key}`).toEqual(row(s));
  }
}

describe("raw Wizard of Odds charts (4–8 decks)", () => {
  it("S17 hard / soft / splits", () => {
    const c = getChartSet(6, false);
    expectChart(
      c.hard,
      {
        8: "H H H H H H H H H H",
        9: "H Dh Dh Dh Dh H H H H H",
        10: "Dh Dh Dh Dh Dh Dh Dh Dh H H",
        11: "Dh Dh Dh Dh Dh Dh Dh Dh Dh H",
        12: "H H S S S H H H H H",
        13: "S S S S S H H H H H",
        14: "S S S S S H H H H H",
        15: "S S S S S H H H Rh H",
        16: "S S S S S H H Rh Rh Rh",
        17: "S S S S S S S S S S",
      },
      "4-8 S17 hard",
    );
    expectChart(
      c.soft,
      {
        13: "H H H Dh Dh H H H H H",
        14: "H H H Dh Dh H H H H H",
        15: "H H Dh Dh Dh H H H H H",
        16: "H H Dh Dh Dh H H H H H",
        17: "H Dh Dh Dh Dh H H H H H",
        18: "S Ds Ds Ds Ds S S H H H",
        19: "S S S S S S S S S S",
      },
      "4-8 S17 soft",
    );
    expectChart(
      c.splits,
      {
        2: "Ph Ph P P P P H H H H",
        3: "Ph Ph P P P P H H H H",
        4: "H H H Ph Ph H H H H H",
        6: "Ph P P P P H H H H H",
        7: "P P P P P P H H H H",
        8: "P P P P P P P P P P",
        9: "P P P P P S P P S S",
        1: "P P P P P P P P P P",
      },
      "4-8 S17 splits",
    );
  });

  it("H17 deviations from S17", () => {
    const c = getChartSet(6, true);
    expect(c.hard[11]).toEqual(row("Dh Dh Dh Dh Dh Dh Dh Dh Dh Dh"));
    expect(c.hard[15]).toEqual(row("S S S S S H H H Rh Rh"));
    expect(c.hard[17]).toEqual(row("S S S S S S S S S Rs"));
    expect(c.soft[18]).toEqual(row("Ds Ds Ds Ds Ds S S H H H"));
    expect(c.soft[19]).toEqual(row("S S S S Ds S S S S S"));
    expect(c.splits[8]).toEqual(row("P P P P P P P P P Rp"));
    // unchanged samples
    expect(c.hard[16]).toEqual(row("S S S S S H H Rh Rh Rh"));
    expect(c.hard[9]).toEqual(row("H Dh Dh Dh Dh H H H H H"));
    expect(c.soft[13]).toEqual(row("H H H Dh Dh H H H H H"));
  });
});

describe("raw Wizard of Odds charts (2 decks)", () => {
  it("S17", () => {
    const c = getChartSet(2, false);
    expect(c.hard[9]).toEqual(row("Dh Dh Dh Dh Dh H H H H H"));
    expect(c.hard[11]).toEqual(row("Dh Dh Dh Dh Dh Dh Dh Dh Dh Dh"));
    expect(c.hard[16]).toEqual(row("S S S S S H H H Rh Rh")); // 16 vs 9 is H, not Rh
    expect(c.hard[15]).toEqual(row("S S S S S H H H Rh H"));
    expect(c.splits[6]).toEqual(row("P P P P P Ph H H H H"));
    expect(c.splits[7]).toEqual(row("P P P P P P Ph H H H"));
    expect(c.soft[18]).toEqual(row("S Ds Ds Ds Ds S S H H H"));
  });

  it("H17 deviations", () => {
    const c = getChartSet(2, true);
    expect(c.hard[15]).toEqual(row("S S S S S H H H Rh Rh"));
    expect(c.hard[17]).toEqual(row("S S S S S S S S S Rs"));
    expect(c.soft[14]).toEqual(row("H H Dh Dh Dh H H H H H")); // A,3 vs 4
    expect(c.soft[18]).toEqual(row("Ds Ds Ds Ds Ds S S H H H"));
    expect(c.soft[19]).toEqual(row("S S S S Ds S S S S S"));
    expect(c.splits[8]).toEqual(row("P P P P P P P P P R2"));
  });
});

describe("raw Wizard of Odds charts (1 deck)", () => {
  it("S17", () => {
    const c = getChartSet(1, false);
    expect(c.hard[8]).toEqual(row("H H H Dh Dh H H H H H"));
    expect(c.hard[9]).toEqual(row("Dh Dh Dh Dh Dh H H H H H"));
    expect(c.hard[11]).toEqual(row("Dh Dh Dh Dh Dh Dh Dh Dh Dh Dh"));
    expect(c.hard[15]).toEqual(row("S S S S S H H H H H")); // no surrender 15 vs 10
    expect(c.hard[16]).toEqual(row("S S S S S H H H Rh Rh"));
    expect(c.soft[13]).toEqual(row("H H Dh Dh Dh H H H H H"));
    expect(c.soft[17]).toEqual(row("Dh Dh Dh Dh Dh H H H H H"));
    expect(c.soft[18]).toEqual(row("S Ds Ds Ds Ds S S H H S")); // vs A is S
    expect(c.soft[19]).toEqual(row("S S S S Ds S S S S S"));
    expect(c.splits[2]).toEqual(row("Ph P P P P P H H H H"));
    expect(c.splits[3]).toEqual(row("Ph Ph P P P P Ph H H H"));
    expect(c.splits[4]).toEqual(row("H H Ph Pd Pd H H H H H"));
    expect(c.splits[6]).toEqual(row("P P P P P Ph H H H H"));
    expect(c.splits[7]).toEqual(row("P P P P P P Ph H Rs H"));
  });

  it("H17 deviations", () => {
    const c = getChartSet(1, true);
    expect(c.hard[15]).toEqual(row("S S S S S H H H H Rh"));
    expect(c.hard[17]).toEqual(row("S S S S S S S S S Rs"));
    expect(c.soft[18]).toEqual(row("S Ds Ds Ds Ds S S H H H")); // vs A is H
    expect(c.splits[7]).toEqual(row("P P P P P P Ph H Rs Rh"));
    expect(c.splits[9]).toEqual(row("P P P P P S P P S Ps"));
  });
});

function rules(p: Partial<TableRules> = {}): TableRules {
  return {
    ...DEFAULT_RULES,
    decks: 6,
    hitSoft17: false,
    das: true,
    doubleOn: "any",
    surrender: "late",
    ...p,
  };
}

function play(cards: string, up: DealerUp, r: TableRules = rules()): PlayerAction {
  return bookPlayFromCards(parseCards(cards), up, r).action;
}

describe("resolved book plays — 6-deck S17 DAS late surrender", () => {
  const r = rules();

  it("hard totals", () => {
    expect(play("5h 3c", 6, r)).toBe("hit");
    expect(play("5h 4c", 3, r)).toBe("double");
    expect(play("5h 4c", 2, r)).toBe("hit");
    expect(play("6h 4c", 9, r)).toBe("double");
    expect(play("6h 4c", 10, r)).toBe("hit");
    expect(play("6h 5c", 10, r)).toBe("double");
    expect(play("6h 5c", 1, r)).toBe("hit");
    expect(play("10h 2c", 2, r)).toBe("hit");
    expect(play("10h 2c", 3, r)).toBe("hit");
    expect(play("10h 2c", 4, r)).toBe("stand");
    expect(play("10h 3c", 2, r)).toBe("stand");
    expect(play("10h 6c", 10, r)).toBe("surrender");
    expect(play("10h 6c", 9, r)).toBe("surrender");
    expect(play("10h 6c", 1, r)).toBe("surrender");
    expect(play("10h 5c", 10, r)).toBe("surrender");
    expect(play("10h 5c", 1, r)).toBe("hit");
    expect(play("10h 7c", 1, r)).toBe("stand");
  });

  it("soft totals", () => {
    expect(play("Ah 2c", 5, r)).toBe("double");
    expect(play("Ah 2c", 4, r)).toBe("hit");
    expect(play("Ah 6c", 2, r)).toBe("hit");
    expect(play("Ah 6c", 3, r)).toBe("double");
    expect(play("Ah 7c", 2, r)).toBe("stand");
    expect(play("Ah 7c", 3, r)).toBe("double");
    expect(play("Ah 7c", 8, r)).toBe("stand");
    expect(play("Ah 7c", 9, r)).toBe("hit");
    expect(play("Ah 7c", 1, r)).toBe("hit");
    expect(play("Ah 8c", 6, r)).toBe("stand");
  });

  it("pairs", () => {
    expect(play("Ah As", 1, r)).toBe("split");
    expect(play("8h 8s", 10, r)).toBe("split"); // not surrender
    expect(play("8h 8s", 1, r)).toBe("split");
    expect(play("10h Kd", 6, r)).toBe("stand"); // never split 10s
    expect(play("5h 5s", 6, r)).toBe("double"); // never split 5s, treat as 10
    expect(play("9h 9s", 7, r)).toBe("stand");
    expect(play("9h 9s", 8, r)).toBe("split");
    expect(play("9h 9s", 10, r)).toBe("stand");
    expect(play("4h 4s", 5, r)).toBe("split"); // DAS
    expect(play("2h 2s", 2, r)).toBe("split"); // DAS
    expect(play("6h 6s", 2, r)).toBe("split"); // DAS
    expect(play("6h 6s", 7, r)).toBe("hit");
    expect(play("7h 7s", 8, r)).toBe("hit");
  });

  it("never takes insurance", () => {
    expect(bookInsurance().action).toBe("insurance_no");
  });
});

describe("rule-dependent fallbacks", () => {
  it("no surrender falls back to hit (Rh) or stand (Rs)", () => {
    const noSur = rules({ surrender: "none" });
    expect(play("10h 6c", 10, noSur)).toBe("hit");
    expect(play("10h 6c", 9, noSur)).toBe("hit");
    const h17 = rules({ hitSoft17: true, surrender: "none" });
    expect(play("10h 7c", 1, h17)).toBe("stand"); // Rs
    expect(play("10h 5c", 1, h17)).toBe("hit"); // Rh
  });

  it("no DAS changes 2s, 3s, 4s, 6s", () => {
    const noDas = rules({ das: false });
    expect(play("2h 2s", 2, noDas)).toBe("hit");
    expect(play("2h 2s", 4, noDas)).toBe("split"); // P, not Ph
    expect(play("4h 4s", 5, noDas)).toBe("hit");
    expect(play("6h 6s", 2, noDas)).toBe("hit");
    expect(play("6h 6s", 3, noDas)).toBe("split");
  });

  it("double restricted to 9-11 drops soft doubles and hard 8", () => {
    const d911 = rules({ decks: 1, doubleOn: "9-11" });
    expect(play("Ah 6c", 3, d911)).toBe("hit"); // Dh fallback
    expect(play("Ah 7c", 3, d911)).toBe("stand"); // Ds fallback
    expect(play("6h 2c", 5, d911)).toBe("hit"); // hard 8 Dh fallback
    expect(play("6h 5c", 10, d911)).toBe("double"); // 11 still allowed
  });

  it("3-card hands cannot double, split, or surrender", () => {
    const r = rules();
    // soft 17 (A,2,4) vs 5: chart is Dh for A,6... wait A,2,4 is soft 17, Dh vs 3-6 → hit
    expect(play("Ah 2c 4d", 5, r)).toBe("hit");
    expect(play("Ah 7c 2d", 3, r)).toBe("stand"); // soft 20? A,7,2 = soft 20, stand
    // hard 11 with 3 cards vs 6: would double as 2-card, now hit
    expect(play("2h 3c 6d", 6, r)).toBe("hit");
    // hard 18 3 cards
    expect(play("6h 5c 7d", 10, r)).toBe("stand");
  });

  it("H17 6-deck unique plays", () => {
    const r = rules({ hitSoft17: true });
    expect(play("6h 5c", 1, r)).toBe("double"); // 11 vs A
    expect(play("Ah 7c", 2, r)).toBe("double"); // A,7 vs 2
    expect(play("Ah 8c", 6, r)).toBe("double"); // A,8 vs 6
    expect(play("8h 8s", 1, r)).toBe("surrender"); // Rp
    expect(play("8h 8s", 1, rules({ hitSoft17: true, surrender: "none" }))).toBe("split");
    expect(play("10h 7c", 1, r)).toBe("surrender"); // 17 vs A
    expect(play("10h 5c", 1, r)).toBe("surrender");
  });

  it("2-deck H17 8,8 vs A surrenders only without DAS", () => {
    expect(play("8h 8s", 1, rules({ decks: 2, hitSoft17: true, das: true, surrender: "late" }))).toBe(
      "split",
    );
    expect(
      play("8h 8s", 1, rules({ decks: 2, hitSoft17: true, das: false, surrender: "late" })),
    ).toBe("surrender");
    expect(
      play("8h 8s", 1, rules({ decks: 2, hitSoft17: true, das: false, surrender: "none" })),
    ).toBe("split");
  });

  it("1-deck distinctive plays", () => {
    const r = rules({ decks: 1, hitSoft17: false });
    expect(play("6h 2c", 5, r)).toBe("double"); // 8 vs 5
    expect(play("5h 4c", 2, r)).toBe("double"); // 9 vs 2
    expect(play("Ah 7c", 1, r)).toBe("stand"); // soft 18 vs A
    expect(play("Ah 6c", 2, r)).toBe("double");
    expect(play("Ah 2c", 4, r)).toBe("double");
    expect(play("Ah 8c", 6, r)).toBe("double");
    expect(play("7h 7s", 10, r)).toBe("surrender"); // Rs — surrender else stand
    expect(play("7h 7s", 10, rules({ decks: 1, surrender: "none" }))).toBe("stand");
    expect(play("4h 4s", 5, r)).toBe("split"); // Pd with DAS
    expect(play("4h 4s", 5, rules({ decks: 1, das: false }))).toBe("double"); // Pd fallback
    expect(play("4h 4s", 4, r)).toBe("split"); // Ph with DAS
    expect(play("4h 4s", 4, rules({ decks: 1, das: false }))).toBe("hit");
    // H17
    const h = rules({ decks: 1, hitSoft17: true });
    expect(play("Ah 7c", 1, h)).toBe("hit");
    expect(play("9h 9s", 1, h)).toBe("split"); // Ps with DAS
    expect(play("9h 9s", 1, rules({ decks: 1, hitSoft17: true, das: false }))).toBe("stand");
    expect(play("7h 7s", 1, h)).toBe("surrender"); // Rh
  });
});

describe("4 / 6 / 8 decks share the same total-dependent chart", () => {
  it("matches on a sample of cells", () => {
    for (const d of [4, 6, 8] as const) {
      expect(getChartSet(d, false)).toEqual(getChartSet(6, false));
      expect(getChartSet(d, true)).toEqual(getChartSet(6, true));
    }
  });
});

describe("explanations", () => {
  it("tells you what you did, what the book says, and why", () => {
    const hand = { ...emptyHand(10), cards: parseCards("10h 6c") };
    const book = bookPlayFromCards(hand.cards, 10, rules());
    expect(book.action).toBe("surrender");
    const exp = explainPlay(hand, 10, "hit", book);
    expect(exp.correct).toBe(false);
    expect(exp.body.toLowerCase()).toContain("hit");
    expect(exp.body.toLowerCase()).toContain("surrender");
    expect(exp.body.toLowerCase()).toMatch(/next time/);
    expect(exp.body.length).toBeGreaterThan(80);
  });

  it("is brief and positive when the play is correct", () => {
    const hand = { ...emptyHand(10), cards: parseCards("Ah As") };
    const book = bookPlayFromCards(hand.cards, 10, rules());
    const exp = explainPlay(hand, 10, "split", book);
    expect(exp.correct).toBe(true);
    expect(exp.body.toLowerCase()).toContain("split");
  });
});

describe("display chart respects current rules", () => {
  it("shows hit instead of surrender when surrender is off", () => {
    const withSur = displayChart(rules({ surrender: "late" }));
    const noSur = displayChart(rules({ surrender: "none" }));
    const row16 = withSur.hard.find((r) => r.total === 16)!;
    const row16n = noSur.hard.find((r) => r.total === 16)!;
    // vs 10, which is index 8
    expect(row16.cells[8]!.action).toBe("surrender");
    expect(row16n.cells[8]!.action).toBe("hit");
  });

  it("shows hit instead of split on 4,4 vs 5 when DAS is off", () => {
    const das = displayChart(rules({ das: true }));
    const no = displayChart(rules({ das: false }));
    const fours = (c: typeof das) => c.splits.find((r) => r.pair === 4)!;
    expect(fours(das).cells[3]!.action).toBe("split"); // vs 5
    expect(fours(no).cells[3]!.action).toBe("hit");
  });
});

// silence unused
void parseCard;
void UPS;
