import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const headerStart = html.indexOf('<header class="nav"');
const headerEnd = html.indexOf('</header>', headerStart);
const header = html.slice(headerStart, headerEnd + '</header>'.length);

test('top navigation uses one inset reference-quality shell', () => {
  assert.ok(headerStart >= 0 && headerEnd > headerStart);
  assert.match(html, /\/\* Reference-led inset hero navigation \*\//);
  assert.match(html, /\.nav\{position:fixed;z-index:100;top:14px;left:50%;right:auto;width:min\(1280px,calc\(100% - 40px\)\);height:64px;transform:translateX\(-50%\)/);
  assert.match(html, /\.nav\{[^}]*border:1px solid rgba\(38,33,28,\.1\);border-radius:18px;background:rgba\(253,250,245,\.9\);box-shadow:0 12px 38px rgba\(64,57,48,\.08\);backdrop-filter:blur\(20px\)/);
  assert.doesNotMatch(html, /\.nav\{[^}]*top:0;left:0;right:0/);
});

test('header action sits directly in the bar instead of a nested menu pill', () => {
  assert.match(html, /\.nav nav\{display:flex;align-items:center;gap:4px;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none\}/);
  assert.doesNotMatch(html, /\.nav nav\{[^}]*border:1px solid/);
  assert.doesNotMatch(html, /\.nav nav\{[^}]*background:rgba\(255,255,255/);
});

test('header removes the gray chapter links and keeps one decisive project CTA', () => {
  assert.doesNotMatch(header, />Example build<\/a>/);
  assert.doesNotMatch(header, />The agent<\/a>/);
  assert.doesNotMatch(header, />Your workflow<\/a>/);
  assert.match(header, /<a class="nav-cta" href="#start" data-direct-jump>Start a project<\/a>/);
  assert.equal((header.match(/<nav[\s\S]*?<a /g) || []).length, 1);
  assert.equal((header.match(/class="nav-cta"/g) || []).length, 1);
});

test('inset shell remains calm and usable when secondary links collapse', () => {
  assert.match(html, /@media\(max-width:1100px\)\{[\s\S]*?\.nav\{top:8px;width:calc\(100% - 16px\);height:58px;padding-inline:10px;border-radius:15px\}/);
  assert.match(html, /@media\(max-width:360px\)\{\.brand-wordmark\{display:none\}\}/);
  assert.doesNotMatch(html, /@media\(max-width:520px\)\{[\s\S]{0,120}?\.brand-wordmark\{display:none\}/);
});
