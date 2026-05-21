import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAgentPackage,
  createSignedState,
  decryptJson,
  encryptJson,
  readiness,
  redactTokens,
  verifySignedState,
} from '../functions/api/social/meta/_shared.mjs';

const completeEnv = {
  META_APP_ID: '979754104796418',
  META_APP_SECRET: 'meta-secret',
  SOCIAL_CONNECTOR_STATE_SECRET: 'state-secret',
  SOCIAL_CONNECTOR_ENCRYPTION_KEY: 'encryption-secret',
  SOCIAL_CONNECTOR_ADMIN_TOKEN: 'admin-secret',
  SOCIAL_CONNECTOR_KV: {
    get() {},
    put() {},
  },
};

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
