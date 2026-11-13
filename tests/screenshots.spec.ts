import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../screenshots");

async function shot(page: import("@playwright/test").Page, name: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, name), animations: "disabled" });
}

test.describe("iPhone-sized screenshots", () => {
  test("betting, a hand in play, and a wrong-play coach", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("button", { name: "LET'S PLAY" }).click();
    await expect(page.getByRole("button", { name: "DEAL" })).toBeVisible();
    await shot(page, "01-betting.png");

    // Forced 16 vs 9 (player 10+6, dealer 9). Book is HIT (no surrender by default).
    await page.evaluate(() => {
      const w = window as unknown as { __BJ: { dealScenario: (s: string) => void } };
      w.__BJ.dealScenario("10h 9s 6c 7d");
    });
    await expect(page.getByRole("button", { name: "HIT" })).toBeVisible();
    await expect(page.locator(".bj-card").first()).toBeVisible();
    await shot(page, "02-hand.png");

    // Stand is wrong — coach should pause with an explanation.
    await page.getByRole("button", { name: "STAND" }).click();
    await expect(page.getByRole("button", { name: "GOT IT" })).toBeVisible();
    await shot(page, "03-coach.png");
  });

  test("settings and strategy chart", async ({ page }) => {
    await page.addInitScript(() => {
      const { DEFAULT_RULES } = { DEFAULT_RULES: null };
      void DEFAULT_RULES;
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
            surrender: "late",
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
          },
          bankroll: 1000,
          stats: {
            decisions: 0,
            correct: 0,
            streak: 0,
            bestStreak: 0,
            handsPlayed: 0,
            netChips: 0,
            highBankroll: 1000,
            byKind: {
              hard: { decisions: 0, correct: 0 },
              soft: { decisions: 0, correct: 0 },
              pair: { decisions: 0, correct: 0 },
              surrender: { decisions: 0, correct: 0 },
              insurance: { decisions: 0, correct: 0 },
            },
          },
          seenHelp: true,
          pendingBet: 10,
        }),
      );
    });
    await page.goto("./");
    await expect(page.getByRole("button", { name: "DEAL" })).toBeVisible();
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "TABLE SETTINGS" }).click();
    await expect(page.getByText("Shoe & dealer")).toBeVisible();
    await shot(page, "04-settings.png");
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("button", { name: "STRATEGY CHART" }).click();
    await expect(page.getByText("HARD TOTALS")).toBeVisible();
    await shot(page, "05-chart.png");
  });
});
