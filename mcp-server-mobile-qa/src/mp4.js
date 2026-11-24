/** Baca rotasi tampilan video MP4 dari matrix atom 'tkhd' track video (tanpa ffprobe). Return 0|90|180|270 atau null. */
import fs from 'node:fs';
export function mp4Info(file) {
  const buf = fs.readFileSync(file); let i = 0; const found = [];
  while ((i = buf.indexOf('tkhd', i)) > 0) {
    const v = buf[i + 4]; const o = i + 8 + (v === 1 ? 32 : 20) + 8; // lewati waktu/trackId/duration + reserved(8)
    const volume = buf.readInt16BE(o + 4); const m = o + 8;
    const a = buf.readInt32BE(m), b = buf.readInt32BE(m + 4);
    const w = buf.readUInt32BE(m + 36) >>> 16, h = buf.readUInt32BE(m + 40) >>> 16;
    if (w && h && volume === 0) { const deg = ((Math.round(Math.atan2(b, a) * 180 / Math.PI) % 360) + 360) % 360; found.push({ width: w, height: h, rotation: deg }); }
    i += 4;
  }
  return found[0] || null;
}
