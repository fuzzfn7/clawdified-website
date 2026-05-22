import { json, readiness, scopesFromEnv } from './_shared.mjs';

export async function onRequestGet(context) {
  const { env } = context;
  const ready = readiness(env, { requireAdmin: false });
  return json({
    ok: ready.ok,
    service: 'slack',
    connector: 'Slack',
    missing_config: ready.missing,
    bot_scopes: scopesFromEnv(env),
    includes_sensitive_tokens: false,
  }, ready.ok ? 200 : 503);
}
