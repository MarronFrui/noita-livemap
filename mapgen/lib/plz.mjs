// plz codec — the game's pixel-scene container (spliced scenes, N.plz pieces).
//
// BYTE extraction, full windows prologue->ret, THIS session (dig #168,
// noita_dev.exe WSL, exe md5 8b611494212a69492dd0a4527d9c92e0; VA->file
// .text: file = VA - 0x400E00 + 0x400):
//
//   loader pipeline   0x90E220..0x90E676 + dispatch call 0x90E73C..0x90E754
//     header = 6 x u32 LE (24 B): [ver][w][h][bpp][compLen][rawLen]
//     field loads = raw 32-bit moves (w @0x90E223->slot, h @0x90E2E5,
//       bpp @0x90E3B3, compLen @0x90E47E->[ebp-0x6C], rawLen @0x90E54F->
//       edi/[ebp-0x4C]): NO sign-extension, NO abs
//     asserts: w,h <= 0x10000 (0x90E61D/0x90E62A, `ja` = UNSIGNED) => the
//       5 shipped negative-dim plz (gourd_room/6-8, lavalake2/23-24: w =
//       -511, h = -511/-343; rawLen = |w|*|h|*4) are XML-referenced but
//       REFUSED here (0x90E7BA = error-log + abandon, no decode); our
//       decoder ignores w/h and decodes them (length-exact only)
//     bpp-1 <= 3 (0x90E637); file = 24 + compLen exactly (no trailer, 97/97)
//     THE RAW GATE @0x90E644: cmp edi(rawLen),0x80 ; jge 0x90E73C
//       rawLen < 128  -> NO decode: verbatim copy of compLen bytes
//                        (malloc @0x90E654, byte loop 0x90E668..0x90E671)
//       rawLen >= 128 -> dispatcher
//   dispatcher        0x423220..0x423243
//     level = (payload[0] >> 5) + 1; 1 -> 0x422980, 2 -> 0x423010,
//     any other level -> eax = 0 (failure; the shipped data never hits it:
//     the one rawLen<128 file is consumed by the gate, never dispatched)
//   level-1           0x422980..0x422B4C
//     ctrl0 = payload[0] & 0x1f, ip = 1
//     literal (ctrl < 0x20):  len = ctrl + 1 (0x422B03); copy; done at ip_end
//     match   (ctrl >= 0x20): len = (ctrl >> 5) - 1, +3 written
//       len == 6 -> ONE extension byte: len = b + 6  (0x4229D3, no 0xff loop)
//       dist = ((ctrl & 0x1f) << 8) + low + 1        (NO extended-dist path)
//       src == op (dist 1) -> RLE fill (0x422A18)
//     returns written count; bounds fail -> 0 (0x422B44)
//   level-2           0x423010..0x42321B
//     same skeleton; match len ext = do { b = *ip++; len += b } while (b==0xff)
//       starting len = 6 (0x423066); extended dist when low == 0xff &&
//       offHi == 0x1f00: dist = BE16(ip) + 0x1fff + 1 (0x42308B..0x4230AA)
//     returns written count; bounds fail -> 0 (0x423214)
//
// Validation (dig #168, data/biome_impl/spliced, 97 shipped .plz):
//   census + decode-exact + content pins in tests/mapgen/plz-codec.test.mjs.

export const PLZ_HEADER_BYTES = 24;
// loader gate @0x90E644: rawLen < 0x80 -> verbatim, no dispatch
export const PLZ_RAW_THRESHOLD = 0x80;

export function parsePlzHeader(buf) {
  if (buf.length < PLZ_HEADER_BYTES) {
    throw new Error(`plz: short header ${buf.length} < ${PLZ_HEADER_BYTES}`);
  }
  const h = {
    ver: buf.readUInt32LE(0),
    w: buf.readUInt32LE(4),
    h: buf.readUInt32LE(8),
    bpp: buf.readUInt32LE(12),
    compLen: buf.readUInt32LE(16),
    rawLen: buf.readUInt32LE(20),
  };
  if (buf.length < PLZ_HEADER_BYTES + h.compLen) {
    throw new Error(
      `plz: short payload ${buf.length - PLZ_HEADER_BYTES} < ${h.compLen}`
    );
  }
  return h;
}

// dispatcher 0x423220: level = (payload[0] >> 5) + 1
export function plzLevel(payload) {
  return (payload[0] >> 5) + 1;
}

// Full game pipeline: header -> raw gate -> dispatcher -> level decoder.
// Returns { header, level, raw, out } where out = the written bytes
// (length == the decoder's return; for raw files the verbatim compLen copy).
export function decodePlz(buf) {
  const header = parsePlzHeader(buf);
  const payload = buf.subarray(PLZ_HEADER_BYTES, PLZ_HEADER_BYTES + header.compLen);
  if (header.rawLen < PLZ_RAW_THRESHOLD) {
    // verbatim path — no level byte consumed
    return { header, level: null, raw: true, out: Buffer.from(payload) };
  }
  const level = plzLevel(payload);
  if (level === 1) return { header, level, raw: false, out: decodePlz1(payload, header.rawLen) };
  if (level === 2) return { header, level, raw: false, out: decodePlz2(payload, header.rawLen) };
  throw new Error(`plz: unsupported level ${level} (dispatcher 0x423220 returns 0)`);
}

function makeSink(max, label, state) {
  const out = Buffer.alloc(max);
  const fail = (why) => {
    throw new Error(`plz ${label}: ${why} (ip=${state.ip} op=${state.op})`);
  };
  return { out, fail };
}

// level-1 window 0x422980..0x422B4C (exported for format unit tests)
export function decodePlz1(payload, rawLen) {
  const ipEnd = payload.length;
  const st = { ip: 1, op: 0 };
  const { out, fail } = makeSink(rawLen, "L1", st);
  let ctrl = payload[0] & 0x1f; // 0x422993
  for (;;) {
    if (ctrl < 0x20) {
      // literal 0x422B03: len = ctrl + 1
      const len = ctrl + 1;
      if (st.op + len > rawLen) fail("out-lit");
      if (st.ip + len > ipEnd) fail("in-lit");
      payload.copy(out, st.op, st.ip, st.ip + len);
      st.op += len;
      st.ip += len;
    } else {
      // match 0x4229B9
      let len = (ctrl >> 5) - 1;
      const offHi = (ctrl & 0x1f) << 8;
      if (len === 6) {
        // ONE extension byte (0x4229D3): len = b + 6 — no 0xff chain
        len = payload[st.ip++] + 6;
      }
      const low = payload[st.ip++];
      const dist = offHi + low + 1; // eax = op - offHi - low; src = eax-1
      const total = len + 3; // bounds: op + 3 + len <= room (0x4229E6)
      if (st.op + total > rawLen) fail("out-match");
      const src = st.op - dist;
      if (src < 0) fail("back"); // src-1 >= op_start (0x4229F4)
      for (let k = 0; k < total; k++) out[st.op + k] = out[src + k];
      st.op += total;
    }
    if (st.ip >= ipEnd) break;
    ctrl = payload[st.ip++];
  }
  return out.subarray(0, st.op);
}

// level-2 window 0x423010..0x42321B (exported for format unit tests)
export function decodePlz2(payload, rawLen) {
  const ipEnd = payload.length;
  const st = { ip: 1, op: 0 };
  const { out, fail } = makeSink(rawLen, "L2", st);
  let ctrl = payload[0] & 0x1f; // 0x423028
  for (;;) {
    if (ctrl < 0x20) {
      // literal 0x4231D3: len = ctrl + 1
      const len = ctrl + 1;
      if (st.op + len > rawLen) fail("out-lit");
      if (st.ip + len > ipEnd) fail("in-lit");
      payload.copy(out, st.op, st.ip, st.ip + len);
      st.op += len;
      st.ip += len;
    } else {
      // match 0x423040
      let len = (ctrl >> 5) - 1;
      const offHi = (ctrl & 0x1f) << 8;
      if (len === 6) {
        // 0x423066: len = 6; do { b = *ip++; len += b } while (b == 0xff)
        let b;
        do { b = payload[st.ip++]; len += b; } while (b === 0xff);
      }
      const low = payload[st.ip++];
      let dist;
      if (low === 0xff && offHi === 0x1f00) {
        // 0x42308B: extended dist = BE16(ip) + 0x1fff + 1
        dist = ((payload[st.ip] << 8) | payload[st.ip + 1]) + 0x1fff + 1;
        st.ip += 2;
      } else {
        dist = offHi + low + 1;
      }
      const total = len + 3; // 0x4230AF: op + 3 + len <= room
      if (st.op + total > rawLen) fail("out-match");
      const src = st.op - dist;
      if (src < 0) fail("back"); // 0x4230C0: src-1 >= op_start
      for (let k = 0; k < total; k++) out[st.op + k] = out[src + k];
      st.op += total;
    }
    if (st.ip >= ipEnd) break;
    ctrl = payload[st.ip++];
  }
  return out.subarray(0, st.op);
}
