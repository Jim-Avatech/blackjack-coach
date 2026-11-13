import { makeCard } from "../engine/cards";
import type { DealerUp, PlayerAction, Rank, Suit, TableRules } from "../engine/types";
import { bookPlayFromCards } from "./basic";

const UP_ORDER: DealerUp[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1];

function upCard(up: DealerUp) {
  const rank: Rank = up === 1 ? "A" : up === 10 ? "10" : (String(up) as Rank);
  return makeCard(rank, "spades", `up-${up}`);
}

function twoCards(a: Rank, b: Rank, suitA: Suit = "hearts", suitB: Suit = "clubs") {
  return [makeCard(a, suitA, `p-${a}`), makeCard(b, suitB, `p-${b}`)];
}

const RANK_BY_VAL: Record<number, Rank> = {
  1: "A",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
};

/** Build a hard total with no ace, using 10 + remainder when possible (2 cards). */
function hardCards(total: number) {
  if (total <= 11) {
    // 5–8 use 2+n, 9 uses 2+7, 10 uses 5+5 (but 5,5 is a pair — use 6+4), 11 uses 6+5
    if (total === 10) return twoCards("6", "4");
    if (total === 11) return twoCards("6", "5");
    if (total === 9) return twoCards("6", "3");
    if (total === 8) return twoCards("6", "2");
    if (total === 7) return twoCards("5", "2");
    if (total === 6) return twoCards("4", "2");
    if (total === 5) return twoCards("3", "2");
    return twoCards("2", "2");
  }
  // 12–20: 10 + (total-10)
  const rest = total - 10;
  return twoCards("10", RANK_BY_VAL[rest] ?? "2");
}

function softCards(total: number) {
  // A + (total-11)
  const rest = total - 11;
  return twoCards("A", RANK_BY_VAL[rest] ?? "2");
}

function pairCards(pr: number) {
  const r = RANK_BY_VAL[pr] ?? "8";
  return twoCards(r, r);
}

export interface ChartCell {
  action: PlayerAction;
  code: string;
}

export interface DisplayChart {
  hard: { total: number; cells: ChartCell[] }[];
  soft: { total: number; label: string; cells: ChartCell[] }[];
  splits: { pair: number; label: string; cells: ChartCell[] }[];
  ups: DealerUp[];
}

export function displayChart(rules: TableRules): DisplayChart {
  const hardTotals = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  // include 8 only when it can deviate (single deck)
  const hard = (rules.decks === 1 ? [8, ...hardTotals.slice(1)] : hardTotals).map((total) => ({
    total,
    cells: UP_ORDER.map((up) => {
      const book = bookPlayFromCards(hardCards(total), up, rules);
      return { action: book.action, code: book.code };
    }),
  }));

  const soft = [13, 14, 15, 16, 17, 18, 19].map((total) => ({
    total,
    label: `A,${total - 11}`,
    cells: UP_ORDER.map((up) => {
      const book = bookPlayFromCards(softCards(total), up, rules);
      return { action: book.action, code: book.code };
    }),
  }));

  const splits = [1, 2, 3, 4, 6, 7, 8, 9].map((pr) => ({
    pair: pr,
    label: pr === 1 ? "A,A" : `${pr},${pr}`,
    cells: UP_ORDER.map((up) => {
      const book = bookPlayFromCards(pairCards(pr), up, rules);
      return { action: book.action, code: book.code };
    }),
  }));

  return { hard, soft, splits, ups: UP_ORDER };
}

export { UP_ORDER, hardCards, softCards, pairCards, upCard };
