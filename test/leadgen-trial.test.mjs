import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { onRequestPost } from '../functions/api/leadgen-trial.js';

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

test('leadgen trial returns 503 when SERPER_API_KEY is not configured and never falls back to fake .example leads', async () => {
  const { response, body } = await postLeadgenTrial({
    website: 'https://net3it.com',
    icp: '',
    geography: '',
  }, { env: {} });

  assert.equal(response.status, 503);
  assert.equal(body.ok, false);
  assert.match(body.error, /SERPER_API_KEY|not configured/i);
  assert.equal(body.mode, 'public_capped_real_search');
  assert.equal(body.marker, 'REAL_LEADGEN_PUBLIC_SEARCH_20260526');
  assert.equal(body.paid_reveal_enabled, false);
  assert.equal(body.auto_send_enabled, false);

  const payloadText = JSON.stringify(body);
  assert.doesNotMatch(payloadText, /\.example/i);
  assert.doesNotMatch(payloadText, /Volunteer Mechanical Services|Smoky Mountain Roof|Knoxville CleanPro|Blue Ridge Dental Group/i);
});

test('leadgen trial rejects private/internal/.example hosts before calling any provider', async () => {
  for (const website of ['http://localhost', 'http://127.0.0.1', 'http://internal.lan', 'http://foo.example']) {
    const { response, body } = await postLeadgenTrial({ website }, { env: { SERPER_API_KEY: 'test-key' } });
    assert.equal(response.status, 400, `expected 400 for ${website}`);
    assert.equal(body.ok, false);
    assert.match(body.error, /public website|not supported/i);
  }
});

test('leadgen trial calls Serper Places server-side with a real-search query and shapes public-safe leads', async () => {
  const originalFetch = globalThis.fetch;
  const fetchCalls = [];
  globalThis.fetch = async (url, init = {}) => {
    fetchCalls.push({ url: String(url), init });
    if (String(url).includes('google.serper.dev/places')) {
      return new Response(JSON.stringify({
        places: [
          {
            title: 'Acme Dental Group',
            address: '123 Main St, Knoxville, TN',
            phoneNumber: '(865) 555-1010',
            website: 'https://acmedentalgroup.com',
            category: 'Dental clinic',
            rating: 4.7,
            ratingCount: 152,
          },
          {
            title: 'Smile Bright Family Dentistry',
            address: '456 Oak Ave, Knoxville, TN',
            phoneNumber: '(865) 555-2020',
            website: 'https://smilebrightfd.com',
            category: 'Dental clinic',
            rating: 4.5,
            ratingCount: 88,
          },
          {
            title: 'Riverbend Dental Studio',
            address: '789 River Rd, Knoxville, TN',
            phoneNumber: '(865) 555-3030',
            website: 'https://riverbenddentalstudio.com',
            category: 'Dental clinic',
            rating: 4.6,
            ratingCount: 60,
          },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // Homepage fetch — return minimal HTML so the visitor's domain isn't treated as the visitor host filter target
    if (String(url).startsWith('https://net3it.com')) {
      return new Response('<html><head><title>Net3IT — Managed IT</title><meta name="description" content="Managed IT and cybersecurity for SMBs."></head><body><h1>Managed IT for SMBs</h1></body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    return new Response('not found', { status: 404 });
  };

  try {
    const { response, body } = await postLeadgenTrial({
      website: 'https://net3it.com',
      icp: 'dental office',
      geography: 'Knoxville, TN',
    }, { env: { SERPER_API_KEY: 'test-key' } });

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.mode, 'public_capped_real_search');
    assert.equal(body.marker, 'REAL_LEADGEN_PUBLIC_SEARCH_20260526');
    assert.equal(body.external_writes_enabled, false);
    assert.equal(body.paid_reveal_enabled, false);
    assert.equal(body.auto_send_enabled, false);
    assert.equal(body.raw_provider_payloads_returned, false);
    assert.equal(body.business_read.website, 'net3it.com');
    assert.equal(body.business_read.icp_source, 'visitor_input');
    assert.equal(body.business_read.geography_source, 'visitor_input');
    assert.ok(body.leads.length >= 1 && body.leads.length <= 3);

    const serperCall = fetchCalls.find((c) => c.url.includes('google.serper.dev/places'));
    assert.ok(serperCall, 'expected a Serper Places call');
    assert.equal(serperCall.init.headers['X-API-KEY'], 'test-key');
    const serperBody = JSON.parse(serperCall.init.body);
    assert.match(serperBody.q, /dental/i);
    assert.match(serperBody.q, /Knoxville/i);

    for (const lead of body.leads) {
      assert.ok(lead.company);
      assert.ok(lead.domain && !lead.domain.endsWith('.example'));
      assert.equal(lead.email, 'gated until private run');
      assert.ok(!('rawProvider' in lead));
    }

    const payloadText = JSON.stringify(body);
    assert.doesNotMatch(payloadText, /\.example\b/);
    assert.doesNotMatch(payloadText, /Blue Ridge Dental Group|Smoky Mountain Logistics|Cedar Ridge Property Management/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('leadgen trial reports shortfall (not fake rows) when the provider returns no usable results', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('google.serper.dev/places')) {
      return new Response(JSON.stringify({ places: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (String(url).includes('google.serper.dev/search')) {
      return new Response(JSON.stringify({ organic: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('<html><head><title>Site</title></head><body></body></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
  };

  try {
    const { response, body } = await postLeadgenTrial({
      website: 'https://net3it.com',
      icp: 'rare-niche-buyer-xyz-zzz',
      geography: 'Nowhere',
    }, { env: { SERPER_API_KEY: 'test-key' } });

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.status, 'shortfall');
    assert.ok(body.shortfall_reason);
    assert.equal(body.leads.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('leadgen trial enforces hashed per-IP/global daily caps when KV is bound', async () => {
  const originalFetch = globalThis.fetch;
  const store = new Map();
  const kv = {
    async get(key) { return store.get(key) || null; },
    async put(key, value) { store.set(key, value); },
  };
  globalThis.fetch = async (url) => {
    if (String(url).includes('google.serper.dev/places')) {
      return new Response(JSON.stringify({
        places: [{
          title: 'Acme Dental Group',
          address: '123 Main St, Knoxville, TN',
          phoneNumber: '(865) 555-1010',
          website: 'https://acmedentalgroup.com',
          category: 'Dental clinic',
          rating: 4.7,
          ratingCount: 152,
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('<html><head><title>Net3IT</title></head><body></body></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
  };

  try {
    for (let i = 0; i < 3; i += 1) {
      const { response, body } = await postLeadgenTrial({
        website: 'https://net3it.com',
        icp: 'dental office',
        geography: 'Knoxville, TN',
      }, {
        env: { SERPER_API_KEY: 'test-key', SOCIAL_CONNECTOR_KV: kv },
        headers: { 'CF-Connecting-IP': '203.0.113.44' },
      });
      assert.equal(response.status, 200);
      assert.equal(body.limits.rate_limit_enforced, true);
    }

    const { response, body } = await postLeadgenTrial({
      website: 'https://net3it.com',
      icp: 'dental office',
      geography: 'Knoxville, TN',
    }, {
      env: { SERPER_API_KEY: 'test-key', SOCIAL_CONNECTOR_KV: kv },
      headers: { 'CF-Connecting-IP': '203.0.113.44' },
    });

    assert.equal(response.status, 429);
    assert.equal(body.ok, false);
    assert.equal(body.limits.rate_limit_enforced, true);
    assert.equal(body.limits.per_ip_remaining, 0);
    assert.ok([...store.keys()].some((key) => key.startsWith('leadgen_trial_rate:')));
    assert.ok([...store.keys()].some((key) => key.startsWith('leadgen_trial_global:')));
    assert.ok([...store.keys()].every((key) => !key.includes('203.0.113.44')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('public Lead Growth UI surface tells the truth: capped real public search, source marker, no static sample copy', () => {
  const main = readFileSync(new URL('../agents/lead-growth/main.jsx', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../agents/lead-growth/lead-panel.jsx', import.meta.url), 'utf8');

  assert.match(main, /REAL_LEADGEN_PUBLIC_SEARCH_20260526/);
  assert.match(main, /capped real public search/i);
  assert.match(main, /Run lead search/);
  assert.match(main, /searchQuery:\s*""/);
  assert.match(main, /geographySegment:\s*""/);

  // Old static-sample/demo framing must not creep back in
  assert.doesNotMatch(main, /capped sample rows/i);
  assert.doesNotMatch(main, /Public-safe sample/i);
  assert.doesNotMatch(main, /PUBLIC_DEMO_PREVIEW/);
  assert.doesNotMatch(main, /Public demo wrapper/);
  assert.doesNotMatch(main, /Owner-led service businesses needing follow-up and review automation/);

  assert.match(panel, /Suggested customer angle/);
  assert.doesNotMatch(panel, /<Icon name="bolt" \/>Suggested AI agent<span>/);
});
