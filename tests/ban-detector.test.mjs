import test from 'node:test';
import assert from 'node:assert/strict';
import { detectAccountStatus as d } from '../api/_ban-detector.js';

const ANTH = { from: 'no-reply-abc123@mail.anthropic.com', fromName: 'Anthropic <no-reply-abc123@mail.anthropic.com>', fromAddress: 'no-reply@mail.anthropic.com' };
const IG = { from: 'security@mail.instagram.com', fromName: 'Instagram <security@mail.instagram.com>', fromAddress: 'security@mail.instagram.com' };

// ---- HAQIQIY: skrinshotdagi Anthropic xati ----
test('Anthropic suspended (haqiqiy xat) -> banned', () => {
  const r = d({ ...ANTH, subject: 'Your account has been suspended', text:
    `Hello,\nAn internal investigation of suspicious signals associated with your account indicates a violation of our Usage Policy. As a result, we have revoked your access to Claude.\nTo appeal our decision, log in to claude.ai with this account and you'll be taken to the appeals page. You can learn more about the process here.\nRegards\nAnthropic's Safeguards Team\nReference: TS-01a140c7-a000-7787-ad83-c71c03d21fbb` });
  assert.equal(r?.service, 'anthropic');
  assert.equal(r?.event, 'banned');
});

test('Instagram disabled -> banned', () => {
  const r = d({ ...IG, subject: 'Your Instagram account has been disabled', text: 'We have disabled your account because it violated our Terms of Use.' });
  assert.equal(r?.service, 'instagram'); assert.equal(r?.event, 'banned');
});

test('Instagram "we\'ve disabled your account" (curly apostrophe)', () => {
  const r = d({ ...IG, subject: 'Account notice', text: 'Hi, we\u2019ve disabled your Instagram account.' });
  assert.equal(r?.event, 'banned');
});

test('Facebook (facebookmail) disabled -> facebook, instagram emas', () => {
  const r = d({ from: 'notification@facebookmail.com', fromName: 'Facebook <notification@facebookmail.com>', fromAddress: 'notification@facebookmail.com', subject: 'Your account has been disabled', text: 'Your Facebook account has been disabled.' });
  assert.equal(r?.service, 'facebook');
});

test('Lift: reinstated -> lifted', () => {
  const r = d({ ...ANTH, subject: 'Your account has been reinstated', text: 'After review, your account has been reinstated and you can use Claude again.' });
  assert.equal(r?.event, 'lifted');
});

test('Lift: appeal approved -> lifted (ban iborasi ham bo\'lsa ham)', () => {
  const r = d({ ...ANTH, subject: 'Appeal update', text: 'Your account was suspended earlier. Your appeal has been approved.' });
  assert.equal(r?.event, 'lifted');
});

test('Appeal denied -> banned', () => {
  const r = d({ ...ANTH, subject: 'Update on your appeal', text: 'We have reviewed it and your appeal has been denied.' });
  assert.equal(r?.event, 'banned');
});

// ---- FALSE POSITIVE: bular ban EMAS ----
const NEG = [
  ['Sender mos emas (boshqa domen)', { from: 'x@evil.com', fromName: 'x@evil.com', fromAddress: 'x@evil.com', subject: 'Your account has been suspended', text: 'Your account has been suspended.' }],
  ['Ogohlantirish: may be suspended', { ...ANTH, subject: 'Action required', text: 'Your account may be suspended if you do not verify your email.' }],
  ['Ogohlantirish: will be suspended', { ...ANTH, subject: 'Action required', text: 'Your account will be suspended in 3 days.' }],
  ['Shartli: if your account is suspended', { ...ANTH, subject: 'Help', text: 'If your account has been suspended, you can appeal on the help page.' }],
  ['"if you believe ... suspended in error"', { ...ANTH, subject: 'Notice', text: 'If you believe your account was suspended in error, contact support.' }],
  ['Inkor: has not been suspended', { ...ANTH, subject: 'Good news', text: 'Your account has not been suspended.' }],
  ['Inkor: "doesn\'t mean your account was suspended"', { ...ANTH, subject: 'Login', text: 'This alert doesn\'t mean your account was suspended.' }],
  ['Oddiy xavfsizlik xabari', { ...ANTH, subject: 'New login to your account', text: 'We noticed a new login. If this wasn\'t you, reset your password.' }],
  ['Verification code', { ...ANTH, subject: 'Your verification code', text: 'Your code is 123456. It expires in 10 minutes.' }],
  ['Welcome', { ...IG, subject: 'Welcome to Instagram', text: 'Welcome! Complete your profile to get started.' }],
  ['Newsletter: banned books', { from: 'news@openai.com', fromName: 'OpenAI <news@openai.com>', fromAddress: 'news@openai.com', subject: 'Weekly digest', text: 'Why some books were banned and how models handle sensitive topics.' }],
  ['Lift shartli: once approved', { ...ANTH, subject: 'Appeal received', text: 'We received your appeal. Once your appeal is approved, your account will be restored.' }],
  ['Soxta (DKIM fail)', { ...ANTH, subject: 'Your account has been suspended', text: 'Your account has been suspended.', raw: 'Authentication-Results: mx.cloudflare.net; dkim=fail header.d=anthropic.com\r\n\r\nbody' }],
  ['Instagram sender lekin matnda instagram yo\'q (facebookmail)', { from: 'a@facebookmail.com', fromName: 'Meta <a@facebookmail.com>', fromAddress: 'a@facebookmail.com', subject: 'Notice', text: 'Your account has been disabled.' }, 'facebook-not-instagram']
];
for (const [name, input, expectService] of NEG) {
  test(`NEG: ${name}`, () => {
    const r = d(input);
    if (expectService === 'facebook-not-instagram') { assert.equal(r?.service, 'facebook'); return; }
    assert.equal(r, null, JSON.stringify(r));
  });
}

test('Bo\'sh/yaroqsiz kirish xato bermaydi', () => {
  assert.equal(d(), null);
  assert.equal(d({}), null);
  assert.equal(d({ from: null, subject: null, text: null }), null);
});
