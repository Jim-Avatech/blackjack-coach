import { isRed } from "../engine/cards";
import type { Card, Suit } from "../engine/types";

/** 8×8 pixel suit glyphs, drawn as SVG squares so they stay crisp when scaled. */
const SUIT_GRID: Record<Suit, string[]> = {
  spades: [
    "00111100",
    "01111110",
    "11111111",
    "11111111",
    "01111110",
    "00111100",
    "00011000",
    "01111110",
  ],
  hearts: [
    "01100110",
    "11111111",
    "11111111",
    "11111111",
    "01111110",
    "00111100",
    "00011000",
    "00000000",
  ],
  diamonds: [
    "00011000",
    "00111100",
    "01111110",
    "11111111",
    "01111110",
    "00111100",
    "00011000",
    "00000000",
  ],
  clubs: [
    "00111100",
    "01111110",
    "00111100",
    "11011011",
    "11111111",
    "11011011",
    "00011000",
    "01111110",
  ],
};

export function suitSvg(suit: Suit, color: string, size = 16): string {
  const grid = SUIT_GRID[suit];
  const cell = 1;
  const w = 8;
  const h = 8;
  const rects: string[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (grid[y]![x] === "1") {
        rects.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${color}"/>`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${size}" height="${size}" shape-rendering="crispEdges" aria-hidden="true">${rects.join("")}</svg>`;
}

function thumbSvg(): string {
  // 12×12 pixel thumbs-up
  const rows = [
    "000001100000",
    "000001100000",
    "000001111000",
    "011001111110",
    "111111111111",
    "111111111111",
    "111111111111",
    "011111111110",
    "001111111100",
    "000111111000",
    "000000000000",
    "000000000000",
  ];
  const rects: string[] = [];
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      if (rows[y]![x] === "1") {
        rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="#ffd24a"/>`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="28" height="28" shape-rendering="crispEdges">${rects.join("")}</svg>`;
}

export const THUMBS_UP_SVG = thumbSvg();

const seenCardIds = new Set<string>();

export function resetCardAnims(): void {
  seenCardIds.clear();
}

export function cardHtml(card: Card, opts: { hidden?: boolean; small?: boolean; delay?: number } = {}): string {
  const fresh = !seenCardIds.has(card.id);
  if (fresh) seenCardIds.add(card.id);
  const cls = ["bj-card", opts.small ? "is-small" : "", opts.hidden ? "is-back" : "", fresh ? "is-dealt" : ""].join(
    " ",
  );
  const delay = opts.delay ? `style="animation-delay:${opts.delay}ms"` : "";
  if (opts.hidden) {
    return `<div class="${cls}" ${delay} aria-label="facedown card"><div class="bj-card-back"></div></div>`;
  }
  const red = isRed(card.suit);
  const color = red ? "#c41e1e" : "#1a1208";
  const rank = card.rank === "10" ? "10" : card.rank;
  const suit = suitSvg(card.suit, color, 22);
  const suitSm = suitSvg(card.suit, color, 12);
  return `<div class="${cls} ${red ? "is-red" : "is-black"}" ${delay} aria-label="${card.rank} of ${card.suit}">
    <div class="bj-card-face">
      <div class="bj-card-corner tl"><span class="rk">${rank}</span>${suitSm}</div>
      <div class="bj-card-pip">${suit}</div>
      <div class="bj-card-corner br"><span class="rk">${rank}</span>${suitSm}</div>
    </div>
  </div>`;
}

export function cardsHtml(cards: { card: Card; hidden?: boolean }[], small = false): string {
  const n = Math.max(1, cards.length);
  return `<div class="bj-cards" data-n="${n}" style="--n: ${n}">${cards
    .map((c, i) => cardHtml(c.card, { hidden: c.hidden, small, delay: i * 70 }))
    .join("")}</div>`;
}
