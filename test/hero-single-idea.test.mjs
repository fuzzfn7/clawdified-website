import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const heroStart = html.indexOf('<section class="hero"');
const heroEnd = html.indexOf('<section class="build-gateway"', heroStart);
const hero = html.slice(heroStart, heroEnd);

test('hero communicates only the approved pain-and-promise idea', () => {
  assert.ok(heroStart >= 0 && heroEnd > heroStart);
  assert.match(hero, /<h1 id="hero-title">You have work stealing hours from your week\. <span class="gradient-text">We build the agent that gives them back\.<\/span><\/h1>/);
  assert.doesNotMatch(hero, /<p|class="lede"|class="actions"|hero-orbit|See a custom build|Show us the work|Your recurring job|Your tools|Your information|Your rules|Your approval/);
});

test('hero keeps only a decorative, inaccessible visual handoff', () => {
  assert.match(hero, /<div class="mesh-stage" aria-hidden="true">/);
  assert.match(hero, /<div class="hero-copy">\s*<h1[\s\S]*?<\/h1>\s*<\/div>/);
  assert.doesNotMatch(html, /\.hero \.lede|\.hero \.actions|\.hero-orbit/);
  assert.match(html, /@media\(max-width:1100px\)\{[\s\S]*?\.hero\{min-height:100svh\}\.hero-inner\{min-height:100svh;padding:127px 0 190px\}/);
});
