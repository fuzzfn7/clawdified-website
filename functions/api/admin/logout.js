import {
  expiredAdminSessionCookie,
  json,
} from './_auth.mjs';

export async function onRequestPost() {
  return json({ ok: true, authenticated: false }, 200, {
    'Set-Cookie': expiredAdminSessionCookie(),
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ ok: false, error: 'Method not allowed.' }, 405, {
    Allow: 'POST',
  });
}
