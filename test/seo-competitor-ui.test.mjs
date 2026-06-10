import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../agents/seo-competitor/index.html', import.meta.url), 'utf8');
const showroomHtml = readFileSync(new URL('../agents/index.html', import.meta.url), 'utf8');

test('SEO competitor page is an anonymized sample workspace, not a fake visitor-input scanner', () => {
  assert.match(html, /SEO_COMPETITOR_SAMPLE_WORKSPACE_20260528/);
  assert.match(html, /anonymized pest-control company/i);
  assert.match(html, /built from a real SEO competitor analysis/i);
  assert.match(html, /5\s*<span class="sm">\s*of 80<\/span>|5\s*of\s*80 Google search checks/i);
  assert.match(html, /80 Google searches|80 Google search checks|80 ranking checks/i);
  for (const forbiddenCellPhrase of [
    /80 cells/i,
    /80-cell/i,
    /target cells/i,
    /Cells absent/i,
    /visibility cells/i,
    /search cells/i,
    /All cells/i,
    /Cells visible/i,
  ]) {
    assert.doesNotMatch(html, forbiddenCellPhrase);
  }
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

test('agents showroom describes SEO as a finished action workspace, not a website paste flow', () => {
  assert.match(showroomHtml, /Review an SEO action workspace/i);
  assert.match(showroomHtml, /See competitors, coverage gaps, recommended fixes, evidence, and the Ask Agent panel/i);
  assert.match(showroomHtml, /SEO & Competitor Intelligence preview/i);
  assert.match(showroomHtml, /Review a finished workspace with coverage gaps, competitors, fixes, evidence, and Ask Agent/i);
  assert.match(showroomHtml, /Open full screen/i);

  assert.doesNotMatch(showroomHtml, /Paste a website inside the workspace below/i);
  assert.doesNotMatch(showroomHtml, /Add a website\. The scan fills/i);
  assert.doesNotMatch(showroomHtml, /Preview SEO scan/i);
  assert.doesNotMatch(showroomHtml, /What website should the SEO agent analyze\?/i);
  assert.doesNotMatch(showroomHtml, /The preview summarizes what it sees/i);
  assert.doesNotMatch(showroomHtml, /preloaded, anonymized analysis workspace/i);
  assert.doesNotMatch(showroomHtml, /not a blank website scanner/i);
});
