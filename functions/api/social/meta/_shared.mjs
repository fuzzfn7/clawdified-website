import { verifyAdminSessionFromRequest } from '../../admin/_auth.mjs';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export const DEFAULT_GRAPH_VERSION = 'v23.0';
export const DEFAULT_META_APP_ID = '979754104796418';
export const DEFAULT_SCOPES = ['public_profile'];
export const ADVANCED_CONNECTOR_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_messaging',
  'instagram_basic',
  'instagram_manage_messages',
  'business_management',
];

const STATE_TTL_MS = 20 * 60 * 1000;
const CONNECTION_KEY_PREFIX = 'social-meta-connection:';
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

export function nowIso() {
  return new Date().toISOString();
}

export function graphVersion(env = {}) {
  return clean(env.META_GRAPH_VERSION || env.FACEBOOK_GRAPH_VERSION || DEFAULT_GRAPH_VERSION, 20).replace(/^\/?/, '');
}

export function scopesFromEnv(env = {}) {
  const raw = clean(env.META_SCOPES || env.FACEBOOK_SCOPES || '', 2000);
  if (!raw) return DEFAULT_SCOPES;
  return raw
    .split(/[\s,]+/)
    .map((scope) => clean(scope, 80))
    .filter(Boolean);
}

export function appIdFromEnv(env = {}) {
  return clean(env.META_APP_ID || env.FACEBOOK_APP_ID || DEFAULT_META_APP_ID, 80);
}

export function appSecretFromEnv(env = {}) {
  return clean(env.META_APP_SECRET || env.FACEBOOK_APP_SECRET || '', 5000);
}

export function stateSecretFromEnv(env = {}) {
  return clean(env.SOCIAL_CONNECTOR_STATE_SECRET || env.META_STATE_SECRET || env.META_APP_SECRET || env.FACEBOOK_APP_SECRET || '', 5000);
}

export function encryptionSecretFromEnv(env = {}) {
  return clean(env.SOCIAL_CONNECTOR_ENCRYPTION_KEY || env.SOCIAL_CONNECTOR_TOKEN_KEY || '', 5000);
}

export function adminTokenFromEnv(env = {}) {
  return clean(env.SOCIAL_CONNECTOR_ADMIN_TOKEN || env.META_CONNECTOR_ADMIN_TOKEN || '', 5000);
}

export function getOrigin(request, env = {}) {
  const configured = clean(env.SOCIAL_CONNECTOR_BASE_URL || env.PUBLIC_BASE_URL || '', 300).replace(/\/+$/, '');
  if (configured) return configured;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function callbackUrl(request, env = {}) {
  const configured = clean(env.META_REDIRECT_URI || env.FACEBOOK_REDIRECT_URI || '', 500);
  if (configured) return configured;
  return `${getOrigin(request, env)}/api/social/meta/callback`;
}

export function hasKv(env = {}) {
  return Boolean(env.SOCIAL_CONNECTOR_KV && typeof env.SOCIAL_CONNECTOR_KV.get === 'function' && typeof env.SOCIAL_CONNECTOR_KV.put === 'function');
}

export function readiness(env = {}, { requireAdmin = false } = {}) {
  const missing = [];
  if (!appIdFromEnv(env)) missing.push('META_APP_ID');
  if (!appSecretFromEnv(env)) missing.push('META_APP_SECRET');
  if (!stateSecretFromEnv(env)) missing.push('SOCIAL_CONNECTOR_STATE_SECRET');
  if (!encryptionSecretFromEnv(env)) missing.push('SOCIAL_CONNECTOR_ENCRYPTION_KEY');
  if (!hasKv(env)) missing.push('SOCIAL_CONNECTOR_KV binding');
  if (requireAdmin && !adminTokenFromEnv(env)) missing.push('SOCIAL_CONNECTOR_ADMIN_TOKEN');
  return {
    ok: missing.length === 0,
    missing,
    app_id_configured: Boolean(appIdFromEnv(env)),
    app_secret_configured: Boolean(appSecretFromEnv(env)),
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

export function loginConfigIdFromEnv(env = {}) {
  return clean(env.META_LOGIN_CONFIG_ID || env.FACEBOOK_LOGIN_CONFIG_ID || '', 120);
}

export function buildAuthUrl({ request, env, client = '', workflow = '', invite = '', returnTo = '' }) {
  const appId = appIdFromEnv(env);
  const version = graphVersion(env);
  const redirectUri = callbackUrl(request, env);
  const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('auth_type', 'rerequest');
  url.searchParams.set('display', 'page');

  const loginConfigId = loginConfigIdFromEnv(env);
  if (loginConfigId) {
    url.searchParams.set('config_id', loginConfigId);
  } else {
    url.searchParams.set('scope', scopesFromEnv(env).join(','));
  }

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
      graph_version: version,
    },
  };
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

async function graphFetch(path, token, { env = {}, fields = '', method = 'GET', body = null, search = {} } = {}) {
  const version = graphVersion(env);
  const url = path.startsWith('https://') ? new URL(path) : new URL(`https://graph.facebook.com/${version}${path.startsWith('/') ? path : `/${path}`}`);
  if (fields) url.searchParams.set('fields', fields);
  for (const [key, value] of Object.entries(search || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }
  if (token) url.searchParams.set('access_token', token);

  const response = await fetch(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : null,
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (_err) {
    parsed = { raw: text };
  }
  if (!response.ok) {
    const message = parsed?.error?.message || parsed?.error || `Graph API ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = parsed;
    throw err;
  }
  return parsed;
}

async function graphFetchAll(path, token, options = {}) {
  const first = await graphFetch(path, token, options);
  const data = Array.isArray(first.data) ? [...first.data] : [];
  let next = first?.paging?.next || '';
  let guard = 0;
  while (next && guard < 8) {
    guard += 1;
    const page = await graphFetch(next, token, { ...options, fields: '', search: {} });
    if (Array.isArray(page.data)) data.push(...page.data);
    next = page?.paging?.next || '';
  }
  return data;
}

export async function exchangeCodeForLongLivedToken({ code, redirectUri, env }) {
  const version = graphVersion(env);
  const appId = appIdFromEnv(env);
  const appSecret = appSecretFromEnv(env);
  const shortUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  shortUrl.searchParams.set('client_id', appId);
  shortUrl.searchParams.set('client_secret', appSecret);
  shortUrl.searchParams.set('redirect_uri', redirectUri);
  shortUrl.searchParams.set('code', code);

  const shortResponse = await fetch(shortUrl.toString());
  const shortPayload = await shortResponse.json();
  if (!shortResponse.ok || !shortPayload.access_token) {
    throw new Error(shortPayload?.error?.message || 'Meta OAuth code exchange failed');
  }

  const longUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  longUrl.searchParams.set('grant_type', 'fb_exchange_token');
  longUrl.searchParams.set('client_id', appId);
  longUrl.searchParams.set('client_secret', appSecret);
  longUrl.searchParams.set('fb_exchange_token', shortPayload.access_token);

  const longResponse = await fetch(longUrl.toString());
  const longPayload = await longResponse.json();
  if (!longResponse.ok || !longPayload.access_token) {
    throw new Error(longPayload?.error?.message || 'Meta long-lived token exchange failed');
  }

  return {
    short_lived: shortPayload,
    long_lived: longPayload,
  };
}

export async function collectMetaAssets({ userAccessToken, env }) {
  const appId = appIdFromEnv(env);
  const appSecret = appSecretFromEnv(env);
  const appAccessToken = `${appId}|${appSecret}`;

  const [user, debug] = await Promise.all([
    graphFetch('/me', userAccessToken, { env, fields: 'id,name,email' }).catch((err) => ({ error: publicGraphError(err) })),
    graphFetch('/debug_token', appAccessToken, { env, search: { input_token: userAccessToken } }).catch((err) => ({ error: publicGraphError(err) })),
  ]);

  const pageFields = [
    'id',
    'name',
    'username',
    'category',
    'link',
    'access_token',
    'tasks',
    'perms',
    'instagram_business_account{id,username,name,profile_picture_url}',
    'connected_instagram_account{id,username}',
    'business{id,name}',
  ].join(',');

  const pages = await graphFetchAll('/me/accounts', userAccessToken, { env, fields: pageFields }).catch((err) => [{ error: publicGraphError(err) }]);
  const businesses = await graphFetchAll('/me/businesses', userAccessToken, { env, fields: 'id,name,verification_status' }).catch((err) => [{ error: publicGraphError(err) }]);

  const hydratedPages = [];
  for (const page of pages) {
    if (page?.error) {
      hydratedPages.push(page);
      continue;
    }
    const igId = page?.instagram_business_account?.id || page?.connected_instagram_account?.id || '';
    let instagramProfile = null;
    if (igId && page.access_token) {
      instagramProfile = await graphFetch(`/${igId}`, page.access_token, {
        env,
        fields: 'id,username,name,biography,website,followers_count,media_count,profile_picture_url',
      }).catch((err) => ({ error: publicGraphError(err) }));
    }
    hydratedPages.push({ ...page, instagram_profile: instagramProfile });
  }

  return { user, debug, pages: hydratedPages, businesses };
}

function publicGraphError(err) {
  return {
    message: clean(err?.message || 'Graph API request failed', 300),
    status: err?.status || null,
    code: err?.payload?.error?.code || null,
    type: err?.payload?.error?.type || null,
  };
}

export function endpointMap({ pageId, instagramId, graphBase }) {
  const endpoints = {
    page: `${graphBase}/${pageId}`,
    page_access_token_debug: `${graphBase}/debug_token`,
    page_conversations: `${graphBase}/${pageId}/conversations`,
    page_messages: `${graphBase}/${pageId}/messages`,
    page_subscribed_apps: `${graphBase}/${pageId}/subscribed_apps`,
    page_feed: `${graphBase}/${pageId}/feed`,
  };
  if (instagramId) {
    endpoints.instagram_business_account = `${graphBase}/${instagramId}`;
    endpoints.instagram_conversations = `${graphBase}/${instagramId}/conversations`;
    endpoints.instagram_messages = `${graphBase}/${instagramId}/messages`;
    endpoints.instagram_media = `${graphBase}/${instagramId}/media`;
  }
  return endpoints;
}

export function buildAgentPackage({ connectionId, client, tokenPayload, assets, env, redirectUri }) {
  const version = graphVersion(env);
  const graphBase = `https://graph.facebook.com/${version}`;
  const debugData = assets?.debug?.data || {};
  const scopes = Array.isArray(debugData.scopes) ? debugData.scopes : scopesFromEnv(env);
  const expiresAt = debugData.expires_at ? new Date(Number(debugData.expires_at) * 1000).toISOString() : null;

  const pages = (assets.pages || []).map((page) => {
    if (page?.error) return { error: page.error };
    const instagram = page.instagram_profile || page.instagram_business_account || page.connected_instagram_account || null;
    const instagramId = instagram?.id || '';
    return {
      facebook_page_id: page.id,
      facebook_page_name: page.name || '',
      facebook_page_username: page.username || '',
      category: page.category || '',
      link: page.link || '',
      tasks: page.tasks || [],
      perms: page.perms || [],
      business: page.business || null,
      page_access_token: page.access_token || '',
      instagram_business_account_id: instagramId,
      instagram_username: instagram?.username || '',
      instagram_profile: instagram || null,
      endpoints: endpointMap({ pageId: page.id, instagramId, graphBase }),
    };
  });

  return {
    connection_id: connectionId,
    created_at: nowIso(),
    client: {
      name: client?.client || '',
      workflow: client?.workflow || '',
      invite_id: client?.invite_id || '',
    },
    meta_app: {
      app_id: appIdFromEnv(env),
      graph_version: version,
      redirect_uri: redirectUri,
    },
    oauth: {
      user_access_token: tokenPayload.long_lived.access_token,
      token_type: tokenPayload.long_lived.token_type || tokenPayload.short_lived.token_type || 'bearer',
      expires_in: tokenPayload.long_lived.expires_in || null,
      expires_at: expiresAt,
      granted_scopes: scopes,
      debug: debugData,
    },
    facebook_user: assets.user || null,
    businesses: assets.businesses || [],
    pages,
    agent_runtime_notes: [
      'Use page_access_token for Page and linked Instagram Graph API calls.',
      'Use endpoints.facebook_page_id / instagram_business_account_id as stable account IDs in agent config.',
      'Do not expose tokens to clients or public UIs; store them only in server-side secret storage.',
      'Meta may require App Review, business verification, and webhook subscription approval before third-party client production use.',
    ],
    required_for_outreach_agent: {
      app_id: appIdFromEnv(env),
      graph_version: version,
      user_token_present: Boolean(tokenPayload.long_lived.access_token),
      page_tokens_present: pages.some((page) => Boolean(page.page_access_token)),
      page_ids_present: pages.some((page) => Boolean(page.facebook_page_id)),
      instagram_ids_present: pages.some((page) => Boolean(page.instagram_business_account_id)),
      granted_scopes: scopes,
    },
  };
}

export function redactTokens(value) {
  if (Array.isArray(value)) return value.map((item) => redactTokens(item));
  if (!value || typeof value !== 'object') return value;
  const redacted = {};
  for (const [key, inner] of Object.entries(value)) {
    if (/token|secret|authorization/i.test(key)) {
      redacted[key] = inner ? '[stored-server-side]' : '';
    } else {
      redacted[key] = redactTokens(inner);
    }
  }
  return redacted;
}

function arrayValue(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function packageScopes(packageData = {}) {
  return arrayValue(packageData?.oauth?.granted_scopes)
    .concat(arrayValue(packageData?.required_for_outreach_agent?.granted_scopes))
    .filter(Boolean);
}

function cleanList(values = [], maxItems = 5) {
  return [...new Set(arrayValue(values).map((item) => clean(item, 180)).filter(Boolean))].slice(0, maxItems);
}

export function summarizeAgentPackage(packageData = {}, { origin = '' } = {}) {
  const connectionId = clean(packageData.connection_id || '', 120);
  const pages = arrayValue(packageData.pages).filter((page) => page && !page.error);
  const businesses = arrayValue(packageData.businesses).filter((business) => business && !business.error);
  const pageNames = cleanList(pages.map((page) => page.facebook_page_name || page.name || ''));
  const instagramUsernames = cleanList(pages.map((page) => page.instagram_username || page.instagram_profile?.username || ''));
  const businessNames = cleanList(businesses.map((business) => business.name || ''));
  const scopes = [...new Set(packageScopes(packageData))];
  const userTokenStored = Boolean(
    packageData?.required_for_outreach_agent?.user_token_present
      || packageData?.oauth?.user_access_token,
  );
  const pageTokensStored = Boolean(
    packageData?.required_for_outreach_agent?.page_tokens_present
      || pages.some((page) => page.page_access_token),
  );
  const pageIdsPresent = Boolean(
    packageData?.required_for_outreach_agent?.page_ids_present
      || pages.some((page) => page.facebook_page_id),
  );
  const instagramIdsPresent = Boolean(
    packageData?.required_for_outreach_agent?.instagram_ids_present
      || pages.some((page) => page.instagram_business_account_id),
  );
  const readyForAgent = Boolean(connectionId && userTokenStored && pageTokensStored && pageIdsPresent);
  const detailPath = `/api/social/meta/connections/${encodeURIComponent(connectionId)}?include=agent_package`;
  const facebookUserName = clean(packageData?.facebook_user?.name || packageData?.facebook_user?.id || '', 180);
  const primaryAccount = pageNames[0] || instagramUsernames[0] || facebookUserName || '';
  const inviteId = clean(packageData?.client?.invite_id || packageData?.invite_id || '', 120);

  return {
    connection_id: connectionId,
    service: 'meta',
    service_label: 'Facebook + Instagram',
    status: readyForAgent ? 'connected' : 'needs_attention',
    invite_id: inviteId,
    client_name: clean(packageData?.client?.name || packageData?.client_name || '', 160),
    workflow: clean(packageData?.client?.workflow || '', 500),
    connected_account: primaryAccount,
    facebook_user_name: facebookUserName,
    facebook_pages_count: pages.length,
    instagram_accounts_count: pages.filter((page) => page.instagram_business_account_id).length,
    businesses_count: businesses.length,
    facebook_page_names: pageNames,
    instagram_usernames: instagramUsernames,
    business_names: businessNames,
    created_at: clean(packageData.created_at || '', 80),
    user_token_stored: userTokenStored,
    page_tokens_stored: pageTokensStored,
    page_ids_present: pageIdsPresent,
    instagram_ids_present: instagramIdsPresent,
    granted_scopes_count: scopes.length,
    ready_for_agent: readyForAgent,
    detail_url: origin && connectionId ? `${origin}${detailPath}` : detailPath,
  };
}

export function buildAgentHandoff(packageData = {}, { origin = '' } = {}) {
  const summary = summarizeAgentPackage(packageData, { origin });
  const scopes = [...new Set(packageScopes(packageData))];
  return {
    handoff_type: 'clawdified.meta_social_agent_connection.v1',
    service: 'facebook_instagram',
    connection_id: summary.connection_id,
    invite_id: summary.invite_id,
    client_name: summary.client_name,
    workflow: summary.workflow,
    connected_account: summary.connected_account,
    created_at: summary.created_at,
    status: {
      ready_for_social_agent: summary.ready_for_agent,
      user_token_present: summary.user_token_stored,
      page_tokens_present: summary.page_tokens_stored,
      page_ids_present: summary.page_ids_present,
      instagram_ids_present: summary.instagram_ids_present,
    },
    meta: {
      app_id: packageData?.meta_app?.app_id || '',
      graph_version: packageData?.meta_app?.graph_version || DEFAULT_GRAPH_VERSION,
      redirect_uri: packageData?.meta_app?.redirect_uri || '',
      app_secret_source: 'META_APP_SECRET',
    },
    oauth: {
      auth_type: 'meta_oauth_long_lived_user_token_and_page_tokens',
      user_access_token: packageData?.oauth?.user_access_token || '',
      token_type: packageData?.oauth?.token_type || 'bearer',
      expires_at: packageData?.oauth?.expires_at || null,
      granted_scopes: scopes,
    },
    facebook_user: packageData?.facebook_user || null,
    businesses: packageData?.businesses || [],
    pages: packageData?.pages || [],
    clawdified: {
      dashboard_detail_url: summary.detail_url,
      connector: 'https://clawdified.com/connect/social/',
    },
    agent_instructions: [
      'This is a Clawdified Meta OAuth connection package for the named client/business.',
      'Use page_access_token values for Facebook Page and linked Instagram Graph API calls; use the endpoint map on each page object.',
      'Use user_access_token only server-side for approved Graph API operations and token/debug flows.',
      'Never expose user_access_token, page_access_token, app secrets, or this raw package to public/client-visible pages.',
      'Meta may still require App Review, business verification, advanced permission approval, and webhook subscription approval before broad third-party production use.',
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
      client: clean(fullAgentPackage?.client?.name || '', 120),
      invite: clean(fullAgentPackage?.client?.invite_id || '', 120),
      created_at: record.created_at,
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
    service: 'meta',
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

export function renderSuccessPage({ connectionId, publicPackage, returnTo = '' }) {
  const pageCount = (publicPackage.pages || []).filter((page) => page.facebook_page_id).length;
  const igCount = (publicPackage.pages || []).filter((page) => page.instagram_business_account_id).length;
  const scopes = publicPackage?.oauth?.granted_scopes || [];
  const returnLink = returnTo ? `<a class="button ghost" href="${escapeHtml(returnTo)}">Back to Clawdified</a>` : '<a class="button ghost" href="/connect/social/">Back to connector</a>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Social account connected | Clawdified</title>
<style>:root{color-scheme:dark;--bg:#0f0e0a;--panel:#17140e;--ink:#f8edda;--muted:rgba(248,237,218,.72);--line:rgba(248,237,218,.14);--gold:#f1b45b;--orange:#d48553;--green:#7ad99d}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 0%,rgba(241,180,91,.18),transparent 34rem),var(--bg);color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;place-items:center;padding:24px}.card{max-width:880px;width:100%;border:1px solid var(--line);background:rgba(23,20,14,.9);border-radius:28px;padding:34px;box-shadow:0 28px 90px rgba(0,0,0,.35)}.eyebrow{color:var(--green);text-transform:uppercase;letter-spacing:.18em;font-size:12px;font-weight:800}h1{font-family:Georgia,serif;font-size:clamp(36px,7vw,72px);line-height:.95;margin:12px 0 16px;font-weight:500}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.stat{border:1px solid var(--line);border-radius:18px;padding:16px;background:rgba(255,255,255,.035)}.stat b{display:block;font-size:28px;color:var(--gold)}p,li{color:var(--muted);line-height:1.55}.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;border:1px solid var(--line);background:#080705;border-radius:14px;padding:12px;overflow:auto}.button{display:inline-flex;align-items:center;justify-content:center;margin-top:10px;margin-right:10px;padding:12px 16px;border-radius:999px;background:linear-gradient(135deg,var(--gold),var(--orange));color:#1a1008;text-decoration:none;font-weight:800}.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}@media(max-width:700px){.grid{grid-template-columns:1fr}.card{padding:24px}}</style></head>
<body><main class="card"><div class="eyebrow">Connected</div><h1>Facebook + Instagram authorization is complete.</h1>
<p>Clawdified received the OAuth callback, discovered the authorized Page/Instagram assets, and stored the agent-ready package server-side. No tokens are shown on this public success page.</p>
<div class="grid"><div class="stat"><b>${escapeHtml(pageCount)}</b><span>Facebook Pages</span></div><div class="stat"><b>${escapeHtml(igCount)}</b><span>Instagram accounts</span></div><div class="stat"><b>${escapeHtml(scopes.length)}</b><span>Granted scopes</span></div></div>
<p><strong>Connection ID</strong></p><div class="code">${escapeHtml(connectionId)}</div>
<p>Give this ID to Wesley if he asks. The protected admin endpoint can pull the full agent package, including tokens and Graph endpoints, using the server-side admin token.</p>
${returnLink}</main></body></html>`;
}

export function renderErrorPage({ title = 'Connection failed', message = '', details = [] }) {
  const items = details.length ? `<ul>${details.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | Clawdified</title><style>:root{color-scheme:dark;--bg:#0f0e0a;--panel:#17140e;--ink:#f8edda;--muted:rgba(248,237,218,.72);--line:rgba(248,237,218,.14);--orange:#d48553}body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;place-items:center;padding:24px}.card{max-width:760px;border:1px solid var(--line);background:var(--panel);border-radius:24px;padding:30px}h1{font-family:Georgia,serif;font-size:clamp(34px,6vw,64px);line-height:.95;margin:0 0 14px;font-weight:500}p,li{color:var(--muted);line-height:1.55}.button{display:inline-flex;margin-top:12px;padding:12px 16px;border-radius:999px;border:1px solid var(--line);color:var(--ink);text-decoration:none}</style></head><body><main class="card"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${items}<a class="button" href="/connect/social/">Back to connector</a></main></body></html>`;
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

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
