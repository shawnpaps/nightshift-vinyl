import { EncryptJWT, jwtDecrypt } from 'jose';
import type { WritableCustomerSessionManager } from '@shopify/hydrogen/customer-account';

const COOKIE = '__Host-nightshift-session';
const CHUNK_SIZE = 3600;
const MAX_CHUNKS = 6;
const MAX_AGE = 60 * 60 * 24 * 7;

// Authenticated encryption keeps OAuth tokens out of JavaScript and plaintext cookies.
// Chunking accommodates Shopify's access, refresh and ID tokens without truncation.
export async function createSessionManager(request: Request, secret?: string): Promise<WritableCustomerSessionManager> {
  const cookies = new Map(request.headers.get('cookie')?.split(';').map((entry) => {
    const [name, ...value] = entry.trim().split('=');
    return [name, value.join('=')];
  }));
  let state: Record<string, unknown> = {};
  let dirty = false;
  const key = secret ? new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))) : undefined;
  if (secret && secret.length < 32) throw new Error('CUSTOMER_ACCOUNT_SESSION_SECRET must contain at least 32 characters.');
  const count = Number(cookies.get(COOKIE));
  if (key && Number.isInteger(count) && count > 0 && count <= MAX_CHUNKS) {
    try {
      const encrypted = Array.from({ length: count }, (_, i) => cookies.get(`${COOKIE}.${i}`) || '').join('');
      const { payload } = await jwtDecrypt(encrypted, key, { issuer: 'nightshift-vinyl', audience: new URL(request.url).origin });
      if (payload.session && typeof payload.session === 'object' && !Array.isArray(payload.session)) state = payload.session as Record<string, unknown>;
    } catch {
      dirty = true; // Expire tampered, expired or incomplete sessions.
    }
  }
  return {
    getSessionOrigin: () => new URL(request.url).origin,
    getSessionItem: (name) => state[name],
    setSessionItem: (name, value) => { state[name] = value; dirty = true; },
    removeSessionItem: (name) => { delete state[name]; dirty = true; },
    async commit() {
      const headers = new Headers();
      if (!dirty) return headers;
      if (!key) throw new Error('Customer Account session secret is required.');
      const encrypted = Object.keys(state).length
        ? await new EncryptJWT({ session: state }).setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
            .setIssuer('nightshift-vinyl').setAudience(new URL(request.url).origin).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).encrypt(key)
        : '';
      const chunks = Math.ceil(encrypted.length / CHUNK_SIZE);
      if (chunks > MAX_CHUNKS) throw new Error('Customer session exceeds cookie storage capacity.');
      const write = (name: string, value: string, maxAge: number) => headers.append('Set-Cookie', `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);
      write(COOKIE, String(chunks), chunks ? MAX_AGE : 0);
      for (let i = 0; i < Math.max(Number.isInteger(count) && count <= MAX_CHUNKS ? count : 0, chunks); i++) {
        write(`${COOKIE}.${i}`, encrypted.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE), i < chunks ? MAX_AGE : 0);
      }
      dirty = false;
      headers.set('Cache-Control', 'private, no-store');
      return headers;
    },
  };
}
