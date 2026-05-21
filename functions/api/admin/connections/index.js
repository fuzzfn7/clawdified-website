import {
  authorizedAdmin,
  clean,
  json,
  listAllConnections,
} from './_registry.mjs';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await authorizedAdmin(request, env))) {
    return json({ ok: false, error: 'Unauthorized.' }, 401, {
      'WWW-Authenticate': 'Bearer realm="clawdified-client-connections"',
    });
  }

  const url = new URL(request.url);
  const result = await listAllConnections({
    env,
    origin: url.origin,
    limit: Number(url.searchParams.get('limit') || 100),
    cursor: clean(url.searchParams.get('cursor') || '', 500),
    service: clean(url.searchParams.get('service') || '', 80),
  });

  const status = result.ok ? 200 : 404;
  return json({
    ...result,
    includes_sensitive_tokens: false,
    warning: 'This is the unified Clawdified client API/OAuth registry. Rows are dashboard-safe summaries; detail/package routes must be called intentionally for sensitive handoff data.',
  }, status);
}
