import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { onRequestGet as publicInviteRequest } from '../functions/api/client-invites/[id].js';
import {
  onRequestGet as adminInviteListRequest,
  onRequestPost as adminInviteCreateRequest,
} from '../functions/api/admin/client-invites/index.js';
import { buildAuthUrl as buildGmailAuthUrl } from '../functions/api/oauth/google/_shared.mjs';
import { buildAuthUrl as buildMetaAuthUrl } from '../functions/api/social/meta/_shared.mjs';

const baseEnv = {
  GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'google-secret',
  META_APP_ID: '979754104796418',
  META_APP_SECRET: 'meta-secret',
  CLAWDIFIED_ADMIN_EMAIL: 'wesley@clawdified.com',
  CLAWDIFIED_ADMIN_PASSWORD: 'admin-password',
  CLAWDIFIED_ADMIN_SESSION_SECRET: 'session-secret',
  SOCIAL_CONNECTOR_STATE_SECRET: 'state-secret',
  SOCIAL_CONNECTOR_ENCRYPTION_KEY: 'encryption-secret',
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

function envWithKv(seed = {}) {
  return { ...baseEnv, SOCIAL_CONNECTOR_KV: memoryKv(seed) };
}

async function jsonBody(response) {
  return response.json();
}

test('admin can create and list a client-specific connector invite with multiple required tools', async () => {
  const env = envWithKv();

  const denied = await adminInviteCreateRequest({
    request: new Request('https://clawdified.com/api/admin/client-invites', {
      method: 'POST',
      body: JSON.stringify({ client_name: 'Acme Roofing', connectors: ['gmail'] }),
    }),
    env,
  });
  assert.equal(denied.status, 401);

  const created = await adminInviteCreateRequest({
    request: new Request('https://clawdified.com/api/admin/client-invites', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer admin-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_name: 'Acme Roofing',
        workflow: 'missed-call and estimate follow-up',
        connectors: ['gmail', 'meta', 'gmail'],
      }),
    }),
    env,
  });
  const createdBody = await jsonBody(created);

  assert.equal(created.status, 201);
  assert.equal(createdBody.ok, true);
  assert.equal(createdBody.invite.client_name, 'Acme Roofing');
  assert.equal(createdBody.invite.workflow, 'missed-call and estimate follow-up');
  assert.deepEqual(createdBody.invite.connector_services, ['gmail', 'meta']);
  assert.match(createdBody.invite.invite_id, /^invite_[a-z0-9-]+$/);
  assert.equal(createdBody.invite.connect_url, `https://clawdified.com/connect/client/?invite=${createdBody.invite.invite_id}`);
  assert.equal(JSON.stringify(createdBody).includes('admin-secret'), false);

  const stored = JSON.parse(await env.SOCIAL_CONNECTOR_KV.get(`client-invite:${createdBody.invite.invite_id}`));
  assert.equal(stored.client_name, 'Acme Roofing');
  assert.deepEqual(stored.connector_services, ['gmail', 'meta']);

  const listed = await adminInviteListRequest({
    request: new Request('https://clawdified.com/api/admin/client-invites', {
      headers: { Authorization: 'Bearer admin-secret' },
    }),
    env,
  });
  const listedBody = await jsonBody(listed);
  assert.equal(listed.status, 200);
  assert.equal(listedBody.invites.length, 1);
  assert.equal(listedBody.invites[0].connect_url, createdBody.invite.connect_url);
});

test('public client invite endpoint exposes only requested connector buttons and no secrets', async () => {
  const invite = {
    ok: true,
    type: 'clawdified.client_connector_invite.v1',
    invite_id: 'invite_acme123',
    client_name: 'Acme Roofing',
    workflow: 'missed-call and estimate follow-up',
    connector_services: ['gmail', 'meta'],
    created_at: '2026-05-22T12:00:00.000Z',
    status: 'active',
  };
  const env = envWithKv({ 'client-invite:invite_acme123': invite });

  const response = await publicInviteRequest({
    request: new Request('https://clawdified.com/api/client-invites/invite_acme123'),
    env,
    params: { id: 'invite_acme123' },
  });
  const body = await jsonBody(response);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.includes_sensitive_tokens, false);
  assert.equal(body.invite.client_name, 'Acme Roofing');
  assert.deepEqual(body.invite.connector_services, ['gmail', 'meta']);
  assert.deepEqual(body.connectors.map((connector) => connector.service), ['gmail', 'meta']);
  assert.match(body.connectors[0].connect_url, /^https:\/\/clawdified\.com\/connect\/gmail\/\?/);
  assert.match(body.connectors[0].connect_url, /invite=invite_acme123/);
  assert.match(body.connectors[0].connect_url, /client=Acme\+Roofing/);
  assert.match(body.connectors[0].connect_url, /return_to=%2Fconnect%2Fclient%2F%3Finvite%3Dinvite_acme123/);
  assert.match(body.connectors[1].connect_url, /^https:\/\/clawdified\.com\/connect\/social\/\?/);
  assert.equal(JSON.stringify(body).includes('admin-secret'), false);
});

test('invite UI and OAuth starts preserve invite context back to the client connector page', () => {
  const adminDashboard = readFileSync(new URL('../admin/connections/index.html', import.meta.url), 'utf8');
  const clientConnectorPage = readFileSync(new URL('../connect/client/index.html', import.meta.url), 'utf8');
  const gmailPage = readFileSync(new URL('../connect/gmail/index.html', import.meta.url), 'utf8');
  const socialPage = readFileSync(new URL('../connect/social/index.html', import.meta.url), 'utf8');

  assert.match(adminDashboard, /ROUTE_CLIENT_INVITES\s*=\s*'\/api\/admin\/client-invites'/);
  assert.match(adminDashboard, /connectorChecklist/);
  assert.match(adminDashboard, /Create client connector page/);
  assert.match(clientConnectorPage, /\/api\/client-invites\//);
  assert.match(clientConnectorPage, /Connect required tools/);
  assert.match(clientConnectorPage, /data-client-invite-page/);
  assert.match(gmailPage, /'return_to'/);
  assert.match(gmailPage, /'invite'/);
  assert.match(socialPage, /'return_to'/);
  assert.match(socialPage, /'invite'/);

  const gmailAuth = buildGmailAuthUrl({
    request: new Request('https://clawdified.com/api/oauth/google/start'),
    env: baseEnv,
    client: 'Acme Roofing',
    workflow: 'missed-call and estimate follow-up',
    invite: 'invite_acme123',
    returnTo: '/connect/client/?invite=invite_acme123',
  });
  assert.equal(gmailAuth.statePayload.invite_id, 'invite_acme123');
  assert.equal(gmailAuth.statePayload.return_to, '/connect/client/?invite=invite_acme123');

  const metaAuth = buildMetaAuthUrl({
    request: new Request('https://clawdified.com/api/social/meta/start'),
    env: baseEnv,
    client: 'Acme Roofing',
    workflow: 'missed-call and estimate follow-up',
    invite: 'invite_acme123',
    returnTo: '/connect/client/?invite=invite_acme123',
  });
  assert.equal(metaAuth.statePayload.invite_id, 'invite_acme123');
  assert.equal(metaAuth.statePayload.return_to, '/connect/client/?invite=invite_acme123');
});
