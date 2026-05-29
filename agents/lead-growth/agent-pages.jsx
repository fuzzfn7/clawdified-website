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
    : "The lead agent stack is showing ready: discovery, source review, contact enrichment, and sheet scoring are all available in this demo state.";

  if (!q) {
    return "Ask me like you would ask a normal operator. I can explain Clawdified, the lead rules, the provider flow, or what the current sheet/run status means.";
  }

  if (/^(hi|hey|hello|yo|sup|good morning|good afternoon|good evening)\b/.test(q)) {
    return "Hey — I’m here. Ask me anything about Clawdified, the lead agent, the current sheet, or how the system works.";
  }

  if (agentQuestionHas(q, [/\bwhat do you do\b/, /\bwho are you\b/, /\bwhat are you\b/, /\byour job\b/, /\byour purpose\b/])) {
    return "I help show what a lead sheet looks like after a private run. I load sample accounts, attach contact routes and source notes, and keep review labels visible instead of pretending every row is finished. I can explain the demo workflow, but I do not send outreach on my own.";
  }

  if (agentQuestionHas(q, [/clawdified/, /about (the )?(brand|company|business)/, /what do you know about/])) {
    return "Clawdified builds practical AI workflow agents for small businesses. This public demo shows the lead-sheet experience at a high level while keeping private qualification logic and commercial details off the public site.";
  }

  if (agentQuestionHas(q, [/good lead/, /qualified lead/, /identify.*lead/, /qualif/, /criteria/, /fit score/, /good prospect/, /what makes.*lead/, /how.*lead/])) {
    return "The private scoring recipe is not shown in the public demo. At a high level, the agent looks for accounts where a workflow agent could be relevant, checks source evidence, attaches contact routes, and labels rows for human review instead of exposing the full qualification playbook.";
  }

  if (agentQuestionHas(q, [/how.*(system|it|agent).*work/, /workflow/, /process/, /pipeline/, /how.*find/, /how.*search/])) {
    return `The system starts from a private Clawdified profile, checks source evidence, attaches contact routes, and writes review-ready rows to the sheet. The public demo keeps qualification details redacted, and outreach stays review-only. Right now I see ${totals.total} sheet row(s): ${totals.finished} finished and ${totals.incomplete} still incomplete.`;
  }

  if (agentQuestionHas(q, [/provider/, /data source/, /connection/, /api key/, /configured/, /missing key/])) {
    return `Provider readiness: ${providerLine}

Current status: ${agentProviderSummary(providers)}`;
  }

  if (agentQuestionHas(q, [/schedule/, /cadence/, /next run/, /automatic/, /autonomous/, /heartbeat/])) {
    return `Schedule-wise, ${scheduleLine}. The public demo keeps run targets, markets, and search details redacted. Manual runs still go through the Run agent button so nothing fires silently from chat.`;
  }

  if (agentQuestionHas(q, [/latest/, /last run/, /recent run/, /history/, /result/, /status/, /blocked/, /stuck/, /shortfall/, /why.*zero/, /why.*missing/, /quality/])) {
    return `${latestRunSummaryForChat(latest)}

Current sheet: ${totals.total} total row(s), ${totals.finished} finished, ${totals.incomplete} incomplete, ${totals.directEmails} with direct email, ${totals.directPhones} with direct/mobile phone. The usual reason rows stay incomplete is simple: the agent found a person/company, but not the required direct email + direct/mobile phone package with evidence yet.`;
  }

  if (agentQuestionHas(q, [/\b(run|start|launch)\b.*\b(agent|search|lead|job)\b/, /\bkick off\b/, /^run\b/, /^start\b/, /^launch\b/])) {
    return "I can talk through the run, but I will not start work from chat. Use the Run agent button so the app can show the visible run state and populate the sheet intentionally.";
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
          <p>{compact ? "Normal Q&A about the agent and current state." : "Ask in plain English. I’ll answer from the public demo state, current sheet, and run health — without exposing private qualification rules or sending outreach from chat."}</p>
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
          placeholder="Ask naturally — e.g. how does this demo work?"
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
  const schedulerLeadTarget = "Sample";
  const schedulerStatusText = schedulerUiEnabled ? "Autonomous Scheduler enabled" : "Autonomous Scheduler disabled";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Agent</h1>
          <div className="page-sub">Schedule, public demo state, provider readiness, and a compact agent chat panel.</div>
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
                <h3 className="card-title">Clawdified lead agent demo state</h3>
                <div className="card-sub">This demo is preconfigured with private rules redacted. It shows what the finished workspace feels like — not a public intake form or playbook leak.</div>
              </div>
            </div>
            <div className="card-body automation-control-body">
              <div className="kpi-row automation-kpis">
                <div className="kpi">
                  <div className="kpi-label">Knows the offer</div>
                  <div className="kpi-value" style={{ fontSize: 18 }}>Workflow agents</div>
                  <div className="kpi-foot">public-safe summary only</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Uses</div>
                  <div className="kpi-value" style={{ fontSize: 18 }}>Private rules</div>
                  <div className="kpi-foot">redacted from public demo</div>
                </div>
                <div className="kpi">
                  <div className="kpi-label">Shows</div>
                  <div className="kpi-value" style={{ fontSize: 18 }}>Sample rows</div>
                  <div className="kpi-foot">safe example data</div>
                </div>
              </div>

              <div className="agent-do-list compact">
                <div><Icon name="check" />Shows how a private lead run can become a review-ready sheet without publishing the scoring recipe.</div>
                <div><Icon name="check" />Keeps the public demo focused on the workflow output, not exact target titles or thresholds.</div>
                <div><Icon name="check" />Returns sample fit labels, source notes, contact routes, and a safe next-step angle for review.</div>
                <div><Icon name="x" />Does not ask visitors for their website or expose an internal provider route list in the public demo.</div>
              </div>

              <div className="scheduled-criteria-mini">
                <b>Private demo profile loaded:</b> qualification details are redacted on the public site.
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
