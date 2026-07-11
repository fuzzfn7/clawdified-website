import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const footerStart = html.indexOf('<footer class="case-close workflow-footer"');
const footerEnd = html.indexOf('</footer>', footerStart);
const footer = html.slice(footerStart, footerEnd + '</footer>'.length);

test('Start a project bypasses the long animated scroll chapters', () => {
  assert.match(html, /<a class="nav-cta" href="#start" data-direct-jump>Start a project<\/a>/);
  assert.match(html, /projectCta\.addEventListener\('click'/);
  assert.match(html, /event\.preventDefault\(\)/);
  assert.match(html, /projectStart\.scrollIntoView\(\{block:'start',behavior:'auto'\}\)/);
  assert.match(html, /document\.startViewTransition\(jumpToProjectStart\)/);
});

test('footer keeps the brand lockup without the extra description', () => {
  assert.ok(footerStart >= 0 && footerEnd > footerStart);
  assert.doesNotMatch(footer, /Custom AI agents built around the work your business repeats\./);
  assert.doesNotMatch(footer, /<div class="footer-about">[\s\S]*?<p>/);
});

test('footer contact list omits the standalone Knoxville location', () => {
  assert.doesNotMatch(footer, /Knoxville, Tennessee/);
});
