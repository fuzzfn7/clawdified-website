// REAL_LEADGEN_PUBLIC_SEARCH_20260526
// Capped, server-side public-search wrapper for the Lead Growth public preview.
// Uses env.SERPER_API_KEY (Serper Places / Search) to find real candidate
// buyer businesses for the visitor's website + ICP + geography. No Apollo
// reveal, no Browserbase, no MCP from browser. Direct contacts stay gated.
// When env.SOCIAL_CONNECTOR_KV is bound, per-IP (hashed) and global daily
// caps are enforced via KV so the wrapper is safe to leave publicly reachable.

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const MAX_PROVIDER_RESULTS_INSPECTED = 10;
const MAX_LEADS_RETURNED = 3;
const HOMEPAGE_FETCH_TIMEOUT_MS = 6000;
const HOMEPAGE_FETCH_CAP_BYTES = 200 * 1024;
const SERPER_TIMEOUT_MS = 10000;
const PER_IP_DAILY_CAP = 3;
const GLOBAL_DAILY_CAP = 30;
const RATE_LIMIT_KV_TTL_SECONDS = 60 * 60 * 26;

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: jsonHeaders });
}

function clean(value, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function parseHost(value) {
  let text = clean(value, 240).toLowerCase();
  text = text.replace(/^https?:\/\//, '').replace(/^\/+/, '').split(/[\s/?#]/)[0].replace(/^www\./, '');
  return text;
}

function isPrivateOrInvalidHost(host) {
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) return true;
  if (host.endsWith('.example') || host.endsWith('.test') || host.endsWith('.invalid')) return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) return true;
  if (host.includes(':')) return true;
  if (!/^[a-z0-9][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$/.test(host)) return true;
  if (host.length > 253) return true;
  return false;
}

function brandFrom(host) {
  const base = String(host || '').split('.')[0].replace(/[-_]+/g, ' ').trim();
  if (!base) return 'Your Business';
  return base.replace(/\b\w/g, (m) => m.toUpperCase());
}

function inferBusinessCategory(host, offer, businessRead) {
  const lower = `${host} ${offer || ''} ${businessRead?.title || ''} ${businessRead?.description || ''}`.toLowerCase();
  if (/net3it|managed\s*it|\bit\b|msp|cyber|network|cloud|technology|tech\s*support|computer\s*support|help\s*desk/.test(lower)) {
    return {
      category: 'it-services',
      offer: offer || 'managed IT, cybersecurity, network, and cloud support',
      defaultIcpHint: 'small and mid-sized businesses that need dependable managed IT, cybersecurity, help-desk, network, or cloud support',
      likelyBuyer: 'operations, office, finance, and practice leaders at SMBs with recurring technology support needs',
      leadAngle: 'managed IT support, cybersecurity risk reduction, help-desk response, network reliability, and cloud migration',
      targetTerms: ['dental office', 'accounting firm', 'law firm', 'manufacturing company', 'logistics company', 'medical clinic', 'property management'],
    };
  }
  if (/hvac|roof|plumb|electric|contractor|construction|repair|restoration|field\s*service|home\s*service/.test(lower)) {
    return {
      category: 'trades',
      offer: offer || 'trade services, repairs, maintenance, and project work',
      defaultIcpHint: 'property managers, builders, facility leaders, and homeowners with recurring service or project needs',
      likelyBuyer: 'property managers, builders, facilities teams, and homeowners',
      leadAngle: 'reliable service response, estimate turnaround, scheduling, maintenance, and post-job follow-up',
      targetTerms: ['property management company', 'general contractor', 'facility management', 'commercial real estate'],
    };
  }
  if (/clean|janitorial|facility\s*services/.test(lower)) {
    return {
      category: 'trades',
      offer: offer || 'commercial cleaning and facility services',
      defaultIcpHint: 'office managers, property managers, facility leaders, and recurring-service buyers',
      likelyBuyer: 'office managers, property owners, and operations managers',
      leadAngle: 'recurring facility service, quality check-ins, quote follow-up, and renewal conversations',
      targetTerms: ['office building', 'property management', 'medical office', 'church', 'school'],
    };
  }
  if (/dental|clinic|practice|medical|therapy|wellness|veterinary/.test(lower)) {
    return {
      category: 'professional-services',
      offer: offer || 'local healthcare/professional practice services',
      defaultIcpHint: 'families, local employers, referral partners, and office managers who need reliable professional healthcare services',
      likelyBuyer: 'local patients, employers, referral partners, and office managers',
      leadAngle: 'appointment availability, patient communication, referrals, reviews, and front-office trust',
      targetTerms: ['local employer', 'small business', 'referral partner clinic'],
    };
  }
  if (/legal|law|accounting|bookkeeping|insurance|wealth|financial|consulting|broker|real\s*estate/.test(lower)) {
    return {
      category: 'professional-services',
      offer: offer || 'professional services sold through local relationships and referrals',
      defaultIcpHint: 'owner-led businesses, referral partners, and local clients who need trusted professional support',
      likelyBuyer: 'owner-led businesses, referral partners, and local clients',
      leadAngle: 'trusted advice, referral fit, document-heavy handoffs, renewals, and local relationship building',
      targetTerms: ['small business', 'real estate office', 'medical practice', 'construction company'],
    };
  }
  return {
    category: 'general',
    offer: offer || 'a service business selling through its website',
    defaultIcpHint: 'businesses and local buyers who plausibly need this company’s service',
    likelyBuyer: 'buyers who plausibly need the service described on the visitor’s website',
    leadAngle: 'service need, proof, response speed, scheduling, quote follow-up, and clear next steps',
    targetTerms: ['small business', 'local office', 'property management'],
  };
}

async function fetchHomepageRead(host) {
  if (!host || isPrivateOrInvalidHost(host)) return null;
  const target = `https://${host}/`;
  try {
    const res = await fetch(target, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(HOMEPAGE_FETCH_TIMEOUT_MS),
      headers: {
        'user-agent': 'ClawdifiedPublicReadBot/1.0 (+https://clawdified.com)',
        'accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return null;
    const ctype = res.headers.get('content-type') || '';
    if (!ctype.toLowerCase().includes('html')) return null;
    if (!res.body) return null;
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let received = 0;
    let text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      text += decoder.decode(value, { stream: true });
      if (received >= HOMEPAGE_FETCH_CAP_BYTES) {
        try { await reader.cancel(); } catch (_e) {}
        break;
      }
    }
    text += decoder.decode();
    return extractBusinessRead(text);
  } catch (_err) {
    return null;
  }
}

function extractBusinessRead(html) {
  if (!html) return null;
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const h1Match = html.match(/<h1[^>]*>([\s\S]{1,400}?)<\/h1>/i);
  const bodySnippet = (h1Match ? h1Match[1] : '').replace(/<[^>]+>/g, ' ');
  return {
    title: clean(titleMatch ? titleMatch[1] : '', 200),
    description: clean(metaDescMatch ? metaDescMatch[1] : (ogDescMatch ? ogDescMatch[1] : ''), 400),
    snippet: clean(bodySnippet, 240),
  };
}

function pickTargetTerm(business, icp) {
  const icpText = (icp || '').toLowerCase();
  for (const term of business.targetTerms || []) {
    if (icpText.includes(term)) return term;
  }
  if (icpText) {
    return icpText.split(/[,;\.\n]/)[0].trim().slice(0, 80) || (business.targetTerms?.[0] || 'small business');
  }
  return business.targetTerms?.[0] || 'small business';
}

function buildSerperBody(targetTerm, geography) {
  const body = { q: geography ? `${targetTerm} in ${geography}` : targetTerm, gl: 'us', hl: 'en', num: MAX_PROVIDER_RESULTS_INSPECTED };
  if (geography) body.location = geography;
  return body;
}

async function callSerperPlaces(apiKey, body) {
  const res = await fetch('https://google.serper.dev/places', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SERPER_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

async function callSerperSearch(apiKey, body) {
  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(SERPER_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

function normalizeWebsite(raw) {
  if (!raw) return { domain: '', url: '' };
  let url = String(raw).trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (isPrivateOrInvalidHost(host)) return { domain: '', url: '' };
    return { domain: host, url: `https://${host}` };
  } catch (_e) {
    return { domain: '', url: '' };
  }
}

function placeToCandidate(place, visitorHost) {
  const company = clean(place.title || place.name || '', 160);
  const { domain, url } = normalizeWebsite(place.website || '');
  if (!company) return null;
  if (domain && domain === visitorHost) return null; // skip the visitor itself
  return {
    company,
    domain,
    website: url,
    phone: clean(place.phoneNumber || place.phone || '', 60),
    address: clean(place.address || '', 200),
    category: clean(place.category || place.type || '', 120),
    rating: place.rating || null,
    ratingCount: place.ratingCount || place.reviews || null,
    cid: place.cid || null,
    placeId: place.placeId || null,
    source: 'serper_places',
  };
}

function organicToCandidate(item, visitorHost) {
  const { domain, url } = normalizeWebsite(item.link || '');
  if (!domain) return null;
  if (domain === visitorHost) return null;
  // skip aggregator/social/etc. — we want the company's own site
  if (/^(www\.)?(facebook|instagram|linkedin|youtube|twitter|x|yelp|tripadvisor|bbb|indeed|glassdoor|google|maps\.google|wikipedia|reddit|pinterest|tiktok)\./.test(domain)) return null;
  const company = clean((item.title || '').split(/[|–—\-]/)[0], 160);
  if (!company) return null;
  return {
    company,
    domain,
    website: url,
    phone: '',
    address: '',
    category: '',
    snippet: clean(item.snippet || '', 280),
    source: 'serper_search',
  };
}

function scoreCandidate(candidate, business, icp, geography, targetTerm) {
  let score = 50;
  if (candidate.phone) score += 8;
  if (candidate.domain) score += 8;
  if (candidate.rating && Number(candidate.rating) >= 4) score += 6;
  if (candidate.ratingCount && Number(candidate.ratingCount) >= 10) score += 4;
  const blob = `${candidate.company} ${candidate.category} ${candidate.snippet || ''} ${candidate.address || ''}`.toLowerCase();
  if (targetTerm && blob.includes(targetTerm.toLowerCase())) score += 10;
  if (geography && candidate.address && candidate.address.toLowerCase().includes(geography.toLowerCase().split(',')[0].trim())) score += 6;
  if (icp) {
    const tokens = icp.toLowerCase().split(/\W+/).filter((t) => t.length > 3);
    if (tokens.some((t) => blob.includes(t))) score += 6;
  }
  return Math.max(0, Math.min(99, Math.round(score)));
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    const key = (c.domain || c.company.toLowerCase()).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function candidateToLead(candidate, index, business, icp, geography, targetTerm) {
  const score = scoreCandidate(candidate, business, icp, geography, targetTerm);
  const status = score >= 75 ? 'save' : 'review';
  const contactRoutes = [];
  if (candidate.website) contactRoutes.push('public website');
  if (candidate.phone) contactRoutes.push('public business phone');
  if (candidate.address) contactRoutes.push('public address');
  if (!contactRoutes.length) contactRoutes.push('search-result link');

  const reasons = [];
  const blob = `${candidate.company} ${candidate.category || ''} ${candidate.snippet || ''}`.toLowerCase();
  if (targetTerm && blob.includes(targetTerm.toLowerCase())) {
    reasons.push(`Public result tagged "${targetTerm}" matches the visitor ICP`);
  } else {
    reasons.push(`Public result returned for "${targetTerm}${geography ? ` in ${geography}` : ''}"`);
  }
  if (candidate.address) reasons.push(`Listed location: ${candidate.address}`);
  if (candidate.category) reasons.push(`Listed category: ${candidate.category}`);
  if (candidate.snippet) reasons.push(`Snippet: ${candidate.snippet.slice(0, 140)}`);

  const risks = [
    'Direct email/personal phone withheld in public preview (no paid reveal)',
    'Person-level fit must be verified in a private capped run before outreach',
  ];

  const outreachAngle = `For ${business.name}, open around ${business.leadAngle}. Tie it to what ${candidate.company} likely needs based on the public ${candidate.source === 'serper_places' ? 'business listing' : 'search result'}.`;

  const sourceProof = [];
  if (candidate.source === 'serper_places') sourceProof.push('Listed on public business listings (Serper Places)');
  if (candidate.source === 'serper_search') sourceProof.push('Public web search result for the target term');
  if (candidate.website) sourceProof.push(`Owned domain: ${candidate.domain}`);
  if (candidate.phone) sourceProof.push('Public business phone returned by provider');

  return {
    id: `public-search-${String(index + 1).padStart(3, '0')}`,
    status,
    score,
    company: candidate.company,
    website: candidate.website || (candidate.domain ? `https://${candidate.domain}` : ''),
    domain: candidate.domain,
    industry: candidate.category || business.category,
    geography: candidate.address || geography || '',
    contactName: 'Decision maker (gated)',
    title: 'Public business contact',
    roleGroup: business.likelyBuyer.split(',')[0].trim(),
    phone: candidate.phone || 'contact page',
    linkedin: '',
    email: 'gated until private run',
    contactRoutes,
    reasons,
    risks,
    recommendedAgent: `${business.name} outreach follow-up agent`,
    outreachAngle,
    sourceProof,
    customerFitHeadline: `Potential customer for ${business.name}`,
    customerFitSummary: `${candidate.company} is a real public business returned by the capped public search against the visitor's ICP${geography ? ` in ${geography}` : ''}.`,
    customerFitWhy: `Because ${candidate.company} matches the target term "${targetTerm}" and ${business.name} sells ${business.offer}.`,
  };
}

function shortfallResponse({ runId, business, domain, icp, geography, icpSource, geographySource, reason, businessRead, rate }) {
  return json({
    ok: true,
    mode: 'public_capped_real_search',
    source: 'cloudflare_pages_public_safe_wrapper',
    marker: 'REAL_LEADGEN_PUBLIC_SEARCH_20260526',
    run_id: runId,
    status: 'shortfall',
    shortfall_reason: reason,
    external_writes_enabled: false,
    paid_reveal_enabled: false,
    auto_send_enabled: false,
    raw_provider_payloads_returned: false,
    limits: {
      max_items_returned: MAX_LEADS_RETURNED,
      max_provider_results_inspected: MAX_PROVIDER_RESULTS_INSPECTED,
      direct_contact_reveal: 'private-run only',
      provider_spend: 'capped public search only; no Apollo reveal',
      ...rateLimitLimitsBlock(rate),
    },
    business_read: {
      name: business.name,
      website: domain,
      offer: business.offer,
      likely_buyer: business.likelyBuyer,
      lead_angle: business.leadAngle,
      category: business.category,
      icp,
      geography,
      icp_source: icpSource,
      geography_source: geographySource,
      homepage_title: businessRead?.title || '',
      homepage_description: businessRead?.description || '',
    },
    summary: `Capped public search ran for ${business.name} but did not return strong real leads. ${reason}`,
    leads: [],
  });
}

function utcDateString(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

async function hashIpDate(ip, dateStr) {
  const buf = new TextEncoder().encode(`${ip}|${dateStr}`);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

async function checkAndIncrementRateLimit(env, request) {
  const kv = env && env.SOCIAL_CONNECTOR_KV;
  if (!kv) {
    return { enforced: false, allowed: true };
  }
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const date = utcDateString();
  const globalKey = `leadgen_trial_global:${date}`;
  let ipKey = '';
  let ipCount = 0;
  if (ip) {
    const ipHash = await hashIpDate(ip, date);
    ipKey = `leadgen_trial_rate:${date}:${ipHash}`;
  }
  const [ipCountStr, globalCountStr] = await Promise.all([
    ipKey ? kv.get(ipKey) : Promise.resolve(null),
    kv.get(globalKey),
  ]);
  ipCount = Number(ipCountStr || 0);
  const globalCount = Number(globalCountStr || 0);

  if (ipKey && ipCount >= PER_IP_DAILY_CAP) {
    return {
      enforced: true,
      allowed: false,
      reason: 'per_ip_daily_cap',
      perIpRemaining: 0,
      globalRemaining: Math.max(0, GLOBAL_DAILY_CAP - globalCount),
    };
  }
  if (globalCount >= GLOBAL_DAILY_CAP) {
    return {
      enforced: true,
      allowed: false,
      reason: 'global_daily_cap',
      perIpRemaining: ipKey ? Math.max(0, PER_IP_DAILY_CAP - ipCount) : null,
      globalRemaining: 0,
    };
  }

  const writes = [
    kv.put(globalKey, String(globalCount + 1), { expirationTtl: RATE_LIMIT_KV_TTL_SECONDS }),
  ];
  if (ipKey) {
    writes.push(kv.put(ipKey, String(ipCount + 1), { expirationTtl: RATE_LIMIT_KV_TTL_SECONDS }));
  }
  try { await Promise.all(writes); } catch (_err) { /* fail open on KV write error */ }

  return {
    enforced: true,
    allowed: true,
    perIpRemaining: ipKey ? Math.max(0, PER_IP_DAILY_CAP - (ipCount + 1)) : null,
    globalRemaining: Math.max(0, GLOBAL_DAILY_CAP - (globalCount + 1)),
  };
}

function rateLimitLimitsBlock(rate) {
  const block = { rate_limit_enforced: Boolean(rate?.enforced) };
  if (rate?.enforced) {
    block.per_ip_daily_cap = PER_IP_DAILY_CAP;
    block.global_daily_cap = GLOBAL_DAILY_CAP;
    if (rate.perIpRemaining != null) block.per_ip_remaining = rate.perIpRemaining;
    if (rate.globalRemaining != null) block.global_remaining = rate.globalRemaining;
  }
  return block;
}

export async function onRequestPost(context) {
  const { request, env = {} } = context;
  let body;
  try {
    body = await request.json();
  } catch (_err) {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const websiteInput = clean(body.website, 240);
  const providedIcp = clean(body.icp || body.icp_description, 700);
  const providedGeography = clean(body.geography, 240);
  const offer = clean(body.offer || body.company_description, 400);

  if (!websiteInput) {
    return json({ ok: false, error: 'Website is required.' }, 400);
  }

  const visitorHost = parseHost(websiteInput);
  if (!visitorHost || isPrivateOrInvalidHost(visitorHost)) {
    return json({
      ok: false,
      error: 'Enter a real public website (e.g. https://yourcompany.com). Localhost, private/internal hosts, raw IPs, and .example/.local domains are not supported.',
    }, 400);
  }

  const apiKey = env.SERPER_API_KEY;
  if (!apiKey) {
    return json({
      ok: false,
      error: 'Real public lead search is not configured on this deployment. SERPER_API_KEY is required server-side for the capped public search wrapper. No fake sample leads will be returned.',
      mode: 'public_capped_real_search',
      marker: 'REAL_LEADGEN_PUBLIC_SEARCH_20260526',
      external_writes_enabled: false,
      paid_reveal_enabled: false,
      auto_send_enabled: false,
      raw_provider_payloads_returned: false,
    }, 503);
  }

  const rate = await checkAndIncrementRateLimit(env, request);
  if (!rate.allowed) {
    return json({
      ok: false,
      error: rate.reason === 'global_daily_cap'
        ? 'Daily public lead-search limit reached for this site. Try again after UTC midnight, or contact Clawdified for a private capped run.'
        : 'Daily public lead-search limit reached from this network. Try again after UTC midnight, or contact Clawdified for a private capped run.',
      mode: 'public_capped_real_search',
      marker: 'REAL_LEADGEN_PUBLIC_SEARCH_20260526',
      external_writes_enabled: false,
      paid_reveal_enabled: false,
      auto_send_enabled: false,
      raw_provider_payloads_returned: false,
      limits: {
        max_items_returned: MAX_LEADS_RETURNED,
        max_provider_results_inspected: MAX_PROVIDER_RESULTS_INSPECTED,
        ...rateLimitLimitsBlock(rate),
      },
    }, 429);
  }

  const businessRead = await fetchHomepageRead(visitorHost);
  const businessCat = inferBusinessCategory(visitorHost, offer, businessRead);
  const business = {
    name: brandFrom(visitorHost),
    ...businessCat,
  };

  const icp = providedIcp || businessRead?.description || business.defaultIcpHint;
  const geography = providedGeography || '';
  const icpSource = providedIcp ? 'visitor_input' : (businessRead?.description ? 'inferred_from_website' : 'inferred_from_website');
  const geographySource = providedGeography ? 'visitor_input' : 'inferred_from_website';
  const targetTerm = pickTargetTerm(business, icp);
  const runId = `realsearch_${Date.now().toString(36)}`;

  const serperBody = buildSerperBody(targetTerm, geography);

  let placesPayload = null;
  let searchPayload = null;
  try {
    placesPayload = await callSerperPlaces(apiKey, serperBody);
  } catch (_err) {
    placesPayload = null;
  }
  if (!placesPayload || !Array.isArray(placesPayload.places) || placesPayload.places.length === 0) {
    try {
      searchPayload = await callSerperSearch(apiKey, serperBody);
    } catch (_err) {
      searchPayload = null;
    }
  }

  const candidates = [];
  if (placesPayload && Array.isArray(placesPayload.places)) {
    for (const place of placesPayload.places.slice(0, MAX_PROVIDER_RESULTS_INSPECTED)) {
      const c = placeToCandidate(place, visitorHost);
      if (c) candidates.push(c);
    }
  }
  if (candidates.length < MAX_LEADS_RETURNED && searchPayload && Array.isArray(searchPayload.organic)) {
    for (const item of searchPayload.organic.slice(0, MAX_PROVIDER_RESULTS_INSPECTED)) {
      const c = organicToCandidate(item, visitorHost);
      if (c) candidates.push(c);
    }
  }

  const deduped = dedupeCandidates(candidates);

  if (deduped.length === 0) {
    return shortfallResponse({
      runId,
      business,
      domain: visitorHost,
      icp,
      geography,
      icpSource,
      geographySource,
      reason: `No real public results returned for "${targetTerm}${geography ? ` in ${geography}` : ''}". Refine ICP or search area and try again. No fake sample rows were padded in.`,
      businessRead,
      rate,
    });
  }

  const scored = deduped
    .map((c) => ({ candidate: c, score: scoreCandidate(c, business, icp, geography, targetTerm) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LEADS_RETURNED);

  const minAcceptableScore = 55;
  const strongEnough = scored.filter((s) => s.score >= minAcceptableScore);
  if (strongEnough.length === 0) {
    return shortfallResponse({
      runId,
      business,
      domain: visitorHost,
      icp,
      geography,
      icpSource,
      geographySource,
      reason: 'Public search returned results but none scored as strong fits for the visitor ICP. No weak rows were padded in.',
      businessRead,
      rate,
    });
  }

  const leads = strongEnough.map((s, index) => candidateToLead(s.candidate, index, business, icp, geography, targetTerm));

  return json({
    ok: true,
    mode: 'public_capped_real_search',
    source: 'cloudflare_pages_public_safe_wrapper',
    marker: 'REAL_LEADGEN_PUBLIC_SEARCH_20260526',
    run_id: runId,
    status: 'complete',
    external_writes_enabled: false,
    paid_reveal_enabled: false,
    auto_send_enabled: false,
    raw_provider_payloads_returned: false,
    limits: {
      max_items_returned: MAX_LEADS_RETURNED,
      max_provider_results_inspected: MAX_PROVIDER_RESULTS_INSPECTED,
      direct_contact_reveal: 'private-run only',
      provider_spend: 'capped public search only; no Apollo reveal',
      ...rateLimitLimitsBlock(rate),
    },
    business_read: {
      name: business.name,
      website: visitorHost,
      offer: business.offer,
      likely_buyer: business.likelyBuyer,
      lead_angle: business.leadAngle,
      category: business.category,
      icp,
      geography,
      icp_source: icpSource,
      geography_source: geographySource,
      homepage_title: businessRead?.title || '',
      homepage_description: businessRead?.description || '',
      search_target_term: targetTerm,
    },
    summary: `Ran a capped real public search for ${business.name}. Inspected up to ${MAX_PROVIDER_RESULTS_INSPECTED} provider results for "${targetTerm}${geography ? ` in ${geography}` : ''}" and returned ${leads.length} public-safe lead${leads.length === 1 ? '' : 's'}. Direct contact reveal and outreach stay gated.`,
    leads,
  });
}

export async function onRequestGet() {
  return json({
    ok: true,
    endpoint: '/api/leadgen-trial',
    method: 'POST',
    mode: 'public_capped_real_search',
    marker: 'REAL_LEADGEN_PUBLIC_SEARCH_20260526',
    required_fields: ['website'],
    optional_fields: ['icp', 'geography', 'offer'],
    blank_field_behavior: 'ICP and geography are inferred from the submitted website (homepage title/description if safely fetched, else domain) before running a capped real public search.',
    provider: 'Serper Places / Serper Search (server-side only)',
    external_writes_enabled: false,
    paid_reveal_enabled: false,
    auto_send_enabled: false,
    raw_provider_payloads_returned: false,
    limits: {
      max_items_returned: MAX_LEADS_RETURNED,
      max_provider_results_inspected: MAX_PROVIDER_RESULTS_INSPECTED,
      per_ip_daily_cap: PER_IP_DAILY_CAP,
      global_daily_cap: GLOBAL_DAILY_CAP,
      rate_limit_enforced_when: 'env.SOCIAL_CONNECTOR_KV is bound',
    },
    requires_env: ['SERPER_API_KEY'],
    optional_env: ['SOCIAL_CONNECTOR_KV'],
  });
}
