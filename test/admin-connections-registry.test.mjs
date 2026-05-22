import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  encryptJson as encryptGmailJson,
  redactTokens as redactGmailTokens,
  scopesFromEnv as gmailScopesFromEnv,
} from '../functions/api/oauth/google/_shared.mjs';
import {
  encryptJson as encryptMetaJson,
  redactTokens as redactMetaTokens,
} from '../functions/api/social/meta/_shared.mjs';
import { onRequestGet as unifiedListRequest } from '../functions/api/admin/connections/index.js';
import { onRequestGet as unifiedDetailRequest } from '../functions/api/admin/connections/[service]/[id].js';

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

function sampleGmailPackage() {
  return {
    connection_id: 'gmail_conn_123',
    created_at: '2026-05-21T20:00:00.000Z',
    client: { name: 'Heller Hats', workflow: 'cold outbound' },
    google_oauth: {
      client_id: 'google-client-id.apps.googleusercontent.com',
      redirect_uri: 'https://clawdified.com/api/oauth/google/callback',
      requested_scopes: gmailScopesFromEnv(baseEnv),
    },
    google_account: { sub: 'google-user-1', email: 'owner@example.com', name: 'Client Owner' },
    gmail_profile: { emailAddress: 'owner@example.com', messagesTotal: 10, threadsTotal: 3 },
    oauth: {
      access_token: 'ya29-access-token',
      refresh_token: 'refresh-token',
      token_type: 'Bearer',
      expires_at: '2026-05-21T21:00:00.000Z',
      granted_scopes: gmailScopesFromEnv(baseEnv),
    },
    endpoints: { send: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send' },
    required_for_outreach_agent: {
      client_id_present: true,
      email_present: true,
      access_token_present: true,
      refresh_token_present: true,
      send_scope_requested: true,
      modify_scope_requested: true,
      granted_scopes: gmailScopesFromEnv(baseEnv),
    },
  };
}

function sampleMetaPackage() {
  return {
    connection_id: 'meta_conn_123',
    created_at: '2026-05-21T22:00:00.000Z',
    client: { name: 'Heller Hats', workflow: 'social inbox + posting' },
    meta_app: {
      app_id: '979754104796418',
      graph_version: 'v23.0',
      redirect_uri: 'https://clawdified.com/api/social/meta/callback',
    },
    oauth: {
      user_access_token: 'EAAB-user-token',
      token_type: 'bearer',
      expires_at: '2030-03-17T17:46:40.000Z',
      granted_scopes: ['public_profile', 'pages_show_list', 'instagram_basic'],
    },
    facebook_user: { id: 'user_1', name: 'Client Owner' },
    businesses: [{ id: 'biz_1', name: 'Client Business', verification_status: 'verified' }],
    pages: [{
      facebook_page_id: 'page_1',
      facebook_page_name: 'Client Page',
      facebook_page_username: 'clientpage',
      category: 'Brand',
      tasks: ['MESSAGING'],
      page_access_token: 'EAAB-page-token',
      instagram_business_account_id: 'ig_1',
      instagram_username: 'clientig',
      endpoints: {
        page: 'https://graph.facebook.com/v23.0/page_1',
        page_messages: 'https://graph.facebook.com/v23.0/page_1/messages',
        instagram_messages: 'https://graph.facebook.com/v23.0/ig_1/messages',
      },
    }],
    required_for_outreach_agent: {
      app_id: '979754104796418',
      graph_version: 'v23.0',
      user_token_present: true,
      page_tokens_present: true,
      page_ids_present: true,
      instagram_ids_present: true,
      granted_scopes: ['public_profile', 'pages_show_list', 'instagram_basic'],
    },
  };
}

async function envWithConnections() {
  const gmailPackage = sampleGmailPackage();
  const metaPackage = sampleMetaPackage();
  const records = {
    'gmail-google-connection:gmail_conn_123': {
      ok: true,
      connection_id: 'gmail_conn_123',
      created_at: gmailPackage.created_at,
      public_agent_package: redactGmailTokens(gmailPackage),
      encrypted_agent_package: await encryptGmailJson(gmailPackage, 'encryption-secret'),
    },
    'social-meta-connection:meta_conn_123': {
      ok: true,
      connection_id: 'meta_conn_123',
      created_at: metaPackage.created_at,
      public_agent_package: redactMetaTokens(metaPackage),
      encrypted_agent_package: await encryptMetaJson(metaPackage, 'encryption-secret'),
    },
  };

  return {
    ...baseEnv,
    SOCIAL_CONNECTOR_KV: {
      async list({ prefix }) {
        return {
          keys: Object.keys(records)
            .filter((name) => name.startsWith(prefix))
            .map((name) => ({ name, metadata: { created_at: records[name].created_at } })),
          list_complete: true,
        };
      },
      async get(key) {
        return records[key] ? JSON.stringify(records[key]) : null;
      },
      async put() {},
    },
  };
}

test('unified admin connections endpoint is protected and aggregates all connector rows safely', async () => {
  const env = await envWithConnections();

  const denied = await unifiedListRequest({
    request: new Request('https://clawdified.com/api/admin/connections'),
    env,
  });
  assert.equal(denied.status, 401);

  const allowed = await unifiedListRequest({
    request: new Request('https://clawdified.com/api/admin/connections', {
      headers: { Authorization: 'Bearer admin-secret' },
    }),
    env,
  });
  const body = await allowed.json();

  assert.equal(allowed.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.registry_version, 1);
  assert.equal(body.includes_sensitive_tokens, false);
  assert.deepEqual(body.connectors.map((connector) => connector.service), ['gmail', 'meta', 'slack', 'hubspot']);
  assert.equal(body.connectors.find((connector) => connector.service === 'slack').connector_path, '/connect/slack/');
  assert.equal(body.connectors.find((connector) => connector.service === 'hubspot').connector_path, '/connect/hubspot/');
  assert.equal(body.connectors[0].detail_path_template, '/api/admin/connections/gmail/{connection_id}?include=agent_package');
  assert.equal(body.connections.length, 2);
  assert.equal(body.connections[0].service, 'meta');
  assert.equal(body.connections[0].detail_url, 'https://clawdified.com/api/admin/connections/meta/meta_conn_123?include=agent_package');
  assert.equal(body.connections[0].legacy_detail_url, 'https://clawdified.com/api/social/meta/connections/meta_conn_123?include=agent_package');
  assert.equal(body.connections[0].primary_account, 'Client Page');
  assert.equal(body.connections[1].service, 'gmail');
  assert.equal(body.connections[1].primary_account, 'owner@example.com');
  assert.equal(body.connections[1].credential_status, 'Credential stored');
  assert.equal(JSON.stringify(body).includes('refresh-token'), false);
  assert.equal(JSON.stringify(body).includes('ya29-access-token'), false);
  assert.equal(JSON.stringify(body).includes('EAAB-'), false);
});

test('unified admin detail endpoint returns service-specific agent handoff packages intentionally', async () => {
  const env = await envWithConnections();

  const metaDetail = await unifiedDetailRequest({
    request: new Request('https://clawdified.com/api/admin/connections/meta/meta_conn_123?include=agent_package', {
      headers: { Authorization: 'Bearer admin-secret' },
    }),
    env,
    params: { service: 'meta', id: 'meta_conn_123' },
  });
  const metaBody = await metaDetail.json();
  assert.equal(metaDetail.status, 200);
  assert.equal(metaBody.service, 'meta');
  assert.equal(metaBody.includes_sensitive_tokens, true);
  assert.equal(metaBody.agent_handoff.handoff_type, 'clawdified.meta_social_agent_connection.v1');
  assert.equal(metaBody.agent_handoff.oauth.user_access_token, 'EAAB-user-token');
  assert.equal(metaBody.legacy_detail_url, 'https://clawdified.com/api/social/meta/connections/meta_conn_123?include=agent_package');

  const gmailDetail = await unifiedDetailRequest({
    request: new Request('https://clawdified.com/api/admin/connections/gmail/gmail_conn_123?include=agent_package', {
      headers: { Authorization: 'Bearer admin-secret' },
    }),
    env,
    params: { service: 'gmail', id: 'gmail_conn_123' },
  });
  const gmailBody = await gmailDetail.json();
  assert.equal(gmailDetail.status, 200);
  assert.equal(gmailBody.service, 'gmail');
  assert.equal(gmailBody.agent_handoff.handoff_type, 'clawdified.gmail_agent_connection.v1');
  assert.equal(gmailBody.agent_handoff.oauth.refresh_token, 'refresh-token');
});

test('dashboard is wired to the unified registry while keeping legacy connector routes compatible', () => {
  const dashboard = readFileSync(new URL('../admin/connections/index.html', import.meta.url), 'utf8');
  assert.match(dashboard, /\/api\/admin\/connections/);
  assert.match(dashboard, /unified registry/i);
  assert.match(dashboard, /\/api\/oauth\/google\/connections/);
  assert.match(dashboard, /\/api\/social\/meta\/connections/);
  assert.equal(dashboard.includes('sessionStorage'), false);
  assert.equal(dashboard.includes('adminToken'), false);
  assert.equal(dashboard.includes('refresh_token'), false);
  assert.equal(dashboard.includes('page_access_token'), false);
  assert.equal(dashboard.includes('user_access_token'), false);
});
