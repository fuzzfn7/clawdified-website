import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { onRequestGet, onRequestPost } from '../functions/api/leadgen-trial.js';

async function postLeadgenTrial(body, { env = {}, headers = {} } = {}) {
  const response = await onRequestPost({
    env,
    request: new Request('https://clawdified.com/api/leadgen-trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  });
  return { response, body: await response.json() };
}

test('leadgen trial POST is retired and never returns public lead rows', async () => {
  let providerCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    providerCalled = true;
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const { response, body } = await postLeadgenTrial({
      website: 'https://net3it.com',
      icp: 'dental office',
      geography: 'Knoxville, TN',
    }, { env: { SERPER_API_KEY: 'test-key' } });

    assert.equal(response.status, 410);
    assert.equal(body.ok, false);
    assert.equal(body.status, 'retired');
    assert.equal(body.mode, 'clawdified_agent_showroom');
    assert.equal(body.marker, 'CLAWDIFIED_LEAD_AGENT_SHOWROOM_20260528');
    assert.match(body.error, /retired|showroom|private Clawdified engagement/i);
    assert.deepEqual(body.leads, []);
    assert.equal(body.external_writes_enabled, false);
    assert.equal(body.paid_reveal_enabled, false);
    assert.equal(body.auto_send_enabled, false);
    assert.equal(body.raw_provider_payloads_returned, false);
    assert.equal(providerCalled, false);

    const payloadText = JSON.stringify(body);
    assert.doesNotMatch(payloadText, /SERPER_API_KEY|Serper Places|Apollo reveal|Volunteer Mechanical Services|Smoky Mountain Roof/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('leadgen trial GET advertises retired showroom replacement', async () => {
  const response = await onRequestGet({
    request: new Request('https://clawdified.com/api/leadgen-trial'),
    env: {},
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.status, 'retired');
  assert.equal(body.method, 'POST retired');
  assert.equal(body.marker, 'CLAWDIFIED_LEAD_AGENT_SHOWROOM_20260528');
  assert.equal(body.replacement, '/agents/lead-growth/ Clawdified showroom demo');
  assert.deepEqual(body.required_fields, []);
  assert.deepEqual(body.optional_fields, []);
  assert.deepEqual(body.leads, []);
});

test('public Lead Growth UI is a Clawdified showroom, not a visitor lead-search intake', () => {
  const main = readFileSync(new URL('../agents/lead-growth/main.jsx', import.meta.url), 'utf8');
  const agentPages = readFileSync(new URL('../agents/lead-growth/agent-pages.jsx', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../agents/lead-growth/lead-panel.jsx', import.meta.url), 'utf8');
  const appShell = readFileSync(new URL('../agents/lead-growth/app-shell.jsx', import.meta.url), 'utf8');
  const insights = readFileSync(new URL('../agents/lead-growth/lead-insights.js', import.meta.url), 'utf8');
  const leadGrowthIndex = readFileSync(new URL('../agents/lead-growth/index.html', import.meta.url), 'utf8');
  const agentsIndex = readFileSync(new URL('../agents/index.html', import.meta.url), 'utf8');
  const retiredEndpoint = readFileSync(new URL('../functions/api/leadgen-trial.js', import.meta.url), 'utf8');
  const uiBundle = [main, agentPages, appShell, insights, panel, leadGrowthIndex, agentsIndex].join('\n');

  assert.match(main, /CLAWDIFIED_LEAD_AGENT_SHOWROOM_20260528/);
  assert.match(main, /Lead Growth preview/);
  assert.match(main, /CLAWDIFIED_SHOWROOM_PROVIDERS/);
  assert.match(main, /Contact enrichment/);
  assert.match(main, /buildClawdifiedShowroomLeads/);
  assert.match(agentPages, /Lead Growth preview state/);
  assert.match(agentPages, /Provider readiness/);
  assert.match(agentsIndex, /Run the preview to see fit notes, contact routes, source proof, and outreach angles land in the sheet/);
  assert.match(agentsIndex, /Built around your process/);
  assert.match(retiredEndpoint, /Retired public lead-search endpoint/);

  // The public UI should not expose the old intake/search-tool framing or private targeting/pricing recipe.
  assert.doesNotMatch(uiBundle, /Public lead search intake/i);
  assert.doesNotMatch(uiBundle, /Capped public search intake/i);
  assert.doesNotMatch(uiBundle, /Business website/);
  assert.doesNotMatch(uiBundle, /Ideal customer \/ ICP/);
  assert.doesNotMatch(uiBundle, /Search area/);
  assert.doesNotMatch(uiBundle, /Run lead search/);
  assert.doesNotMatch(uiBundle, /\/api\/leadgen-trial/);
  assert.doesNotMatch(uiBundle, /capped real public search/i);
  assert.doesNotMatch(uiBundle, /capped real runs/i);
  assert.doesNotMatch(uiBundle, /visitors do not enter/i);
  assert.doesNotMatch(uiBundle, /This space stays simple/i);
  assert.doesNotMatch(uiBundle, /section stays honest/i);
  assert.doesNotMatch(uiBundle, /fake draft flow/i);
  assert.doesNotMatch(uiBundle, /public-safe/i);
  assert.doesNotMatch(uiBundle, /private .* redacted/i);
  assert.doesNotMatch(uiBundle, /provider order/i);
  assert.doesNotMatch(uiBundle, /Fallback\/missing/i);
  assert.doesNotMatch(uiBundle, /Apollo|Serper|Browserbase/i);
  assert.doesNotMatch(uiBundle, /\$600|600\/mo|600\/month|\$1M|10M|5-100/i);
  assert.doesNotMatch(uiBundle, /Owner-led|Owner\/operators|Practice Manager|Office Manager|Operations Manager/i);
  assert.doesNotMatch(uiBundle, /pricing tiers|price logic|enrichment credits|qualified demo rows/i);
  assert.doesNotMatch(uiBundle, /ICP fit|ICP rules|Loaded ICP/i);

  assert.match(panel, /Suggested customer angle/);
  assert.doesNotMatch(panel, /<Icon name="bolt" \/>Suggested AI agent<span>/);
});
