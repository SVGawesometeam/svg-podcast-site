const test = require('node:test');
const assert = require('node:assert');
const { validate, isBot } = require('../lib/contact-validation');

const GOOD = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  topic: 'Podcast guest',
  details: 'I would like to pitch a guest for the show.',
  rendered: String(Date.now() - 30000),
};

test('accepts a well-formed submission', () => {
  const r = validate(GOOD);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.data.name, 'Jane Doe');
});

test('trims whitespace and keeps optional fields as empty strings', () => {
  const r = validate({ ...GOOD, name: '  Jane Doe  ', company: '' });
  assert.equal(r.data.name, 'Jane Doe');
  assert.equal(r.data.company, '');
});

test('rejects a missing required field, naming it', () => {
  const r = validate({ ...GOOD, details: '   ' });
  assert.equal(r.ok, false);
  assert.match(r.error, /details/i);
});

test('rejects a malformed email', () => {
  for (const bad of ['not-an-email', 'a@b', 'a b@c.com', '@example.com']) {
    assert.equal(validate({ ...GOOD, email: bad }).ok, false, `accepted: ${bad}`);
  }
});

test('rejects a topic that is not one of the offered options', () => {
  const r = validate({ ...GOOD, topic: 'Nonsense' });
  assert.equal(r.ok, false);
  assert.match(r.error, /topic/i);
});

test('rejects an over-length field', () => {
  assert.equal(validate({ ...GOOD, details: 'x'.repeat(5001) }).ok, false);
  assert.equal(validate({ ...GOOD, details: 'x'.repeat(5000) }).ok, true);
});

test('ignores fields it was not expecting', () => {
  const r = validate({ ...GOOD, isAdmin: true, extra: 'x' });
  assert.equal(r.ok, true);
  assert.equal(r.data.isAdmin, undefined, 'unexpected field reached the payload');
});

test('a filled honeypot is a bot', () => {
  assert.equal(isBot({ ...GOOD, website: 'http://spam.example' }), true);
});

test('a submission faster than three seconds is a bot', () => {
  assert.equal(isBot({ ...GOOD, rendered: String(Date.now() - 500) }), true);
});

test('a normal submission is not a bot', () => {
  assert.equal(isBot(GOOD), false);
});

// A missing or unreadable timestamp must not be treated as a bot. A cached
// page, a stripped hidden field or a script error would otherwise silently
// swallow a real enquiry, which is a far worse failure than letting spam through.
test('a missing or unparseable timestamp is not treated as a bot', () => {
  assert.equal(isBot({ ...GOOD, rendered: undefined }), false);
  assert.equal(isBot({ ...GOOD, rendered: '' }), false);
  assert.equal(isBot({ ...GOOD, rendered: 'banana' }), false);
});

test('an empty honeypot is not a bot', () => {
  assert.equal(isBot({ ...GOOD, website: '' }), false);
});
