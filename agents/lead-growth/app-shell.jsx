/* eslint-disable */
const { useState, useMemo, useEffect } = React;

function companyInitials(name) {
  return String(name || "CL")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CL";
}

function outreachWasSent(lead, channel) {
  const raw = lead?.raw || {};
  const cap = channel.charAt(0).toUpperCase() + channel.slice(1);
  const explicit = raw[`${channel}OutreachAt`] || raw[`${channel}ReachedAt`] || raw[`outreach${cap}At`] || raw[`last${cap}OutreachAt`];
  if (explicit) return true;
  const aliases = channel === "email" ? ["email", "gmail"] : [channel];
  const history = [raw.outreachHistory, raw.outreachLog, raw.outreachChannels, raw.outreachPlatforms, raw.outreachTouches]
    .flatMap((entry) => Array.isArray(entry) ? entry : entry ? [entry] : []);
  return history.some((entry) => {
    const text = (typeof entry === "string"
      ? entry
      : [entry.platform, entry.channel, entry.method, entry.status, entry.sentAt, entry.reachedAt, entry.note].filter(Boolean).join(" ")).toLowerCase();
    return aliases.some((alias) => text.includes(alias)) && /sent|reached|contacted|complete|interacted|drafted/.test(text);
  });
}

function outreachPlatformsForLead(lead) {
  const definitions = [
    { id: "linkedin", label: "LinkedIn", value: lead.linkedin, icon: "link" },
    { id: "facebook", label: "Facebook", value: lead.facebook, icon: "link" },
    { id: "email", label: "Gmail", value: lead.email, icon: "mail" },
    { id: "instagram", label: "Instagram", value: lead.instagramOrOtherSocial, icon: "link" },
    { id: "phone", label: "Phone", value: lead.directPhone || lead.companyPhone, icon: "phone" },
  ];
  return definitions.map((platform) => {
    const sent = outreachWasSent(lead, platform.id);
    const ready = Boolean(platform.value);
    return {
      ...platform,
      status: sent ? "sent" : ready ? "ready" : "missing",
      labelSuffix: sent ? "interacted" : ready ? "ready" : "missing",
    };
  });
}

function outreachContactRows(leads, searchQuery = "") {
  const query = String(searchQuery || "").trim().toLowerCase();
  return [...(leads || [])]
    .filter((lead) => lead && lead.id !== "empty" && (lead.contactName || lead.company))
    .filter((lead) => {
      if (!query) return true;
      const platforms = outreachPlatformsForLead(lead).map((platform) => `${platform.label} ${platform.status}`).join(" ");
      return [lead.contactName, lead.company, lead.title, lead.industry, lead.email, lead.linkedin, lead.facebook, lead.instagramOrOtherSocial, platforms]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => Number(b.fitScore || 0) - Number(a.fitScore || 0));
}

function outreachSummaryForLead(lead) {
  const platforms = outreachPlatformsForLead(lead);
  const interacted = platforms.filter((platform) => platform.status === "sent");
  const ready = platforms.filter((platform) => platform.status === "ready");
  if (interacted.length) return `${interacted.length} interacted · ${ready.length} ready`;
  if (ready.length) return `${ready.length} platforms ready`;
  return "Needs contact routes";
}

function firstNameFromLead(lead) {
  return String(lead?.contactName || "there").trim().split(/\s+/)[0] || "there";
}

function compactRouteValue(value) {
  const text = String(value || "").trim();
  return text.length > 82 ? `${text.slice(0, 79)}…` : text;
}

function outreachRouteMessagesForLead(lead, platform) {
  const firstName = firstNameFromLead(lead);
  const contactName = lead?.contactName || "the contact";
  const company = lead?.company || "the company";
  const title = lead?.title || "operator";
  const route = platform?.label || "Route";
  const routeValue = platform?.value || "No route found yet";
  const angle = lead?.raw?.suggestedFirstCallAngle || lead?.raw?.reasonToContact || lead?.notes || lead?.bestPath || "repetitive admin follow-up";
  const pain = lead?.raw?.workflowPainClues || lead?.notes || angle;

  if (!platform || platform.status === "missing") {
    return [
      {
        role: "agent",
        name: "Clawdified agent",
        meta: `${route} · route unavailable`,
        text: `I found ${contactName} at ${company}, but ${route} is still missing. I would keep researching before sending anything here.`,
      },
      {
        role: "lead",
        name: "Environment",
        meta: "Simulated response",
        text: `No ${route} response yet — the route is not verified, so this stays in research instead of pretending outreach happened.`,
      },
    ];
  }

  const copy = {
    linkedin: {
      agent: `Hi ${firstName} — I saw your role as ${title} at ${company}. We help teams cut down repetitive follow-up and admin work; ${pain}. Worth a quick look?`,
      lead: `Potentially. If it saves time without disrupting the team, send me the quick version here.`,
    },
    facebook: {
      agent: `Hi ${firstName}, reaching out from Clawdified. Noticed ${company} may have workflow-heavy customer/admin follow-up. We build small AI agents for tasks like ${angle}. Open to a short overview?`,
      lead: `Maybe — message me the details and I can tell you who should look at it.`,
    },
    email: {
      agent: `Subject: Quick idea for ${company}\n\nHi ${firstName}, I noticed ${company} has signs of repetitive operations work around ${pain}. Clawdified builds practical workflow agents for routine follow-up and admin tasks. Would it be useful if I sent a short example?`,
      lead: `Thanks — send the example. If it fits our workflow, we can set up a call.`,
    },
    instagram: {
      agent: `Hey ${firstName} — quick note from Clawdified. We help businesses like ${company} automate routine follow-up/admin work without a big software rollout. Want the short version?`,
      lead: `Sure, send it over. If it’s relevant I’ll point you to the right person.`,
    },
    phone: {
      agent: `Hi ${firstName}, this is Clawdified. I’m calling because ${company} looks like it has repeat admin/follow-up workflows we may be able to automate. I’ll keep this brief — is this something you handle?`,
      lead: `I can hear the pitch, but text or email me the summary first so I can review it.`,
    },
  }[platform.id] || {
    agent: `Hi ${firstName}, I found ${routeValue} as a possible route for ${company}. Clawdified can help with ${angle}. Is this the best place to send a short overview?`,
    lead: `Send the short version and I’ll review it when I can.`,
  };

  return [
    {
      role: "agent",
      name: "Clawdified agent",
      meta: `${route} · initial outreach`,
      text: copy.agent,
    },
    {
      role: "lead",
      name: firstName,
      meta: `${route} · simulated reply`,
      text: copy.lead,
    },
  ];
}

const firstUsablePlatformId = (lead) => {
  const platforms = lead ? outreachPlatformsForLead(lead) : [];
  return (platforms.find((platform) => platform.status !== "missing") || platforms[0] || {}).id || "";
};

const OutreachPage = ({ leads, selectedId, onSelect, searchQuery }) => {
  const rows = useMemo(() => outreachContactRows(leads, searchQuery), [leads, searchQuery]);
  const [activeId, setActiveId] = useState(selectedId || rows[0]?.id || "");
  const [detailOpen, setDetailOpen] = useState(false);
  const [activePlatformId, setActivePlatformId] = useState("");

  useEffect(() => {
    if (!rows.length) {
      setActiveId("");
      setActivePlatformId("");
      setDetailOpen(false);
      return;
    }
    if (!activeId || !rows.some((lead) => lead.id === activeId)) {
      const nextId = selectedId && rows.some((lead) => lead.id === selectedId) ? selectedId : rows[0].id;
      const nextLead = rows.find((lead) => lead.id === nextId) || rows[0];
      setActiveId(nextId);
      setActivePlatformId(firstUsablePlatformId(nextLead));
    }
  }, [rows, activeId, selectedId]);

  const activeLead = rows.find((lead) => lead.id === activeId) || rows[0] || null;
  const activePlatforms = activeLead ? outreachPlatformsForLead(activeLead) : [];
  const foundPlatforms = activePlatforms.filter((platform) => platform.status !== "missing");
  const missingPlatforms = activePlatforms.filter((platform) => platform.status === "missing");
  const displayPlatforms = foundPlatforms.length ? foundPlatforms : activePlatforms;
  const activePlatform = displayPlatforms.find((platform) => platform.id === activePlatformId) || displayPlatforms[0] || null;
  const activeRouteMessages = activeLead && activePlatform ? outreachRouteMessagesForLead(activeLead, activePlatform) : [];
  const touchedContacts = rows.filter((lead) => outreachPlatformsForLead(lead).some((platform) => platform.status === "sent")).length;
  const readyRoutes = rows.reduce((count, lead) => count + outreachPlatformsForLead(lead).filter((platform) => platform.status !== "missing").length, 0);
  const agentAngle = activeLead?.raw?.suggestedFirstCallAngle || activeLead?.raw?.reasonToContact || activeLead?.notes || "No outreach angle recorded yet.";
  const currentIndex = Math.max(0, rows.findIndex((lead) => lead.id === activeLead?.id));
  const displayPlatformIds = displayPlatforms.map((platform) => platform.id).join("|");

  useEffect(() => {
    if (!displayPlatforms.length) return;
    if (!displayPlatforms.some((platform) => platform.id === activePlatformId)) {
      setActivePlatformId(displayPlatforms[0].id);
    }
  }, [activeLead?.id, activePlatformId, displayPlatformIds]);

  function chooseLead(id, openDetail = true) {
    const nextLead = rows.find((lead) => lead.id === id);
    if (!nextLead) return;
    setActiveId(id);
    setActivePlatformId(firstUsablePlatformId(nextLead));
    if (openDetail) setDetailOpen(true);
  }

  function selectByOffset(offset) {
    if (!rows.length) return;
    const next = rows[(currentIndex + offset + rows.length) % rows.length];
    chooseLead(next.id, true);
  }

  if (detailOpen && activeLead) {
    return (
      <div className="page outreach-page outreach-detail-mode">
        <div className="outreach-detail-stage">
          <div className="outreach-detail-topbar">
            <button type="button" className="btn" onClick={() => setDetailOpen(false)}><span aria-hidden="true">←</span> Contact sheet</button>
            <div className="prospect-nav" aria-label="Switch prospect">
              <button type="button" className="icon-btn" onClick={() => selectByOffset(-1)} aria-label="Previous prospect"><Icon name="chevron" /></button>
              <span>Prospect {currentIndex + 1} of {rows.length}</span>
              <button type="button" className="icon-btn" onClick={() => selectByOffset(1)} aria-label="Next prospect"><Icon name="chevron" /></button>
            </div>
          </div>

          <section className="outreach-hero">
            <div className="outreach-hero-avatar">{companyInitials(activeLead.contactName)}</div>
            <div className="outreach-hero-copy">
              <div className="outreach-eyebrow"><span className="pulse" />Review-only outreach preview</div>
              <h1>{activeLead.contactName}</h1>
              <p>{activeLead.title} · {activeLead.company}</p>
              <div className="outreach-hero-tags">
                <span>{activeLead.industry || "Industry unknown"}</span>
                <span>{activeLead.hq || "Geography unknown"}</span>
                <span>{foundPlatforms.length} channel{foundPlatforms.length === 1 ? "" : "s"} found</span>
              </div>
            </div>
            <div className="outreach-hero-score">
              <b>{activeLead.fitScore || 0}</b>
              <span>fit score</span>
            </div>
          </section>

          <div className="outreach-detail-grid">
            <section className="outreach-channel-panel">
              <div className="panel-section-title">Channels found<span className="count">{foundPlatforms.length}</span></div>
              <div className="outreach-platform-grid detail">
                {displayPlatforms.map((platform) => (
                  <button type="button" key={platform.id} className={`outreach-platform-card ${platform.status}${activePlatform?.id === platform.id ? " active" : ""}`} aria-pressed={activePlatform?.id === platform.id} onClick={() => setActivePlatformId(platform.id)}>
                    <div className="outreach-platform-head"><Icon name={platform.icon} /><b>{platform.label}</b><span>{platform.labelSuffix}</span></div>
                    <div className="outreach-platform-value">{platform.value || "No route found"}</div>
                    <div className="outreach-platform-note">{platform.status === "sent" ? `Logged interaction exists for ${activeLead.contactName} on ${platform.label}.` : platform.status === "ready" ? `Click to preview the ${platform.label} opener for ${activeLead.contactName}.` : `Still researching ${platform.label}; no external send is simulated.`}</div>
                  </button>
                ))}
              </div>
              {missingPlatforms.length > 0 && foundPlatforms.length > 0 && (
                <div className="missing-channel-note">Still missing: {missingPlatforms.map((platform) => platform.label).join(", ")}</div>
              )}
              <div className="outreach-prospect-summary">
                <div><b>Agent angle</b><span>{agentAngle}</span></div>
                <div><b>Best route</b><span>{activeLead.bestPath || activePlatform?.value || "Review sources before outreach"}</span></div>
              </div>
            </section>

            <section className="outreach-message-panel">
              <div className="outreach-message-head">
                <div>
                  <span>Message demo</span>
                  <h2>{activePlatform ? `${activePlatform.label} preview` : "No channel selected"}</h2>
                </div>
                {activePlatform && <span className={`outreach-chat-status ${activePlatform.status}`}>{activePlatform.labelSuffix}</span>}
              </div>

              <div className="outreach-route-switcher" aria-label="Choose outreach route">
                {displayPlatforms.map((platform) => (
                  <button type="button" key={platform.id} className={`outreach-route-pill ${platform.status}${activePlatform?.id === platform.id ? " active" : ""}`} aria-pressed={activePlatform?.id === platform.id} onClick={() => setActivePlatformId(platform.id)}>
                    <Icon name={platform.icon} />
                    <span>{platform.label}</span>
                  </button>
                ))}
              </div>

              <div className="chat-phone-frame outreach-message-frame">
                <div className="chat-phone-bar">
                  <span>{activePlatform?.label || "Route"}</span>
                  <span>review-only simulation</span>
                </div>
                <div className="chat-thread">
                  {activeRouteMessages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={message.role === "agent" ? "chat-bubble agent" : "chat-bubble lead"}>
                      <b>{message.name}</b>
                      <small>{message.meta}</small>
                      <span>{message.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="outreach-safe-note"><Icon name="flag" />Preview only. This screen never sends Gmail, LinkedIn, Facebook, Instagram, phone, SMS, or any external message.</div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page outreach-page">
      <div className="page-header outreach-simple-header">
        <div>
          <h1 className="page-title">Lead Outreach
            <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--fg-3)", fontWeight: 400, background: "var(--surface-3)", padding: "3px 9px", borderRadius: 100, border: "1px solid var(--border)", whiteSpace: "nowrap" }}>{rows.length} contacts · {readyRoutes} channels</span>
          </h1>
          <div className="page-sub">Simple review flow: pick a contact from the sheet, then the prospect opens full-screen with found channels and a message demo.</div>
        </div>
        <div className="page-actions">
          <span className="status-pill blocked"><span className="d" />External sends locked</span>
        </div>
      </div>

      <div className="outreach-sheet-shell">
        <section className="outreach-list-card outreach-sheet-card">
          <div className="outreach-list-head">
            <div><b>Contact sheet</b><span>Click any row to open the full prospect review.</span></div>
            <span>{touchedContacts ? `${touchedContacts} with logged interaction` : "No sent history"}</span>
          </div>
          <div className="outreach-table-scroll">
            <table className="outreach-table">
              <thead><tr><th>Contact</th><th>Company</th><th>Channels found</th><th>Message angle</th><th>Fit</th><th></th></tr></thead>
              <tbody>
                {rows.length ? rows.map((lead) => {
                  const platforms = outreachPlatformsForLead(lead);
                  const found = platforms.filter((platform) => platform.status !== "missing");
                  const angle = lead.raw?.suggestedFirstCallAngle || lead.raw?.reasonToContact || lead.notes || "Review the source evidence before writing outreach.";
                  return (
                    <tr key={lead.id} className={activeLead?.id === lead.id ? "selected" : ""} onClick={() => chooseLead(lead.id, true)}>
                      <td>
                        <div className="outreach-contact-cell"><span className="outreach-person-avatar">{companyInitials(lead.contactName)}</span><span><b>{lead.contactName}</b><small>{lead.title || "Target contact"}</small></span></div>
                      </td>
                      <td><div className="outreach-company-cell"><b>{lead.company}</b><small>{lead.industry} · {lead.hq}</small></div></td>
                      <td><div className="outreach-platform-strip">{(found.length ? found : platforms.slice(0, 3)).map((platform) => <span key={platform.id} className={`outreach-tab ${platform.status}`}>{platform.label}</span>)}</div></td>
                      <td><span className="outreach-angle-cell">{compactRouteValue(angle)}</span></td>
                      <td><span className="cell-mono">{lead.fitScore}</span></td>
                      <td><button type="button" className="btn btn-ghost outreach-review-btn" onClick={(event) => { event.stopPropagation(); chooseLead(lead.id, true); }}>Review <Icon name="chevron" /></button></td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan="6"><div className="empty-state">No contacts match this search yet. Run/import leads first.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
const Rail = ({ page, setPage, leads = [] }) => {
  const leadCount = leads.length;
  const items = [
    { id: "sheet", icon: "sheet", label: "Lead Sheet", badge: leadCount },
    { id: "outreach", icon: "mail", label: "Lead Outreach", badge: leadCount },
    { id: "settings", icon: "settings", label: "Agent" },
    { id: "health", icon: "activity", label: "Run Health", health: "ok" },
  ];
  return (
    <aside className="rail">
      <div className="rail-brand">
        <div className="rail-brand-mark">C</div>
        <div>
          <div className="rail-brand-name">Clawdified</div>
          <div className="rail-brand-sub">Lead agent</div>
        </div>
      </div>

      <div className="rail-section">Workspace</div>
      {items.map(it => (
        <button key={it.id} className={"rail-item" + (page === it.id ? " active" : "")} onClick={() => setPage(it.id)}>
          <Icon name={it.icon} />
          <span>{it.label}</span>
          {it.badge != null && <span className="badge">{it.badge}</span>}
          {it.health && <span className="health-dot" />}
        </button>
      ))}

      <div className="rail-foot">
        <div className="rail-foot-avatar">WT</div>
        <div>
          <div className="rail-foot-name">Wesley</div>
          <div className="rail-foot-role">Owner</div>
        </div>
      </div>
    </aside>
  );
};
const Topbar = ({ page, onRunNow, runBusy, onClearDemo, clearBusy, showDemoClear, demoClearDisabledReason, onExport, agent, searchQuery, onSearchChange, liveRunDisabledReason }) => {
  const titles = {
    sheet: ["Agent", "Lead Sheet"],
    agent: ["Agent", "Chat"],
    outreach: ["Agent", "Lead Outreach"],
    settings: ["Agent", "Agent"],
    health: ["Agent", "Run Health"],
  };
  const [a, b] = titles[page] || titles.sheet;
  return (
    <div className="topbar">
      <div className="crumb">
        <span>{a}</span>
        <span className="crumb-sep">/</span>
        <b>{b}</b>
      </div>
      <div className="topbar-spacer" />
      <div className="agent-pill" title={liveRunDisabledReason || "Scheduler is separate; this button starts a manual live run."}>
        <span className="pulse" />
        {agent === "scheduled" ? "Scheduled" : `Agent ${agent}`}
      </div>
      <div className="topbar-search">
        <Icon name="search" />
        <input placeholder="Search sheet…" value={searchQuery || ""} onChange={(event) => onSearchChange?.(event.target.value)} />
        <kbd>⌘K</kbd>
      </div>
      <button className="btn" onClick={onExport}><Icon name="download" />Export CSV</button>
      {showDemoClear && (
        <button className="btn" onClick={onClearDemo} disabled={clearBusy || Boolean(demoClearDisabledReason)} title={demoClearDisabledReason || "Clears the saved demo rows so Run agent can replay them again."}><Icon name="db" />{clearBusy ? "Clearing…" : agent === "running" ? "Stop & clear demo" : "Clear demo"}</button>
      )}
      <button className="btn btn-primary" onClick={() => onRunNow({ mode: "live" })} disabled={runBusy || Boolean(liveRunDisabledReason)} title={liveRunDisabledReason || "Runs one manual agent sweep after confirmation."}><Icon name="refresh" />{runBusy ? "Running…" : "Run agent"}</button>
    </div>
  );
};

const StatStrip = ({ leads }) => {
  const total = leads.length;
  const hotFits = leads.filter(l => l.fitScore >= 80).length;
  const directEmails = leads.filter(l => l.email).length;
  const phones = leads.filter(l => l.directPhone || l.companyPhone).length;
  const avgFit = total ? Math.round(leads.reduce((s, l) => s + Number(l.fitScore || 0), 0) / total) : 0;
  return (
    <div className="stat-strip">
      <div className="stat-cell featured">
        <div className="stat-label">Sheet rows</div>
        <div className="stat-value">{total}<span className="stat-delta flat">leads</span></div>
        <div className="stat-icon"><Icon name="db" /></div>
      </div>
      <div className="stat-cell">
        <div className="stat-label">Hot fits</div>
        <div className="stat-value">{hotFits}<span className="stat-delta flat">≥80</span></div>
        <div className="stat-icon" style={{ background: "oklch(0.95 0.05 145)", color: "oklch(0.36 0.13 145)" }}><Icon name="target" /></div>
      </div>
      <div className="stat-cell">
        <div className="stat-label">Emails found</div>
        <div className="stat-value">{directEmails}<span className="stat-delta flat">found</span></div>
        <div className="stat-icon"><Icon name="mail" /></div>
      </div>
      <div className="stat-cell">
        <div className="stat-label">Phones found</div>
        <div className="stat-value">{phones}<span className="stat-delta flat">found</span></div>
        <div className="stat-icon"><Icon name="phone" /></div>
      </div>
      <div className="stat-cell">
        <div className="stat-label">Average fit</div>
        <div className="stat-value">{avgFit}<span style={{fontSize:13,color:"var(--fg-3)"}}>%</span></div>
        <div className="stat-icon"><Icon name="sparkle" /></div>
      </div>
    </div>
  );
};

/* ---------- Filter bar ---------- */
const FilterBar = ({ leads, filters, setFilters, sortKey, setSortKey }) => {
  const countBy = (fn) => {
    const m = new Map();
    leads.forEach((lead) => {
      const value = fn(lead) || "Unknown";
      m.set(value, (m.get(value) || 0) + 1);
    });
    return [...m.entries()].sort((a,b) => b[1]-a[1]).map(([value, count]) => ({ value, label: value, count }));
  };

  const geographies = useMemo(() => countBy((l) => l.hq), [leads]);
  const industries = useMemo(() => countBy((l) => l.industry).map((item) => ({ ...item, swatch: indColor(item.value, "bar") })), [leads]);
  const roles = useMemo(() => countBy((l) => l.seniority), [leads]);
  const departments = useMemo(() => countBy((l) => l.department), [leads]);
  const fitBands = useMemo(() => countBy((l) => l.size || "Private fit band"), [leads]);

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  const activeCount =
    (filters.geographies?.length || 0) +
    (filters.industries?.length || 0) +
    (filters.roles?.length || 0) +
    (filters.departments?.length || 0) +
    (filters.sizes?.length || 0) +
    (filters.minFit > 0 ? 1 : 0);

  return (
    <div className="filter-bar">
      <FilterPill label="Geography" icon="building" options={geographies} values={filters.geographies || []} onChange={(v) => set("geographies", v)} />
      <FilterPill label="Industry" icon="db" options={industries} values={filters.industries || []} onChange={(v) => set("industries", v)} />
      <FilterPill label="Role" icon="user" options={roles} values={filters.roles || []} onChange={(v) => set("roles", v)} />
      <FilterPill label="Department" icon="building" options={departments} values={filters.departments || []} onChange={(v) => set("departments", v)} />
      <FilterPill label="Fit band" icon="building" options={fitBands} values={filters.sizes || []} onChange={(v) => set("sizes", v)} />
      <FilterPill label="Fit score" icon="target" allowSlider sliderValue={filters.minFit || 0} onSliderChange={(v) => set("minFit", v)} />

      {activeCount > 0 && (
        <button className="filter-pill" style={{ color: "var(--fg-3)", borderStyle: "dashed" }} onClick={() => setFilters({})}>
          <Icon name="x" />
          Clear ({activeCount})
        </button>
      )}

      <div className="filter-summary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        Sort
        <select value={sortKey} onChange={(event) => setSortKey(event.target.value)} style={{ background: "var(--surface-2)", color: "var(--fg)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", fontSize: 12 }}>
          <option value="fit-desc">Fit score ↓</option>
          <option value="company-asc">Company A-Z</option>
          <option value="contact-asc">Contact A-Z</option>
          <option value="enriched-desc">Newest enriched</option>
          <option value="confidence-desc">Confidence ↓</option>
        </select>
      </div>
    </div>
  );
};

const FieldCell = ({ value, status, mono }) => {
  if (status === "missing" || !value) {
    return <div className="field-cell"><span className="dot missing" /><span className="dash">—</span></div>;
  }
  return (
    <div className={"field-cell" + (mono ? " mono" : "")}>
      <span className={"dot " + status} title={status} />
      <span className="val">{value}</span>
    </div>
  );
};

const ConfidenceBar = ({ value }) => {
  const cls = value >= 80 ? "" : value >= 50 ? "warn" : "err";
  return (
    <div className="confidence-bar">
      <div className="confidence-track">
        <div className={"confidence-fill " + cls} style={{ width: value + "%" }} />
      </div>
      <span className="confidence-num">{value}%</span>
    </div>
  );
};

function formatSheetDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16);
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function socialHandle(value) {
  if (!value) return null;
  const text = String(value);
  if (text.includes("/in/")) return "/in/" + text.split("/in/")[1].split(/[?#]/)[0];
  return text.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").slice(0, 42);
}

function getOperationalPain(lead) {
  if (window.LeadInsights?.operationalPainForLead) return window.LeadInsights.operationalPainForLead(lead);
  return {
    headline: "Repetitive follow-up and admin handoffs",
    summary: "Best guess: manual follow-up, scheduling, data entry, or paperwork could be the AI entry point.",
    entryPoint: "Start with the simplest repeatable follow-up/admin workflow.",
    suggestedAgent: "Follow-up + admin cleanup agent",
    why: "Because routine follow-up, scheduling, data entry, and paperwork often repeat.",
    label: "Best guess",
    signals: [],
  };
}

const ContactSheet = ({ leads, onSelect, selectedId, searchQuery, lastRunAt }) => {
  const [filters, setFilters] = useState({});
  const [sortKey, setSortKey] = useState("fit-desc");
  const [checked, setChecked] = useState(new Set());

  const filtered = useMemo(() => {
    let f = leads;
    const q = String(searchQuery || "").trim().toLowerCase();
    if (q) {
      f = f.filter(l => {
        const pain = getOperationalPain(l);
        return [l.company, l.domain, l.contactName, l.title, l.industry, l.hq, l.department, l.email, l.directPhone, l.companyPhone, l.linkedin, l.bestPath, l.notes, pain.suggestedAgent, pain.why, pain.headline, pain.summary, pain.entryPoint]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
    }
    if (filters.geographies?.length) f = f.filter(l => filters.geographies.includes(l.hq));
    if (filters.industries?.length) f = f.filter(l => filters.industries.includes(l.industry));
    if (filters.roles?.length) f = f.filter(l => filters.roles.includes(l.seniority));
    if (filters.departments?.length) f = f.filter(l => filters.departments.includes(l.department));
    if (filters.sizes?.length) f = f.filter(l => filters.sizes.includes(l.size));
    if (filters.minFit > 0) f = f.filter(l => l.fitScore >= filters.minFit);
    const sorted = [...f];
    const byText = (a, b, key) => String(a[key] || "").localeCompare(String(b[key] || ""));
    const dateValue = (l) => new Date(l.raw?.lastEnrichedDate || l.raw?.updatedAt || l.raw?.createdAt || 0).getTime() || 0;
    sorted.sort((a, b) => {
      if (sortKey === "company-asc") return byText(a, b, "company");
      if (sortKey === "contact-asc") return byText(a, b, "contactName");
      if (sortKey === "enriched-desc") return dateValue(b) - dateValue(a);
      if (sortKey === "confidence-desc") return Number(b.confidence || 0) - Number(a.confidence || 0);
      return Number(b.fitScore || 0) - Number(a.fitScore || 0);
    });
    return sorted;
  }, [leads, filters, searchQuery, sortKey]);

  const toggleCheck = (id, e) => {
    e.stopPropagation();
    setChecked(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const lastRunText = lastRunAt ? `last run ${formatSheetDateTime(lastRunAt)}` : "waiting for first run";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Lead Sheet
            <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--fg-3)", fontWeight: 400, background: "var(--surface-3)", padding: "3px 9px", borderRadius: 100, border: "1px solid var(--border)", whiteSpace: "nowrap" }}>{leads.length} rows · {lastRunText}</span>
          </h1>
          <div className="page-sub">The agent fills this sheet automatically. Filter/sort by geography, role, department, public fit band, and fit score.</div>
        </div>
      </div>

      <StatStrip leads={leads} />
      <FilterBar leads={leads} filters={filters} setFilters={setFilters} sortKey={sortKey} setSortKey={setSortKey} />

      <div className="sheet-wrap">
        <div className="sheet-scroll">
          <table className="sheet">
            <colgroup>
              <col style={{ width: 6 }} />
              <col style={{ width: 32 }} />
              <col style={{ width: 116 }} />
              <col style={{ width: 230 }} />
              <col style={{ width: 240 }} />
              <col style={{ width: 260 }} />
              <col style={{ width: 165 }} />
              <col style={{ width: 145 }} />
              <col style={{ width: 165 }} />
              <col style={{ width: 165 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 36 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ padding: 0 }}></th>
                <th><span className="checkbox" /></th>
                <th>Fit</th>
                <th>Company</th>
                <th>Contact</th>
                <th>Suggested AI agent</th>
                <th>Industry</th>
                <th>Geography</th>
                <th>Phone</th>
                <th>Social</th>
                <th>Confidence</th>
                <th>Enriched</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} className={selectedId === l.id ? "selected" : ""} onClick={() => onSelect(l.id)}>
                  <td className="cell-accent"><div className="strip" style={{ background: indColor(l.industry, "bar") }} /></td>
                  <td className="cell-checkbox">
                    <span className={"checkbox" + (checked.has(l.id) ? " checked" : "")} onClick={(e) => toggleCheck(l.id, e)} />
                  </td>
                  <td><FitScore value={l.fitScore} /></td>
                  <td>
                    <div className="company-cell">
                      <div className="company-mono" style={{ background: indColor(l.industry, "soft"), color: indColor(l.industry, "fg"), borderColor: indColor(l.industry, "border") }}>
                        {l.company.split(" ").map(w => w[0]).slice(0,2).join("")}
                      </div>
                      <div style={{ minWidth: 0, overflow: "hidden" }}>
                        <div className="company-name" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{l.company}</div>
                        <div className="company-domain">{l.domain}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="contact-cell">
                      <div className="contact-name" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {l.contactName}
                        <SeniorityTag seniority={l.seniority} />
                      </div>
                      <div className="contact-title">{l.title}{l.department && l.department !== "Unknown" ? ` · ${l.department}` : ""}</div>
                    </div>
                  </td>
                  <td>
                    <div className="pain-cell">
                      <strong>{getOperationalPain(l).suggestedAgent || getOperationalPain(l).headline}</strong>
                      <small>{getOperationalPain(l).why || getOperationalPain(l).entryPoint}</small>
                    </div>
                  </td>
                  <td><IndustryTag industry={l.industry} /></td>
                  <td><span className="cell-mono">{l.hq}</span></td>
                  <td><FieldCell value={l.directPhone || l.companyPhone} status={(l.directPhone ? l.directStatus : l.companyPhoneStatus)} mono /></td>
                  <td><FieldCell value={socialHandle(l.socialPath || l.linkedin || l.facebook || l.instagramOrOtherSocial)} status={l.linkedinStatus} mono /></td>
                  <td className="cell-confidence"><ConfidenceBar value={l.confidence} /></td>
                  <td><span className="cell-mono">{l.enrichedAt}</span></td>
                  <td className="cell-actions">
                    <button className="row-actions-btn" onClick={(e) => e.stopPropagation()} title="Open row details">
                      <Icon name="moreV" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sheet-footer">
          <span>{filtered.length} of {leads.length}</span>
          <span className="sep" />
          <span>{checked.size} selected</span>
          <span className="sep" />
          <span>{sortKey === "fit-desc" ? "Sorted by Fit score ↓" : "Custom sort active"}</span>
          <div style={{ flex: 1 }} />
          <span>Auto-refreshes every 30s</span>
        </div>
      </div>
    </div>
  );
};

window.Rail = Rail;
window.Topbar = Topbar;
window.OutreachPage = OutreachPage;
window.ContactSheet = ContactSheet;
window.FieldCell = FieldCell;
window.ConfidenceBar = ConfidenceBar;
