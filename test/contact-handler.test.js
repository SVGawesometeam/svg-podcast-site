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

test('a provider failure surfaces a usable message, not the provider response', async () => {
  const { res } = await run(GOOD, { resendStatus: 401 });
  assert.equal(res.statusCode, 502);
  assert.match(res.body.error, /pr@marinamogilko\.co/);
  assert.ok(!/401|resend|bearer|key/i.test(JSON.stringify(res.body)), 'leaked provider detail');
});

test('the API key never appears in a response body', async () => {
  for (const opts of [{}, { resendStatus: 500 }, { key: null }]) {
    const { res } = await run(GOOD, opts);
    assert.ok(!JSON.stringify(res.body).includes('test-key'), 'key leaked to the client');
  }
});
