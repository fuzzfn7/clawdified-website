import { authorizedAdmin, clean, json } from '../connections/_registry.mjs';

const REQUEST_KEY_PREFIX = 'connector-request:';
const REQUEST_TYPE = 'clawdified.connector_request.v1';

function hasKv(env = {}) {
  return Boolean(env.SOCIAL_CONNECTOR_KV && typeof env.SOCIAL_CONNECTOR_KV.get === 'function' && typeof env.SOCIAL_CONNECTOR_KV.put === 'function');
}

function unauthorized() {
  return json({ ok: false, error: 'Unauthorized.' }, 401, {
    'WWW-Authenticate': 'Bearer realm="clawdified-connector-requests"',
  });
}

function nowIso() {
  return new Date().toISOString();
}

function slugify(value) {
  const slug = clean(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  return slug || 'connector';
}

function sanitizeRequestId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 120);
}

function storageKey(requestId) {
  return `${REQUEST_KEY_PREFIX}${sanitizeRequestId(requestId)}`;
}

async function parseJsonRequest(request) {
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

function normalizeAuthType(value) {
  const authType = clean(value || 'unknown', 80).toLowerCase().replace(/[^a-z0-9_+-]+/g, '_');
  return authType || 'unknown';
}

function normalizeConnectorRequest(body = {}) {
  const clientName = clean(body.client_name || body.client || body.business || '', 160);
  const softwareName = clean(body.software_name || body.software || body.app_name || body.platform || '', 160);
  const workflow = clean(body.workflow || body.workflow_label || '', 600);
  const authType = normalizeAuthType(body.auth_type || body.authentication || body.oauth_or_api || 'unknown');
  const apiBaseUrl = clean(body.api_base_url || body.base_url || body.endpoint || '', 500);
  const docsUrl = clean(body.docs_url || body.documentation_url || '', 500);
  const needs = clean(body.needs || body.connection_needs || body.notes || '', 2000);
  const scopes = Array.isArray(body.scopes)
    ? body.scopes.map((scope) => clean(scope, 180)).filter(Boolean).slice(0, 40)
    : clean(body.scopes || '', 2000).split(/[\n,]+/).map((scope) => clean(scope, 180)).filter(Boolean).slice(0, 40);
  const sampleEndpoints = Array.isArray(body.sample_endpoints)
    ? body.sample_endpoints.map((endpoint) => clean(endpoint, 300)).filter(Boolean).slice(0, 30)
    : clean(body.sample_endpoints || body.endpoints || '', 3000).split(/[\n,]+/).map((endpoint) => clean(endpoint, 300)).filter(Boolean).slice(0, 30);

  return {
    clientName,
    softwareName,
    workflow,
    authType,
    apiBaseUrl,
    docsUrl,
    needs,
    scopes,
    sampleEndpoints,
  };
}

function validateRequestSpec(spec) {
  if (!spec.clientName) return 'client_name is required.';
  if (!spec.softwareName) return 'software_name is required.';
  return '';
}

function publicRequest(record = {}) {
  return {
    type: REQUEST_TYPE,
    request_id: record.request_id,
    status: record.status || 'requested',
    client_name: record.client_name || '',
    workflow: record.workflow || '',
    software_name: record.software_name || '',
    auth_type: record.auth_type || 'unknown',
    api_base_url: record.api_base_url || '',
    docs_url: record.docs_url || '',
    needs: record.needs || '',
    scopes: Array.isArray(record.scopes) ? record.scopes : [],
    sample_endpoints: Array.isArray(record.sample_endpoints) ? record.sample_endpoints : [],
    created_at: record.created_at || '',
    updated_at: record.updated_at || record.created_at || '',
    builder_webhook_status: record.builder_webhook_status || 'not_configured',
  };
}

async function dispatchBuilderWebhook({ env = {}, requestRecord = {}, origin = '' } = {}) {
  const webhookUrl = clean(env.CONNECTOR_BUILDER_WEBHOOK_URL || '', 1000);
  if (!webhookUrl) return { dispatched: false, status: 'not_configured' };

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const token = clean(env.CONNECTOR_BUILDER_WEBHOOK_TOKEN || '', 5000);
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: 'clawdified.connector_builder_request.v1',
      origin,
      request: publicRequest(requestRecord),
      instructions: [
        'Build or update a connector adapter using tests first.',
        'Do not expose client credentials in public pages.',
        'Return exact files changed, tests run, and deployment status.',
      ],
    }),
  });

  return {
    dispatched: response.ok,
    status: response.ok ? 'dispatched' : `failed_${response.status}`,
  };
}

async function createRequest({ env = {}, origin = '', body = {} } = {}) {
  if (!hasKv(env)) {
    return { status: 503, body: { ok: false, error: 'SOCIAL_CONNECTOR_KV binding is not configured.' } };
  }

  const spec = normalizeConnectorRequest(body);
  const validationError = validateRequestSpec(spec);
  if (validationError) return { status: 400, body: { ok: false, error: validationError } };

  const suffix = crypto.randomUUID().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 12);
  const requestId = sanitizeRequestId(`connector_req_${slugify(spec.softwareName)}-${suffix}`);
  const createdAt = nowIso();
  const requestRecord = {
    type: REQUEST_TYPE,
    request_id: requestId,
    status: 'requested',
    client_name: spec.clientName,
    workflow: spec.workflow,
    software_name: spec.softwareName,
    auth_type: spec.authType,
    api_base_url: spec.apiBaseUrl,
    docs_url: spec.docsUrl,
    needs: spec.needs,
    scopes: spec.scopes,
    sample_endpoints: spec.sampleEndpoints,
    created_at: createdAt,
    updated_at: createdAt,
    builder_webhook_status: 'not_configured',
  };

  let webhookResult = { dispatched: false, status: 'not_configured' };
  try {
    webhookResult = await dispatchBuilderWebhook({ env, requestRecord, origin });
  } catch (_err) {
    webhookResult = { dispatched: false, status: 'failed' };
  }
  requestRecord.builder_webhook_status = webhookResult.status;

  await env.SOCIAL_CONNECTOR_KV.put(storageKey(requestId), JSON.stringify(requestRecord), {
    metadata: {
      client: spec.clientName,
      software: spec.softwareName,
      auth_type: spec.authType,
      type: 'connector_request',
      created_at: createdAt,
    },
  });

  return {
    status: 201,
    body: {
      ok: true,
      request: publicRequest(requestRecord),
      webhook_dispatched: webhookResult.dispatched,
      includes_sensitive_tokens: false,
    },
  };
}

async function listRequests({ env = {}, limit = 100 } = {}) {
  if (!hasKv(env)) {
    return { status: 503, body: { ok: false, error: 'SOCIAL_CONNECTOR_KV binding is not configured.', requests: [] } };
  }
  if (typeof env.SOCIAL_CONNECTOR_KV.list !== 'function') {
    return { status: 503, body: { ok: false, error: 'SOCIAL_CONNECTOR_KV list support is not configured.', requests: [] } };
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const listed = await env.SOCIAL_CONNECTOR_KV.list({ prefix: REQUEST_KEY_PREFIX, limit: safeLimit });
  const requests = [];
  for (const key of listed.keys || []) {
    const raw = await env.SOCIAL_CONNECTOR_KV.get(key.name);
    if (!raw) continue;
    try {
      requests.push(publicRequest(JSON.parse(raw)));
    } catch (_err) {
      // Skip malformed rows.
    }
  }
  requests.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return {
    status: 200,
    body: {
      ok: true,
      requests,
      list_complete: listed.list_complete !== false,
      includes_sensitive_tokens: false,
    },
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await authorizedAdmin(request, env))) return unauthorized();
  const url = new URL(request.url);
  const result = await listRequests({ env, limit: Number(url.searchParams.get('limit') || 100) });
  return json(result.body, result.status);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await authorizedAdmin(request, env))) return unauthorized();

  let body;
  try {
    body = await parseJsonRequest(request);
  } catch (err) {
    return json({ ok: false, error: clean(err?.message || 'Invalid JSON.', 300) }, err?.status || 400);
  }

  const result = await createRequest({ env, origin: new URL(request.url).origin, body });
  return json(result.body, result.status);
}
