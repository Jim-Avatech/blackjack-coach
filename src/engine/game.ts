import { dealerUpValue } from "./cards";
import { pickDrill, type DrillSpot } from "./drills";
import {
  canDouble,
  canHit,
  canSplit,
  canSurrender,
  cloneHand,
  emptyHand,
  evaluate,
  isBlackjack,
  isBust,
  isFinished,
} from "./hand";
import { settleHand, settleInsurance } from "./payouts";
import {
  evaluatePerfectPairs,
  evaluateTwentyOnePlusThree,
  sideBetNet,
} from "./sidebets";
import { Shoe, seededRng } from "./shoe";
import type {
  Card,
  GamePhase,
  HandState,
  PlayerAction,
  SettledHand,
  TableRules,
} from "./types";
import { DEFAULT_RULES } from "./types";
import { bookInsurance, bookPlay, legalActionsFor } from "../strategy/basic";
import { explainPlay } from "../strategy/explain";
import type { BookPlay } from "../strategy/types";

export const BOT_NAMES = ["PIX", "DOT", "CHIP", "ACE"] as const;

export interface Seat {
  id: number;
  name: string;
  isHuman: boolean;
  hands: HandState[];
  perfectPairsBet: number;
  twentyOnePlusThreeBet: number;
  lastSettlements: SettledHand[];
  lastSideNet: number;
  lastInsuranceNet: number;
}

export interface CoachResult {
  correct: boolean;
  actual: PlayerAction;
  book: BookPlay;
  title: string;
  body: string;
  /** Kind used for accuracy stats. */
  kind: "hard" | "soft" | "pair" | "surrender" | "insurance";
}

export interface GameSnapshot {
  rules: TableRules;
  phase: GamePhase;
  seats: Seat[];
  humanSeat: number;
  dealer: { cards: Card[]; holeHidden: boolean };
  activeSeat: number;
  activeHand: number;
  bankroll: number;
  pendingBet: number;
  pendingPP: number;
  pending213: number;
  coach: CoachResult | null;
  /** Pending action waiting on the player to dismiss a wrong-play modal. */
  pendingAction: PlayerAction | null;
  message: string;
  cutCardReached: boolean;
  shoeRemaining: number;
  shoeTotal: number;
  lastDealer: Card[];
  drillSpot: DrillSpot | null;
  sideMessages: string[];
}

export interface GameHooks {
  onCoach?: (c: CoachResult) => void;
  onShuffle?: () => void;
}

export class BlackjackGame {
  rules: TableRules;
  shoe: Shoe;
  phase: GamePhase = "betting";
  seats: Seat[] = [];
  humanSeat = 0;
  dealer: { cards: Card[]; holeHidden: boolean } = { cards: [], holeHidden: true };
  activeSeat = 0;
  activeHand = 0;
  bankroll: number;
  pendingBet: number;
  pendingPP = 0;
  pending213 = 0;
  coach: CoachResult | null = null;
  pendingAction: PlayerAction | null = null;
  message = "";
  lastDealer: Card[] = [];
  drillSpot: DrillSpot | null = null;
  sideMessages: string[] = [];
  private hooks: GameHooks;
  private rng: () => number;

  constructor(rules: TableRules = { ...DEFAULT_RULES }, hooks: GameHooks = {}, rng?: () => number) {
    this.rules = { ...DEFAULT_RULES, ...rules };
    this.rng = rng ?? Math.random;
    this.shoe = new Shoe(this.rules.decks, 0.75, this.rng);
    this.bankroll = this.rules.bankroll;
    this.pendingBet = this.rules.minBet;
    this.hooks = hooks;
    this.rebuildSeats();
  }

  private rebuildSeats(): void {
    const n = this.rules.seats;
    this.humanSeat = Math.floor((n - 1) / 2);
    this.seats = [];
    let bot = 0;
    for (let i = 0; i < n; i++) {
      const isHuman = i === this.humanSeat;
      this.seats.push({
        id: i,
        name: isHuman ? "YOU" : BOT_NAMES[bot++] ?? `BOT${bot}`,
        isHuman,
        hands: [],
        perfectPairsBet: 0,
        twentyOnePlusThreeBet: 0,
        lastSettlements: [],
        lastSideNet: 0,
        lastInsuranceNet: 0,
      });
    }
  }

  /** Apply new rules. If mid-hand, they take effect at the next betting phase. */
  setRules(patch: Partial<TableRules>): void {
    const next = { ...this.rules, ...patch };
    const shoeChange = next.decks !== this.rules.decks;
    this.rules = next;
    if (this.phase === "betting") {
      if (shoeChange) this.shoe = new Shoe(this.rules.decks, 0.75, this.rng);
      this.rebuildSeats();
      if (this.pendingBet < this.rules.minBet) this.pendingBet = this.rules.minBet;
      if (this.pendingBet > this.bankroll) this.pendingBet = Math.max(0, this.bankroll);
    }
  }

  rebuy(): void {
    this.bankroll = this.rules.bankroll;
    this.pendingBet = Math.min(this.rules.minBet, this.bankroll);
    this.message = "Bankroll reset.";
  }

  addChip(value: number): void {
    if (this.phase !== "betting") return;
    const next = this.pendingBet + value;
    if (next > this.bankroll) return;
    this.pendingBet = next;
  }

  clearBet(): void {
    if (this.phase !== "betting") return;
    this.pendingBet = 0;
  }

  setBet(value: number): void {
    if (this.phase !== "betting") return;
    this.pendingBet = Math.max(0, Math.min(this.bankroll, value));
  }

  toggleSide(kind: "pp" | "213"): void {
    if (this.phase !== "betting") return;
    const amt = this.rules.minBet;
    if (kind === "pp") {
      if (!this.rules.perfectPairs) return;
      this.pendingPP = this.pendingPP ? 0 : amt;
    } else {
      if (!this.rules.twentyOnePlusThree) return;
      this.pending213 = this.pending213 ? 0 : amt;
    }
    // Don't let side bets exceed remaining bankroll after the main bet.
    const reserved = this.pendingBet + this.pendingPP + this.pending213;
    if (reserved > this.bankroll) {
      if (kind === "pp") this.pendingPP = 0;
      else this.pending213 = 0;
    }
  }

  deal(): boolean {
    if (this.phase !== "betting") return false;
    if (this.pendingBet < this.rules.minBet) {
      this.message = `Minimum bet is ${this.rules.minBet}.`;
      return false;
    }
    const sides = this.pendingPP + this.pending213;
    if (this.pendingBet + sides > this.bankroll) {
      this.message = "Not enough bankroll for that bet.";
      return false;
    }
    if (this.shoe.shouldShuffle) {
      this.shoe.reshuffle();
      this.hooks.onShuffle?.();
    }

    this.coach = null;
    this.pendingAction = null;
    this.sideMessages = [];
    this.drillSpot = null;
    this.dealer = { cards: [], holeHidden: true };
    this.lastDealer = [];

    for (const s of this.seats) {
      s.hands = [];
      s.lastSettlements = [];
      s.lastSideNet = 0;
      s.lastInsuranceNet = 0;
      s.perfectPairsBet = 0;
      s.twentyOnePlusThreeBet = 0;
    }

    // Take chips for the human. Bots bet the minimum (if they can — they
    // have infinite chips; only the human bankroll is tracked).
    this.bankroll -= this.pendingBet + this.pendingPP + this.pending213;
    const human = this.seats[this.humanSeat]!;
    const hHand = emptyHand(this.pendingBet);
    human.hands = [hHand];
    human.perfectPairsBet = this.pendingPP;
    human.twentyOnePlusThreeBet = this.pending213;

    for (const s of this.seats) {
      if (s.isHuman) continue;
      s.hands = [emptyHand(this.rules.minBet)];
    }

    // Drill mode: force the human's two cards and the dealer up/hole.
    if (this.rules.drillMode) {
      const d = pickDrill(this.rules, this.rng);
      this.drillSpot = d.spot;
      // Deal bots first from the shoe, then inject the drill cards.
      for (const s of this.seats) {
        if (s.isHuman) continue;
        s.hands[0]!.cards.push(this.shoe.draw());
      }
      human.hands[0]!.cards.push(d.player[0]!);
      this.dealer.cards.push(d.dealerUp);
      for (const s of this.seats) {
        if (s.isHuman) continue;
        s.hands[0]!.cards.push(this.shoe.draw());
      }
      human.hands[0]!.cards.push(d.player[1]!);
      this.dealer.cards.push(d.hole);
    } else {
      // Standard deal: one around, dealer up, one around, dealer hole.
      for (const s of this.seats) s.hands[0]!.cards.push(this.shoe.draw());
      this.dealer.cards.push(this.shoe.draw());
      for (const s of this.seats) s.hands[0]!.cards.push(this.shoe.draw());
      this.dealer.cards.push(this.shoe.draw());
    }

    this.resolveSideBets();

    const up = this.dealer.cards[0]!;
    const upVal = dealerUpValue(up);
    if (upVal === 1 && this.rules.insuranceOffered) {
      this.phase = "insurance";
      this.message = "Insurance?";
      return true;
    }
    this.afterInsurance();
    return true;
  }

  /** Human insurance decision. */
  actInsurance(take: boolean): CoachResult {
    const actual: PlayerAction = take ? "insurance_yes" : "insurance_no";
    const book = bookInsurance();
    const human = this.seats[this.humanSeat]!;
    const hand = human.hands[0]!;
    const explain = explainPlay(hand, this.dealer.cards[0]!, actual, book);
    const coach: CoachResult = {
      correct: actual === book.action,
      actual,
      book,
      title: explain.title,
      body: explain.body,
      kind: "insurance",
    };
    this.coach = coach;
    this.hooks.onCoach?.(coach);

    if (!coach.correct) {
      this.pendingAction = actual;
      this.phase = "explaining";
      return coach;
    }
    this.applyInsurance(take);
    return coach;
  }

  dismissExplanation(): void {
    if (this.phase !== "explaining" || !this.pendingAction) return;
    const action = this.pendingAction;
    this.pendingAction = null;
    // After a wrong play we still apply what the player chose.
    if (action === "insurance_yes" || action === "insurance_no") {
      this.applyInsurance(action === "insurance_yes");
      return;
    }
    this.applyAction(action);
  }

  /** After dismissing, or if they got insurance right. */
  private applyInsurance(take: boolean): void {
    const human = this.seats[this.humanSeat]!;
    const hand = human.hands[0]!;
    if (take) {
      const amt = hand.bet / 2;
      if (this.bankroll >= amt) {
        this.bankroll -= amt;
        hand.insurance = amt;
      }
    }
    this.afterInsurance();
  }

  private afterInsurance(): void {
    const up = this.dealer.cards[0]!;
    const upVal = dealerUpValue(up);
    if (upVal === 1 || upVal === 10) {
      if (isBlackjack({ ...emptyHand(), cards: this.dealer.cards })) {
        this.dealer.holeHidden = false;
        this.settleRound();
        return;
      }
    }
    // Player / bots with natural BJ are already finished.
    this.phase = "player";
    this.startFirstPlayerTurn();
  }

  private startFirstPlayerTurn(): void {
    // Walk seats from 0 (dealer's left visually is our first seat).
    for (let i = 0; i < this.seats.length; i++) {
      this.activeSeat = i;
      this.activeHand = 0;
      if (this.playSeatOrSkip()) return;
    }
    this.playDealerAndSettle();
  }

  /**
   * If the active seat still has a playable hand, either wait for the human
   * or auto-play a bot. Returns true if we're waiting on the human.
   */
  private playSeatOrSkip(): boolean {
    const seat = this.seats[this.activeSeat]!;
    while (this.activeHand < seat.hands.length) {
      const hand = seat.hands[this.activeHand]!;
      if (isFinished(hand)) {
        this.activeHand += 1;
        continue;
      }
      if (seat.isHuman) {
        this.phase = "player";
        this.message = seat.hands.length > 1 ? `Hand ${this.activeHand + 1}` : "";
        return true;
      }
      this.playBotHand(seat, this.activeHand);
      this.activeHand += 1;
    }
    return false;
  }

  private playBotHand(seat: Seat, handIdx: number): void {
    // Safety cap so a bug can't infinite-loop.
    for (let step = 0; step < 20; step++) {
      const hand = seat.hands[handIdx]!;
      if (isFinished(hand)) return;
      const legal = legalActionsFor(
        hand,
        this.rules,
        /* bots have plenty */ 100_000,
        seat.hands.length,
      );
      const book = bookPlay(
        hand,
        dealerUpValue(this.dealer.cards[0]!),
        this.rules,
        legal,
        100_000,
        seat.hands.length,
      );
      this.execute(seat, handIdx, book.action);
      if (book.action === "stand" || book.action === "surrender" || book.action === "double")
        return;
      if (book.action === "split") {
        // After a split, play the current (first) hand further in this loop.
        continue;
      }
    }
  }

  /**
   * Human action on the current hand. Returns a coach result.
   * If the play is wrong, the game pauses in `explaining` until dismiss.
   */
  act(action: PlayerAction): CoachResult | null {
    if (this.phase === "insurance") {
      if (action === "insurance_yes" || action === "insurance_no") {
        return this.actInsurance(action === "insurance_yes");
      }
      return null;
    }
    if (this.phase !== "player") return null;
    if (action === "insurance_yes" || action === "insurance_no") return null;

    const seat = this.seats[this.activeSeat]!;
    if (!seat.isHuman) return null;
    const hand = seat.hands[this.activeHand]!;
    const legal = this.humanLegal();
    if (!legal[action as keyof typeof legal]) {
      this.message = `You can't ${action} here.`;
      return null;
    }

    const book = bookPlay(
      hand,
      dealerUpValue(this.dealer.cards[0]!),
      this.rules,
      legalActionsFor(hand, this.rules, this.bankroll, seat.hands.length),
      this.bankroll,
      seat.hands.length,
    );
    const explain = explainPlay(hand, this.dealer.cards[0]!, action, book);
    const kind = coachKind(book, hand);
    const coach: CoachResult = {
      correct: action === book.action,
      actual: action,
      book,
      title: explain.title,
      body: explain.body,
      kind,
    };
    this.coach = coach;
    this.hooks.onCoach?.(coach);

    if (!coach.correct) {
      this.pendingAction = action;
      this.phase = "explaining";
      return coach;
    }
    this.applyAction(action);
    return coach;
  }

  private applyAction(action: PlayerAction): void {
    const seat = this.seats[this.activeSeat]!;
    this.execute(seat, this.activeHand, action);
    this.advanceAfterHuman();
  }

  private advanceAfterHuman(): void {
    const seat = this.seats[this.activeSeat]!;
    const hand = seat.hands[this.activeHand];
    if (hand && !isFinished(hand)) {
      this.phase = "player";
      return;
    }
    // Move to next hand of this seat (after a split) or next seat.
    this.activeHand += 1;
    if (this.playSeatOrSkip()) return;
    for (let i = this.activeSeat + 1; i < this.seats.length; i++) {
      this.activeSeat = i;
      this.activeHand = 0;
      if (this.playSeatOrSkip()) return;
    }
    this.playDealerAndSettle();
  }

  private execute(seat: Seat, handIdx: number, action: PlayerAction): void {
    const hand = seat.hands[handIdx]!;
    switch (action) {
      case "hit":
        hand.cards.push(this.shoe.draw());
        if (isBust(hand.cards) || evaluate(hand.cards).total === 21) hand.stood = true;
        break;
      case "stand":
        hand.stood = true;
        break;
      case "double": {
        const extra = hand.bet;
        if (seat.isHuman) {
          if (this.bankroll < extra) {
            // Should have been blocked by legal; fall back to hit.
            hand.cards.push(this.shoe.draw());
            if (isBust(hand.cards) || evaluate(hand.cards).total === 21) hand.stood = true;
            break;
          }
          this.bankroll -= extra;
        }
        hand.bet += extra;
        hand.doubled = true;
        hand.cards.push(this.shoe.draw());
        hand.stood = true;
        break;
      }
      case "surrender":
        hand.surrendered = true;
        break;
      case "split": {
        const cardB = hand.cards.pop()!;
        const second = emptyHand(hand.bet);
        second.fromSplit = true;
        second.fromSplitAces = hand.fromSplitAces || cardB.rank === "A";
        second.cards = [cardB];
        hand.fromSplit = true;
        hand.fromSplitAces = hand.fromSplitAces || hand.cards[0]!.rank === "A";
        if (seat.isHuman) {
          if (this.bankroll < hand.bet) {
            hand.cards.push(cardB);
            return;
          }
          this.bankroll -= hand.bet;
        }
        seat.hands.splice(handIdx + 1, 0, second);
        // Deal one card to the first hand. (The current hand continues.)
        hand.cards.push(this.shoe.draw());
        // Split aces usually get one card and stand, unless hit-split-aces is on.
        if (hand.fromSplitAces && !this.rules.hitSplitAces) {
          hand.stood = true;
          // Also deal to the second ace and stand it — we'll deal when we get
          // there, but it's nicer to deal both now.
          second.cards.push(this.shoe.draw());
          second.stood = true;
        }
        // If first split hand is a pair and we might resplit, leave it un-stood.
        // If it made 21, isFinished will treat it as done (total 21).
        break;
      }
      default:
        break;
    }
  }

  private playDealerAndSettle(): void {
    this.phase = "dealer";
    this.dealer.holeHidden = false;
    const anyLive = this.seats.some((s) =>
      s.hands.some(
        (h) => !h.surrendered && !isBust(h.cards) && !isBlackjack(h),
      ),
    );
    // Dealer still plays if anyone is live. If everyone busted/surrendered/BJ,
    // dealer usually doesn't draw (we'll still reveal the hole).
    if (anyLive) {
      for (let i = 0; i < 20; i++) {
        const v = evaluate(this.dealer.cards);
        if (v.total > 17) break;
        if (v.total === 17) {
          if (v.soft && this.rules.hitSoft17) {
            this.dealer.cards.push(this.shoe.draw());
            continue;
          }
          break;
        }
        this.dealer.cards.push(this.shoe.draw());
      }
    }
    this.settleRound();
  }

  private resolveSideBets(): void {
    const up = this.dealer.cards[0]!;
    for (const s of this.seats) {
      if (!s.isHuman) continue;
      const cards = s.hands[0]?.cards ?? [];
      let net = 0;
      const msgs: string[] = [];
      if (s.perfectPairsBet) {
        const r = evaluatePerfectPairs(cards);
        const n = sideBetNet(s.perfectPairsBet, r);
        net += n;
        msgs.push(
          r
            ? `Perfect Pairs (${r.kind}): +${s.perfectPairsBet * r.payout}`
            : "Perfect Pairs: lose",
        );
      }
      if (s.twentyOnePlusThreeBet) {
        const r = evaluateTwentyOnePlusThree(cards, up);
        const n = sideBetNet(s.twentyOnePlusThreeBet, r);
        net += n;
        msgs.push(
          r
            ? `21+3 (${r.kind}): +${s.twentyOnePlusThreeBet * r.payout}`
            : "21+3: lose",
        );
      }
      s.lastSideNet = net;
      this.bankroll += s.perfectPairsBet + s.twentyOnePlusThreeBet + net;
      // sideBetNet already is +payout*bet or -bet. We took the bet at deal,
      // so we need to: return bet + winnings, OR nothing if lose.
      // Wait: at deal we subtracted pendingPP. sideBetNet is +bet*payout on win
      // (profit only) or -bet on lose. So to settle: bankroll += bet + net
      // (return stake + profit on win; return 0 on lose because net=-bet, bet+net=0).
      // Yes.
      this.sideMessages = msgs;
    }
  }

  private settleRound(): void {
    this.dealer.holeHidden = false;
    this.lastDealer = this.dealer.cards.slice();
    const dealerBJ = isBlackjack({ ...emptyHand(), cards: this.dealer.cards });

    for (const s of this.seats) {
      let insNet = 0;
      const settlements: SettledHand[] = [];
      for (const hand of s.hands) {
        const ins = settleInsurance(hand.insurance, dealerBJ);
        insNet += ins;
        const st = settleHand(hand, { cards: this.dealer.cards }, this.rules);
        settlements.push(st);
        if (s.isHuman) {
          // Return stake + net for the main bet. We already took the stake
          // (and the double/split extra stakes) from bankroll at bet time.
          // net is profit (or -bet). So bankroll += bet + net, except:
          //   win: net=+bet, return 2x stake
          //   push: net=0, return stake
          //   lose: net=-bet, return 0
          //   BJ 3:2: net=1.5bet, return 2.5x
          //   surrender: net=-bet/2, return bet/2
          this.bankroll += hand.bet + st.net;
          this.bankroll += hand.insurance + ins;
        }
      }
      s.lastSettlements = settlements;
      s.lastInsuranceNet = insNet;
    }

    const human = this.seats[this.humanSeat]!;
    const nets = human.lastSettlements;
    const totalNet =
      nets.reduce((a, s) => a + s.net, 0) + human.lastSideNet + human.lastInsuranceNet;
    const outcomes = nets.map((s) => s.outcome).join(", ");
    this.message = formatResult(outcomes, totalNet);
    this.phase = "settling";

    // Snap bankroll off floating 3:2 fractions? We use halves only (surrender,
    // 3:2 on even bets). Keep cents out of it — bets are integers, 3:2 on odd
    // would be .5. That's fine.
    if (this.bankroll < this.rules.minBet) {
      this.message += "  Bankroll's short — rebuy from the menu.";
    }
  }

  /** After settlement, go back to betting (keeping the last bet). */
  nextRound(): void {
    if (this.phase !== "settling") return;
    // Discard all used cards.
    for (const s of this.seats) {
      for (const h of s.hands) this.shoe.discard(h.cards);
      s.hands = [];
    }
    this.shoe.discard(this.dealer.cards);
    this.dealer = { cards: [], holeHidden: true };
    this.phase = "betting";
    this.coach = null;
    this.pendingAction = null;
    this.drillSpot = null;
    if (this.pendingBet > this.bankroll) this.pendingBet = Math.max(0, this.bankroll);
    if (this.pendingPP + this.pending213 + this.pendingBet > this.bankroll) {
      this.pendingPP = 0;
      this.pending213 = 0;
    }
    this.message = this.shoe.shouldShuffle ? "Shoe will shuffle on the next deal." : "";
    // Mid-hand rule changes (seats, decks) apply now.
    this.setRules({});
  }

  /** Rebet last amount and deal immediately. */
  rebetDeal(): boolean {
    if (this.phase === "settling") this.nextRound();
    return this.deal();
  }

  humanLegal(): Record<"hit" | "stand" | "double" | "split" | "surrender", boolean> {
    const seat = this.seats[this.activeSeat];
    if (!seat || this.phase !== "player") {
      return { hit: false, stand: false, double: false, split: false, surrender: false };
    }
    const hand = seat.hands[this.activeHand];
    if (!hand) return { hit: false, stand: false, double: false, split: false, surrender: false };
    return {
      hit: canHit(hand, this.rules.hitSplitAces),
      stand: true,
      double: canDouble(hand, {
        das: this.rules.das,
        doubleOn: this.rules.doubleOn,
        hitSplitAces: this.rules.hitSplitAces,
        bankroll: this.bankroll,
      }),
      split: canSplit(hand, {
        das: this.rules.das,
        resplitAces: this.rules.resplitAces,
        maxHands: this.rules.maxHands,
        currentHands: seat.hands.length,
        bankroll: this.bankroll,
      }),
      surrender: canSurrender(hand, this.rules.surrender),
    };
  }

  snapshot(): GameSnapshot {
    return {
      rules: this.rules,
      phase: this.phase,
      seats: this.seats,
      humanSeat: this.humanSeat,
      dealer: this.dealer,
      activeSeat: this.activeSeat,
      activeHand: this.activeHand,
      bankroll: this.bankroll,
      pendingBet: this.pendingBet,
      pendingPP: this.pendingPP,
      pending213: this.pending213,
      coach: this.coach,
      pendingAction: this.pendingAction,
      message: this.message,
      cutCardReached: this.shoe.shouldShuffle,
      shoeRemaining: this.shoe.remaining,
      shoeTotal: this.shoe.total,
      lastDealer: this.lastDealer,
      drillSpot: this.drillSpot,
      sideMessages: this.sideMessages,
    };
  }
}

function coachKind(book: BookPlay, hand: HandState): CoachResult["kind"] {
  if (book.action === "insurance_yes" || book.action === "insurance_no") return "insurance";
  if (book.action === "surrender") return "surrender";
  if (book.reasonKey.startsWith("pair") || book.action === "split") return "pair";
  const { soft } = evaluate(hand.cards);
  return soft ? "soft" : "hard";
}

function formatResult(outcomes: string, net: number): string {
  const sign = net > 0 ? `+${formatChips(net)}` : net < 0 ? formatChips(net) : "0";
  return `${outcomes.toUpperCase()}  ${sign}`;
}

export function formatChips(n: number): string {
  const rounded = Math.round(n * 2) / 2; // keep halves
  if (Number.isInteger(rounded)) return `${rounded}`;
  return rounded.toFixed(1);
}

export { seededRng };

function _unusedIsFinishedGuard(h: HandState) {
  return isFinished(h);
}
void _unusedIsFinishedGuard;
void cloneHand;
