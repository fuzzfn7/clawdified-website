import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { onRequestPost } from '../functions/api/leadgen-trial.js';

async function postLeadgenTrial(body) {
  const response = await onRequestPost({
    request: new Request('https://clawdified.com/api/leadgen-trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
  return { response, body: await response.json() };
}

test('leadgen trial infers a visitor-specific target market when ICP and geography are blank', async () => {
  const { response, body } = await postLeadgenTrial({
    website: 'https://net3it.com',
    icp: '',
    geography: '',
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.business_read.website, 'net3it.com');
  assert.equal(body.business_read.icp_source, 'inferred_from_website');
  assert.equal(body.business_read.geography_source, 'inferred_from_website');
  assert.match(body.business_read.offer, /IT|technology|managed/i);
  assert.match(body.business_read.icp, /business|company|office|organization/i);
  assert.equal(body.leads.length, 3);

  const payloadText = JSON.stringify(body);
  assert.doesNotMatch(payloadText, /Owner-led service businesses needing follow-up and review automation/i);
  assert.doesNotMatch(payloadText, /Volunteer Mechanical Services|Smoky Mountain Roof|Knoxville CleanPro/i);
  assert.doesNotMatch(payloadText, /Clawdified compatibility|Suggested AI agent/i);

  for (const lead of body.leads) {
    assert.doesNotMatch(lead.company, /Net3it Target Account/i);
    assert.doesNotMatch(lead.recommendedAgent, /AI agent|review automation agent|estimate follow-up/i);
    assert.match(lead.outreachAngle, /Net3it|IT|technology|managed|cyber|help desk|network/i);
  }
});

test('public Lead Growth UI does not silently reuse Clawdified default criteria for visitor runs', () => {
  const main = readFileSync(new URL('../agents/lead-growth/main.jsx', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../agents/lead-growth/lead-panel.jsx', import.meta.url), 'utf8');

  assert.match(main, /searchQuery:\s*""/);
  assert.match(main, /geographySegment:\s*""/);
  assert.doesNotMatch(main, /Owner-led service businesses needing follow-up and review automation/);
  assert.doesNotMatch(main, /const icp = String\(runCriteria\.icp \|\| runCriteria\.searchQuery \|\| ""\)/);
  assert.doesNotMatch(main, /const geography = String\(runCriteria\.geography \|\| runCriteria\.geographySegment \|\| ""\)/);
  assert.match(panel, /Suggested customer angle/);
  assert.doesNotMatch(panel, /<Icon name="bolt" \/>Suggested AI agent<span>/);
});
