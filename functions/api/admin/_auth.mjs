const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const SESSION_COOKIE = 'clawdified_admin_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

export function clean(value, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function bytesToBinary(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return binary;
}

function binaryToBytes(binary) {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(value) {
  const bytes = typeof value === 'string' ? textEncoder.encode(value) : new Uint8Array(value);
  return btoa(bytesToBinary(bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecodeToString(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return textDecoder.decode(binaryToBytes(atob(padded)));
}

function safeEqual(a, b) {
  const left = textEncoder.encode(String(a || ''));
  const right = textEncoder.encode(String(b || ''));
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(message));
  return base64UrlEncode(signature);
}

export function adminEmailFromEnv(env = {}) {
  return clean(
    env.CLAWDIFIED_ADMIN_EMAIL
      || env.GMAIL_CONNECTOR_ADMIN_EMAIL
      || env.GOOGLE_CONNECTOR_ADMIN_EMAIL
      || env.ADMIN_EMAIL
      || '',
    320,
  ).toLowerCase();
}

export function adminPasswordFromEnv(env = {}) {
  const value = env.CLAWDIFIED_ADMIN_PASSWORD
    || env.GMAIL_CONNECTOR_ADMIN_PASSWORD
    || env.GOOGLE_CONNECTOR_ADMIN_PASSWORD
    || env.ADMIN_PASSWORD
    || env.GMAIL_CONNECTOR_ADMIN_TOKEN
    || env.GOOGLE_CONNECTOR_ADMIN_TOKEN
    || env.SOCIAL_CONNECTOR_ADMIN_TOKEN
    || '';
  return String(value || '').trim().slice(0, 5000);
}

export function adminSessionSecretFromEnv(env = {}) {
  const value = env.CLAWDIFIED_ADMIN_SESSION_SECRET
    || env.GMAIL_CONNECTOR_ADMIN_SESSION_SECRET
    || env.ADMIN_SESSION_SECRET
    || env.GMAIL_CONNECTOR_STATE_SECRET
    || env.SOCIAL_CONNECTOR_STATE_SECRET
    || env.GMAIL_CONNECTOR_ENCRYPTION_KEY
    || env.SOCIAL_CONNECTOR_ENCRYPTION_KEY
    || env.GMAIL_CONNECTOR_ADMIN_TOKEN
    || env.SOCIAL_CONNECTOR_ADMIN_TOKEN
    || adminPasswordFromEnv(env);
  return String(value || '').trim().slice(0, 5000);
}

export function adminLoginReadiness(env = {}) {
  return {
    ok: Boolean(adminPasswordFromEnv(env) && adminSessionSecretFromEnv(env)),
    email_configured: Boolean(adminEmailFromEnv(env)),
    password_configured: Boolean(adminPasswordFromEnv(env)),
    session_secret_configured: Boolean(adminSessionSecretFromEnv(env)),
  };
}

export function normalizeLoginEmail(value) {
  return clean(value, 320).toLowerCase();
}

export function verifyAdminCredentials({ env = {}, email = '', password = '' } = {}) {
  const configuredEmail = adminEmailFromEnv(env);
  const configuredPassword = adminPasswordFromEnv(env);
  const suppliedEmail = normalizeLoginEmail(email);
  const suppliedPassword = String(password || '');

  if (!configuredPassword) return { ok: false, error: 'Admin login is not configured.' };
  if (!suppliedEmail || !suppliedEmail.includes('@')) return { ok: false, error: 'Enter a valid email address.' };
  if (configuredEmail && !safeEqual(suppliedEmail, configuredEmail)) {
    return { ok: false, error: 'Incorrect email or password.' };
  }
  if (!safeEqual(suppliedPassword, configuredPassword)) {
    return { ok: false, error: 'Incorrect email or password.' };
  }
  return { ok: true, email: configuredEmail || suppliedEmail };
}

function cookieAttributes({ maxAge = SESSION_TTL_SECONDS } = {}) {
  return [
    `${SESSION_COOKIE}=`,
    `Path=/`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ];
}

export async function createAdminSessionCookie({ env = {}, email = '' } = {}) {
  const secret = adminSessionSecretFromEnv(env);
  if (!secret) throw new Error('Admin session secret is not configured.');
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    email: normalizeLoginEmail(email),
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSha256(secret, body);
  const parts = cookieAttributes({ maxAge: SESSION_TTL_SECONDS });
  parts[0] = `${SESSION_COOKIE}=${body}.${signature}`;
  return parts.join('; ');
}

export function expiredAdminSessionCookie() {
  const parts = cookieAttributes({ maxAge: 0 });
  parts[0] = `${SESSION_COOKIE}=`;
  return parts.join('; ');
}

function parseCookieHeader(header = '') {
  const cookies = new Map();
  String(header || '').split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index === -1) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies.set(key, value);
  });
  return cookies;
}

export async function verifyAdminSessionFromRequest(request, env = {}) {
  const secret = adminSessionSecretFromEnv(env);
  if (!secret) return { ok: false };
  const cookie = parseCookieHeader(request.headers.get('Cookie') || '').get(SESSION_COOKIE);
  if (!cookie) return { ok: false };
  const [body, signature] = String(cookie).split('.');
  if (!body || !signature) return { ok: false };
  const expected = await hmacSha256(secret, body);
  if (!safeEqual(signature, expected)) return { ok: false };
  let payload;
  try {
    payload = JSON.parse(base64UrlDecodeToString(body));
  } catch (_err) {
    return { ok: false };
  }
  const now = Math.floor(Date.now() / 1000);
  if (!payload?.exp || Number(payload.exp) < now) return { ok: false };
  const configuredEmail = adminEmailFromEnv(env);
  const email = normalizeLoginEmail(payload.email || '');
  if (!email) return { ok: false };
  if (configuredEmail && !safeEqual(email, configuredEmail)) return { ok: false };
  return { ok: true, email: configuredEmail || email, expires_at: new Date(Number(payload.exp) * 1000).toISOString() };
}
