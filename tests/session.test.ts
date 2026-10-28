import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionManager } from '../src/lib/session.server.ts';

const secret = 'a-test-secret-with-at-least-32-characters';
function cookieHeader(headers: Headers) {
  return headers.getSetCookie().filter((c) => !c.includes('Max-Age=0')).map((c) => c.split(';')[0]).join('; ');
}
test('session encrypts large tokens and restores chunked HttpOnly cookies',async () => {
  const manager = await createSessionManager(new Request('https://example.com/account'),secret);
  const value = {accessToken:'sensitive-token'.repeat(600)};
  await manager.setSessionItem('customerAccount',value);
  const headers = new Headers((await manager.commit?.()) || undefined);
  assert.ok(headers.getSetCookie().length > 2);
  for (const cookie of headers.getSetCookie()) {
    assert.match(cookie,/Secure; HttpOnly; SameSite=Lax/);
    assert.ok(!cookie.includes('sensitive-token'));
  }
  const restored = await createSessionManager(new Request('https://example.com/account',{headers:{cookie:cookieHeader(headers)}}),secret);
  assert.deepEqual(await restored.getSessionItem('customerAccount'),value);
  assert.equal(new Headers((await restored.commit?.()) || undefined).getSetCookie().length,0);
});
test('session rejects tampering and cookies from a different origin',async () => {
  const manager = await createSessionManager(new Request('https://example.com/account'),secret);
  await manager.setSessionItem('customerAccount',{accessToken:'private'});
  const headers = new Headers((await manager.commit?.()) || undefined);
  const cookie = cookieHeader(headers);
  const otherOrigin = await createSessionManager(new Request('https://other.example/account',{headers:{cookie}}),secret);
  assert.equal(await otherOrigin.getSessionItem('customerAccount'),undefined);
  const tampered = await createSessionManager(new Request('https://example.com/account',{headers:{cookie:cookie.replace(/(\.0=)./, '$1!')}}),secret);
  assert.equal(await tampered.getSessionItem('customerAccount'),undefined);
  assert.ok(new Headers((await tampered.commit?.()) || undefined).getSetCookie().every((c) => c.includes('Max-Age=0')));
});
test('logout clears all cookie chunks and short secrets fail closed',async () => {
  await assert.rejects(createSessionManager(new Request('https://example.com'), 'short'),/at least 32/);
  const manager = await createSessionManager(new Request('https://example.com'),secret);
  await manager.setSessionItem('customerAccount',{accessToken:'x'.repeat(7000)});
  const saved = new Headers((await manager.commit?.()) || undefined);
  const restored = await createSessionManager(new Request('https://example.com',{headers:{cookie:cookieHeader(saved)}}),secret);
  await restored.removeSessionItem('customerAccount');
  const cleared = new Headers((await restored.commit?.()) || undefined);
  assert.equal(cleared.getSetCookie().length,saved.getSetCookie().length);
  assert.ok(cleared.getSetCookie().every((c) => c.includes('Max-Age=0')));
});
