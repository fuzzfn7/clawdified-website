import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  renderSuccessPage,
  scopesFromEnv,
  summarizeAgentPackage,
  verifySignedState,
} from '../functions/api/oauth/google/_shared.mjs';
import { onRequestPost as loginRequest } from '../functions/api/admin/login.js';
import { onRequestGet as sessionRequest } from '../functions/api/admin/session.js';
import { onRequestPost as logoutRequest } from '../functions/api/admin/logout.js';
import { onRequestGet as listConnectionsRequest } from '../functions/api/oauth/google/connections/index.js';

const completeEnv = {
  GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'google-secret',
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

test('default Google OAuth scopes include identity, send, and Gmail modify', () => {
  assert.deepEqual(scopesFromEnv({}), [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
  ]);

  const request = new Request('https://clawdified.com/api/oauth/google/start?return_to=/connect/gmail/');
  const { url } = buildAuthUrl({ request, env: completeEnv, returnTo: '/connect/gmail/' });
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  assert.equal(url.searchParams.get('include_granted_scopes'), 'true');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://clawdified.com/api/oauth/google/callback');
  assert.match(url.searchParams.get('scope'), /gmail\.send/);
  assert.match(url.searchParams.get('scope'), /gmail\.modify/);
});

test('readiness reports missing Gmail connector setup without secret values', () => {
  const result = readiness({}, { requireAdmin: true });
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, [
    'GOOGLE_CLIENT_SECRET',
    'GMAIL_CONNECTOR_STATE_SECRET or SOCIAL_CONNECTOR_STATE_SECRET',
    'GMAIL_CONNECTOR_ENCRYPTION_KEY or SOCIAL_CONNECTOR_ENCRYPTION_KEY',
    'SOCIAL_CONNECTOR_KV binding',
    'GMAIL_CONNECTOR_ADMIN_TOKEN or SOCIAL_CONNECTOR_ADMIN_TOKEN',
  ]);
  assert.equal(result.client_id_configured, true, 'default public Google client ID is built in');
});

test('signed Google OAuth state validates and rejects tampering', async () => {
  const state = await createSignedState({ client: 'Heller Hats', workflow: 'email outreach' }, 'state-secret');
  const payload = await verifySignedState(state, 'state-secret');
  assert.equal(payload.client, 'Heller Hats');
  assert.equal(payload.workflow, 'email outreach');
  await assert.rejects(() => verifySignedState(`${state}x`, 'state-secret'), /signature|state/i);
});

test('encryptJson/decryptJson round trips Gmail tokens without plaintext ciphertext', async () => {
  const packageWithSecret = {
    oauth: { access_token: 'ya29.secret-access-token', refresh_token: '1//secret-refresh-token' },
  };
  const encrypted = await encryptJson(packageWithSecret, 'encryption-secret');
  assert.equal(encrypted.alg, 'AES-GCM-SHA256');
  assert.equal(JSON.stringify(encrypted).includes('secret-refresh-token'), false);
  const decrypted = await decryptJson(encrypted, 'encryption-secret');
  assert.deepEqual(decrypted, packageWithSecret);
});

test('redactTokens removes nested Google OAuth tokens and ID tokens', () => {
  const redacted = redactTokens({
    oauth: {
      access_token: 'ya29-access',
      refresh_token: 'refresh-token',
      token_type: 'Bearer',
      id_token: 'id-token',
    },
    endpoints: { send: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send' },
  });
  assert.equal(redacted.oauth.access_token, '[stored-server-side]');
  assert.equal(redacted.oauth.refresh_token, '[stored-server-side]');
  assert.equal(redacted.oauth.token_type, '[stored-server-side]');
  assert.equal(redacted.oauth.id_token, '[stored-server-side]');
  assert.equal(redacted.endpoints.send, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
});

test('buildAgentPackage creates agent-ready Gmail endpoint map', () => {
  const packageData = buildAgentPackage({
    connectionId: 'gmail_conn_123',
    client: {
      client: 'Heller Hats',
      workflow: 'cold outbound',
      scopes: scopesFromEnv(completeEnv),
    },
    tokenPayload: {
      access_token: 'ya29-access-token',
      refresh_token: 'refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify',
    },
    account: {
      user: { sub: 'google-user-1', email: 'owner@example.com', name: 'Client Owner' },
      gmail_profile: { emailAddress: 'owner@example.com', messagesTotal: 10, threadsTotal: 3 },
    },
    env: completeEnv,
    redirectUri: 'https://clawdified.com/api/oauth/google/callback',
  });

  assert.equal(packageData.connection_id, 'gmail_conn_123');
  assert.equal(packageData.google_oauth.client_id, 'google-client-id.apps.googleusercontent.com');
  assert.equal(packageData.oauth.access_token, 'ya29-access-token');
  assert.equal(packageData.oauth.refresh_token, 'refresh-token');
  assert.equal(packageData.gmail_profile.emailAddress, 'owner@example.com');
  assert.equal(packageData.endpoints.send, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  assert.equal(packageData.required_for_outreach_agent.access_token_present, true);
  assert.equal(packageData.required_for_outreach_agent.refresh_token_present, true);
  assert.equal(packageData.required_for_outreach_agent.send_scope_requested, true);
  assert.equal(packageData.required_for_outreach_agent.modify_scope_requested, true);
});

function sampleAgentPackage(overrides = {}) {
  return {
    connection_id: 'gmail_conn_123',
    created_at: '2026-05-21T20:00:00.000Z',
    client: { name: 'Heller Hats', workflow: 'cold outbound' },
    google_oauth: {
      client_id: 'google-client-id.apps.googleusercontent.com',
      redirect_uri: 'https://clawdified.com/api/oauth/google/callback',
      requested_scopes: scopesFromEnv(completeEnv),
    },
    google_account: { sub: 'google-user-1', email: 'owner@example.com', name: 'Client Owner' },
    gmail_profile: { emailAddress: 'owner@example.com', messagesTotal: 10, threadsTotal: 3 },
    oauth: {
      access_token: 'ya29-access-token',
      refresh_token: 'refresh-token',
      token_type: 'Bearer',
      expires_at: '2026-05-21T21:00:00.000Z',
      granted_scopes: scopesFromEnv(completeEnv),
    },
    endpoints: {
      profile: 'https://gmail.googleapis.com/gmail/v1/users/me/profile',
      send: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      messages: 'https://gmail.googleapis.com/gmail/v1/users/me/messages',
      threads: 'https://gmail.googleapis.com/gmail/v1/users/me/threads',
      labels: 'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      history: 'https://gmail.googleapis.com/gmail/v1/users/me/history',
      drafts: 'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
    },
    required_for_outreach_agent: {
      client_id_present: true,
      email_present: true,
      access_token_present: true,
      refresh_token_present: true,
      send_scope_requested: true,
      modify_scope_requested: true,
      granted_scopes: scopesFromEnv(completeEnv),
    },
    ...overrides,
  };
}

test('summarizeAgentPackage creates dashboard-safe Gmail rows without raw tokens', () => {
  const summary = summarizeAgentPackage(sampleAgentPackage());

  assert.equal(summary.connection_id, 'gmail_conn_123');
  assert.equal(summary.service, 'gmail');
  assert.equal(summary.client_name, 'Heller Hats');
  assert.equal(summary.connected_email, 'owner@example.com');
  assert.equal(summary.status, 'connected');
  assert.equal(summary.refresh_token_stored, true);
  assert.equal(summary.ready_for_agent, true);
  assert.equal(JSON.stringify(summary).includes('refresh-token'), false);
  assert.equal(JSON.stringify(summary).includes('ya29-access-token'), false);
});

test('buildAgentHandoff creates self-describing package an agent can use', () => {
  const handoff = buildAgentHandoff(sampleAgentPackage(), { origin: 'https://clawdified.com' });

  assert.equal(handoff.handoff_type, 'clawdified.gmail_agent_connection.v1');
  assert.equal(handoff.connection_id, 'gmail_conn_123');
  assert.equal(handoff.connected_email, 'owner@example.com');
  assert.equal(handoff.status.ready_for_outbound_agent, true);
  assert.equal(handoff.oauth.auth_type, 'google_oauth_refresh_token');
  assert.equal(handoff.oauth.refresh_token, 'refresh-token');
  assert.equal(handoff.oauth.client_id, 'google-client-id.apps.googleusercontent.com');
  assert.equal(handoff.oauth.client_secret_source, 'GOOGLE_CLIENT_SECRET');
  assert.equal(handoff.oauth.token_uri, 'https://oauth2.googleapis.com/token');
  assert.equal(handoff.gmail.endpoints.send, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  assert.match(handoff.agent_instructions.join(' '), /refresh_token/i);
  assert.match(handoff.agent_instructions.join(' '), /GOOGLE_CLIENT_SECRET/i);
});

test('listConnections returns recent dashboard rows from Gmail KV records', async () => {
  const publicPackage = redactTokens(sampleAgentPackage());
  const record = {
    ok: true,
    connection_id: 'gmail_conn_123',
    created_at: '2026-05-21T20:00:00.000Z',
    public_agent_package: publicPackage,
    encrypted_agent_package: { alg: 'AES-GCM-SHA256', iv: 'unused', ciphertext: 'unused' },
  };
  const env = {
    ...completeEnv,
    SOCIAL_CONNECTOR_KV: {
      async list({ prefix }) {
        assert.equal(prefix, 'gmail-google-connection:');
        return { keys: [{ name: 'gmail-google-connection:gmail_conn_123' }], list_complete: true };
      },
      async get(key) {
        assert.equal(key, 'gmail-google-connection:gmail_conn_123');
        return JSON.stringify(record);
      },
      async put() {},
    },
  };

  const result = await listConnections({ env, origin: 'https://clawdified.com' });

  assert.equal(result.ok, true);
  assert.equal(result.connections.length, 1);
  assert.equal(result.connections[0].connection_id, 'gmail_conn_123');
  assert.equal(result.connections[0].connected_email, 'owner@example.com');
  assert.equal(result.connections[0].detail_url, 'https://clawdified.com/api/oauth/google/connections/gmail_conn_123?include=agent_package');
  assert.equal(JSON.stringify(result).includes('refresh-token'), false);
});

test('renderSuccessPage thanks clients without exposing connection IDs or tokens', () => {
  const html = renderSuccessPage({
    connectionId: 'gmail_conn_123',
    publicPackage: redactTokens(sampleAgentPackage()),
    returnTo: '/connect/gmail/',
  });

  assert.match(html, /Gmail is connected/i);
  assert.match(html, /close this window/i);
  assert.equal(html.includes('gmail_conn_123'), false);
  assert.equal(html.includes('Connection ID'), false);
  assert.equal(html.includes('refresh-token'), false);
});

test('connections list route requires admin token and returns safe rows', async () => {
  const publicPackage = redactTokens(sampleAgentPackage());
  const env = {
    ...completeEnv,
    SOCIAL_CONNECTOR_KV: {
      async list() {
        return { keys: [{ name: 'gmail-google-connection:gmail_conn_123' }], list_complete: true };
      },
      async get() {
        return JSON.stringify({
          ok: true,
          connection_id: 'gmail_conn_123',
          created_at: '2026-05-21T20:00:00.000Z',
          public_agent_package: publicPackage,
        });
      },
      async put() {},
    },
  };

  const denied = await listConnectionsRequest({
    request: new Request('https://clawdified.com/api/oauth/google/connections'),
    env,
  });
  assert.equal(denied.status, 401);

  const allowed = await listConnectionsRequest({
    request: new Request('https://clawdified.com/api/oauth/google/connections', {
      headers: { Authorization: 'Bearer admin-secret' },
    }),
    env,
  });
  const body = await allowed.json();
  assert.equal(allowed.status, 200);
  assert.equal(body.connections[0].connected_email, 'owner@example.com');
  assert.equal(body.connections[0].ready_for_agent, true);
  assert.equal(JSON.stringify(body).includes('refresh-token'), false);
});

test('admin email-password login sets a session cookie accepted by connection APIs', async () => {
  const publicPackage = redactTokens(sampleAgentPackage());
  const env = {
    ...completeEnv,
    SOCIAL_CONNECTOR_KV: {
      async list() {
        return { keys: [{ name: 'gmail-google-connection:gmail_conn_123' }], list_complete: true };
      },
      async get() {
        return JSON.stringify({
          ok: true,
          connection_id: 'gmail_conn_123',
          created_at: '2026-05-21T20:00:00.000Z',
          public_agent_package: publicPackage,
        });
      },
      async put() {},
    },
  };

  const badLogin = await loginRequest({
    request: new Request('https://clawdified.com/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wesley@clawdified.com', password: 'wrong' }),
    }),
    env,
  });
  assert.equal(badLogin.status, 401);

  const goodLogin = await loginRequest({
    request: new Request('https://clawdified.com/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wesley@clawdified.com', password: 'admin-password' }),
    }),
    env,
  });
  assert.equal(goodLogin.status, 200);
  const loginBody = await goodLogin.json();
  assert.equal(loginBody.authenticated, true);
  assert.equal(loginBody.email, 'wesley@clawdified.com');
  const cookie = goodLogin.headers.get('Set-Cookie');
  assert.match(cookie, /clawdified_admin_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  const cookieHeader = cookie.split(';')[0];

  const session = await sessionRequest({
    request: new Request('https://clawdified.com/api/admin/session', {
      headers: { Cookie: cookieHeader },
    }),
    env,
  });
  const sessionBody = await session.json();
  assert.equal(sessionBody.authenticated, true);
  assert.equal(sessionBody.email, 'wesley@clawdified.com');

  const allowed = await listConnectionsRequest({
    request: new Request('https://clawdified.com/api/oauth/google/connections', {
      headers: { Cookie: cookieHeader },
    }),
    env,
  });
  const body = await allowed.json();
  assert.equal(allowed.status, 200);
  assert.equal(body.connections[0].connected_email, 'owner@example.com');

  const logout = await logoutRequest({
    request: new Request('https://clawdified.com/api/admin/logout', { method: 'POST' }),
    env,
  });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
});

test('admin dashboard and connector page expose the intended non-technical flow', () => {
  const dashboard = readFileSync(new URL('../admin/connections/index.html', import.meta.url), 'utf8');
  assert.match(dashboard, /Client connections/i);
  assert.match(dashboard, /Sign in/i);
  assert.match(dashboard, /Facebook \+ Instagram/i);
  assert.match(dashboard, /Copy agent package/i);
  assert.match(dashboard, /\/api\/admin\/login/);
  assert.match(dashboard, /\/api\/admin\/session/);
  assert.match(dashboard, /\/api\/admin\/logout/);
  assert.match(dashboard, /\/api\/oauth\/google\/connections/);
  assert.match(dashboard, /\/api\/social\/meta\/connections/);
  assert.match(dashboard, /\/connect\/social\//);
  assert.equal(dashboard.includes('sessionStorage'), false, 'dashboard should use the HttpOnly admin session cookie, not local/session storage for secrets');
  assert.equal(dashboard.includes('adminToken'), false, 'dashboard should no longer ask for a raw bearer token by default');
  assert.equal(dashboard.includes('refresh_token'), false, 'dashboard should not print raw token field labels by default');
  assert.equal(dashboard.includes('page_access_token'), false, 'dashboard should not print raw Meta page token field labels by default');
  assert.equal(dashboard.includes('user_access_token'), false, 'dashboard should not print raw Meta user token field labels by default');

  const connector = readFileSync(new URL('../connect/gmail/index.html', import.meta.url), 'utf8');
  assert.match(connector, /client/);
  assert.match(connector, /workflow/);
  assert.match(connector, /return_to/);
});
