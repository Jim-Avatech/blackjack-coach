import { cardLabel, dealerUpValue, rankValue } from "../engine/cards";
import { evaluate, isPair, pairRank } from "../engine/hand";
import type { Card, DealerUp, HandState, PlayerAction } from "../engine/types";
import type { BookPlay } from "./types";

const ACTION_LABEL: Record<PlayerAction, string> = {
  hit: "HIT",
  stand: "STAND",
  double: "DOUBLE",
  split: "SPLIT",
  surrender: "SURRENDER",
  insurance_yes: "take insurance",
  insurance_no: "refuse insurance",
};

/** Approximate dealer bust rates (6-deck, after peek). Used in plain-language why. */
const DEALER_BUST: Record<number, number> = {
  2: 35,
  3: 37,
  4: 40,
  5: 42,
  6: 42,
  7: 26,
  8: 24,
  9: 23,
  10: 23,
  1: 17,
};

function upName(up: DealerUp): string {
  return up === 1 ? "ace" : up === 10 ? "10" : String(up);
}

function isBustCard(up: DealerUp): boolean {
  return up >= 2 && up <= 6;
}

function handPhrase(hand: HandState): string {
  const { total, soft } = evaluate(hand.cards);
  const labels = hand.cards.map(cardLabel).join(" ");
  const pr = pairRank(hand.cards);
  if (pr !== null && hand.cards.length === 2) {
    if (pr === 1) return `a pair of aces (${labels})`;
    if (pr === 10) return `a pair of 10s (${labels})`;
    return `a pair of ${pr}s (${labels})`;
  }
  if (soft) return `a soft ${total} (${labels})`;
  return `a hard ${total} (${labels})`;
}

/**
 * Brief, plain-language explanation of why the book play is right.
 * Aimed at a phone-sized modal — a few sentences, no jargon piles.
 */
export function explainPlay(
  hand: HandState,
  dealerUp: DealerUp | Card,
  actual: PlayerAction,
  book: BookPlay,
): { title: string; body: string; correct: boolean } {
  const up: DealerUp = typeof dealerUp === "number" ? dealerUp : dealerUpValue(dealerUp);
  const correct = actual === book.action;
  const you = ACTION_LABEL[actual];
  const should = ACTION_LABEL[book.action];
  const phrase = handPhrase(hand);
  const dealer = `dealer ${upName(up)}`;
  const { total, soft } = evaluate(hand.cards);
  const why = whyText(hand, up, book, total, soft);

  if (correct) {
    return {
      title: "Nice",
      body: `Book play is ${should} with ${phrase} vs a ${dealer}. ${why}`,
      correct: true,
    };
  }

  const title = "Not the book play";
  let body = `You chose ${you} with ${phrase} vs a ${dealer}. `;
  body += `The book says ${should}. ${why} `;
  body += `Next time this spot comes up, ${should.toLowerCase()}.`;
  return { title, body, correct };
}

function whyText(
  hand: HandState,
  up: DealerUp,
  book: BookPlay,
  total: number,
  soft: boolean,
): string {
  const action = book.action;
  const bust = DEALER_BUST[up] ?? 23;
  const dealer = upName(up);
  const pr = isPair(hand.cards) ? pairRank(hand.cards) : null;

  if (action === "insurance_no" || book.code === "N") {
    return (
      "Insurance is a side bet that the dealer has a 10 in the hole. " +
      "That happens only about 31% of the time, but the bet needs 33% just to break even. " +
      "The book is to never take it — including even money when you have blackjack."
    );
  }

  if (action === "surrender") {
    if (pr === 8) {
      return (
        `A pair of 8s is normally always split, but against a dealer ace ` +
        `when the dealer hits soft 17, late surrender loses less than playing it out. ` +
        `You get half your bet back and skip a really bad spot.`
      );
    }
    if (pr === 7) {
      return (
        `A pair of 7s is a hard 14. Against a dealer 10 in a single-deck game, ` +
        `surrendering (or standing, if surrender isn't offered) loses less than hitting or splitting.`
      );
    }
    return (
      `Hard ${total} vs a ${dealer} is one of the worst starting spots in the game. ` +
      `The dealer is likely to make a hand (they only bust about ${bust}% of the time from a ${dealer}), ` +
      `and hitting busts you a lot. Late surrender gives half your bet back — the smallest average loss.`
    );
  }

  if (action === "split") {
    if (pr === 1) {
      return (
        "Always split aces. Each ace is a one-card shot at a 21, which is a much better " +
        "spot than playing a soft 12."
      );
    }
    if (pr === 8) {
      return (
        "Always split 8s. Hard 16 is the worst total you can have — two 8s give you " +
        "a chance to start over with a more playable hand."
      );
    }
    if (pr === 9) {
      if (up === 7 || up === 10 || up === 1) {
        return (
          `A pair of 9s is a hard 18, which wins often against a dealer ${dealer}. ` +
          `Splitting it is worse than just standing.`
        );
      }
      return (
        `Splitting 9s against a ${dealer} makes two hands that can each beat the dealer ` +
        `or let them bust. Standing on 18 is okay, but splitting has a better expected value here.`
      );
    }
    if (pr === 7) {
      return (
        `Split 7s against a dealer ${dealer}. Two starting hands of 7 will out-earn ` +
        `playing a stiff 14.`
      );
    }
    if (pr === 6 || pr === 4 || pr === 3 || pr === 2) {
      const dasNote =
        (pr === 2 || pr === 3 || pr === 4 || pr === 6) && (up === 2 || up === 3 || up === 5 || up === 6)
          ? " This only works because you can double after you split — if the table didn't allow that, you wouldn't split."
          : "";
      return (
        `Split the ${pr}s against a dealer ${dealer} (a bust card — they bust about ${bust}% of the time). ` +
        `Two smaller hands beat playing a stiff ${total}.` +
        dasNote
      );
    }
    if (pr === 10) {
      return "Never split 10s. Twenty is already a winning hand; breaking it up just gives the house extra chances.";
    }
    if (pr === 5) {
      return "Never split 5s. A hard 10 is a great double hand; two 5s are much weaker.";
    }
  }

  if (action === "double") {
    if (soft) {
      if (total === 19) {
        return (
          `Soft 19 is usually a stand, but against a dealer 6 — the weakest upcard — ` +
          `doubling has a slightly higher expected value. You'll often end up with 19–21, ` +
          `and the dealer busts about ${bust}% of the time.`
        );
      }
      if (total === 18) {
        return (
          `Soft 18 vs a dealer ${dealer} is a double when you can. You get one more card: ` +
          `a 2 or 3 makes 20–21, and if you catch a 10 you're still on 18. The dealer is ` +
          `weak here (busts about ${bust}% of the time).`
        );
      }
      return (
        `Soft ${total} is a flexible hand — an ace can still count as 1, so you can't bust ` +
        `on the next card. Against a weak dealer ${dealer} (busts ~${bust}%), doubling ` +
        `puts more money out when the math is on your side.`
      );
    }
    if (total === 11) {
      return (
        "11 is the best hard total to double. Four in thirteen cards are 10s, so you're " +
        "a favorite to land on 21, and you can't bust with one card."
      );
    }
    if (total === 10) {
      return (
        `Hard 10 vs a dealer ${dealer} is a strong double — lots of 10s in the deck will ` +
        `make you 20, and the dealer isn't showing a 10 or ace.`
      );
    }
    if (total === 9 || total === 8) {
      return (
        `Hard ${total} vs a dealer ${dealer} is a double because the dealer is on a bust card ` +
        `(~${bust}% busts) and one more card often makes a made hand of 18–21.`
      );
    }
    return `Doubling here puts more money on a spot where your expected value is positive.`;
  }

  if (action === "stand") {
    if (soft && total >= 19) {
      return `Soft ${total} is already a strong made hand. Drawing risks turning it into a stiff or a weaker total.`;
    }
    if (soft && total === 18) {
      if (isBustCard(up) || up === 7 || up === 8) {
        return (
          `Soft 18 is a decent made hand. Against a dealer ${dealer} you should stand ` +
          `(or double, if the book said to and you already fell back). Hitting can turn 18 into a worse total.`
        );
      }
    }
    if (!soft && total >= 17) {
      return `Hard ${total} is a made hand. Hitting busts too often to be worth it.`;
    }
    if (!soft && total >= 12 && total <= 16 && isBustCard(up)) {
      const twelveNote =
        total === 12 && (up === 2 || up === 3)
          ? "" // shouldn't be stand
          : "";
      return (
        `A dealer ${dealer} is a bust card — they bust about ${bust}% of the time. ` +
        `Your hard ${total} is a stiff: hitting risks a bust (any 10, about 4 cards in 13), ` +
        `and standing lets the dealer bust for you.` +
        twelveNote
      );
    }
    if (pr === 9) {
      return `Stand on a pair of 9s (hard 18) against a dealer ${dealer}. Eighteen wins often enough here that splitting would give up a good hand.`;
    }
    return `Standing is the lower-average-loss play in this spot.`;
  }

  // HIT
  if (action === "hit") {
    if (soft) {
      if (total <= 17) {
        return (
          `Soft ${total} cannot bust on the next card (the ace can drop from 11 to 1). ` +
          `You need to improve — standing leaves you with a total the dealer beats often.`
        );
      }
      if (total === 18) {
        return (
          `Soft 18 looks comfortable, but against a dealer ${dealer} it loses too often — ` +
          `they make 19, 20, or 21 a lot from that upcard. Hitting gives you a chance to improve, ` +
          `and you can't bust (the ace will drop to 1 if you draw a 10).`
        );
      }
    }
    if (!soft && total <= 11) {
      return `Hard ${total} cannot bust with one more card. Always hit (or double, when the book says so).`;
    }
    if (!soft && total === 12 && (up === 2 || up === 3)) {
      return (
        `Hard 12 vs a dealer ${dealer} is a hit, even though 2 and 3 are "low" cards. ` +
        `The dealer busts less often from a ${dealer} (~${bust}%) than from a 4, 5, or 6 (~40%+), ` +
        `and only a 10 busts your 12. The extra chances of improving outweigh standing.`
      );
    }
    if (!soft && total >= 12 && total <= 16) {
      return (
        `Hard ${total} is a stiff, but the dealer is showing a ${dealer} — a made-hand card. ` +
        `They only bust about ${bust}% of the time and will often end up with 17–21. ` +
        `Standing loses too frequently; hitting is painful (you can bust) but loses less on average.`
      );
    }
    return `Hitting is the better expected-value play in this spot.`;
  }

  return "";
}

export function shortHandLabel(hand: HandState): string {
  return handPhrase(hand);
}

export { ACTION_LABEL, DEALER_BUST, upName };

/** Used by the toast: a one-word or short phrase. */
export function correctToastMessage(): string {
  const options = ["Nice", "Book play", "That's the one", "Yes"];
  return options[Math.floor(Math.random() * options.length)]!;
}

export function dealerCardName(card: Card): string {
  return upName(dealerUpValue(card));
}

// silence unused in some builds
void rankValue;
