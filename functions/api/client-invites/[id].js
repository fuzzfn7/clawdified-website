import {
  json,
  publicClientInvitePackage,
} from '../admin/client-invites/_shared.mjs';

export async function onRequestGet(context) {
  const { request, env, params = {} } = context;
  const url = new URL(request.url);
  const result = await publicClientInvitePackage({
    env,
    origin: url.origin,
    inviteId: params.id || '',
  });
  return json(result.body, result.status);
}
