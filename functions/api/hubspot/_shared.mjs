import { verifyAdminSessionFromRequest } from '../admin/_auth.mjs';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export const DEFAULT_HUBSPOT_SCOPES = ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.companies.read'];

const STATE_TTL_MS = 20 * 60 * 1000;
const CONNECTION_KEY_PREFIX = 'hubspot-connection:';
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
  return clean(env.HUBSPOT_CLIENT_ID || '', 200);
}

export function clientSecretFromEnv(env = {}) {
  return clean(env.HUBSPOT_CLIENT_SECRET || '', 5000);
}

export function stateSecretFromEnv(env = {}) {
  return clean(env.HUBSPOT_CONNECTOR_STATE_SECRET || env.SOCIAL_CONNECTOR_STATE_SECRET || env.HUBSPOT_CLIENT_SECRET || '', 5000);
}

export function encryptionSecretFromEnv(env = {}) {
  return clean(env.HUBSPOT_CONNECTOR_ENCRYPTION_KEY || env.SOCIAL_CONNECTOR_ENCRYPTION_KEY || '', 5000);
}

export function adminTokenFromEnv(env = {}) {
  return clean(env.HUBSPOT_CONNECTOR_ADMIN_TOKEN || env.SOCIAL_CONNECTOR_ADMIN_TOKEN || '', 5000);
}

export function scopesFromEnv(env = {}) {
  const raw = clean(env.HUBSPOT_SCOPES || '', 3000);
  if (!raw) return DEFAULT_HUBSPOT_SCOPES;
  return raw.split(/[\s,]+/).map((scope) => clean(scope, 160)).filter(Boolean);
}

export function getOrigin(request, env = {}) {
  const configured = clean(env.HUBSPOT_CONNECTOR_BASE_URL || env.SOCIAL_CONNECTOR_BASE_URL || env.PUBLIC_BASE_URL || '', 300).replace(/\/+$/, '');
  if (configured) return configured;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function callbackUrl(request, env = {}) {
  const configured = clean(env.HUBSPOT_REDIRECT_URI || '', 500);
  if (configured) return configured;
  return `${getOrigin(request, env)}/api/hubspot/callback`;
}

export function hasKv(env = {}) {
  return Boolean(env.SOCIAL_CONNECTOR_KV && typeof env.SOCIAL_CONNECTOR_KV.get === 'function' && typeof env.SOCIAL_CONNECTOR_KV.put === 'function');
}

export function readiness(env = {}, { requireAdmin = false } = {}) {
  const missing = [];
  if (!clientIdFromEnv(env)) missing.push('HUBSPOT_CLIENT_ID');
  if (!clientSecretFromEnv(env)) missing.push('HUBSPOT_CLIENT_SECRET');
  if (!stateSecretFromEnv(env)) missing.push('HUBSPOT_CONNECTOR_STATE_SECRET or SOCIAL_CONNECTOR_STATE_SECRET');
  if (!encryptionSecretFromEnv(env)) missing.push('HUBSPOT_CONNECTOR_ENCRYPTION_KEY or SOCIAL_CONNECTOR_ENCRYPTION_KEY');
  if (!hasKv(env)) missing.push('SOCIAL_CONNECTOR_KV binding');
  if (requireAdmin && !adminTokenFromEnv(env)) missing.push('HUBSPOT_CONNECTOR_ADMIN_TOKEN or SOCIAL_CONNECTOR_ADMIN_TOKEN');
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
  const url = new URL('https://app.hubspot.com/oauth/authorize');
  url.searchParams.set('client_id', clientIdFromEnv(env));
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scopes.join(' '));

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

async function parseJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (_err) {
    parsed = { raw: text };
  }
  if (!response.ok) {
    const message = parsed?.message || parsed?.error_description || parsed?.error || fallbackMessage || `HubSpot API ${response.status}`;
    const err = new Error(clean(message, 700));
    err.status = response.status;
    err.payload = parsed;
    throw err;
  }
  return parsed;
}

export async function exchangeCodeForTokens({ code, redirectUri, env }) {
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('client_id', clientIdFromEnv(env));
  body.set('client_secret', clientSecretFromEnv(env));
  body.set('redirect_uri', redirectUri);
  body.set('code', code);
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return parseJsonResponse(response, 'HubSpot OAuth token exchange failed');
}

export async function collectHubSpotAccount({ accessToken }) {
  if (!accessToken) return null;
  const response = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(accessToken)}`, {
    headers: { Accept: 'application/json' },
  });
  return parseJsonResponse(response, 'HubSpot account lookup failed');
}

function expiresAt(tokenPayload = {}) {
  const seconds = Number(tokenPayload.expires_in || 0);
  if (!seconds) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export function buildAgentPackage({ connectionId, client = {}, tokenPayload = {}, account = null, env = {}, redirectUri = '' } = {}) {
  const createdAt = nowIso();
  const scopes = Array.isArray(tokenPayload.scopes) ? tokenPayload.scopes : scopesFromEnv(env);
  return {
    connection_id: connectionId,
    created_at: createdAt,
    client: {
      name: clean(client.client || client.name || '', 160),
      workflow: clean(client.workflow || '', 500),
      invite_id: clean(client.invite_id || '', 120),
    },
    hubspot_app: {
      client_id: clientIdFromEnv(env),
      redirect_uri: redirectUri,
      requested_scopes: Array.isArray(client.scopes) ? client.scopes : scopesFromEnv(env),
    },
    oauth: {
      access_token: tokenPayload.access_token || '',
      refresh_token: tokenPayload.refresh_token || '',
      token_type: tokenPayload.token_type || 'bearer',
      expires_at: expiresAt(tokenPayload),
      scopes,
    },
    account,
    endpoints: {
      contacts: 'https://api.hubapi.com/crm/v3/objects/contacts',
      companies: 'https://api.hubapi.com/crm/v3/objects/companies',
      deals: 'https://api.hubapi.com/crm/v3/objects/deals',
    },
    required_for_agent: {
      portal_present: Boolean(account?.hub_id || account?.hub_domain),
      refresh_token_present: Boolean(tokenPayload.refresh_token),
      contacts_read_scope_present: scopes.includes('crm.objects.contacts.read'),
      granted_scopes: scopes,
    },
  };
}

export function redactTokens(value) {
  if (Array.isArray(value)) return value.map((item) => redactTokens(item));
  if (!value || typeof value !== 'object') return value;
  const redacted = {};
  for (const [key, raw] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (normalized.includes('token')) {
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
  return arrayValue(packageData?.oauth?.scopes)
    .concat(arrayValue(packageData?.required_for_agent?.granted_scopes))
    .concat(arrayValue(packageData?.hubspot_app?.requested_scopes))
    .filter(Boolean);
}

export function summarizeAgentPackage(packageData = {}, { origin = '' } = {}) {
  const connectionId = clean(packageData.connection_id || '', 120);
  const clientName = clean(packageData?.client?.name || packageData?.client_name || '', 160);
  const workflow = clean(packageData?.client?.workflow || '', 500);
  const inviteId = clean(packageData?.client?.invite_id || packageData?.invite_id || '', 120);
  const account = packageData?.account || {};
  const connectedAccount = clean(account.hub_domain || account.user || (account.hub_id ? `Portal ${account.hub_id}` : ''), 180);
  const scopes = [...new Set(packageScopes(packageData))];
  const refreshTokenStored = Boolean(
    packageData?.required_for_agent?.refresh_token_present
      || (packageData?.oauth?.refresh_token && packageData.oauth.refresh_token !== '[stored-server-side]'),
  );
  const contactsReadScope = Boolean(packageData?.required_for_agent?.contacts_read_scope_present || scopes.includes('crm.objects.contacts.read'));
  const portalPresent = Boolean(packageData?.required_for_agent?.portal_present || connectedAccount);
  const readyForAgent = Boolean(connectionId && portalPresent && refreshTokenStored && contactsReadScope);
  const detailPath = `/api/hubspot/connections/${encodeURIComponent(connectionId)}?include=agent_package`;

  return {
    connection_id: connectionId,
    service: 'hubspot',
    status: readyForAgent ? 'connected' : 'needs_attention',
    invite_id: inviteId,
    client_name: clientName,
    workflow,
    connected_account: connectedAccount,
    primary_account: connectedAccount,
    hub_id: account.hub_id || null,
    created_at: clean(packageData.created_at || '', 80),
    refresh_token_stored: refreshTokenStored,
    contacts_read_scope_granted: contactsReadScope,
    granted_scopes_count: scopes.length,
    credential_status: refreshTokenStored ? 'CRM credential stored' : 'Credential missing',
    dashboard_pills: [
      { label: account.hub_id ? `Portal ${account.hub_id}` : 'Portal', tone: 'muted' },
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
    handoff_type: 'clawdified.hubspot_agent_connection.v1',
    service: 'hubspot',
    connection_id: summary.connection_id,
    invite_id: summary.invite_id,
    client_name: summary.client_name,
    workflow: summary.workflow,
    connected_account: summary.connected_account,
    created_at: summary.created_at,
    status: {
      ready_for_agent: summary.ready_for_agent,
      refresh_token_present: summary.refresh_token_stored,
      contacts_read_scope_granted: summary.contacts_read_scope_granted,
    },
    oauth: {
      auth_type: 'hubspot_oauth_refresh_token',
      token_uri: 'https://api.hubapi.com/oauth/v1/token',
      client_id: packageData?.hubspot_app?.client_id || '',
      client_secret_source: 'HUBSPOT_CLIENT_SECRET',
      refresh_token: packageData?.oauth?.refresh_token || '',
      access_token: packageData?.oauth?.access_token || '',
      access_token_expires_at: packageData?.oauth?.expires_at || null,
      token_type: packageData?.oauth?.token_type || 'bearer',
      granted_scopes: scopes,
    },
    hubspot: {
      account: packageData?.account || null,
      endpoints: packageData?.endpoints || null,
    },
    clawdified: {
      dashboard_detail_url: summary.detail_url,
      connector: 'https://clawdified.com/connect/hubspot/',
    },
    agent_instructions: [
      'This is a Clawdified HubSpot OAuth connection package for the named client portal.',
      'Use oauth.refresh_token plus the server-side HUBSPOT_CLIENT_SECRET and oauth.client_id at oauth.token_uri to mint fresh access tokens when the agent runs.',
      'Read/write CRM objects only for the approved client workflow.',
      'Never expose HubSpot tokens or this raw handoff package to public/client-visible pages.',
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
      portal: clean(fullAgentPackage?.account?.hub_domain || fullAgentPackage?.account?.hub_id || '', 120),
      client: clean(fullAgentPackage?.client?.name || '', 120),
      invite: clean(fullAgentPackage?.client?.invite_id || '', 120),
      created_at: record.created_at,
      connector: 'hubspot',
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
    service: 'hubspot',
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
  const portal = publicPackage?.account?.hub_domain || publicPackage?.account?.user || (publicPackage?.account?.hub_id ? `Portal ${publicPackage.account.hub_id}` : 'your HubSpot portal');
  const returnLink = returnTo ? `<a class="button ghost" href="${escapeHtml(returnTo)}">Back to Clawdified</a>` : '<a class="button ghost" href="/connect/hubspot/">Back to connector</a>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HubSpot connected | Clawdified</title><style>:root{color-scheme:dark;--bg:#0f0e0a;--panel:#17140e;--ink:#f8edda;--muted:rgba(248,237,218,.72);--line:rgba(248,237,218,.14);--gold:#f1b45b;--orange:#d48553;--green:#7ad99d}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 0%,rgba(241,180,91,.18),transparent 34rem),var(--bg);color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;place-items:center;padding:24px}.card{max-width:680px;width:100%;border:1px solid var(--line);background:rgba(23,20,14,.9);border-radius:28px;padding:34px;text-align:center}.eyebrow{color:var(--green);text-transform:uppercase;letter-spacing:.18em;font-size:12px;font-weight:800}h1{font-family:Georgia,serif;font-size:clamp(38px,7vw,72px);line-height:.95;margin:12px 0 16px;font-weight:500}p{color:var(--muted);line-height:1.55}.portal{color:var(--gold);font-weight:800}.button{display:inline-flex;align-items:center;justify-content:center;margin-top:10px;padding:12px 16px;border-radius:999px;background:linear-gradient(135deg,var(--gold),var(--orange));color:#1a1008;text-decoration:none;font-weight:800}.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}</style></head><body><main class="card"><div class="eyebrow">Connected</div><h1>HubSpot is connected.</h1><p>Thank you — <span class="portal">${escapeHtml(portal)}</span> is connected to Clawdified. You can close this window.</p><p>No tokens or technical details are shown here.</p>${returnLink}</main></body></html>`;
}

export function renderErrorPage({ title = 'Connection failed', message = '', details = [] }) {
  const items = details.length ? `<ul>${details.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | Clawdified</title><style>:root{color-scheme:dark;--bg:#0f0e0a;--panel:#17140e;--ink:#f8edda;--muted:rgba(248,237,218,.72);--line:rgba(248,237,218,.14)}body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;place-items:center;padding:24px}.card{max-width:760px;border:1px solid var(--line);background:var(--panel);border-radius:24px;padding:30px}h1{font-family:Georgia,serif;font-size:clamp(34px,6vw,64px);line-height:.95;margin:0 0 14px;font-weight:500}p,li{color:var(--muted);line-height:1.55}.button{display:inline-flex;margin-top:12px;padding:12px 16px;border-radius:999px;border:1px solid var(--line);color:var(--ink);text-decoration:none}</style></head><body><main class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${items}<a class="button" href="/connect/hubspot/">Back to connector</a></main></body></html>`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
