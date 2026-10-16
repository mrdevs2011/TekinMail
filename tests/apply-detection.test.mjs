import test from 'node:test';
import assert from 'node:assert/strict';
import { detectAccountStatus, applyDetection } from '../api/_ban-detector.js';

function fakeSupabase({ failWith } = {}) {
  const calls = [];
  const chain = (op, table, payload, opts) => {
    const rec = { op, table, payload, opts, filters: [] };
    calls.push(rec);
    const res = { error: failWith || null };
    const q = { eq(k, v) { rec.filters.push([k, v]); return q; }, then(r) { return Promise.resolve(res).then(r); } };
    return q;
  };
  return { calls, from: (t) => ({ upsert: (p, o) => chain('upsert', t, p, o), update: (p) => chain('update', t, p) }) };
}
const rec = { id: 'e1', user_id: 'u1', address: '90@bombaclat.uz' };

test('banned -> email_bans upsert (address,service bo\'yicha)', async () => {
  const sb = fakeSupabase();
  const det = detectAccountStatus({ from: 'no-reply@mail.anthropic.com', fromName: 'Anthropic <no-reply@mail.anthropic.com>', subject: 'Your account has been suspended', text: 'As a result, we have revoked your access to Claude.' });
  const r = await applyDetection(sb, rec, 'm1', 'Your account has been suspended', det);
  assert.equal(r.applied, true);
  assert.equal(sb.calls[0].op, 'upsert');
  assert.equal(sb.calls[0].table, 'email_bans');
  assert.equal(sb.calls[0].payload.service, 'anthropic');
  assert.equal(sb.calls[0].payload.status, 'banned');
  assert.equal(sb.calls[0].opts.onConflict, 'address,service');
});

test('lifted -> faqat mavjud banned yozuvni yangilaydi (yangi yozuv yaratmaydi)', async () => {
  const sb = fakeSupabase();
  const r = await applyDetection(sb, rec, 'm2', 'Reinstated', { service: 'anthropic', label: 'Anthropic', event: 'lifted', evidence: 'x' });
  assert.equal(r.applied, true);
  assert.equal(sb.calls[0].op, 'update');
  assert.deepEqual(sb.calls[0].filters.sort(), [['address', '90@bombaclat.uz'], ['service', 'anthropic'], ['status', 'banned']].sort());
});

test('detection null -> bazaga hech narsa yozilmaydi', async () => {
  const sb = fakeSupabase();
  const r = await applyDetection(sb, rec, 'm3', 's', null);
  assert.equal(r.applied, false);
  assert.equal(sb.calls.length, 0);
});

test('jadval yo\'q (DB xato) -> exception tashlamaydi', async () => {
  const sb = fakeSupabase({ failWith: { message: 'relation "email_bans" does not exist' } });
  const r = await applyDetection(sb, rec, 'm4', 's', { service: 'anthropic', label: 'Anthropic', event: 'banned', evidence: 'x' });
  assert.equal(r.applied, false);
});
