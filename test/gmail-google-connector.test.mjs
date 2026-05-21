import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAgentPackage,
  buildAuthUrl,
  createSignedState,
  decryptJson,
  encryptJson,
  readiness,
  redactTokens,
  scopesFromEnv,
  verifySignedState,
} from '../functions/api/oauth/google/_shared.mjs';

const completeEnv = {
  GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'google-secret',
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
