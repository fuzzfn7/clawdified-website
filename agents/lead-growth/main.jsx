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
    return `Demo replay started — ${total} saved lead examples will appear over the next few minutes. No live Serper/BrowserBase/Apollo/Hunter providers will run.`;
  }
  const summary = result?.summary || result?.run?.summary || result?.run || {};
  const runId = result?.run?.runId || result?.run?.id || result?.runId || "Run";
  const finished = Number(summary.finishedEnrichedLeadsAdded || 0);
  const incomplete = Number(summary.incompleteAccountsSaved || 0);
  const duplicates = Number(summary.duplicatesMerged || 0);
  const companies = Number(summary.rawCompaniesFound || 0);
  const people = Number(summary.peopleFound || 0);
  const blockers = Array.isArray(summary.providerFailuresBlocks) ? summary.providerFailuresBlocks.length : 0;
  const blockerText = blockers ? ` ${blockers} provider blocker(s) recorded in Agent Health.` : "";
  return `${runId} completed: ${finished} finished lead(s), ${incomplete} incomplete account(s), ${duplicates} duplicate(s) merged from ${companies} company result(s) / ${people} people found.${blockerText}`;
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
  if (/owner|founder|ceo|chief|president|executive/.test(text)) return "C-Level";
  if (/vp|vice president/.test(text)) return "VP";
  if (/head/.test(text)) return "Head";
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
    size: lead.estimatedRevenueBand || "$1M-$10M",
    hq: [lead.city, lead.state].filter(Boolean).join(", ") || lead.geographySegment || "Broad U.S.",
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
    revenueConfidence: lead.revenueConfidence || "UNVERIFIED",
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

const DEFAULT_RUN_CRITERIA = {
  website: "",
  icp: "",
  geography: "",
  searchQuery: "",
  geographySegment: "",
  targetWeeklyVolume: 3,
};

const PUBLIC_DEMO_PROVIDERS = {
  // REAL_LEADGEN_PUBLIC_SEARCH_20260526 — providers reflect the capped real public-search wrapper, not a static sample/demo source.
  publicWrapper: { provider: "Capped public search wrapper", purpose: "Server-side input validation + Serper Places/Search call + capped public result shaping", configured: true, required: true, status: "real public search; no external writes" },
  serper: { provider: "Serper (public search)", purpose: "Real public business/web search server-side", configured: true, required: true, status: "capped at 10 inspected / 3 returned" },
  leadgenMcp: { provider: "LeadGen MCP", purpose: "Private-run handoff (paid reveal, person-level enrichment, outreach)", configured: true, required: false, status: "gated behind approval" },
  apollo: { provider: "Apollo reveal", purpose: "Paid direct-contact enrichment", configured: false, required: false, status: "disabled in public search" },
};

function publicDemoStatus(criteria = {}, latestResult = null) {
  return {
    status: "idle",
    demoReplayMode: true,
    mode: "public_capped_real_search",
    scheduler: {
      enabled: false,
      criteria: {
        searchQuery: criteria.icp || "inferred from visitor website",
        geographySegment: criteria.geography || "inferred from visitor website",
        targetWeeklyVolume: 3,
      },
    },
    providerStatus: PUBLIC_DEMO_PROVIDERS,
    publicSafety: {
      external_writes_enabled: false,
      paid_reveal_enabled: false,
      auto_send_enabled: false,
    },
    lastRun: latestResult ? { runAt: new Date().toISOString(), runId: latestResult.run_id } : null,
  };
}

function leadgenTrialToRawLead(lead, result, index) {
  const business = result?.business_read || {};
  const rawDomain = lead.domain || lead.website || lead.company || "";
  const companyDomain = String(rawDomain).replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[\s/?#]/)[0];
  const sources = Array.isArray(lead.sourceProof) ? lead.sourceProof : [];
  return {
    id: lead.id || `public-search-${index + 1}`,
    companyName: lead.company || `Public search result ${index + 1}`,
    website: companyDomain.includes(".") ? `https://${companyDomain}` : (lead.website || ""),
    domain: companyDomain,
    personName: lead.contactName || "Gated until private run",
    title: lead.title || "Public business contact",
    roleCategory: lead.roleGroup || "Operations",
    departmentFunction: lead.roleGroup || "Operations",
    industryCategory: lead.industry || "Local services",
    geographySegment: lead.geography || business.geography || "Target area",
    city: String(lead.geography || business.geography || "").split(",")[0],
    state: String(lead.geography || business.geography || "").split(",")[1]?.trim() || "",
    phone: lead.phone || "",
    phoneType: lead.phone && /^\(?\d/.test(lead.phone) ? "company" : "",
    linkedInUrl: String(lead.linkedin || "").startsWith("linkedin") ? `https://${lead.linkedin}` : (lead.linkedin || ""),
    email: "",
    contactConfidence: lead.status === "save" ? "HIGH" : "MEDIUM",
    emailConfidence: "UNVERIFIED",
    clawdifiedCompatibilityScore: Number(lead.score || 0),
    tamFitScore: Number(lead.score || 0),
    compatibilityConfidence: lead.status === "save" ? "HIGH" : "MEDIUM",
    isFinishedEnrichedLead: lead.status === "save",
    researchStatus: lead.status === "save" ? "finished" : "incomplete",
    missingFields: Array.isArray(lead.risks) ? lead.risks.join("; ") : "Direct email/personal phone gated until private run",
    scoreReasons: Array.isArray(lead.reasons) ? lead.reasons.join("; ") : "Capped public search fit",
    scoreRisks: Array.isArray(lead.risks) ? lead.risks.join("; ") : "Person-level fit must be verified privately before outreach",
    workflowPainClues: lead.outreachAngle || business.lead_angle || "Follow-up, scheduling, and review workflows",
    reasonToContact: lead.outreachAngle || "Likely repeatable workflow pain",
    suggestedFirstCallAngle: lead.outreachAngle || "Ask where follow-up and admin work slows revenue.",
    suggestedAgent: lead.recommendedAgent || `${business.name || "Visitor"} outreach follow-up agent`,
    sourceUrls: sources.join("; "),
    sourceQuality: "PUBLIC_CAPPED_REAL_SEARCH",
    providerSourceUsed: "Serper Places/Search (server-side); capped public results",
    publicDemoForVisitor: true,
    visitorCompanyName: business.name || "the visitor's company",
    visitorWebsite: business.website || "",
    visitorOffer: business.offer || "the visitor's offer",
    visitorIcp: business.icp || "",
    visitorGeography: business.geography || "",
    icpSource: business.icp_source || "visitor_input",
    geographySource: business.geography_source || "visitor_input",
    customerFitHeadline: lead.customerFitHeadline || `Potential customer for ${business.name || "the visitor"}`,
    customerFitSummary: lead.customerFitSummary || lead.reasons?.[0] || "Public-safe customer fit preview",
    customerFitWhy: lead.customerFitWhy || lead.outreachAngle || "Customer fit should be reviewed before outreach.",
    estimatedRevenueBand: "UNVERIFIED",
    revenueConfidence: "UNVERIFIED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastEnrichedDate: new Date().toISOString(),
  };
}

function publicRunFromResult(result) {
  const now = new Date().toISOString();
  const leads = result?.leads || [];
  return {
    runAt: now,
    completedAt: now,
    trigger: "Capped public search",
    runId: result?.run_id || "public-search",
    searchGeographySegment: result?.business_read?.geography || "(inferred or not set)",
    searchQuery: result?.business_read?.search_target_term || result?.business_read?.icp || "visitor ICP",
    rawCompaniesFound: leads.length,
    peopleFound: 0,
    finishedEnrichedLeadsAdded: leads.filter((lead) => lead.status === "save").length,
    incompleteAccountsSaved: leads.filter((lead) => lead.status !== "save").length,
    duplicatesMerged: 0,
    sourcesUsed: ["Serper Places/Search (server-side)", "LeadGen MCP gated path (private runs only)"],
    providerFailuresBlocks: [],
    emailCoverage: "0% — direct email gated until private run",
    phoneCoverage: "public business phone only when listed publicly",
    linkedInCoverage: "gated until private run",
    contactPageCoverage: "public website / contact page only",
    revenueConfidenceCoverage: "0% — paid reveal disabled",
    sourceCoverageSummary: result?.status === "shortfall"
      ? (result.shortfall_reason || "Capped public search found no strong real leads. No fake rows were padded in.")
      : "Capped real public search; no Apollo reveal, no provider spend beyond Serper, no outbound send.",
    shortfall: result?.status === "shortfall" ? (result.shortfall_reason || "no strong leads") : "private run required for direct contacts",
    mainSkipReasons: [],
  };
}

const PublicDemoIntake = ({ runCriteria, onRunCriteriaChange, onRunNow, runBusy }) => (
  <div className="card" style={{ margin: "12px 12px 0", borderColor: "var(--accent-border)", background: "linear-gradient(180deg, var(--accent-soft), var(--surface))" }}>
    <div className="card-head" style={{ alignItems: "flex-start" }}>
      <div className="icon"><Icon name="target" /></div>
      <div style={{ flex: 1 }}>
        <h3 className="card-title">Public lead search intake</h3>
        <div className="card-sub">Enter your business website. ICP and search area are optional — leave them blank and the wrapper infers them. This runs a capped real public search (Serper) server-side and returns up to 3 real public-safe leads. No Apollo reveal, no outbound sends, direct contacts gated.</div>
      </div>
      <span className="status-pill ok"><span className="d" />Capped real public search</span>
    </div>
    <div className="card-body automation-control-body">
      <div className="manual-control-grid" style={{ gridTemplateColumns: "1fr 1.35fr .9fr auto" }}>
        <div className="input-row" style={{ margin: 0 }}>
          <div className="input-label">Business website</div>
          <input type="url" placeholder="https://yourcompany.com" value={runCriteria.website || ""} onChange={(event) => onRunCriteriaChange?.("website", event.target.value)} />
        </div>
        <div className="input-row" style={{ margin: 0 }}>
          <div className="input-label">Ideal customer / ICP <span style={{ color: "var(--fg-3)", fontWeight: 500 }}>(optional)</span></div>
          <input type="text" placeholder="e.g. dental offices, manufacturers, property managers" value={runCriteria.icp || ""} onChange={(event) => onRunCriteriaChange?.("icp", event.target.value)} />
        </div>
        <div className="input-row" style={{ margin: 0 }}>
          <div className="input-label">Search area <span style={{ color: "var(--fg-3)", fontWeight: 500 }}>(optional)</span></div>
          <input type="text" placeholder="e.g. Knoxville, East TN, Southeast" value={runCriteria.geography || ""} onChange={(event) => onRunCriteriaChange?.("geography", event.target.value)} />
        </div>
        <button className="btn btn-primary" style={{ alignSelf: "end", height: 34 }} onClick={() => onRunNow?.({ mode: "public_demo" })} disabled={runBusy}><Icon name="refresh" />{runBusy ? "Running…" : "Run lead search"}</button>
      </div>
    </div>
  </div>
);

function liveRunGuard(providers = []) {
  if (!providers.length) return "Run Agent blocked: provider status has not loaded yet.";
  const blocked = providers.filter((provider) => provider.status === "blocked");
  if (blocked.length) {
    const names = blocked.map((provider) => provider.name).join(", ");
    return `Run Agent blocked: ${names} not configured.`;
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
    target: [run.searchGeographySegment || run.geographySegment, run.searchQuery].filter(Boolean).join(" · ") || "TAM contact enrichment",
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
    revenueConfidenceCoverage: run.revenueConfidenceCoverage || "0%",
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
      setProviders(Object.values(PUBLIC_DEMO_PROVIDERS).map(mapProvider));
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
      const website = String(runCriteria.website || "").trim();
      const icp = String(runCriteria.icp || "").trim();
      const geography = String(runCriteria.geography || "").trim();
      if (!website) {
        setRunNotice("");
        setError("Enter a business website. ICP and search area are optional — the public search will infer them from that site.");
        setRunBusy(false);
        return;
      }
      setRunNotice("Running capped real public search (Serper, server-side)…");
      try {
        const result = await apiJson("/api/leadgen-trial", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ website, icp, geography }),
        });
        const mappedLeads = (result.leads || []).map((lead, index) => mapLead(leadgenTrialToRawLead(lead, result, index)));
        const mappedRun = mapRun(publicRunFromResult(result));
        setLeads(mappedLeads);
        setRuns([mappedRun]);
        setAgentStatus(publicDemoStatus({ ...runCriteria, website, icp, geography }, result));
        setSelectedId(mappedLeads[0]?.id || null);
        setPanelOpen(false);
        setPage("sheet");
        if (result.status === "shortfall") {
          setRunNotice(`Capped public search ran but did not return strong real leads. ${result.shortfall_reason || "Refine ICP or search area and try again."} No fake sample rows were padded in.`);
        } else {
          setRunNotice(`Capped real public search complete: ${mappedLeads.length} public-safe lead${mappedLeads.length === 1 ? "" : "s"} in the Lead Sheet UI. Direct contacts and outreach stay gated.`);
        }
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
        const approved = window.confirm("Run Agent now? This may spend Serper/BrowserBase/Apollo/Hunter credits and write to the lead sheet. Apollo is fallback-only.");
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
          targetWeeklyVolume: Number(runCriteria.targetWeeklyVolume || 50),
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
      setRunNotice("Sheet cleared. Enter a business website to run the capped real public search again; ICP and search area can stay blank for inference.");
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
        setRunNotice("Run the public lead search before exporting rows.");
        return;
      }
      const header = ["fit_score", "company", "domain", "contact", "title", "industry", "geography", "phone", "social", "suggested_agent", "outreach_angle"];
      const rows = leads.map((lead) => [
        lead.fitScore,
        lead.company,
        lead.domain,
        lead.contactName,
        lead.title,
        lead.industry,
        lead.hq,
        lead.directPhone || lead.companyPhone || "gated/private run",
        lead.socialPath || "gated/private run",
        getOperationalPain(lead).suggestedAgent || "",
        lead.bestPath || lead.notes || "",
      ]);
      const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "clawdified-lead-growth-public-search.csv";
      a.click();
      URL.revokeObjectURL(a.href);
      setRunNotice("Public-search CSV exported from the capped real search rows.");
      return;
    }
    window.location.href = "/api/export/csv";
  }

  function updateRunCriteria(key, value) {
    setRunCriteria((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "icp") next.searchQuery = value;
      if (key === "geography") next.geographySegment = value;
      return next;
    });
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
        {PUBLIC_DEMO_MODE && <PublicDemoIntake runCriteria={runCriteria} onRunCriteriaChange={updateRunCriteria} onRunNow={runNow} runBusy={runBusy} />}
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
