/** scrypt cost parameters (OWASP: N=2^17 r=8 p=1 is the stronger setting; 2^15 keeps login ~100 ms). */
export const SCRYPT_N = 32_768;
export const SCRYPT_R = 8;
export const SCRYPT_P = 1;
export const SCRYPT_KEY_BYTES = 64;
export const SCRYPT_SALT_BYTES = 16;
/** Parsed hashes with parameters above these bounds are refused (a tampered DB must not DoS the server). */
export const SCRYPT_MAX_N = 1 << 20;
export const SCRYPT_MAX_R = 32;
export const SCRYPT_MAX_P = 16;
export const HASH_VERSION = "scrypt";

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 256;

export const SESSION_ID_BYTES = 32;
export const MIN_SECRET_LENGTH = 32;
export const GENERATED_SECRET_BYTES = 48;
export const COOKIE_NAME = "recap_session";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;
/** Sliding window: each use pushes the expiry this far out (capped by the absolute maximum). */
export const SESSION_IDLE_TTL_MS = 7 * MS_PER_DAY;
/** A session never lives longer than this, however active. */
export const SESSION_ABSOLUTE_TTL_MS = 30 * MS_PER_DAY;
/** `last_seen_at` / expiry are rewritten at most this often (limits SQLite writes). */
export const SESSION_TOUCH_INTERVAL_MS = 5 * MS_PER_MINUTE;
/** Cookie lifetime when the user ticks "remember me". */
export const REMEMBER_COOKIE_MAX_AGE_SEC = SESSION_ABSOLUTE_TTL_MS / 1000;

export const MAX_FAILED_ATTEMPTS = 5;
/** Failures per email (any IP) before locking it; stops attackers rotating IPs. */
export const MAX_FAILED_ATTEMPTS_PER_EMAIL = 20;
export const LOCKOUT_MS = 15 * MS_PER_MINUTE;
export const MAX_TRACKED_KEYS = 10_000;
