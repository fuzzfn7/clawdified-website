import { authorizedAdmin } from '../connections/_registry.mjs';
import {
  clean,
  createClientInvite,
  json,
  listClientInvites,
  parseJsonRequest,
} from './_shared.mjs';

function unauthorized() {
  return json({ ok: false, error: 'Unauthorized.' }, 401, {
    'WWW-Authenticate': 'Bearer realm="clawdified-client-invites"',
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await authorizedAdmin(request, env))) return unauthorized();

  const url = new URL(request.url);
  const result = await listClientInvites({
    env,
    origin: url.origin,
    limit: Number(url.searchParams.get('limit') || 100),
  });
  return json(result.body, result.status);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await authorizedAdmin(request, env))) return unauthorized();

  let body;
  try {
    body = await parseJsonRequest(request);
  } catch (err) {
    return json({ ok: false, error: clean(err?.message || 'Invalid JSON.', 300) }, err?.status || 400);
  }

  const url = new URL(request.url);
  const result = await createClientInvite({ env, origin: url.origin, body });
  return json(result.body, result.status);
}
