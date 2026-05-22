import {
  buildAgentPackage,
  callbackUrl,
  clean,
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
      'The Clawdified Slack connector is deployed, but backend secrets/storage are not fully configured yet.',
      ready.missing,
    );
  }

  const url = new URL(request.url);
  const slackError = clean(url.searchParams.get('error_description') || url.searchParams.get('error') || '', 700);
  if (slackError) {
    return errorResponse(request, 400, 'Slack authorization was not completed', slackError);
  }

  const code = clean(url.searchParams.get('code') || '', 4000);
  const state = clean(url.searchParams.get('state') || '', 6000);
  if (!code || !state) {
    return errorResponse(request, 400, 'Missing OAuth callback data', 'Slack did not return both a code and state value. Start again from the Slack connector page.');
  }

  let statePayload;
  try {
    statePayload = await verifySignedState(state, stateSecretFromEnv(env));
  } catch (err) {
    return errorResponse(request, 400, 'OAuth state check failed', err.message || 'Invalid OAuth state. Start again from the Slack connector page.');
  }

  const redirectUri = statePayload.redirect_uri || callbackUrl(request, env);
  const connectionId = `slack_${crypto.randomUUID()}`;

  try {
    const tokenPayload = await exchangeCodeForTokens({ code, redirectUri, env });
    const fullAgentPackage = buildAgentPackage({
      connectionId,
      client: statePayload,
      tokenPayload,
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
      returnTo: statePayload.return_to || '/connect/slack/',
    }));
  } catch (err) {
    return errorResponse(
      request,
      err?.status || 500,
      'Could not finish Slack connector setup',
      clean(err?.message || 'The OAuth callback reached Clawdified, but token exchange failed.', 700),
      ['No token was displayed publicly.', 'Try again after confirming the Slack app client secret, redirect URI, scopes, and Cloudflare secrets.'],
    );
  }
}
