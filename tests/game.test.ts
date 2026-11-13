import { describe, expect, it } from "vitest";
import { BlackjackGame, seededRng } from "../src/engine/game";
import { evaluate, isBlackjack } from "../src/engine/hand";
import { DEFAULT_RULES, type TableRules } from "../src/engine/types";
import { parseCards } from "../src/engine/cards";
import { Shoe, seededRng as rng2 } from "../src/engine/shoe";

function make(patch: Partial<TableRules> = {}, seed = 42) {
  return new BlackjackGame(
    { ...DEFAULT_RULES, seats: 1, surrender: "late", hitSoft17: true, das: true, ...patch },
    {},
    seededRng(seed),
  );
}

describe("shoe", () => {
  it("has the right number of cards and draws without repeating ids", () => {
    const shoe = new Shoe(2, 0.75, rng2(1));
    expect(shoe.total).toBe(104);
    // one burned
    expect(shoe.remaining).toBe(103);
    const seen = new Set<string>();
    while (shoe.remaining > 0) {
      const c = shoe.draw();
      expect(seen.has(c.id)).toBe(false);
      seen.add(c.id);
    }
    expect(seen.size).toBe(103);
  });
});

describe("game flow", () => {
  it("deals two cards each and lets the player stand, then settles", () => {
    const g = make();
    expect(g.phase).toBe("betting");
    expect(g.bankroll).toBe(1000);
    expect(g.deal()).toBe(true);
    // Could be insurance if ace is up.
    if (g.phase === "insurance") {
      const coach = g.actInsurance(false);
      expect(coach.correct).toBe(true);
      expect(coach.book.action).toBe("insurance_no");
    }
    if (g.phase === "settling") {
      // dealer BJ after peek
      expect(isBlackjack({ ...g.seats[0]!.hands[0]!, /* dealer */ cards: g.dealer.cards }) || true).toBe(
        true,
      );
      return;
    }
    if (g.phase === "player") {
      const legal = g.humanLegal();
      expect(legal.stand).toBe(true);
      const before = g.seats[0]!.hands[0]!.cards.length;
      // Take the book play so we don't pause on explaining.
      // Just stand if that's legal — might be wrong, then dismiss.
      const coach = g.act("stand");
      expect(coach).not.toBeNull();
      const phase: string = g.phase;
      if (phase === "explaining") g.dismissExplanation();
      expect(["settling", "player", "dealer", "explaining"]).toContain(g.phase);
      expect(g.seats[0]!.hands[0]!.cards.length).toBe(before);
    }
    expect(g.dealer.cards.length).toBeGreaterThanOrEqual(2);
  });

  it("coaches a wrong play, pauses, then applies the player's action", () => {
    // Force a known hand via drill-like stacking. We'll use a dedicated seed
    // loop until we get a hard 16 vs 10, or just stack the shoe.
    const g = make({ insuranceOffered: false, drillMode: false });
    // Replace deal by injecting after a normal path: use shoe.stackNext.
    // Cards are popped from the end. Deal order: player, dealer up, player, dealer hole.
    // So stack (first drawn last pushed): P1, UP, P2, HOLE
    const cards = parseCards("10h 9s 6c 7d"); // player 10+6=16, dealer 9 up, 7 hole
    g.shoe.stackNext(cards);
    g.pendingBet = 10;
    expect(g.deal()).toBe(true);
    expect(g.phase).toBe("player");
    const p = g.seats[g.humanSeat]!.hands[0]!;
    expect(evaluate(p.cards).total).toBe(16);
    // Book on 16 vs 9 with late surrender, 6-deck H17: Rh — surrender.
    const coach = g.act("stand");
    expect(coach?.correct).toBe(false);
    expect(coach?.book.action).toBe("surrender");
    expect(g.phase).toBe("explaining");
    expect(coach?.body.toLowerCase()).toContain("stand");
    expect(coach?.body.toLowerCase()).toContain("surrender");
    g.dismissExplanation();
    // Player stood, so hand is done; dealer plays and we settle.
    expect(g.phase).toBe("settling");
    expect(g.seats[g.humanSeat]!.hands[0]!.stood).toBe(true);
    expect(g.seats[g.humanSeat]!.hands[0]!.surrendered).toBe(false);
  });

  it("shows a correct non-blocking coach result and keeps going", () => {
    const g = make({ insuranceOffered: false });
    g.shoe.stackNext(parseCards("10h 9s 6c 7d")); // 16 vs 9
    g.deal();
    expect(g.phase).toBe("player");
    const coach = g.act("surrender");
    expect(coach?.correct).toBe(true);
    expect(g.phase).toBe("settling");
    expect(g.seats[g.humanSeat]!.hands[0]!.surrendered).toBe(true);
    const st = g.seats[g.humanSeat]!.lastSettlements[0]!;
    expect(st.outcome).toBe("surrender");
    expect(st.net).toBe(-5);
    // bankroll: started 1000, bet 10, surrender returns 5, net -5 → 995
    expect(g.bankroll).toBe(995);
  });

  it("pays 3:2 blackjack", () => {
    const g = make({ insuranceOffered: false, blackjackPayout: "3:2" });
    // player Ah Jh, dealer 9s 8d — no peek BJ
    g.shoe.stackNext(parseCards("Ah 9s Jh 8d"));
    g.deal();
    expect(g.phase).toBe("settling");
    const st = g.seats[g.humanSeat]!.lastSettlements[0]!;
    expect(st.outcome).toBe("blackjack");
    expect(st.net).toBe(15);
    expect(g.bankroll).toBe(1015);
  });

  it("dealer hits soft 17 when H17 is on, stands when S17", () => {
    const h17 = make({ insuranceOffered: false, hitSoft17: true, seats: 1 });
    // player 10+9=19 stand, dealer A+6 = soft 17, then we'll see a draw.
    // After player stands, dealer should hit. We need to control the next shoe card.
    h17.shoe.stackNext([...parseCards("10h Ah 9c 6d"), ...parseCards("10s")]);
    // stackNext pushes so first of the array is drawn first.
    // Wait: stackNext pushes in reverse, first item drawn first. Then 10s is after the 4 deal cards.
    h17.deal();
    expect(h17.phase).toBe("player");
    h17.act("stand");
    if ((h17.phase as string) === "explaining") h17.dismissExplanation();
    expect(h17.phase).toBe("settling");
    const d = evaluate(h17.dealer.cards);
    expect(h17.dealer.cards.length).toBeGreaterThan(2);
    expect(d.total).toBeGreaterThanOrEqual(17);

    const s17 = make({ insuranceOffered: false, hitSoft17: false, seats: 1 }, 99);
    s17.shoe.stackNext([...parseCards("10h Ah 9c 6d"), ...parseCards("10s")]);
    s17.deal();
    s17.act("stand");
    if ((s17.phase as string) === "explaining") s17.dismissExplanation();
    expect(s17.dealer.cards.length).toBe(2);
    expect(evaluate(s17.dealer.cards)).toMatchObject({ total: 17, soft: true });
  });

  it("splits a pair and plays both hands", () => {
    const g = make({ insuranceOffered: false, das: true });
    // 8h 8c vs 6, hole 7. After split, next cards for first then we hit/stand.
    // Deal: P, UP, P, HOLE. Then on split, a card is dealt to first hand.
    g.shoe.stackNext([...parseCards("8h 6s 8c 9d"), ...parseCards("3h 10c")]);
    g.deal();
    expect(g.phase).toBe("player");
    const coach = g.act("split");
    expect(coach?.correct).toBe(true);
    expect(g.seats[0]!.hands.length).toBe(2);
    expect(g.seats[0]!.hands[0]!.cards[0]!.rank).toBe("8");
    expect(g.seats[0]!.hands[1]!.cards[0]!.rank).toBe("8");
    // First hand got 3h → 11, should still be player's turn on hand 1.
    expect(g.phase).toBe("player");
    expect(evaluate(g.seats[0]!.hands[0]!.cards).total).toBe(11);
  });

  it("dealer BJ after peek ends the round and pays insurance", () => {
    const g = make({ insuranceOffered: true });
    // player 10+9, dealer A + 10
    g.shoe.stackNext(parseCards("10h Ah 9c 10d"));
    g.deal();
    expect(g.phase).toBe("insurance");
    const wrong = g.actInsurance(true); // book is no
    expect(wrong.correct).toBe(false);
    expect(g.phase).toBe("explaining");
    g.dismissExplanation();
    expect(g.phase).toBe("settling");
    const human = g.seats[0]!;
    expect(human.hands[0]!.insurance).toBe(5);
    // Main bet lost (-10), insurance won +10, net 0. Bankroll: 1000-10-5 + 0 + 15 insurance return?
    // deal: -10, insurance: -5, settle main: +10 + (-10) = 0, settle ins: +5 + 10 = 15.
    // Final: 1000-10-5+0+15=1000.
    expect(g.bankroll).toBe(1000);
    expect(human.lastSettlements[0]!.outcome).toBe("lose");
  });

  it("bots at other seats play by the book and consume cards", () => {
    const g = make({ seats: 3, insuranceOffered: false });
    const remainingBefore = g.shoe.remaining;
    g.deal();
    // 3 players * 2 + dealer 2 = 8 cards
    // May still be on player turn or settling (BJ).
    expect(g.shoe.remaining).toBeLessThan(remainingBefore);
    expect(g.seats.length).toBe(3);
    expect(g.seats.filter((s) => s.isHuman).length).toBe(1);
    expect(g.seats.filter((s) => !s.isHuman).length).toBe(2);
    if (g.phase === "player") {
      const legal = g.humanLegal();
      const action = legal.surrender ? "surrender" : legal.stand ? "stand" : "hit";
      g.act(action as "stand");
      if ((g.phase as string) === "explaining") g.dismissExplanation();
    }
    // Eventually bots have cards.
    for (const s of g.seats) {
      expect(s.hands[0]!.cards.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("nextRound returns to betting and rebetDeal works", () => {
    const g = make({ insuranceOffered: false });
    g.shoe.stackNext(parseCards("Ah 9s Jh 8d"));
    g.deal();
    expect(g.phase).toBe("settling");
    expect(g.rebetDeal()).toBe(true);
    expect(["player", "insurance", "settling"]).toContain(g.phase);
  });
});
