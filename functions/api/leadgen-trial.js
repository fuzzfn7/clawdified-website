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

const SAMPLE_PEOPLE = [
  ['Amanda Rice', 'Practice Administrator', 'Admin / Office'],
  ['Marcus Lee', 'Operations Manager', 'Operations'],
  ['Nina Patel', 'Controller', 'Finance / Admin'],
];

const BUYER_LEADS = {
  'it-services': [
    {
      company: 'Blue Ridge Dental Group',
      website: 'blueridgedental.example',
      industry: 'Healthcare practices',
      buyerNeed: 'recurring IT support, secure workstations, backups, and HIPAA-aware vendor coordination',
      recommendedAgent: 'Managed IT reliability pitch',
      contactRoutes: ['website', 'business phone', 'source proof'],
      sourceProof: ['Practice website/contact page found', 'Operations/admin buyer fit', 'Technology reliability need likely'],
    },
    {
      company: 'Smoky Mountain Logistics',
      website: 'smokymountainlogistics.example',
      industry: 'Logistics / transportation',
      buyerNeed: 'dispatch uptime, device support, email security, and cloud file access across a moving team',
      recommendedAgent: 'Network uptime + help-desk pitch',
      contactRoutes: ['business phone', 'LinkedIn/source proof', 'website'],
      sourceProof: ['Operations-heavy business model', 'Phone route found', 'IT uptime likely revenue-critical'],
    },
    {
      company: 'Volunteer Precision Manufacturing',
      website: 'volunteerprecision.example',
      industry: 'Manufacturing / industrial',
      buyerNeed: 'secure file sharing, shop-floor device support, backups, and vendor/account access control',
      recommendedAgent: 'Cybersecurity risk review pitch',
      contactRoutes: ['contact page', 'business phone', 'source proof'],
      sourceProof: ['Industrial website found', 'Admin/finance buyer likely owns vendor risk', 'Security and uptime fit'],
    },
  ],
  trades: [
    {
      company: 'Cedar Ridge Property Management',
      website: 'cedarridgepm.example',
      industry: 'Property management',
      buyerNeed: 'fast service scheduling, vendor coordination, and recurring maintenance responsiveness',
      recommendedAgent: 'Property-manager service pitch',
      contactRoutes: ['website', 'business phone', 'source proof'],
      sourceProof: ['Property manager fit', 'Service need recurring', 'Public contact route found'],
    },
    {
      company: 'Oak Street Builders',
      website: 'oakstreetbuilders.example',
      industry: 'Builders / construction',
      buyerNeed: 'reliable trade partners for quote turnaround, job scheduling, and punch-list follow-up',
      recommendedAgent: 'Builder partnership pitch',
      contactRoutes: ['business phone', 'source proof', 'website'],
      sourceProof: ['Builder buyer fit', 'Project handoff pain likely', 'Phone route found'],
    },
    {
      company: 'Summit Facilities Group',
      website: 'summitfacilities.example',
      industry: 'Facilities management',
      buyerNeed: 'responsive maintenance vendors and documented service follow-up',
      recommendedAgent: 'Facilities maintenance pitch',
      contactRoutes: ['contact page', 'source proof', 'business phone'],
      sourceProof: ['Facilities buyer fit', 'Maintenance work likely recurring', 'Contact page route found'],
    },
  ],
  'professional-services': [
    {
      company: 'Harbor Title & Escrow',
      website: 'harbortitle.example',
      industry: 'Real estate services',
      buyerNeed: 'referral partners, document-heavy handoffs, and fast client communication',
      recommendedAgent: 'Referral-partner fit pitch',
      contactRoutes: ['website', 'business phone', 'source proof'],
      sourceProof: ['Professional services fit', 'Referral workflow likely', 'Public contact route found'],
    },
    {
      company: 'Summit Accounting Partners',
      website: 'summitaccounting.example',
      industry: 'Accounting / finance',
      buyerNeed: 'trusted vendors for owner-led clients and recurring advisory relationships',
      recommendedAgent: 'Partner/referral pitch',
      contactRoutes: ['business phone', 'LinkedIn/source proof', 'website'],
      sourceProof: ['Owner-client access likely', 'Business advisory fit', 'Phone route found'],
    },
    {
      company: 'Pine Valley Insurance',
      website: 'pinevalleyinsurance.example',
      industry: 'Insurance services',
      buyerNeed: 'renewal conversations, local client relationships, and referral channel fit',
      recommendedAgent: 'Renewal/referral angle pitch',
      contactRoutes: ['contact page', 'business phone', 'source proof'],
      sourceProof: ['Client relationship business', 'Renewal workflow likely', 'Contact route found'],
    },
  ],
  general: [
    {
      company: 'Cedar Ridge Property Management',
      website: 'cedarridgepm.example',
      industry: 'Property services',
      buyerNeed: 'vendor follow-up, service coordination, and recurring customer communication',
      recommendedAgent: 'Operational buyer pitch',
      contactRoutes: ['website', 'business phone', 'source proof'],
      sourceProof: ['Business website found', 'Operations buyer fit', 'Public contact route found'],
    },
    {
      company: 'Riverbend Family Dental',
      website: 'riverbenddental.example',
      industry: 'Healthcare practices',
      buyerNeed: 'front-office responsiveness, vendor coordination, and recurring service reliability',
      recommendedAgent: 'Practice-manager buyer pitch',
      contactRoutes: ['business phone', 'source proof', 'website'],
      sourceProof: ['Practice website found', 'Admin buyer likely', 'Phone route found'],
    },
    {
      company: 'Volunteer Precision Manufacturing',
      website: 'volunteerprecision.example',
      industry: 'Manufacturing / industrial',
      buyerNeed: 'vendor reliability, operations support, and documented follow-up',
      recommendedAgent: 'Operations buyer pitch',
      contactRoutes: ['contact page', 'business phone', 'source proof'],
      sourceProof: ['Industrial buyer fit', 'Operations workflow likely', 'Contact route found'],
    },
  ],
};

function inferBusiness(website, offer) {
  const domain = domainFrom(website);
  const name = brandFrom(domain);
  const lower = `${domain} ${offer || ''}`.toLowerCase();

  if (/net3it|managed\s*it|\bit\b|msp|cyber|network|cloud|technology|tech support|computer support/.test(lower)) return {
    name,
    category: 'it-services',
    offer: offer || 'managed IT, cybersecurity, network, and cloud support',
    defaultIcp: 'small and mid-sized businesses that need dependable managed IT, cybersecurity, help-desk, network, or cloud support',
    defaultGeography: `${name}'s likely service area`,
    likelyBuyer: 'operations, office, finance, and practice leaders at SMBs with recurring technology support needs',
    leadAngle: 'managed IT support, cybersecurity risk reduction, help-desk response, network reliability, and cloud migration support',
  };

  if (/hvac|roof|plumb|electric|contractor|construction|repair|restoration|field service|home service/.test(lower)) return {
    name,
    category: 'trades',
    offer: offer || 'trade services, repairs, maintenance, and project work',
    defaultIcp: 'property managers, builders, facility leaders, and homeowners with recurring service or project needs',
    defaultGeography: `${name}'s service area`,
    likelyBuyer: 'property managers, builders, facilities teams, and service-area homeowners',
    leadAngle: 'reliable service response, estimate turnaround, scheduling, maintenance, and post-job follow-up',
  };

  if (/clean|janitorial|facility services/.test(lower)) return {
    name,
    category: 'trades',
    offer: offer || 'commercial cleaning and facility services',
    defaultIcp: 'office managers, property managers, facility leaders, and recurring-service buyers',
    defaultGeography: `${name}'s service area`,
    likelyBuyer: 'office managers, property owners, and operations managers',
    leadAngle: 'recurring facility service, quality check-ins, quote follow-up, and renewal conversations',
  };

  if (/dental|clinic|practice|medical|therapy|wellness|veterinary/.test(lower)) return {
    name,
    category: 'professional-services',
    offer: offer || 'local professional healthcare services',
    defaultIcp: 'families, local employers, referral partners, and office managers who need reliable professional healthcare services',
    defaultGeography: `${name}'s patient/referral area`,
    likelyBuyer: 'local patients, employers, referral partners, and office managers',
    leadAngle: 'appointment availability, patient communication, referrals, reviews, and front-office trust',
  };

  if (/legal|law|accounting|bookkeeping|insurance|wealth|financial|consulting|broker|real estate/.test(lower)) return {
    name,
    category: 'professional-services',
    offer: offer || 'professional services sold through local relationships and referrals',
    defaultIcp: 'owner-led businesses, referral partners, and local clients who need trusted professional support',
    defaultGeography: `${name}'s client/referral area`,
    likelyBuyer: 'owner-led businesses, referral partners, and local clients',
    leadAngle: 'trusted advice, referral fit, document-heavy handoffs, renewals, and local relationship building',
  };

  return {
    name,
    category: 'general',
    offer: offer || 'a service business selling through its website',
    defaultIcp: 'businesses and local buyers who plausibly need this company’s service',
    defaultGeography: `${name}'s likely market`,
    likelyBuyer: 'buyers who need the service described by the visitor’s website',
    leadAngle: 'service need, proof, response speed, scheduling, quote follow-up, and clear next steps',
  };
}

function templateBucketFor(icp, business) {
  const lower = `${icp || ''} ${business.offer || ''} ${business.defaultIcp || ''}`.toLowerCase();
  if (/managed\s*it|\bit\b|msp|cyber|network|cloud|technology|help.?desk|software/.test(lower)) return BUYER_LEADS['it-services'];
  if (/property|builder|facility|homeowner|contractor|roof|hvac|plumb|electric|construction|maintenance/.test(lower)) return BUYER_LEADS.trades;
  if (/professional|referral|legal|law|accounting|insurance|financial|client|practice|medical|dental|clinic/.test(lower)) return BUYER_LEADS['professional-services'];
  return BUYER_LEADS[business.category] || BUYER_LEADS.general;
}

function leadTemplates(icp, geography, business) {
  const area = geography || business.defaultGeography;
  const templates = templateBucketFor(icp, business);
  return templates.slice(0, 3).map((template, index) => {
    const [contactName, title, roleGroup] = SAMPLE_PEOPLE[index] || SAMPLE_PEOPLE[0];
    const score = [92, 84, 78][index] || 76;
    const status = index === 1 ? 'review' : 'save';
    return {
      id: `demo-lead-${String(index + 1).padStart(3, '0')}`,
      status,
      score,
      company: template.company,
      website: template.website,
      contactName,
      title,
      roleGroup,
      industry: template.industry,
      geography: area,
      phone: index === 2 ? 'contact page' : ['(555) 013-2401', '(555) 018-7742'][index],
      linkedin: index === 1 ? 'source profile pending' : `linkedin.com/in/${contactName.toLowerCase().replace(/\s+/g, '-')}-demo`,
      email: 'gated until private run',
      contactRoutes: template.contactRoutes,
      reasons: [
        `Matches ${business.name}'s target market: ${icp}`,
        `Likely need: ${template.buyerNeed}`,
        `Good public-safe route: ${template.contactRoutes.join(' + ')}`,
      ],
      risks: [index === 1 ? 'Hold before export until person-level profile is verified' : 'Direct email withheld in public demo mode'],
      recommendedAgent: template.recommendedAgent,
      outreachAngle: `For ${business.name}, open with ${business.leadAngle}. Tie it to ${template.company}'s likely need around ${template.buyerNeed}.`,
      sourceProof: template.sourceProof,
      customerFitHeadline: `Potential customer for ${business.name}`,
      customerFitSummary: `${template.company} looks like a public-safe sample account for ${business.name} because ${template.buyerNeed}.`,
      customerFitWhy: `Because ${template.company} likely has a business need connected to ${business.offer}.`,
    };
  });
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch (_err) {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const website = clean(body.website, 180);
  const providedIcp = clean(body.icp || body.icp_description, 700);
  const providedGeography = clean(body.geography, 240);
  const offer = clean(body.offer || body.company_description, 400);
  const visitorEmail = clean(body.visitor_email, 180);

  if (!website) return json({ ok: false, error: 'Website is required.' }, 400);

  const business = inferBusiness(website, offer);
  const domain = domainFrom(website);
  const icp = providedIcp || business.defaultIcp;
  const geography = providedGeography || business.defaultGeography;
  const icpSource = providedIcp ? 'visitor_input' : 'inferred_from_website';
  const geographySource = providedGeography ? 'visitor_input' : 'inferred_from_website';
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
      category: business.category,
      icp,
      geography,
      icp_source: icpSource,
      geography_source: geographySource,
    },
    summary: `Read ${business.name} as ${business.offer}. Scored ${leads.length} public-safe preview leads against ${icpSource === 'visitor_input' ? 'the visitor ICP' : 'an inferred ICP'} in ${geography}.`,
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
    required_fields: ['website'],
    optional_fields: ['icp', 'geography', 'offer', 'visitor_email'],
    blank_field_behavior: 'ICP and geography are inferred from the submitted website instead of using Clawdified defaults.',
    external_writes_enabled: false,
    paid_reveal_enabled: false,
    auto_send_enabled: false,
  });
}
