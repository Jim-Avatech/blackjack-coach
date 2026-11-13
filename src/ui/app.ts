import { BlackjackGame, formatChips, type CoachResult, type GameSnapshot } from "../engine/game";
import { evaluate, isBlackjack, isBust } from "../engine/hand";
import { outcomeLabel } from "../engine/payouts";
import type { PlayerAction, TableRules } from "../engine/types";
import { accuracy, emptyStats, load, recordDecision, save, type Stats } from "../store";
import { displayChart } from "../strategy/display";
import { ACTION_LABEL, correctToastMessage } from "../strategy/explain";
import { cardHtml, cardsHtml, resetCardAnims, THUMBS_UP_SVG } from "./cards";
import { setSoundEnabled, sounds } from "./sounds";

type Panel = null | "menu" | "settings" | "chart" | "stats" | "help";

const CHIP_VALUES = [5, 25, 100, 500];

export function boot(root: HTMLElement): BlackjackGame {
  const persisted = load();
  let stats: Stats = persisted.stats;
  let seenHelp = persisted.seenHelp;
  let panel: Panel = seenHelp ? null : "help";
  let toast: { text: string; id: number } | null = null;
  let toastTimer = 0;

  const game = new BlackjackGame(persisted.rules, {
    onCoach(c) {
      stats = recordDecision(stats, c.kind, c.correct);
      if (c.correct) {
        showToast(correctToastMessage());
        sounds.correct();
      } else {
        sounds.wrong();
      }
      persist();
    },
    onShuffle() {
      /* shoe shuffle message is set by the game */
    },
  });
  game.bankroll = persisted.bankroll;
  if (persisted.pendingBet > 0) game.pendingBet = Math.min(persisted.pendingBet, game.bankroll);
  setSoundEnabled(game.rules.sound);
  stats.highBankroll = Math.max(stats.highBankroll, game.bankroll);

  function persist() {
    stats.highBankroll = Math.max(stats.highBankroll, game.bankroll);
    save({
      rules: game.rules,
      bankroll: game.bankroll,
      stats,
      seenHelp,
      pendingBet: game.pendingBet,
    });
  }

  function showToast(text: string) {
    toast = { text, id: Date.now() };
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast = null;
      paint();
    }, 1400);
    paint();
  }

  function paint() {
    setLastLegal(game.humanLegal());
    root.innerHTML = renderApp(game.snapshot(), stats, panel, toast, !seenHelp);
  }

  function afterAct(coach: CoachResult | null) {
    if (game.phase === "settling") {
      const human = game.seats[game.humanSeat]!;
      const net =
        human.lastSettlements.reduce((a, s) => a + s.net, 0) +
        human.lastSideNet +
        human.lastInsuranceNet;
      stats.handsPlayed += 1;
      stats.netChips += net;
      if (net > 0) sounds.win();
      else if (net < 0) sounds.lose();
      persist();
    }
    paint();
    void coach;
  }

  root.addEventListener("click", (ev) => {
    const t = (ev.target as HTMLElement).closest("[data-act]") as HTMLElement | null;
    if (!t) return;
    const act = t.dataset.act!;
    const val = t.dataset.val;

    switch (act) {
      case "menu":
        panel = "menu";
        sounds.click();
        paint();
        break;
      case "close":
        panel = null;
        if (!seenHelp) {
          seenHelp = true;
          persist();
        }
        paint();
        break;
      case "panel":
        panel = val as Panel;
        sounds.click();
        paint();
        break;
      case "chip":
        if (game.phase === "betting") {
          game.addChip(Number(val));
          sounds.chip();
          persist();
          paint();
        }
        break;
      case "clear":
        game.clearBet();
        game.pendingPP = 0;
        game.pending213 = 0;
        persist();
        paint();
        break;
      case "deal":
        if (game.phase === "settling") game.nextRound();
        resetCardAnims();
        if (game.deal()) {
          sounds.deal();
          persist();
        }
        paint();
        break;
      case "play": {
        const coach = game.act(val as PlayerAction);
        afterAct(coach);
        break;
      }
      case "dismiss":
        game.dismissExplanation();
        if (game.phase === "settling") {
          const human = game.seats[game.humanSeat]!;
          const net =
            human.lastSettlements.reduce((a, s) => a + s.net, 0) +
            human.lastSideNet +
            human.lastInsuranceNet;
          stats.handsPlayed += 1;
          stats.netChips += net;
          persist();
        }
        paint();
        break;
      case "side":
        game.toggleSide(val as "pp" | "213");
        sounds.chip();
        persist();
        paint();
        break;
      case "rule": {
        const key = t.dataset.key as keyof TableRules;
        let parsed: unknown = val;
        if (val === "true") parsed = true;
        else if (val === "false") parsed = false;
        else if (val && /^\d+$/.test(val)) parsed = Number(val);
        game.setRules({ [key]: parsed } as Partial<TableRules>);
        if (key === "sound") setSoundEnabled(!!parsed);
        if (key === "minBet" && game.phase === "betting" && game.pendingBet < (parsed as number)) {
          game.pendingBet = parsed as number;
        }
        sounds.click();
        persist();
        paint();
        break;
      }
      case "rebuy":
        game.rebuy();
        stats.highBankroll = Math.max(stats.highBankroll, game.bankroll);
        persist();
        paint();
        break;
      case "reset-stats":
        stats = emptyStats(game.bankroll);
        persist();
        paint();
        break;
      default:
        break;
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (game.phase === "explaining") {
        game.dismissExplanation();
        paint();
        return;
      }
      if (panel) {
        panel = null;
        paint();
      }
      return;
    }
    if (panel) return;
    const k = e.key.toLowerCase();
    if (game.phase === "betting" && (k === "enter" || k === "d")) {
      if (game.deal()) sounds.deal();
      paint();
    } else if (game.phase === "settling" && (k === "enter" || k === "d")) {
      game.nextRound();
      if (game.deal()) sounds.deal();
      paint();
    } else if (game.phase === "insurance") {
      if (k === "n") afterAct(game.act("insurance_no"));
      if (k === "y") afterAct(game.act("insurance_yes"));
    } else if (game.phase === "player") {
      const map: Record<string, PlayerAction> = {
        h: "hit",
        s: "stand",
        d: "double",
        p: "split",
        r: "surrender",
      };
      if (map[k]) afterAct(game.act(map[k]!));
    } else if (game.phase === "explaining" && (k === "enter" || k === " ")) {
      game.dismissExplanation();
      paint();
    }
  });

  // Unlock audio on first gesture.
  root.addEventListener(
    "pointerdown",
    () => {
      setSoundEnabled(game.rules.sound);
    },
    { once: true },
  );

  paint();

  // Test / screenshot hook.
  (window as unknown as { __BJ: unknown }).__BJ = {
    game,
    get stats() {
      return stats;
    },
    dealScenario(specs: string, opts?: { bet?: number }) {
      const { parseCards } = requireCards();
      if (game.phase === "settling") game.nextRound();
      if (game.phase !== "betting") return;
      game.shoe.stackNext(parseCards(specs));
      if (opts?.bet) game.pendingBet = opts.bet;
      game.rules.insuranceOffered = specs.toLowerCase().includes(" a") || /a[shdc]/i.test(specs.split(/\s+/)[1] ?? "");
      // The second card in deal order is dealer up. Don't auto-disable; let caller set rules.
      resetCardAnims();
      game.deal();
      paint();
    },
    setPanel(p: Panel) {
      panel = p;
      paint();
    },
    paint,
    showToast,
    act(a: PlayerAction) {
      afterAct(game.act(a));
    },
    dismiss() {
      game.dismissExplanation();
      paint();
    },
  };

  return game;
}

function requireCards() {
  // lazy to keep this file's top imports clean for the hook only
  return requireModule();
}
import { parseCards as parseCardsFn } from "../engine/cards";
function requireModule() {
  return { parseCards: parseCardsFn };
}

/* ---------------- render ---------------- */

function renderApp(
  snap: GameSnapshot,
  stats: Stats,
  panel: Panel,
  toast: { text: string; id: number } | null,
  firstHelp: boolean,
): string {
  return `
    ${renderTop(snap, stats)}
    <div class="table">
      ${renderTable(snap)}
      ${toast ? `<div class="toast" data-id="${toast.id}">${THUMBS_UP_SVG}<span>${esc(toast.text)}</span></div>` : ""}
    </div>
    ${renderRail(snap)}
    ${snap.phase === "explaining" && snap.coach && !snap.coach.correct ? renderExplain(snap.coach) : ""}
    ${panel ? renderPanel(panel, snap, stats, firstHelp) : ""}
  `;
}

function renderTop(snap: GameSnapshot, stats: Stats): string {
  const acc = accuracy(stats);
  return `<header class="topbar">
    <div class="brand">BJ<br>COACH</div>
    <div class="stat-pill">CHIP <em>${formatChips(snap.bankroll)}</em></div>
    <div class="stat-pill">${acc === null ? "—" : acc + "%"}${stats.streak ? "  " + stats.streak + " STRK" : ""}</div>
    <button class="icon-btn" data-act="menu" aria-label="Menu">☰</button>
  </header>`;
}

function renderTable(snap: GameSnapshot): string {
  const r = snap.rules;
  const rulesTxt = [
    `${r.decks}D`,
    r.hitSoft17 ? "H17" : "S17",
    r.das ? "DAS" : "NDAS",
    r.surrender === "late" ? "LS" : "NSR",
    `BJ ${r.blackjackPayout}`,
    snap.cutCardReached ? "CUT" : `${snap.shoeRemaining}`,
    r.drillMode ? "DRILL" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const dealerHidden = snap.dealer.holeHidden;
  const dealerCards = snap.dealer.cards;
  const dEval = dealerCards.length ? evaluate(dealerHidden ? [dealerCards[0]!] : dealerCards) : null;
  const dealerBj = !dealerHidden && dealerCards.length >= 2 && isBlackjack({
    cards: dealerCards,
    bet: 0,
    doubled: false,
    surrendered: false,
    fromSplit: false,
    fromSplitAces: false,
    stood: false,
    insurance: 0,
  });

  const bots = snap.seats.filter((s) => !s.isHuman);
  const human = snap.seats[snap.humanSeat];

  return `
    <div class="rules-strip">${esc(rulesTxt)}</div>
    <div class="felt-motto">BLACKJACK PAYS ${r.blackjackPayout}  ·  INSURANCE 2:1</div>
    ${snap.phase === "betting" ? '<div class="place-bet">PLACE YOUR BET</div>' : ""}
    ${
      dealerCards.length
        ? `<div class="dealer-area">
      <div class="seat-label">DEALER</div>
      ${cardsHtml(
        dealerCards.map((c, i) => ({ card: c, hidden: dealerHidden && i === 1 })),
        false,
      )}
      ${
        dEval
          ? `<div class="hand-total ${dealerBj ? "is-bj" : ""} ${!dealerHidden && dEval.total > 21 ? "is-bust" : ""}">${
              dealerHidden ? (dealerCards[0]!.rank === "A" ? "A" : dEval.total) : dEval.total
            }${dealerBj ? "  BJ" : ""}</div>`
          : ""
      }
    </div>`
        : ""
    }
    ${
      bots.length
        ? `<div class="bots-row">${bots
            .map((b) => {
              const h = b.hands[0];
              const ev = h && h.cards.length ? evaluate(h.cards) : null;
              return `<div class="bot-seat">
                <div class="seat-label">${esc(b.name)}</div>
                ${h && h.cards.length ? cardsHtml(h.cards.map((c) => ({ card: c })), true) : ""}
                ${ev ? `<div class="hand-total is-small">${ev.total}</div>` : ""}
              </div>`;
            })
            .join("")}</div>`
        : ""
    }
    <div class="player-area">
      ${snap.drillSpot && snap.phase !== "betting" ? `<div class="drill-tag">DRILL · ${esc(snap.drillSpot.note)}</div>` : ""}
      <div class="seat-label">YOU</div>
      ${renderHumanHands(snap, human)}
    </div>
  `;
}

function renderHumanHands(snap: GameSnapshot, human: GameSnapshot["seats"][number] | undefined): string {
  if (!human) return "";
  const inPlay = snap.phase !== "betting" && human.hands.length > 0 && human.hands[0]!.cards.length > 0;
  if (!inPlay) {
    return `
      <div class="bet-circle">${chipStack(snap.pendingBet)}<div class="bet-amt">${snap.pendingBet || ""}</div></div>
      ${
        snap.rules.perfectPairs || snap.rules.twentyOnePlusThree
          ? `<div class="side-bets">
              ${snap.rules.perfectPairs ? sideBtn("pp", "PAIRS", snap.pendingPP) : ""}
              ${snap.rules.twentyOnePlusThree ? sideBtn("213", "21+3", snap.pending213) : ""}
            </div>`
          : ""
      }
    `;
  }
  return `<div class="hands-row">${human.hands
    .map((h, i) => {
      const ev = evaluate(h.cards);
      const bj = isBlackjack(h);
      const bust = isBust(h.cards);
      const active = snap.phase === "player" && snap.activeSeat === snap.humanSeat && snap.activeHand === i;
      const settled = snap.phase === "settling" ? human.lastSettlements[i] : undefined;
      return `<div class="one-hand ${active ? "is-active" : ""}">
        ${cardsHtml(h.cards.map((c) => ({ card: c })))}
        <div class="hand-total ${bust ? "is-bust" : ""} ${bj ? "is-bj" : ""}">${
          bust ? "BUST" : bj ? "BJ" : ev.total
        }${ev.soft && !bj && !bust ? "  SOFT" : ""}</div>
        <div class="hand-bet">${h.doubled ? "2× " : ""}${h.bet}${h.surrendered ? "  SURR" : ""}</div>
        ${settled ? `<div class="result-tag is-${settled.outcome}">${outcomeLabel(settled.outcome)} ${settled.net >= 0 ? "+" : ""}${formatChips(settled.net)}</div>` : ""}
      </div>`;
    })
    .join("")}</div>
    ${snap.sideMessages.length ? `<div class="hand-bet">${snap.sideMessages.map(esc).join(" · ")}</div>` : ""}
    ${human.lastInsuranceNet ? `<div class="hand-bet">Insurance ${human.lastInsuranceNet > 0 ? "+" : ""}${formatChips(human.lastInsuranceNet)}</div>` : ""}`;
}

function sideBtn(kind: string, label: string, amt: number): string {
  return `<button class="side-bet ${amt ? "is-on" : ""}" data-act="side" data-val="${kind}">${label}${
    amt ? "  " + amt : ""
  }</button>`;
}

function chipStack(amount: number): string {
  if (!amount) return "";
  const parts: number[] = [];
  let left = amount;
  for (const v of [500, 100, 25, 10, 5]) {
    while (left >= v && parts.length < 6) {
      parts.push(v);
      left -= v;
    }
  }
  return `<div class="chip-stack">${parts
    .map((v) => `<div class="chip c-${v <= 5 ? 5 : v <= 10 ? 10 : v <= 25 ? 25 : v <= 100 ? 100 : 500}">${v}</div>`)
    .join("")}</div>`;
}

function renderRail(snap: GameSnapshot): string {
  const msg = snap.message;
  if (snap.phase === "betting") {
    const canDeal = snap.pendingBet >= snap.rules.minBet && snap.pendingBet <= snap.bankroll;
    const broke = snap.bankroll < snap.rules.minBet;
    return `<div class="rail">
      <div class="msg-line">${esc(msg) || (broke ? "Bankroll's short — rebuy in the menu." : `Min ${snap.rules.minBet}`)}</div>
      ${
        broke
          ? `<div class="actions"><div class="actions-row one"><button class="btn btn-deal" data-act="rebuy">REBUY</button></div></div>`
          : `<div class="chips-row">${CHIP_VALUES.map(
              (v) =>
                `<button class="chip-btn c-${v}" data-act="chip" data-val="${v}" ${
                  snap.pendingBet + v > snap.bankroll ? "disabled" : ""
                }>+${v}</button>`,
            ).join("")}</div>
          <div class="actions">
            <div class="actions-row">
              <button class="btn btn-ghost" data-act="clear">CLEAR</button>
              <button class="btn btn-deal" data-act="deal" ${canDeal ? "" : "disabled"}>DEAL</button>
            </div>
          </div>`
      }
    </div>`;
  }
  if (snap.phase === "insurance") {
    return `<div class="rail">
      <div class="msg-line">Insurance? (book says no)</div>
      <div class="actions"><div class="actions-row">
        <button class="btn btn-no" data-act="play" data-val="insurance_no">NO</button>
        <button class="btn btn-yes" data-act="play" data-val="insurance_yes">YES</button>
      </div></div>
    </div>`;
  }
  if (snap.phase === "player") {
    const L = legalFromSnap(snap);
    const row2: string[] = [];
    if (L.double) row2.push(btn("double", "DOUBLE", "btn-double"));
    if (L.split) row2.push(btn("split", "SPLIT", "btn-split"));
    const top = L.surrender
      ? `<div class="actions-row one">${btn("surrender", "SURRENDER", "btn-surrender")}</div>`
      : "";
    return `<div class="rail">
      <div class="msg-line">${esc(msg)}</div>
      <div class="actions">
        ${top}
        <div class="actions-row">
          ${btn("hit", "HIT", "btn-hit", !L.hit)}
          ${btn("stand", "STAND", "btn-stand")}
        </div>
        ${row2.length ? `<div class="actions-row ${row2.length === 1 ? "one" : ""}">${row2.join("")}</div>` : ""}
      </div>
    </div>`;
  }
  if (snap.phase === "explaining") {
    return `<div class="rail"><div class="msg-line">Check the coach…</div></div>`;
  }
  if (snap.phase === "settling") {
    const can = snap.bankroll >= snap.rules.minBet;
    return `<div class="rail">
      <div class="msg-line">${esc(msg)}</div>
      <div class="actions"><div class="actions-row one">
        <button class="btn btn-deal" data-act="deal" ${can ? "" : "disabled"}>${can ? "DEAL" : "REBUY IN MENU"}</button>
      </div></div>
    </div>`;
  }
  return `<div class="rail"><div class="msg-line">${esc(msg)}</div></div>`;
}

function legalFromSnap(_snap: GameSnapshot) {
  return lastLegal;
}

let lastLegal = { hit: true, stand: true, double: false, split: false, surrender: false };

// Patch paint? We'll set lastLegal in boot via a wrapper. Export a setter used in boot.paint.
export function setLastLegal(l: typeof lastLegal) {
  lastLegal = l;
}

function btn(action: string, label: string, cls: string, disabled = false): string {
  return `<button class="btn ${cls}" data-act="play" data-val="${action}" ${disabled ? "disabled" : ""}>${label}</button>`;
}

function renderExplain(c: CoachResult): string {
  const book = ACTION_LABEL[c.book.action];
  const you = ACTION_LABEL[c.actual];
  return `<div class="overlay"><div class="modal">
    <h2>${esc(c.title)}</h2>
    <div class="book-line">YOU: ${esc(you)}  ·  BOOK: ${esc(book)}</div>
    <p>${esc(c.body)}</p>
    <div class="actions-row one">
      <button class="btn btn-deal" data-act="dismiss">GOT IT</button>
    </div>
  </div></div>`;
}

function renderPanel(panel: Panel, snap: GameSnapshot, stats: Stats, firstHelp: boolean): string {
  if (panel === "menu") return panelShell("MENU", renderMenu());
  if (panel === "settings") return panelShell("TABLE RULES", renderSettings(snap));
  if (panel === "chart") return panelShell("STRATEGY CHART", renderChart(snap));
  if (panel === "stats") return panelShell("YOUR STATS", renderStats(stats));
  if (panel === "help") return panelShell(firstHelp ? "WELCOME" : "HOW IT WORKS", renderHelp(firstHelp));
  return "";
}

function panelShell(title: string, body: string): string {
  return `<div class="panel">
    <div class="panel-head">
      <h2>${title}</h2>
      <button class="icon-btn" data-act="close" aria-label="Close">✕</button>
    </div>
    <div class="panel-body">${body}</div>
  </div>`;
}

function renderMenu(): string {
  return `<div class="menu-list">
    <button class="btn" data-act="panel" data-val="settings">TABLE SETTINGS</button>
    <button class="btn" data-act="panel" data-val="chart">STRATEGY CHART</button>
    <button class="btn" data-act="panel" data-val="stats">STATS</button>
    <button class="btn" data-act="panel" data-val="help">HOW IT WORKS</button>
    <button class="btn" data-act="rebuy">RESET BANKROLL</button>
  </div>
  <p class="help-body" style="margin-top:18px">Settings and the chart always match the table you're practicing on. Change the rules any time between hands.</p>`;
}

function renderSettings(snap: GameSnapshot): string {
  const r = snap.rules;
  return `
    ${group("Shoe & dealer", [
      seg("decks", "Decks", r.decks, [1, 2, 4, 6, 8]),
      seg("hitSoft17", "Dealer soft 17", r.hitSoft17, [
        { v: false, l: "STAND" },
        { v: true, l: "HIT" },
      ]),
    ])}
    ${group("Player options", [
      tog("das", "Double after split", r.das),
      seg("doubleOn", "Double on", r.doubleOn, [
        { v: "any", l: "ANY 2" },
        { v: "9-11", l: "9–11" },
        { v: "10-11", l: "10–11" },
      ]),
      seg("maxHands", "Split up to", r.maxHands, [2, 3, 4]),
      tog("resplitAces", "Resplit aces", r.resplitAces),
      tog("hitSplitAces", "Hit split aces", r.hitSplitAces),
      seg("surrender", "Surrender", r.surrender, [
        { v: "none", l: "NONE" },
        { v: "late", l: "LATE" },
      ]),
      seg("blackjackPayout", "Blackjack pays", r.blackjackPayout, [
        { v: "3:2", l: "3:2" },
        { v: "6:5", l: "6:5" },
      ]),
      tog("insuranceOffered", "Offer insurance", r.insuranceOffered),
    ])}
    ${group("Bets", [
      seg("minBet", "Minimum bet", r.minBet, [5, 10, 25, 50, 100]),
      seg("bankroll", "Rebuy amount", r.bankroll, [500, 1000, 2500, 5000]),
    ])}
    <div class="actions-row one" style="margin-bottom:16px">
      <button class="btn btn-ghost" data-act="rebuy">REBUY TO ${r.bankroll} NOW</button>
    </div>
    ${group("Bonus bets", [
      tog("perfectPairs", "Perfect Pairs", r.perfectPairs),
      `<div class="paytable">Perfect 25:1 · Colored 12:1 · Mixed 6:1</div>`,
      tog("twentyOnePlusThree", "21+3", r.twentyOnePlusThree),
      `<div class="paytable">Suited trips 100:1 · Straight flush 40:1 · Trips 30:1 · Straight 10:1 · Flush 5:1</div>`,
    ])}
    ${group("Table & practice", [
      seg("seats", "Players at the table", r.seats, [1, 2, 3, 4, 5]),
      `<div class="paytable">Other seats are bots that play basic strategy. Their cards come out of the same shoe.</div>`,
      tog("drillMode", "Drill mode (tricky spots only)", r.drillMode),
      tog("sound", "Sound", r.sound),
    ])}
  `;
}

function group(title: string, rows: string[]): string {
  return `<div class="group"><h3>${title}</h3>${rows.join("")}</div>`;
}

function seg(
  key: string,
  label: string,
  current: unknown,
  options: (number | string | { v: unknown; l: string })[],
): string {
  const buttons = options
    .map((o) => {
      const v = typeof o === "object" ? o.v : o;
      const l = typeof o === "object" ? o.l : String(o);
      const on = String(v) === String(current);
      return `<button class="${on ? "is-on" : ""}" data-act="rule" data-key="${key}" data-val="${v}">${l}</button>`;
    })
    .join("");
  return `<div class="setting"><label>${label}</label><div class="seg">${buttons}</div></div>`;
}

function tog(key: string, label: string, on: boolean): string {
  return `<div class="setting"><label>${label}</label>
    <button class="toggle ${on ? "is-on" : ""}" data-act="rule" data-key="${key}" data-val="${!on}" aria-pressed="${on}"></button>
  </div>`;
}

function renderChart(snap: GameSnapshot): string {
  const c = displayChart(snap.rules);
  const r = snap.rules;
  const head = `<tr><th class="rlab"></th>${c.ups.map((u) => `<th>${u === 1 ? "A" : u}</th>`).join("")}</tr>`;
  const cell = (a: { action: string }) => {
    const cls =
      a.action === "hit"
        ? "c-hit"
        : a.action === "stand"
          ? "c-stand"
          : a.action === "double"
            ? "c-double"
            : a.action === "split"
              ? "c-split"
              : "c-surrender";
    const letter =
      a.action === "hit"
        ? "H"
        : a.action === "stand"
          ? "S"
          : a.action === "double"
            ? "D"
            : a.action === "split"
              ? "P"
              : "R";
    return `<td class="${cls}">${letter}</td>`;
  };
  const block = (title: string, rows: { label?: string; total?: number; pair?: number; cells: { action: string }[] }[]) =>
    `<h3 style="margin-top:14px">${title}</h3>
     <div class="chart-wrap"><table class="chart">${head}${rows
       .map((row) => {
         const lab = row.label ?? String(row.total ?? row.pair);
         return `<tr><td class="rlab">${lab}</td>${row.cells.map(cell).join("")}</tr>`;
       })
       .join("")}</table></div>`;

  return `
    <p class="help-body">${r.decks} deck${r.decks > 1 ? "s" : ""} · ${r.hitSoft17 ? "H17" : "S17"} · ${
      r.das ? "DAS" : "no DAS"
    } · ${r.surrender === "late" ? "late surrender" : "no surrender"} · double ${r.doubleOn}. Insurance is never taken.</p>
    <div class="chart-legend">
      <span><i class="swatch c-hit" style="background:#c41e1e"></i> Hit</span>
      <span><i class="swatch c-stand" style="background:#f0d44c"></i> Stand</span>
      <span><i class="swatch c-double" style="background:#1c6dd6"></i> Double</span>
      <span><i class="swatch c-split" style="background:#1b8a4a"></i> Split</span>
      <span><i class="swatch" style="background:#f4f0e4"></i> Surrender</span>
    </div>
    ${block("HARD TOTALS", c.hard.map((r) => ({ total: r.total, cells: r.cells })))}
    ${block("SOFT TOTALS", c.soft.map((r) => ({ label: r.label, cells: r.cells })))}
    ${block("PAIRS", c.splits.map((r) => ({ label: r.label, cells: r.cells })))}
    <p class="help-body">5,5 is played as a hard 10 (never split). 10,10 is played as a hard 20.</p>
  `;
}

function renderStats(stats: Stats): string {
  const acc = accuracy(stats);
  const kind = (k: keyof Stats["byKind"], label: string) => {
    const s = stats.byKind[k];
    const a = accuracy(s);
    return `<div class="stat-card"><div class="l">${label}</div><div class="n">${a === null ? "—" : a + "%"}</div><div class="l">${s.correct}/${s.decisions}</div></div>`;
  };
  return `
    <div class="stats-grid">
      <div class="stat-card"><div class="l">Accuracy</div><div class="n">${acc === null ? "—" : acc + "%"}</div><div class="l">${stats.correct} of ${stats.decisions}</div></div>
      <div class="stat-card"><div class="l">Streak</div><div class="n">${stats.streak}</div><div class="l">best ${stats.bestStreak}</div></div>
      <div class="stat-card"><div class="l">Hands</div><div class="n">${stats.handsPlayed}</div></div>
      <div class="stat-card"><div class="l">Net chips</div><div class="n">${stats.netChips >= 0 ? "+" : ""}${formatChips(stats.netChips)}</div><div class="l">high ${formatChips(stats.highBankroll)}</div></div>
    </div>
    <h3 style="font-family:'Press Start 2P',monospace;font-size:8px;color:var(--gold);margin:18px 0 8px">BY SPOT</h3>
    <div class="stats-grid">
      ${kind("hard", "Hard totals")}
      ${kind("soft", "Soft totals")}
      ${kind("pair", "Pairs")}
      ${kind("surrender", "Surrender")}
      ${kind("insurance", "Insurance")}
    </div>
    <div class="actions-row one" style="margin-top:18px">
      <button class="btn btn-ghost" data-act="reset-stats">RESET STATS</button>
    </div>
  `;
}

function renderHelp(first: boolean): string {
  return `<div class="help-body">
    ${first ? "<p>Welcome to Blackjack Coach — a quick practice table with a strategy coach looking over your shoulder.</p>" : ""}
    <p>Play regular blackjack. After every move, the coach checks basic strategy for <strong>your table rules</strong> — decks, soft 17, double after split, surrender, the works. The chart in the menu updates to match.</p>
    <p>If you play it by the book, you get a little thumbs-up and the hand keeps going, whether you win or lose. If you don't, the game pauses and tells you what the book says, and why, so you'll have it the next time that spot comes up.</p>
    <p>Change the table in Settings. Turn on Drill mode to practice only the tricky hands. Other seats, if you add them, are bots that play perfect basic strategy and eat cards from the same shoe.</p>
    <p>Insurance is never the book play. 5s and 10s are never split.</p>
    <div class="actions-row one" style="margin-top:16px">
      <button class="btn btn-deal" data-act="close">${first ? "LET'S PLAY" : "CLOSE"}</button>
    </div>
  </div>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// keep cardHtml referenced for possible future use
void cardHtml;
