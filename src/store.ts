import { DEFAULT_RULES, type HandOutcome, type PlayerAction, type TableRules } from "./engine/types";

export interface KindStats {
  decisions: number;
  correct: number;
}

export type DealerKey = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "A";

export const DEALER_KEYS: DealerKey[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "A"];

export interface Mistake {
  id: string;
  at: number;
  kind: keyof Stats["byKind"];
  /** Short label, e.g. "Hard 12 vs 3". */
  spot: string;
  you: PlayerAction;
  book: PlayerAction;
  why: string;
}

export interface Results {
  /** win + blackjack + dealer_bust */
  wins: number;
  /** lose + bust + surrender */
  losses: number;
  pushes: number;
  blackjacks: number;
  busts: number;
  surrenders: number;
  dealerBusts: number;
}

export interface Stats {
  handsPlayed: number;
  decisions: number;
  correct: number;
  streak: number;
  bestStreak: number;
  byKind: {
    hard: KindStats;
    soft: KindStats;
    pair: KindStats;
    surrender: KindStats;
    insurance: KindStats;
  };
  netChips: number;
  highBankroll: number;
  mistakes: Mistake[];
  byDealer: Record<DealerKey, KindStats>;
  results: Results;
}

export const KIND_KEYS = ["hard", "soft", "pair", "surrender", "insurance"] as const;
export const MISTAKE_LIMIT = 10;

export function emptyKind(): KindStats {
  return { decisions: 0, correct: 0 };
}

export function emptyByDealer(): Record<DealerKey, KindStats> {
  const out = {} as Record<DealerKey, KindStats>;
  for (const k of DEALER_KEYS) out[k] = emptyKind();
  return out;
}

export function emptyResults(): Results {
  return { wins: 0, losses: 0, pushes: 0, blackjacks: 0, busts: 0, surrenders: 0, dealerBusts: 0 };
}

export function emptyStats(bankroll = DEFAULT_RULES.bankroll): Stats {
  const z = emptyKind();
  return {
    handsPlayed: 0,
    decisions: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    byKind: { hard: { ...z }, soft: { ...z }, pair: { ...z }, surrender: { ...z }, insurance: { ...z } },
    netChips: 0,
    highBankroll: bankroll,
    mistakes: [],
    byDealer: emptyByDealer(),
    results: emptyResults(),
  };
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function migrateKind(raw: unknown): KindStats {
  const r = raw && typeof raw === "object" ? (raw as KindStats) : emptyKind();
  return { decisions: num(r.decisions), correct: num(r.correct) };
}

function migrateMistake(raw: unknown, i: number): Mistake | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<Mistake>;
  if (!m.spot || !m.you || !m.book) return null;
  return {
    id: typeof m.id === "string" ? m.id : `m-${i}-${num(m.at, Date.now())}`,
    at: num(m.at, 0),
    kind: KIND_KEYS.includes(m.kind as (typeof KIND_KEYS)[number]) ? (m.kind as Mistake["kind"]) : "hard",
    spot: String(m.spot),
    you: m.you,
    book: m.book,
    why: typeof m.why === "string" ? m.why : "",
  };
}

/** Merge a stored stats object with today's shape without wiping existing counts. */
export function migrateStats(raw: unknown, bankroll = DEFAULT_RULES.bankroll): Stats {
  const base = emptyStats(bankroll);
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Partial<Stats> & { byKind?: Partial<Stats["byKind"]> };
  const byKind = { ...base.byKind };
  for (const k of KIND_KEYS) {
    byKind[k] = migrateKind(s.byKind?.[k]);
  }
  const byDealer = emptyByDealer();
  if (s.byDealer && typeof s.byDealer === "object") {
    for (const k of DEALER_KEYS) {
      if (s.byDealer[k]) byDealer[k] = migrateKind(s.byDealer[k]);
    }
  }
  const results = { ...emptyResults(), ...(s.results && typeof s.results === "object" ? s.results : {}) };
  for (const key of Object.keys(results) as (keyof Results)[]) {
    results[key] = num(results[key]);
  }
  const mistakes = Array.isArray(s.mistakes)
    ? s.mistakes.map(migrateMistake).filter((m): m is Mistake => m !== null).slice(0, MISTAKE_LIMIT)
    : [];
  return {
    handsPlayed: num(s.handsPlayed),
    decisions: num(s.decisions),
    correct: num(s.correct),
    streak: num(s.streak),
    bestStreak: num(s.bestStreak),
    byKind,
    netChips: num(s.netChips),
    highBankroll: num(s.highBankroll, bankroll),
    mistakes,
    byDealer,
    results,
  };
}

export interface Persist {
  rules: TableRules;
  bankroll: number;
  stats: Stats;
  seenHelp: boolean;
  pendingBet: number;
}

const KEY = "bj-coach-v1";

export function load(): Persist {
  const fallback: Persist = {
    rules: { ...DEFAULT_RULES },
    bankroll: DEFAULT_RULES.bankroll,
    stats: emptyStats(),
    seenHelp: false,
    pendingBet: DEFAULT_RULES.minBet,
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<Persist>;
    const bankroll = num(p.bankroll, fallback.bankroll);
    return {
      rules: { ...DEFAULT_RULES, ...p.rules },
      bankroll,
      stats: migrateStats(p.stats, bankroll),
      seenHelp: !!p.seenHelp,
      pendingBet: num(p.pendingBet, fallback.pendingBet),
    };
  } catch {
    return fallback;
  }
}

export function save(p: Persist): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode / full */
  }
}

export interface DecisionDetail {
  spot: string;
  you: PlayerAction;
  book: PlayerAction;
  why: string;
  /** 1 = ace, 2–10 otherwise. */
  dealerUp: number;
}

export function dealerKey(up: number): DealerKey {
  if (up === 1 || up === 11) return "A";
  if (up >= 10) return "10";
  if (up >= 2 && up <= 9) return String(up) as DealerKey;
  return "10";
}

export function recordDecision(
  stats: Stats,
  kind: keyof Stats["byKind"],
  correct: boolean,
  detail?: DecisionDetail,
): Stats {
  const next = structuredClone(stats);
  next.decisions += 1;
  next.byKind[kind].decisions += 1;
  if (correct) {
    next.correct += 1;
    next.byKind[kind].correct += 1;
    next.streak += 1;
    if (next.streak > next.bestStreak) next.bestStreak = next.streak;
  } else {
    next.streak = 0;
    if (detail) {
      next.mistakes.unshift({
        id: `${detail.spot}-${detail.you}-${Date.now()}-${next.decisions}`,
        at: Date.now(),
        kind,
        spot: detail.spot,
        you: detail.you,
        book: detail.book,
        why: detail.why,
      });
      if (next.mistakes.length > MISTAKE_LIMIT) next.mistakes.length = MISTAKE_LIMIT;
    }
  }
  if (detail) {
    const dk = dealerKey(detail.dealerUp);
    next.byDealer[dk].decisions += 1;
    if (correct) next.byDealer[dk].correct += 1;
  }
  return next;
}

export function recordRound(
  stats: Stats,
  opts: { net: number; outcomes: HandOutcome[]; bankroll: number },
): Stats {
  const next = structuredClone(stats);
  next.handsPlayed += 1;
  next.netChips += opts.net;
  next.highBankroll = Math.max(next.highBankroll, opts.bankroll);
  for (const o of opts.outcomes) {
    if (o === "win" || o === "blackjack" || o === "dealer_bust") next.results.wins += 1;
    else if (o === "push") next.results.pushes += 1;
    else next.results.losses += 1;
    if (o === "blackjack") next.results.blackjacks += 1;
    if (o === "bust") next.results.busts += 1;
    if (o === "surrender") next.results.surrenders += 1;
    if (o === "dealer_bust") next.results.dealerBusts += 1;
  }
  return next;
}

export function accuracy(s: { decisions: number; correct: number }): number | null {
  if (s.decisions === 0) return null;
  return Math.round((s.correct / s.decisions) * 100);
}

export function resultsCounted(r: Results): number {
  return r.wins + r.losses + r.pushes;
}
