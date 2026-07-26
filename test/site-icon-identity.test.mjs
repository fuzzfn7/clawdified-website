import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PUBLIC_FILES } from '../scripts/build-pages-release.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = relativePath => readFileSync(path.join(root, relativePath));
const readText = relativePath => read(relativePath).toString('utf8');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

const faviconPath = '/assets/clawdified-favicon-heritage-20260711.png';
const appleTouchPath = '/clawdified-social-profile-apple-touch-icon.png';
const manifestHref = '/site.webmanifest?v=clawdified-social-profile-final';

function pngIdentity(relativePath, width, height) {
  const bytes = read(relativePath);
  assert.deepEqual([...bytes.subarray(1, 4)], [80, 78, 71], `${relativePath} should be PNG`);
  assert.equal(bytes.readUInt32BE(16), width, `${relativePath} width`);
  assert.equal(bytes.readUInt32BE(20), height, `${relativePath} height`);
  assert.equal(bytes[25], 2, `${relativePath} should be opaque RGB, not alpha`);
  return bytes;
}

test('site icon master is the approved creamy social-profile export', () => {
  const relativePath = 'assets/clawdified-social-profile-final.png';
  assert.equal(existsSync(path.join(root, relativePath)), true);
  const bytes = pngIdentity(relativePath, 1024, 1024);
  assert.equal(sha256(bytes), 'c0893e3b81034759466cabc5553ebc7f688480d3ab9294ba35c918a50a448b4a');
});

test('iOS, Android, Samsung, social, and app fallback files keep the approved creamy identity', () => {
  const apple180 = pngIdentity('clawdified-social-profile-apple-touch-icon.png', 180, 180);
  const icon192 = pngIdentity('clawdified-social-profile-icon-192.png', 192, 192);
  const icon512 = pngIdentity('clawdified-social-profile-icon-512.png', 512, 512);

  for (const legacy of ['apple-touch-icon.png', 'clawdified-apple-touch-icon.png']) {
    assert.deepEqual(read(legacy), apple180, `${legacy} should match the approved iOS icon`);
  }
  for (const legacy of ['icon-512.png', 'clawdified-icon-512.png']) {
    assert.deepEqual(read(legacy), icon512, `${legacy} should match the approved 512px icon`);
  }

  assert.ok(icon192.length > 0);
});

test('browser favicon family uses the original black tile independently of app icons', () => {
  const favicon64 = read('assets/clawdified-favicon-heritage-20260711.png');
  assert.deepEqual([...favicon64.subarray(1, 4)], [80, 78, 71]);
  assert.equal(favicon64.readUInt32BE(16), 64);
  assert.equal(favicon64.readUInt32BE(20), 64);
  assert.equal(favicon64[25], 6, 'rounded black tile should preserve transparency');
  assert.equal(sha256(favicon64), 'fa7900ee5c6b1ca2290ff4eb1f14c04b70bd6228d49d85658fa89ab01c06922f');

  const icon48 = pngIdentity('favicon-48.png', 48, 48);
  assert.equal(sha256(icon48), '66946ac4b0cabede66ae89ef8c45350c3be42264d16e29d08a473b66b12d91ff');
  assert.deepEqual(read('clawdified-icon-48.png'), icon48);

  const icon192 = pngIdentity('favicon-192.png', 192, 192);
  assert.equal(sha256(icon192), '761bb601f1b4028c3fea1074cbedb9c0363530ac93f3372eb2572b53bfcdaca1');
  assert.deepEqual(read('favicon.png'), icon192);
  assert.deepEqual(read('clawdified-icon-192.png'), icon192);

  const ico = read('favicon.ico');
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0]);
  assert.ok(ico.readUInt16LE(4) >= 4, 'ICO should contain multiple browser sizes');
  assert.equal(sha256(ico), 'c7c869192b4eea4aaf864c77aef479af0969ab3f4efbd49af7338320e22d1e14');
  assert.deepEqual(read('clawdified-icon.ico'), ico);

  for (const retired of [
    'assets/clawdified-social-profile-favicon-64.png',
    'clawdified-social-profile-icon-48.png',
    'clawdified-social-profile-icon.ico',
  ]) {
    assert.equal(existsSync(path.join(root, retired)), false, `${retired} should not remain as a white browser icon`);
  }
});

test('public pages use the black browser favicon while homepage install metadata stays creamy', () => {
  const documents = [
    'index.html',
    '404.html',
    'agent-training/index.html',
    'company-brain/index.html',
    'agents/index.html',
    'functions/_middleware.js',
  ];
  for (const relativePath of documents) {
    const source = readText(relativePath);
    assert.match(source, new RegExp(`href="${faviconPath.replaceAll('/', '\\/')}"`), relativePath);
    assert.doesNotMatch(source, /clawdified-social-profile-favicon-64\.png|clawdified-social-profile-icon\.ico/, relativePath);
  }

  const homepage = readText('index.html');
  assert.match(homepage, /<link rel="icon" href="\/favicon\.ico" sizes="any">/);
  assert.match(homepage, new RegExp(`<link rel="apple-touch-icon" sizes="180x180" href="${appleTouchPath.replaceAll('/', '\\/')}">`));
  assert.ok(homepage.includes(`<link rel="manifest" href="${manifestHref}">`));
});

test('web app manifest installs the creamy icon as both regular and maskable artwork', () => {
  const manifest = JSON.parse(readText('site.webmanifest'));
  assert.equal(manifest.background_color, '#fffdf9');
  assert.equal(manifest.theme_color, '#c77d43');
  assert.deepEqual(manifest.icons, [
    {
      src: '/clawdified-social-profile-icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable',
    },
    {
      src: '/clawdified-social-profile-icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ]);
});

test('curated Pages release and immutable headers include every new root icon', () => {
  const rootAssets = [
    'clawdified-social-profile-apple-touch-icon.png',
    'clawdified-social-profile-icon-192.png',
    'clawdified-social-profile-icon-512.png',
  ];
  for (const asset of rootAssets) {
    assert.equal(PUBLIC_FILES.includes(asset), true, `${asset} should ship in the curated release`);
  }

  const headers = readText('_headers');
  for (const pathname of [faviconPath, appleTouchPath, ...rootAssets.map(asset => `/${asset}`)]) {
    assert.match(headers, new RegExp(`${pathname.replaceAll('/', '\\/')}[\\s\\S]*?Cache-Control: public, max-age=31536000, immutable`), pathname);
  }
});
