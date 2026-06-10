/* eslint-disable */
const { useState: useStateA, useEffect: useEffectA, useMemo: useMemoA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentHue": 250,
  "density": "comfortable",
  "showStatStrip": true
}/*EDITMODE-END*/;

async function apiJson(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const headers = { ...(options.headers || {}) };
  const res = await fetch(path, { ...options, method, headers });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_err) {
    body = text ? { error: text } : null;
  }
  if (!res.ok) {
    const err = new Error(body?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// REAL_LEADGEN_PUBLIC_SEARCH_20260526
function runSummaryMessage(result) {
  if (result?.demoReplay) {
    const total = Number(result?.run?.total || result?.summary?.demoLeadsQueued || 20);
    return `I’m rebuilding the demo sheet now — ${total} Clawdified-style sample row(s) will appear with why-it-matched notes, contact routes, and review angles.`;
  }
  const summary = result?.summary || result?.run?.summary || result?.run || {};
  const runId = result?.run?.runId || result?.run?.id || result?.runId || "Run";
  const finished = Number(summary.finishedEnrichedLeadsAdded || 0);
  const incomplete = Number(summary.incompleteAccountsSaved || 0);
  const duplicates = Number(summary.duplicatesMerged || 0);
  const companies = Number(summary.rawCompaniesFound || 0);
  const people = Number(summary.peopleFound || 0);
  const blockers = Array.isArray(summary.providerFailuresBlocks) ? summary.providerFailuresBlocks.length : 0;
  const blockerText = blockers ? ` I’d check Agent Health next because ${blockers} setup blocker(s) were recorded.` : "";
  return `I finished ${runId}: ${finished} review-ready row(s), ${incomplete} still incomplete, and ${duplicates} duplicate(s) merged after checking ${companies} company candidate(s) / ${people} person candidate(s).${blockerText}`;
}

function splitList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "").split(/[;\n,]+/).map((item) => item.trim()).filter(Boolean);
}

function domainFromLead(lead) {
  if (lead.domain) return lead.domain;
  const raw = lead.website || "";
  try {
    return new URL(/^https?:/i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
  } catch (_err) {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  }
}

function statusFromConfidence(confidence, value) {
  if (!value) return "missing";
  const normalized = String(confidence || "").toLowerCase();
  if (normalized.includes("high")) return "verified";
  if (normalized.includes("medium")) return "stale";
  return "missing";
}

function seniorityFromLead(lead) {
  const text = `${lead.roleCategory || ""} ${lead.title || ""}`.toLowerCase();
  if (/leadership|executive|principal/.test(text)) return "Leadership";
  if (/lead/.test(text)) return "Lead";
  if (/director/.test(text)) return "Director";
  return "Other";
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function completenessForLead(lead) {
  const checks = [lead.companyName, lead.website || lead.domain, lead.personName, lead.title, lead.email || lead.phone || lead.linkedInUrl || lead.facebookUrl || lead.instagramOrOtherSocialUrl || lead.otherSocialUrl || lead.contactPageUrl || lead.publicContactPath, splitList(lead.sourceUrls).length];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function mapLead(lead) {
  const domain = domainFromLead(lead);
  const sourceUrls = splitList(lead.sourceUrls);
  const providers = splitList(lead.providerSourceUsed);
  const fitScore = Number(lead.clawdifiedCompatibilityScore ?? lead.tamFitScore ?? 0);
  const completeness = Number(lead.enrichmentCompleteness || completenessForLead(lead));
  return {
    id: lead.id,
    fitScore,
    clawdifiedCompatibilityScore: fitScore,
    compatibilityConfidence: lead.compatibilityConfidence || lead.contactConfidence || "UNVERIFIED",
    completeness,
    confidence: Math.max(0, Math.min(100, fitScore || (lead.isFinishedEnrichedLead ? 80 : 35))),
    company: lead.companyName || "Unknown company",
    domain,
    website: lead.website || (domain ? `https://${domain}` : ""),
    industry: lead.industryCategory || lead.geographySegment || "Uncategorized",
    size: lead.fitBand || "Customer type",
    hq: [lead.city, lead.state].filter(Boolean).join(", ") || lead.geographySegment || "Target area",
    contactName: lead.personName || "Needs research",
    title: lead.title || "Missing target person",
    seniority: seniorityFromLead(lead),
    department: lead.departmentFunction || lead.roleCategory || "Unknown",
    email: lead.email || "",
    emailStatus: statusFromConfidence(lead.emailConfidence, lead.email),
    directPhone: lead.phoneType === "direct" || lead.phoneType === "mobile" ? lead.phone : "",
    directStatus: statusFromConfidence(lead.contactConfidence, lead.phoneType === "direct" || lead.phoneType === "mobile" ? lead.phone : ""),
    companyPhone: lead.phoneType === "company" ? lead.phone : "",
    companyPhoneStatus: statusFromConfidence(lead.contactConfidence, lead.phoneType === "company" ? lead.phone : ""),
    linkedin: lead.linkedInUrl || "",
    facebook: lead.facebookUrl || "",
    instagramOrOtherSocial: lead.instagramOrOtherSocialUrl || lead.otherSocialUrl || "",
    socialPath: lead.linkedInUrl || lead.facebookUrl || lead.instagramOrOtherSocialUrl || lead.otherSocialUrl || "",
    linkedinStatus: statusFromConfidence(lead.contactConfidence, lead.linkedInUrl || lead.facebookUrl || lead.instagramOrOtherSocialUrl || lead.otherSocialUrl),
    contactPage: lead.contactPageUrl || lead.officialContactUrl || "",
    researchStatus: lead.researchStatus || (lead.isFinishedEnrichedLead ? "finished" : "incomplete"),
    missingFields: lead.missingFields || "",
    missingFieldList: splitList(lead.missingFields),
    attemptedSources: splitList(lead.attemptedSources),
    attemptedQueries: splitList(lead.attemptedQueries),
    scoreReasons: lead.scoreReasons || lead.accountFitReasons || "",
    scoreRisks: lead.scoreRisks || lead.accountFitRisks || "",
    softwareAiHeaviness: lead.softwareAiHeaviness || "UNVERIFIED",
    softwareAiFitImpact: lead.softwareAiFitImpact || "UNVERIFIED",
    emailVerificationStatus: lead.emailVerificationStatus || "UNVERIFIED",
    fitConfidence: lead.fitConfidence || "UNVERIFIED",
    sourceQuality: lead.sourceQuality || "UNVERIFIED",
    bestPath: lead.publicContactPath || lead.contactPageUrl || lead.suggestedFirstCallAngle || lead.reasonToContact || "Review source evidence before outreach",
    enrichedAt: formatDate(lead.lastEnrichedDate || lead.updatedAt || lead.createdAt),
    sources: [...providers, ...sourceUrls].slice(0, 5),
    notes: lead.userNotes || lead.callNotes || lead.workflowPainClues || lead.reasonToContact || "",
    raw: lead,
  };
}

function mapProvider(provider) {
  const required = provider.required !== false;
  return {
    name: provider.provider || provider.envVar || "Provider",
    category: provider.purpose || "Data provider",
    status: provider.configured ? "ok" : required ? "blocked" : "degraded",
    required,
    latency: "—",
    quota: provider.configured ? "configured" : `${provider.envVar || "not configured"}${required ? "" : " optional"}`,
    lastSync: provider.status || (provider.configured ? "configured" : required ? "not configured" : "not configured optional"),
  };
}

const PUBLIC_DEMO_MODE = true;
// CLAWDIFIED_LEAD_AGENT_SHOWROOM_20260528

const CLAWDIFIED_AGENT_PROFILE = {
  name: "Clawdified lead agent",
  company: "Clawdified",
  offer: "practical AI workflow agents for small-business operations",
  profile: "business context, ICP, service area, and constraints loaded for this showroom",
  market: "Target service area",
  contactProfile: "contact route rules",
  output: "a sample lead sheet with contact routes, source notes, review labels, and a safe next-step angle",
};

const DEFAULT_RUN_CRITERIA = {
  searchQuery: "Ideal customers with follow-up-heavy workflows",
  geographySegment: "Target service area",
  targetWeeklyVolume: 5,
};

const CLAWDIFIED_SHOWROOM_PROVIDERS = {
  publicDiscovery: { provider: "Business search", purpose: "Find example companies that match the ICP", configured: true, required: true, status: "ready" },
  websiteReview: { provider: "Website/source check", purpose: "Check pages and keep proof attached to each row", configured: true, required: true, status: "ready" },
  contactEnrichment: { provider: "Contact routes", purpose: "Attach example ways a human could review or reach the business", configured: true, required: true, status: "ready" },
  sheetScoring: { provider: "Review sheet builder", purpose: "Sort rows by match, proof, and next step", configured: true, required: true, status: "ready" },
};

function nextShowroomRunIso(reference = new Date()) {
  const next = new Date(reference);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next.toISOString();
}

function publicDemoStatus(_criteria = {}, latestRun = null) {
  return {
    status: "ready",
    demoReplayMode: true,
    mode: "clawdified_agent_showroom",
    scheduler: {
      enabled: true,
      intervalMinutes: 1440,
      nextRunAt: nextShowroomRunIso(),
      lastRun: latestRun ? { runAt: latestRun.rawAt || latestRun.runAt || new Date().toISOString(), runId: latestRun.runId || "clawdified-showroom" } : null,
      criteria: { ...DEFAULT_RUN_CRITERIA },
      overlapSkips: 0,
    },
    providerStatus: CLAWDIFIED_SHOWROOM_PROVIDERS,
    publicSafety: {
      external_writes_enabled: false,
      paid_reveal_enabled: false,
      auto_send_enabled: false,
    },
    lastRun: latestRun ? { runAt: latestRun.rawAt || latestRun.runAt || new Date().toISOString(), runId: latestRun.runId || "clawdified-showroom" } : null,
    showroomProfile: CLAWDIFIED_AGENT_PROFILE,
  };
}

const CLAWDIFIED_SHOWROOM_RAW_LEADS = [
  {
    id: "clawdified-demo-001",
    companyName: "Volunteer Mechanical Services",
    domain: "volunteer-mechanical.demo",
    website: "https://clawdified.com/demo/volunteer-mechanical",
    personName: "Chris Morgan",
    title: "Operations Lead",
    roleCategory: "Operations",
    departmentFunction: "Leadership",
    industryCategory: "HVAC / mechanical service",
    fitBand: "Service business · follow-up-heavy",
    geographySegment: "Target service area",
    city: "",
    state: "",
    email: "chris@volunteer-mechanical.demo",
    emailConfidence: "HIGH",
    phone: "(865) 555-0141",
    phoneType: "direct",
    contactConfidence: "HIGH",
    linkedInUrl: "https://linkedin.com/in/demo-chris-morgan",
    clawdifiedCompatibilityScore: 92,
    tamFitScore: 92,
    compatibilityConfidence: "HIGH",
    isFinishedEnrichedLead: true,
    researchStatus: "finished",
    missingFields: "",
    scoreReasons: "Looks like a service business where calls, estimates, scheduling, and job follow-up can create repeat admin work.",
    scoreRisks: "Confirm the workflow is a current priority before outreach.",
    workflowPainClues: "Calls, estimates, scheduling, job updates, and follow-up can move across too many places.",
    reasonToContact: "Lead with the likely workflow bottleneck, not generic AI.",
    suggestedFirstCallAngle: "Ask where calls, estimates, scheduling, or follow-up are still handled manually.",
    suggestedAgent: "Follow-up + scheduling support agent",
    sourceUrls: "Company site; contact page; public profile",
    sourceQuality: "SHOWROOM_DEMO_PROFILED",
    providerSourceUsed: "Business search; source review; contact routes; review sheet builder",
    emailVerificationStatus: "DEMO_VERIFIED",
    fitConfidence: "Directional",
  },
  {
    id: "clawdified-demo-002",
    companyName: "Smoky Mountain Roof & Exterior",
    domain: "smoky-mountain-roof.demo",
    website: "https://clawdified.com/demo/smoky-mountain-roof",
    personName: "Dana Hill",
    title: "Operations Lead",
    roleCategory: "Operations",
    departmentFunction: "Operations",
    industryCategory: "Roofing / exterior services",
    fitBand: "Home services · estimate follow-up",
    geographySegment: "Target service area",
    city: "",
    state: "",
    email: "dana@smoky-mountain-roof.demo",
    emailConfidence: "HIGH",
    phone: "(865) 555-0187",
    phoneType: "mobile",
    contactConfidence: "HIGH",
    linkedInUrl: "https://linkedin.com/in/demo-dana-hill",
    facebookUrl: "https://facebook.com/demo-smoky-mountain-roof",
    clawdifiedCompatibilityScore: 89,
    tamFitScore: 89,
    compatibilityConfidence: "HIGH",
    isFinishedEnrichedLead: true,
    researchStatus: "finished",
    missingFields: "",
    scoreReasons: "Looks like a home-service business where estimate follow-up, scheduling, and review requests repeat every week.",
    scoreRisks: "Confirm the workflow is a current priority before outreach.",
    workflowPainClues: "New roof inquiries, estimates, scheduling changes, and post-job reviews can slip when they live in calls and texts.",
    reasonToContact: "Lead with the likely workflow bottleneck, not generic AI.",
    suggestedFirstCallAngle: "Ask how they currently follow up after estimates and missed calls.",
    suggestedAgent: "Estimate follow-up + review request agent",
    sourceUrls: "Company site; contact page; public profile",
    sourceQuality: "SHOWROOM_DEMO_PROFILED",
    providerSourceUsed: "Business search; source review; contact routes; review sheet builder",
    emailVerificationStatus: "DEMO_VERIFIED",
    fitConfidence: "Directional",
  },
  {
    id: "clawdified-demo-003",
    companyName: "Knoxville CleanPro",
    domain: "knoxville-cleanpro.demo",
    website: "https://clawdified.com/demo/knoxville-cleanpro",
    personName: "Alex Rivera",
    title: "Operations Lead",
    roleCategory: "Operations",
    departmentFunction: "Administration",
    industryCategory: "Commercial cleaning",
    fitBand: "Recurring service · office admin",
    geographySegment: "Target service area",
    city: "",
    state: "",
    email: "alex@knoxville-cleanpro.demo",
    emailConfidence: "HIGH",
    phone: "(865) 555-0166",
    phoneType: "direct",
    contactConfidence: "HIGH",
    linkedInUrl: "https://linkedin.com/in/demo-alex-rivera",
    clawdifiedCompatibilityScore: 84,
    tamFitScore: 84,
    compatibilityConfidence: "HIGH",
    isFinishedEnrichedLead: true,
    researchStatus: "finished",
    missingFields: "",
    scoreReasons: "Looks like a recurring-service business where client updates, staffing changes, and job notes can pile up.",
    scoreRisks: "Confirm the workflow is a current priority before outreach.",
    workflowPainClues: "Recurring job updates, schedule changes, client questions, and quality checks can turn into repeat office work.",
    reasonToContact: "Lead with the likely workflow bottleneck, not generic AI.",
    suggestedFirstCallAngle: "Ask how they keep recurring clients updated when schedules or staffing change.",
    suggestedAgent: "Client update + office admin agent",
    sourceUrls: "Company site; contact page; public profile",
    sourceQuality: "SHOWROOM_DEMO_PROFILED",
    providerSourceUsed: "Business search; source review; contact routes; review sheet builder",
    emailVerificationStatus: "DEMO_VERIFIED",
    fitConfidence: "Directional",
  },
  {
    id: "clawdified-demo-004",
    companyName: "Cedar Ridge Property Management",
    domain: "cedar-ridge-property.demo",
    website: "https://clawdified.com/demo/cedar-ridge-property",
    personName: "Morgan Lee",
    title: "Operations Lead",
    roleCategory: "Operations",
    departmentFunction: "Leadership",
    industryCategory: "Property management",
    fitBand: "Property team · tenant updates",
    geographySegment: "Target service area",
    city: "",
    state: "",
    email: "morgan@cedar-ridge-property.demo",
    emailConfidence: "HIGH",
    phone: "(865) 555-0199",
    phoneType: "mobile",
    contactConfidence: "HIGH",
    linkedInUrl: "https://linkedin.com/in/demo-morgan-lee",
    facebookUrl: "https://facebook.com/demo-cedar-ridge-property",
    clawdifiedCompatibilityScore: 87,
    tamFitScore: 87,
    compatibilityConfidence: "HIGH",
    isFinishedEnrichedLead: true,
    researchStatus: "finished",
    missingFields: "",
    scoreReasons: "Looks like a property team where tenant requests, owner updates, maintenance notes, and follow-up can fragment quickly.",
    scoreRisks: "Confirm the workflow is a current priority before outreach.",
    workflowPainClues: "Tenant requests, owner updates, maintenance scheduling, and document follow-up can scatter across inboxes and calls.",
    reasonToContact: "Lead with the likely workflow bottleneck, not generic AI.",
    suggestedFirstCallAngle: "Ask how they keep tenant requests, owner updates, and maintenance follow-up organized.",
    suggestedAgent: "Tenant request + owner update agent",
    sourceUrls: "Company site; contact page; public profile",
    sourceQuality: "SHOWROOM_DEMO_PROFILED",
    providerSourceUsed: "Business search; source review; contact routes; review sheet builder",
    emailVerificationStatus: "DEMO_VERIFIED",
    fitConfidence: "Directional",
  },
  {
    id: "clawdified-demo-005",
    companyName: "Blue Ridge Dental Group",
    domain: "blue-ridge-dental.demo",
    website: "https://clawdified.com/demo/blue-ridge-dental",
    personName: "Taylor Brooks",
    title: "Operations Lead",
    roleCategory: "Operations",
    departmentFunction: "Operations",
    industryCategory: "Dental practice",
    fitBand: "Healthcare office · front-desk follow-up",
    geographySegment: "Target service area",
    city: "",
    state: "",
    email: "taylor@blue-ridge-dental.demo",
    emailConfidence: "HIGH",
    phone: "(865) 555-0154",
    phoneType: "direct",
    contactConfidence: "HIGH",
    linkedInUrl: "https://linkedin.com/in/demo-taylor-brooks",
    clawdifiedCompatibilityScore: 81,
    tamFitScore: 81,
    compatibilityConfidence: "HIGH",
    isFinishedEnrichedLead: true,
    researchStatus: "finished",
    missingFields: "",
    scoreReasons: "Looks like a front-office-heavy practice where patient intake, reminders, and review requests repeat daily.",
    scoreRisks: "Confirm the workflow is a current priority before outreach.",
    workflowPainClues: "New-patient questions, appointment reminders, forms, and review requests can eat front-desk time.",
    reasonToContact: "Lead with the likely workflow bottleneck, not generic AI.",
    suggestedFirstCallAngle: "Ask how much front-desk time goes to reminders, forms, and patient follow-up.",
    suggestedAgent: "Patient intake + reminder agent",
    sourceUrls: "Company site; contact page; public profile",
    sourceQuality: "SHOWROOM_DEMO_PROFILED",
    providerSourceUsed: "Business search; source review; contact routes; review sheet builder",
    emailVerificationStatus: "DEMO_VERIFIED",
    fitConfidence: "Directional",
  },
];

function buildClawdifiedShowroomLeads() {
  const now = new Date().toISOString();
  return CLAWDIFIED_SHOWROOM_RAW_LEADS.map((lead) => mapLead({
    ...lead,
    createdAt: lead.createdAt || now,
    updatedAt: now,
    lastEnrichedDate: now,
    publicDemoForVisitor: true,
    visitorCompanyName: "Clawdified",
    visitorWebsite: "clawdified.com",
    visitorOffer: "workflow agents for repeatable business tasks",
    visitorProfile: "business context + ICP loaded",
    visitorMarket: "target service area",
  }));
}

function buildClawdifiedShowroomRun(leads = CLAWDIFIED_SHOWROOM_RAW_LEADS) {
  const now = new Date().toISOString();
  return {
    runAt: now,
    completedAt: now,
    trigger: "Manual lead agent preview",
    runId: `clawdified-demo-${Date.now().toString(36)}`,
    searchGeographySegment: "Target service area",
    searchQuery: "Ideal customers with follow-up-heavy workflows",
    rawCompaniesFound: 12,
    companiesExcluded: 6,
    peopleFound: 5,
    finishedEnrichedLeadsAdded: leads.length,
    incompleteAccountsSaved: 2,
    duplicatesMerged: 3,
    sourcesUsed: ["Business search", "Source review", "Contact routes", "Review sheet builder"],
    providerFailuresBlocks: [],
    emailCoverage: `${leads.length}/${leads.length} direct demo routes`,
    phoneCoverage: `${leads.length}/${leads.length} direct/mobile demo routes`,
    linkedInCoverage: `${leads.length}/${leads.length} profile routes`,
    facebookCoverage: "2/5 business/social routes",
    instagramOrOtherSocialCoverage: "0/5 optional routes",
    contactPageCoverage: "5/5 company routes",
    fitConfidenceCoverage: "match labels",
    linkedInSocialCoverage: `${leads.length}/${leads.length} profile routes`,
    duplicateIdCount: 0,
    badSourceCount: 0,
    badSourceDomains: [],
    sourceCoverageSummary: "Showroom run: the Lead Growth agent starts from business context + ICP, finds matching example companies, checks proof/contact routes, and writes a sheet a human can review.",
    shortfall: "None in showroom run",
    mainSkipReasons: ["Poor matches skipped", "Rows without enough proof held back"],
  };
}

const ClawdifiedShowroomBrief = ({ onRunNow, runBusy }) => (
  <div className="card" style={{ margin: "12px 12px 0", borderColor: "var(--accent-border)", background: "linear-gradient(180deg, var(--accent-soft), var(--surface))" }}>
    <div className="card-head" style={{ alignItems: "flex-start" }}>
      <div className="icon"><Icon name="target" /></div>
      <div style={{ flex: 1 }}>
        <h3 className="card-title">Lead Growth agent</h3>
        <div className="card-sub">This is the flow: load the business context, ideal customer, service area, and constraints. The agent searches for matching companies, checks proof/contact routes, and returns a sheet a human can review.</div>
      </div>
      <span className="status-pill ok"><span className="d" />Ready to review</span>
    </div>
    <div className="card-body automation-control-body">
      <div className="kpi-row automation-kpis">
        <div className="kpi">
          <div className="kpi-label">Starts with</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>Business context + ICP</div>
          <div className="kpi-foot">offer, ICP, area</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Searches for</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>ICP matches</div>
          <div className="kpi-foot">companies that fit the profile</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Returns</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>Review sheet</div>
          <div className="kpi-foot">why, route, next angle</div>
        </div>
        <button className="btn btn-primary" style={{ alignSelf: "center", height: 34 }} onClick={() => onRunNow?.({ mode: "showroom" })} disabled={runBusy}><Icon name="refresh" />{runBusy ? "Running…" : "Run agent"}</button>
      </div>
    </div>
  </div>
);

function liveRunGuard(providers = []) {
  if (!providers.length) return "I can’t judge a run yet because the setup readout has not loaded.";
  const blocked = providers.filter((provider) => provider.status === "blocked");
  if (blocked.length) {
    const names = blocked.map((provider) => provider.name).join(", ");
    return `I’d pause before running because ${names} ${blocked.length === 1 ? "is" : "are"} not configured.`;
  }
  return "";
}

function mapRun(run) {
  const summaryCount = Number(run.finishedEnrichedLeadsAdded || run.peopleFound || run.rawCompaniesFound || 0);
  const failed = Array.isArray(run.providerFailuresBlocks) && run.providerFailuresBlocks.length > 0;
  const rawAt = run.runAt || run.completedAt || run.startedAt || run.failedAt;
  return {
    rawAt,
    time: formatTime(rawAt),
    action: run.trigger === "scheduled-heartbeat" ? "Scheduled heartbeat" : run.trigger || "Run",
    count: summaryCount,
    target: [run.searchGeographySegment || run.geographySegment, run.searchQuery].filter(Boolean).join(" · ") || "Lead matching run",
    duration: run.error ? "failed" : "done",
    status: failed || run.error ? "degraded" : "ok",
    rawCompaniesFound: run.rawCompaniesFound ?? 0,
    companiesExcluded: run.companiesExcluded ?? 0,
    peopleFound: run.peopleFound ?? 0,
    finishedEnrichedLeadsAdded: run.finishedEnrichedLeadsAdded ?? 0,
    incompleteAccountsSaved: run.incompleteAccountsSaved ?? 0,
    duplicatesMerged: run.duplicatesMerged ?? 0,
    sourcesUsed: run.sourcesUsed || run.sourcesProvidersUsed || [],
    providerFailuresBlocks: run.providerFailuresBlocks || [],
    emailCoverage: run.emailCoverage || "0%",
    phoneCoverage: run.phoneCoverage || "0%",
    linkedInCoverage: run.linkedInCoverage || run.linkedInSocialCoverage || "0%",
    facebookCoverage: run.facebookCoverage || "0%",
    instagramOrOtherSocialCoverage: run.instagramOrOtherSocialCoverage || "0%",
    contactPageCoverage: run.contactPageCoverage || "0%",
    fitConfidenceCoverage: run.fitConfidenceCoverage || "match labels",
    linkedInSocialCoverage: run.linkedInSocialCoverage || "0%",
    duplicateIdCount: run.duplicateIdCount ?? 0,
    badSourceCount: run.badSourceCount ?? 0,
    badSourceDomains: run.badSourceDomains || [],
    sourceCoverageSummary: run.sourceCoverageSummary || null,
    shortfall: run.shortfall || (run.shortfallFromWeeklyTarget != null ? `${run.shortfallFromWeeklyTarget} below weekly goal` : "—"),
    mainSkipReasons: run.mainSkipReasons || [],
  };
}

const App = () => {
  const [page, setPage] = useStateA("sheet");
  const [selectedId, setSelectedId] = useStateA(null);
  const [panelOpen, setPanelOpen] = useStateA(false);
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [leads, setLeads] = useStateA([]);
  const [providers, setProviders] = useStateA([]);
  const [runs, setRuns] = useStateA([]);
  const [agentStatus, setAgentStatus] = useStateA(null);
  const [loading, setLoading] = useStateA(true);
  const [error, setError] = useStateA("");
  const [runNotice, setRunNotice] = useStateA("");
  const [runBusy, setRunBusy] = useStateA(false);
  const [clearBusy, setClearBusy] = useStateA(false);
  const [searchQuery, setSearchQuery] = useStateA("");
  const [runCriteria, setRunCriteria] = useStateA(DEFAULT_RUN_CRITERIA);

  async function refresh() {
    if (PUBLIC_DEMO_MODE) {
      setProviders(Object.values(CLAWDIFIED_SHOWROOM_PROVIDERS).map(mapProvider));
      setAgentStatus((prev) => prev || publicDemoStatus(runCriteria));
      setError("");
      setLoading(false);
      return;
    }
    try {
      const [leadPayload, providerPayload, runPayload, statusPayload] = await Promise.all([
        apiJson("/api/leads?view=all"),
        apiJson("/api/providers"),
        apiJson("/api/runs"),
        apiJson("/api/agent/status"),
      ]);
      const mappedLeads = (leadPayload.leads || []).map(mapLead);
      setLeads(mappedLeads);
      setProviders(Object.values(providerPayload.providerStatus || {}).map(mapProvider));
      setRuns((runPayload.runs || []).slice(0, 12).map(mapRun));
      setAgentStatus(statusPayload);
      if (!selectedId && mappedLeads[0]) setSelectedId(mappedLeads[0].id);
      setError("");
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function runNow(context = {}) {
    setRunBusy(true);
    setError("");

    if (PUBLIC_DEMO_MODE) {
      setRunNotice("I’m reading the business context + ICP, then looking for matching example companies…");
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        const mappedLeads = buildClawdifiedShowroomLeads();
        const mappedRun = mapRun(buildClawdifiedShowroomRun(mappedLeads));
        setProviders(Object.values(CLAWDIFIED_SHOWROOM_PROVIDERS).map(mapProvider));
        setLeads(mappedLeads);
        setRuns([mappedRun]);
        setAgentStatus(publicDemoStatus(runCriteria, mappedRun));
        setSelectedId(mappedLeads[0]?.id || null);
        setPanelOpen(false);
        setPage("sheet");
        setRunNotice(`I found ${mappedLeads.length} example row(s) worth reviewing and added the pieces that matter: likely pain, contact route, source note, and next-step angle.`);
      } catch (err) {
        setRunNotice("");
        setError(err.message || String(err));
      } finally {
        setRunBusy(false);
      }
      return;
    }

    const mode = context?.mode || "live";
    const demoReplayMode = Boolean(agentStatus?.demoReplayMode);
    setRunNotice(demoReplayMode ? "Starting saved-demo replay…" : "Starting Run Agent…");
    try {
      let result;
      if (!demoReplayMode) {
        const blockedReason = liveRunGuard(providers);
        if (blockedReason) {
          setRunNotice("");
          setError(blockedReason);
          return;
        }
        const approved = window.confirm("Run Agent now? This may use configured enrichment settings and write to the lead sheet.");
        if (!approved) {
          setRunNotice("");
          return;
        }
      }
      result = await apiJson("/api/agent/run-now", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          searchQuery: runCriteria.searchQuery,
          geographySegment: runCriteria.geographySegment,
          targetWeeklyVolume: Number(runCriteria.targetWeeklyVolume || 5),
        }),
      });
      setRunNotice(runSummaryMessage(result));
      await refresh();
    } catch (err) {
      setRunNotice("");
      setError(err.message || String(err));
    } finally {
      setRunBusy(false);
    }
  }

  async function clearDemoSheet() {
    if (PUBLIC_DEMO_MODE) {
      setLeads([]);
      setRuns([]);
      setSelectedId(null);
      setPanelOpen(false);
      setRunNotice("I cleared the example sheet. Run the agent again when you want me to rebuild it from the business context + ICP.");
      setError("");
      return;
    }
    if (!agentStatus?.demoReplayMode) {
      setError("Clear demo is only available in saved-demo replay mode.");
      return;
    }
    if (agentStatus?.status === "running") {
      setRunNotice("Stopping the current demo replay and clearing the sheet…");
    }
    if (!leads.length && !runs.length && agentStatus?.status !== "running") {
      setRunNotice("Demo sheet is already clear — click Run Agent to replay the saved leads.");
      return;
    }
    const approved = window.confirm("Clear the demo sheet? This removes the current saved demo leads and run history so you can click Run Agent again.");
    if (!approved) return;

    setClearBusy(true);
    setError("");
    setRunNotice("Clearing demo sheet…");
    try {
      await apiJson("/api/agent/demo-replay/clear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      setSelectedId(null);
      setRunNotice("Demo sheet cleared — click Run Agent to replay the saved lead examples again.");
      await refresh();
    } catch (err) {
      setRunNotice("");
      setError(err.message || String(err));
    } finally {
      setClearBusy(false);
    }
  }

  function exportCsv() {
    if (PUBLIC_DEMO_MODE) {
      if (!leads.length) {
        setRunNotice("Run the preview first so there are reviewed rows to export.");
        return;
      }
      const header = ["match_score", "company", "domain", "contact", "title", "industry", "geography", "phone", "social", "suggested_agent", "outreach_angle"];
      const rows = leads.map((lead) => [
        lead.fitScore,
        lead.company,
        lead.domain,
        lead.contactName,
        lead.title,
        lead.industry,
        lead.hq,
        lead.directPhone || lead.companyPhone || "not shown in demo",
        lead.socialPath || "not shown in demo",
        getOperationalPain(lead).suggestedAgent || "",
        lead.bestPath || lead.notes || "",
      ]);
      const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "clawdified-lead-growth-demo.csv";
      a.click();
      URL.revokeObjectURL(a.href);
      setRunNotice("Exported the reviewed demo rows as a CSV.");
      return;
    }
    window.location.href = "/api/export/csv";
  }

  function updateRunCriteria(key, value) {
    setRunCriteria((prev) => ({ ...prev, [key]: value }));
  }


  useEffectA(() => {
    refresh();
    const interval = agentStatus?.status === "running" ? 5000 : 30000;
    const timer = window.setInterval(refresh, interval);
    return () => window.clearInterval(timer);
  }, [agentStatus?.status]);

  useEffectA(() => {
    document.documentElement.style.setProperty("--accent-h", tweaks.accentHue);
  }, [tweaks.accentHue]);

  useEffectA(() => {
    document.body.classList.remove("density-compact", "density-roomy");
    if (tweaks.density === "compact") document.body.classList.add("density-compact");
    if (tweaks.density === "roomy") document.body.classList.add("density-roomy");
  }, [tweaks.density]);

  useEffectA(() => {
    if (page === "outreach") setPanelOpen(false);
  }, [page]);

  const visibleLeads = leads;
  const selectedLead = visibleLeads.find(l => l.id === selectedId) || null;
  const liveRunDisabledReason = PUBLIC_DEMO_MODE ? "" : (agentStatus?.demoReplayMode ? "" : liveRunGuard(providers));
  const demoHasRowsOrRuns = Boolean(leads.length || runs.length || agentStatus?.status === "running");
  const demoClearDisabledReason = PUBLIC_DEMO_MODE
    ? (demoHasRowsOrRuns ? "" : "Demo sheet is already clear.")
    : (!agentStatus?.demoReplayMode
      ? ""
      : demoHasRowsOrRuns ? "" : "Demo sheet is already clear.");

  const onSelect = (id) => {
    setSelectedId(id);
    setPanelOpen(true);
  };

  const agentLabel = loading ? "loading" : (agentStatus?.scheduler?.enabled ? "scheduled" : (agentStatus?.status || "idle"));
  const lastRunAt = runs[0]?.rawAt || agentStatus?.lastRun?.runAt || agentStatus?.scheduler?.lastRun?.runAt || null;

  return (
    <div className="app">
      <Rail page={page} setPage={setPage} leads={leads} />
      <div className="main">
        <Topbar page={page} agent={agentLabel} onRunNow={runNow} runBusy={runBusy} onClearDemo={clearDemoSheet} clearBusy={clearBusy} showDemoClear={PUBLIC_DEMO_MODE || Boolean(agentStatus?.demoReplayMode)} demoClearDisabledReason={demoClearDisabledReason} onExport={exportCsv} searchQuery={searchQuery} onSearchChange={setSearchQuery} liveRunDisabledReason={liveRunDisabledReason} />
        {PUBLIC_DEMO_MODE && <ClawdifiedShowroomBrief onRunNow={runNow} runBusy={runBusy} />}
        {runNotice && <div className="callout" style={{ margin: 12, color: "var(--ok)" }}><Icon name="check" className="ico" />{runNotice}</div>}
        {error && <div className="callout" style={{ margin: 12, color: "var(--err)" }}><Icon name="info" className="ico" />{error}</div>}
        {page === "sheet" && <ContactSheet leads={visibleLeads} onSelect={onSelect} selectedId={selectedId} searchQuery={searchQuery} lastRunAt={lastRunAt} />}
        {page === "agent" && <AgentChatPage agentStatus={agentStatus} providers={providers} runs={runs} leads={visibleLeads} runCriteria={runCriteria} onRunNow={runNow} runBusy={runBusy} />}
        {page === "outreach" && <OutreachPage leads={visibleLeads} selectedId={selectedId} onSelect={onSelect} searchQuery={searchQuery} />}
        {page === "settings" && <AgentSettings agentStatus={agentStatus} providers={providers} runs={runs} leads={visibleLeads} runCriteria={runCriteria} onRunCriteriaChange={updateRunCriteria} onRunNow={runNow} runBusy={runBusy} />}
        {page === "health" && <AgentHealth providers={providers} runs={runs} agentStatus={agentStatus} />}
      </div>

      <LeadPanel lead={selectedLead} open={panelOpen} onClose={() => setPanelOpen(false)} />

      <TweaksPanel title="Tweaks">
        <TweakSection title="Accent">
          <TweakSlider label="Accent hue" min={0} max={360} step={5} value={tweaks.accentHue} onChange={(v) => setTweak("accentHue", v)} suffix="°" />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {[
              { name: "Indigo", h: 250 },
              { name: "Slate", h: 220 },
              { name: "Teal", h: 195 },
              { name: "Emerald", h: 155 },
              { name: "Amber", h: 60 },
              { name: "Crimson", h: 20 },
            ].map(c => (
              <button key={c.h} title={c.name}
                onClick={() => setTweak("accentHue", c.h)}
                style={{
                  width: 24, height: 24, borderRadius: 5,
                  background: `oklch(0.55 0.18 ${c.h})`,
                  border: tweaks.accentHue === c.h ? "2px solid var(--fg)" : "1px solid var(--border)",
                  cursor: "pointer", padding: 0,
                }} />
            ))}
          </div>
        </TweakSection>
        <TweakSection title="Density">
          <TweakRadio value={tweaks.density} options={[
            { value: "compact", label: "Compact" },
            { value: "comfortable", label: "Comfortable" },
            { value: "roomy", label: "Roomy" },
          ]} onChange={(v) => setTweak("density", v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
