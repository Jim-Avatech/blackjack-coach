import { test, expect, type Page } from "@playwright/test";

async function boot(page: Page, seats = 1) {
  await page.addInitScript((seats) => {
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
  }, seats);
  await page.goto("./");
  await page.getByRole("button", { name: "DEAL" }).waitFor();
}

async function midFlightClip(page: Page) {
  await page.evaluate(() => {
    const s = document.createElement("style");
    s.id = "slow-deal";
    s.textContent =
      ".bj-card.is-dealt { animation-duration: 60s !important; animation-timing-function: linear !important; }";
    document.head.appendChild(s);
  });
}

async function finishAnims(page: Page) {
  await page.evaluate(() => {
    for (const c of document.querySelectorAll(".bj-card")) {
      for (const a of c.getAnimations()) a.finish();
    }
  });
}

type Clip = {
  count: number;
  clippedRight: number;
  clippedLeft: number;
  clippedTop: number;
  clippedBottom: number;
  overflowViewportRight: number;
  overflowViewportLeft: number;
  opacity: number;
  atRest: boolean;
  filter: string;
  insidePaintBox: boolean;
  paintOverflow: { t: number; r: number; b: number; l: number };
};

async function measureLast(page: Page, pauseAt = 0.45): Promise<Clip> {
  return page.evaluate((pauseAt) => {
    const cards = [...document.querySelectorAll(".player-area .one-hand.is-active .bj-card, .player-area .bj-card")];
    const last = cards[cards.length - 1] as HTMLElement | undefined;
    if (!last) throw new Error("no player card");
    const anims = last.getAnimations();
    if (anims[0] && pauseAt >= 0) {
      const d = (anims[0].effect?.getComputedTiming?.().duration as number) ?? 60000;
      anims[0].currentTime = d * pauseAt;
      anims[0].pause();
    }
    const r = last.getBoundingClientRect();
    const vis = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    let n: HTMLElement | null = last.parentElement;
    while (n) {
      const s = getComputedStyle(n);
      if (s.overflowX !== "visible" || s.overflowY !== "visible") {
        const ar = n.getBoundingClientRect();
        vis.left = Math.max(vis.left, ar.left);
        vis.top = Math.max(vis.top, ar.top);
        vis.right = Math.min(vis.right, ar.right);
        vis.bottom = Math.min(vis.bottom, ar.bottom);
      }
      n = n.parentElement;
    }
    const cs = getComputedStyle(last);
    const tr = cs.transform;
    const atRest = tr === "none" || tr === "matrix(1, 0, 0, 1, 0, 0)";
    const paint = last.closest(".bj-cards")?.getBoundingClientRect();
    const paintOverflow = paint
      ? {
          t: Math.max(0, paint.top - r.top),
          r: Math.max(0, r.right - paint.right),
          b: Math.max(0, r.bottom - paint.bottom),
          l: Math.max(0, paint.left - r.left),
        }
      : { t: 99, r: 99, b: 99, l: 99 };
    return {
      count: cards.length,
      clippedRight: Math.max(0, r.right - vis.right),
      clippedLeft: Math.max(0, vis.left - r.left),
      clippedTop: Math.max(0, vis.top - r.top),
      clippedBottom: Math.max(0, r.bottom - vis.bottom),
      overflowViewportRight: Math.max(0, r.right - window.innerWidth),
      overflowViewportLeft: Math.max(0, -r.left),
      opacity: parseFloat(cs.opacity),
      atRest,
      filter: cs.filter,
      insidePaintBox: Object.values(paintOverflow).every((v) => v < 0.6),
      paintOverflow,
    };
  }, pauseAt);
}

function expectUnclipped(mid: Clip, label: string) {
  expect(mid.clippedRight, `${label} right`).toBeLessThan(1);
  expect(mid.clippedLeft, `${label} left`).toBeLessThan(1);
  expect(mid.clippedTop, `${label} top`).toBeLessThan(1);
  expect(mid.clippedBottom, `${label} bottom`).toBeLessThan(1);
  expect(mid.overflowViewportRight, `${label} vp right`).toBeLessThan(1);
  expect(mid.opacity, `${label} opacity`).toBeGreaterThan(0.95);
  expect(mid.filter === "none" || mid.filter === "", `${label} filter=${mid.filter}`).toBe(true);
  expect(mid.insidePaintBox, `${label} paint ${JSON.stringify(mid.paintOverflow)}`).toBe(true);
}

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "375x667", width: 375, height: 667 },
  { name: "393x852", width: 393, height: 852 },
  { name: "430x932", width: 430, height: 932 },
];

for (const vp of VIEWPORTS) {
  test.describe(`deal-in clip ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("a hit card stays fully visible mid-animation and lands opaque at rest", async ({ page }) => {
      await boot(page);
      await page.evaluate(() => {
        (window as unknown as { __BJ: { dealScenario: (s: string) => void } }).__BJ.dealScenario(
          "7c 7s 2s 8d Kh",
        );
      });
      await page.getByRole("button", { name: "HIT" }).waitFor();
      await finishAnims(page);
      await midFlightClip(page);
      await page.getByRole("button", { name: "HIT" }).click();
      await page.waitForTimeout(50);
      const mid = await measureLast(page, 0.45);
      expect(mid.count).toBe(3);
      expectUnclipped(mid, `hit mid ${vp.name}`);

      await finishAnims(page);
      const rest = await measureLast(page, -1);
      expect(rest.opacity).toBe(1);
      expect(rest.atRest).toBe(true);
      expectUnclipped(rest, `hit rest ${vp.name}`);
    });

    test("a hit card stays inside its paint box even if ancestors clip", async ({ page }) => {
      await boot(page);
      await page.evaluate(() => {
        (window as unknown as { __BJ: { dealScenario: (s: string) => void } }).__BJ.dealScenario(
          "7c 7s 2s 8d Kh",
        );
      });
      await page.getByRole("button", { name: "HIT" }).waitFor();
      await finishAnims(page);
      await midFlightClip(page);
      // Simulate iOS turning flex-item overflow:visible into a scrollport.
      await page.evaluate(() => {
        const sels = [".bj-cards", ".one-hand", ".hands-row", ".player-area", ".table", ".dealer-area"];
        for (const sel of sels) {
          for (const el of document.querySelectorAll<HTMLElement>(sel)) {
            el.style.setProperty("overflow", "hidden", "important");
          }
        }
      });
      await page.getByRole("button", { name: "HIT" }).click();
      await page.waitForTimeout(50);
      const mid = await measureLast(page, 0.45);
      expect(mid.count).toBe(3);
      expectUnclipped(mid, `forced-clip mid ${vp.name}`);
    });

    test("a 5+ card hand stays centered and unclipped", async ({ page }) => {
      await boot(page);
      await page.evaluate(() => {
        (window as unknown as { __BJ: { dealScenario: (s: string) => void } }).__BJ.dealScenario(
          "2c 2s 3s 8d 2h 2d 2c 2s",
        );
      });
      await page.getByRole("button", { name: "HIT" }).waitFor();
      for (let i = 0; i < 4; i++) {
        await finishAnims(page);
        const hit = page.getByRole("button", { name: "HIT" });
        if (await hit.isVisible()) await hit.click();
        else break;
        await page.waitForTimeout(40);
      }
      await finishAnims(page);
      const info = await page.evaluate(() => {
        const cards = [...document.querySelectorAll(".player-area .bj-card")];
        const boxes = cards.map((c) => c.getBoundingClientRect());
        const left = Math.min(...boxes.map((b) => b.left));
        const right = Math.max(...boxes.map((b) => b.right));
        const mid = (left + right) / 2;
        return {
          n: cards.length,
          left,
          right,
          width: right - left,
          mid,
          viewportMid: window.innerWidth / 2,
          overflowR: Math.max(0, right - window.innerWidth + 2),
          overflowL: Math.max(0, 2 - left),
        };
      });
      expect(info.n).toBeGreaterThanOrEqual(5);
      expect(info.overflowR).toBeLessThan(2);
      expect(info.overflowL).toBeLessThan(2);
      expect(Math.abs(info.mid - info.viewportMid)).toBeLessThan(30);
    });
  });
}

test("double-down card is unclipped mid-deal at 393x852", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page);
  await page.evaluate(() => {
    (window as unknown as { __BJ: { dealScenario: (s: string) => void } }).__BJ.dealScenario(
      "5c 6s 4s 8d Kh",
    );
  });
  await page.getByRole("button", { name: "DOUBLE" }).waitFor();
  await finishAnims(page);
  await midFlightClip(page);
  await page.getByRole("button", { name: "DOUBLE" }).click();
  await page.waitForTimeout(50);
  const mid = await measureLast(page, 0.45);
  expect(mid.count).toBe(3);
  expectUnclipped(mid, "double mid 393");
});

test("split hands stay unclipped at 393x852", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page);
  await page.evaluate(() => {
    (window as unknown as { __BJ: { dealScenario: (s: string) => void } }).__BJ.dealScenario(
      "8c 6s 8s 9d 3h 10d",
    );
  });
  await page.getByRole("button", { name: "SPLIT" }).waitFor();
  await finishAnims(page);
  await midFlightClip(page);
  await page.getByRole("button", { name: "SPLIT" }).click();
  await page.waitForTimeout(50);
  const mid = await measureLast(page, 0.45);
  expect(mid.count).toBeGreaterThanOrEqual(3);
  expectUnclipped(mid, "split mid 393");
  await finishAnims(page);
  const rest = await measureLast(page, -1);
  expectUnclipped(rest, "split rest 393");
});

test("3-seat table player hit is unclipped at 393x852", async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await boot(page, 3);
  // Deal order for 3 seats (human is the middle seat):
  // S0-P1, Human-P1, S2-P1, Dealer-up, S0-P2, Human-P2, S2-P2, Dealer-hole, extras.
  // Bots get 20 and 19 so they stand and leave Kh for the human's hit.
  await page.evaluate(() => {
    (window as unknown as { __BJ: { dealScenario: (s: string) => void } }).__BJ.dealScenario(
      "10c 7c 10d 7s 10s 2s 9c 8d Kh",
    );
  });
  await page.getByRole("button", { name: "HIT" }).waitFor({ timeout: 5000 });
  await finishAnims(page);
  await midFlightClip(page);
  const before = await page.locator(".player-area .bj-card").count();
  await page.getByRole("button", { name: "HIT" }).click();
  await page.waitForFunction(
    (n) => document.querySelectorAll(".player-area .bj-card").length > n,
    before,
    { timeout: 3000 },
  );
  const mid = await measureLast(page, 0.45);
  expect(mid.count).toBeGreaterThanOrEqual(3);
  expectUnclipped(mid, "3-seat mid 393");
});
