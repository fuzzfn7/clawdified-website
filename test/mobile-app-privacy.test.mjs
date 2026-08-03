import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from '../functions/_middleware.js';

async function privacyPage() {
  return onRequest({
    request: new Request('https://clawdified.com/privacy', {
      headers: { Accept: 'text/html' },
    }),
    next: async () => new Response('unexpected'),
  });
}

test('privacy policy covers the native app and its implemented voice workflow', async () => {
  const response = await privacyPage();
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.match(html, /Last updated: August 2, 2026/);
  assert.match(html, /website and mobile app/i);
  assert.match(html, /email address, display name, authorized organization/i);
  assert.match(html, /Work Order data/i);
  assert.match(html, /voice recordings and transcripts/i);
  assert.match(html, /only when you tap the microphone/i);
  assert.match(html, /does not listen in the background/i);
  assert.match(html, /secure session cookie/i);
  assert.match(html, /delete an individual voice note/i);
  assert.match(html, /do not sell.*personal information/i);
  assert.match(html, /do not use.*advertising/i);
});

test('privacy policy states service-provider, retention, and deletion boundaries', async () => {
  const response = await privacyPage();
  const html = await response.text();

  assert.match(html, /service providers needed to host, secure, transcribe, or operate/i);
  assert.match(html, /retained while needed to provide the authorized workflow/i);
  assert.match(html, /legal, security, billing, backup, or dispute-resolution/i);
  assert.match(html, /https:\/\/clawdified\.com\/data-deletion/);
});
