/* eslint-disable */
const { useEffect: useEffectP } = React;

function leadInitials(lead) {
  const text = String(lead?.contactName || lead?.company || "Lead").trim();
  const initials = text.split(/\s+/).filter(Boolean).map((word) => word[0]).slice(0, 2).join("").toUpperCase();
  return initials || "L";
}

function asList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "").split(/[;\n,]+/).map((item) => item.trim()).filter(Boolean);
}

function panelPainInsight(lead) {
  if (window.LeadInsights?.operationalPainForLead) return window.LeadInsights.operationalPainForLead(lead);
  return {
    label: "Best guess",
    headline: "Repetitive follow-up and admin handoffs",
    summary: "Best guess: manual follow-up, scheduling, data entry, or paperwork could be the AI entry point.",
    entryPoint: "Start with the simplest repeatable follow-up/admin workflow.",
    suggestedAgent: "Follow-up + admin cleanup agent",
    why: "Because routine follow-up, scheduling, data entry, and paperwork often repeat.",
    confidence: "Directional",
    signals: [],
  };
}

function panelFitReasons(lead, painInsight) {
  if (window.LeadInsights?.plainFitReasons) return window.LeadInsights.plainFitReasons(lead, painInsight);
  return asList(lead.scoreReasons).slice(0, 4);
}

function panelFitRisks(lead) {
  if (window.LeadInsights?.plainFitRisks) return window.LeadInsights.plainFitRisks(lead);
  return asList(lead.scoreRisks).slice(0, 4);
}

const KV = ({ label, icon, value, status, mono }) => {
  const normalizedStatus = status || "missing";
  const empty = !value || normalizedStatus === "missing";
  return (
    <div className={"kv" + (empty ? " kv-empty" : "")}>
      <div className="kv-label">
        {icon && <Icon name={icon} className="ico" />}
        {label}
        {!empty && <span className={"dot " + normalizedStatus} title={normalizedStatus} style={{ marginLeft: "auto" }} />}
      </div>
      <div className={"kv-value" + (mono ? " mono" : "")}>
        <span className="val">{empty ? "Not found" : value}</span>
      </div>
    </div>
  );
};

const PlainList = ({ items, fallback, tone }) => {
  const safeItems = (items || []).filter(Boolean);
  const display = safeItems.length ? safeItems : [fallback];
  return (
    <div className={"plain-list" + (tone ? ` ${tone}` : "")}>
      {display.map((item, i) => <div key={i} className="plain-list-item"><span />{item}</div>)}
    </div>
  );
};

const QuickFact = ({ label, value, icon, mono }) => (
  <div className="quick-fact">
    {icon && <Icon name={icon} />}
    <div>
      <span>{label}</span>
      <b className={mono ? "mono" : ""}>{value || "Not found"}</b>
    </div>
  </div>
);

const LeadPanel = ({ lead, open, onClose }) => {
  if (!lead) return null;

  const bestPath = lead.bestPath || "Review contact route before outreach";
  const contactName = lead.contactName || "No contact selected";
  const title = lead.title || "Missing target person";
  const company = lead.company || "Unknown company";
  const industry = lead.industry || "Uncategorized";
  const fitBand = lead.size || "Private fit band";
  const hq = lead.hq || "Broad U.S.";
  const enrichedAt = lead.enrichedAt || "—";
  const painInsight = panelPainInsight(lead);
  const fitReasons = panelFitReasons(lead, painInsight);
  const fitRisks = panelFitRisks(lead);
  const fitScore = lead.clawdifiedCompatibilityScore || lead.fitScore || 0;
  const phone = lead.directPhone || lead.companyPhone;
  const phoneStatus = phone ? (lead.directPhone ? lead.directStatus : lead.companyPhoneStatus) : "missing";
  const contactRoutesFound = [lead.email, phone, lead.linkedin, lead.facebook, lead.instagramOrOtherSocial, lead.website].filter(Boolean).length;

  return (
    <>
      <div className={"scrim" + (open ? " open" : "")} onClick={onClose} />
      <aside className={"panel" + (open ? " open" : "")} role="dialog" aria-label="Lead details">
        <div className="panel-head">
          <span className="panel-head-id">{lead.id}</span>
          <span style={{ fontSize: 12, color: "var(--fg-3)" }}>Contact intelligence</span>
          <div className="panel-head-spacer" />
          <button className="panel-close" onClick={onClose} title="Close"><Icon name="x" /></button>
        </div>

        <div className="panel-hero">
          <div className="panel-hero-mono">{leadInitials(lead)}</div>
          <div className="panel-hero-body">
            <h2 className="panel-hero-name">{contactName}</h2>
            <div className="panel-hero-meta">
              <span>{title}</span>
              <span className="sep">·</span>
              <span style={{ fontWeight: 500, color: "var(--fg)" }}>{company}</span>
              <span className="sep">·</span>
              <span>{industry}</span>
            </div>
            <div className="panel-hero-meta" style={{ marginTop: 6, fontSize: 12 }}>
              <span><Icon name="building" className="ico" />Fit band {fitBand}</span>
              <span className="sep">·</span>
              <span>HQ {hq}</span>
            </div>
          </div>
          <div className="panel-hero-side">
            <div className="panel-hero-conf">{fitScore} <small>fit</small></div>
            <div style={{ width: 100 }}><ConfidenceBar value={lead.confidence || 0} /></div>
            <div style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--mono)", marginTop: 2 }}>{lead.compatibilityConfidence || "UNVERIFIED"} · enriched {enrichedAt}</div>
          </div>
        </div>

        <div className="panel-body">
          <div className="panel-section panel-quick-read">
            <div className="insight-card pain-card">
              <div className="insight-eyebrow"><Icon name="target" />Suggested customer angle<span>{painInsight.label}</span></div>
              <h3>{painInsight.headline || painInsight.suggestedAgent}</h3>
              <p><b>Why:</b> {painInsight.why || painInsight.summary}</p>
            </div>

            <div className="insight-card contact-card-fast">
              <div className="insight-eyebrow"><Icon name="target" />Quick contact read</div>
              <QuickFact label="Best next path" value={bestPath} icon="target" />
              <QuickFact label="Email" value={lead.email} icon="mail" mono />
              <QuickFact label="Phone" value={phone} icon="phone" mono />
              <div className="contact-card-count">{contactRoutesFound} contact/company route(s) found</div>
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-section-title">Contact information<span className="count">{contactRoutesFound}</span></div>
            <div className="kv-grid">
              <KV label="Email" icon="mail" value={lead.email} status={lead.emailStatus} mono />
              <KV label="Phone" icon="phone" value={phone} status={phoneStatus} mono />
              <KV label="LinkedIn" icon="link" value={lead.linkedin} status={lead.linkedinStatus} mono />
              <KV label="Facebook" icon="link" value={lead.facebook} status={lead.facebook ? lead.linkedinStatus : "missing"} mono />
              <KV label="Instagram / social" icon="link" value={lead.instagramOrOtherSocial} status={lead.instagramOrOtherSocial ? lead.linkedinStatus : "missing"} mono />
              <KV label="Website" icon="globe" value={lead.website} status={lead.website ? "verified" : "missing"} mono />
              <KV label="Best path" icon="target" value={bestPath} status="verified" />
            </div>
          </div>

          <div className="panel-section company-fit-split">
            <div>
              <div className="panel-section-title">Company snapshot<span className="count">4</span></div>
              <div className="kv-grid compact-kv-grid">
                <KV label="Company" icon="building" value={company} status="verified" />
                <KV label="Industry" icon="db" value={industry} status="verified" />
                <KV label="Fit band" value={fitBand} status="verified" mono />
                <KV label="Headquarters" value={hq} status="verified" />
              </div>
            </div>
            <div>
              <div className="panel-section-title">Plain-English fit<span className="count">{fitScore}</span></div>
              <div className="fit-summary-card">
                <div className="fit-score-large"><span>{fitScore}</span><small>{lead.compatibilityConfidence || "UNVERIFIED"}</small></div>
                <div className="fit-summary-copy">
                  <b>Why it may fit</b>
                  <PlainList items={fitReasons} fallback="No fit reasons recorded yet; verify the operational pain before outreach." />
                </div>
              </div>
              <div className="risk-note">
                <b>Watch-outs</b>
                <PlainList items={fitRisks} fallback="No major fit risk was recorded yet; still verify before outreach." tone="risk" />
              </div>
            </div>
          </div>
        </div>

      </aside>
    </>
  );
};

window.LeadPanel = LeadPanel;
