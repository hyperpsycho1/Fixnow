import {createHmac,timingSafeEqual} from 'node:crypto';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function isAuthSecretConfigured() {
  const value = process.env.AUTH_SECRET;
  return Boolean(value && Buffer.byteLength(value) >= 32 && !/^(replace|change|your|example)/i.test(value));
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!isAuthSecretConfigured() || !value) {
    throw new Error('AUTH_SECRET must contain at least 32 bytes.');
  }
  return value;
}

export function makeSession(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readSession(token?: string) {
  if (!token) return null;
  try {
    const [payload, signature, ...extra] = token.split('.');
    if (!payload || !signature || extra.length) return null;
    const expected = createHmac('sha256', secret()).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const session: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!session || typeof session !== 'object') return null;
    const data = session as {email?: unknown; exp?: unknown};
    return typeof data.email === 'string' && typeof data.exp === 'number' && data.exp > Date.now()
      ? data.email
      : null;
  } catch {
    return null;
  }
}
