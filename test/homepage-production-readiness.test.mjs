import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('homepage exposes one production indexing directive', () => {
  const robotTags = [...html.matchAll(/<meta name="robots" content="([^"]+)">/g)].map(match => match[1]);
  assert.deepEqual(robotTags, ['index, follow']);
  assert.doesNotMatch(html, /<meta name="robots" content="noindex">/);
});

test('homepage production identity has canonical and social image metadata', () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/clawdified\.com\/">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/clawdified\.com\/clawdified-icon-512\.png">/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/clawdified\.com\/clawdified-icon-512\.png">/);
  assert.match(html, /<link rel="manifest" href="\/site\.webmanifest">/);
});
