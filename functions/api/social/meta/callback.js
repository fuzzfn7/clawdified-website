import {
  buildAgentPackage,
  callbackUrl,
  clean,
  collectMetaAssets,
  exchangeCodeForLongLivedToken,
  html,
  json,
  persistConnection,
  readiness,
  redactTokens,
  renderErrorPage,
  renderSuccessPage,
  stateSecretFromEnv,
  verifySignedState,
} from './_shared.mjs';

function wantsJson(request) {
  const accept = request.headers.get('Accept') || '';
  return accept.includes('application/json');
}

function errorResponse(request, status, title, message, details = []) {
  if (wantsJson(request)) return json({ ok: false, error: title, message, details }, status);
  return html(renderErrorPage({ title, message, details }), status);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const ready = readiness(env);
  if (!ready.ok) {
    return errorResponse(
      request,
      503,
      'Connector setup incomplete',
      'The Clawdified social connector is deployed, but the backend secrets/storage are not fully configured yet.',
      ready.missing,
    );
  }

  const url = new URL(request.url);
  const metaError = clean(url.searchParams.get('error_description') || url.searchParams.get('error_message') || url.searchParams.get('error') || '', 500);
  if (metaError) {
    return errorResponse(request, 400, 'Meta authorization was not completed', metaError);
  }

  const code = clean(url.searchParams.get('code') || '', 4000);
  const state = clean(url.searchParams.get('state') || '', 6000);
  if (!code || !state) {
    return errorResponse(request, 400, 'Missing OAuth callback data', 'Meta did not return both a code and state value. Start again from the connector page.');
  }

  let statePayload;
  try {
    statePayload = await verifySignedState(state, stateSecretFromEnv(env));
  } catch (err) {
    return errorResponse(request, 400, 'OAuth state check failed', err.message || 'Invalid OAuth state. Start again from the connector page.');
  }

  const redirectUri = statePayload.redirect_uri || callbackUrl(request, env);
  const connectionId = crypto.randomUUID();

  try {
    const tokenPayload = await exchangeCodeForLongLivedToken({ code, redirectUri, env });
    const assets = await collectMetaAssets({ userAccessToken: tokenPayload.long_lived.access_token, env });
    const fullAgentPackage = buildAgentPackage({
      connectionId,
      client: statePayload,
      tokenPayload,
      assets,
      env,
      redirectUri,
    });
    const publicPackage = redactTokens(fullAgentPackage);
    await persistConnection({ env, connectionId, publicPackage, fullAgentPackage });

    if (wantsJson(request)) {
      return json({
        ok: true,
        connection_id: connectionId,
        agent_package: publicPackage,
        tokens: '[stored-server-side]',
      });
    }

    return html(renderSuccessPage({
      connectionId,
      publicPackage,
      returnTo: statePayload.return_to || '/connect/social/',
    }));
  } catch (err) {
    return errorResponse(
      request,
      err?.status || 500,
      'Could not finish Meta connector setup',
      clean(err?.message || 'The OAuth callback reached Clawdified, but token exchange or asset discovery failed.', 700),
      ['No token was displayed publicly.', 'Try again after confirming the Meta app permissions, redirect URI, and Cloudflare secrets.'],
    );
  }
}
