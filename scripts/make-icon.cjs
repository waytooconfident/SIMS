// Generates build/icon.ico — a warehouse-with-boxes line-art app icon
// (black strokes on white), matching the supplied reference image.
// No image libraries: we draw thick anti-aliased strokes onto an RGBA canvas,
// encode a PNG by hand (zlib + CRC32), then wrap it in an ICO (PNG-in-ICO).
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const SIZE = 256
const BLACK = [0x14, 0x14, 0x14]

// ─── canvas (white background) ──────────────────────────────────────────────────
const buf = Buffer.alloc(SIZE * SIZE * 4)
for (let i = 0; i < SIZE * SIZE; i++) {
  buf[i * 4] = 255; buf[i * 4 + 1] = 255; buf[i * 4 + 2] = 255; buf[i * 4 + 3] = 255
}
function blend(x, y, c, a) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || a <= 0) return
  if (a > 1) a = 1
  const i = (y * SIZE + x) * 4
  for (let k = 0; k < 3; k++) buf[i + k] = Math.round(c[k] * a + buf[i + k] * (1 - a))
}

// distance from point to segment
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const l2 = dx * dx + dy * dy
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
// thick, round-capped, anti-aliased segment
function segment(ax, ay, bx, by, w) {
  const hw = w / 2
  const minX = Math.max(0, Math.floor(Math.min(ax, bx) - hw - 2))
  const maxX = Math.min(SIZE - 1, Math.ceil(Math.max(ax, bx) + hw + 2))
  const minY = Math.max(0, Math.floor(Math.min(ay, by) - hw - 2))
  const maxY = Math.min(SIZE - 1, Math.ceil(Math.max(ay, by) + hw + 2))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = distToSeg(x + 0.5, y + 0.5, ax, ay, bx, by)
      const a = d <= hw ? 1 : d <= hw + 1 ? hw + 1 - d : 0
      if (a > 0) blend(x, y, BLACK, a)
    }
  }
}
// stroke a polyline; `closed` joins last→first
function poly(pts, closed, w) {
  for (let i = 0; i + 1 < pts.length; i++) segment(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w)
  if (closed && pts.length > 2) segment(pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1], w)
}
function rrectOutline(x0, y0, x1, y1, w) {
  poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true, w)
}
// cardboard box: square outline + centre seam + small top tab
function box(x0, y0, x1, y1, w) {
  rrectOutline(x0, y0, x1, y1, w)
  const cx = (x0 + x1) / 2
  const seam = (y1 - y0) * 0.26
  segment(cx, y0, cx, y0 + seam, w)          // vertical flap seam
  const tab = (x1 - x0) * 0.1
  segment(cx - tab, y0 + seam, cx + tab, y0 + seam, w) // little tab bar
}

// ─── warehouse outline (pitched roof, vertical walls) ───────────────────────────
const OUT = 11
poly([
  [36, 212],   // bottom-left
  [36, 96],    // left eave
  [128, 30],   // apex
  [220, 96],   // right eave
  [220, 212],  // bottom-right
], true, OUT)   // closing edge draws the floor

// shutter header bar (rounded rectangle near the top inside)
rrectOutline(62, 100, 194, 126, 9)

// pyramid of three boxes sitting on the floor (clear gap below the shutter)
const BW = 8
box(84, 170, 128, 210, BW)   // bottom-left
box(128, 170, 172, 210, BW)  // bottom-right
box(106, 134, 150, 170, BW)  // top

// ─── PNG encode ─────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(data) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0
  buf.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}
const idat = zlib.deflateSync(raw, { level: 9 })
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4); ihdr[8] = 8; ihdr[9] = 6
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))
])

// ─── ICO wrap (single 256×256 PNG entry) ────────────────────────────────────────
const dir = Buffer.alloc(6)
dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(1, 4)
const entry = Buffer.alloc(16)
entry[0] = 0; entry[1] = 0
entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6)
entry.writeUInt32LE(png.length, 8); entry.writeUInt32LE(22, 12)
const ico = Buffer.concat([dir, entry, png])

const outDir = path.join(__dirname, '..', 'build')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'icon.ico'), ico)
if (process.argv.includes('--preview')) fs.writeFileSync(path.join(outDir, 'icon-preview.png'), png)
console.log(`Wrote build/icon.ico (${ico.length} bytes)`)
