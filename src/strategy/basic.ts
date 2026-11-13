import { dealerUpValue } from "../engine/cards";
import {
  canDouble,
  canHit,
  canSplit,
  canSurrender,
  evaluate,
  isBlackjack,
  pairRank,
} from "../engine/hand";
import type { Card, DealerUp, HandState, PlayerAction, TableRules } from "../engine/types";
import { getChartSet } from "./charts";
import type { BookPlay, ChartCode, LegalActions } from "./types";
import { dealerCol } from "./types";

export function legalActionsFor(
  hand: HandState,
  rules: TableRules,
  bankroll: number,
  currentHands: number,
  opts?: { insuranceOffered?: boolean },
): LegalActions {
  return {
    hit: canHit(hand, rules.hitSplitAces),
    stand: true,
    double: canDouble(hand, {
      das: rules.das,
      doubleOn: rules.doubleOn,
      hitSplitAces: rules.hitSplitAces,
      bankroll,
    }),
    split: canSplit(hand, {
      das: rules.das,
      resplitAces: rules.resplitAces,
      maxHands: rules.maxHands,
      currentHands,
      bankroll,
    }),
    surrender: canSurrender(hand, rules.surrender),
    insurance: !!opts?.insuranceOffered,
  };
}

export function bookInsurance(): BookPlay {
  return { action: "insurance_no", code: "N", reasonKey: "insurance" };
}

/**
 * Correct basic-strategy play for the current hand and rules.
 * Uses total-dependent Wizard of Odds charts, with fallbacks when a
 * preferred action (double, split, surrender) is not legal.
 */
export function bookPlay(
  hand: HandState,
  dealerUp: DealerUp | Card,
  rules: TableRules,
  legal?: LegalActions,
  bankroll = Infinity,
  currentHands = 1,
): BookPlay {
  const up: DealerUp = typeof dealerUp === "number" ? dealerUp : dealerUpValue(dealerUp);
  const acts =
    legal ??
    legalActionsFor(hand, rules, bankroll, currentHands);

  const { total, soft } = evaluate(hand.cards);
  const charts = getChartSet(rules.decks, rules.hitSoft17);
  const col = dealerCol(up);

  // Pairs first — the pair row includes surrender deviations (Rp, Rs on 7,7).
  const pr = pairRank(hand.cards);
  if (pr !== null && charts.splits[pr] && hand.cards.length === 2) {
    const code = charts.splits[pr]![col]!;
    const resolved = resolveCode(code, acts, rules, { kind: "pair", pair: pr, total, soft, up });
    if (resolved) return resolved;
    // P / Ph / etc. fell through because we can't split — play as hard/soft total.
  }

  // Hard / soft totals. Surrender lives on the hard chart (Rh / Rs).
  if (soft && total >= 13 && charts.soft[total]) {
    const code = charts.soft[total]![col]!;
    const resolved = resolveCode(code, acts, rules, { kind: "soft", total, soft, up });
    if (resolved) return resolved;
  }

  const hardTotal = Math.min(21, Math.max(4, total));
  const code = (charts.hard[hardTotal] ?? charts.hard[8])![col]!;
  const resolved = resolveCode(code, acts, rules, { kind: "hard", total: hardTotal, soft: false, up });
  if (resolved) return resolved;

  // Last resort: stand 17+, else hit.
  return {
    action: total >= 17 ? "stand" : "hit",
    code: total >= 17 ? "S" : "H",
    reasonKey: soft ? "soft" : "hard",
  };
}

interface ResolveCtx {
  kind: "hard" | "soft" | "pair";
  total: number;
  soft: boolean;
  up: DealerUp;
  pair?: number;
}

function resolveCode(
  code: ChartCode,
  legal: LegalActions,
  rules: TableRules,
  ctx: ResolveCtx,
): BookPlay | null {
  const key = ctx.kind === "pair" ? `pair-${ctx.pair}` : ctx.kind;
  const play = (action: PlayerAction): BookPlay => ({ action, code, reasonKey: key });

  switch (code) {
    case "H":
      return play("hit");
    case "S":
      return play("stand");
    case "Dh":
      return play(legal.double ? "double" : "hit");
    case "Ds":
      return play(legal.double ? "double" : "stand");
    case "P":
      if (legal.split) return play("split");
      return null; // fall through to hard/soft
    case "Ph":
      if (legal.split && rules.das) return play("split");
      if (legal.split && !rules.das) return play("hit");
      // Can't split at all (max hands / bankroll) — if DAS would have applied,
      // hit; otherwise fall through. Ph without DAS is hit.
      return play("hit");
    case "Pd":
      if (legal.split && rules.das) return play("split");
      if (legal.double) return play("double");
      return play("hit");
    case "Ps":
      if (legal.split && rules.das) return play("split");
      return play("stand");
    case "Rh":
      return play(legal.surrender ? "surrender" : "hit");
    case "Rs":
      return play(legal.surrender ? "surrender" : "stand");
    case "Rp":
      // 4–8 deck H17 8,8 vs A: surrender if allowed, otherwise split.
      if (legal.surrender) return play("surrender");
      if (legal.split) return play("split");
      return null;
    case "R2":
      // 2-deck H17 8,8 vs A: surrender only if allowed AND DAS is NOT allowed.
      if (legal.surrender && !rules.das) return play("surrender");
      if (legal.split) return play("split");
      return null;
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}

/** Convenience: book play from raw cards (for tests and the chart UI). */
export function bookPlayFromCards(
  cards: Card[],
  dealerUp: DealerUp | Card,
  rules: TableRules,
  extras?: Partial<LegalActions> & { bankroll?: number; currentHands?: number },
): BookPlay {
  const hand: HandState = {
    cards,
    bet: rules.minBet,
    doubled: false,
    surrendered: false,
    fromSplit: false,
    fromSplitAces: false,
    stood: false,
    insurance: 0,
  };
  const bankroll = extras?.bankroll ?? 10_000;
  const currentHands = extras?.currentHands ?? 1;
  const legal = legalActionsFor(hand, rules, bankroll, currentHands);
  if (extras) Object.assign(legal, extras);
  return bookPlay(hand, dealerUp, rules, legal, bankroll, currentHands);
}

export function isCorrectPlay(
  actual: PlayerAction,
  book: BookPlay,
): boolean {
  return actual === book.action;
}

/** For 3+ card hands, double/split/surrender are gone; use fallbacks. */
export function bookPlayMultiCard(
  cards: Card[],
  dealerUp: DealerUp | Card,
  rules: TableRules,
): BookPlay {
  const hand: HandState = {
    cards,
    bet: rules.minBet,
    doubled: false,
    surrendered: false,
    fromSplit: false,
    fromSplitAces: false,
    stood: false,
    insurance: 0,
  };
  return bookPlay(hand, dealerUp, rules);
}

export { isBlackjack, evaluate };
