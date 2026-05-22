import { verifyAdminSessionFromRequest } from '../admin/_auth.mjs';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export const DEFAULT_SLACK_SCOPES = ['chat:write', 'channels:read', 'groups:read', 'users:read'];

const STATE_TTL_MS = 20 * 60 * 1000;
const CONNECTION_KEY_PREFIX = 'slack-connection:';
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

export function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function clean(value, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function nowIso() {
  return new Date().toISOString();
}

export function clientIdFromEnv(env = {}) {
  return clean(env.SLACK_CLIENT_ID || '', 200);
}

export function clientSecretFromEnv(env = {}) {
  return clean(env.SLACK_CLIENT_SECRET || '', 5000);
}

export function stateSecretFromEnv(env = {}) {
  return clean(env.SLACK_CONNECTOR_STATE_SECRET || env.SOCIAL_CONNECTOR_STATE_SECRET || env.SLACK_CLIENT_SECRET || '', 5000);
}

export function encryptionSecretFromEnv(env = {}) {
  return clean(env.SLACK_CONNECTOR_ENCRYPTION_KEY || env.SOCIAL_CONNECTOR_ENCRYPTION_KEY || '', 5000);
}

export function adminTokenFromEnv(env = {}) {
  return clean(env.SLACK_CONNECTOR_ADMIN_TOKEN || env.SOCIAL_CONNECTOR_ADMIN_TOKEN || '', 5000);
}

export function scopesFromEnv(env = {}) {
  const raw = clean(env.SLACK_SCOPES || env.SLACK_BOT_SCOPES || '', 2000);
  if (!raw) return DEFAULT_SLACK_SCOPES;
  return raw.split(/[\s,]+/).map((scope) => clean(scope, 120)).filter(Boolean);
}

export function getOrigin(request, env = {}) {
  const configured = clean(env.SLACK_CONNECTOR_BASE_URL || env.SOCIAL_CONNECTOR_BASE_URL || env.PUBLIC_BASE_URL || '', 300).replace(/\/+$/, '');
  if (configured) return configured;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function callbackUrl(request, env = {}) {
  const configured = clean(env.SLACK_REDIRECT_URI || '', 500);
  if (configured) return configured;
  return `${getOrigin(request, env)}/api/slack/callback`;
}

export function hasKv(env = {}) {
  return Boolean(env.SOCIAL_CONNECTOR_KV && typeof env.SOCIAL_CONNECTOR_KV.get === 'function' && typeof env.SOCIAL_CONNECTOR_KV.put === 'function');
}

export function readiness(env = {}, { requireAdmin = false } = {}) {
  const missing = [];
  if (!clientIdFromEnv(env)) missing.push('SLACK_CLIENT_ID');
  if (!clientSecretFromEnv(env)) missing.push('SLACK_CLIENT_SECRET');
  if (!stateSecretFromEnv(env)) missing.push('SLACK_CONNECTOR_STATE_SECRET or SOCIAL_CONNECTOR_STATE_SECRET');
  if (!encryptionSecretFromEnv(env)) missing.push('SLACK_CONNECTOR_ENCRYPTION_KEY or SOCIAL_CONNECTOR_ENCRYPTION_KEY');
  if (!hasKv(env)) missing.push('SOCIAL_CONNECTOR_KV binding');
  if (requireAdmin && !adminTokenFromEnv(env)) missing.push('SLACK_CONNECTOR_ADMIN_TOKEN or SOCIAL_CONNECTOR_ADMIN_TOKEN');
  return {
    ok: missing.length === 0,
    missing,
    client_id_configured: Boolean(clientIdFromEnv(env)),
    client_secret_configured: Boolean(clientSecretFromEnv(env)),
    state_secret_configured: Boolean(stateSecretFromEnv(env)),
    encryption_key_configured: Boolean(encryptionSecretFromEnv(env)),
    admin_token_configured: Boolean(adminTokenFromEnv(env)),
    kv_configured: hasKv(env),
  };
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

export function base64UrlEncode(value) {
  const bytes = typeof value === 'string' ? textEncoder.encode(value) : new Uint8Array(value);
  return btoa(bytesToBinary(bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlDecodeToBytes(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  return binaryToBytes(atob(padded));
}

export function base64UrlDecodeToString(value) {
  return textDecoder.decode(base64UrlDecodeToBytes(value));
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

function safeEqual(a, b) {
  const left = textEncoder.encode(String(a || ''));
  const right = textEncoder.encode(String(b || ''));
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

export async function createSignedState(payload, secret) {
  if (!secret) throw new Error('Missing state secret');
  const body = base64UrlEncode(JSON.stringify({ ...payload, issued_at: Date.now() }));
  const signature = await hmacSha256(secret, body);
  return `${body}.${signature}`;
}

export async function verifySignedState(state, secret, { now = Date.now(), ttlMs = STATE_TTL_MS } = {}) {
  if (!secret) throw new Error('Missing state secret');
  const [body, signature] = String(state || '').split('.');
  if (!body || !signature) throw new Error('Invalid OAuth state');
  const expected = await hmacSha256(secret, body);
  if (!safeEqual(signature, expected)) throw new Error('Invalid OAuth state signature');
  const payload = JSON.parse(base64UrlDecodeToString(body));
  const issuedAt = Number(payload.issued_at || 0);
  if (!issuedAt || now - issuedAt > ttlMs) throw new Error('Expired OAuth state');
  return payload;
}

export function sanitizeReturnTo(value) {
  const text = clean(value, 500);
  if (!text) return '';
  try {
    const url = new URL(text);
    if (url.protocol === 'https:' && /(^|\.)clawdified\.com$/i.test(url.hostname)) return url.toString();
  } catch (_err) {
    // Relative return paths are allowed.
  }
  if (text.startsWith('/') && !text.startsWith('//')) return text;
  return '';
}

export function buildAuthUrl({ request, env, client = '', workflow = '', invite = '', returnTo = '' }) {
  const redirectUri = callbackUrl(request, env);
  const scopes = scopesFromEnv(env);
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', clientIdFromEnv(env));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scopes.join(','));

  return {
    url,
    statePayload: {
      v: 1,
      nonce: crypto.randomUUID(),
      client: clean(client, 160),
      workflow: clean(workflow, 500),
      invite_id: clean(invite, 120),
      return_to: sanitizeReturnTo(returnTo),
      redirect_uri: redirectUri,
      scopes,
    },
  };
}

async function parseSlackResponse(response, fallbackMessage) {
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (_err) {
    parsed = { raw: text };
  }
  if (!response.ok || parsed.ok === false) {
    const message = parsed?.error || fallbackMessage || `Slack API ${response.status}`;
    const err = new Error(clean(message, 700));
    err.status = response.status || 400;
    err.payload = parsed;
    throw err;
  }
  return parsed;
}

export async function exchangeCodeForTokens({ code, redirectUri, env }) {
  const body = new URLSearchParams();
  body.set('code', code);
  body.set('client_id', clientIdFromEnv(env));
  body.set('client_secret', clientSecretFromEnv(env));
  body.set('redirect_uri', redirectUri);
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return parseSlackResponse(response, 'Slack OAuth token exchange failed');
}

export function buildAgentPackage({ connectionId, client = {}, tokenPayload = {}, env = {}, redirectUri = '' } = {}) {
  const createdAt = nowIso();
  const grantedScopes = clean(tokenPayload.scope || '', 2000).split(/[\s,]+/).filter(Boolean);
  return {
    connection_id: connectionId,
    created_at: createdAt,
    client: {
      name: clean(client.client || client.name || '', 160),
      workflow: clean(client.workflow || '', 500),
      invite_id: clean(client.invite_id || '', 120),
    },
    slack_app: {
      client_id: clientIdFromEnv(env),
      redirect_uri: redirectUri,
      requested_scopes: Array.isArray(client.scopes) ? client.scopes : scopesFromEnv(env),
    },
    oauth: {
      access_token: tokenPayload.access_token || '',
      token_type: tokenPayload.token_type || 'bot',
      scope: tokenPayload.scope || grantedScopes.join(','),
      bot_user_id: tokenPayload.bot_user_id || '',
      app_id: tokenPayload.app_id || '',
    },
    team: tokenPayload.team || null,
    enterprise: tokenPayload.enterprise || null,
    authed_user: tokenPayload.authed_user || null,
    endpoints: {
      post_message: 'https://slack.com/api/chat.postMessage',
      conversations_list: 'https://slack.com/api/conversations.list',
      users_info: 'https://slack.com/api/users.info',
    },
    required_for_agent: {
      team_present: Boolean(tokenPayload.team?.id || tokenPayload.team?.name),
      access_token_present: Boolean(tokenPayload.access_token),
      chat_write_scope_present: grantedScopes.includes('chat:write'),
      granted_scopes: grantedScopes,
    },
  };
}

export function redactTokens(value) {
  if (Array.isArray(value)) return value.map((item) => redactTokens(item));
  if (!value || typeof value !== 'object') return value;
  const redacted = {};
  for (const [key, raw] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (normalized.includes('token') || normalized === 'access_token') {
      redacted[key] = raw ? '[stored-server-side]' : '';
    } else {
      redacted[key] = redactTokens(raw);
    }
  }
  return redacted;
}

function arrayValue(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function packageScopes(packageData = {}) {
  return clean(packageData?.oauth?.scope || '', 2000).split(/[\s,]+/).filter(Boolean)
    .concat(arrayValue(packageData?.required_for_agent?.granted_scopes))
    .concat(arrayValue(packageData?.slack_app?.requested_scopes))
    .filter(Boolean);
}

export function summarizeAgentPackage(packageData = {}, { origin = '' } = {}) {
  const connectionId = clean(packageData.connection_id || '', 120);
  const clientName = clean(packageData?.client?.name || packageData?.client_name || '', 160);
  const workflow = clean(packageData?.client?.workflow || '', 500);
  const inviteId = clean(packageData?.client?.invite_id || packageData?.invite_id || '', 120);
  const teamName = clean(packageData?.team?.name || packageData?.team_name || '', 180);
  const teamId = clean(packageData?.team?.id || packageData?.team_id || '', 80);
  const connectedAccount = teamName || teamId;
  const scopes = [...new Set(packageScopes(packageData))];
  const accessTokenStored = Boolean(
    packageData?.required_for_agent?.access_token_present
      || (packageData?.oauth?.access_token && packageData.oauth.access_token !== '[stored-server-side]'),
  );
  const chatWriteScope = Boolean(packageData?.required_for_agent?.chat_write_scope_present || scopes.includes('chat:write'));
  const readyForAgent = Boolean(connectionId && connectedAccount && accessTokenStored && chatWriteScope);
  const detailPath = `/api/slack/connections/${encodeURIComponent(connectionId)}?include=agent_package`;

  return {
    connection_id: connectionId,
    service: 'slack',
    status: readyForAgent ? 'connected' : 'needs_attention',
    invite_id: inviteId,
    client_name: clientName,
    workflow,
    connected_account: connectedAccount,
    primary_account: connectedAccount,
    team_id: teamId,
    bot_user_id: clean(packageData?.oauth?.bot_user_id || packageData?.bot_user_id || '', 80),
    created_at: clean(packageData.created_at || '', 80),
    access_token_stored: accessTokenStored,
    chat_write_scope_granted: chatWriteScope,
    granted_scopes_count: scopes.length,
    credential_status: accessTokenStored ? 'Bot credential stored' : 'Credential missing',
    dashboard_pills: [
      { label: teamId ? `Team ${teamId}` : 'Workspace', tone: 'muted' },
      { label: `${scopes.length} scope${scopes.length === 1 ? '' : 's'}`, tone: 'muted' },
    ],
    ready_for_agent: readyForAgent,
    detail_url: origin && connectionId ? `${origin}${detailPath}` : detailPath,
  };
}

export function buildAgentHandoff(packageData = {}, { origin = '' } = {}) {
  const summary = summarizeAgentPackage(packageData, { origin });
  const scopes = [...new Set(packageScopes(packageData))];
  return {
    handoff_type: 'clawdified.slack_agent_connection.v1',
    service: 'slack',
    connection_id: summary.connection_id,
    invite_id: summary.invite_id,
    client_name: summary.client_name,
    workflow: summary.workflow,
    connected_account: summary.connected_account,
    created_at: summary.created_at,
    status: {
      ready_for_agent: summary.ready_for_agent,
      access_token_present: summary.access_token_stored,
      chat_write_scope_granted: summary.chat_write_scope_granted,
    },
    oauth: {
      auth_type: 'slack_oauth_bot_token',
      access_token: packageData?.oauth?.access_token || '',
      token_type: packageData?.oauth?.token_type || 'bot',
      bot_user_id: packageData?.oauth?.bot_user_id || '',
      granted_scopes: scopes,
    },
    slack: {
      team: packageData?.team || null,
      enterprise: packageData?.enterprise || null,
      authed_user: packageData?.authed_user || null,
      endpoints: packageData?.endpoints || null,
    },
    clawdified: {
      dashboard_detail_url: summary.detail_url,
      connector: 'https://clawdified.com/connect/slack/',
    },
    agent_instructions: [
      'This is a Clawdified Slack OAuth connection package for the named client workspace.',
      'Use oauth.access_token only inside the approved server-side agent runtime.',
      'Post messages or read workspace metadata only for the approved client workflow.',
      'Never expose Slack bot tokens or this raw handoff package to public/client-visible pages.',
    ],
  };
}

async function aesKeyFromSecret(secret) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptJson(value, secret) {
  if (!secret) throw new Error('Missing encryption key');
  const key = await aesKeyFromSecret(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = textEncoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    alg: 'AES-GCM-SHA256',
    iv: base64UrlEncode(iv),
    ciphertext: base64UrlEncode(ciphertext),
  };
}

export async function decryptJson(payload, secret) {
  if (!secret) throw new Error('Missing encryption key');
  if (!payload?.iv || !payload?.ciphertext) throw new Error('Invalid encrypted payload');
  const key = await aesKeyFromSecret(secret);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlDecodeToBytes(payload.iv) },
    key,
    base64UrlDecodeToBytes(payload.ciphertext),
  );
  return JSON.parse(textDecoder.decode(plaintext));
}

export function connectionStorageKey(id) {
  return `${CONNECTION_KEY_PREFIX}${id}`;
}

export async function persistConnection({ env, connectionId, publicPackage, fullAgentPackage }) {
  if (!hasKv(env)) throw new Error('SOCIAL_CONNECTOR_KV binding is not configured');
  const encryptedAgentPackage = await encryptJson(fullAgentPackage, encryptionSecretFromEnv(env));
  const record = {
    ok: true,
    connection_id: connectionId,
    created_at: nowIso(),
    public_agent_package: publicPackage,
    encrypted_agent_package: encryptedAgentPackage,
  };
  await env.SOCIAL_CONNECTOR_KV.put(connectionStorageKey(connectionId), JSON.stringify(record), {
    metadata: {
      team: clean(fullAgentPackage?.team?.name || fullAgentPackage?.team?.id || '', 120),
      client: clean(fullAgentPackage?.client?.name || '', 120),
      invite: clean(fullAgentPackage?.client?.invite_id || '', 120),
      created_at: record.created_at,
      connector: 'slack',
    },
  });
  return record;
}

export async function readConnection({ env, connectionId, includeSecrets = false }) {
  if (!hasKv(env)) throw new Error('SOCIAL_CONNECTOR_KV binding is not configured');
  const raw = await env.SOCIAL_CONNECTOR_KV.get(connectionStorageKey(connectionId));
  if (!raw) return null;
  const record = JSON.parse(raw);
  if (!includeSecrets) return {
    ok: true,
    connection_id: connectionId,
    created_at: record.created_at,
    agent_package: record.public_agent_package,
  };
  const full = await decryptJson(record.encrypted_agent_package, encryptionSecretFromEnv(env));
  return {
    ok: true,
    connection_id: connectionId,
    created_at: record.created_at,
    agent_package: full,
  };
}

export async function listConnections({ env, origin = '', limit = 100, cursor = '' } = {}) {
  if (!hasKv(env)) throw new Error('SOCIAL_CONNECTOR_KV binding is not configured');
  if (typeof env.SOCIAL_CONNECTOR_KV.list !== 'function') {
    throw new Error('SOCIAL_CONNECTOR_KV list support is not configured');
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const listOptions = { prefix: CONNECTION_KEY_PREFIX, limit: safeLimit };
  const safeCursor = clean(cursor, 500);
  if (safeCursor) listOptions.cursor = safeCursor;
  const listed = await env.SOCIAL_CONNECTOR_KV.list(listOptions);
  const connections = [];

  for (const key of listed.keys || []) {
    const keyName = clean(key?.name || '', 300);
    if (!keyName.startsWith(CONNECTION_KEY_PREFIX)) continue;
    const raw = await env.SOCIAL_CONNECTOR_KV.get(keyName);
    if (!raw) continue;
    try {
      const record = JSON.parse(raw);
      const publicPackage = record.public_agent_package || {};
      const summary = summarizeAgentPackage({
        ...publicPackage,
        connection_id: record.connection_id || keyName.slice(CONNECTION_KEY_PREFIX.length),
        created_at: record.created_at || publicPackage.created_at || key?.metadata?.created_at || '',
      }, { origin });
      connections.push(summary);
    } catch (_err) {
      // Skip malformed records rather than breaking the whole dashboard.
    }
  }

  connections.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return {
    ok: true,
    service: 'slack',
    connections,
    cursor: listed.cursor || '',
    list_complete: listed.list_complete !== false,
  };
}

export async function authorizedAdmin(request, env = {}) {
  const configured = adminTokenFromEnv(env);
  const header = clean(request.headers.get('Authorization') || '', 5000);
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  const queryToken = clean(new URL(request.url).searchParams.get('admin_token') || '', 5000);
  if (configured && safeEqual(bearer || queryToken, configured)) return true;
  const session = await verifyAdminSessionFromRequest(request, env);
  return Boolean(session.ok);
}

export function renderSuccessPage({ publicPackage, returnTo = '' }) {
  const workspace = publicPackage?.team?.name || publicPackage?.team?.id || 'your Slack workspace';
  const returnLink = returnTo ? `<a class="button ghost" href="${escapeHtml(returnTo)}">Back to Clawdified</a>` : '<a class="button ghost" href="/connect/slack/">Back to connector</a>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Slack connected | Clawdified</title><style>:root{color-scheme:dark;--bg:#0f0e0a;--panel:#17140e;--ink:#f8edda;--muted:rgba(248,237,218,.72);--line:rgba(248,237,218,.14);--gold:#f1b45b;--orange:#d48553;--green:#7ad99d}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 0%,rgba(241,180,91,.18),transparent 34rem),var(--bg);color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;place-items:center;padding:24px}.card{max-width:680px;width:100%;border:1px solid var(--line);background:rgba(23,20,14,.9);border-radius:28px;padding:34px;text-align:center}.eyebrow{color:var(--green);text-transform:uppercase;letter-spacing:.18em;font-size:12px;font-weight:800}h1{font-family:Georgia,serif;font-size:clamp(38px,7vw,72px);line-height:.95;margin:12px 0 16px;font-weight:500}p{color:var(--muted);line-height:1.55}.workspace{color:var(--gold);font-weight:800}.button{display:inline-flex;align-items:center;justify-content:center;margin-top:10px;padding:12px 16px;border-radius:999px;background:linear-gradient(135deg,var(--gold),var(--orange));color:#1a1008;text-decoration:none;font-weight:800}.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}</style></head><body><main class="card"><div class="eyebrow">Connected</div><h1>Slack is connected.</h1><p>Thank you — <span class="workspace">${escapeHtml(workspace)}</span> is connected to Clawdified. You can close this window.</p><p>No tokens or technical details are shown here.</p>${returnLink}</main></body></html>`;
}

export function renderErrorPage({ title = 'Connection failed', message = '', details = [] }) {
  const items = details.length ? `<ul>${details.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | Clawdified</title><style>:root{color-scheme:dark;--bg:#0f0e0a;--panel:#17140e;--ink:#f8edda;--muted:rgba(248,237,218,.72);--line:rgba(248,237,218,.14)}body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;place-items:center;padding:24px}.card{max-width:760px;border:1px solid var(--line);background:var(--panel);border-radius:24px;padding:30px}h1{font-family:Georgia,serif;font-size:clamp(34px,6vw,64px);line-height:.95;margin:0 0 14px;font-weight:500}p,li{color:var(--muted);line-height:1.55}.button{display:inline-flex;margin-top:12px;padding:12px 16px;border-radius:999px;border:1px solid var(--line);color:var(--ink);text-decoration:none}</style></head><body><main class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${items}<a class="button" href="/connect/slack/">Back to connector</a></main></body></html>`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
