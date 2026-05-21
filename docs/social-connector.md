# Clawdified Social Connector

## Executive answer

Before this implementation, the Clawdified public site had legal pages mentioning a Meta/Facebook connector, but it did **not** have a working OAuth connector. A client could not click a Clawdified link, authorize Facebook/Instagram, and produce the agent-ready data package.

This implementation adds the missing OAuth surface and server-side package route.

## Client flow

1. Client opens `https://clawdified.com/connect/social/`.
2. Client enters their business name/workflow notes.
3. Client clicks **Connect Facebook + Instagram**.
4. Clawdified redirects to Meta OAuth using the `Clawdified Social Connector` app.
5. Client logs into Meta themselves and approves the assets/scopes.
6. Meta redirects to `https://clawdified.com/api/social/meta/callback`.
7. Clawdified exchanges the OAuth code for a long-lived token, discovers Pages and linked Instagram accounts, encrypts the full agent package, and stores it in Cloudflare KV.
8. Client sees a success page with a connection ID. No tokens are displayed.
9. Wesley or the runtime agent retrieves the full package from the protected endpoint using the server-side admin bearer token.

## Agent package fields

The protected package includes:

- `connection_id`
- `meta_app.app_id`
- `meta_app.graph_version`
- `oauth.user_access_token`
- `oauth.granted_scopes`
- `oauth.debug`
- `facebook_user`
- `businesses`
- `pages[].facebook_page_id`
- `pages[].page_access_token`
- `pages[].instagram_business_account_id`
- `pages[].instagram_username`
- `pages[].endpoints`
- `required_for_outreach_agent` booleans showing whether Page tokens, Page IDs, Instagram IDs, and scopes were captured

## Important clarification

Clients do not give Clawdified their own API keys. The only app-level keys belong to the Clawdified Meta Developer app. Clients authorize access through OAuth; Clawdified receives access tokens and account identifiers for the assets they grant.

## Required deployment setup

Cloudflare Pages must have:

- `META_APP_ID`
- `META_APP_SECRET`
- `SOCIAL_CONNECTOR_STATE_SECRET`
- `SOCIAL_CONNECTOR_ENCRYPTION_KEY`
- `SOCIAL_CONNECTOR_ADMIN_TOKEN`
- KV binding `SOCIAL_CONNECTOR_KV`

Meta must have this redirect URI configured:

```text
https://clawdified.com/api/social/meta/callback
```

Meta app review/business verification may still be required for real third-party client use, especially for messaging/business permissions.

## Admin retrieval

```bash
curl -H "Authorization: Bearer $SOCIAL_CONNECTOR_ADMIN_TOKEN" \
  "https://clawdified.com/api/social/meta/connections/<connection_id>?include=agent_package"
```

The response includes sensitive OAuth/Page tokens. Do not paste it into public chats, client-visible docs, browser UIs, or source files.

## Public-safe health check

```bash
curl https://clawdified.com/api/social/meta/health
```

`ok: true` means the connector can be sent to clients. `ok: false` lists missing secret/binding names only, never secret values.
