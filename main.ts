// news-image-20261117 — one image summing up the world news of Tuesday 17 November 2026.
// Node 22, standard library only. No network, no randomness, no clock: the same input
// always produces byte-identical /output/entry.png (1024x1024 PNG, well under 1 MiB).
//
// The day's news, as reported on 17 Nov 2026 (cross-checked across BBC, Reuters, AP,
// Al Jazeera, Just Security's Early Edition, Level Headlines):
//   1. LEAD — Ukraine struck the Kerch Bridge to Crimea for a second day running;
//      a road span collapsed. Zelenskyy called it "an unprecedented operation".
//      Russia hit river crossings in Kyiv in reply.
//   2. Iran fired drones at a US military radar system at Sheikh Isa base, Bahrain;
//      Bahrain said it intercepted them, no casualties or damage. Tehran also said
//      tankers struck mines near the Strait of Hormuz.
//   3. Trump arrived in Manila for the ASEAN summit and signed a joint trade
//      statement with Thailand; China confirmed a first three-way Xi-Trump-Putin
//      meeting in Shenzhen on Thursday, on the APEC sidelines.
//   4. JPMorgan Chase blamed a software bug (not a cyberattack) for Monday's US
//      online-banking outage, hitting Zelle and several banks.
//   5. Japan scrambled fighter jets after suspected Russian aircraft violated its
//      airspace early Tuesday.
//   6. A ULA Vulcan rocket failed in flight, destroying 40 Amazon Leo satellites.
//
// Design: an editorial front page. A navy masthead names the day in the largest type
// ("17 NOVEMBER 2026"), then a lead story with a drawn bridge, two mid panels
// (Iran, the Manila summit) and three small panels (banking, Japan jets, Vulcan).
// Everything is drawn in code with a 5x7 bitmap font and a tiny PNG encoder.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const W = 1024;
const H = 1024;

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph is 7 rows of 5 cells; '#' is ink. Uppercase,
// digits and punctuation only; drawText uppercases its input and maps anything
// unknown to a space. Written by hand for this entry.
// ---------------------------------------------------------------------------
type Glyph = string[];
const FONT: Record<string, Glyph> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#..##', '#.#.#', '##..#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '...#.', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '(': ['...##', '..#..', '.#...', '.#...', '.#...', '..#..', '...##'],
  ')': ['##...', '..#..', '...#.', '...#.', '...#.', '..#..', '##...'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
  '+': ['.....', '..#..', '..#..', '.###.', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '.###.', '.....', '.###.', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '•': ['.....', '.....', '.###.', '.###.', '.###.', '.....', '.....'],
  '—': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '*': ['.....', '.#.#.', '..#..', '#####', '..#..', '.#.#.', '.....'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
};

const BLANK: Glyph = ['.....', '.....', '.....', '.....', '.....', '.....', '.....'];

type RGB = [number, number, number];
const NAVY: RGB = [20, 38, 74];
const PAPER: RGB = [246, 241, 231];
const CARD: RGB = [255, 253, 246];
const RED: RGB = [179, 38, 30];
const GOLD: RGB = [216, 169, 59];
const INK: RGB = [24, 24, 22];
const GREY: RGB = [107, 114, 128];
const SEA: RGB = [47, 109, 163];
const SKY: RGB = [207, 227, 238];
const WHITE: RGB = [255, 255, 255];
const ORANGE: RGB = [232, 126, 32];
const YELLOW: RGB = [242, 201, 76];

// ---------------------------------------------------------------------------
// Canvas: a plain RGB raster with rects, lines, circles, triangles and text.
// ---------------------------------------------------------------------------
class Canvas {
  readonly w: number;
  readonly h: number;
  readonly buf: Uint8Array;
  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8Array(w * h * 3);
    this.fillRect(0, 0, w, h, bg);
  }
  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w));
    const y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.set(xx, yy, c);
    }
  }
  hline(x: number, y: number, w: number, c: RGB): void {
    this.fillRect(x, y, w, 1, c);
  }
  vline(x: number, y: number, h: number, c: RGB): void {
    this.fillRect(x, y, 1, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.set(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }
  /** A thick segment between two points, drawn as a chain of filled discs. */
  beam(x0: number, y0: number, x1: number, y1: number, r: number, c: RGB): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps);
      const y = Math.round(y0 + ((y1 - y0) * i) / steps);
      this.disc(x, y, r, c);
    }
  }
  disc(cx: number, cy: number, r: number, c: RGB): void {
    for (let yy = cy - r; yy <= cy + r; yy++) {
      for (let xx = cx - r; xx <= cx + r; xx++) {
        if ((xx - cx) * (xx - cx) + (yy - cy) * (yy - cy) <= r * r) this.set(xx, yy, c);
      }
    }
  }
  ring(cx: number, cy: number, r: number, c: RGB): void {
    for (let a = 0; a < 360; a += 2) {
      const t = (a * Math.PI) / 180;
      this.set(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
    }
  }
  /** Filled triangle (x0,y0) (x1,y1) (x2,y2). */
  triangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
    const minY = Math.min(y0, y1, y2);
    const maxY = Math.max(y0, y1, y2);
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      const edges: Array<[number, number, number, number]> = [
        [x0, y0, x1, y1],
        [x1, y1, x2, y2],
        [x2, y2, x0, y0],
      ];
      for (const [ax, ay, bx, by] of edges) {
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
        }
      }
      if (xs.length >= 2) {
        const lo = Math.min(...xs);
        const hi = Math.max(...xs);
        for (let x = Math.floor(lo); x <= Math.ceil(hi); x++) this.set(x, y, c);
      }
    }
  }
  /** Width in px of `text` at the given scale (6 units per glyph cell). */
  textWidth(text: string, scale: number): number {
    const s = text.toUpperCase();
    return s.length * 6 * scale - scale;
  }
  drawChar(ch: string, x: number, y: number, scale: number, c: RGB): void {
    const g = FONT[ch] ?? BLANK;
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] === '#') this.fillRect(x + col * scale, y + row * scale, scale, scale, c);
      }
    }
  }
  drawText(text: string, x: number, y: number, scale: number, c: RGB): void {
    const s = text.toUpperCase();
    for (let i = 0; i < s.length; i++) this.drawChar(s[i], x + i * 6 * scale, y, scale, c);
  }
  drawTextCentered(text: string, cx: number, y: number, scale: number, c: RGB): void {
    this.drawText(text, cx - Math.floor(this.textWidth(text, scale) / 2), y, scale, c);
  }
}

/** Greedy word wrap: returns lines that fit maxWidth at the given scale. */
function wrapText(cv: Canvas, text: string, scale: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (cv.textWidth(next, scale) <= maxWidth || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder: RGB, no filter, zlib level 9. Deterministic output.
// ---------------------------------------------------------------------------
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePNG(cv: Canvas): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0);
  ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(cv.h * (1 + cv.w * 3));
  for (let y = 0; y < cv.h; y++) {
    raw[y * (1 + cv.w * 3)] = 0; // filter: none
    Buffer.from(cv.buf.buffer, cv.buf.byteOffset + y * cv.w * 3, cv.w * 3).copy(
      raw,
      y * (1 + cv.w * 3) + 1,
    );
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Layout: 1024x1024 editorial front page.
// ---------------------------------------------------------------------------
function drawMasthead(cv: Canvas): void {
  cv.fillRect(0, 0, W, 148, NAVY);
  cv.drawTextCentered('TUESDAY  •  THE WORLD IN ONE IMAGE', W / 2, 20, 3, GOLD);
  cv.drawTextCentered('17 NOVEMBER 2026', W / 2, 58, 7, WHITE);
  cv.fillRect(112, 124, 800, 3, GOLD);
}

/** The Kerch Bridge scene: sky, sea, a deck with its middle span collapsed. */
function drawBridgeScene(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, SKY);
  const seaY = y + Math.floor(h * 0.55);
  cv.fillRect(x, seaY, w, h - (seaY - y), SEA);
  // a few white wave strokes on the sea
  for (let i = 0; i < 5; i++) {
    const wy = seaY + 14 + i * 12;
    const wx = x + 20 + (i % 2) * 40;
    cv.hline(wx, wy, 90, WHITE);
    cv.hline(wx + 150, wy + 5, 70, WHITE);
  }
  const deckY = y + Math.floor(h * 0.42);
  const midX = x + Math.floor(w / 2);
  // pylons
  cv.fillRect(x + 90, deckY - 58, 8, 58, GREY);
  cv.fillRect(x + w - 98, deckY - 58, 8, 58, GREY);
  // left deck (intact) and right deck (intact)
  cv.fillRect(x + 8, deckY, midX - x - 78, 10, [74, 78, 84]);
  cv.fillRect(midX + 70, deckY, x + w - 8 - (midX + 70), 10, [74, 78, 84]);
  // collapsed middle span: a deck piece tilted down into the water
  cv.beam(midX - 70, deckY + 5, midX + 18, deckY + 44, 5, [74, 78, 84]);
  cv.beam(midX + 18, deckY + 44, midX + 62, deckY + 52, 5, [74, 78, 84]);
  // broken ends
  cv.fillRect(midX - 78, deckY - 4, 10, 14, [52, 56, 62]);
  cv.fillRect(midX + 60, deckY - 4, 10, 14, [52, 56, 62]);
  // blast star at the break
  const bx = midX - 8;
  const by = deckY - 26;
  cv.disc(bx, by, 10, ORANGE);
  cv.disc(bx, by, 5, YELLOW);
  // smoke puffs drifting up
  cv.disc(midX - 44, deckY - 34, 12, [150, 150, 150]);
  cv.disc(midX - 18, deckY - 52, 15, [168, 168, 168]);
  cv.disc(midX + 12, deckY - 68, 11, [150, 150, 150]);
  // a small boat watching from the right: hull, mast and flag
  cv.fillRect(x + w - 120, seaY + 30, 56, 9, [30, 30, 30]);
  cv.fillRect(x + w - 96, seaY + 12, 4, 18, [30, 30, 30]);
  cv.fillRect(x + w - 92, seaY + 12, 16, 8, RED);
}

function drawLead(cv: Canvas): void {
  const x = 24;
  const y = 164;
  const w = W - 48;
  const h = 348;
  cv.fillRect(x, y, w, h, CARD);
  cv.fillRect(x, y, w, 8, RED);
  cv.fillRect(x, y, w, 2, NAVY);
  cv.fillRect(x, y + h - 2, w, 2, NAVY);
  cv.fillRect(x, y, 2, h, NAVY);
  cv.fillRect(x + w - 2, y, 2, h, NAVY);
  cv.drawText('UKRAINE  •  WAR IN EUROPE', x + 24, y + 22, 3, RED);
  cv.drawText('KERCH BRIDGE HIT AGAIN', x + 24, y + 56, 5, INK);
  cv.drawText('SPAN COLLAPSES', x + 24, y + 98, 5, INK);
  const sub = wrapText(
    cv,
    'Second strike in two days, Kyiv says; Russia hits river crossings in reply.',
    3,
    w - 48,
  );
  sub.forEach((ln, i) => cv.drawText(ln, x + 24, y + 152 + i * 24, 3, [60, 60, 58]));
  drawBridgeScene(cv, x + 24, y + 208, w - 48, 122);
}

/** Small radar-dish + drone + tanker strip for the Iran panel. */
function drawRadarStrip(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, [232, 240, 246]);
  const cy = y + h - 8;
  cv.fillRect(x, cy, w, 8, SEA);
  // tanker
  cv.fillRect(x + w - 150, cy - 16, 110, 16, [30, 30, 30]);
  cv.fillRect(x + w - 118, cy - 30, 12, 14, [30, 30, 30]);
  cv.fillRect(x + w - 92, cy - 26, 10, 10, RED);
  // radar dish on the left
  cv.beam(x + 34, cy, x + 52, cy - 34, 2, NAVY);
  cv.line(x + 52, cy - 34, x + 74, cy - 52, NAVY);
  cv.line(x + 74, cy - 52, x + 92, cy - 30, NAVY);
  cv.line(x + 92, cy - 30, x + 52, cy - 34, NAVY);
  cv.ring(x + 52, cy - 34, 26, NAVY);
  // three drone dots with trails
  for (let i = 0; i < 3; i++) {
    const dx = x + 150 + i * 46;
    const dy = y + 18 + (i % 2) * 16;
    cv.disc(dx, dy, 4, RED);
    cv.hline(dx - 22, dy, 16, RED);
  }
}

/** Three small flags on poles for the summit panel. */
function drawFlagsStrip(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, [232, 240, 246]);
  const baseY = y + h - 10;
  const poles = [x + 60, x + 200, x + 340];
  // US: stripes + blue canton
  cv.fillRect(poles[0], y + 14, 4, baseY - (y + 14), NAVY);
  for (let s = 0; s < 5; s++) cv.fillRect(poles[0] + 4, y + 14 + s * 7, 66, 3, s % 2 ? WHITE : RED);
  cv.fillRect(poles[0] + 4, y + 14, 28, 14, NAVY);
  // China: red field, yellow stars
  cv.fillRect(poles[1], y + 14, 4, baseY - (y + 14), NAVY);
  cv.fillRect(poles[1] + 4, y + 14, 66, 35, RED);
  cv.disc(poles[1] + 18, y + 26, 4, YELLOW);
  cv.disc(poles[1] + 34, y + 20, 2, YELLOW);
  cv.disc(poles[1] + 40, y + 30, 2, YELLOW);
  // Russia: white / blue / red tricolour
  cv.fillRect(poles[2], y + 14, 4, baseY - (y + 14), NAVY);
  cv.fillRect(poles[2] + 4, y + 14, 66, 12, WHITE);
  cv.fillRect(poles[2] + 4, y + 26, 66, 11, [0, 57, 166]);
  cv.fillRect(poles[2] + 4, y + 37, 66, 12, RED);
}

function drawMidRow(cv: Canvas): void {
  const y = 528;
  const h = 220;
  const panels: Array<{ x: number; w: number }> = [
    { x: 24, w: 476 },
    { x: 524, w: 476 },
  ];
  for (const p of panels) {
    cv.fillRect(p.x, y, p.w, h, CARD);
    cv.fillRect(p.x, y, p.w, 2, NAVY);
    cv.fillRect(p.x, y + h - 2, p.w, 2, NAVY);
    cv.fillRect(p.x, y, 2, h, NAVY);
    cv.fillRect(p.x + p.w - 2, y, 2, h, NAVY);
  }
  // Left: Iran / Bahrain / Hormuz
  const L = panels[0];
  cv.drawText('MIDDLE EAST', L.x + 20, y + 14, 2, RED);
  cv.drawText('IRAN FIRES DRONES AT', L.x + 20, y + 38, 3, INK);
  cv.drawText('US RADAR IN BAHRAIN', L.x + 20, y + 62, 3, INK);
  const subL = wrapText(
    cv,
    'Intercepted, no casualties. Tehran says tankers hit mines near Hormuz.',
    2,
    L.w - 40,
  );
  subL.forEach((ln, i) => cv.drawText(ln, L.x + 20, y + 96 + i * 16, 2, [60, 60, 58]));
  drawRadarStrip(cv, L.x + 20, y + 148, L.w - 40, 56);
  // Right: Manila summit
  const R = panels[1];
  cv.drawText('ASIA  •  DIPLOMACY', R.x + 20, y + 14, 2, RED);
  cv.drawText('XI, TRUMP AND PUTIN', R.x + 20, y + 38, 3, INK);
  cv.drawText('TO MEET IN SHENZHEN', R.x + 20, y + 62, 3, INK);
  const subR = wrapText(
    cv,
    'Three-way talks Thursday, on APEC sidelines. Trump in Manila, signs Thai trade deal.',
    2,
    R.w - 40,
  );
  subR.forEach((ln, i) => cv.drawText(ln, R.x + 20, y + 96 + i * 16, 2, [60, 60, 58]));
  drawFlagsStrip(cv, R.x + 20, y + 148, R.w - 40, 56);
}

/** Small icons for the bottom panels (drawn larger, centred in the free space). */
function drawBankIcon(cv: Canvas, x: number, y: number): void {
  cv.triangle(x, y, x + 52, y, x + 26, y - 18, NAVY);
  cv.fillRect(x + 3, y, 46, 6, NAVY);
  for (let i = 0; i < 4; i++) cv.fillRect(x + 5 + i * 13, y + 9, 6, 26, NAVY);
  cv.fillRect(x, y + 38, 52, 6, NAVY);
  cv.drawText('!', x + 60, y - 4, 4, RED);
}
function drawJetIcon(cv: Canvas, x: number, y: number): void {
  cv.triangle(x, y + 18, x + 78, y + 18, x + 30, y, NAVY);
  cv.triangle(x + 12, y + 18, x + 40, y + 40, x + 46, y + 18, NAVY);
  cv.fillRect(x + 78, y + 13, 18, 10, NAVY);
  cv.hline(x - 12, y + 30, 20, GREY);
}
function drawRocketIcon(cv: Canvas, x: number, y: number): void {
  cv.fillRect(x + 14, y, 14, 36, [200, 60, 50]);
  cv.triangle(x + 14, y, x + 28, y, x + 21, y - 13, RED);
  cv.fillRect(x + 5, y + 24, 9, 12, GREY);
  cv.fillRect(x + 28, y + 24, 9, 12, GREY);
  cv.triangle(x + 16, y + 36, x + 26, y + 36, x + 21, y + 48, ORANGE);
  cv.disc(x + 21, y + 17, 4, WHITE);
}

function drawBottomRow(cv: Canvas): void {
  const y = 764;
  const h = 192;
  const panels = [
    { x: 24, w: 320 },
    { x: 352, w: 320 },
    { x: 680, w: 320 },
  ];
  for (const p of panels) {
    cv.fillRect(p.x, y, p.w, h, CARD);
    cv.fillRect(p.x, y, p.w, 2, NAVY);
    cv.fillRect(p.x, y + h - 2, p.w, 2, NAVY);
    cv.fillRect(p.x, y, 2, h, NAVY);
    cv.fillRect(p.x + p.w - 2, y, 2, h, NAVY);
  }
  // 1: banking outage
  const b1 = panels[0];
  cv.drawText('BUSINESS', b1.x + 18, y + 12, 2, RED);
  cv.drawText('CHASE BUG', b1.x + 18, y + 34, 3, INK);
  cv.drawText('HITS US BANKING', b1.x + 18, y + 58, 3, INK);
  const s1 = wrapText(cv, 'Software fault, not a hack. Zelle and online accounts hit.', 2, b1.w - 36);
  s1.forEach((ln, i) => cv.drawText(ln, b1.x + 18, y + 88 + i * 16, 2, [60, 60, 58]));
  drawBankIcon(cv, b1.x + 210, y + 158);
  // 2: Japan jets
  const b2 = panels[1];
  cv.drawText('ASIA-PACIFIC', b2.x + 18, y + 12, 2, RED);
  cv.drawText('JAPAN SCRAMBLES', b2.x + 18, y + 34, 3, INK);
  cv.drawText('JETS', b2.x + 18, y + 58, 3, INK);
  const s2 = wrapText(cv, 'Russian planes enter its airspace. Tokyo protests.', 2, b2.w - 36);
  s2.forEach((ln, i) => cv.drawText(ln, b2.x + 18, y + 88 + i * 16, 2, [60, 60, 58]));
  drawJetIcon(cv, b2.x + 200, y + 132);
  // 3: Vulcan rocket
  const b3 = panels[2];
  cv.drawText('SPACE', b3.x + 18, y + 12, 2, RED);
  cv.drawText('VULCAN ROCKET', b3.x + 18, y + 34, 3, INK);
  cv.drawText('FAILS', b3.x + 18, y + 58, 3, INK);
  const s3 = wrapText(cv, '40 Amazon satellites lost in flight anomaly.', 2, b3.w - 36);
  s3.forEach((ln, i) => cv.drawText(ln, b3.x + 18, y + 88 + i * 16, 2, [60, 60, 58]));
  drawRocketIcon(cv, b3.x + 242, y + 132);
}

function drawFooter(cv: Canvas): void {
  cv.drawTextCentered('AS REPORTED 17 NOV 2026 BY BBC, REUTERS, AP, AL JAZEERA', W / 2, 976, 2, [90, 86, 78]);
}

// ---------------------------------------------------------------------------
// Main: draw the page and write /output/entry.png.
// ---------------------------------------------------------------------------
function main(): void {
  const cv = new Canvas(W, H, PAPER);
  drawMasthead(cv);
  drawLead(cv);
  drawMidRow(cv);
  drawBottomRow(cv);
  drawFooter(cv);
  // outer frame
  cv.fillRect(0, 0, W, 4, NAVY);
  cv.fillRect(0, H - 4, W, 4, NAVY);
  cv.fillRect(0, 0, 4, H, NAVY);
  cv.fillRect(W - 4, 0, 4, H, NAVY);
  const png = encodePNG(cv);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, 'entry.png'), png);
}

main();
