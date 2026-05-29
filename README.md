# Clawdified Website

Canonical local source for `clawdified.com` Cloudflare Pages static site and Pages Functions.

## Current homepage status

- `/` hero and pricing remain the primary conversion anchors.
- The middle homepage flow was redesigned with Claude Design on 2026-05-26 as three visual, copy-light sections: problem bottleneck (`#problem`), agent-between-apps solution (`#solution`), and managed workflow map (`#process`). On 2026-05-28, the problem/solution copy was repositioned away from generic inbox/review/follow-up pain and toward custom workflows trapped in someone’s head: messy inputs, judgment calls, scattered tools, and client-ready outputs.
- Required markers in `index.html`: `CLAUDE_DESIGN_HOME_VISUAL_REDESIGN_20260526`, `CUSTOM_WORKFLOW_HOME_REPOSITION_20260528`, `Claude Design homepage visual redesign 20260526`, and visible text `visual workflow proof` in the `/agents/` teaser.
- Do not re-add the old homepage tabbed/fake-app demo flow (`#what-it-does`, `#tools`, `#how-it-works`). The actual interactive live agent showroom lives separately at `/agents/`.

## Current live agent showroom status

- `/agents/` is the public agent systems showroom.
- Lead Growth embeds the actual Lead Growth UI at `/agents/lead-growth/`, but the public version is now a Clawdified showroom rather than a visitor intake/search tool. It must not show business-website/ICP/search-area inputs or public-search provider order/URLs, and `/api/leadgen-trial` is retired so visitors cannot bypass the UI for public lead rows. Clicking `Run agent` in the demo populates Clawdified example lead rows with ICP fit, contact-route examples, source-evidence notes, Apollo/provider readiness shown as enabled, and live-looking run health. Source marker: `CLAWDIFIED_LEAD_AGENT_SHOWROOM_20260528`.
- SEO & Competitor Intelligence embeds an anonymized sample operator workspace at `/agents/seo-competitor/`, built from the Accurate Pest-style SEO competitor analysis data. It should demonstrate what the finished agent output looks like for a company that already has business context loaded: business/site read, why competitors outrank it, search coverage, competitors, action plan, evidence rows, and a full Ask Agent section. Do not revert it to a visitor website-input scanner or fabricate instant analysis for arbitrary domains.
- Workflow & Proposal Automation is still coming soon. The `/agents/` card may be clicked, but it must show only a centered coming-soon holding panel — no sample/proposal UI, no draft preview, and no unrelated embedded interface until the real workflow UI is ready.
- The `/agents/` systems card section should stay copy-light and prospect-facing: no internal rationale/explainer headline above the cards; cards should read like a compact menu.
- The `/agents/` hero subcopy should stay short/human; avoid product-taxonomy phrases like “three realistic product surfaces,” “capped,” “redacted,” or “approval-gated” in the main visible pitch.

## Current connector status

The Meta/Facebook + Instagram social connector has been added under:

- Public client page: `/connect/social/` — intentionally minimal: brand, one-sentence description, one `Connect Facebook + Instagram` button, and tiny legal links. No public token/package explanation, client/workflow form, step grid, or route list.
- OAuth start route: `/api/social/meta/start`
- OAuth callback route: `/api/social/meta/callback`
- Protected admin list route: `/api/social/meta/connections`
- Protected admin package route: `/api/social/meta/connections/{connection_id}?include=agent_package`
- Health/readiness route: `/api/social/meta/health`

The Slack workspace connector has been added under:

- Public client page: `/connect/slack/` — intentionally minimal: brand, one-sentence description, one `Connect Slack` button, and tiny legal links. No public token/package explanation or Slack API jargon.
- OAuth start route: `/api/slack/start`
- OAuth callback route: `/api/slack/callback`
- Protected admin list route: `/api/slack/connections`
- Protected admin package route: `/api/slack/connections/{connection_id}?include=agent_package`
- Health/readiness route: `/api/slack/health`

The HubSpot CRM connector has been added under:

- Public client page: `/connect/hubspot/` — intentionally minimal: brand, one-sentence description, one `Connect HubSpot` button, and tiny legal links. No public token/package explanation or CRM API jargon.
- OAuth start route: `/api/hubspot/start`
- OAuth callback route: `/api/hubspot/callback`
- Protected admin list route: `/api/hubspot/connections`
- Protected admin package route: `/api/hubspot/connections/{connection_id}?include=agent_package`
- Health/readiness route: `/api/hubspot/health`

The Gmail outbound/inbox connector has been added under:

- Public client page: `/connect/gmail/` — intentionally minimal: brand, one-sentence description, one `Connect Gmail` button, and tiny legal links. No public token/package explanation, workflow form, route list, or Google API jargon.
- Private admin dashboard: `/admin/connections/` — simple email/password sign-in backed by an HttpOnly admin session cookie. This is the shared private API/OAuth console for Gmail, Facebook/Instagram, Slack, HubSpot, future API/OAuth connector summaries, client-specific invite pages, and intentional copy actions for agent-ready handoff packages. The New Invite flow intentionally starts with no connector preselected; Wesley picks connectors from the Add connector bar, and unsupported tools go through the connector request agent.
- Admin login/session routes: `/api/admin/login`, `/api/admin/session`, `/api/admin/logout`
- Client invite create/list route: `/api/admin/client-invites` — protected route the admin dashboard uses after a discovery call to create a client-specific connector page with the required software tools.
- Connector request route: `/api/admin/connector-requests` — protected route the admin dashboard uses when a client needs an unsupported software/API connector. It stores the request in KV and can notify `CONNECTOR_BUILDER_WEBHOOK_URL` when configured; it does not expose secrets or blindly deploy code.
- Public client invite data route: `/api/client-invites/{invite_id}` — safe, no-secret route used by `/connect/client/?invite={invite_id}` to render only the required connector buttons for that client.
- Public client connector page: `/connect/client/?invite={invite_id}` — branded page sent to the client after Wesley chooses the required connector services in admin.
- Unified registry/list route: `/api/admin/connections` — one protected endpoint that returns connector metadata plus safe rows across every registered service.
- Unified registry/package route: `/api/admin/connections/{service}/{connection_id}?include=agent_package` — one protected detail pattern that dispatches to the service-specific package builder. Existing Gmail/Meta list/detail routes remain for compatibility.
- New connector extension point: add the service descriptor/list/read/handoff functions to `functions/api/admin/connections/_registry.mjs`, then the dashboard connector checklist, client invite page, rows, and copy-package action pick it up from the registry response.
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

A client should not share passwords, API keys, or add Wesley as a Facebook/Instagram admin. After discovery, Wesley creates a client invite in `/admin/connections/`, selects the software connectors that workflow needs, and sends the generated `/connect/client/?invite={invite_id}` link. The client sees only those required tools, then each tool sends them through its official OAuth/provider authorization screen.

The client invite page is a routing layer, not a magic universal login. Each supported app still needs a connector adapter in the registry. When a client needs an unsupported/random API, Wesley can submit a connector request from `/admin/connections/`; that stores the app/auth/API needs for the connector-builder workflow and optional Hermes webhook, then the connector still gets built/tested/deployed as code before it appears on invites.

After authorization, the callback exchanges the provider OAuth code, preserves the invite ID in OAuth state, discovers the account/assets, and stores an agent-ready package server-side. That package includes:

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

Slack handoff packages follow the same pattern for workspace alerts/approvals. Once a Slack app is configured and the client authorizes it, `/admin/connections/` lists the workspace/team summary and copy-ready package containing the bot token, scopes, team metadata, and Slack endpoint map.

HubSpot handoff packages follow the same pattern for CRM workflows. Once a HubSpot app is configured and the client authorizes it, `/admin/connections/` lists the portal summary and copy-ready package containing refresh/access credentials, granted CRM scopes, portal metadata, and HubSpot endpoint map.

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

Slack connector:

- `SLACK_CLIENT_ID` — Slack app OAuth client ID.
- `SLACK_CLIENT_SECRET` — Slack app OAuth client secret. Secret; do not commit or show in UI.
- `SLACK_REDIRECT_URI` — optional override. Use `https://clawdified.com/api/slack/callback` for the current Pages deployment.
- `SLACK_SCOPES` / `SLACK_BOT_SCOPES` — optional comma/space-separated bot scopes. Defaults to `chat:write`, `channels:read`, `groups:read`, `users:read`.
- `SLACK_CONNECTOR_STATE_SECRET`, `SLACK_CONNECTOR_ENCRYPTION_KEY`, `SLACK_CONNECTOR_ADMIN_TOKEN` — optional Slack-specific overrides; otherwise shared social connector state/encryption/admin secrets are used.
- `SOCIAL_CONNECTOR_KV` — reused Cloudflare KV binding for encrypted connection records.

HubSpot connector:

- `HUBSPOT_CLIENT_ID` — HubSpot app OAuth client ID.
- `HUBSPOT_CLIENT_SECRET` — HubSpot app OAuth client secret. Secret; do not commit or show in UI.
- `HUBSPOT_REDIRECT_URI` — optional override. Use `https://clawdified.com/api/hubspot/callback` for the current Pages deployment.
- `HUBSPOT_SCOPES` — optional comma/space-separated scopes. Defaults to `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.objects.companies.read`.
- `HUBSPOT_CONNECTOR_STATE_SECRET`, `HUBSPOT_CONNECTOR_ENCRYPTION_KEY`, `HUBSPOT_CONNECTOR_ADMIN_TOKEN` — optional HubSpot-specific overrides; otherwise shared social connector state/encryption/admin secrets are used.
- `SOCIAL_CONNECTOR_KV` — reused Cloudflare KV binding for encrypted connection records.

Optional:

- `META_GRAPH_VERSION` — defaults to `v23.0`.
- `META_SCOPES` — comma/space-separated scopes. Defaults to `public_profile` only so the Meta OAuth dialog remains valid before advanced Page/Instagram permissions are approved. After Meta App Review/business configuration, set this explicitly if using scope-based login.
- `META_LOGIN_CONFIG_ID` — optional Facebook Login for Business configuration ID. Use this when Meta requires a business-login configuration for Page/Instagram permissions instead of explicit scope query params.
- `META_REDIRECT_URI` — override callback URL if Meta uses a non-default route.
- `SOCIAL_CONNECTOR_BASE_URL` — override public origin if needed.
- `CONNECTOR_BUILDER_WEBHOOK_URL` — optional Hermes/webhook endpoint to notify when the admin dashboard stores a new unsupported connector request.
- `CONNECTOR_BUILDER_WEBHOOK_TOKEN` — optional bearer token sent only server-to-server to the connector-builder webhook; never shown in dashboard responses.

## Current production verification — 2026-05-26

Verified with Cloudflare/Wrangler smoke checks:

- Cloudflare Pages project: `clawdifiedweb` (`Git Provider: No`; production deploys are manual Wrangler deploys from a clean committed archive).
- Live admin dashboard page: `https://clawdified.com/admin/connections/` — returns `200` and includes the New Invite connector picker (`connectorPicker`, `Add connector`, and `Nothing is preselected`) instead of the old prechecked Gmail/four-checkbox block.
- Latest Pages preview URL is visible in `wrangler pages deployment list --project-name=clawdifiedweb`; do not hardcode it here because each documentation-only redeploy creates a new immutable preview URL.
- Live `/api/admin/connections` rejects unauthenticated requests with `401`.
- Live `/api/admin/connector-requests` rejects unauthenticated requests with `401`.
- Live Slack connector page: `https://clawdified.com/connect/slack/`.
- Live HubSpot connector page: `https://clawdified.com/connect/hubspot/`.
- Existing live social connector page remains: `https://clawdified.com/connect/social/`.
- Existing live Gmail connector page remains: `https://clawdified.com/connect/gmail/`.
- Live private admin dashboard still uses `/api/admin/login` + an HttpOnly session cookie. Protected list/package endpoints preserve bearer-token compatibility for server-side/agent retrieval.
- Meta app redirect URI is saved under Facebook Login settings: `https://clawdified.com/api/social/meta/callback`.
- Google OAuth client redirect URIs include `https://clawdified.com/api/oauth/google/callback` and the earlier `https://app.clawdified.com/api/oauth/google/callback`.
- Meta Publish screen is not publishable yet: business portfolio `Wesley Taylor` is unverified, and the final Publish button is disabled.
- Default Meta OAuth still requests `public_profile` only; full Facebook Page + Instagram connector permissions still require Meta Business Login/App Review setup via either explicit `META_SCOPES` after approval or `META_LOGIN_CONFIG_ID`.

## Safety rules

- Do not commit app secrets, access tokens, admin bearer tokens, OAuth refresh tokens, ID tokens, or raw connection packages.
- Do not expose tokens in client-visible pages or browser console logs.
- Do not send clients through `/connect/social/` unless `/api/social/meta/health` returns `ok: true`.
- Do not send clients through `/connect/gmail/` unless `/api/oauth/google/health` returns `ok: true`.
- Do not send clients through `/connect/slack/` unless `/api/slack/health` returns `ok: true`.
- Do not send clients through `/connect/hubspot/` unless `/api/hubspot/health` returns `ok: true`.
- A connector request saved from the dashboard is a build request, not a guarantee that the app is available to clients; the connector still needs tests, code review, provider credentials, and deployment.
- Gmail `gmail.modify` is a restricted Google scope. Google may require app verification and a security assessment before broad third-party production use.
- Publishing the Cloudflare code is separate from Meta app live mode / App Review and Google OAuth app verification. Both platforms may still require business verification, permission/scope review, screencasts, and valid use-case documentation before third-party production use.

## Verification commands

```bash
node --test test/*.mjs
node --check functions/api/admin/client-invites/index.js
node --check functions/api/admin/client-invites/_shared.mjs
node --check 'functions/api/client-invites/[id].js'
node --check functions/api/admin/connector-requests/index.js
node --check functions/api/admin/connections/index.js
node --check 'functions/api/admin/connections/[service]/[id].js'
node --check functions/api/admin/connections/_registry.mjs
node --check functions/api/social/meta/start.js
node --check functions/api/social/meta/callback.js
node --check functions/api/social/meta/health.js
node --check functions/api/social/meta/connections/index.js
node --check 'functions/api/social/meta/connections/[id].js'
node --check functions/api/slack/_shared.mjs
node --check functions/api/slack/start.js
node --check functions/api/slack/callback.js
node --check functions/api/slack/health.js
node --check functions/api/slack/connections/index.js
node --check 'functions/api/slack/connections/[id].js'
node --check functions/api/hubspot/_shared.mjs
node --check functions/api/hubspot/start.js
node --check functions/api/hubspot/callback.js
node --check functions/api/hubspot/health.js
node --check functions/api/hubspot/connections/index.js
node --check 'functions/api/hubspot/connections/[id].js'
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
