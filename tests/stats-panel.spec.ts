import { test, expect, type Page } from "@playwright/test";
import type { Stats } from "../src/store";

const RICH: Stats = {
  handsPlayed: 24,
  decisions: 31,
  correct: 22,
  streak: 4,
  bestStreak: 9,
  byKind: {
    hard: { decisions: 18, correct: 13 },
    soft: { decisions: 6, correct: 5 },
    pair: { decisions: 4, correct: 3 },
    surrender: { decisions: 2, correct: 1 },
    insurance: { decisions: 1, correct: 0 },
  },
  netChips: 80,
  highBankroll: 1200,
  mistakes: [
    {
      id: "m1",
      at: 1,
      kind: "hard",
      spot: "Hard 12 vs 3",
      you: "stand",
      book: "hit",
      why: "A 12 against a dealer 3 is a stiff hand, but the book still hits. Standing gives the dealer too many chances to finish a modest upcard without busting often enough to justify it.",
    },
    {
      id: "m2",
      at: 2,
      kind: "soft",
      spot: "Soft 18 vs 9",
      you: "stand",
      book: "hit",
      why: "Soft 18 looks strong, but against a dealer 9 the book hits (or doubles when the two-card rule allows). Standing leaves you under a dealer who makes a lot of 19s and 20s.",
    },
    {
      id: "m3",
      at: 3,
      kind: "pair",
      spot: "Pair of 8s vs 10",
      you: "stand",
      book: "split",
      why: "Always split 8s. Sixteen is a losing total; two hands starting with 8 give you a much better chance.",
    },
    {
      id: "m4",
      at: 4,
      kind: "hard",
      spot: "Hard 16 vs 10",
      you: "stand",
      book: "hit",
      why: "Hard 16 vs 10 is a painful spot. Hitting loses less in the long run than standing on a total the dealer beats most of the time.",
    },
    {
      id: "m5",
      at: 5,
      kind: "insurance",
      spot: "Insurance vs A",
      you: "insurance_yes",
      book: "insurance_no",
      why: "Insurance is never the book play. The true odds of a dealer blackjack don't beat the 2-to-1 payout.",
    },
  ],
  byDealer: {
    "2": { decisions: 3, correct: 3 },
    "3": { decisions: 4, correct: 2 },
    "4": { decisions: 3, correct: 3 },
    "5": { decisions: 2, correct: 2 },
    "6": { decisions: 3, correct: 2 },
    "7": { decisions: 3, correct: 3 },
    "8": { decisions: 2, correct: 1 },
    "9": { decisions: 3, correct: 2 },
    "10": { decisions: 6, correct: 3 },
    A: { decisions: 2, correct: 1 },
  },
  results: {
    wins: 11,
    losses: 9,
    pushes: 4,
    blackjacks: 2,
    busts: 4,
    surrenders: 1,
    dealerBusts: 3,
  },
};

async function boot(page: Page, stats: Stats | null = RICH, seats = 1) {
  await page.addInitScript(
    ({ stats, seats }) => {
      localStorage.setItem(
        "bj-coach-v1",
        JSON.stringify({
          rules: {
            decks: 6,
            hitSoft17: true,
            das: true,
            doubleOn: "any",
            maxHands: 4,
            resplitAces: false,
            hitSplitAces: false,
            surrender: "none",
            blackjackPayout: "3:2",
            insuranceOffered: false,
            dealerPeek: true,
            minBet: 10,
            bankroll: 1000,
            perfectPairs: false,
            twentyOnePlusThree: false,
            seats,
            sound: false,
            drillMode: false,
          },
          bankroll: 1000,
          stats: stats ?? {
            handsPlayed: 0,
            decisions: 0,
            correct: 0,
            streak: 0,
            bestStreak: 0,
            byKind: {
              hard: { decisions: 0, correct: 0 },
              soft: { decisions: 0, correct: 0 },
              pair: { decisions: 0, correct: 0 },
              surrender: { decisions: 0, correct: 0 },
              insurance: { decisions: 0, correct: 0 },
            },
            netChips: 0,
            highBankroll: 1000,
            mistakes: [],
            byDealer: {
              "2": { decisions: 0, correct: 0 },
              "3": { decisions: 0, correct: 0 },
              "4": { decisions: 0, correct: 0 },
              "5": { decisions: 0, correct: 0 },
              "6": { decisions: 0, correct: 0 },
              "7": { decisions: 0, correct: 0 },
              "8": { decisions: 0, correct: 0 },
              "9": { decisions: 0, correct: 0 },
              "10": { decisions: 0, correct: 0 },
              A: { decisions: 0, correct: 0 },
            },
            results: {
              wins: 0,
              losses: 0,
              pushes: 0,
              blackjacks: 0,
              busts: 0,
              surrenders: 0,
              dealerBusts: 0,
            },
          },
          seenHelp: true,
          pendingBet: 10,
        }),
      );
    },
    { stats, seats },
  );
  await page.goto("./");
  await page.getByRole("button", { name: /Open stats/i }).waitFor();
}

test.describe("stats panel", () => {
  test.use({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 });

  test("the top-bar badge opens a sheet that explains the calculations", async ({ page }) => {
    await boot(page);
    const badge = page.getByRole("button", { name: /Open stats: 71 percent accuracy, streak 4/i });
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("71%");
    await expect(badge).toContainText("4 STRK");
    await badge.click();

    const panel = page.locator(".panel");
    await expect(panel.getByRole("heading", { name: "YOUR STATS" })).toBeVisible();
    await expect(panel.getByText("22 of 31 decisions")).toBeVisible();
    await expect(panel.getByText(/made the book play/i)).toBeVisible();
    await expect(panel.getByText(/hit, stand, double, split, surrender, or insurance/i)).toBeVisible();
    await expect(panel.getByText(/not how often you won/i)).toBeVisible();
    await expect(panel.getByText("consecutive correct decisions")).toBeVisible();
    await expect(panel.getByText("Hard totals")).toBeVisible();
    await expect(panel.getByText("13 of 18 · 72%")).toBeVisible();
    await expect(panel.getByText("Soft totals")).toBeVisible();
    await expect(panel.getByText("Pairs", { exact: true })).toBeVisible();
    await expect(panel.getByText("Surrender", { exact: true })).toBeVisible();
    await expect(panel.getByText("Insurance", { exact: true })).toBeVisible();
    await expect(panel.getByText("By dealer upcard")).toBeVisible();
    await expect(panel.getByText("Hard 12 vs 3")).toBeVisible();
    await expect(panel.getByText("you stood, book says hit").first()).toBeVisible();
    await expect(panel.getByText("11 wins · 9 losses · 4 pushes")).toBeVisible();
    await expect(panel.getByText(/separate from accuracy/i)).toBeVisible();
    await expect(panel.getByRole("button", { name: "RESET STATS" })).toBeVisible();

    await page.screenshot({
      path: "/workspace/side-projects/blackjack-coach/screenshots/stats-panel-393x852.png",
      animations: "disabled",
    });
    await page.screenshot({
      path: "/workspace/side-projects/blackjack-coach/screenshots/06-stats.png",
      animations: "disabled",
    });

    // Expand a mistake to show the why.
    await panel.getByText("Hard 12 vs 3").click();
    await expect(panel.getByText(/A 12 against a dealer 3/i)).toBeVisible();
    await page.screenshot({
      path: "/workspace/side-projects/blackjack-coach/screenshots/stats-panel-mistakes-393x852.png",
      animations: "disabled",
    });
  });

  test("reset requires a confirm and then clears all-time stats", async ({ page }) => {
    await boot(page);
    await page.getByRole("button", { name: /Open stats/i }).click();
    const panel = page.locator(".panel");
    await panel.getByRole("button", { name: "RESET STATS" }).click();
    await expect(panel.getByText(/does not change your bankroll/i)).toBeVisible();
    // Cancel keeps the numbers.
    await panel.getByRole("button", { name: "CANCEL" }).click();
    await expect(panel.getByText("22 of 31 decisions")).toBeVisible();
    await expect(panel.getByRole("button", { name: "RESET STATS" })).toBeVisible();

    await panel.getByRole("button", { name: "RESET STATS" }).click();
    await panel.getByRole("button", { name: "YES, RESET" }).click();
    await expect(panel.getByText("0 of 0 decisions")).toBeVisible();
    await expect(panel.getByText("Hard 12 vs 3")).toHaveCount(0);
    // Badge updates too (still open... panel is open, badge is under it).
    // Close and check the badge shows STATS with no percent.
    await panel.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("button", { name: "Open stats" })).toContainText("STATS");
  });

  test("a wrong play is listed as a recent mistake, and Escape closes the panel", async ({ page }) => {
    await boot(page, null);
    await page.evaluate(() => {
      (window as unknown as { __BJ: { dealScenario: (s: string) => void } }).__BJ.dealScenario(
        "10h 10s 6c 8d 4h",
      );
    });
    // 10+6=16 vs 10: book is HIT. Stand is wrong.
    await page.getByRole("button", { name: "STAND" }).click();
    await expect(page.getByText(/Not the book play/i)).toBeVisible();
    await page.getByRole("button", { name: "GOT IT" }).click();
    await page.getByRole("button", { name: /Open stats/i }).click();
    const panel = page.locator(".panel");
    // Fresh session + all-time should include this miss.
    await expect(panel.getByText("Hard 16 vs 10")).toBeVisible();
    await expect(panel.getByText("you stood, book says hit")).toBeVisible();
    await expect(panel.getByText("0 of 1 decisions")).toBeVisible();
    await panel.getByRole("tab", { name: "THIS SESSION" }).click();
    await expect(panel.getByText("0 of 1 decisions")).toBeVisible();
    await expect(panel.getByText("Hard 16 vs 10")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
  });
});
