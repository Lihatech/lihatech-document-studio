import assert from 'node:assert/strict';
import { build } from 'esbuild';

async function accessCheck(env) {
  const result = await build({
    entryPoints: ['src/lib/firebase.ts'], bundle: true, write: false,
    platform: 'node', format: 'esm', define: { 'import.meta.env': JSON.stringify(env) },
  });
  return (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).isAllowedCompanyUser;
}
const company = await accessCheck({});
assert.equal(company({ email: 'admin@lihatech.com' }), true);
assert.equal(company({ email: ' ADMIN@LIHATECH.COM ' }), true);
assert.equal(company({ email: 'other@gmail.com' }), false);
assert.equal(company({ email: 'admin@fake-lihatech.com' }), false);
assert.equal(company({ email: null }), false);
const restricted = await accessCheck({ VITE_FIREBASE_ALLOWED_EMAILS: ' owner@lihatech.com, approved@gmail.com ' });
assert.equal(restricted({ email: 'approved@gmail.com' }), true);
assert.equal(restricted({ email: 'other@lihatech.com' }), false);
console.log('Company domain and explicit approved-email restrictions pass.');
