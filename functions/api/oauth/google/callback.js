import {
  buildAgentPackage,
  callbackUrl,
  clean,
  collectGoogleAccount,
  exchangeCodeForTokens,
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
      'The Clawdified Gmail connector is deployed, but the backend secrets/storage are not fully configured yet.',
      ready.missing,
    );
  }

  const url = new URL(request.url);
  const googleError = clean(url.searchParams.get('error_description') || url.searchParams.get('error') || '', 700);
  if (googleError) {
    return errorResponse(request, 400, 'Google authorization was not completed', googleError);
  }

  const code = clean(url.searchParams.get('code') || '', 4000);
  const state = clean(url.searchParams.get('state') || '', 6000);
  if (!code || !state) {
    return errorResponse(request, 400, 'Missing OAuth callback data', 'Google did not return both a code and state value. Start again from the Gmail connector page.');
  }

  let statePayload;
  try {
    statePayload = await verifySignedState(state, stateSecretFromEnv(env));
  } catch (err) {
    return errorResponse(request, 400, 'OAuth state check failed', err.message || 'Invalid OAuth state. Start again from the Gmail connector page.');
  }

  const redirectUri = statePayload.redirect_uri || callbackUrl(request, env);
  const connectionId = crypto.randomUUID();

  try {
    const tokenPayload = await exchangeCodeForTokens({ code, redirectUri, env });
    const account = await collectGoogleAccount({ accessToken: tokenPayload.access_token });
    const fullAgentPackage = buildAgentPackage({
      connectionId,
      client: statePayload,
      tokenPayload,
      account,
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
      returnTo: statePayload.return_to || '/connect/gmail/',
    }));
  } catch (err) {
    return errorResponse(
      request,
      err?.status || 500,
      'Could not finish Gmail connector setup',
      clean(err?.message || 'The OAuth callback reached Clawdified, but token exchange or Gmail account lookup failed.', 700),
      ['No token was displayed publicly.', 'Try again after confirming the Google OAuth client secret, redirect URI, Gmail API, and Cloudflare secrets.'],
    );
  }
}
