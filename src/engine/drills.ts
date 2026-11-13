import { makeCard, RANKS, dealerUpValue } from "./cards";
import type { Card, Rank, Suit, TableRules } from "./types";
import { bookPlayFromCards } from "../strategy/basic";

/**
 * Tricky spots people commonly miss. Drill mode deals one of these,
 * biased toward decisions that aren't obvious (not "always stand 20").
 */
export interface DrillSpot {
  player: [Rank, Rank];
  dealer: Rank;
  tag: "hard" | "soft" | "pair" | "insurance";
  note: string;
}

export const DRILL_SPOTS: DrillSpot[] = [
  { player: ["10", "2"], dealer: "2", tag: "hard", note: "12 vs 2" },
  { player: ["10", "2"], dealer: "3", tag: "hard", note: "12 vs 3" },
  { player: ["10", "2"], dealer: "4", tag: "hard", note: "12 vs 4" },
  { player: ["10", "3"], dealer: "2", tag: "hard", note: "13 vs 2" },
  { player: ["9", "7"], dealer: "7", tag: "hard", note: "16 vs 7" },
  { player: ["9", "7"], dealer: "8", tag: "hard", note: "16 vs 8" },
  { player: ["9", "7"], dealer: "9", tag: "hard", note: "16 vs 9" },
  { player: ["9", "7"], dealer: "10", tag: "hard", note: "16 vs 10" },
  { player: ["9", "7"], dealer: "A", tag: "hard", note: "16 vs A" },
  { player: ["10", "6"], dealer: "10", tag: "hard", note: "16 vs 10 (10+6)" },
  { player: ["8", "7"], dealer: "10", tag: "hard", note: "15 vs 10" },
  { player: ["8", "7"], dealer: "A", tag: "hard", note: "15 vs A" },
  { player: ["10", "5"], dealer: "10", tag: "hard", note: "15 vs 10 (10+5)" },
  { player: ["9", "2"], dealer: "2", tag: "hard", note: "11 vs 2" },
  { player: ["9", "2"], dealer: "A", tag: "hard", note: "11 vs A" },
  { player: ["8", "2"], dealer: "2", tag: "hard", note: "10 vs 2" },
  { player: ["5", "5"], dealer: "9", tag: "hard", note: "10 vs 9 (pair of 5s)" },
  { player: ["5", "5"], dealer: "10", tag: "hard", note: "10 vs 10" },
  { player: ["7", "2"], dealer: "2", tag: "hard", note: "9 vs 2" },
  { player: ["7", "2"], dealer: "7", tag: "hard", note: "9 vs 7" },
  { player: ["6", "2"], dealer: "5", tag: "hard", note: "8 vs 5" },
  { player: ["6", "2"], dealer: "6", tag: "hard", note: "8 vs 6" },
  { player: ["A", "7"], dealer: "2", tag: "soft", note: "A,7 vs 2" },
  { player: ["A", "7"], dealer: "3", tag: "soft", note: "A,7 vs 3" },
  { player: ["A", "7"], dealer: "7", tag: "soft", note: "A,7 vs 7" },
  { player: ["A", "7"], dealer: "8", tag: "soft", note: "A,7 vs 8" },
  { player: ["A", "7"], dealer: "9", tag: "soft", note: "A,7 vs 9" },
  { player: ["A", "7"], dealer: "10", tag: "soft", note: "A,7 vs 10" },
  { player: ["A", "7"], dealer: "A", tag: "soft", note: "A,7 vs A" },
  { player: ["A", "6"], dealer: "2", tag: "soft", note: "A,6 vs 2" },
  { player: ["A", "6"], dealer: "3", tag: "soft", note: "A,6 vs 3" },
  { player: ["A", "8"], dealer: "6", tag: "soft", note: "A,8 vs 6" },
  { player: ["A", "2"], dealer: "4", tag: "soft", note: "A,2 vs 4" },
  { player: ["A", "2"], dealer: "5", tag: "soft", note: "A,2 vs 5" },
  { player: ["A", "3"], dealer: "4", tag: "soft", note: "A,3 vs 4" },
  { player: ["A", "4"], dealer: "4", tag: "soft", note: "A,4 vs 4" },
  { player: ["A", "A"], dealer: "A", tag: "pair", note: "A,A vs A" },
  { player: ["8", "8"], dealer: "10", tag: "pair", note: "8,8 vs 10" },
  { player: ["8", "8"], dealer: "A", tag: "pair", note: "8,8 vs A" },
  { player: ["9", "9"], dealer: "7", tag: "pair", note: "9,9 vs 7" },
  { player: ["9", "9"], dealer: "9", tag: "pair", note: "9,9 vs 9" },
  { player: ["9", "9"], dealer: "10", tag: "pair", note: "9,9 vs 10" },
  { player: ["9", "9"], dealer: "A", tag: "pair", note: "9,9 vs A" },
  { player: ["4", "4"], dealer: "4", tag: "pair", note: "4,4 vs 4" },
  { player: ["4", "4"], dealer: "5", tag: "pair", note: "4,4 vs 5" },
  { player: ["4", "4"], dealer: "6", tag: "pair", note: "4,4 vs 6" },
  { player: ["6", "6"], dealer: "2", tag: "pair", note: "6,6 vs 2" },
  { player: ["6", "6"], dealer: "7", tag: "pair", note: "6,6 vs 7" },
  { player: ["2", "2"], dealer: "2", tag: "pair", note: "2,2 vs 2" },
  { player: ["2", "2"], dealer: "3", tag: "pair", note: "2,2 vs 3" },
  { player: ["3", "3"], dealer: "8", tag: "pair", note: "3,3 vs 8" },
  { player: ["7", "7"], dealer: "8", tag: "pair", note: "7,7 vs 8" },
  { player: ["7", "7"], dealer: "10", tag: "pair", note: "7,7 vs 10" },
  { player: ["7", "7"], dealer: "A", tag: "pair", note: "7,7 vs A" },
  { player: ["A", "10"], dealer: "A", tag: "insurance", note: "BJ vs A (even money)" },
  { player: ["10", "6"], dealer: "A", tag: "insurance", note: "16 vs A, insurance" },
  { player: ["9", "10"], dealer: "A", tag: "insurance", note: "19 vs A, insurance" },
];

const SUIT_CYCLE: Suit[] = ["hearts", "spades", "diamonds", "clubs"];

export function pickDrill(rules: TableRules, rng: () => number): {
  player: Card[];
  dealerUp: Card;
  hole: Card;
  spot: DrillSpot;
} {
  const pool = DRILL_SPOTS.filter((s) => rules.insuranceOffered || s.tag !== "insurance");
  const spot = (pool.length ? pool : DRILL_SPOTS)[Math.floor(rng() * (pool.length || DRILL_SPOTS.length))]!;
  const s0 = SUIT_CYCLE[Math.floor(rng() * 4)]!;
  let s1 = SUIT_CYCLE[Math.floor(rng() * 4)]!;
  if (s1 === s0) s1 = SUIT_CYCLE[(SUIT_CYCLE.indexOf(s0) + 1) % 4]!;
  const s2 = SUIT_CYCLE[Math.floor(rng() * 4)]!;
  const s3 = SUIT_CYCLE[(SUIT_CYCLE.indexOf(s2) + 1) % 4]!;

  const player = [
    makeCard(spot.player[0], s0, "drill-p0"),
    makeCard(spot.player[1], s1, "drill-p1"),
  ];
  const dealerUp = makeCard(spot.dealer, s2, "drill-up");
  // Hole: not a BJ if we want the player to actually take a decision,
  // except insurance drills may have BJ sometimes.
  const tenRanks: Rank[] = ["10", "J", "Q", "K"];
  let holeRank: Rank;
  if (spot.tag === "insurance" && rng() < 0.3) {
    holeRank = spot.dealer === "A" ? tenRanks[Math.floor(rng() * 4)]! : "A";
  } else {
    // Avoid a dealer blackjack so the player actually plays.
    const avoid = new Set<Rank>();
    if (spot.dealer === "A") tenRanks.forEach((r) => avoid.add(r));
    if (tenRanks.includes(spot.dealer)) avoid.add("A");
    const opts = RANKS.filter((r) => !avoid.has(r));
    holeRank = opts[Math.floor(rng() * opts.length)]!;
  }
  const hole = makeCard(holeRank, s3, "drill-hole");
  return { player, dealerUp, hole, spot };
}

/** For tests: every drill produces a defined book play under default-ish rules. */
export function drillBook(spot: DrillSpot, rules: TableRules) {
  const player = [
    makeCard(spot.player[0], "hearts", "a"),
    makeCard(spot.player[1], "spades", "b"),
  ];
  const up = makeCard(spot.dealer, "clubs", "c");
  return bookPlayFromCards(player, dealerUpValue(up), rules);
}
