import crypto from "crypto";

function decodeFernetKey(rawKey: string): { signingKey: Buffer; encryptionKey: Buffer } | null {
  try {
    const normalized = rawKey.trim().replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const buf = Buffer.from(padded, "base64");
    if (buf.length !== 32) return null;
    return {
      signingKey: buf.subarray(0, 16),
      encryptionKey: buf.subarray(16, 32),
    };
  } catch {
    return null;
  }
}

function decodeBase64Url(token: string): Buffer | null {
  try {
    const normalized = token.trim().replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return Buffer.from(padded, "base64");
  } catch {
    return null;
  }
}

function encodeBase64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
}

export function fernetDecrypt(token: string, rawKey: string | undefined): string | null {
  if (!token || !rawKey || !token.startsWith("gAAAAAB")) return null;
  const keys = decodeFernetKey(rawKey);
  if (!keys) return null;

  const data = decodeBase64Url(token);
  if (!data || data.length < 73 || data[0] !== 0x80) return null;

  const payload = data.subarray(0, data.length - 32);
  const mac = data.subarray(data.length - 32);
  const expectedMac = crypto.createHmac("sha256", keys.signingKey).update(payload).digest();

  if (mac.length !== expectedMac.length || !crypto.timingSafeEqual(mac, expectedMac)) {
    return null;
  }

  const iv = data.subarray(9, 25);
  const ciphertext = data.subarray(25, data.length - 32);
  if (ciphertext.length === 0 || ciphertext.length % 16 !== 0) return null;

  try {
    const decipher = crypto.createDecipheriv("aes-128-cbc", keys.encryptionKey, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf-8");
  } catch {
    return null;
  }
}

export function fernetEncrypt(plaintext: string, rawKey: string | undefined): string | null {
  if (!plaintext || !rawKey) return null;
  const keys = decodeFernetKey(rawKey);
  if (!keys) return null;

  const iv = crypto.randomBytes(16);
  const ts = Buffer.alloc(8);
  ts.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000)));

  const cipher = crypto.createCipheriv("aes-128-cbc", keys.encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf-8")), cipher.final()]);

  const headerAndBody = Buffer.concat([Buffer.from([0x80]), ts, iv, ciphertext]);
  const hmac = crypto.createHmac("sha256", keys.signingKey).update(headerAndBody).digest();
  return encodeBase64Url(Buffer.concat([headerAndBody, hmac]));
}

/**
 * Safely decrypts Fernet-encrypted values using the configured key(s).
 * Returns original string if not encrypted or if key is missing/invalid.
 */
function safeDecryptWithKeys(value: unknown, primaryKey: string | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (!str.startsWith("gAAAAAB")) return str;

  const candidateKeys = [
    primaryKey,
    process.env.ENCRYPTION_KEY,
    process.env.PII_ENCRYPTION_KEY,
    process.env.EMAIL_ENCRYPTION_KEY,
  ].filter((k, i, arr): k is string => Boolean(k) && arr.indexOf(k) === i);

  for (const key of candidateKeys) {
    const out = fernetDecrypt(str, key);
    if (out !== null) return out;
  }
  return str;
}

export function safeDecryptData(value: unknown): string {
  return safeDecryptWithKeys(value, process.env.ENCRYPTION_KEY);
}

export function safeDecryptPii(value: unknown): string {
  return safeDecryptWithKeys(value, process.env.PII_ENCRYPTION_KEY);
}

export function safeDecryptEmail(value: unknown): string {
  return safeDecryptWithKeys(value, process.env.EMAIL_ENCRYPTION_KEY);
}

export function maybeEncryptData(value: string): string {
  if (!value) return "";
  return fernetEncrypt(value, process.env.ENCRYPTION_KEY) ?? value;
}

export function maybeEncryptPii(value: string): string {
  if (!value) return "";
  return fernetEncrypt(value, process.env.PII_ENCRYPTION_KEY) ?? value;
}

export function maybeEncryptEmail(value: string): string {
  if (!value) return "";
  return fernetEncrypt(value, process.env.EMAIL_ENCRYPTION_KEY) ?? value;
}

function piiHmac(normalized: string): string | null {
  const key = process.env.PII_ENCRYPTION_KEY;
  if (!key || !normalized) return null;
  return crypto
    .createHmac("sha256", Buffer.from(key, "utf-8"))
    .update(normalized, "utf-8")
    .digest("hex");
}

export function nameBlindIndex(firstname: string, lastname: string): string | null {
  const fn = firstname.trim().toLowerCase();
  const ln = lastname.trim().toLowerCase();
  if (!fn && !ln) return null;
  return piiHmac(`${fn} ${ln}`);
}

export function phoneBlindIndex(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return piiHmac(digits);
}

export function titleBlindIndex(title: string): string | null {
  const norm = title.trim().toLowerCase();
  return norm ? piiHmac(norm) : null;
}

export function authorBlindIndex(author: string): string | null {
  const norm = author.trim().toLowerCase();
  return norm ? piiHmac(norm) : null;
}

export function isbnBlindIndex(isbn: string): string | null {
  const digits = isbn.replace(/\D/g, "");
  return digits ? piiHmac(digits) : null;
}
