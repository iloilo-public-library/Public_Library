/**
 * Self-contained pure-TypeScript ISO/IEC 18004 QR Code Byte-mode encoder.
 * Supports Versions 1–10 with Error Correction Level M (default) or L,
 * Reed-Solomon ECC over GF(256), finder/timing/alignment patterns,
 * format/version BCH info, mask evaluation (rules 1–4), and compact SVG output.
 */

export type QrErrorCorrectionLevel = "L" | "M";

interface VersionEcSpec {
  totalCodewords: number;
  ecCodewordsPerBlock: number;
  group1Blocks: number;
  group1DataCodewords: number;
  group2Blocks: number;
  group2DataCodewords: number;
}

const ALIGNMENT_CENTERS: Record<number, readonly number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

// ISO/IEC 18004 Table 9 — Versions 1–10 for Error Correction Levels L and M
const VERSION_SPECS: Record<QrErrorCorrectionLevel, Record<number, VersionEcSpec>> = {
  L: {
    1: { totalCodewords: 26, ecCodewordsPerBlock: 7, group1Blocks: 1, group1DataCodewords: 19, group2Blocks: 0, group2DataCodewords: 0 },
    2: { totalCodewords: 44, ecCodewordsPerBlock: 10, group1Blocks: 1, group1DataCodewords: 34, group2Blocks: 0, group2DataCodewords: 0 },
    3: { totalCodewords: 70, ecCodewordsPerBlock: 15, group1Blocks: 1, group1DataCodewords: 55, group2Blocks: 0, group2DataCodewords: 0 },
    4: { totalCodewords: 100, ecCodewordsPerBlock: 20, group1Blocks: 1, group1DataCodewords: 80, group2Blocks: 0, group2DataCodewords: 0 },
    5: { totalCodewords: 134, ecCodewordsPerBlock: 26, group1Blocks: 1, group1DataCodewords: 108, group2Blocks: 0, group2DataCodewords: 0 },
    6: { totalCodewords: 172, ecCodewordsPerBlock: 18, group1Blocks: 2, group1DataCodewords: 68, group2Blocks: 0, group2DataCodewords: 0 },
    7: { totalCodewords: 196, ecCodewordsPerBlock: 20, group1Blocks: 2, group1DataCodewords: 78, group2Blocks: 0, group2DataCodewords: 0 },
    8: { totalCodewords: 242, ecCodewordsPerBlock: 24, group1Blocks: 2, group1DataCodewords: 97, group2Blocks: 0, group2DataCodewords: 0 },
    9: { totalCodewords: 292, ecCodewordsPerBlock: 30, group1Blocks: 2, group1DataCodewords: 116, group2Blocks: 0, group2DataCodewords: 0 },
    10: { totalCodewords: 346, ecCodewordsPerBlock: 18, group1Blocks: 2, group1DataCodewords: 68, group2Blocks: 2, group2DataCodewords: 69 },
  },
  M: {
    1: { totalCodewords: 26, ecCodewordsPerBlock: 10, group1Blocks: 1, group1DataCodewords: 16, group2Blocks: 0, group2DataCodewords: 0 },
    2: { totalCodewords: 44, ecCodewordsPerBlock: 16, group1Blocks: 1, group1DataCodewords: 28, group2Blocks: 0, group2DataCodewords: 0 },
    3: { totalCodewords: 70, ecCodewordsPerBlock: 26, group1Blocks: 1, group1DataCodewords: 44, group2Blocks: 0, group2DataCodewords: 0 },
    4: { totalCodewords: 100, ecCodewordsPerBlock: 18, group1Blocks: 2, group1DataCodewords: 32, group2Blocks: 0, group2DataCodewords: 0 },
    5: { totalCodewords: 134, ecCodewordsPerBlock: 24, group1Blocks: 2, group1DataCodewords: 43, group2Blocks: 0, group2DataCodewords: 0 },
    6: { totalCodewords: 172, ecCodewordsPerBlock: 16, group1Blocks: 4, group1DataCodewords: 27, group2Blocks: 0, group2DataCodewords: 0 },
    7: { totalCodewords: 196, ecCodewordsPerBlock: 18, group1Blocks: 4, group1DataCodewords: 31, group2Blocks: 0, group2DataCodewords: 0 },
    8: { totalCodewords: 242, ecCodewordsPerBlock: 22, group1Blocks: 2, group1DataCodewords: 38, group2Blocks: 2, group2DataCodewords: 39 },
    9: { totalCodewords: 292, ecCodewordsPerBlock: 22, group1Blocks: 3, group1DataCodewords: 36, group2Blocks: 2, group2DataCodewords: 37 },
    10: { totalCodewords: 346, ecCodewordsPerBlock: 26, group1Blocks: 4, group1DataCodewords: 43, group2Blocks: 1, group2DataCodewords: 44 },
  },
};

const EC_FORMAT_INDICATOR: Record<QrErrorCorrectionLevel, number> = {
  L: 0b01,
  M: 0b00,
};

// Precomputed GF(256) exp/log tables with primitive polynomial 0x11d (x^8 + x^4 + x^3 + x^2 + 1)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsComputeRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount);
  const remainder = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    remainder.copyWithin(0, 1);
    remainder[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecCount; j++) {
        remainder[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return remainder;
}

function totalDataCodewords(spec: VersionEcSpec): number {
  return spec.group1Blocks * spec.group1DataCodewords + spec.group2Blocks * spec.group2DataCodewords;
}

function selectVersion(byteLength: number, ecLevel: QrErrorCorrectionLevel): number {
  for (let version = 1; version <= 10; version++) {
    const spec = VERSION_SPECS[ecLevel][version];
    const dataCapBytes = totalDataCodewords(spec);
    const countBits = version <= 9 ? 8 : 16;
    const requiredBits = 4 + countBits + byteLength * 8;
    if (requiredBits <= dataCapBytes * 8) {
      return version;
    }
  }
  throw new Error(`QR payload of ${byteLength} bytes exceeds Version 10 capacity at EC level ${ecLevel}.`);
}

function encodeDataCodewords(
  payload: Uint8Array,
  version: number,
  spec: VersionEcSpec
): Uint8Array {
  const capacityBytes = totalDataCodewords(spec);
  const capacityBits = capacityBytes * 8;
  const bits: number[] = [];

  const pushBits = (value: number, bitCount: number) => {
    for (let i = bitCount - 1; i >= 0; i--) {
      bits.push((value >>> i) & 1);
    }
  };

  // Mode indicator: Byte mode (0100)
  pushBits(0b0100, 4);
  // Character count indicator: 8 bits for V1-9, 16 bits for V10
  pushBits(payload.length, version <= 9 ? 8 : 16);
  // Payload bytes
  for (let i = 0; i < payload.length; i++) {
    pushBits(payload[i], 8);
  }

  // Terminator (up to 4 zero bits)
  const terminatorLen = Math.min(4, capacityBits - bits.length);
  pushBits(0, terminatorLen);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // Pack bits into bytes
  const out = new Uint8Array(capacityBytes);
  let byteIdx = 0;
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i + j];
    }
    out[byteIdx++] = b;
  }

  // Alternating pad bytes 0xEC, 0x11
  let padToggle = 0;
  while (byteIdx < capacityBytes) {
    out[byteIdx++] = padToggle === 0 ? 0xec : 0x11;
    padToggle ^= 1;
  }

  return out;
}

function interleaveCodewords(data: Uint8Array, spec: VersionEcSpec): Uint8Array {
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];

  let offset = 0;
  for (let i = 0; i < spec.group1Blocks; i++) {
    const block = data.subarray(offset, offset + spec.group1DataCodewords);
    dataBlocks.push(block);
    ecBlocks.push(rsComputeRemainder(block, spec.ecCodewordsPerBlock));
    offset += spec.group1DataCodewords;
  }
  for (let i = 0; i < spec.group2Blocks; i++) {
    const block = data.subarray(offset, offset + spec.group2DataCodewords);
    dataBlocks.push(block);
    ecBlocks.push(rsComputeRemainder(block, spec.ecCodewordsPerBlock));
    offset += spec.group2DataCodewords;
  }

  const out = new Uint8Array(spec.totalCodewords);
  let outIdx = 0;
  const maxDataLen = Math.max(spec.group1DataCodewords, spec.group2DataCodewords);

  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) {
        out[outIdx++] = block[i];
      }
    }
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (const ec of ecBlocks) {
      out[outIdx++] = ec[i];
    }
  }

  return out;
}

function computeFormatBits(ecLevel: QrErrorCorrectionLevel, mask: number): number {
  const data = (EC_FORMAT_INDICATOR[ecLevel] << 3) | (mask & 0x07);
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) {
      rem ^= 0x537 << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function computeVersionBits(version: number): number {
  let rem = version << 12;
  for (let i = 17; i >= 12; i--) {
    if ((rem >>> i) & 1) {
      rem ^= 0x1f25 << (i - 12);
    }
  }
  return (version << 12) | rem;
}

function createFunctionMatrix(version: number): {
  size: number;
  modules: Uint8Array;
  isFunction: Uint8Array;
} {
  const size = 17 + version * 4;
  const modules = new Uint8Array(size * size);
  const isFunction = new Uint8Array(size * size);

  const setFunctionModule = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    const idx = r * size + c;
    modules[idx] = dark ? 1 : 0;
    isFunction[idx] = 1;
  };

  // Finder patterns + 1-module white separators
  const drawFinder = (topRow: number, leftCol: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = topRow + dr;
        const c = leftCol + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        const dark = dist !== 2 && dist !== 4;
        setFunctionModule(r, c, dark);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    setFunctionModule(6, i, dark);
    setFunctionModule(i, 6, dark);
  }

  // Alignment patterns
  const centers = ALIGNMENT_CENTERS[version] ?? [];
  for (const rCenter of centers) {
    for (const cCenter of centers) {
      const overlapsTopLeft = rCenter <= 8 && cCenter <= 8;
      const overlapsTopRight = rCenter <= 8 && cCenter >= size - 9;
      const overlapsBottomLeft = rCenter >= size - 9 && cCenter <= 8;
      if (overlapsTopLeft || overlapsTopRight || overlapsBottomLeft) {
        continue;
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFunctionModule(rCenter + dr, cCenter + dc, dist !== 1);
        }
      }
    }
  }

  // Reserve format info areas (filled with actual bits per mask later)
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      setFunctionModule(8, i, false);
      setFunctionModule(i, 8, false);
    }
  }
  for (let i = size - 8; i < size; i++) {
    setFunctionModule(8, i, false);
  }
  for (let i = size - 7; i < size; i++) {
    setFunctionModule(i, 8, false);
  }
  // Fixed dark module at (4*version + 9, 8) = (size - 8, 8)
  setFunctionModule(size - 8, 8, true);

  // Version information (Versions 7–10)
  if (version >= 7) {
    const versionBits = computeVersionBits(version);
    for (let i = 0; i < 18; i++) {
      const dark = ((versionBits >>> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      setFunctionModule(a, b, dark);
      setFunctionModule(b, a, dark);
    }
  }

  return { size, modules, isFunction };
}

function writeFormatInfo(
  modules: Uint8Array,
  size: number,
  ecLevel: QrErrorCorrectionLevel,
  mask: number
): void {
  const bits = computeFormatBits(ecLevel, mask);
  const bitAt = (pos: number) => ((bits >>> pos) & 1);

  // Copy 1: around top-left finder
  const copy1Coords: ReadonlyArray<readonly [number, number]> = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = copy1Coords[i];
    modules[r * size + c] = bitAt(14 - i);
  }

  // Copy 2: bottom-left vertical + top-right horizontal
  for (let i = 0; i < 7; i++) {
    modules[(size - 1 - i) * size + 8] = bitAt(14 - i);
  }
  for (let i = 0; i < 8; i++) {
    modules[8 * size + (size - 8 + i)] = bitAt(7 - i);
  }
}

function placeCodewords(
  modules: Uint8Array,
  isFunction: Uint8Array,
  size: number,
  codewords: Uint8Array
): void {
  const totalBits = codewords.length * 8;
  let bitIndex = 0;
  let upward = true;

  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5; // Skip vertical timing pattern column
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        const idx = row * size + c;
        if (isFunction[idx]) continue;
        let dark = 0;
        if (bitIndex < totalBits) {
          dark = (codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1;
          bitIndex++;
        }
        modules[idx] = dark;
      }
    }
    upward = !upward;
  }
}

function shouldFlipMask(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default: return false;
  }
}

function applyMask(
  baseModules: Uint8Array,
  isFunction: Uint8Array,
  size: number,
  mask: number
): Uint8Array {
  const masked = new Uint8Array(baseModules);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const idx = r * size + c;
      if (!isFunction[idx] && shouldFlipMask(mask, r, c)) {
        masked[idx] ^= 1;
      }
    }
  }
  return masked;
}

function evaluatePenalty(modules: Uint8Array, size: number): number {
  let penalty = 0;

  // Rule 1: 5+ consecutive same-color modules in rows and columns
  for (let r = 0; r < size; r++) {
    let runColor = modules[r * size];
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      const color = modules[r * size + c];
      if (color === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = color;
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }
  for (let c = 0; c < size; c++) {
    let runColor = modules[c];
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      const color = modules[r * size + c];
      if (color === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = color;
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // Rule 2: 2x2 blocks of identical color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const color = modules[r * size + c];
      if (
        color === modules[r * size + c + 1] &&
        color === modules[(r + 1) * size + c] &&
        color === modules[(r + 1) * size + c + 1]
      ) {
        penalty += 3;
      }
    }
  }

  // Rule 3: Finder-like 1:1:3:1:1 patterns flanked by 4 light modules (11 modules)
  const matchesFinderPattern = (get: (i: number) => number, start: number): boolean => {
    const p1 =
      get(start) === 1 &&
      get(start + 1) === 0 &&
      get(start + 2) === 1 &&
      get(start + 3) === 1 &&
      get(start + 4) === 1 &&
      get(start + 5) === 0 &&
      get(start + 6) === 1 &&
      get(start + 7) === 0 &&
      get(start + 8) === 0 &&
      get(start + 9) === 0 &&
      get(start + 10) === 0;
    if (p1) return true;
    return (
      get(start) === 0 &&
      get(start + 1) === 0 &&
      get(start + 2) === 0 &&
      get(start + 3) === 0 &&
      get(start + 4) === 1 &&
      get(start + 5) === 0 &&
      get(start + 6) === 1 &&
      get(start + 7) === 1 &&
      get(start + 8) === 1 &&
      get(start + 9) === 0 &&
      get(start + 10) === 1
    );
  };

  for (let r = 0; r < size; r++) {
    const rowOffset = r * size;
    const getRow = (c: number) => modules[rowOffset + c];
    for (let c = 0; c <= size - 11; c++) {
      if (matchesFinderPattern(getRow, c)) penalty += 40;
    }
  }
  for (let c = 0; c < size; c++) {
    const getCol = (r: number) => modules[r * size + c];
    for (let r = 0; r <= size - 11; r++) {
      if (matchesFinderPattern(getCol, r)) penalty += 40;
    }
  }

  // Rule 4: Dark/light module ratio balance
  let darkCount = 0;
  const totalModules = size * size;
  for (let i = 0; i < totalModules; i++) {
    darkCount += modules[i];
  }
  const k = Math.floor(Math.abs(darkCount * 20 - totalModules * 10) / totalModules);
  penalty += k * 10;

  return penalty;
}

export interface QrMatrix {
  version: number;
  size: number;
  mask: number;
  modules: Uint8Array;
}

export function encodeQrMatrix(
  text: string,
  ecLevel: QrErrorCorrectionLevel = "M"
): QrMatrix {
  const payload = new TextEncoder().encode(text);
  const version = selectVersion(payload.length, ecLevel);
  const spec = VERSION_SPECS[ecLevel][version];

  const dataCodewords = encodeDataCodewords(payload, version, spec);
  const finalCodewords = interleaveCodewords(dataCodewords, spec);

  const { size, modules: baseModules, isFunction } = createFunctionMatrix(version);
  placeCodewords(baseModules, isFunction, size, finalCodewords);

  let bestMask = 0;
  let bestPenalty = Number.POSITIVE_INFINITY;
  let bestModules = baseModules;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = applyMask(baseModules, isFunction, size, mask);
    writeFormatInfo(candidate, size, ecLevel, mask);
    const penalty = evaluatePenalty(candidate, size);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
      bestModules = candidate;
    }
  }

  return {
    version,
    size,
    mask: bestMask,
    modules: bestModules,
  };
}

export function renderQrSvg(
  text: string,
  options?: {
    ecLevel?: QrErrorCorrectionLevel;
    quietZone?: number;
    pixelSize?: number;
  }
): string {
  const ecLevel = options?.ecLevel ?? "M";
  const quietZone = options?.quietZone ?? 4;
  const pixelSize = options?.pixelSize ?? 220;

  const { size, modules } = encodeQrMatrix(text, ecLevel);
  const viewSize = size + quietZone * 2;

  const pathSegments: string[] = [];
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (modules[r * size + c] === 1) {
        const start = c;
        while (c < size && modules[r * size + c] === 1) {
          c++;
        }
        const runLen = c - start;
        pathSegments.push(`M${start + quietZone} ${r + quietZone}h${runLen}v1h-${runLen}z`);
      } else {
        c++;
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelSize}" height="${pixelSize}" ` +
    `viewBox="0 0 ${viewSize} ${viewSize}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>` +
    `<path fill="#000000" d="${pathSegments.join("")}"/>` +
    `</svg>`
  );
}

export function generateQrDataUrl(
  text: string,
  options?: {
    ecLevel?: QrErrorCorrectionLevel;
    quietZone?: number;
    pixelSize?: number;
  }
): string {
  const svg = renderQrSvg(text, options);
  const base64 = Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
