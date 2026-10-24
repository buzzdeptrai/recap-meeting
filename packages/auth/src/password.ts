import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import {
  HASH_VERSION,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  SCRYPT_KEY_BYTES,
  SCRYPT_MAX_N,
  SCRYPT_MAX_P,
  SCRYPT_MAX_R,
  SCRYPT_N,
  SCRYPT_P,
  SCRYPT_R,
  SCRYPT_SALT_BYTES,
} from "./constants";

const BYTES_PER_BLOCK = 128;
const MEMORY_HEADROOM = 2;

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

const memoryFor = (n: number, r: number) => BYTES_PER_BLOCK * n * r * MEMORY_HEADROOM;

/** `scrypt$N$r$p$<salt b64>$<hash b64>`. */
export async function hashPassword(
  password: string,
  salt: Buffer = randomBytes(SCRYPT_SALT_BYTES),
): Promise<string> {
  const key = await deriveKey(password, salt, SCRYPT_KEY_BYTES, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: memoryFor(SCRYPT_N, SCRYPT_R),
  });
  const parts = [
    HASH_VERSION,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    key.toString("base64"),
  ];
  return parts.join("$");
}

interface ParsedHash {
  n: number;
  r: number;
  p: number;
  salt: Buffer;
  key: Buffer;
}

function parseHash(stored: string): ParsedHash | null {
  const [version, n, r, p, salt, key, extra] = stored.split("$");
  if (version !== HASH_VERSION || !key || extra !== undefined) return null;
  const params = [Number(n), Number(r), Number(p)];
  if (!params.every((value) => Number.isInteger(value) && value > 0)) return null;
  const [nn, rr, pp] = params as [number, number, number];
  const isPowerOfTwo = (nn & (nn - 1)) === 0;
  if (!isPowerOfTwo || nn > SCRYPT_MAX_N || rr > SCRYPT_MAX_R || pp > SCRYPT_MAX_P) return null;
  const keyBuf = Buffer.from(key, "base64");
  if (keyBuf.length === 0) return null;
  return { n: nn, r: rr, p: pp, salt: Buffer.from(salt ?? "", "base64"), key: keyBuf };
}

/** Constant-time comparison of the derived key; malformed hashes simply fail. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  const derived = await deriveKey(password, parsed.salt, parsed.key.length, {
    N: parsed.n,
    r: parsed.r,
    p: parsed.p,
    maxmem: memoryFor(parsed.n, parsed.r),
  });
  return timingSafeEqual(derived, parsed.key);
}

/** True when the stored hash uses weaker parameters than the current constants. */
export function needsRehash(stored: string): boolean {
  const parsed = parseHash(stored);
  return !parsed || parsed.n < SCRYPT_N || parsed.r < SCRYPT_R || parsed.p < SCRYPT_P;
}

/** Returns a Vietnamese message when the password is unacceptable, otherwise null. */
export function checkPasswordPolicy(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Mật khẩu tối đa ${MAX_PASSWORD_LENGTH} ký tự.`;
  }
  if (password.trim().length === 0) return "Mật khẩu không được để trống.";
  return null;
}
