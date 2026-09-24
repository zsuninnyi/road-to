import { createHmac } from 'node:crypto';
import { hmacEqual } from '../crypto/tokens.js';

const STATE_TTL_MS = 15 * 60 * 1000;

type StatePayload = {
  u: string;
  e: number;
};

export function createOAuthState(userId: string, secret: string, nowMs = Date.now()): string {
  const body = Buffer.from(
    JSON.stringify({ u: userId, e: nowMs + STATE_TTL_MS } satisfies StatePayload),
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function readOAuthState(
  state: string,
  secret: string,
  nowMs = Date.now(),
): { userId: string } | null {
  const [body, sig] = state.split('.');
  if (!body || !sig) {
    return null;
  }
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  if (!hmacEqual(sig, expected)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload;
    if (typeof parsed.u !== 'string' || typeof parsed.e !== 'number' || parsed.e < nowMs) {
      return null;
    }
    return { userId: parsed.u };
  } catch {
    return null;
  }
}
