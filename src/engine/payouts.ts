import { evaluate, isBlackjack, isBust } from "./hand";
import type { HandOutcome, HandState, SettledHand, TableRules } from "./types";

export function blackjackMultiplier(payout: TableRules["blackjackPayout"]): number {
  return payout === "3:2" ? 1.5 : 1.2;
}

/**
 * Net chip result for one player hand vs a finished dealer hand.
 * Insurance is settled separately and added in.
 *
 * Dealer blackjack (already peeked) is handled by the caller: if the dealer
 * has BJ, player BJ pushes and every other hand loses (surrender would have
 * been after the peek, so it isn't offered).
 */
export function settleHand(
  hand: HandState,
  dealer: CardOrTotal,
  rules: Pick<TableRules, "blackjackPayout">,
): SettledHand {
  const dealerCards = "cards" in dealer ? dealer.cards : undefined;
  const dealerTotal = "cards" in dealer ? evaluate(dealer.cards).total : dealer.total;
  const dealerBJ =
    "isBlackjack" in dealer
      ? dealer.isBlackjack
      : dealerCards
        ? dealerCards.length === 2 && evaluate(dealerCards).total === 21
        : false;
  const dealerBust = dealerTotal > 21;

  if (hand.surrendered) {
    return { hand, outcome: "surrender", net: -hand.bet / 2 };
  }

  const playerBJ = isBlackjack(hand);
  const playerBust = isBust(hand.cards);
  const playerTotal = evaluate(hand.cards).total;

  let outcome: HandOutcome;
  let net: number;

  if (playerBJ && dealerBJ) {
    outcome = "push";
    net = 0;
  } else if (playerBJ) {
    outcome = "blackjack";
    net = hand.bet * blackjackMultiplier(rules.blackjackPayout);
  } else if (dealerBJ) {
    outcome = "lose";
    net = -hand.bet;
  } else if (playerBust) {
    outcome = "bust";
    net = -hand.bet;
  } else if (dealerBust) {
    outcome = "dealer_bust";
    net = hand.bet;
  } else if (playerTotal > dealerTotal) {
    outcome = "win";
    net = hand.bet;
  } else if (playerTotal < dealerTotal) {
    outcome = "lose";
    net = -hand.bet;
  } else {
    outcome = "push";
    net = 0;
  }

  return { hand, outcome, net };
}

type CardOrTotal =
  | { cards: HandState["cards"] }
  | { total: number; isBlackjack?: boolean };

/** Insurance pays 2:1. Bet is typically half the original. */
export function settleInsurance(insuranceBet: number, dealerHasBlackjack: boolean): number {
  if (insuranceBet <= 0) return 0;
  return dealerHasBlackjack ? insuranceBet * 2 : -insuranceBet;
}

export function outcomeLabel(o: HandOutcome): string {
  switch (o) {
    case "blackjack":
      return "BLACKJACK";
    case "win":
      return "WIN";
    case "push":
      return "PUSH";
    case "lose":
      return "LOSE";
    case "surrender":
      return "SURRENDER";
    case "bust":
      return "BUST";
    case "dealer_bust":
      return "DEALER BUST";
  }
}
