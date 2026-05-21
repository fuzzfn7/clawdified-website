import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAgentHandoff,
  buildAgentPackage,
  buildAuthUrl,
  createSignedState,
  decryptJson,
  encryptJson,
  listConnections,
  readiness,
  redactTokens,
  scopesFromEnv,
  summarizeAgentPackage,
  verifySignedState,
} from '../functions/api/social/meta/_shared.mjs';
import { onRequestPost as loginRequest } from '../functions/api/admin/login.js';
import { onRequestGet as listConnectionsRequest } from '../functions/api/social/meta/connections/index.js';
import { onRequestGet as detailConnectionRequest } from '../functions/api/social/meta/connections/[id].js';

const completeEnv = {
  META_APP_ID: '979754104796418',
  META_APP_SECRET: 'meta-secret',
  CLAWDIFIED_ADMIN_EMAIL: 'wesley@clawdified.com',
  CLAWDIFIED_ADMIN_PASSWORD: 'admin-password',
  CLAWDIFIED_ADMIN_SESSION_SECRET: 'session-secret',
  SOCIAL_CONNECTOR_STATE_SECRET: 'state-secret',
  SOCIAL_CONNECTOR_ENCRYPTION_KEY: 'encryption-secret',
  SOCIAL_CONNECTOR_ADMIN_TOKEN: 'admin-secret',
  SOCIAL_CONNECTOR_KV: {
    get() {},
    put() {},
  },
};

test('default OAuth scope is Meta-dialog safe until advanced permissions are explicitly configured', () => {
  assert.deepEqual(scopesFromEnv({}), ['public_profile']);

  const request = new Request('https://clawdified.com/api/social/meta/start?return_to=/connect/social/');
  const { url } = buildAuthUrl({ request, env: completeEnv, returnTo: '/connect/social/' });
  assert.equal(url.searchParams.get('scope'), 'public_profile');
  assert.equal(url.searchParams.has('config_id'), false);
  assert.equal(url.searchParams.get('scope').includes('pages_show_list'), false);
});

test('OAuth supports explicit advanced scopes or Facebook Login for Business config', () => {
  const request = new Request('https://clawdified.com/api/social/meta/start');
  const advanced = buildAuthUrl({
    request,
    env: { ...completeEnv, META_SCOPES: 'public_profile pages_show_list instagram_basic' },
  });
  assert.equal(advanced.url.searchParams.get('scope'), 'public_profile,pages_show_list,instagram_basic');

  const businessLogin = buildAuthUrl({
    request,
    env: { ...completeEnv, META_LOGIN_CONFIG_ID: '1234567890' },
  });
  assert.equal(businessLogin.url.searchParams.get('config_id'), '1234567890');
  assert.equal(businessLogin.url.searchParams.has('scope'), false);
});

test('readiness reports exact missing connector setup without secret values', () => {
  const result = readiness({}, { requireAdmin: true });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, [
    'META_APP_SECRET',
    'SOCIAL_CONNECTOR_STATE_SECRET',
    'SOCIAL_CONNECTOR_ENCRYPTION_KEY',
    'SOCIAL_CONNECTOR_KV binding',
    'SOCIAL_CONNECTOR_ADMIN_TOKEN',
  ]);
  assert.equal(result.app_id_configured, true, 'default app id is built in because app id is not secret');
});

test('signed OAuth state validates and rejects tampering', async () => {
  const state = await createSignedState({ client: 'Heller Hats', workflow: 'social outreach' }, 'state-secret');
  const payload = await verifySignedState(state, 'state-secret');
  assert.equal(payload.client, 'Heller Hats');
  assert.equal(payload.workflow, 'social outreach');
  await assert.rejects(() => verifySignedState(`${state}x`, 'state-secret'), /signature|state/i);
});

test('signed OAuth state expires', async () => {
  const issuedAt = 1_000_000;
  const originalNow = Date.now;
  Date.now = () => issuedAt;
  try {
    const state = await createSignedState({ client: 'Expired Client' }, 'state-secret');
    await assert.rejects(
      () => verifySignedState(state, 'state-secret', { now: issuedAt + 21 * 60 * 1000 }),
      /Expired OAuth state/,
    );
  } finally {
    Date.now = originalNow;
  }
});

test('encryptJson/decryptJson round trips a token package without plaintext ciphertext', async () => {
  const packageWithSecret = {
    oauth: { user_access_token: 'EAAB-secret-user-token' },
    pages: [{ page_access_token: 'EAAB-secret-page-token' }],
  };
  const encrypted = await encryptJson(packageWithSecret, 'encryption-secret');
  assert.equal(encrypted.alg, 'AES-GCM-SHA256');
  assert.equal(JSON.stringify(encrypted).includes('EAAB-secret'), false);
  const decrypted = await decryptJson(encrypted, 'encryption-secret');
  assert.deepEqual(decrypted, packageWithSecret);
});

test('redactTokens removes nested OAuth and page tokens', () => {
  const redacted = redactTokens({
    oauth: { user_access_token: 'EAAB-user-token', token_type: 'bearer' },
    pages: [{ page_access_token: 'EAAB-page-token', endpoints: { page: 'https://graph.facebook.com/v23.0/123' } }],
    app_secret: 'secret',
  });
  assert.equal(redacted.oauth.user_access_token, '[stored-server-side]');
  assert.equal(redacted.oauth.token_type, '[stored-server-side]');
  assert.equal(redacted.pages[0].page_access_token, '[stored-server-side]');
  assert.equal(redacted.app_secret, '[stored-server-side]');
  assert.equal(redacted.pages[0].endpoints.page, 'https://graph.facebook.com/v23.0/123');
});

test('buildAgentPackage creates agent-ready Facebook and Instagram endpoint map', () => {
  const packageData = buildAgentPackage({
    connectionId: 'conn_123',
    client: { client: 'Heller Hats', workflow: 'outreach' },
    tokenPayload: {
      short_lived: { token_type: 'bearer' },
      long_lived: { access_token: 'EAAB-user-token', token_type: 'bearer', expires_in: 5184000 },
    },
    assets: {
      user: { id: 'user_1', name: 'Client Owner' },
      debug: { data: { scopes: ['pages_show_list', 'instagram_basic'], expires_at: 1900000000 } },
      businesses: [{ id: 'biz_1', name: 'Client Business' }],
      pages: [
        {
          id: 'page_1',
          name: 'Client Page',
          username: 'clientpage',
          category: 'Brand',
          access_token: 'EAAB-page-token',
          tasks: ['MESSAGING'],
          instagram_business_account: { id: 'ig_1', username: 'clientig' },
          instagram_profile: { id: 'ig_1', username: 'clientig', followers_count: 5000 },
        },
      ],
    },
    env: completeEnv,
    redirectUri: 'https://clawdified.com/api/social/meta/callback',
  });

  assert.equal(packageData.connection_id, 'conn_123');
  assert.equal(packageData.meta_app.app_id, '979754104796418');
  assert.equal(packageData.oauth.user_access_token, 'EAAB-user-token');
  assert.equal(packageData.pages[0].page_access_token, 'EAAB-page-token');
  assert.equal(packageData.pages[0].facebook_page_id, 'page_1');
  assert.equal(packageData.pages[0].instagram_business_account_id, 'ig_1');
  assert.equal(packageData.pages[0].endpoints.page_messages, 'https://graph.facebook.com/v23.0/page_1/messages');
  assert.equal(packageData.pages[0].endpoints.instagram_messages, 'https://graph.facebook.com/v23.0/ig_1/messages');
  assert.equal(packageData.required_for_outreach_agent.user_token_present, true);
  assert.equal(packageData.required_for_outreach_agent.page_tokens_present, true);
  assert.equal(packageData.required_for_outreach_agent.instagram_ids_present, true);
});


function sampleAgentPackage(overrides = {}) {
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
      instagram_profile: { id: 'ig_1', username: 'clientig', followers_count: 5000 },
      endpoints: {
        page: 'https://graph.facebook.com/v23.0/page_1',
        page_messages: 'https://graph.facebook.com/v23.0/page_1/messages',
        instagram_business_account: 'https://graph.facebook.com/v23.0/ig_1',
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
    ...overrides,
  };
}

test('summarizeAgentPackage creates dashboard-safe Meta rows without raw tokens', () => {
  const summary = summarizeAgentPackage(sampleAgentPackage(), { origin: 'https://clawdified.com' });

  assert.equal(summary.service, 'meta');
  assert.equal(summary.service_label, 'Facebook + Instagram');
  assert.equal(summary.connection_id, 'meta_conn_123');
  assert.equal(summary.client_name, 'Heller Hats');
  assert.equal(summary.connected_account, 'Client Page');
  assert.equal(summary.facebook_pages_count, 1);
  assert.equal(summary.instagram_accounts_count, 1);
  assert.equal(summary.user_token_stored, true);
  assert.equal(summary.page_tokens_stored, true);
  assert.equal(summary.ready_for_agent, true);
  assert.equal(summary.detail_url, 'https://clawdified.com/api/social/meta/connections/meta_conn_123?include=agent_package');
  assert.equal(JSON.stringify(summary).includes('EAAB-'), false);
});

test('buildAgentHandoff creates self-describing Meta package for agents', () => {
  const handoff = buildAgentHandoff(sampleAgentPackage(), { origin: 'https://clawdified.com' });

  assert.equal(handoff.handoff_type, 'clawdified.meta_social_agent_connection.v1');
  assert.equal(handoff.connection_id, 'meta_conn_123');
  assert.equal(handoff.service, 'facebook_instagram');
  assert.equal(handoff.status.ready_for_social_agent, true);
  assert.equal(handoff.meta.app_secret_source, 'META_APP_SECRET');
  assert.equal(handoff.oauth.user_access_token, 'EAAB-user-token');
  assert.equal(handoff.pages[0].page_access_token, 'EAAB-page-token');
  assert.equal(handoff.pages[0].endpoints.instagram_messages, 'https://graph.facebook.com/v23.0/ig_1/messages');
});

test('listConnections returns recent Meta dashboard rows from KV records', async () => {
  const publicPackage = redactTokens(sampleAgentPackage());
  const record = {
    ok: true,
    connection_id: 'meta_conn_123',
    created_at: '2026-05-21T22:00:00.000Z',
    public_agent_package: publicPackage,
  };
  const env = {
    ...completeEnv,
    SOCIAL_CONNECTOR_KV: {
      async list({ prefix }) {
        assert.equal(prefix, 'social-meta-connection:');
        return { keys: [{ name: 'social-meta-connection:meta_conn_123' }], list_complete: true };
      },
      async get(key) {
        assert.equal(key, 'social-meta-connection:meta_conn_123');
        return JSON.stringify(record);
      },
      async put() {},
    },
  };

  const result = await listConnections({ env, origin: 'https://clawdified.com' });

  assert.equal(result.ok, true);
  assert.equal(result.service, 'meta');
  assert.equal(result.connections.length, 1);
  assert.equal(result.connections[0].connected_account, 'Client Page');
  assert.equal(result.connections[0].instagram_usernames[0], 'clientig');
  assert.equal(JSON.stringify(result).includes('EAAB-'), false);
});

test('Meta connection admin routes require auth and accept the admin session cookie', async () => {
  const fullPackage = sampleAgentPackage();
  const publicPackage = redactTokens(fullPackage);
  const encryptedAgentPackage = await encryptJson(fullPackage, 'encryption-secret');
  const record = {
    ok: true,
    connection_id: 'meta_conn_123',
    created_at: '2026-05-21T22:00:00.000Z',
    public_agent_package: publicPackage,
    encrypted_agent_package: encryptedAgentPackage,
  };
  const env = {
    ...completeEnv,
    SOCIAL_CONNECTOR_KV: {
      async list() {
        return { keys: [{ name: 'social-meta-connection:meta_conn_123' }], list_complete: true };
      },
      async get(key) {
        assert.equal(key, 'social-meta-connection:meta_conn_123');
        return JSON.stringify(record);
      },
      async put() {},
    },
  };

  const denied = await listConnectionsRequest({
    request: new Request('https://clawdified.com/api/social/meta/connections'),
    env,
  });
  assert.equal(denied.status, 401);

  const login = await loginRequest({
    request: new Request('https://clawdified.com/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wesley@clawdified.com', password: 'admin-password' }),
    }),
    env,
  });
  assert.equal(login.status, 200);
  const cookieHeader = login.headers.get('Set-Cookie').split(';')[0];

  const allowed = await listConnectionsRequest({
    request: new Request('https://clawdified.com/api/social/meta/connections', {
      headers: { Cookie: cookieHeader },
    }),
    env,
  });
  const body = await allowed.json();
  assert.equal(allowed.status, 200);
  assert.equal(body.connections[0].service, 'meta');
  assert.equal(body.connections[0].facebook_pages_count, 1);
  assert.equal(JSON.stringify(body).includes('EAAB-'), false);

  const detail = await detailConnectionRequest({
    request: new Request('https://clawdified.com/api/social/meta/connections/meta_conn_123?include=agent_package', {
      headers: { Cookie: cookieHeader },
    }),
    env,
    params: { id: 'meta_conn_123' },
  });
  const detailBody = await detail.json();
  assert.equal(detail.status, 200);
  assert.equal(detailBody.includes_sensitive_tokens, true);
  assert.equal(detailBody.agent_handoff.handoff_type, 'clawdified.meta_social_agent_connection.v1');
  assert.equal(detailBody.agent_handoff.oauth.user_access_token, 'EAAB-user-token');
});
