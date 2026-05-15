// node create_icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── CRC32 ────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

// ── Icon drawing ─────────────────────────────────────────────────────────
function createIconPNG(size) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB

  // Indigo #6366f1 background + white "T" letter
  const [BR, BG, BB] = [99, 102, 241];
  const [FR, FG, FB] = [255, 255, 255];
  const pad = Math.round(size * 0.18);
  const barThick = Math.max(2, Math.round(size * 0.13));
  const stemThick = Math.max(2, Math.round(size * 0.13));
  const barY1 = pad;
  const barY2 = pad + barThick;
  const barX1 = pad;
  const barX2 = size - pad;
  const stemX1 = Math.round(size / 2 - stemThick / 2);
  const stemX2 = stemX1 + stemThick;
  const stemY2 = size - pad;

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const px = 1 + x * 3;
      const inBar = y >= barY1 && y < barY2 && x >= barX1 && x < barX2;
      const inStem = y >= barY1 && y < stemY2 && x >= stemX1 && x < stemX2;
      if (inBar || inStem) {
        row[px] = FR; row[px + 1] = FG; row[px + 2] = FB;
      } else {
        row[px] = BR; row[px + 1] = BG; row[px + 2] = BB;
      }
    }
    rows.push(row);
  }

  const rawData = Buffer.concat(rows);
  const compressed = zlib.deflateSync(rawData, { level: 6 });

  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Main ─────────────────────────────────────────────────────────────────
const outDir = path.join(__dirname, 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const png = createIconPNG(size);
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Created icons/icon${size}.png`);
}

console.log('Done.');
