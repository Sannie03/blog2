const test = require('node:test');
const assert = require('node:assert/strict');
process.env.AUTH_SECRET ||= 'test-secret-for-tests';
const { hashPassword, verifyPassword, signToken, verifyToken, getBearerToken } = require('../src/auth');

test('password hashes verify without storing plaintext', () => {
  const hash = hashPassword('secret-password');
  assert.notEqual(hash, 'secret-password');
  assert.equal(verifyPassword('secret-password', hash), true);
  assert.equal(verifyPassword('wrong-password', hash), false);
});

test('issued token contains verifiable user identity', () => {
  const token = signToken({ id: 42, username: 'admin', role: 'admin' });
  const decoded = verifyToken(token);
  assert.deepEqual(decoded, {
    sub: 42,
    username: 'admin',
    role: 'admin',
    exp: decoded.exp,
  });
});

test('bearer token extraction only accepts the bearer scheme', () => {
  assert.equal(getBearerToken({ headers: { authorization: 'Bearer abc123' } }), 'abc123');
  assert.equal(getBearerToken({ headers: { authorization: 'Basic abc123' } }), '');
});
