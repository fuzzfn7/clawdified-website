import {
  callbackUrl,
  clientIdFromEnv,
  json,
  readiness,
  scopesFromEnv,
} from './_shared.mjs';

export async function onRequestGet(context) {
  const { request, env } = context;
  const ready = readiness(env, { requireAdmin: true });
  const origin = new URL(request.url).origin;
  const requestedScopes = scopesFromEnv(env);
  return json({
    ok: ready.ok,
    endpoint: '/api/oauth/google/health',
    client_id: clientIdFromEnv(env),
    redirect_uri: callbackUrl(request, env),
    requested_scopes: requestedScopes,
    configured: {
      client_id: ready.client_id_configured,
      client_secret: ready.client_secret_configured,
      state_secret: ready.state_secret_configured,
      encryption_key: ready.encryption_key_configured,
      admin_token: ready.admin_token_configured,
      kv_binding: ready.kv_configured,
    },
    missing_config: ready.missing,
    routes: {
      connector_page: `${origin}/connect/gmail/`,
      start_oauth: `${origin}/api/oauth/google/start`,
      callback: `${origin}/api/oauth/google/callback`,
      admin_connection_lookup: `${origin}/api/oauth/google/connections/{connection_id}?include=agent_package`,
    },
    production_note: requestedScopes.includes('https://www.googleapis.com/auth/gmail.modify')
      ? 'gmail.modify is a restricted Gmail scope. Google may require app verification and a security assessment before broad third-party production use.'
      : 'Outbound-only Gmail send access is less invasive than inbox modify access, but Google OAuth policy still applies.',
  }, ready.ok ? 200 : 503);
}
