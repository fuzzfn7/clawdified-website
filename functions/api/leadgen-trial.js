// CLAWDIFIED_LEAD_AGENT_SHOWROOM_20260528
// Retired public lead-search endpoint.
// The public Lead Growth page is now a Clawdified showroom: visitors can watch
// the configured Clawdified demo populate example rows, but cannot pull a real
// company-specific lead list from a public API route.

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const RETIRED_SHOWROOM_MARKER = 'CLAWDIFIED_LEAD_AGENT_SHOWROOM_20260528';

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: jsonHeaders });
}

function retiredLeadgenTrialBody() {
  return {
    ok: false,
    endpoint: '/api/leadgen-trial',
    status: 'retired',
    mode: 'clawdified_agent_showroom',
    marker: RETIRED_SHOWROOM_MARKER,
    error: 'The public Lead Growth search endpoint has been retired. The public site now shows a Clawdified showroom run; real company-specific lead generation happens only after a private Clawdified engagement.',
    replacement: '/agents/lead-growth/ Clawdified showroom demo',
    external_writes_enabled: false,
    paid_reveal_enabled: false,
    auto_send_enabled: false,
    raw_provider_payloads_returned: false,
    leads: [],
  };
}

export async function onRequestPost() {
  return json(retiredLeadgenTrialBody(), 410);
}

export async function onRequestGet() {
  return json({
    ...retiredLeadgenTrialBody(),
    ok: true,
    method: 'POST retired',
    required_fields: [],
    optional_fields: [],
  });
}
