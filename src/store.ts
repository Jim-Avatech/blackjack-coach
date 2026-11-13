import { DEFAULT_RULES, type TableRules } from "./engine/types";

export interface KindStats {
  decisions: number;
  correct: number;
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
}

export function emptyStats(bankroll = DEFAULT_RULES.bankroll): Stats {
  const z = { decisions: 0, correct: 0 };
  return {
    handsPlayed: 0,
    decisions: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    byKind: { hard: { ...z }, soft: { ...z }, pair: { ...z }, surrender: { ...z }, insurance: { ...z } },
    netChips: 0,
    highBankroll: bankroll,
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
    const p = JSON.parse(raw) as Persist;
    return {
      rules: { ...DEFAULT_RULES, ...p.rules },
      bankroll: typeof p.bankroll === "number" ? p.bankroll : fallback.bankroll,
      stats: { ...emptyStats(), ...p.stats, byKind: { ...emptyStats().byKind, ...p.stats?.byKind } },
      seenHelp: !!p.seenHelp,
      pendingBet: typeof p.pendingBet === "number" ? p.pendingBet : fallback.pendingBet,
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

export function recordDecision(
  stats: Stats,
  kind: keyof Stats["byKind"],
  correct: boolean,
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
  }
  return next;
}

export function accuracy(s: { decisions: number; correct: number }): number | null {
  if (s.decisions === 0) return null;
  return Math.round((s.correct / s.decisions) * 100);
}
