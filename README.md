# Clawdified Website

Canonical local source for `clawdified.com` Cloudflare Pages static site and Pages Functions.

## Current connector status

The Meta/Facebook + Instagram social connector has been added under:

- Public client page: `/connect/social/` — intentionally minimal: brand, one-sentence description, one `Connect Facebook + Instagram` button, and tiny legal links. No public token/package explanation, client/workflow form, step grid, or route list.
- OAuth start route: `/api/social/meta/start`
- OAuth callback route: `/api/social/meta/callback`
- Protected admin list route: `/api/social/meta/connections`
- Protected admin package route: `/api/social/meta/connections/{connection_id}?include=agent_package`
- Health/readiness route: `/api/social/meta/health`

The Gmail outbound/inbox connector has been added under:

- Public client page: `/connect/gmail/` — intentionally minimal: brand, one-sentence description, one `Connect Gmail` button, and tiny legal links. No public token/package explanation, workflow form, route list, or Google API jargon.
- Private admin dashboard: `/admin/connections/` — simple email/password sign-in backed by an HttpOnly admin session cookie. This is the shared private API/OAuth console for Gmail, Facebook/Instagram, and future API/OAuth connector summaries, client invite links, and intentional copy actions for agent-ready handoff packages.
- Admin login/session routes: `/api/admin/login`, `/api/admin/session`, `/api/admin/logout`
- Unified registry/list route: `/api/admin/connections` — one protected endpoint that returns connector metadata plus safe rows across every registered service.
- Unified registry/package route: `/api/admin/connections/{service}/{connection_id}?include=agent_package` — one protected detail pattern that dispatches to the service-specific package builder. Existing Gmail/Meta list/detail routes remain for compatibility.
- New connector extension point: add the service descriptor/list/read/handoff functions to `functions/api/admin/connections/_registry.mjs`, then the dashboard invite selector, rows, and copy-package action pick it up from the registry response.
- OAuth start route: `/api/oauth/google/start`
- OAuth callback route: `/api/oauth/google/callback`
- Protected admin list route: `/api/oauth/google/connections`
- Protected admin package route: `/api/oauth/google/connections/{connection_id}?include=agent_package`
- Health/readiness route: `/api/oauth/google/health`

Meta app:

- Name: `Clawdified Social Connector`
- App ID: `979754104796418`
- Expected redirect URI: `https://clawdified.com/api/social/meta/callback`

Google OAuth app:

- Project: `gmail-0auth-497017`
- OAuth client: `Clawdified Gmail OAuth Web Client`
- Client ID: `1028192088822-tvps78pnmi3kvpu92sbvluv2rve9mao4.apps.googleusercontent.com`
- Expected redirect URI for this Pages app: `https://clawdified.com/api/oauth/google/callback`
- Currently requested scopes: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/gmail.send`, `https://www.googleapis.com/auth/gmail.modify`

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

Public Meta success pages show a connection ID and redacted metadata. Gmail client success pages deliberately show only a simple thank-you/connected message; Wesley retrieves Gmail and Meta connection summaries plus agent handoff packages from `/admin/connections/`. Full tokens are returned only from protected admin endpoints using a signed admin session cookie or the fallback `SOCIAL_CONNECTOR_ADMIN_TOKEN` / `GMAIL_CONNECTOR_ADMIN_TOKEN` bearer token.

Gmail agent handoff packages are intentionally self-describing for non-technical operation. Wesley can copy the package from the dashboard and paste it into the approved client agent/runtime. The agent should use the included connection ID, connected email, Gmail endpoints, granted scopes, OAuth refresh credential, and the server-side Clawdified `GOOGLE_CLIENT_SECRET` to mint fresh Gmail access tokens; Wesley should not manually handle Google token exchange details.

Meta social handoff packages follow the same private-operator pattern. Once the Facebook app is published/approved and a client authorizes Facebook + Instagram, `/admin/connections/` lists the connection, safe Page/Instagram/business summaries, and a copy-ready package containing Graph endpoints, granted scopes, user/page credentials, and the server-side `META_APP_SECRET` source note.

## Required Cloudflare Pages configuration

The connector health endpoints return `ok: true` only when these are configured.

Meta social connector:

- `META_APP_ID` — safe public app ID. Can be `979754104796418`.
- `META_APP_SECRET` — Meta app secret. Secret; do not commit or show in UI.
- `SOCIAL_CONNECTOR_STATE_SECRET` — random secret for OAuth state HMAC.
- `SOCIAL_CONNECTOR_ENCRYPTION_KEY` — random secret used to encrypt stored agent packages.
- `SOCIAL_CONNECTOR_ADMIN_TOKEN` — random bearer token for Wesley/server-side agent retrieval.
- `SOCIAL_CONNECTOR_KV` — Cloudflare KV binding for connection records.

Gmail connector:

- `GOOGLE_CLIENT_ID` — safe public OAuth client ID. The code includes the current client ID as a fallback, but production should still set it explicitly.
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret. Secret; do not commit or show in UI.
- `GOOGLE_REDIRECT_URI` — optional override. Use `https://clawdified.com/api/oauth/google/callback` for the current Pages deployment.
- `GMAIL_CONNECTOR_STATE_SECRET` — optional Gmail-specific state HMAC secret; falls back to `SOCIAL_CONNECTOR_STATE_SECRET`.
- `GMAIL_CONNECTOR_ENCRYPTION_KEY` — optional Gmail-specific encryption key; falls back to `SOCIAL_CONNECTOR_ENCRYPTION_KEY`.
- `GMAIL_CONNECTOR_ADMIN_TOKEN` — optional Gmail-specific admin bearer token; falls back to `SOCIAL_CONNECTOR_ADMIN_TOKEN`. Also acts as the dashboard password fallback when no explicit admin password secret is set.
- `CLAWDIFIED_ADMIN_EMAIL` — optional dashboard login email. If absent, any valid email label is accepted and the password secret controls access.
- `CLAWDIFIED_ADMIN_PASSWORD` — optional dashboard login password. If absent, the dashboard uses the configured Gmail/social admin bearer token as the password fallback.
- `CLAWDIFIED_ADMIN_SESSION_SECRET` — optional signing secret for the HttpOnly dashboard session cookie; falls back to the connector state/encryption/admin secret chain.
- `SOCIAL_CONNECTOR_KV` — reused Cloudflare KV binding for encrypted connection records.

Optional:

- `META_GRAPH_VERSION` — defaults to `v23.0`.
- `META_SCOPES` — comma/space-separated scopes. Defaults to `public_profile` only so the Meta OAuth dialog remains valid before advanced Page/Instagram permissions are approved. After Meta App Review/business configuration, set this explicitly if using scope-based login.
- `META_LOGIN_CONFIG_ID` — optional Facebook Login for Business configuration ID. Use this when Meta requires a business-login configuration for Page/Instagram permissions instead of explicit scope query params.
- `META_REDIRECT_URI` — override callback URL if Meta uses a non-default route.
- `SOCIAL_CONNECTOR_BASE_URL` — override public origin if needed.

## Current production verification — 2026-05-21

Verified in Chrome/Meta Developer dashboard and Cloudflare/Wrangler:

- Cloudflare Pages project: `clawdifiedweb`
- Latest shared connections dashboard deployment from `main` was manually deployed with Wrangler and verified on both `clawdified.com` and the Pages preview URL.
- Live social connector page: `https://clawdified.com/connect/social/`
- Meta app redirect URI is saved under Facebook Login settings: `https://clawdified.com/api/social/meta/callback`
- Live Meta health endpoint now returns `ok: true`; `META_APP_SECRET` is present in Cloudflare production and visible to Pages Functions after redeploy.
- Live Gmail connector page: `https://clawdified.com/connect/gmail/`
- Live private Gmail admin dashboard page: `https://clawdified.com/admin/connections/`
- Live admin dashboard now uses `/api/admin/login` + an HttpOnly session cookie. Gmail and Meta protected list/package endpoints reject unauthenticated requests with `401` and preserve bearer-token compatibility for server-side/agent retrieval.
- Google OAuth client redirect URIs include `https://clawdified.com/api/oauth/google/callback` and the earlier `https://app.clawdified.com/api/oauth/google/callback`.
- Live Gmail health endpoint returns `ok: true`; `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, shared state/encryption/admin secrets, and `SOCIAL_CONNECTOR_KV` are visible to Pages Functions.
- Live `/api/oauth/google/start` returns a Google OAuth 302 using the `clawdified.com` callback and the requested `openid`, `email`, `profile`, `gmail.send`, and `gmail.modify` scopes.
- Cloudflare production has these configured: `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION`, `META_REDIRECT_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `SOCIAL_CONNECTOR_ADMIN_TOKEN`, `SOCIAL_CONNECTOR_BASE_URL`, `SOCIAL_CONNECTOR_ENCRYPTION_KEY`, `SOCIAL_CONNECTOR_STATE_SECRET`, and `SOCIAL_CONNECTOR_KV`.
- Meta Publish screen is not publishable yet: business portfolio `Wesley Taylor` is unverified, and the final Publish button is disabled.
- Default OAuth now requests `public_profile` only; production `/api/social/meta/start` no longer sends the Page/Instagram/business scopes that Meta rejected as invalid for the current app/use-case.
- Full Facebook Page + Instagram connector permissions still require Meta Business Login/App Review setup via either explicit `META_SCOPES` after approval or `META_LOGIN_CONFIG_ID`.

## Safety rules

- Do not commit app secrets, access tokens, admin bearer tokens, OAuth refresh tokens, ID tokens, or raw connection packages.
- Do not expose tokens in client-visible pages or browser console logs.
- Do not send clients through `/connect/social/` unless `/api/social/meta/health` returns `ok: true`.
- Do not send clients through `/connect/gmail/` unless `/api/oauth/google/health` returns `ok: true`.
- Gmail `gmail.modify` is a restricted Google scope. Google may require app verification and a security assessment before broad third-party production use.
- Publishing the Cloudflare code is separate from Meta app live mode / App Review and Google OAuth app verification. Both platforms may still require business verification, permission/scope review, screencasts, and valid use-case documentation before third-party production use.

## Verification commands

```bash
node --test test/social-meta-connector.test.mjs test/gmail-google-connector.test.mjs test/admin-connections-registry.test.mjs
node --check functions/api/admin/connections/index.js
node --check 'functions/api/admin/connections/[service]/[id].js'
node --check functions/api/admin/connections/_registry.mjs
node --check functions/api/social/meta/start.js
node --check functions/api/social/meta/callback.js
node --check functions/api/social/meta/health.js
node --check functions/api/social/meta/connections/index.js
node --check 'functions/api/social/meta/connections/[id].js'
node --check functions/api/admin/login.js
node --check functions/api/admin/session.js
node --check functions/api/admin/logout.js
node --check functions/api/admin/_auth.mjs
node --check functions/api/oauth/google/_shared.mjs
node --check functions/api/oauth/google/start.js
node --check functions/api/oauth/google/callback.js
node --check functions/api/oauth/google/health.js
node --check functions/api/oauth/google/connections/index.js
node --check 'functions/api/oauth/google/connections/[id].js'
```

For local Pages smoke, run Wrangler with a supported compatibility date if needed:

```bash
wrangler pages dev . --port 8788 --ip 127.0.0.1 --compatibility-date=2026-04-17
curl -s http://127.0.0.1:8788/api/social/meta/health
```

## Deployment note

This Cloudflare Pages project has historically been manually deployed with Wrangler rather than automatic Git deploys. Commit/push for provenance, then deploy the committed tree with `wrangler pages deploy` using the actual project name.
