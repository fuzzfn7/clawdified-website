import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildAuthUrl as buildSlackAuthUrl,
  buildAgentHandoff as buildSlackAgentHandoff,
  encryptJson as encryptSlackJson,
  listConnections as listSlackConnections,
  readiness as slackReadiness,
  redactTokens as redactSlackTokens,
  summarizeAgentPackage as summarizeSlackPackage,
} from '../functions/api/slack/_shared.mjs';
import {
  buildAuthUrl as buildHubSpotAuthUrl,
  buildAgentHandoff as buildHubSpotAgentHandoff,
  encryptJson as encryptHubSpotJson,
  listConnections as listHubSpotConnections,
  readiness as hubSpotReadiness,
  redactTokens as redactHubSpotTokens,
  summarizeAgentPackage as summarizeHubSpotPackage,
} from '../functions/api/hubspot/_shared.mjs';
import { onRequestGet as unifiedListRequest } from '../functions/api/admin/connections/index.js';
import { onRequestPost as adminInviteCreateRequest } from '../functions/api/admin/client-invites/index.js';
import { onRequestGet as publicInviteRequest } from '../functions/api/client-invites/[id].js';

const baseEnv = {
  SLACK_CLIENT_ID: '123.456',
  SLACK_CLIENT_SECRET: 'slack-secret',
  HUBSPOT_CLIENT_ID: 'hubspot-client-id',
  HUBSPOT_CLIENT_SECRET: 'hubspot-secret',
  CLAWDIFIED_ADMIN_PASSWORD: 'admin-password',
  CLAWDIFIED_ADMIN_SESSION_SECRET: 'session-secret',
  SOCIAL_CONNECTOR_STATE_SECRET: 'state-secret',
  SOCIAL_CONNECTOR_ENCRYPTION_KEY: 'encryption-secret',
  SOCIAL_CONNECTOR_ADMIN_TOKEN: 'admin-secret',
};

function memoryKv(seed = {}) {
  const records = new Map(Object.entries(seed).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
  return {
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

function sampleSlackPackage() {
  return {
    connection_id: 'slack_conn_123',
    created_at: '2026-05-22T12:00:00.000Z',
    client: { name: 'Acme Roofing', workflow: 'approval alerts', invite_id: 'invite_acme' },
    slack_app: { client_id: '123.456', redirect_uri: 'https://clawdified.com/api/slack/callback' },
    oauth: {
      access_token: 'xoxb-secret-token',
      token_type: 'bot',
      scope: 'chat:write,channels:read,users:read',
      bot_user_id: 'U_BOT',
    },
    team: { id: 'T123', name: 'Acme Roofing Workspace' },
    authed_user: { id: 'U123' },
    endpoints: { post_message: 'https://slack.com/api/chat.postMessage' },
    required_for_agent: { team_present: true, access_token_present: true, chat_write_scope_present: true },
  };
}

function sampleHubSpotPackage() {
  return {
    connection_id: 'hubspot_conn_123',
    created_at: '2026-05-22T12:05:00.000Z',
    client: { name: 'Acme Roofing', workflow: 'lead CRM sync', invite_id: 'invite_acme' },
    hubspot_app: { client_id: 'hubspot-client-id', redirect_uri: 'https://clawdified.com/api/hubspot/callback' },
    oauth: {
      access_token: 'pat-secret-token',
      refresh_token: 'hub-refresh-token',
      token_type: 'bearer',
      expires_at: '2026-05-22T13:05:00.000Z',
      scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.companies.read'],
    },
    account: { hub_id: 123456, hub_domain: 'acme.example.com', user: 'owner@acme.example.com' },
    endpoints: { contacts: 'https://api.hubapi.com/crm/v3/objects/contacts' },
    required_for_agent: { portal_present: true, refresh_token_present: true, contacts_read_scope_present: true },
  };
}

test('Slack and HubSpot readiness reports missing config safely', () => {
  assert.equal(slackReadiness({}).ok, false);
  assert.equal(hubSpotReadiness({}).ok, false);
  assert.deepEqual(slackReadiness({}).missing.includes('SLACK_CLIENT_ID'), true);
  assert.deepEqual(hubSpotReadiness({}).missing.includes('HUBSPOT_CLIENT_ID'), true);
  assert.equal(JSON.stringify(slackReadiness({})).includes('slack-secret'), false);
  assert.equal(JSON.stringify(hubSpotReadiness({})).includes('hubspot-secret'), false);
});

test('Slack and HubSpot OAuth URLs preserve client invite context', () => {
  const slack = buildSlackAuthUrl({
    request: new Request('https://clawdified.com/api/slack/start'),
    env: baseEnv,
    client: 'Acme Roofing',
    workflow: 'approval alerts',
    invite: 'invite_acme',
    returnTo: '/connect/client/?invite=invite_acme',
  });
  assert.equal(slack.url.hostname, 'slack.com');
  assert.equal(slack.url.searchParams.get('client_id'), '123.456');
  assert.equal(slack.statePayload.invite_id, 'invite_acme');
  assert.equal(slack.statePayload.return_to, '/connect/client/?invite=invite_acme');

  const hubspot = buildHubSpotAuthUrl({
    request: new Request('https://clawdified.com/api/hubspot/start'),
    env: baseEnv,
    client: 'Acme Roofing',
    workflow: 'lead CRM sync',
    invite: 'invite_acme',
    returnTo: '/connect/client/?invite=invite_acme',
  });
  assert.equal(hubspot.url.hostname, 'app.hubspot.com');
  assert.equal(hubspot.url.searchParams.get('client_id'), 'hubspot-client-id');
  assert.equal(hubspot.statePayload.invite_id, 'invite_acme');
  assert.equal(hubspot.statePayload.return_to, '/connect/client/?invite=invite_acme');
});

test('Slack and HubSpot summaries/handoffs are safe and self-describing', () => {
  const slackPackage = sampleSlackPackage();
  const slackSummary = summarizeSlackPackage(redactSlackTokens(slackPackage), { origin: 'https://clawdified.com' });
  assert.equal(slackSummary.service, 'slack');
  assert.equal(slackSummary.invite_id, 'invite_acme');
  assert.equal(slackSummary.connected_account, 'Acme Roofing Workspace');
  assert.equal(slackSummary.ready_for_agent, true);
  assert.equal(JSON.stringify(slackSummary).includes('xoxb-secret-token'), false);
  const slackHandoff = buildSlackAgentHandoff(slackPackage, { origin: 'https://clawdified.com' });
  assert.equal(slackHandoff.handoff_type, 'clawdified.slack_agent_connection.v1');
  assert.equal(slackHandoff.oauth.access_token, 'xoxb-secret-token');

  const hubSpotPackage = sampleHubSpotPackage();
  const hubSpotSummary = summarizeHubSpotPackage(redactHubSpotTokens(hubSpotPackage), { origin: 'https://clawdified.com' });
  assert.equal(hubSpotSummary.service, 'hubspot');
  assert.equal(hubSpotSummary.invite_id, 'invite_acme');
  assert.equal(hubSpotSummary.connected_account, 'acme.example.com');
  assert.equal(hubSpotSummary.ready_for_agent, true);
  assert.equal(JSON.stringify(hubSpotSummary).includes('hub-refresh-token'), false);
  const hubSpotHandoff = buildHubSpotAgentHandoff(hubSpotPackage, { origin: 'https://clawdified.com' });
  assert.equal(hubSpotHandoff.handoff_type, 'clawdified.hubspot_agent_connection.v1');
  assert.equal(hubSpotHandoff.oauth.refresh_token, 'hub-refresh-token');
});

test('Slack and HubSpot list connections from KV without exposing raw tokens', async () => {
  const slackPackage = sampleSlackPackage();
  const hubSpotPackage = sampleHubSpotPackage();
  const env = {
    ...baseEnv,
    SOCIAL_CONNECTOR_KV: memoryKv({
      'slack-connection:slack_conn_123': {
        ok: true,
        connection_id: 'slack_conn_123',
        created_at: slackPackage.created_at,
        public_agent_package: redactSlackTokens(slackPackage),
        encrypted_agent_package: await encryptSlackJson(slackPackage, 'encryption-secret'),
      },
      'hubspot-connection:hubspot_conn_123': {
        ok: true,
        connection_id: 'hubspot_conn_123',
        created_at: hubSpotPackage.created_at,
        public_agent_package: redactHubSpotTokens(hubSpotPackage),
        encrypted_agent_package: await encryptHubSpotJson(hubSpotPackage, 'encryption-secret'),
      },
    }),
  };

  const slackRows = await listSlackConnections({ env, origin: 'https://clawdified.com' });
  const hubSpotRows = await listHubSpotConnections({ env, origin: 'https://clawdified.com' });
  assert.equal(slackRows.connections.length, 1);
  assert.equal(hubSpotRows.connections.length, 1);
  assert.equal(JSON.stringify(slackRows).includes('xoxb-secret-token'), false);
  assert.equal(JSON.stringify(hubSpotRows).includes('hub-refresh-token'), false);
});

test('Slack and HubSpot are registered connector services and can appear on client invites', async () => {
  const env = { ...baseEnv, SOCIAL_CONNECTOR_KV: memoryKv() };
  const allowed = await unifiedListRequest({
    request: new Request('https://clawdified.com/api/admin/connections', {
      headers: { Authorization: 'Bearer admin-secret' },
    }),
    env,
  });
  const body = await allowed.json();
  assert.deepEqual(body.connectors.map((connector) => connector.service), ['gmail', 'meta', 'slack', 'hubspot']);

  const created = await adminInviteCreateRequest({
    request: new Request('https://clawdified.com/api/admin/client-invites', {
      method: 'POST',
      headers: { Authorization: 'Bearer admin-secret', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Acme Roofing', workflow: 'lead ops', connectors: ['slack', 'hubspot'] }),
    }),
    env,
  });
  const inviteBody = await created.json();
  assert.equal(created.status, 201);
  assert.deepEqual(inviteBody.invite.connector_services, ['slack', 'hubspot']);

  const publicInvite = await publicInviteRequest({
    request: new Request(`https://clawdified.com/api/client-invites/${inviteBody.invite.invite_id}`),
    env,
    params: { id: inviteBody.invite.invite_id },
  });
  const publicBody = await publicInvite.json();
  assert.deepEqual(publicBody.connectors.map((connector) => connector.service), ['slack', 'hubspot']);
  assert.match(publicBody.connectors[0].connect_url, /\/connect\/slack\//);
  assert.match(publicBody.connectors[1].connect_url, /\/connect\/hubspot\//);
});

test('admin dashboard exposes Slack and HubSpot without raw token labels', () => {
  const dashboard = readFileSync(new URL('../admin/connections/index.html', import.meta.url), 'utf8');
  assert.match(dashboard, /Slack/);
  assert.match(dashboard, /HubSpot/);
  assert.equal(dashboard.includes('xoxb-'), false);
  assert.equal(dashboard.includes('refresh_token'), false);
});
