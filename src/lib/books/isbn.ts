/**
 * Optional ISBN normalization and checksum validation.
 * ISBN is descriptive metadata only — books.id is the canonical identity.
 */

export function normalizeIsbn(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw)
    .trim()
    .replace(/[\s-]+/g, "")
    .toUpperCase();
  return cleaned.length > 0 ? cleaned : null;
}

export function isValidIsbn10(normalized: string): boolean {
  if (!/^\d{9}[\dX]$/.test(normalized)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = normalized[i];
    const digit = ch === "X" ? 10 : Number(ch);
    sum += digit * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(normalized: string): boolean {
  if (!/^\d{13}$/.test(normalized)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const digit = Number(normalized[i]);
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

export function validateOptionalIsbn(
  raw: unknown
): { ok: true; normalized: string | null } | { ok: false; error: string } {
  const normalized = normalizeIsbn(raw);
  if (normalized === null) {
    return { ok: true, normalized: null };
  }
  if (normalized.length === 10 && isValidIsbn10(normalized)) {
    return { ok: true, normalized };
  }
  if (normalized.length === 13 && isValidIsbn13(normalized)) {
    return { ok: true, normalized };
  }
  return {
    ok: false,
    error: "Invalid ISBN checksum. Enter a valid 10- or 13-digit ISBN or leave it blank.",
  };
}

export function isbnMatches(a: unknown, b: unknown): boolean {
  const na = normalizeIsbn(a);
  const nb = normalizeIsbn(b);
  if (!na || !nb) return false;
  return na === nb;
}
