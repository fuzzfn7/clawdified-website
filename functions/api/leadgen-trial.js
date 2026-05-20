const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: jsonHeaders });
}

function clean(value, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function domainFrom(value) {
  let text = clean(value, 180).toLowerCase();
  text = text.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  return text || 'yourwebsite.com';
}

function brandFrom(domain) {
  const base = domainFrom(domain).split('.')[0].replace(/[-_]+/g, ' ');
  return base.replace(/\b\w/g, (m) => m.toUpperCase()) || 'Your Business';
}

function inferBusiness(website, offer) {
  const domain = domainFrom(website);
  const lower = `${domain} ${offer || ''}`.toLowerCase();
  if (lower.includes('clawdified')) return {
    name: 'Clawdified',
    offer: 'AI agents and workflow automation',
    likelyBuyer: 'owner-led small businesses',
    leadAngle: 'follow-up, reviews, SEO, and repetitive admin work',
  };
  if (lower.includes('hvac')) return {
    name: brandFrom(domain),
    offer: 'HVAC service, repair, and maintenance',
    likelyBuyer: 'homeowners, property managers, and facilities managers',
    leadAngle: 'missed calls, seasonal maintenance, quote follow-up, and review requests',
  };
  if (lower.includes('roof')) return {
    name: brandFrom(domain),
    offer: 'roof repair, storm response, and exterior services',
    likelyBuyer: 'homeowners, property managers, and builders',
    leadAngle: 'storm-response estimates, quote follow-up, scheduling, and review generation',
  };
  if (lower.includes('clean')) return {
    name: brandFrom(domain),
    offer: 'cleaning and facility services',
    likelyBuyer: 'office managers, property owners, and operations managers',
    leadAngle: 'recurring quote follow-up, quality check-ins, and review workflows',
  };
  if (lower.includes('dental') || lower.includes('practice')) return {
    name: brandFrom(domain),
    offer: 'local professional services',
    likelyBuyer: 'practice owners and office managers',
    leadAngle: 'appointment follow-up, missed-call recovery, reviews, and patient intake',
  };
  return {
    name: brandFrom(domain),
    offer: offer || 'a service business selling through its website',
    likelyBuyer: 'local buyers who need the service',
    leadAngle: 'response speed, proof, scheduling, quote follow-up, and reviews',
  };
}

function industryFromIcp(icp) {
  const lower = String(icp || '').toLowerCase();
  if (lower.includes('hvac')) return 'HVAC services';
  if (lower.includes('roof')) return 'Roofing / exterior services';
  if (lower.includes('clean')) return 'Commercial cleaning';
  if (lower.includes('property')) return 'Property services';
  if (lower.includes('dental')) return 'Dental practices';
  if (lower.includes('law') || lower.includes('legal')) return 'Legal services';
  return 'Local services';
}

function leadTemplates(icp, geography, business) {
  const industry = industryFromIcp(icp);
  const area = geography || 'your target area';
  return [
    {
      id: 'demo-lead-001',
      status: 'save',
      score: 92,
      company: area.toLowerCase().includes('knox') ? 'Volunteer Mechanical Services' : `${business.name} Target Account A`,
      website: 'volunteermechanical.example',
      contactName: 'Sarah Mitchell',
      title: 'Operations Manager',
      roleGroup: 'Operations',
      industry,
      geography: area,
      phone: '(865) 555-0134',
      linkedin: 'linkedin.com/in/sarah-mitchell-demo',
      email: 'gated until private run',
      contactRoutes: ['business phone', 'LinkedIn', 'source proof'],
      reasons: [
        `Matches ICP: ${icp || business.likelyBuyer}`,
        `Local ${industry.toLowerCase()} company with repeat follow-up/admin work`,
        `Good contact route: phone + LinkedIn/source proof`,
      ],
      risks: ['Direct email withheld in public demo mode'],
      recommendedAgent: 'Follow-up + review automation agent',
      outreachAngle: `Lead with ${business.leadAngle}; frame the agent as a way to recover missed opportunities without adding admin headcount.`,
      sourceProof: ['Website/contact page found', 'Role appears decision-adjacent', 'Local service fit'],
    },
    {
      id: 'demo-lead-002',
      status: 'review',
      score: 84,
      company: area.toLowerCase().includes('knox') ? 'Smoky Mountain Roof & Exterior' : `${business.name} Target Account B`,
      website: 'smokymountainroof.example',
      contactName: 'Daniel Brooks',
      title: 'Owner',
      roleGroup: 'Ownership',
      industry: industry.includes('HVAC') ? 'Roofing / exterior services' : industry,
      geography: area,
      phone: '(865) 555-0188',
      linkedin: 'source profile pending',
      email: 'gated until private run',
      contactRoutes: ['website', 'business phone', 'needs profile verification'],
      reasons: [
        'Owner-level buyer and local service workflow',
        'Clear use case for estimate follow-up and review generation',
        'Contact route exists, but direct profile needs verification',
      ],
      risks: ['Hold before export until person-level profile is verified'],
      recommendedAgent: 'Estimate follow-up + review request agent',
      outreachAngle: `Ask about quote follow-up and review capture after busy service calls; connect it to ${business.name}'s offer.`,
      sourceProof: ['Business website found', 'Phone route found', 'Profile verification needed'],
    },
    {
      id: 'demo-lead-003',
      status: 'save',
      score: 78,
      company: area.toLowerCase().includes('knox') ? 'Knoxville CleanPro' : `${business.name} Target Account C`,
      website: 'knoxvillecleanpro.example',
      contactName: 'Maya Carter',
      title: 'Office Manager',
      roleGroup: 'Admin / Office',
      industry: 'Commercial cleaning',
      geography: area,
      phone: 'contact page',
      linkedin: 'linkedin.com/in/maya-carter-demo',
      email: 'gated until private run',
      contactRoutes: ['contact page', 'LinkedIn', 'source proof'],
      reasons: [
        'Office/admin buyer likely owns follow-up and scheduling pain',
        'Recurring service model fits automation value',
        'Enough public proof for a private enrichment run',
      ],
      risks: ['May need owner approval for final buying decision'],
      recommendedAgent: 'Recurring-client follow-up agent',
      outreachAngle: 'Open with recurring-client check-ins, quote follow-up, and review requests after completed work.',
      sourceProof: ['Service business fit', 'Contact route present', 'Admin workflow likely'],
    },
  ];
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch (_err) {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const website = clean(body.website, 180);
  const icp = clean(body.icp || body.icp_description, 700);
  const geography = clean(body.geography, 240);
  const offer = clean(body.offer || body.company_description, 400);
  const visitorEmail = clean(body.visitor_email, 180);

  if (!website) return json({ ok: false, error: 'Website is required.' }, 400);
  if (!icp) return json({ ok: false, error: 'ICP / ideal customer is required.' }, 400);
  if (!geography) return json({ ok: false, error: 'Search area is required.' }, 400);

  const business = inferBusiness(website, offer);
  const domain = domainFrom(website);
  const leads = leadTemplates(icp, geography, business);

  return json({
    ok: true,
    mode: 'public_demo_capped',
    run_id: `demo_${Date.now().toString(36)}`,
    status: 'complete',
    source: 'cloudflare_pages_public_safe_wrapper',
    external_writes_enabled: false,
    paid_reveal_enabled: false,
    auto_send_enabled: false,
    raw_provider_payloads_returned: false,
    limits: {
      max_items_returned: 3,
      direct_contact_reveal: 'private-run only',
      provider_spend: 'disabled in public demo',
    },
    business_read: {
      name: business.name,
      website: domain,
      offer: business.offer,
      likely_buyer: business.likelyBuyer,
      lead_angle: business.leadAngle,
      icp,
      geography,
    },
    summary: `Read ${business.name} as ${business.offer}. Scored 3 public-safe preview leads against ${icp} in ${geography}.`,
    leads,
    next_step: visitorEmail
      ? 'Detailed live trial would be reviewed privately before any paid reveal or outreach.'
      : 'Add email/booking step for a private capped live trial before paid reveal or outreach.',
  });
}

export async function onRequestGet() {
  return json({
    ok: true,
    endpoint: '/api/leadgen-trial',
    method: 'POST',
    mode: 'public_demo_capped',
    required_fields: ['website', 'icp', 'geography'],
    external_writes_enabled: false,
    paid_reveal_enabled: false,
    auto_send_enabled: false,
  });
}
