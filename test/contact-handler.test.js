const test = require('node:test');
const assert = require('node:assert');
const handler = require('../api/contact');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

const GOOD = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  topic: 'Podcast guest',
  details: 'I would like to pitch a guest.',
  rendered: String(Date.now() - 30000),
};

// Swap fetch for a recorder, run the handler, hand back what was captured.
async function run(body, { method = 'POST', key = 'test-key', resendStatus = 200 } = {}) {
  const realFetch = global.fetch;
  const realKey = process.env.RESEND_API_KEY;
  const calls = [];

  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return { ok: resendStatus < 400, status: resendStatus };
  };
  if (key === null) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = key;

  const res = mockRes();
  try {
    await handler({ method, body }, res);
  } finally {
    global.fetch = realFetch;
    if (realKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = realKey;
  }
  return { res, calls };
}

test('rejects anything but POST', async () => {
  const { res, calls } = await run(GOOD, { method: 'GET' });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'POST');
  assert.equal(calls.length, 0, 'sent mail on a GET');
});

test('sends a well-formed submission and reports success', async () => {
  const { res, calls } = await run(GOOD);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
});

test('addresses the mail to pr@ with the sender as Reply-To', async () => {
  const { calls } = await run(GOOD);
  const sent = JSON.parse(calls[0].init.body);
  assert.deepEqual(sent.to, ['pr@marinamogilko.co']);
  assert.equal(sent.reply_to, 'jane@example.com');
  assert.match(sent.subject, /^\[SVG site\] Podcast guest — Jane Doe$/);
  assert.match(sent.text, /I would like to pitch a guest\./);
});

test('puts the company in the subject when one is given', async () => {
  const { calls } = await run({ ...GOOD, company: 'Acme' });
  assert.match(JSON.parse(calls[0].init.body).subject, /— Jane Doe, Acme$/);
});

test('a brand deal goes to pr@ like everything else', async () => {
  const { calls } = await run({ ...GOOD, topic: 'Brand deal / sponsorship' });
  assert.deepEqual(JSON.parse(calls[0].init.body).to, ['pr@marinamogilko.co']);
});

test('accepts a JSON string body, as some runtimes deliver it', async () => {
  const { res, calls } = await run(JSON.stringify(GOOD));
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
});

test('a bot gets 200 and no mail is sent', async () => {
  const { res, calls } = await run({ ...GOOD, website: 'http://spam.example' });
  assert.equal(res.statusCode, 200, 'a bot should not learn it was caught');
  assert.equal(calls.length, 0, 'spam was emailed');
});

test('an invalid submission is refused without sending', async () => {
  const { res, calls } = await run({ ...GOOD, email: 'nope' });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /email/i);
  assert.equal(calls.length, 0);
});

test('a missing API key fails loudly rather than silently dropping the enquiry', async () => {
  const { res, calls } = await run(GOOD, { key: null });
  assert.equal(res.statusCode, 500);
  assert.match(res.body.error, /pr@marinamogilko\.co/, 'no fallback address offered');
  assert.equal(calls.length, 0);
});

// The message shown to a visitor must stay plain and actionable. A bare status
// code in `detail` is deliberate — it is not a secret, and it is what makes a
// failure diagnosable from the browser's network tab without digging through
// server logs. What must never appear is a credential or the provider's raw
// response body.
test('a provider failure surfaces a usable message, never a credential', async () => {
  const { res } = await run(GOOD, { resendStatus: 401 });
  assert.equal(res.statusCode, 502);
  assert.match(res.body.error, /pr@marinamogilko\.co/);

  // The visible message stays free of provider and credential detail.
  assert.ok(!/resend|bearer|api[_ -]?key|token/i.test(res.body.error), 'error message leaked provider detail');

  // Nothing anywhere in the response may carry the key or an auth header.
  const whole = JSON.stringify(res.body);
  assert.ok(!whole.includes('test-key'), 'API key leaked to the client');
  assert.ok(!/bearer/i.test(whole), 'authorization header leaked to the client');
});

test('the API key never appears in a response body', async () => {
  for (const opts of [{}, { resendStatus: 500 }, { key: null }]) {
    const { res } = await run(GOOD, opts);
    assert.ok(!JSON.stringify(res.body).includes('test-key'), 'key leaked to the client');
  }
});

// The From address is Resend's shared domain: no DNS setup, and it is cosmetic
// because this mail only ever goes to our own inbox. What matters is that
// Reply-To is the person who wrote in.
test('sends from a domain that needs no DNS, and replies go to the sender', async () => {
  const { calls } = await run(GOOD);
  const sent = JSON.parse(calls[0].init.body);
  assert.match(sent.from, /resend\.dev>$/, 'From should need no domain verification');
  assert.equal(sent.reply_to, GOOD.email);
  assert.deepEqual(sent.to, ['pr@marinamogilko.co']);
});
