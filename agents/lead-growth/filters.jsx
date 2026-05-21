/* eslint-disable */
/* Industry → hue mapping (subtle, low-chroma accents) */
const INDUSTRY_HUE = {
  "Freight & Logistics": 35,
  "Biotech": 155,
  "Advanced Manufacturing": 240,
  "Industrial Robotics": 260,
  "Specialty Insurance": 220,
  "Private Equity": 280,
  "Medical Devices": 175,
  "Legal Services": 290,
  "Energy & Utilities": 60,
  "B2B SaaS": 250,
  "Aerospace & Defense": 215,
  "Food Manufacturing": 25,
  "RegTech": 195,
  "Commercial Real Estate": 45,
  "Metals": 0,
  "Industrial Supply": 80,
  "Healthcare Provider": 165,
  "Maritime": 200,
  "Title & Escrow": 100,
  "Hospitality": 320,
  "Mining": 50,
  "Wealth Management": 270,
  "AgTech": 130,
  "Publishing": 305,
  "Civil Engineering": 230,
  "Accounting": 185,
};
const indHue = (industry) => INDUSTRY_HUE[industry] ?? 250;
const indColor = (industry, mode = "fg") => {
  const h = indHue(industry);
  if (mode === "bar") return `oklch(0.62 0.14 ${h})`;
  if (mode === "soft") return `oklch(0.95 0.05 ${h})`;
  if (mode === "border") return `oklch(0.84 0.08 ${h})`;
  return `oklch(0.40 0.13 ${h})`;
};
window.indHue = indHue;
window.indColor = indColor;

const IndustryTag = ({ industry }) => (
  <span className="tag" style={{
    background: indColor(industry, "soft"),
    borderColor: indColor(industry, "border"),
    color: indColor(industry, "fg"),
  }}>
    <span className="tag-dot" style={{ background: indColor(industry, "bar") }} />
    {industry}
  </span>
);
window.IndustryTag = IndustryTag;

const SeniorityTag = ({ seniority }) => {
  const cls = seniority === "C-Level" ? "seniority-c"
    : seniority === "VP" ? "seniority-vp"
    : seniority === "Head" ? "seniority-head"
    : "seniority-director";
  return <span className={"seniority-tag " + cls}>{seniority}</span>;
};
window.SeniorityTag = SeniorityTag;

const FitScore = ({ value }) => {
  const cls = value >= 80 ? "fit-hot" : value >= 65 ? "fit-warm" : "fit-cold";
  const label = value >= 80 ? "Hot" : value >= 65 ? "Warm" : "Cool";
  return (
    <div className="fit-cell">
      <div className={"fit-ring " + cls} style={{ "--fit": value }}>
        <span>{value}</span>
      </div>
      <span className={"fit-label " + cls}>{label}</span>
    </div>
  );
};
window.FitScore = FitScore;

/* ---------- Multi-select filter pill ---------- */
const FilterPill = ({ label, icon, options, values, onChange, allowSlider, sliderValue, onSliderChange }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const active = (values && values.length > 0) || (allowSlider && sliderValue > 0);
  const summary = allowSlider
    ? (sliderValue > 0 ? `≥ ${sliderValue}%` : null)
    : (values.length === 0 ? null : values.length === 1 ? values[0] : values.length + " selected");

  const toggle = (v) => {
    if (values.includes(v)) onChange(values.filter(x => x !== v));
    else onChange([...values, v]);
  };

  return (
    <div className="filter-pill-wrap" ref={ref}>
      <button className={"filter-pill" + (active ? " active" : "")} onClick={() => setOpen(o => !o)}>
        {icon && <Icon name={icon} className="ico" />}
        <span className="label">{label}</span>
        {summary && <span className="value">{summary}</span>}
        {!summary && <Icon name="chevronDown" className="ico" style={{ marginRight: 6 }} />}
        {active && <span className="x" onClick={(e) => { e.stopPropagation(); if (allowSlider) onSliderChange(0); else onChange([]); }}>×</span>}
      </button>
      {open && (
        <div className="filter-popover">
          <div className="filter-popover-head">{label}</div>
          {allowSlider ? (
            <div style={{ padding: "8px 12px 12px" }}>
              <div style={{ fontSize: 12, color: "var(--fg-2)", marginBottom: 8 }}>
                Show only leads with fit score ≥ <b style={{ fontFamily: "var(--mono)", color: "var(--fg)" }}>{sliderValue}%</b>
              </div>
              <input type="range" min="0" max="100" step="5" value={sliderValue} onChange={(e) => onSliderChange(parseInt(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--fg-3)", fontFamily: "var(--mono)", marginTop: 4 }}>
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>
          ) : (
            options.map(opt => {
              const checked = values.includes(opt.value);
              return (
                <div key={opt.value} className={"filter-option" + (checked ? " checked" : "")} onClick={() => toggle(opt.value)}>
                  <span className="check" />
                  {opt.swatch && <span style={{ width: 8, height: 8, borderRadius: 50, background: opt.swatch, flexShrink: 0 }} />}
                  <span style={{ flex: 1 }}>{opt.label}</span>
                  {opt.count != null && <span className="count">{opt.count}</span>}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
window.FilterPill = FilterPill;
