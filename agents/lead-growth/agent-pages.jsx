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
  return `${ready}/${providers.length} checks look ready. In this public demo, the details stay high-level so the private lead recipe is not published.`;
}

function latestRunSummaryForChat(latest) {
  if (!latest) return "I don’t see a run yet, so I’m judging from the loaded demo profile rather than a finished sheet.";
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
      weighing: ["Which rows look worth human review", "Why a workflow agent might matter", "What is still unverified or intentionally private"],
      next: "Try: “what are you seeing?”, “why is the top lead a fit?”, or “what would you do next?”",
    });
  }

  if (/^(hi|hey|hello|yo|sup|good morning|good afternoon|good evening)\b/.test(q)) {
    return thinkingAnswer({
      read: "Hey — I’m here. I’m watching the lead sheet, not just repeating a command list.",
      weighing: [topLeadLine, `${totals.total} visible row(s), ${totals.finished} finished, ${totals.incomplete} still needing review`],
      next: "Ask me what I’m seeing, why a row matters, or what I’d check before outreach.",
    });
  }

  if (agentQuestionHas(q, [/\bwhat do you do\b/, /\bwho are you\b/, /\bwhat are you\b/, /\byour job\b/, /\byour purpose\b/])) {
    return thinkingAnswer({
      read: "I’m the lead-review layer for this demo. I look at a loaded fit profile, turn likely accounts into a reviewable sheet, and explain why a row might deserve attention.",
      weighing: ["Is there an obvious workflow pain?", "Is there enough source/contact context to review?", "Is the row ready for a human decision or still incomplete?"],
      next: "Use me to understand the sheet before anyone takes action.",
      guardrail: "I don’t send outreach or reveal the private scoring recipe from the public demo.",
    });
  }

  if (agentQuestionHas(q, [/clawdified/, /about (the )?(brand|company|business)/, /what do you know about/])) {
    return thinkingAnswer({
      read: "Clawdified builds practical AI agents for repetitive business work — the stuff that usually lives in inboxes, follow-up notes, spreadsheets, calendars, and handoffs.",
      weighing: ["The buyer needs a workflow painful enough to justify an agent", "The agent should create a concrete output or approval queue, not just chat", "The public page should show the result without exposing the sales playbook"],
      next: "For this demo, I’m showing what a lead sheet can look like after that kind of private setup has already happened.",
    });
  }

  if (agentQuestionHas(q, [/good lead/, /qualified lead/, /identify.*lead/, /qualif/, /criteria/, /fit score/, /good prospect/, /what makes.*lead/, /how.*lead/])) {
    return thinkingAnswer({
      read: topLeadLine,
      weighing: [
        topPain?.headline ? `Likely workflow pain: ${topPain.headline}` : "I’m looking for repeatable follow-up, admin, scheduling, intake, or status-update pain.",
        `${totals.directEmails} row(s) have email and ${totals.directPhones} have direct/mobile phone in this demo state.`,
        "I want enough evidence for a human to review without pretending the row is automatically closed-won.",
      ],
      next: topPain?.next || "Open the best row, check the source/contact notes, then decide whether the angle is worth a real conversation.",
      guardrail: "The exact qualification thresholds stay private on the public site.",
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
      weighing: [agentProviderSummary(providers), "The public demo keeps source/provider details generic so the private stack and targeting recipe are not exposed."],
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
    read: "I can answer that better if we anchor it to the lead sheet or the Clawdified workflow.",
    weighing: [topLeadLine, "I can explain fit, source/contact confidence, current run state, or what to check next."],
    next: "Try asking: “what are you seeing?”, “why is this a fit?”, “how does this work?”, or “what would you do before outreach?”",
  });
}

function agentAnswerText(answer) {
  return typeof answer === "string" ? answer : String(answer?.text || "");
}

async function requestAgentChatAnswer(question, context) {
  try {
    const res = await fetch("/api/agent/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
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
    const answer = await requestAgentChatAnswer(text, context);
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
          <p>{compact ? "Plain-English read on rows, fit, and next checks." : "Ask in plain English. I’ll reason from the visible sheet, run health, and Clawdified context — without exposing private qualification rules or sending outreach from chat."}</p>
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
                  <div className="kpi-label">Demo output</div>
                  <div className="kpi-value">{schedulerLeadTarget}</div>
                  <div className="kpi-foot">public sample rows</div>
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
                <div className="card-sub">This shows what the finished workspace feels like: fit notes, source notes, contact routes, and next-step angles in one sheet.</div>
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
                  <div className="kpi-value" style={{ fontSize: 18 }}>Fit rules</div>
                  <div className="kpi-foot">set during onboarding</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Shows</div>
                  <div className="kpi-value" style={{ fontSize: 18 }}>Example rows</div>
                  <div className="kpi-foot">ready for review</div>
                </div>
              </div>

              <div className="agent-do-list compact">
                <div><Icon name="check" />Shows how a private lead run can become a review-ready sheet without publishing the scoring recipe.</div>
                <div><Icon name="check" />Keeps the public demo focused on the workflow output, not exact target titles or thresholds.</div>
                <div><Icon name="check" />Returns sample fit labels, source notes, contact routes, and a safe next-step angle for review.</div>
                <div><Icon name="x" />Does not send outreach from this preview.</div>
              </div>

              <div className="scheduled-criteria-mini">
                <b>Fit profile loaded:</b> service businesses with follow-up-heavy workflows.
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
          <h1 className="page-title">Run Health</h1>
          <div className="page-sub">Useful proof: is it scheduled, are providers wired, what happened on the last run?</div>
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
              <h3 className="card-title">Provider readiness</h3>
              <div className="card-sub">No fake latency/quota fields — just what each provider contributes and whether it is wired.</div>
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
              <div className="card-sub">Manual showroom runs and scheduled agent runs in one place.</div>
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
