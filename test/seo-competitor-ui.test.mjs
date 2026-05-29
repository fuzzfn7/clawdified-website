import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../agents/seo-competitor/index.html', import.meta.url), 'utf8');

test('SEO competitor page is an anonymized sample workspace, not a fake visitor-input scanner', () => {
  assert.match(html, /SEO_COMPETITOR_SAMPLE_WORKSPACE_20260528/);
  assert.match(html, /anonymized pest-control company/i);
  assert.match(html, /built from a real SEO competitor analysis/i);
  assert.match(html, /5\s*<span class="sm">\/80<\/span>|5\s*of\s*80/i);
  assert.match(html, /robots\.txt/i);
  assert.match(html, /Pest Ops Pest Control/i);
  assert.match(html, /1,226 rows captured/i);

  assert.doesNotMatch(html, /id="scanForm"/);
  assert.doesNotMatch(html, /id="website"/);
  assert.doesNotMatch(html, /Preview SEO scan/i);
  assert.doesNotMatch(html, /Paste a website/i);
  assert.doesNotMatch(html, /function makeAnalysis/i);
  assert.doesNotMatch(html, /DEFAULT_PEST_TERMS|DEFAULT_SERVICE_TERMS/);
  assert.doesNotMatch(html, /Top competitor overlap[\s\S]{0,220}\$\{b\.comps/i);
});

test('SEO competitor page has clickable workspace sections and full Ask Agent section', () => {
  for (const tab of ['overview', 'coverage', 'competitors', 'plan', 'evidence', 'ask']) {
    assert.match(html, new RegExp(`data-tab=["']${tab}["']`), `missing clickable ${tab} section`);
    assert.match(html, new RegExp(`switchTab\\(["']${tab}["']\\)`), `missing switch handler for ${tab}`);
  }

  assert.match(html, /function renderAsk\(/);
  assert.match(html, /Ask the SEO Agent/i);
  assert.match(html, /Grounded in this analysis/i);
  assert.match(html, /Why is Pest Ops ahead of me\?/i);
  assert.doesNotMatch(html, /class="ask-fab"/);
  assert.doesNotMatch(html, /<aside class="ask-panel"/);
  assert.doesNotMatch(html, /openAsk\(\)/);
});
