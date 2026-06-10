/* eslint-disable */

function fmtAgentDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function nextMorningNine(reference = new Date()) {
  const next = new Date(reference);
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return next;
}

function fmtAgentNextRun(value) {
  const d = value ? new Date(value) : nextMorningNine();
  if (Number.isNaN(d.getTime())) return "9:00 AM tomorrow";
  const time = d.toLocaleString([], { hour: "numeric", minute: "2-digit" });
  const weekday = d.toLocaleString([], { weekday: "long" });
  return `${time} ${weekday}`;
}

function fmtAgentInterval(minutes) {
  const n = Number(minutes || 0);
  if (!n) return "Disabled";
  if (n % 1440 === 0) return `Every ${n / 1440} day(s)`;
  if (n % 60 === 0) return `Every ${n / 60} hour(s)`;
  return `Every ${n} minute(s)`;
}

function providerRowsFromStatus(agentStatus) {
  return Object.values(agentStatus?.providerStatus || {}).map((provider) => ({
    name: provider.provider || provider.envVar || "Provider",
    role: provider.purpose || "Data provider",
    configured: Boolean(provider.configured),
    required: provider.required !== false,
    status: provider.status || (provider.configured ? "configured" : "not configured"),
  }));
}

function agentProviderRows(agentStatus, providers = []) {
  const liveRows = providerRowsFromStatus(agentStatus);
  if (liveRows.length) return liveRows;
  return (providers || []).map((provider) => ({
    name: provider.name || "Provider",
    role: provider.category || provider.role || "Data provider",
    configured: provider.configured ?? (provider.status === "ok"),
    required: provider.required !== false,
    status: provider.status || (provider.configured ? "configured" : "not configured"),
  }));
}

function agentStatusLabel(agentStatus) {
  const scheduler = agentStatus?.scheduler || {};
  if (agentStatus?.currentRunId) return "Running";
  if (scheduler.enabled) return "Scheduled";
  return agentStatus?.status ? String(agentStatus.status) : "Idle";
}

function countRealLeads(leads = []) {
  const rows = (leads || []).filter((lead) => lead && lead.id !== "empty");
  return {
    total: rows.length,
    finished: rows.filter((lead) => lead.raw?.isFinishedEnrichedLead || lead.researchStatus === "finished").length,
    incomplete: rows.filter((lead) => !(lead.raw?.isFinishedEnrichedLead || lead.researchStatus === "finished")).length,
    directEmails: rows.filter((lead) => lead.email).length,
    directPhones: rows.filter((lead) => lead.directPhone).length,
  };
}

function compactText(value, max = 110) {
  const text = String(value || "").trim();
  if (!text) return "Not configured";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function normalizeAgentQuestion(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/cloudified/g, "clawdified")
    .replace(/[^a-z0-9$%+./@#\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function agentQuestionHas(q, patterns) {
  return patterns.some((pattern) => pattern.test(q));
}

function agentProviderSummary(providers) {
  if (!providers.length) return "I don’t have the connection readout loaded yet.";
  const ready = providers.filter((provider) => provider.configured).length;
  const required = providers.filter((provider) => provider.required !== false);
  const requiredReady = required.filter((provider) => provider.configured).length;
  const missing = required.filter((provider) => !provider.configured).map((provider) => provider.name);
  if (missing.length) return `${requiredReady}/${required.length || providers.length} required checks are ready. I’d fix ${missing.join(", ")} before trusting a live run.`;
  return `${ready}/${providers.length} checks look ready. The demo keeps setup details simple so the page focuses on what the agent returns.`;
}

function latestRunSummaryForChat(latest) {
  if (!latest) return "I don’t see a run yet, so I’m judging from the saved business context + ICP rather than a finished sheet.";
  const finished = Number(latest.finishedEnrichedLeadsAdded || 0);
  const incomplete = Number(latest.incompleteAccountsSaved || 0);
  const companies = Number(latest.rawCompaniesFound || 0);
  const people = Number(latest.peopleFound || 0);
  const action = latest.action || latest.trigger || "Last run";
  const read = finished
    ? `${action} produced ${finished} review-ready row(s).`
    : `${action} did not leave a finished row yet.`;
  return `${read} I’m also seeing ${incomplete} incomplete account(s), ${companies} company candidate(s), and ${people} person/contact candidate(s).`;
}

function topLeadForAgent(leads = []) {
  return (leads || [])
    .filter((lead) => lead && lead.id !== "empty")
    .slice()
    .sort((a, b) => Number(b.fitScore || b.clawdifiedCompatibilityScore || 0) - Number(a.fitScore || a.clawdifiedCompatibilityScore || 0))[0] || null;
}

function painReadForAgent(lead) {
  if (!lead) return null;
  const insight = window.LeadInsights?.operationalPainForLead
    ? window.LeadInsights.operationalPainForLead(lead)
    : null;
  return {
    headline: compactText(insight?.headline || lead.notes || lead.raw?.workflowPainClues, 92),
    why: compactText(insight?.why || lead.raw?.reasonToContact || lead.notes, 140),
    next: compactText(insight?.entryPoint || lead.bestPath || lead.raw?.suggestedFirstCallAngle, 155),
  };
}

function bulletList(items) {
  return items.filter(Boolean).map((item) => `• ${item}`).join("\n");
}

function thinkingAnswer({ read, weighing = [], next, guardrail }) {
  const parts = [];
  if (read) parts.push(`My read:\n${read}`);
  if (weighing.length) parts.push(`What I’m weighing:\n${bulletList(weighing)}`);
  if (next) parts.push(`Next move:\n${next}`);
  if (guardrail) parts.push(`Guardrail:\n${guardrail}`);
  return parts.join("\n\n");
}

function extractBusinessHint(q) {
  const knownEarly = [
    ["dental", "dental office"], ["dent", "dental office"], ["roof", "roofing business"], ["hvac", "HVAC business"], ["plumb", "plumbing business"],
    ["med spa", "med spa"], ["spa", "service business"], ["real estate", "real estate business"], ["law", "law firm"],
    ["clinic", "clinic"], ["contractor", "contractor"], ["landscap", "landscaping business"], ["restaurant", "restaurant"],
    ["gym", "gym"], ["insurance", "insurance agency"], ["account", "accounting firm"], ["auto", "auto service business"],
  ];
  const earlyHit = knownEarly.find(([needle]) => q.includes(needle));
  if (earlyHit) return earlyHit[1];
  const patterns = [
    /\b(?:i|we)\s+(?:run|own|manage|operate|have)\s+(?:an?\s+)?([a-z0-9][a-z0-9\s/-]{2,42}?)(?:\s+(?:business|company|practice|office|shop|firm|agency))?(?:\b|$)/,
    /\b(?:my|our)\s+([a-z0-9][a-z0-9\s/-]{2,36}?)(?:\s+(?:business|company|practice|office|shop|firm|agency))\b/,
    /\b(?:for|in)\s+(?:an?\s+)?([a-z0-9][a-z0-9\s/-]{2,36}?)(?:\s+(?:business|company|practice|office|shop|firm|agency))\b/,
  ];
  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (match?.[1]) {
      return compactText(match[1]
        .replace(/\b(?:and|but|with|that|where|who|what|how|can|would|could).*$/g, "")
        .trim(), 42);
    }
  }
  const known = [
    ["dent", "dental office"], ["roof", "roofing business"], ["hvac", "HVAC business"], ["plumb", "plumbing business"],
    ["med spa", "med spa"], ["spa", "service business"], ["real estate", "real estate business"], ["law", "law firm"],
    ["clinic", "clinic"], ["contractor", "contractor"], ["landscap", "landscaping business"], ["restaurant", "restaurant"],
    ["gym", "gym"], ["insurance", "insurance agency"], ["account", "accounting firm"], ["auto", "auto service business"],
  ];
  const hit = known.find(([needle]) => q.includes(needle));
  return hit ? hit[1] : "";
}

function likelyWorkflowExamplesForBusiness(businessHint, q = "") {
  const text = `${businessHint} ${q}`.toLowerCase();
  if (/dent|clinic|medical|health|med spa|spa/.test(text)) return ["new-patient intake", "missed-call follow-up", "appointment reminders", "review requests"];
  if (/roof|hvac|plumb|contract|landscap|auto|service/.test(text)) return ["quote follow-up", "missed-call triage", "job status updates", "review requests"];
  if (/real estate|insurance|law|account|financial/.test(text)) return ["lead intake", "document collection", "follow-up reminders", "client status updates"];
  if (/restaurant|gym|fitness|retail/.test(text)) return ["inquiry follow-up", "booking or membership reminders", "review requests", "repeat-customer follow-up"];
  return ["intake", "follow-up", "status updates", "review or handoff work"];
}

function inferProspectIntent(q) {
  if (!q) return { primary: "empty", vague: true, confidence: 0 };
  const words = q.split(/\s+/).filter(Boolean);
  const short = words.length <= 4;
  const vague = short || /\b(this|that|it|thing|stuff|whatever|so what|and\?|ok|okay|huh|confus|lost|don.?t get|explain|plain english|what am i looking at|what is going on)\b/.test(q);
  const businessHint = extractBusinessHint(q);
  const scores = {
    confused: /\b(confus|lost|don.?t get|huh|what is this|what am i looking at|plain english|explain|eli5|simple)\b/.test(q) ? 4 : 0,
    value: /\b(why|care|matter|worth|point|so what|save|help|benefit|roi|time|money|better)\b/.test(q) ? 3 : 0,
    fit: /\b(my business|for me|would this work|can this work|do for me|use this|apply|fit|need this|good for)\b/.test(q) || businessHint ? 4 : 0,
    workflow: /\b(automate|workflow|process|task|manual|follow.?up|intake|reviews?|scheduling|admin|handoff|crm|email|calls?|missed)\b/.test(q) ? 4 : 0,
    leads: /\b(leads?|prospects?|customers?|find|contact|outreach|sheet|list|score|qualif)\b/.test(q) ? 4 : 0,
    real: /\b(real|live|fake|demo|sample|actual|does it actually|is this)\b/.test(q) ? 3 : 0,
    price: /\b(cost|price|pricing|quote|pay|charge|expensive|budget|monthly|month|fee)\b/.test(q) ? 4 : 0,
    integrate: /\b(integrat|connect|crm|gmail|sheets?|calendar|hubspot|slack|zapier|software|tools?|app)\b/.test(q) ? 4 : 0,
    timeline: /\b(how long|timeline|start|setup|build|when|fast|quick)\b/.test(q) ? 3 : 0,
  };
  if (vague && !Object.values(scores).some(Boolean)) scores.confused = 2;
  const [primary, score] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0] || ["open", 0];
  return { primary: score > 0 ? primary : "open", vague, businessHint, confidence: score };
}

function adaptiveProspectAnswer({ question, q, topLead, topPain, totals, latest }) {
  const intent = inferProspectIntent(q);
  const shouldAnswer = intent.vague || intent.confidence > 0 || /\?/.test(String(question || ""));
  if (!shouldAnswer) return null;

  const businessLabel = intent.businessHint ? `a ${intent.businessHint}` : "your business";
  const workflowExamples = likelyWorkflowExamplesForBusiness(intent.businessHint, q);
  const leadExample = topLead
    ? `In this sample sheet, I’d inspect ${topLead.company} first because the row has a stronger fit signal and a reviewable next-step angle.`
    : "Right now the sheet is empty, so I’d run the preview before judging any specific row.";
  const painLine = topPain?.headline && topPain.headline !== "Not configured"
    ? `The kind of clue I’m looking for is: ${topPain.headline}.`
    : `The kind of clue I’m looking for is repeatable work like ${workflowExamples.slice(0, 3).join(", ")}.`;
  const clarify = intent.vague
    ? "I’m reading your question a bit loosely, so I’ll answer the most likely meaning and give you a better next question."
    : "I’m reading this as a prospect question, not a command.";

  if (intent.primary === "confused" || intent.primary === "open") {
    return thinkingAnswer({
      read: `${clarify} Short version: this previews how Clawdified turns a messy business process or lead profile into a reviewable output, instead of making a person sort through every lead, follow-up, and handoff manually.`,
      weighing: [
        "If you mean “what am I looking at?” — it’s the finished workspace an agent would maintain.",
        `If you mean “how would this help me?” — the useful target is repetitive work in ${businessLabel}, like ${workflowExamples.slice(0, 3).join(", ")}.`,
        leadExample,
      ],
      next: `Tell me your business type and one workflow that keeps slipping, or ask: “what would you automate for ${businessLabel}?”`,
    });
  }

  if (intent.primary === "fit" || intent.primary === "workflow") {
    return thinkingAnswer({
      read: `For ${businessLabel}, I’d start by looking for the workflow that repeats often, costs time, and has a clear approval point. That is usually where an agent makes money fastest.`,
      weighing: [
        `Likely starting workflows: ${workflowExamples.join(", ")}.`,
        "A good agent should produce a finished queue, sheet, draft, reminder, or decision packet — not just chat back at the team.",
        painLine,
      ],
      next: `The question I’d ask you next is: which part of ${businessLabel} gets repeated every week but still needs judgment before it goes out?`,
      guardrail: "I can explain the fit publicly, but the exact ICP, constraints, and approvals get handled in the actual setup call.",
    });
  }

  if (intent.primary === "value") {
    return thinkingAnswer({
      read: "The point is not “AI for AI’s sake.” The point is whether one repetitive workflow is costing enough time, missed revenue, slow follow-up, or messy handoffs to justify turning it into an agent.",
      weighing: [
        `For ${businessLabel}, I’d look at where people retype, chase, remind, summarize, update a sheet/CRM, or forget follow-up.`,
        "The fastest wins usually have a clear before/after: less manual admin, faster response, cleaner review queue, or more consistent follow-up.",
        latestRunSummaryForChat(latest),
      ],
      next: "If you tell me the task you hate doing twice a week, I can point to whether it looks agent-worthy or just a normal process fix.",
    });
  }

  if (intent.primary === "leads") {
    return thinkingAnswer({
      read: "If you’re asking about lead generation, the agent’s job is to turn your business context + ICP into rows a human can review: likely account, reason it may fit, contact route, source note, and next angle.",
      weighing: [
        `${totals.total} visible row(s), ${totals.finished} review-ready, ${totals.incomplete} still incomplete in the current demo state.`,
        leadExample,
        "A good row should make the next human decision easier; it should not pretend every scraped name is a real opportunity.",
      ],
      next: topLead ? `Open ${topLead.company} and ask why it matched, or run the preview if you want to watch the sheet rebuild.` : "Run the preview, then ask me why the first finished row is or is not worth pursuing.",
      guardrail: "The public demo does not send outreach on its own or publish the exact setup recipe.",
    });
  }

  if (intent.primary === "real") {
    return thinkingAnswer({
      read: "This public page is a showroom, not an open free-for-all lead engine. It shows the kind of workspace and reasoning a configured Clawdified agent would produce once the business context + ICP are loaded.",
      weighing: [
        "The interface and review flow are real product shape.",
        "The rows are examples so the site can show the workflow without letting anonymous visitors pull lead lists.",
        "A real build gets configured around your workflow, tools, approval rules, and output format.",
      ],
      next: "If you want to see it against your business, the next step is a workflow map call — not typing secret business criteria into a public page.",
    });
  }

  if (intent.primary === "price") {
    return thinkingAnswer({
      read: "Pricing depends on the workflow, integrations, approval points, and how much ongoing maintenance the agent needs. I would not quote it from one vague chat message.",
      weighing: [
        "A simple follow-up/review workflow is different from a multi-system operations agent.",
        "The right way to price it is against the cost of the manual workflow and the value of getting the output consistently done.",
        "This page avoids package pricing because the workflow needs to be mapped first.",
      ],
      next: "Map one workflow first; then Clawdified can give you a clear build option instead of a generic package price.",
    });
  }

  if (intent.primary === "integrate") {
    return thinkingAnswer({
      read: `For ${businessLabel}, I’d first identify where the work actually happens — inbox, CRM, spreadsheet, calendar, forms, messages, or docs — then connect only the pieces needed for the workflow.`,
      weighing: [
        "The agent should sit between the tools and produce the next approved output.",
        "Integrations matter less than the handoff: what comes in, what decision is made, and what finished thing should come out.",
        "Secure connectors get set up in a real project, not from this page.",
      ],
      next: "Name the tool your team lives in and the repetitive task around it; I’ll explain what the agent would likely watch, draft, update, or queue.",
    });
  }

  if (intent.primary === "timeline") {
    return thinkingAnswer({
      read: "The build timeline depends on how clear the workflow is and how many systems need to be connected. A narrow workflow can be mapped quickly; messy multi-step approvals take longer because they need safer review paths.",
      weighing: ["Do we know the trigger?", "Do we know the decision rules?", "Do we know the final output and who approves it?"],
      next: "Start by naming the trigger and the finished output. Example: “when a new form comes in, draft the follow-up and update the sheet.”",
    });
  }

  return null;
}

function buildAgentChatAnswer(question, context = {}) {
  const q = normalizeAgentQuestion(question);
  const scheduler = context.agentStatus?.scheduler || {};
  const providers = agentProviderRows(context.agentStatus, context.providers);
  const requiredMissing = providers.filter((provider) => provider.required && !provider.configured);
  const latest = context.runs?.[0] || null;
  const totals = countRealLeads(context.leads);
  const topLead = topLeadForAgent(context.leads);
  const topPain = painReadForAgent(topLead);
  const topLeadLine = topLead
    ? `${topLead.company} is the row I’d look at first: ${topLead.fitScore || topLead.clawdifiedCompatibilityScore || 0} fit, ${topLead.contactName || "contact still being reviewed"}, ${topLead.title || "title not confirmed"}.`
    : "I don’t have rows in the sheet yet, so I’d start by running the preview and then judging the filled sheet.";
  const scheduleLine = scheduler.enabled
    ? `${fmtAgentInterval(scheduler.intervalMinutes)}, with the next visible run around ${fmtAgentDateTime(scheduler.nextRunAt)}`
    : "the schedule is off, so this should only move when someone intentionally runs it";
  const providerLine = requiredMissing.length
    ? `I’d pause before trusting a live run because ${requiredMissing.map((p) => p.name).join(", ")} ${requiredMissing.length === 1 ? "looks" : "look"} missing.`
    : "The demo’s required checks look ready, so the useful question is lead quality rather than setup.";

  if (!q) {
    return thinkingAnswer({
      read: "Ask me like you’d ask a person reviewing the lead sheet. I’ll answer from the visible rows, run state, and Clawdified workflow context.",
      weighing: ["Which rows look worth human review", "Why a workflow agent might matter", "What still needs a human check"],
      next: "Try: “what are you seeing?”, “why did the top lead match?”, or “what would you do next?”",
    });
  }

  if (/^(hi|hey|hello|yo|sup|good morning|good afternoon|good evening)\b/.test(q)) {
    return thinkingAnswer({
      read: "Hey — I’m here. I’m watching the lead sheet, not just repeating a command list.",
      weighing: [topLeadLine, `${totals.total} visible row(s), ${totals.finished} finished, ${totals.incomplete} still needing review`],
      next: "Ask me what I’m seeing, why a row matters, or what I’d check before outreach.",
    });
  }

  const adaptive = adaptiveProspectAnswer({ question, q, topLead, topPain, totals, latest });
  if (adaptive) return adaptive;

  if (agentQuestionHas(q, [/\bwhat do you do\b/, /\bwho are you\b/, /\bwhat are you\b/, /\byour job\b/, /\byour purpose\b/])) {
    return thinkingAnswer({
      read: "I’m the lead-review layer for this demo. I look at the business context + ICP, turn likely accounts into a reviewable sheet, and explain why a row might deserve attention.",
      weighing: ["Is there an obvious workflow pain?", "Is there enough source/contact context to review?", "Is the row ready for a human decision or still incomplete?"],
      next: "Use me to understand the sheet before anyone takes action.",
      guardrail: "I don’t send outreach or reveal the exact setup recipe from the public demo.",
    });
  }

  if (agentQuestionHas(q, [/clawdified/, /about (the )?(brand|company|business)/, /what do you know about/])) {
    return thinkingAnswer({
      read: "Clawdified builds practical AI agents for repetitive business work — the stuff that usually lives in inboxes, follow-up notes, spreadsheets, calendars, and handoffs.",
      weighing: ["The buyer needs a workflow painful enough to justify an agent", "The agent should create a concrete output or approval queue, not just chat", "The public page should show the result without exposing the sales playbook"],
      next: "For this demo, I’m showing what a lead sheet can look like after that kind of business context + ICP have already been loaded.",
    });
  }

  if (agentQuestionHas(q, [/good lead/, /qualified lead/, /identify.*lead/, /qualif/, /criteria/, /match score/, /good prospect/, /what makes.*lead/, /how.*lead/])) {
    return thinkingAnswer({
      read: topLeadLine,
      weighing: [
        topPain?.headline ? `Likely workflow pain: ${topPain.headline}` : "I’m looking for repeatable follow-up, admin, scheduling, intake, or status-update pain.",
        `${totals.directEmails} row(s) have email and ${totals.directPhones} have direct/mobile phone in this demo state.`,
        "I want enough evidence for a human to review without pretending the row is automatically closed-won.",
      ],
      next: topPain?.next || "Open the best row, check the source/contact notes, then decide whether the angle is worth a real conversation.",
      guardrail: "Exact ICP thresholds are set during the real setup, not guessed from the public page.",
    });
  }

  if (agentQuestionHas(q, [/how.*(system|it|agent).*work/, /workflow/, /process/, /pipeline/, /how.*find/, /how.*search/])) {
    return thinkingAnswer({
      read: `I’m seeing this as a workflow, not a magic search box: load the profile, look for likely accounts, attach proof/contact routes, then write a sheet a human can judge. Current sheet: ${totals.total} row(s), ${totals.finished} finished, ${totals.incomplete} incomplete.`,
      weighing: ["Fit: does the business look like it has repeatable work Clawdified could automate?", "Evidence: is there enough public/source context to support the row?", "Actionability: is there a contact route and a clear next-step angle?"],
      next: topLead ? `I’d start by opening ${topLead.company} and checking whether the suggested workflow pain feels real.` : "Run the preview, then review the top row instead of judging an empty sheet.",
      guardrail: "Outreach stays human-reviewed from this public demo.",
    });
  }

  if (agentQuestionHas(q, [/provider/, /data source/, /connection/, /api key/, /configured/, /missing key/])) {
    return thinkingAnswer({
      read: providerLine,
      weighing: [agentProviderSummary(providers), "The source checks stay high-level here so viewers can focus on the lead sheet output."],
      next: requiredMissing.length ? "Fix the missing setup before relying on a real run." : "Move from setup checks to row-quality review.",
    });
  }

  if (agentQuestionHas(q, [/schedule/, /cadence/, /next run/, /automatic/, /autonomous/, /heartbeat/])) {
    return thinkingAnswer({
      read: `Schedule-wise, ${scheduleLine}.`,
      weighing: ["Manual runs should stay visibly intentional", "Background runs should write inspectable rows, not silently send messages", "Public demo targets stay generalized"],
      next: "Use Run agent when you want the sheet to visibly rebuild for the demo.",
    });
  }

  if (agentQuestionHas(q, [/latest/, /last run/, /recent run/, /history/, /result/, /status/, /blocked/, /stuck/, /shortfall/, /why.*zero/, /why.*missing/, /quality/, /what.*seeing/])) {
    return thinkingAnswer({
      read: latestRunSummaryForChat(latest),
      weighing: [
        `${totals.total} total visible row(s), ${totals.finished} finished, ${totals.incomplete} incomplete.`,
        `${totals.directEmails} row(s) have email and ${totals.directPhones} have direct/mobile phone.`,
        topLeadLine,
      ],
      next: topLead ? `I’d inspect ${topLead.company}, then decide whether its likely pain — ${topPain?.headline || "the saved workflow clue"} — is strong enough for a real Clawdified conversation.` : "Run the preview so there is something concrete to judge.",
    });
  }

  if (agentQuestionHas(q, [/\b(run|start|launch)\b.*\b(agent|search|lead|job)\b/, /\bkick off\b/, /^run\b/, /^start\b/, /^launch\b/])) {
    return thinkingAnswer({
      read: "I can talk through what I would check, but I won’t quietly start work from inside chat.",
      weighing: ["A visible button keeps the demo honest", "The sheet should change in front of the viewer", "No outreach or hidden external action should happen from a chat sentence"],
      next: "Click Run agent and I’ll treat the filled sheet as the thing to review.",
    });
  }

  if (agentQuestionHas(q, [/outreach/, /send/, /email/, /dm/, /sms/, /call/, /message/, /linkedin message/, /facebook message/])) {
    return thinkingAnswer({
      read: "I’d use the sheet to suggest a first conversation angle, not to send anything automatically.",
      weighing: [topLead ? `${topLead.company}: ${topPain?.next || topLead.bestPath || "review the saved angle first"}` : "No row is selected yet", "A human should approve the account, contact route, and message before outreach", "Social/email sends are outside this public preview"],
      next: "Open a row, review the reason and contact route, then decide if the angle is worth using.",
      guardrail: "No Gmail, LinkedIn, Facebook, Instagram, SMS, calls, or DMs are sent from here.",
    });
  }

  return thinkingAnswer({
    read: "I may be guessing at your intent, but I’m treating this like a real prospect question. The useful lens is: what repetitive work, lead review, follow-up, or handoff would be better if it showed up as a finished queue instead of living in someone’s head?",
    weighing: [topLeadLine, "If you are asking about your own business, I need the business type and the workflow that keeps repeating.", "If you are asking about the demo sheet, I can explain what the agent is checking and what a human should review next."],
    next: "Reply with the messy task in plain English — even if it’s vague — and I’ll translate it into the likely agent workflow.",
  });
}

function agentAnswerText(answer) {
  return typeof answer === "string" ? answer : String(answer?.text || "");
}

function publicAgentChatContext(context = {}) {
  const providers = agentProviderRows(context.agentStatus, context.providers);
  const latest = context.runs?.[0] || null;
  const totals = countRealLeads(context.leads);
  const topLead = topLeadForAgent(context.leads);
  const topPain = painReadForAgent(topLead);
  return {
    mode: "public_lead_growth_showroom",
    totals,
    schedulerEnabled: Boolean(context.agentStatus?.scheduler?.enabled),
    providersReady: providers.filter((provider) => provider.required && provider.configured).length,
    providersRequired: providers.filter((provider) => provider.required).length,
    latestRun: latest ? {
      action: latest.action || latest.trigger || "Last run",
      finished: Number(latest.finishedEnrichedLeadsAdded || 0),
      incomplete: Number(latest.incompleteAccountsSaved || 0),
      companies: Number(latest.rawCompaniesFound || 0),
      people: Number(latest.peopleFound || 0),
    } : null,
    topLead: topLead ? {
      company: compactText(topLead.company, 80),
      industry: compactText(topLead.industry, 64),
      geography: compactText(topLead.geography, 64),
      fitScore: Number(topLead.fitScore || topLead.clawdifiedCompatibilityScore || 0),
      pain: compactText(topPain?.headline || topLead.notes || topLead.raw?.workflowPainClues, 120),
      nextAngle: compactText(topPain?.next || topLead.bestPath || topLead.raw?.suggestedFirstCallAngle, 140),
    } : null,
  };
}

async function requestAgentChatAnswer(question, context, history = []) {
  try {
    const res = await fetch("/api/agent/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question,
        context: publicAgentChatContext(context),
        history: history.slice(-6).map((message) => ({ role: message.role, text: compactText(message.text, 420) })),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
    if (body?.answer) return body.answer;
  } catch (_err) {
    // Static/offline fallback: keep the chat useful if the demo is viewed without the Node API.
  }
  return agentAnswerText(buildAgentChatAnswer(question, context));
}

const AgentChatPanel = ({ agentStatus, providers = [], runs = [], leads = [], runCriteria = {}, onRunNow, runBusy, compact = false }) => {
  const [draft, setDraft] = React.useState("");
  const [isThinking, setIsThinking] = React.useState(false);
  const [messages, setMessages] = React.useState(() => ([
    {
      id: "welcome",
      role: "agent",
      label: "Clawdified agent",
      text: "My read:\nI’m here to review the lead sheet with you. Ask what I’m seeing, why a row might fit, or what I’d check before outreach.\n\nNext move:\nRun the preview, then ask me which row I’d inspect first.",
    },
  ]));
  const providerRows = agentProviderRows(agentStatus, providers);
  const requiredReady = providerRows.filter((provider) => provider.required && provider.configured).length;
  const requiredTotal = providerRows.filter((provider) => provider.required).length;
  const totals = countRealLeads(leads);

  async function submitMessage(textOverride) {
    const text = String((textOverride ?? draft) || "").trim();
    if (!text || isThinking) return;
    const thinkingId = `thinking-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", label: "You", text },
      { id: thinkingId, role: "agent", label: "Clawdified agent", text: "Checking the sheet, run state, and fit clues…", pending: true },
    ]);
    setDraft("");
    setIsThinking(true);
    const context = { agentStatus, providers, runs, leads, runCriteria };
    const answer = await requestAgentChatAnswer(text, context, messages);
    setMessages((prev) => prev.map((message) => message.id === thinkingId
      ? { ...message, text: answer, pending: false }
      : message
    ));
    setIsThinking(false);
  }

  return (
    <section className={"agent-chat-card" + (compact ? " compact" : "")}>
      <div className="agent-chat-head">
        <div>
          <div className="agent-chat-kicker"><span className="pulse" /> Lead agent readout</div>
          <h3>{compact ? "Ask what it sees" : "Ask the agent what it’s seeing"}</h3>
          <p>{compact ? "Plain-English read on rows, match quality, and next checks." : "Ask in plain English. I’ll reason from the visible sheet, run proof, and Clawdified context without sending outreach from chat."}</p>
        </div>
        <div className="agent-chat-status-stack">
          <span className={"status-pill " + (agentStatus?.currentRunId ? "degraded" : agentStatus?.scheduler?.enabled ? "ok" : "blocked")}><span className="d" />{agentStatusLabel(agentStatus)}</span>
          <span className="agent-chat-mini-stat">providers {requiredReady}/{requiredTotal || providerRows.length || 0}</span>
          <span className="agent-chat-mini-stat">rows {totals.total}</span>
        </div>
      </div>

      <div className="agent-chat-prompts" aria-label="Suggested questions">
        {["What are you seeing?", "Why is the top row a fit?", "What would you check next?"].map((prompt) => (
          <button key={prompt} type="button" onClick={() => submitMessage(prompt)} disabled={isThinking}>{prompt}</button>
        ))}
      </div>

      <div className="agent-chat-thread" aria-live="polite">
        {messages.map((message, index) => (
          <div key={message.id || `${message.role}-${index}`} className={"agent-chat-message " + message.role + (message.pending ? " pending" : "")}>
            <div className="agent-chat-message-meta"><b>{message.label}</b></div>
            <div className="agent-chat-message-text">{message.text}</div>
          </div>
        ))}
      </div>

      <form className="agent-chat-composer" onSubmit={(event) => { event.preventDefault(); submitMessage(); }}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitMessage();
            }
          }}
          rows={compact ? 2 : 3}
          placeholder="Ask naturally — e.g. what are you seeing in the lead sheet?"
          disabled={isThinking}
        />
        <div className="agent-chat-composer-actions">
          {onRunNow && (
            <button type="button" className="btn" onClick={() => onRunNow({ mode: "live" })} disabled={runBusy || isThinking} title="Runs the visible preview so the sheet changes in front of the viewer.">
              <Icon name="refresh" />{runBusy ? "Running…" : "Run agent"}
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={isThinking || !draft.trim()}><Icon name="sparkle" />{isThinking ? "Reviewing…" : "Ask"}</button>
        </div>
      </form>
    </section>
  );
};

const AgentChatPage = ({ agentStatus, providers = [], runs = [], leads = [], runCriteria = {}, onRunNow, runBusy }) => {
  return (
    <div className="page agent-chat-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Agent</h1>
          <div className="page-sub">A clean chat workspace for asking the Clawdified lead agent normal questions.</div>
        </div>
      </div>

      <div className="agent-workspace-grid">
        <AgentChatPanel agentStatus={agentStatus} providers={providers} runs={runs} leads={leads} runCriteria={runCriteria} onRunNow={onRunNow} runBusy={runBusy} />
      </div>
    </div>
  );
};

const AgentSettings = ({ agentStatus, providers = [], runs = [], leads = [], runCriteria = {}, onRunCriteriaChange, onRunNow, runBusy }) => {
  const scheduler = agentStatus?.scheduler || {};
  const criteria = scheduler.criteria || {};
  const providerRows = agentProviderRows(agentStatus, providers);
  const [schedulerUiEnabled, setSchedulerUiEnabled] = React.useState(Boolean(scheduler.enabled));
  React.useEffect(() => { setSchedulerUiEnabled(Boolean(scheduler.enabled)); }, [scheduler.enabled]);
  const schedulerNextRun = nextMorningNine();
  const schedulerLeadTarget = "Sample";
  const schedulerStatusText = schedulerUiEnabled ? "Autonomous Scheduler enabled" : "Autonomous Scheduler disabled";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Agent</h1>
          <div className="page-sub">Schedule the preview, review the demo state, and ask the lead agent what it is seeing.</div>
        </div>
      </div>

      <div className="automation-layout">
        <div className="automation-stack">
          <div className="card">
            <div className="card-head">
              <div className="icon"><Icon name="bolt" /></div>
              <div style={{ flex: 1 }}>
                <h3 className="card-title">Autonomous Scheduler</h3>
                <div className="card-sub">Enable it when you want the lead agent queued for the next morning run.</div>
              </div>
              <span className={"status-pill " + (schedulerUiEnabled ? "ok" : "blocked")}><span className="d" />{schedulerStatusText}</span>
            </div>
            <div className="card-body">
              <div className="kpi-row automation-kpis">
                <div className="kpi">
                  <div className="kpi-label">Cadence</div>
                  <div className="kpi-value">{schedulerUiEnabled ? "Daily" : "Disabled"}</div>
                  <div className="kpi-foot">morning run</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Next run</div>
                  <div className="kpi-value" style={{ fontSize: 18 }}>{fmtAgentNextRun(schedulerNextRun)}</div>
                  <div className="kpi-foot">next morning</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Run output</div>
                  <div className="kpi-value">{schedulerLeadTarget}</div>
                  <div className="kpi-foot">public-source rows</div>
                </div>
              </div>
              <div className="toggle-row" style={{ paddingTop: 0 }}>
                <div className="toggle-row-info">
                  <div className="toggle-row-label">{schedulerStatusText}</div>
                  <div className="toggle-row-desc">{schedulerUiEnabled ? `Scheduled for ${fmtAgentNextRun(schedulerNextRun)}.` : `Enable to schedule the next run for ${fmtAgentNextRun(schedulerNextRun)}.`}</div>
                </div>
                <button
                  type="button"
                  className={"switch " + (schedulerUiEnabled ? "on" : "")}
                  aria-label={schedulerStatusText}
                  aria-pressed={schedulerUiEnabled}
                  onClick={() => setSchedulerUiEnabled((enabled) => !enabled)}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="icon"><Icon name="target" /></div>
              <div>
                <h3 className="card-title">Lead Growth preview state</h3>
                <div className="card-sub">This shows what the finished workspace feels like: why each company matched, source notes, contact routes, and next-step angles in one sheet.</div>
              </div>
            </div>
            <div className="card-body automation-control-body">
              <div className="kpi-row automation-kpis">
                <div className="kpi">
                  <div className="kpi-label">Knows the offer</div>
                  <div className="kpi-value" style={{ fontSize: 18 }}>Workflow agents</div>
                  <div className="kpi-foot">business summary loaded</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Uses</div>
                  <div className="kpi-value" style={{ fontSize: 18 }}>Business context + ICP</div>
                  <div className="kpi-foot">set during onboarding</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Shows</div>
                  <div className="kpi-value" style={{ fontSize: 18 }}>Example rows</div>
                  <div className="kpi-foot">ready for review</div>
                </div>
              </div>

              <div className="agent-do-list compact">
                <div><Icon name="check" />Shows how business context + ICP become a review-ready sheet.</div>
                <div><Icon name="check" />Keeps the demo focused on the output: who matched, why, source notes, and next step.</div>
                <div><Icon name="check" />Returns match notes, source notes, contact routes, and a next-step angle for review.</div>
                <div><Icon name="x" />Does not send outreach from this preview.</div>
              </div>

              <div className="scheduled-criteria-mini">
                <b>Business context + ICP loaded:</b> service businesses with follow-up-heavy workflows.
              </div>
            </div>
          </div>
        </div>

        <AgentChatPanel compact agentStatus={agentStatus} providers={providers} runs={runs} leads={leads} runCriteria={runCriteria} onRunNow={onRunNow} runBusy={runBusy} />
      </div>
    </div>
  );
};

const AgentHealth = ({ providers, runs, agentStatus }) => {
  const scheduler = agentStatus?.scheduler || {};
  const blocked = providers.filter(p => p.status === "blocked").length;
  const degraded = providers.filter(p => p.status === "degraded").length;
  const overall = blocked > 0 ? "blocked" : degraded > 0 ? "partial" : "ready";
  const latest = runs[0] || null;
  const sources = latest?.sourcesUsed?.length ? latest.sourcesUsed : [];
  const blocks = latest?.providerFailuresBlocks?.length ? latest.providerFailuresBlocks : [];
  const skipReasons = latest?.mainSkipReasons?.length ? latest.mainSkipReasons : [];
  const scheduledRuns = runs.filter((run) => run.action === "Scheduled heartbeat").length;

  const overallLabel = { ready: "ready", partial: "partially ready", blocked: "blocked" };
  const overallColor = { ready: "var(--ok)", partial: "var(--warn)", blocked: "var(--err)" };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Run Proof</h1>
          <div className="page-sub">Useful proof: what changed, what checks ran, and what the last run returned.</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => window.location.reload()}><Icon name="refresh" />Refresh</button>
        </div>
      </div>

      <div className="cards" style={{ gridTemplateColumns: "1fr", maxWidth: 1280 }}>
        <div className="card">
          <div className="card-head" style={{ alignItems: "center" }}>
            <div className="icon" style={{ background: overall === "ready" ? "var(--ok-soft)" : "var(--warn-soft)", color: overall === "ready" ? "oklch(0.32 0.10 155)" : "oklch(0.42 0.13 65)" }}>
              <Icon name="activity" />
            </div>
            <div style={{ flex: 1 }}>
              <h3 className="card-title">Agent is {overallLabel[overall]}</h3>
              <div className="card-sub">
                Scheduler {scheduler.enabled ? "on" : "off"}. Providers {providers.filter(p => p.status === "ok").length}/{providers.length} configured. {scheduler.lastError ? `Last scheduler error: ${scheduler.lastError}` : "No scheduler error."}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: "var(--mono)", fontSize: 12, color: "var(--fg-3)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 50, background: overallColor[overall] }} />
              Live status
            </div>
          </div>

          <div className="card-body" style={{ paddingBottom: 14 }}>
            <div className="kpi-row">
              <div className="kpi">
                <div className="kpi-label">Scheduler</div>
                <div className="kpi-value">{scheduler.enabled ? "On" : "Off"}</div>
                <div className="kpi-foot">{fmtAgentInterval(scheduler.intervalMinutes)}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Next run</div>
                <div className="kpi-value" style={{ fontSize: 18 }}>{fmtAgentDateTime(scheduler.nextRunAt)}</div>
                <div className="kpi-foot">background agent</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Recent scheduled runs</div>
                <div className="kpi-value">{scheduledRuns}</div>
                <div className="kpi-foot">visible in run history</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Overlap skips</div>
                <div className="kpi-value">{scheduler.overlapSkips || 0}</div>
                <div className="kpi-foot">manual/scheduled collisions</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Current run</div>
                <div className="kpi-value">{agentStatus?.currentRunId ? "Running" : "Idle"}</div>
                <div className="kpi-foot">{agentStatus?.currentRunId || "no active run"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="icon"><Icon name="history" /></div>
            <div>
              <h3 className="card-title">Latest run summary</h3>
              <div className="card-sub">Whether the last run actually added usable people rows, not just whether infrastructure was green.</div>
            </div>
          </div>
          <div className="card-body" style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.6 }}>
            {latest ? (
              <>
                <div><b>Run:</b> {latest.action} · {latest.time} · {latest.target}</div>
                <div><b>Companies/people:</b> {latest.rawCompaniesFound} raw companies · {latest.companiesExcluded} excluded · {latest.peopleFound} people found</div>
                <div><b>Rows written:</b> {latest.finishedEnrichedLeadsAdded} finished · {latest.incompleteAccountsSaved} incomplete · {latest.duplicatesMerged} duplicates merged</div>
                <div><b>Contact coverage:</b> email {latest.emailCoverage} · phone {latest.phoneCoverage} · LinkedIn {latest.linkedInCoverage} · Facebook {latest.facebookCoverage} · Instagram/social {latest.instagramOrOtherSocialCoverage}</div>
                <div><b>Quality gates:</b> bad-source rows {latest.badSourceCount} · duplicate IDs {latest.duplicateIdCount} · shortfall {latest.shortfall || "—"}</div>
                <div><b>Sources used:</b> {sources.length ? sources.join("; ") : "None recorded"}</div>
                <div><b>Blocked/unavailable:</b> {blocks.length ? blocks.join("; ") : "None"}</div>
                <div><b>Skip reasons:</b> {skipReasons.length ? skipReasons.join("; ") : "None recorded"}</div>
              </>
            ) : (
              <div>No saved runs yet. Run the agent or wait for the scheduler to populate this summary.</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="icon"><Icon name="db" /></div>
            <div>
              <h3 className="card-title">Source checks</h3>
              <div className="card-sub">Which checks are available for the demo and what each one contributes.</div>
            </div>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 10 }}>
            {providers.map((p) => (
              <div key={p.name} className="toggle-row" style={{ alignItems: "flex-start" }}>
                <div className="toggle-row-info">
                  <div className="toggle-row-label">{p.name}</div>
                  <div className="toggle-row-desc">{p.category}</div>
                </div>
                <span className={"status-pill " + p.status}>
                  <span className="d" />
                  {p.status === "ok" ? "Configured" : p.status === "degraded" ? "Needs review" : "Blocked"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="icon"><Icon name="history" /></div>
            <div>
              <h3 className="card-title">Recent runs</h3>
              <div className="card-sub">Manual previews and scheduled agent runs in one place.</div>
            </div>
          </div>
          <div>
            {runs.map((r, i) => (
              <div key={i} className="run-row">
                <span className="ts">{r.time}</span>
                <span><b style={{ fontWeight: 500 }}>{r.action}</b> <span style={{ color: "var(--fg-3)" }}>—</span> <span className="target">{r.target}</span></span>
                <span className="count">{r.count}</span>
                <span className="ts" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={"status-pill " + (r.status === "ok" ? "ok" : "degraded")} style={{ fontSize: 10, padding: "1px 6px" }}>
                    <span className="d" />
                    {r.duration}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

window.AgentSettings = AgentSettings;
window.AgentChatPage = AgentChatPage;
window.AgentHealth = AgentHealth;
