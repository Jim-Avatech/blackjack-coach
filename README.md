# Blackjack Coach

A phone-friendly, pixel-art blackjack practice game. Play regular hands, and a coach checks every decision against **basic strategy for the table rules you picked**.

**Play it:** [https://jim-avatech.github.io/blackjack-coach/](https://jim-avatech.github.io/blackjack-coach/)

Works in iPhone Safari. Add it to your Home Screen for a full-screen app.

## How it coaches

- If you play a hand by the book, you get a small thumbs-up and the game keeps moving — win or lose doesn't matter.
- If you don't, it pauses and tells you what you did, what the book says, and why, so you'll have it the next time that spot comes up.

The strategy tables are total-dependent basic strategy from [Wizard of Odds](https://wizardofodds.com/games/blackjack/strategy/), and they change with the number of decks, whether the dealer hits or stands on soft 17, double-after-split, surrender, and double restrictions.

Insurance is never the book play.

## Table settings

- Decks: 1, 2, 4, 6, or 8
- Dealer hits or stands on soft 17 (H17 / S17)
- Double after split (DAS)
- Double on any two cards, 9–11 only, or 10–11 only
- Split up to 2, 3, or 4 hands
- Resplit aces, hit split aces
- Late surrender or none
- Blackjack pays 3:2 or 6:5
- Insurance offered (correct play is still "no")
- Minimum bet and starting bankroll
- Side bets: Perfect Pairs (25 / 12 / 6 to 1) and 21+3 (100 / 40 / 30 / 10 / 5 to 1)
- 1–5 seats; other seats are bots that play basic strategy and take cards from the same shoe
- Drill mode: deals only tricky spots (12 vs 2–3, soft 18, 16 vs 10, pair splits, and so on)

Settings, bankroll, and accuracy stats (streak, percent correct, breakdown by hard / soft / pair / surrender / insurance) are saved in your browser.

## Rules of the game

Standard American blackjack: dealer peeks for blackjack on a 10 or ace. Split aces get one card each unless you turn on "hit split aces." A 21 after a split is not a blackjack. The shoe shuffles at about 75% penetration.

## Develop

```bash
npm install
npm test        # unit tests for the engine and strategy charts
npm run dev
npm run build
```

Strategy tests check every published Wizard of Odds cell for 1-deck, 2-deck, and 4–8-deck games, H17 and S17, plus DAS / no-DAS and surrender fallbacks.
