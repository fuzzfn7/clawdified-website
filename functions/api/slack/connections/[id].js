import {
  authorizedAdmin,
  buildAgentHandoff,
  clean,
  json,
  readConnection,
  readiness,
} from '../_shared.mjs';

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const ready = readiness(env, { requireAdmin: true });
  if (!ready.ok) {
    return json({
      ok: false,
      error: 'Slack connector admin API is not fully configured.',
      missing_config: ready.missing,
    }, 503);
  }

  if (!(await authorizedAdmin(request, env))) {
    return json({ ok: false, error: 'Unauthorized.' }, 401, {
      'WWW-Authenticate': 'Bearer realm="clawdified-slack-connector"',
    });
  }

  const connectionId = clean(params.id || '', 120);
  if (!connectionId) return json({ ok: false, error: 'Connection ID is required.' }, 400);

  const include = clean(new URL(request.url).searchParams.get('include') || '', 120).toLowerCase();
  const includeSecrets = include === 'agent_package' || include === 'secrets' || include === 'tokens';
  const record = await readConnection({ env, connectionId, includeSecrets });
  if (!record) return json({ ok: false, error: 'Connection not found.' }, 404);

  return json({
    ...record,
    agent_handoff: includeSecrets ? buildAgentHandoff(record.agent_package, { origin: new URL(request.url).origin }) : null,
    includes_sensitive_tokens: includeSecrets,
    warning: includeSecrets
      ? 'This response contains Slack OAuth credentials. Do not paste it into public chats, browser UIs, or client-visible docs.'
      : 'Tokens are redacted. Add ?include=agent_package with the admin bearer token to retrieve the full server-side package.',
  });
}
