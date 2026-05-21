import {
  createAdminSessionCookie,
  json,
  verifyAdminCredentials,
} from './_auth.mjs';

async function readJson(request) {
  try {
    return await request.json();
  } catch (_err) {
    return {};
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await readJson(request);
  const result = verifyAdminCredentials({
    env,
    email: body?.email || '',
    password: body?.password || '',
  });

  if (!result.ok) {
    const status = result.error === 'Admin login is not configured.' ? 503 : 401;
    return json({ ok: false, authenticated: false, error: result.error }, status);
  }

  const cookie = await createAdminSessionCookie({ env, email: result.email });
  return json({ ok: true, authenticated: true, email: result.email }, 200, {
    'Set-Cookie': cookie,
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ ok: false, error: 'Method not allowed.' }, 405, {
    Allow: 'POST',
  });
}
