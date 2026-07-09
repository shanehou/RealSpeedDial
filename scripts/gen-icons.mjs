// 生成扩展图标（无第三方依赖）：圆角深色底 + 2×2 蓝色磁贴，寓意 Speed Dial。
// 用 Node 内置 zlib 编码 PNG。运行：node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const BG = [30, 33, 48, 255];      // #1e2130
const TILE = [74, 158, 255, 255];  // #4a9eff

function crc32(buf) {
  let c = ~0 >>> 0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(n, px) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  const raw = Buffer.alloc(n * (n * 4 + 1));
  for (let y = 0; y < n; y++) {
    raw[y * (n * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < n; x++) {
      const o = y * (n * 4 + 1) + 1 + x * 4;
      const p = (y * n + x) * 4;
      raw[o] = px[p]; raw[o + 1] = px[p + 1]; raw[o + 2] = px[p + 2]; raw[o + 3] = px[p + 3];
    }
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function inRoundedRect(x, y, x0, y0, w, h, r) {
  if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false;
  const rx = Math.min(r, w / 2), ry = Math.min(r, h / 2);
  const cx = x < x0 + rx ? x0 + rx : x >= x0 + w - rx ? x0 + w - rx : x;
  const cy = y < y0 + ry ? y0 + ry : y >= y0 + h - ry ? y0 + h - ry : y;
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r || (x >= x0 + rx && x < x0 + w - rx) || (y >= y0 + ry && y < y0 + h - ry);
}

function draw(n) {
  const px = new Uint8Array(n * n * 4);
  const rBg = n * 0.22;
  const margin = Math.round(n * 0.16);
  const gap = Math.max(1, Math.round(n * 0.08));
  const tile = (n - margin * 2 - gap) / 2;
  const rTile = Math.max(1, tile * 0.22);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const p = (y * n + x) * 4;
      let col = [0, 0, 0, 0];
      if (inRoundedRect(x, y, 0, 0, n, n, rBg)) col = BG;
      for (let ty = 0; ty < 2; ty++) {
        for (let tx = 0; tx < 2; tx++) {
          const x0 = margin + tx * (tile + gap);
          const y0 = margin + ty * (tile + gap);
          if (inRoundedRect(x, y, x0, y0, tile, tile, rTile)) col = TILE;
        }
      }
      px[p] = col[0]; px[p + 1] = col[1]; px[p + 2] = col[2]; px[p + 3] = col[3];
    }
  }
  return px;
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(join(OUT, `icon${size}.png`), encodePng(size, draw(size)));
  console.log(`wrote icon${size}.png`);
}
