import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.KV_REST_API_URL = 'https://roles.invalid';
process.env.KV_REST_API_TOKEN = 'synthetic-test-token';
const { default: handler } = await import('./gate.js');
const owner = '0xE5350D96FC3161BF5c385843ec5ee24E8B465B2f';
const stranger = `0x${'2'.repeat(40)}`;
const gate = Buffer.from(JSON.stringify({ kind: 'multi', combine: 'any', rules: [{ kind: 'role', role: 'Partner' }] })).toString('base64url');
async function check(address, query = true) {
  const path = `multi/${gate}/${address}/checkAccess`;
  const res = { code: 0, body: null, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await handler(query ? { query: { p: path } } : { url: `/api/gate/${path}` }, res);
  return res;
}
test('Push DID and bare address use the same existing role authority', async t => {
  let roles = { [owner.toLowerCase()]: [{ label: 'Partner' }] };
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://roles.invalid');
    assert.deepEqual(JSON.parse(options.body), ['GET', 'bittrees:roles']);
    return { json: async () => ({ result: JSON.stringify(roles) }) };
  });
  for (const query of [true, false]) {
    for (const address of [owner, owner.toLowerCase(), `eip155:${owner}`, `eip155:${owner.toLowerCase()}`]) {
      const r = await check(address, query);
      assert.equal(r.code, 200); assert.equal(r.body.access, true);
    }
  }
  const denied = await check(`eip155:${stranger}`);
  assert.equal(denied.code, 403); assert.equal(denied.body.access, false);
  roles = {};
  const revoked = await check(`eip155:${owner}`);
  assert.equal(revoked.code, 403); assert.equal(revoked.body.access, false);
  const calls = fetch.mock.callCount();
  for (const address of [`solana:${owner}`, `eip155:1:${owner}`, `eip155:${owner}:extra`, `eip155:${owner.slice(0,-1)}`, `prefix${owner}`]) {
    assert.equal((await check(address)).code, 400);
  }
  assert.equal(fetch.mock.callCount(), calls, 'invalid identifiers must fail before authority lookup');
});
