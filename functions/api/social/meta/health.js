import {
  appIdFromEnv,
  callbackUrl,
  graphVersion,
  json,
  loginConfigIdFromEnv,
  readiness,
  scopesFromEnv,
} from './_shared.mjs';

export async function onRequestGet(context) {
  const { request, env } = context;
  const ready = readiness(env, { requireAdmin: true });
  const origin = new URL(request.url).origin;
  const loginConfigId = loginConfigIdFromEnv(env);
  const requestedScopes = scopesFromEnv(env);
  return json({
    ok: ready.ok,
    endpoint: '/api/social/meta/health',
    app_id: appIdFromEnv(env),
    graph_version: graphVersion(env),
    redirect_uri: callbackUrl(request, env),
    requested_scopes: requestedScopes,
    auth_mode: loginConfigId ? 'facebook_login_for_business_config' : 'explicit_scopes',
    login_config_id_configured: Boolean(loginConfigId),
    advanced_scopes_explicitly_configured: Boolean(env.META_SCOPES || env.FACEBOOK_SCOPES || loginConfigId),
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
    production_note: loginConfigId || requestedScopes.length > 1
      ? 'Advanced Meta Page/Instagram scopes are being requested. Meta App Review, business verification, or a Facebook Login for Business configuration may still gate third-party production use.'
      : 'Default OAuth requests public_profile only so the Meta dialog stays valid. Configure META_SCOPES or META_LOGIN_CONFIG_ID after Meta approves Page/Instagram permissions.',
  }, ready.ok ? 200 : 503);
}
