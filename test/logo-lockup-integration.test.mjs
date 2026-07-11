import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const assetUrl = new URL('../assets/clawdified-claw-transparent.png', import.meta.url);
const assetPath = fileURLToPath(assetUrl);
const wordmarkUrl = new URL('../assets/clawdified-wordmark-industrial-notch.svg', import.meta.url);
const wordmarkPath = fileURLToPath(wordmarkUrl);

test('navigation and footer use a dedicated transparent claw while favicon keeps the tile', () => {
  assert.ok(existsSync(assetPath), 'transparent claw asset should exist');
  assert.equal((html.match(/src="\/assets\/clawdified-claw-transparent\.png"/g) || []).length, 2);
  assert.match(html, /class="brand"[^>]*aria-label="Clawdified home"[^>]*>[\s\S]*?<img class="brand-mark" src="\/assets\/clawdified-claw-transparent\.png" alt="">/);
  assert.match(html, /class="footer-brand"[^>]*aria-label="Clawdified home"[^>]*>[\s\S]*?<img class="brand-mark" src="\/assets\/clawdified-claw-transparent\.png" alt="">/);
  assert.match(html, /rel="icon"[^>]*href="\/assets\/clawdified-favicon-heritage-20260711\.png"/);
});

test('transparent claw asset is a square RGBA PNG', () => {
  assert.ok(existsSync(assetPath), 'transparent claw asset should exist');
  const png = readFileSync(assetPath);
  assert.deepEqual([...png.subarray(1, 4)], [80, 78, 71]);
  assert.equal(png.readUInt32BE(16), 256);
  assert.equal(png.readUInt32BE(20), 256);
  assert.equal(png[25], 6, 'PNG color type should be RGBA');
});

test('brand lockup is transparent by default and reveals its tile only on interaction', () => {
  assert.match(html, /\/\* Integrated transparent brand lockup \*\//);
  assert.match(html, /\.brand-mark\{width:26px;height:26px;border-radius:8px;object-fit:contain;background:transparent;box-shadow:none/);
  assert.match(html, /\.brand:hover \.brand-mark,\.brand:focus-visible \.brand-mark,\.footer-brand:hover \.brand-mark,\.footer-brand:focus-visible \.brand-mark\{background:#181713/);
  assert.match(html, /\.brand:hover,\.brand:focus-visible,\.footer-brand:hover,\.footer-brand:focus-visible\{background:rgba\(198,137,87,\.08\)\}/);
  assert.doesNotMatch(html, /\.brand img,\.footer-brand img\{/);
  assert.doesNotMatch(html, /\.footer-brand img\{/);
});

test('header and footer use the final Industrial Notch vector wordmark', () => {
  assert.ok(existsSync(wordmarkPath), 'Industrial Notch SVG should exist');
  assert.equal((html.match(/src="\/assets\/clawdified-wordmark-industrial-notch\.svg"/g) || []).length, 2);
  assert.match(html, /\.brand-wordmark\{display:block;width:auto;height:16px;object-fit:contain\}/);
  assert.match(html, /class="brand-wordmark" src="\/assets\/clawdified-wordmark-industrial-notch\.svg" alt="">/);
  assert.doesNotMatch(html, /@font-face\{font-family:"Clawdified Wordmark"/);
  assert.doesNotMatch(html, /<span>Clawdified<\/span>/);
});

test('Industrial Notch is an outlined vector asset with no runtime font dependency', () => {
  assert.ok(existsSync(wordmarkPath), 'Industrial Notch SVG should exist');
  const svg = readFileSync(wordmarkPath, 'utf8');
  assert.match(svg, /^<svg[^>]+viewBox="0 0 [\d.]+ 22"/);
  assert.match(svg, /<mask\b/);
  assert.match(svg, /<path\b/);
  assert.doesNotMatch(svg, /<text\b|font-family|@font-face/i);
});
