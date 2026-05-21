# Clawdified Website

Canonical local source for `clawdified.com` Cloudflare Pages static site and Pages Functions.

## Current connector status

The Meta/Facebook + Instagram social connector has been added under:

- Public client page: `/connect/social/` — intentionally minimal: brand, one-sentence description, one `Connect Facebook + Instagram` button, and tiny legal links. No public token/package explanation, client/workflow form, step grid, or route list.
- OAuth start route: `/api/social/meta/start`
- OAuth callback route: `/api/social/meta/callback`
- Protected admin package route: `/api/social/meta/connections/{connection_id}?include=agent_package`
- Health/readiness route: `/api/social/meta/health`

Meta app:

- Name: `Clawdified Social Connector`
- App ID: `979754104796418`
- Expected redirect URI: `https://clawdified.com/api/social/meta/callback`

## What the connector is meant to do

A client should not share passwords, API keys, or add Wesley as a Facebook/Instagram admin. They should open the connector page, authorize through Meta, and select the Facebook Page / Instagram professional assets Clawdified can use.

After authorization, the callback exchanges the Meta OAuth code, discovers Facebook Pages and linked Instagram accounts, and stores an agent-ready package server-side. That package includes:

- Meta App ID and Graph API version
- Granted scopes from `debug_token`
- Long-lived user token
- Page access tokens
- Facebook Page IDs/names/usernames/categories/tasks/perms
- Linked Instagram business account IDs/usernames/profile metadata
- Graph endpoint map for Page, conversations, messages, feed, media, and subscribed apps
- Business IDs/verification status when Meta grants business access

Public success pages only show a connection ID and redacted metadata. Full tokens are returned only from the protected admin endpoint using `SOCIAL_CONNECTOR_ADMIN_TOKEN`.

## Required Cloudflare Pages configuration

The connector health endpoint returns `ok: true` only when these are configured:

- `META_APP_ID` — safe public app ID. Can be `979754104796418`.
- `META_APP_SECRET` — Meta app secret. Secret; do not commit or show in UI.
- `SOCIAL_CONNECTOR_STATE_SECRET` — random secret for OAuth state HMAC.
- `SOCIAL_CONNECTOR_ENCRYPTION_KEY` — random secret used to encrypt stored agent packages.
- `SOCIAL_CONNECTOR_ADMIN_TOKEN` — random bearer token for Wesley/server-side agent retrieval.
- `SOCIAL_CONNECTOR_KV` — Cloudflare KV binding for connection records.

Optional:

- `META_GRAPH_VERSION` — defaults to `v23.0`.
- `META_SCOPES` — comma/space-separated scopes. Defaults to public profile, Page, Instagram, messaging, and business-management connector scopes.
- `META_LOGIN_CONFIG_ID` — optional Facebook Login for Business configuration ID if Meta requires the business-login configuration instead of explicit scope query params.
- `META_REDIRECT_URI` — override callback URL if Meta uses a non-default route.
- `SOCIAL_CONNECTOR_BASE_URL` — override public origin if needed.

## Current production verification — 2026-05-21

Verified in Chrome/Meta Developer dashboard and Cloudflare/Wrangler:

- Cloudflare Pages project: `clawdifiedweb`
- Production deployment source: `cd23db5` (`feat: add Meta social connector`), redeployed as `b9b15a41-9f81-44f3-b5e4-f583977f43d5` after Cloudflare secret setup.
- Live connector page: `https://clawdified.com/connect/social/`
- Meta app redirect URI is saved under Facebook Login settings: `https://clawdified.com/api/social/meta/callback`
- Live health endpoint now returns `ok: true`; `META_APP_SECRET` is present in Cloudflare production and visible to Pages Functions after redeploy.
- Cloudflare production has these configured: `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION`, `META_REDIRECT_URI`, `SOCIAL_CONNECTOR_ADMIN_TOKEN`, `SOCIAL_CONNECTOR_BASE_URL`, `SOCIAL_CONNECTOR_ENCRYPTION_KEY`, `SOCIAL_CONNECTOR_STATE_SECRET`, and `SOCIAL_CONNECTOR_KV`.
- Meta Publish screen is not publishable yet: business portfolio `Wesley Taylor` is unverified, and the final Publish button is disabled.
- The Facebook Login use case currently shows `public_profile` ready for testing; Page/Instagram/business messaging permissions still need to be added/requested through Meta App Review or a Business Login configuration before third-party clients can authorize the full outreach package.

## Safety rules

- Do not commit app secrets, access tokens, admin bearer tokens, or raw connection packages.
- Do not expose tokens in client-visible pages or browser console logs.
- Do not send clients through `/connect/social/` unless `/api/social/meta/health` returns `ok: true`.
- Publishing the Cloudflare code is separate from Meta app live mode / App Review. Meta may still require business verification, permissions review, screencast, and valid use-case documentation before third-party production use.

## Verification commands

```bash
node --test test/social-meta-connector.test.mjs
node --check functions/api/social/meta/start.js
node --check functions/api/social/meta/callback.js
node --check functions/api/social/meta/health.js
node --check 'functions/api/social/meta/connections/[id].js'
```

For local Pages smoke, run Wrangler with a supported compatibility date if needed:

```bash
wrangler pages dev . --port 8788 --ip 127.0.0.1 --compatibility-date=2026-04-17
curl -s http://127.0.0.1:8788/api/social/meta/health
```

## Deployment note

This Cloudflare Pages project has historically been manually deployed with Wrangler rather than automatic Git deploys. Commit/push for provenance, then deploy the committed tree with `wrangler pages deploy` using the actual project name.
