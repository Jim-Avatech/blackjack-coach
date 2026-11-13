/**
 * Total-dependent basic strategy charts from Wizard of Odds
 * (wizardofodds.com/games/blackjack/strategy/), transcribed from the
 * published 1-deck, 2-deck, and 4–8-deck H17 and S17 images.
 *
 * Insurance is never taken (taught separately).
 * 5,5 and 10,10 are not on the split charts — play them as hard 10 / 20.
 */
import type { ChartRow, DeckGroup } from "./types";

export type ChartSet = {
  hard: Record<number, ChartRow>;
  soft: Record<number, ChartRow>; // key is soft total (13–20)
  splits: Record<number, ChartRow>; // key is pair rank (1=A, 2–9; no 5 or 10)
};

function r(
  a: string,
  b: string,
  c: string,
  d: string,
  e: string,
  f: string,
  g: string,
  h: string,
  i: string,
  j: string,
): ChartRow {
  return [a, b, c, d, e, f, g, h, i, j] as ChartRow;
}

const H = "H" as const;
const S = "S" as const;

/** Fill hard 4–8 (or 4–7) as all hits, 18+/17+ as all stands when not specified. */
function allH(): ChartRow {
  return r(H, H, H, H, H, H, H, H, H, H);
}
function allS(): ChartRow {
  return r(S, S, S, S, S, S, S, S, S, S);
}
function allP(): ChartRow {
  return r("P", "P", "P", "P", "P", "P", "P", "P", "P", "P");
}

/* ------------------------------------------------------------------ */
/* 4–8 decks, dealer stands on soft 17                                  */
/* ------------------------------------------------------------------ */
const HARD_4_S17: Record<number, ChartRow> = {
  4: allH(),
  5: allH(),
  6: allH(),
  7: allH(),
  8: allH(),
  9: r("H", "Dh", "Dh", "Dh", "Dh", "H", "H", "H", "H", "H"),
  10: r("Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "H", "H"),
  11: r("Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "H"),
  12: r("H", "H", "S", "S", "S", "H", "H", "H", "H", "H"),
  13: r("S", "S", "S", "S", "S", "H", "H", "H", "H", "H"),
  14: r("S", "S", "S", "S", "S", "H", "H", "H", "H", "H"),
  15: r("S", "S", "S", "S", "S", "H", "H", "H", "Rh", "H"),
  16: r("S", "S", "S", "S", "S", "H", "H", "Rh", "Rh", "Rh"),
  17: allS(),
  18: allS(),
  19: allS(),
  20: allS(),
  21: allS(),
};

const SOFT_4_S17: Record<number, ChartRow> = {
  13: r("H", "H", "H", "Dh", "Dh", "H", "H", "H", "H", "H"),
  14: r("H", "H", "H", "Dh", "Dh", "H", "H", "H", "H", "H"),
  15: r("H", "H", "Dh", "Dh", "Dh", "H", "H", "H", "H", "H"),
  16: r("H", "H", "Dh", "Dh", "Dh", "H", "H", "H", "H", "H"),
  17: r("H", "Dh", "Dh", "Dh", "Dh", "H", "H", "H", "H", "H"),
  18: r("S", "Ds", "Ds", "Ds", "Ds", "S", "S", "H", "H", "H"),
  19: allS(),
  20: allS(),
  21: allS(),
};

const SPLIT_4_S17: Record<number, ChartRow> = {
  2: r("Ph", "Ph", "P", "P", "P", "P", "H", "H", "H", "H"),
  3: r("Ph", "Ph", "P", "P", "P", "P", "H", "H", "H", "H"),
  4: r("H", "H", "H", "Ph", "Ph", "H", "H", "H", "H", "H"),
  6: r("Ph", "P", "P", "P", "P", "H", "H", "H", "H", "H"),
  7: r("P", "P", "P", "P", "P", "P", "H", "H", "H", "H"),
  8: allP(),
  9: r("P", "P", "P", "P", "P", "S", "P", "P", "S", "S"),
  1: allP(),
};

/* ------------------------------------------------------------------ */
/* 4–8 decks, dealer hits soft 17                                       */
/* ------------------------------------------------------------------ */
const HARD_4_H17: Record<number, ChartRow> = {
  ...HARD_4_S17,
  11: r("Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh"),
  15: r("S", "S", "S", "S", "S", "H", "H", "H", "Rh", "Rh"),
  17: r("S", "S", "S", "S", "S", "S", "S", "S", "S", "Rs"),
};

const SOFT_4_H17: Record<number, ChartRow> = {
  ...SOFT_4_S17,
  18: r("Ds", "Ds", "Ds", "Ds", "Ds", "S", "S", "H", "H", "H"),
  19: r("S", "S", "S", "S", "Ds", "S", "S", "S", "S", "S"),
};

const SPLIT_4_H17: Record<number, ChartRow> = {
  ...SPLIT_4_S17,
  8: r("P", "P", "P", "P", "P", "P", "P", "P", "P", "Rp"),
};

/* ------------------------------------------------------------------ */
/* 2 decks, S17                                                         */
/* ------------------------------------------------------------------ */
const HARD_2_S17: Record<number, ChartRow> = {
  ...HARD_4_S17,
  9: r("Dh", "Dh", "Dh", "Dh", "Dh", "H", "H", "H", "H", "H"),
  11: r("Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh"),
  16: r("S", "S", "S", "S", "S", "H", "H", "H", "Rh", "Rh"),
};

const SOFT_2_S17: Record<number, ChartRow> = { ...SOFT_4_S17 };

const SPLIT_2_S17: Record<number, ChartRow> = {
  2: r("Ph", "Ph", "P", "P", "P", "P", "H", "H", "H", "H"),
  3: r("Ph", "Ph", "P", "P", "P", "P", "H", "H", "H", "H"),
  4: r("H", "H", "H", "Ph", "Ph", "H", "H", "H", "H", "H"),
  6: r("P", "P", "P", "P", "P", "Ph", "H", "H", "H", "H"),
  7: r("P", "P", "P", "P", "P", "P", "Ph", "H", "H", "H"),
  8: allP(),
  9: r("P", "P", "P", "P", "P", "S", "P", "P", "S", "S"),
  1: allP(),
};

/* ------------------------------------------------------------------ */
/* 2 decks, H17                                                         */
/* ------------------------------------------------------------------ */
const HARD_2_H17: Record<number, ChartRow> = {
  ...HARD_2_S17,
  15: r("S", "S", "S", "S", "S", "H", "H", "H", "Rh", "Rh"),
  17: r("S", "S", "S", "S", "S", "S", "S", "S", "S", "Rs"),
};

const SOFT_2_H17: Record<number, ChartRow> = {
  ...SOFT_2_S17,
  14: r("H", "H", "Dh", "Dh", "Dh", "H", "H", "H", "H", "H"), // A,3 vs 4 = Dh
  18: r("Ds", "Ds", "Ds", "Ds", "Ds", "S", "S", "H", "H", "H"),
  19: r("S", "S", "S", "S", "Ds", "S", "S", "S", "S", "S"),
};

const SPLIT_2_H17: Record<number, ChartRow> = {
  ...SPLIT_2_S17,
  8: r("P", "P", "P", "P", "P", "P", "P", "P", "P", "R2"),
};

/* ------------------------------------------------------------------ */
/* 1 deck, S17                                                          */
/* ------------------------------------------------------------------ */
const HARD_1_S17: Record<number, ChartRow> = {
  4: allH(),
  5: allH(),
  6: allH(),
  7: allH(),
  8: r("H", "H", "H", "Dh", "Dh", "H", "H", "H", "H", "H"),
  9: r("Dh", "Dh", "Dh", "Dh", "Dh", "H", "H", "H", "H", "H"),
  10: r("Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "H", "H"),
  11: r("Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh", "Dh"),
  12: r("H", "H", "S", "S", "S", "H", "H", "H", "H", "H"),
  13: r("S", "S", "S", "S", "S", "H", "H", "H", "H", "H"),
  14: r("S", "S", "S", "S", "S", "H", "H", "H", "H", "H"),
  15: r("S", "S", "S", "S", "S", "H", "H", "H", "H", "H"),
  16: r("S", "S", "S", "S", "S", "H", "H", "H", "Rh", "Rh"),
  17: allS(),
  18: allS(),
  19: allS(),
  20: allS(),
  21: allS(),
};

const SOFT_1_S17: Record<number, ChartRow> = {
  13: r("H", "H", "Dh", "Dh", "Dh", "H", "H", "H", "H", "H"),
  14: r("H", "H", "Dh", "Dh", "Dh", "H", "H", "H", "H", "H"),
  15: r("H", "H", "Dh", "Dh", "Dh", "H", "H", "H", "H", "H"),
  16: r("H", "H", "Dh", "Dh", "Dh", "H", "H", "H", "H", "H"),
  17: r("Dh", "Dh", "Dh", "Dh", "Dh", "H", "H", "H", "H", "H"),
  18: r("S", "Ds", "Ds", "Ds", "Ds", "S", "S", "H", "H", "S"),
  19: r("S", "S", "S", "S", "Ds", "S", "S", "S", "S", "S"),
  20: allS(),
  21: allS(),
};

const SPLIT_1_S17: Record<number, ChartRow> = {
  2: r("Ph", "P", "P", "P", "P", "P", "H", "H", "H", "H"),
  3: r("Ph", "Ph", "P", "P", "P", "P", "Ph", "H", "H", "H"),
  4: r("H", "H", "Ph", "Pd", "Pd", "H", "H", "H", "H", "H"),
  6: r("P", "P", "P", "P", "P", "Ph", "H", "H", "H", "H"),
  7: r("P", "P", "P", "P", "P", "P", "Ph", "H", "Rs", "H"),
  8: allP(),
  9: r("P", "P", "P", "P", "P", "S", "P", "P", "S", "S"),
  1: allP(),
};

/* ------------------------------------------------------------------ */
/* 1 deck, H17                                                          */
/* ------------------------------------------------------------------ */
const HARD_1_H17: Record<number, ChartRow> = {
  ...HARD_1_S17,
  15: r("S", "S", "S", "S", "S", "H", "H", "H", "H", "Rh"),
  17: r("S", "S", "S", "S", "S", "S", "S", "S", "S", "Rs"),
};

const SOFT_1_H17: Record<number, ChartRow> = {
  ...SOFT_1_S17,
  18: r("S", "Ds", "Ds", "Ds", "Ds", "S", "S", "H", "H", "H"), // vs A is H (S17 is S)
};

const SPLIT_1_H17: Record<number, ChartRow> = {
  ...SPLIT_1_S17,
  7: r("P", "P", "P", "P", "P", "P", "Ph", "H", "Rs", "Rh"),
  9: r("P", "P", "P", "P", "P", "S", "P", "P", "S", "Ps"),
};

const CHARTS: Record<DeckGroup, { s17: ChartSet; h17: ChartSet }> = {
  1: {
    s17: { hard: HARD_1_S17, soft: SOFT_1_S17, splits: SPLIT_1_S17 },
    h17: { hard: HARD_1_H17, soft: SOFT_1_H17, splits: SPLIT_1_H17 },
  },
  2: {
    s17: { hard: HARD_2_S17, soft: SOFT_2_S17, splits: SPLIT_2_S17 },
    h17: { hard: HARD_2_H17, soft: SOFT_2_H17, splits: SPLIT_2_H17 },
  },
  4: {
    s17: { hard: HARD_4_S17, soft: SOFT_4_S17, splits: SPLIT_4_S17 },
    h17: { hard: HARD_4_H17, soft: SOFT_4_H17, splits: SPLIT_4_H17 },
  },
};

export function getChartSet(decks: number, hitSoft17: boolean): ChartSet {
  const g: DeckGroup = decks <= 1 ? 1 : decks === 2 ? 2 : 4;
  return hitSoft17 ? CHARTS[g].h17 : CHARTS[g].s17;
}

export { CHARTS };
