import {
  authorizedAdmin,
  clean,
  json,
  listConnections,
  readiness,
} from '../_shared.mjs';

export async function onRequestGet(context) {
  const { request, env } = context;
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

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') || 100);
  const cursor = clean(url.searchParams.get('cursor') || '', 500);
  const origin = url.origin;
  const result = await listConnections({ env, origin, limit, cursor });

  return json({
    ...result,
    includes_sensitive_tokens: false,
    warning: 'Dashboard rows are safe summaries. Use a row detail/package action to retrieve the sensitive Slack agent handoff package intentionally.',
  });
}
