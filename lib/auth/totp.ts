import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * RFC 6238 TOTP (30s step, 6 digits, HMAC-SHA1) — compatible with Google
 * Authenticator, Authy, 1Password, etc. No SMS: codes come from an
 * authenticator app or hardware key, sidestepping SIM-swap risk.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of input.replace(/=+$/, "").toUpperCase()) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

export function totpCode(secretBase32: string, at = Date.now()): string {
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  return hotp(base32Decode(secretBase32), counter);
}

/** Verify with ±1 step of clock drift, in constant time per candidate. */
export function verifyTotp(secretBase32: string, code: string): boolean {
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  const secret = base32Decode(secretBase32);
  const candidate = Buffer.from(cleaned);
  for (const c of [counter - 1, counter, counter + 1]) {
    const expected = Buffer.from(hotp(secret, c));
    if (
      expected.length === candidate.length &&
      timingSafeEqual(expected, candidate)
    ) {
      return true;
    }
  }
  return false;
}
