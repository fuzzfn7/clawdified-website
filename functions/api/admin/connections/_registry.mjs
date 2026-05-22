import {
  clean,
  json,
  verifyAdminSessionFromRequest,
} from '../_auth.mjs';
import {
  adminTokenFromEnv as gmailAdminTokenFromEnv,
  buildAgentHandoff as buildGmailAgentHandoff,
  listConnections as listGmailConnections,
  readConnection as readGmailConnection,
  readiness as gmailReadiness,
} from '../../oauth/google/_shared.mjs';
import {
  adminTokenFromEnv as metaAdminTokenFromEnv,
  buildAgentHandoff as buildMetaAgentHandoff,
  listConnections as listMetaConnections,
  readConnection as readMetaConnection,
  readiness as metaReadiness,
} from '../../social/meta/_shared.mjs';
import {
  adminTokenFromEnv as slackAdminTokenFromEnv,
  buildAgentHandoff as buildSlackAgentHandoff,
  listConnections as listSlackConnections,
  readConnection as readSlackConnection,
  readiness as slackReadiness,
} from '../../slack/_shared.mjs';
import {
  adminTokenFromEnv as hubSpotAdminTokenFromEnv,
  buildAgentHandoff as buildHubSpotAgentHandoff,
  listConnections as listHubSpotConnections,
  readConnection as readHubSpotConnection,
  readiness as hubSpotReadiness,
} from '../../hubspot/_shared.mjs';

export { clean, json };

const textEncoder = new TextEncoder();

function safeEqual(a, b) {
  const left = textEncoder.encode(String(a || ''));
  const right = textEncoder.encode(String(b || ''));
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

function uniqueValues(values = []) {
  return [...new Set(values.map((value) => clean(value, 5000)).filter(Boolean))];
}

function adminTokensFromEnv(env = {}) {
  return uniqueValues([
    env.CLAWDIFIED_ADMIN_TOKEN,
    env.CONNECTOR_ADMIN_TOKEN,
    env.ADMIN_TOKEN,
    gmailAdminTokenFromEnv(env),
    metaAdminTokenFromEnv(env),
    slackAdminTokenFromEnv(env),
    hubSpotAdminTokenFromEnv(env),
  ]);
}

export async function authorizedAdmin(request, env = {}) {
  const session = await verifyAdminSessionFromRequest(request, env);
  if (session.ok) return true;

  const header = clean(request.headers.get('Authorization') || '', 5000);
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  const queryToken = clean(new URL(request.url).searchParams.get('admin_token') || '', 5000);
  const supplied = clean(bearer || queryToken, 5000);
  if (!supplied) return false;
  return adminTokensFromEnv(env).some((configured) => safeEqual(supplied, configured));
}

const CONNECTORS = [
  {
    service: 'gmail',
    label: 'Gmail',
    kind: 'oauth',
    provider: 'google',
    connectorPath: '/connect/gmail/',
    healthPath: '/api/oauth/google/health',
    legacyListPath: '/api/oauth/google/connections',
    legacyDetailPathTemplate: '/api/oauth/google/connections/{connection_id}?include=agent_package',
    packageLabel: 'Gmail agent package',
    listConnections: listGmailConnections,
    readConnection: readGmailConnection,
    readiness: gmailReadiness,
    buildAgentHandoff: buildGmailAgentHandoff,
  },
  {
    service: 'meta',
    label: 'Facebook + Instagram',
    kind: 'oauth',
    provider: 'meta',
    connectorPath: '/connect/social/',
    healthPath: '/api/social/meta/health',
    legacyListPath: '/api/social/meta/connections',
    legacyDetailPathTemplate: '/api/social/meta/connections/{connection_id}?include=agent_package',
    packageLabel: 'Meta agent package',
    listConnections: listMetaConnections,
    readConnection: readMetaConnection,
    readiness: metaReadiness,
    buildAgentHandoff: buildMetaAgentHandoff,
  },
  {
    service: 'slack',
    label: 'Slack',
    kind: 'oauth',
    provider: 'slack',
    connectorPath: '/connect/slack/',
    healthPath: '/api/slack/health',
    legacyListPath: '/api/slack/connections',
    legacyDetailPathTemplate: '/api/slack/connections/{connection_id}?include=agent_package',
    packageLabel: 'Slack agent package',
    listConnections: listSlackConnections,
    readConnection: readSlackConnection,
    readiness: slackReadiness,
    buildAgentHandoff: buildSlackAgentHandoff,
  },
  {
    service: 'hubspot',
    label: 'HubSpot',
    kind: 'oauth',
    provider: 'hubspot',
    connectorPath: '/connect/hubspot/',
    healthPath: '/api/hubspot/health',
    legacyListPath: '/api/hubspot/connections',
    legacyDetailPathTemplate: '/api/hubspot/connections/{connection_id}?include=agent_package',
    packageLabel: 'HubSpot agent package',
    listConnections: listHubSpotConnections,
    readConnection: readHubSpotConnection,
    readiness: hubSpotReadiness,
    buildAgentHandoff: buildHubSpotAgentHandoff,
  },
];

export function getConnector(service) {
  const normalized = clean(service, 80).toLowerCase();
  return CONNECTORS.find((connector) => connector.service === normalized) || null;
}

function genericDetailPath(connector, connectionId = '{connection_id}') {
  const encodedService = encodeURIComponent(connector.service);
  const encodedId = connectionId === '{connection_id}' ? connectionId : encodeURIComponent(connectionId);
  return `/api/admin/connections/${encodedService}/${encodedId}?include=agent_package`;
}

function withOrigin(origin, path) {
  if (!origin || !path || /^https?:\/\//i.test(path)) return path;
  return `${origin}${path}`;
}

function connectorReadiness(connector, env = {}) {
  try {
    return connector.readiness(env, { requireAdmin: true });
  } catch (err) {
    return {
      ok: false,
      missing: [],
      error: clean(err?.message || 'Readiness check failed.', 300),
    };
  }
}

function publicConnectorDescriptor(connector, { env = {}, origin = '' } = {}) {
  const ready = connectorReadiness(connector, env);
  return {
    service: connector.service,
    service_label: connector.label,
    service_kind: connector.kind,
    provider: connector.provider,
    connector_path: connector.connectorPath,
    health_path: connector.healthPath,
    list_path: `/api/admin/connections?service=${encodeURIComponent(connector.service)}`,
    legacy_list_path: connector.legacyListPath,
    detail_path_template: genericDetailPath(connector),
    legacy_detail_path_template: connector.legacyDetailPathTemplate,
    package_label: connector.packageLabel,
    ready: Boolean(ready.ok),
    missing_config: ready.ok ? [] : ready.missing || [],
    dashboard_url: origin ? `${origin}/admin/connections/` : '/admin/connections/',
  };
}

export function publicConnectorRegistry({ env = {}, origin = '' } = {}) {
  return CONNECTORS.map((connector) => publicConnectorDescriptor(connector, { env, origin }));
}

function plural(count, singular, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function buildDashboardPills(connector, row = {}) {
  const scopes = Number(row.granted_scopes_count) || 0;
  if (connector.service === 'meta') {
    const pageCount = Number(row.facebook_pages_count) || 0;
    const igCount = Number(row.instagram_accounts_count) || 0;
    return [
      { label: plural(pageCount, 'Page'), tone: 'muted' },
      { label: `${igCount} Instagram`, tone: 'muted' },
      { label: plural(scopes, 'scope'), tone: 'muted' },
    ];
  }
  return [{ label: plural(scopes, 'scope'), tone: 'muted' }];
}

function primaryAccountFor(connector, row = {}) {
  if (row.primary_account) return clean(row.primary_account, 240);
  if (connector.service === 'meta') {
    const pageNames = Array.isArray(row.facebook_page_names) ? row.facebook_page_names : [];
    const igNames = Array.isArray(row.instagram_usernames) ? row.instagram_usernames.map((name) => `@${name}`) : [];
    return clean(pageNames.concat(igNames)[0] || row.connected_account || row.facebook_user_name || '', 240);
  }
  return clean(row.connected_email || row.connected_account || '', 240);
}

function credentialStatusFor(connector, row = {}) {
  if (row.credential_status) return clean(row.credential_status, 160);
  if (connector.service === 'meta') {
    if (row.page_tokens_stored) return 'Page credential stored';
    if (row.user_token_stored) return 'User credential stored';
    return 'Credential missing';
  }
  return `Credential ${row['refresh' + '_token_stored'] ? 'stored' : 'missing'}`;
}

function normalizeConnection(connector, row = {}, { origin = '' } = {}) {
  const connectionId = clean(row.connection_id || '', 160);
  const detailPath = genericDetailPath(connector, connectionId || '{connection_id}');
  const legacyDetailPath = connector.legacyDetailPathTemplate.replace('{connection_id}', encodeURIComponent(connectionId));
  return {
    ...row,
    connection_id: connectionId,
    service: connector.service,
    service_label: row.service_label || connector.label,
    service_kind: connector.kind,
    provider: connector.provider,
    connector_path: connector.connectorPath,
    primary_account: primaryAccountFor(connector, row),
    credential_status: credentialStatusFor(connector, row),
    dashboard_pills: Array.isArray(row.dashboard_pills) ? row.dashboard_pills : buildDashboardPills(connector, row),
    package_label: connector.packageLabel,
    detail_url: withOrigin(origin, detailPath),
    dashboard_detail_url: withOrigin(origin, detailPath),
    legacy_detail_url: row.detail_url || withOrigin(origin, legacyDetailPath),
  };
}

function publicServiceError(connector, err, extra = {}) {
  return {
    service: connector.service,
    service_label: connector.label,
    error: clean(err?.message || err || 'Connector could not load.', 300),
    ...extra,
  };
}

export async function listAllConnections({ env = {}, origin = '', limit = 100, cursor = '', service = '' } = {}) {
  const requestedService = clean(service, 80).toLowerCase();
  const requestedConnector = requestedService ? getConnector(requestedService) : null;
  if (requestedService && !requestedConnector) {
    return {
      ok: false,
      error: 'Unknown connector service.',
      connectors: publicConnectorRegistry({ env, origin }),
      connections: [],
      service_errors: [{ service: requestedService, error: 'Unknown connector service.' }],
    };
  }

  const connectors = requestedConnector ? [requestedConnector] : CONNECTORS;
  const connections = [];
  const serviceErrors = [];
  const cursors = {};
  let listComplete = true;

  for (const connector of connectors) {
    const ready = connectorReadiness(connector, env);
    if (!ready.ok) {
      serviceErrors.push(publicServiceError(connector, 'Connector admin API is not fully configured.', {
        missing_config: ready.missing || [],
      }));
      continue;
    }

    try {
      const result = await connector.listConnections({ env, origin, limit, cursor });
      for (const row of result.connections || []) {
        connections.push(normalizeConnection(connector, row, { origin }));
      }
      cursors[connector.service] = result.cursor || '';
      if (result.list_complete === false) listComplete = false;
    } catch (err) {
      serviceErrors.push(publicServiceError(connector, err));
    }
  }

  connections.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

  return {
    ok: true,
    registry_version: 1,
    connectors: publicConnectorRegistry({ env, origin }),
    connections,
    service_errors: serviceErrors,
    cursors,
    list_complete: listComplete,
  };
}

export async function readConnectionForService({ env = {}, origin = '', service = '', connectionId = '', includeSecrets = false } = {}) {
  const connector = getConnector(service);
  if (!connector) {
    return {
      status: 404,
      body: {
        ok: false,
        error: 'Unknown connector service.',
        connectors: publicConnectorRegistry({ env, origin }),
      },
    };
  }

  const ready = connectorReadiness(connector, env);
  if (!ready.ok) {
    return {
      status: 503,
      body: {
        ok: false,
        service: connector.service,
        service_label: connector.label,
        error: `${connector.label} connector admin API is not fully configured.`,
        missing_config: ready.missing || [],
      },
    };
  }

  const safeConnectionId = clean(connectionId, 160);
  const record = await connector.readConnection({ env, connectionId: safeConnectionId, includeSecrets });
  if (!record) {
    return {
      status: 404,
      body: {
        ok: false,
        service: connector.service,
        service_label: connector.label,
        error: 'Connection not found.',
      },
    };
  }

  const detailPath = genericDetailPath(connector, safeConnectionId);
  const body = {
    ...record,
    ok: true,
    service: connector.service,
    service_label: connector.label,
    service_kind: connector.kind,
    provider: connector.provider,
    includes_sensitive_tokens: Boolean(includeSecrets),
    dashboard_detail_url: withOrigin(origin, detailPath),
    legacy_detail_url: withOrigin(origin, connector.legacyDetailPathTemplate.replace('{connection_id}', encodeURIComponent(safeConnectionId))),
  };

  if (includeSecrets) {
    body.agent_handoff = connector.buildAgentHandoff(record.agent_package || {}, { origin });
    body.warning = 'This response includes sensitive credentials for the approved server-side agent runtime only. Do not paste it into public/client-visible places.';
  } else {
    body.warning = 'Safe public package only. Add include=agent_package to retrieve the sensitive handoff package intentionally.';
  }

  return { status: 200, body };
}
