/** Shared types for the blackjack engine and strategy coach. */

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface Card {
  suit: Suit;
  rank: Rank;
  /** Unique id so two identical cards from different decks stay distinct. */
  id: string;
}

export type DealerUp = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 1;

export type PlayerAction =
  | "hit"
  | "stand"
  | "double"
  | "split"
  | "surrender"
  | "insurance_yes"
  | "insurance_no";

export type DoubleRule = "any" | "9-11" | "10-11";
export type SurrenderRule = "none" | "late";
export type BlackjackPayout = "3:2" | "6:5";

export interface TableRules {
  decks: 1 | 2 | 4 | 6 | 8;
  /** true = dealer hits soft 17 (H17), false = stands (S17). */
  hitSoft17: boolean;
  /** Double after split. */
  das: boolean;
  doubleOn: DoubleRule;
  /** Max hands after resplits (2 = no resplit, 4 is typical). */
  maxHands: 2 | 3 | 4;
  resplitAces: boolean;
  hitSplitAces: boolean;
  surrender: SurrenderRule;
  blackjackPayout: BlackjackPayout;
  insuranceOffered: boolean;
  /** American peek: dealer checks hole card for blackjack on 10 or A. Always on. */
  dealerPeek: true;
  minBet: number;
  /** Starting / rebuy bankroll. */
  bankroll: number;
  perfectPairs: boolean;
  twentyOnePlusThree: boolean;
  /** Total seats at the table, including the human (1–5). */
  seats: 1 | 2 | 3 | 4 | 5;
  sound: boolean;
  drillMode: boolean;
}

export const DEFAULT_RULES: TableRules = {
  decks: 6,
  hitSoft17: true,
  das: true,
  doubleOn: "any",
  maxHands: 4,
  resplitAces: false,
  hitSplitAces: false,
  surrender: "none",
  blackjackPayout: "3:2",
  insuranceOffered: true,
  dealerPeek: true,
  minBet: 10,
  bankroll: 1000,
  perfectPairs: false,
  twentyOnePlusThree: false,
  seats: 1,
  sound: false,
  drillMode: false,
};

export interface HandState {
  cards: Card[];
  bet: number;
  doubled: boolean;
  surrendered: boolean;
  fromSplit: boolean;
  fromSplitAces: boolean;
  stood: boolean;
  /** Insurance amount placed on this seat's original bet (half bet). */
  insurance: number;
}

export type HandOutcome =
  | "blackjack"
  | "win"
  | "push"
  | "lose"
  | "surrender"
  | "bust"
  | "dealer_bust";

export interface SettledHand {
  hand: HandState;
  outcome: HandOutcome;
  /** Net chips for this hand (includes insurance). */
  net: number;
}

export type GamePhase =
  | "betting"
  | "insurance"
  | "player"
  | "bots"
  | "dealer"
  | "explaining"
  | "settling";
