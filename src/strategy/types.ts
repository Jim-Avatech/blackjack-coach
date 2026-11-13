import type { DealerUp, PlayerAction, TableRules } from "../engine/types";

/**
 * Raw chart codes, matching Wizard of Odds notation:
 *   H  hit
 *   S  stand
 *   Dh double if allowed, else hit
 *   Ds double if allowed, else stand
 *   P  split
 *   Ph split if DAS, else hit
 *   Pd split if DAS, else double (else hit)
 *   Ps split if DAS, else stand
 *   Rh surrender if allowed, else hit
 *   Rs surrender if allowed, else stand
 *   Rp surrender if allowed, else split          (4–8 deck H17 8,8 vs A)
 *   R2 surrender if allowed AND DAS is off, else split
 *      (2-deck H17 8,8 vs A — Wizard of Odds special case)
 */
export type ChartCode =
  | "H"
  | "S"
  | "Dh"
  | "Ds"
  | "P"
  | "Ph"
  | "Pd"
  | "Ps"
  | "Rh"
  | "Rs"
  | "Rp"
  | "R2";

/** One row vs dealer 2,3,4,5,6,7,8,9,10,A. */
export type ChartRow = [
  ChartCode,
  ChartCode,
  ChartCode,
  ChartCode,
  ChartCode,
  ChartCode,
  ChartCode,
  ChartCode,
  ChartCode,
  ChartCode,
];

export type DeckGroup = 1 | 2 | 4;

export interface StrategyContext {
  rules: TableRules;
  /** Player's cards. */
  cards: { rank: string }[];
  dealerUp: DealerUp;
  /** Legal actions right now (already considering bankroll, 2-card, DAS, etc.). */
  legal: LegalActions;
}

export interface LegalActions {
  hit: boolean;
  stand: boolean;
  double: boolean;
  split: boolean;
  surrender: boolean;
  insurance: boolean;
}

export interface BookPlay {
  action: PlayerAction;
  /** Raw chart cell before legal-action fallbacks. */
  code: ChartCode | "N"; // N = never take insurance
  /** After fallbacks, the action we expect the player to take. */
  reasonKey: string;
}

export function dealerCol(up: DealerUp): number {
  return up === 1 ? 9 : up - 2;
}

export function deckGroup(decks: number): DeckGroup {
  if (decks <= 1) return 1;
  if (decks === 2) return 2;
  return 4;
}
