import {
  clean,
  json,
  listAllConnections,
  publicConnectorRegistry,
} from '../connections/_registry.mjs';

export { clean, json };

const INVITE_KEY_PREFIX = 'client-invite:';
const INVITE_TYPE = 'clawdified.client_connector_invite.v1';

function hasKv(env = {}) {
  return Boolean(env.SOCIAL_CONNECTOR_KV && typeof env.SOCIAL_CONNECTOR_KV.get === 'function' && typeof env.SOCIAL_CONNECTOR_KV.put === 'function');
}

function slugify(value) {
  const slug = clean(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  return slug || 'client';
}

export function inviteStorageKey(inviteId) {
  return `${INVITE_KEY_PREFIX}${sanitizeInviteId(inviteId)}`;
}

export function sanitizeInviteId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 120);
}

function nowIso() {
  return new Date().toISOString();
}

function connectorServicesFromRegistry({ env = {}, origin = '' } = {}) {
  return publicConnectorRegistry({ env, origin }).map((connector) => connector.service);
}

function normalizeConnectorServices(rawServices, { env = {}, origin = '' } = {}) {
  const available = new Set(connectorServicesFromRegistry({ env, origin }));
  const input = Array.isArray(rawServices) ? rawServices : [];
  const services = [];
  const unknown = [];
  for (const value of input) {
    const service = clean(value, 80).toLowerCase();
    if (!service) continue;
    if (!available.has(service)) {
      unknown.push(service);
      continue;
    }
    if (!services.includes(service)) services.push(service);
  }
  return { services, unknown };
}

function withConnectUrl(invite, origin = '') {
  const safeInviteId = sanitizeInviteId(invite.invite_id);
  return {
    ...invite,
    connect_url: origin ? `${origin}/connect/client/?invite=${encodeURIComponent(safeInviteId)}` : `/connect/client/?invite=${encodeURIComponent(safeInviteId)}`,
  };
}

export async function parseJsonRequest(request) {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (_err) {
    const error = new Error('Request body must be valid JSON.');
    error.status = 400;
    throw error;
  }
}

export async function createClientInvite({ env = {}, origin = '', body = {} } = {}) {
  if (!hasKv(env)) {
    return { status: 503, body: { ok: false, error: 'SOCIAL_CONNECTOR_KV binding is not configured.' } };
  }

  const clientName = clean(body.client_name || body.client || body.business || '', 160);
  const workflow = clean(body.workflow || body.notes || '', 500);
  const notes = clean(body.notes || body.internal_notes || '', 1000);
  const { services, unknown } = normalizeConnectorServices(body.connectors || body.connector_services || body.services || [], { env, origin });

  if (!clientName) {
    return { status: 400, body: { ok: false, error: 'client_name is required.' } };
  }
  if (unknown.length) {
    return { status: 400, body: { ok: false, error: 'Unknown connector service.', unknown_services: unknown } };
  }
  if (!services.length) {
    return { status: 400, body: { ok: false, error: 'At least one connector is required.' } };
  }

  const suffix = crypto.randomUUID().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 12);
  const inviteId = sanitizeInviteId(`invite_${slugify(clientName)}-${suffix}`);
  const createdAt = nowIso();
  const invite = {
    ok: true,
    type: INVITE_TYPE,
    invite_id: inviteId,
    client_name: clientName,
    workflow,
    notes,
    connector_services: services,
    status: 'active',
    created_at: createdAt,
    updated_at: createdAt,
  };

  await env.SOCIAL_CONNECTOR_KV.put(inviteStorageKey(inviteId), JSON.stringify(invite), {
    metadata: {
      client: clientName,
      services: services.join(','),
      created_at: createdAt,
      type: 'client_invite',
    },
  });

  return { status: 201, body: { ok: true, invite: withConnectUrl(invite, origin), includes_sensitive_tokens: false } };
}

export async function readClientInvite({ env = {}, origin = '', inviteId = '' } = {}) {
  if (!hasKv(env)) {
    return { status: 503, body: { ok: false, error: 'SOCIAL_CONNECTOR_KV binding is not configured.' } };
  }
  const safeInviteId = sanitizeInviteId(inviteId);
  if (!safeInviteId) {
    return { status: 400, body: { ok: false, error: 'Invite ID is required.' } };
  }
  const raw = await env.SOCIAL_CONNECTOR_KV.get(inviteStorageKey(safeInviteId));
  if (!raw) {
    return { status: 404, body: { ok: false, error: 'Client invite not found.' } };
  }
  const invite = JSON.parse(raw);
  return { status: 200, body: { ok: true, invite: withConnectUrl(invite, origin), includes_sensitive_tokens: false } };
}

export async function listClientInvites({ env = {}, origin = '', limit = 100 } = {}) {
  if (!hasKv(env)) {
    return { status: 503, body: { ok: false, error: 'SOCIAL_CONNECTOR_KV binding is not configured.', invites: [] } };
  }
  const listed = await env.SOCIAL_CONNECTOR_KV.list({ prefix: INVITE_KEY_PREFIX, limit });
  const invites = [];
  for (const key of listed.keys || []) {
    const raw = await env.SOCIAL_CONNECTOR_KV.get(key.name);
    if (!raw) continue;
    try {
      invites.push(withConnectUrl(JSON.parse(raw), origin));
    } catch (_err) {
      // Skip malformed legacy rows instead of breaking the dashboard.
    }
  }
  invites.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return {
    status: 200,
    body: {
      ok: true,
      invites,
      list_complete: listed.list_complete !== false,
      includes_sensitive_tokens: false,
    },
  };
}

function buildConnectorUrl(connector, invite, origin = '') {
  const url = new URL(connector.connector_path || '/', origin || 'https://clawdified.com');
  if (invite.client_name) url.searchParams.set('client', invite.client_name);
  if (invite.workflow) url.searchParams.set('workflow', invite.workflow);
  url.searchParams.set('invite', invite.invite_id);
  url.searchParams.set('return_to', `/connect/client/?invite=${invite.invite_id}`);
  return url.toString();
}

function publicConnectionStatus(invite, connections = []) {
  const byService = new Map();
  for (const row of connections) {
    const matchesInvite = row.invite_id && row.invite_id === invite.invite_id;
    const matchesLegacyClient = !row.invite_id && invite.client_name && row.client_name === invite.client_name;
    if (!matchesInvite && !matchesLegacyClient) continue;
    const existing = byService.get(row.service);
    if (!existing || String(row.created_at || '').localeCompare(String(existing.created_at || '')) > 0) {
      byService.set(row.service, row);
    }
  }
  return byService;
}

export async function publicClientInvitePackage({ env = {}, origin = '', inviteId = '' } = {}) {
  const read = await readClientInvite({ env, origin, inviteId });
  if (read.status !== 200) return read;

  const invite = read.body.invite;
  const requested = new Set(invite.connector_services || []);
  const descriptors = publicConnectorRegistry({ env, origin }).filter((connector) => requested.has(connector.service));

  let connectionStatus = new Map();
  try {
    const all = await listAllConnections({ env, origin, limit: 100 });
    connectionStatus = publicConnectionStatus(invite, all.connections || []);
  } catch (_err) {
    connectionStatus = new Map();
  }

  const connectors = descriptors.map((connector) => {
    const row = connectionStatus.get(connector.service);
    return {
      ...connector,
      connect_url: buildConnectorUrl(connector, invite, origin),
      connection_status: row?.ready_for_agent ? 'connected' : 'needed',
      connected_account: row?.primary_account || row?.connected_email || row?.connected_account || '',
      connected_at: row?.created_at || '',
    };
  });

  return {
    status: 200,
    body: {
      ok: true,
      invite,
      connectors,
      includes_sensitive_tokens: false,
      warning: 'Public client connector page data only. Credentials and agent handoff packages stay behind protected admin routes.',
    },
  };
}
