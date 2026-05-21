import {
  authorizedAdmin,
  json,
  readConnectionForService,
} from '../_registry.mjs';

export async function onRequestGet(context) {
  const { request, env, params = {} } = context;
  if (!(await authorizedAdmin(request, env))) {
    return json({ ok: false, error: 'Unauthorized.' }, 401, {
      'WWW-Authenticate': 'Bearer realm="clawdified-client-connections"',
    });
  }

  const url = new URL(request.url);
  const include = String(url.searchParams.get('include') || '').toLowerCase();
  const includeSecrets = include === 'agent_package' || include === 'true' || url.searchParams.get('include_agent_package') === '1';
  const result = await readConnectionForService({
    env,
    origin: url.origin,
    service: params.service || '',
    connectionId: params.id || '',
    includeSecrets,
  });

  return json(result.body, result.status);
}
