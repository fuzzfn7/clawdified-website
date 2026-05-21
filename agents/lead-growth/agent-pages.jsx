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
  if (!providers.length) return "I do not have provider status loaded yet.";
  const rows = providers.map((provider) => `${provider.name}: ${provider.configured ? "configured" : "missing"}${provider.required ? "" : " optional"}`);
  return rows.join("; ");
}

function latestRunSummaryForChat(latest) {
  if (!latest) return "I do not see a saved run yet.";
  const finished = Number(latest.finishedEnrichedLeadsAdded || 0);
  const incomplete = Number(latest.incompleteAccountsSaved || 0);
  const companies = Number(latest.rawCompaniesFound || 0);
  const people = Number(latest.peopleFound || 0);
  const shortfall = latest.shortfall || latest.fulfillmentStatus || "no shortfall label recorded";
  return `${latest.action || latest.trigger || "Last run"}: ${finished} finished, ${incomplete} incomplete, ${companies} companies checked, ${people} people found. Shortfall/status: ${shortfall}.`;
}

function buildAgentChatAnswer(question, context = {}) {
  const q = normalizeAgentQuestion(question);
  const scheduler = context.agentStatus?.scheduler || {};
  const criteria = scheduler.criteria || context.runCriteria || {};
  const providers = agentProviderRows(context.agentStatus, context.providers);
  const requiredMissing = providers.filter((provider) => provider.required && !provider.configured);
  const latest = context.runs?.[0] || null;
  const totals = countRealLeads(context.leads);
  const scheduleLine = scheduler.enabled
    ? `${fmtAgentInterval(scheduler.intervalMinutes)}, next run ${fmtAgentDateTime(scheduler.nextRunAt)}`
    : "the background schedule is off, so it should only run when you manually confirm it";
  const providerLine = requiredMissing.length
    ? `The thing I would check first is provider setup: ${requiredMissing.map((p) => p.name).join(", ")} ${requiredMissing.length === 1 ? "is" : "are"} missing.`
    : "The required public-first path looks available from the status I can see.";

  if (!q) {
    return "Ask me like you would ask a normal operator. I can explain Clawdified, the lead rules, the provider flow, or what the current sheet/run status means.";
  }

  if (/^(hi|hey|hello|yo|sup|good morning|good afternoon|good evening)\b/.test(q)) {
    return "Hey — I’m here. Ask me anything about Clawdified, the lead agent, the current sheet, or how the system works.";
  }

  if (agentQuestionHas(q, [/\bwhat do you do\b/, /\bwho are you\b/, /\bwhat are you\b/, /\byour job\b/, /\byour purpose\b/])) {
    return "I help keep Clawdified’s lead sheet honest. I look for companies that likely have repetitive admin or follow-up work, pick one real decision-maker per company, find direct contact paths with evidence, and keep weak rows labeled instead of pretending they are finished leads. I can explain the workflow from here, but I do not send outreach on my own.";
  }

  if (agentQuestionHas(q, [/clawdified/, /about (the )?(brand|company|business)/, /what do you know about/])) {
    return "Clawdified sells practical AI agents for repetitive employee workflows — things like follow-up, intake, admin coordination, and review or lead-management busywork. The normal entry point is around $600/month for one useful agent, then pricing scales when the workflow needs more integrations or has bigger business impact. This demo is the prospecting system that helps find companies likely to feel that pain and afford that kind of fix.";
  }

  if (agentQuestionHas(q, [/good lead/, /qualified lead/, /identify.*lead/, /qualif/, /criteria/, /fit score/, /good prospect/, /what makes.*lead/, /how.*lead/])) {
    return "A good Clawdified lead is not just a random business with an email. I’m looking for a company around the $1M-$10M range, usually 5-100 employees, with signs of repetitive operational work — service calls, admin follow-up, scheduling, customer intake, estimates, review requests, or back-office handoffs. Then I need one high-standing person, like an owner, founder, CEO, president, VP, director, operations lead, general manager, or office/admin manager. To count it as finished, the row needs direct email, direct or mobile phone, source evidence, attempted social/profile searches, and a clear reason Clawdified can help.";
  }

  if (agentQuestionHas(q, [/how.*(system|it|agent).*work/, /workflow/, /process/, /pipeline/, /how.*find/, /how.*search/])) {
    return `The system works public-first. It searches for target companies, checks whether they look like a real Clawdified prospect, finds one strong person at that company, then searches public contact/profile paths before using paid fallback data. Serper handles search/source discovery, BrowserBase checks public website pages, Hunter can add email confidence, and Apollo is only a last fallback for missing direct email or phone. Right now I see ${totals.total} sheet row(s): ${totals.finished} finished and ${totals.incomplete} still incomplete.`;
  }

  if (agentQuestionHas(q, [/provider/, /serper/, /browserbase/, /apollo/, /hunter/, /api key/, /configured/, /missing key/])) {
    return `Provider path: Serper first, BrowserBase second, Hunter optional, Apollo last-resort fallback. ${providerLine}

Current status: ${agentProviderSummary(providers)}`;
  }

  if (agentQuestionHas(q, [/schedule/, /cadence/, /next run/, /automatic/, /autonomous/, /heartbeat/])) {
    const target = criteria.targetWeeklyVolume || context.runCriteria?.targetWeeklyVolume || "not set";
    const geography = criteria.geographySegment || context.runCriteria?.geographySegment || "Broad U.S.";
    const query = compactText(criteria.searchQuery || context.runCriteria?.searchQuery, 160);
    return `Schedule-wise, ${scheduleLine}. The visible run target is ${target} finished row(s), geography is ${geography}, and the query is: ${query}. Manual runs still go through the Run agent button so paid providers do not fire silently from chat.`;
  }

  if (agentQuestionHas(q, [/latest/, /last run/, /recent run/, /history/, /result/, /status/, /blocked/, /stuck/, /shortfall/, /why.*zero/, /why.*missing/, /quality/])) {
    return `${latestRunSummaryForChat(latest)}

Current sheet: ${totals.total} total row(s), ${totals.finished} finished, ${totals.incomplete} incomplete, ${totals.directEmails} with direct email, ${totals.directPhones} with direct/mobile phone. The usual reason rows stay incomplete is simple: the agent found a person/company, but not the required direct email + direct/mobile phone package with evidence yet.`;
  }

  if (agentQuestionHas(q, [/\b(run|start|launch)\b.*\b(agent|search|lead|job)\b/, /\bkick off\b/, /^run\b/, /^start\b/, /^launch\b/])) {
    return "I can talk through the run, but I will not start provider work from chat. Use the Run agent button so the app can show the confirmation and avoid surprise Serper, BrowserBase, Apollo, or Hunter spend.";
  }

  if (agentQuestionHas(q, [/outreach/, /send/, /email/, /dm/, /sms/, /call/, /message/, /linkedin message/, /facebook message/])) {
    return "This agent is research-only. It can show contact routes and explain what it found, but it does not send Gmail, LinkedIn, Facebook, Instagram, SMS, calls, or any other outreach from here.";
  }

  return "I can work with that, but I need to anchor the answer to this demo: Clawdified, the lead-generation workflow, provider status, run status, or the rules for what counts as a real lead. Ask it naturally — for example, “what do you know about Clawdified?”, “how does the system work?”, or “how do you decide if a lead is good?”";
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
      text: "Hey — I’m here. Ask me normally about Clawdified, how this lead agent works, what makes a good lead, or what’s happening in the current run.",
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
      { id: thinkingId, role: "agent", label: "Clawdified agent", text: "Thinking…", pending: true },
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
          <div className="agent-chat-kicker"><span className="pulse" /> Agent chat</div>
          <h3>{compact ? "Ask the lead agent" : "Talk to the Clawdified agent"}</h3>
          <p>{compact ? "Normal Q&A about the agent and current state." : "Ask in plain English. I’ll answer from the Clawdified spec, the workflow rules, and the live app state — without sending outreach or starting provider spend from chat."}</p>
        </div>
        <div className="agent-chat-status-stack">
          <span className={"status-pill " + (agentStatus?.currentRunId ? "degraded" : agentStatus?.scheduler?.enabled ? "ok" : "blocked")}><span className="d" />{agentStatusLabel(agentStatus)}</span>
          <span className="agent-chat-mini-stat">providers {requiredReady}/{requiredTotal || providerRows.length || 0}</span>
          <span className="agent-chat-mini-stat">rows {totals.total}</span>
        </div>
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
          placeholder="Ask naturally — e.g. what makes a good Clawdified lead?"
          disabled={isThinking}
        />
        <div className="agent-chat-composer-actions">
          {onRunNow && (
            <button type="button" className="btn" onClick={() => onRunNow({ mode: "live" })} disabled={runBusy || isThinking} title="Starts the normal confirmed Run Agent flow.">
              <Icon name="refresh" />{runBusy ? "Running…" : "Run agent"}
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={isThinking || !draft.trim()}><Icon name="sparkle" />{isThinking ? "Thinking…" : "Send"}</button>
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
  const schedulerLeadTarget = 20;
  const schedulerStatusText = schedulerUiEnabled ? "Autonomous Scheduler enabled" : "Autonomous Scheduler disabled";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Agent</h1>
          <div className="page-sub">Schedule, manual-run criteria, provider order, and a compact agent chat panel.</div>
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
                  <div className="kpi-label">Lead target</div>
                  <div className="kpi-value">{schedulerLeadTarget}</div>
                  <div className="kpi-foot">finished leads</div>
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
                <h3 className="card-title">Public demo intake, provider order, and guardrails</h3>
                <div className="card-sub">Same actual agent control area, with public-safe website/ICP/geography inputs.</div>
              </div>
            </div>
            <div className="card-body automation-control-body">
              <div className="manual-control-grid">
                <div className="input-row" style={{ margin: 0 }}>
                  <div className="input-label">Business website</div>
                  <div className="input-desc">Used by the public-safe demo wrapper before rows populate.</div>
                  <input type="url" placeholder="https://yourcompany.com" value={runCriteria.website || ""} onChange={(event) => onRunCriteriaChange?.("website", event.target.value)} />
                </div>
                <div className="input-row" style={{ margin: 0 }}>
                  <div className="input-label">Ideal customer / ICP</div>
                  <div className="input-desc">Who should the agent score against?</div>
                  <input type="text" placeholder="Owner-led service businesses needing follow-up" value={runCriteria.icp || runCriteria.searchQuery || ""} onChange={(event) => onRunCriteriaChange?.("icp", event.target.value)} />
                </div>
                <div className="input-row" style={{ margin: 0 }}>
                  <div className="input-label">Search area</div>
                  <div className="input-desc">City, region, or service area.</div>
                  <input type="text" placeholder="Knoxville, TN" value={runCriteria.geography || runCriteria.geographySegment || ""} onChange={(event) => onRunCriteriaChange?.("geography", event.target.value)} />
                </div>
              </div>

              <div className="automation-provider-strip">
                {providerRows.map((provider, index) => (
                  <div key={provider.name} className="provider-mini-card">
                    <span>{index + 1}</span>
                    <div>
                      <b>{provider.name}{provider.required ? "" : " fallback"}</b>
                      <small>{provider.configured ? "Configured" : "Missing"}</small>
                    </div>
                  </div>
                ))}
              </div>

              <div className="agent-do-list compact">
                <div><Icon name="check" />Find target companies and one high-standing person per company.</div>
                <div><Icon name="check" />Write people-level rows only with evidence and missing-field labels.</div>
                <div><Icon name="x" />No outreach, private sources, or invented contact data.</div>
              </div>

              {criteria.searchQuery && (
                <div className="scheduled-criteria-mini">
                  <b>Scheduled criteria snapshot:</b> {criteria.geographySegment || "Broad U.S."} · target {criteria.targetWeeklyVolume || "—"} · {compactText(criteria.searchQuery, 130)}
                </div>
              )}
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
                  {p.status === "ok" ? "Configured" : p.status === "degraded" ? "Fallback/missing" : "Blocked"}
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
              <div className="card-sub">Manual demo runs and scheduled autonomous runs in one place.</div>
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
