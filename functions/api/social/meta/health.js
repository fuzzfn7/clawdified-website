import {
  appIdFromEnv,
  callbackUrl,
  graphVersion,
  json,
  readiness,
  scopesFromEnv,
} from './_shared.mjs';

export async function onRequestGet(context) {
  const { request, env } = context;
  const ready = readiness(env, { requireAdmin: true });
  const origin = new URL(request.url).origin;
  return json({
    ok: ready.ok,
    endpoint: '/api/social/meta/health',
    app_id: appIdFromEnv(env),
    graph_version: graphVersion(env),
    redirect_uri: callbackUrl(request, env),
    requested_scopes: scopesFromEnv(env),
    configured: {
      app_id: ready.app_id_configured,
      app_secret: ready.app_secret_configured,
      state_secret: ready.state_secret_configured,
      encryption_key: ready.encryption_key_configured,
      admin_token: ready.admin_token_configured,
      kv_binding: ready.kv_configured,
    },
    missing_config: ready.missing,
    routes: {
      connector_page: `${origin}/connect/social/`,
      start_oauth: `${origin}/api/social/meta/start`,
      callback: `${origin}/api/social/meta/callback`,
      admin_connection_lookup: `${origin}/api/social/meta/connections/{connection_id}?include=agent_package`,
    },
    production_note: 'Clients should only be sent through /connect/social/ after ok=true. App Review/business verification may still gate third-party production permissions in Meta.',
  }, ready.ok ? 200 : 503);
}
