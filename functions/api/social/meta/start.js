import {
  buildAuthUrl,
  createSignedState,
  json,
  readiness,
  stateSecretFromEnv,
} from './_shared.mjs';

export async function onRequestGet(context) {
  const { request, env } = context;
  const ready = readiness(env);
  if (!ready.ok) {
    return json({
      ok: false,
      error: 'Social connector backend is not fully configured yet.',
      missing_config: ready.missing,
      next_step: 'Set the required Cloudflare Pages secrets/bindings before sending clients through OAuth.',
    }, 503);
  }

  const url = new URL(request.url);
  const { url: authUrl, statePayload } = buildAuthUrl({
    request,
    env,
    client: url.searchParams.get('client') || url.searchParams.get('business') || '',
    workflow: url.searchParams.get('workflow') || url.searchParams.get('notes') || '',
    invite: url.searchParams.get('invite') || url.searchParams.get('invite_id') || '',
    returnTo: url.searchParams.get('return_to') || '/connect/social/',
  });

  const state = await createSignedState(statePayload, stateSecretFromEnv(env));
  authUrl.searchParams.set('state', state);

  return Response.redirect(authUrl.toString(), 302);
}
