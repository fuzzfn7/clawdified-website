import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { PUBLIC_DIRECTORIES } from '../scripts/build-pages-release.mjs';

const supportUrl = new URL('../support/index.html', import.meta.url);
const supportCSSUrl = new URL('../assets/app-support.css', import.meta.url);

const readIfPresent = (url) => existsSync(url) ? readFileSync(url, 'utf8') : '';

test('App Store support route is a curated public runtime directory', () => {
  assert.equal(PUBLIC_DIRECTORIES.includes('support'), true);
  assert.equal(existsSync(supportUrl), true, '/support/ must exist');
  assert.equal(existsSync(supportCSSUrl), true, 'support page must use a maintained Clawdified stylesheet');
});

test('support page is truthful, branded, and safe for app users', () => {
  const html = readIfPresent(supportUrl);
  assert.match(html, /<title>Clawdified App Support \| Clawdified<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/clawdified\.com\/support\/">/);
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.match(html, /clawdified-claw-transparent\.png/);
  assert.match(html, /clawdified-wordmark-nav-119x16\.png/);
  assert.match(html, /theo@clawdified\.com/);
  assert.match(html, /Do not send passwords, verification codes, API keys, or payment information\./);
  assert.match(html, /href="\/privacy"/);
  assert.match(html, /href="\/data-deletion"/);
  assert.match(html, /Work Order number/);
  assert.doesNotMatch(html, /24\/7|guaranteed|instant response|live ServiceBridge writeback/i);
});
