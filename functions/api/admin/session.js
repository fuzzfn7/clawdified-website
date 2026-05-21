import {
  adminLoginReadiness,
  json,
  verifyAdminSessionFromRequest,
} from './_auth.mjs';

export async function onRequestGet(context) {
  const { request, env } = context;
  const readiness = adminLoginReadiness(env);
  const session = await verifyAdminSessionFromRequest(request, env);

  return json({
    ok: true,
    configured: readiness.ok,
    authenticated: session.ok,
    email: session.ok ? session.email : null,
    expires_at: session.ok ? session.expires_at : null,
    login: {
      email_configured: readiness.email_configured,
      password_configured: readiness.password_configured,
      session_secret_configured: readiness.session_secret_configured,
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return json({ ok: false, error: 'Method not allowed.' }, 405, {
    Allow: 'GET',
  });
}
