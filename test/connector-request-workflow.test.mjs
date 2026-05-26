import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  onRequestGet as listConnectorRequests,
  onRequestPost as createConnectorRequest,
} from '../functions/api/admin/connector-requests/index.js';

const baseEnv = {
  CLAWDIFIED_ADMIN_PASSWORD: 'admin-password',
  CLAWDIFIED_ADMIN_SESSION_SECRET: 'session-secret',
  SOCIAL_CONNECTOR_ADMIN_TOKEN: 'admin-secret',
};

function memoryKv(seed = {}) {
  const records = new Map(Object.entries(seed).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
  return {
    records,
    async list({ prefix = '', limit = 100 } = {}) {
      return {
        keys: [...records.keys()]
          .filter((name) => name.startsWith(prefix))
          .slice(0, limit)
          .map((name) => ({ name, metadata: {} })),
        list_complete: true,
      };
    },
    async get(key) {
      return records.get(key) || null;
    },
    async put(key, value) {
      records.set(key, value);
    },
  };
}

function envWithKv(extra = {}) {
  return { ...baseEnv, SOCIAL_CONNECTOR_KV: memoryKv(), ...extra };
}

test('connector request endpoint is protected and stores future connector build specs safely', async () => {
  const env = envWithKv();

  const denied = await createConnectorRequest({
    request: new Request('https://clawdified.com/api/admin/connector-requests', {
      method: 'POST',
      body: JSON.stringify({ client_name: 'Acme Roofing', software_name: 'CompanyCam' }),
    }),
    env,
  });
  assert.equal(denied.status, 401);

  const created = await createConnectorRequest({
    request: new Request('https://clawdified.com/api/admin/connector-requests', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-secret', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Acme Roofing',
        workflow: 'field report automation',
        software_name: 'CompanyCam',
        auth_type: 'api_key',
        api_base_url: 'https://api.companycam.com/v2',
        needs: 'Read projects/photos, attach VINs to project evidence, create report-ready handoff package.',
        docs_url: 'https://docs.companycam.com/',
      }),
    }),
    env,
  });
  const body = await created.json();

  assert.equal(created.status, 201);
  assert.equal(body.ok, true);
  assert.match(body.request.request_id, /^connector_req_[a-z0-9-]+$/);
  assert.equal(body.request.software_name, 'CompanyCam');
  assert.equal(body.request.auth_type, 'api_key');
  assert.equal(body.request.status, 'requested');
  assert.equal(body.webhook_dispatched, false);
  assert.equal(JSON.stringify(body).includes('admin-secret'), false);

  const storedRaw = await env.SOCIAL_CONNECTOR_KV.get(`connector-request:${body.request.request_id}`);
  const stored = JSON.parse(storedRaw);
  assert.equal(stored.client_name, 'Acme Roofing');
  assert.equal(stored.software_name, 'CompanyCam');

  const listed = await listConnectorRequests({
    request: new Request('https://clawdified.com/api/admin/connector-requests', {
      headers: { Authorization: 'Bearer admin-secret' },
    }),
    env,
  });
  const listedBody = await listed.json();
  assert.equal(listed.status, 200);
  assert.equal(listedBody.requests.length, 1);
  assert.equal(listedBody.requests[0].request_id, body.request.request_id);
});

test('connector request endpoint can dispatch to an optional Hermes builder webhook without exposing the secret', async () => {
  const calls = [];
  const env = envWithKv({
    CONNECTOR_BUILDER_WEBHOOK_URL: 'https://hermes.local/webhooks/clawdified-connector-builder',
    CONNECTOR_BUILDER_WEBHOOK_TOKEN: 'webhook-secret',
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const created = await createConnectorRequest({
      request: new Request('https://clawdified.com/api/admin/connector-requests', {
        method: 'POST',
        headers: { Authorization: 'Bearer admin-secret', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: 'Acme Roofing', software_name: 'CompanyCam', auth_type: 'api_key' }),
      }),
      env,
    });
    const body = await created.json();
    assert.equal(created.status, 201);
    assert.equal(body.webhook_dispatched, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://hermes.local/webhooks/clawdified-connector-builder');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer webhook-secret');
    assert.equal(JSON.stringify(body).includes('webhook-secret'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin dashboard clearly separates unsupported connector build requests from client invites', () => {
  const dashboard = readFileSync(new URL('../admin/connections/index.html', import.meta.url), 'utf8');
  assert.match(dashboard, /Unsupported connector/);
  assert.match(dashboard, /Request a new connector build/);
  assert.match(dashboard, /does not create a client link until the connector adapter is built and deployed/);
  assert.match(dashboard, /connectorRequestBackdrop[^>]+hidden/);
  assert.match(dashboard, /Save build request/);
  assert.doesNotMatch(dashboard, /Need another app\?/);
  assert.match(dashboard, /ROUTE_CONNECTOR_REQUESTS\s*=\s*'\/api\/admin\/connector-requests'/);
  assert.match(dashboard, /connectorRequestForm/);
  assert.match(dashboard, /CompanyCam/);
});
