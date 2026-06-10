/* Lead insight helpers shared by the sheet row and selected-contact drawer. */
(function attachLeadInsights(root) {
  function text(value) {
    if (value == null) return "";
    if (Array.isArray(value)) return value.filter(Boolean).join("; ");
    if (typeof value === "object") return "";
    return String(value).replace(/\s+/g, " ").trim();
  }

  function compact(value, max = 180) {
    const clean = text(value);
    if (!clean) return "";
    return clean.length > max ? `${clean.slice(0, Math.max(0, max - 1)).trim()}…` : clean;
  }

  function firstText() {
    for (const value of arguments) {
      const clean = text(value);
      if (clean) return clean;
    }
    return "";
  }

  function splitList(value) {
    if (Array.isArray(value)) return value.map(text).filter(Boolean);
    return text(value)
      .split(/[;\n]+|,(?=\s*[A-Z])/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function lowerBundle(lead) {
    const raw = lead?.raw || {};
    return [
      lead?.company,
      raw.companyName,
      lead?.industry,
      raw.industryCategory,
      raw.servicesOffered,
      raw.accountNotes,
      raw.revenueSizeEvidence,
      lead?.title,
      raw.title,
      lead?.department,
      raw.departmentFunction,
      raw.roleCategory,
      raw.workflowPainClues,
      raw.reasonToContact,
      raw.suggestedFirstCallAngle,
    ].map(text).join(" ").toLowerCase();
  }

  const PLAYBOOKS = [
    {
      id: "property",
      rx: /property|real estate|tenant|lease|hoa|maintenance|owner portal|escrow|title company|title & escrow/,
      headline: "Tenant/client follow-up and paperwork coordination",
      summary: "They probably lose time chasing requests, status updates, documents, maintenance handoffs, and owner/client follow-up across email and phone.",
      entryPoint: "Start with an AI intake + follow-up agent that collects details, sends reminders, and keeps clients updated without staff babysitting every thread.",
      suggestedAgent: "Maintenance intake + tenant update agent",
      why: "Because they likely chase requests, documents, and status updates across email and phone.",
    },
    {
      id: "trades",
      rx: /construction|contractor|roof|plumb|hvac|electric|landscap|home service|restoration|repair|field service/,
      headline: "Quote follow-up, scheduling, and job-status updates",
      summary: "The likely drag is manual lead response, estimate follow-up, technician scheduling, and customer status updates after jobs start moving.",
      entryPoint: "Start with an AI follow-up agent for new inquiries, estimates, appointment reminders, and post-job review requests.",
      suggestedAgent: "Estimate follow-up + scheduling agent",
      why: "Because missed callbacks, estimate nudges, and appointment reminders are repeatable staff work.",
    },
    {
      id: "healthcare",
      rx: /health|medical|clinic|dental|therapy|patient|care|veterinary|wellness/,
      headline: "Patient/client intake, reminders, and document routing",
      summary: "Front-office staff likely repeat the same intake questions, appointment reminders, paperwork requests, and follow-up instructions all day.",
      entryPoint: "Start with an AI front-desk assistant for intake, reminders, FAQ replies, and routing forms/tasks to the right person.",
      suggestedAgent: "Front-desk intake + reminder agent",
      why: "Because intake questions, reminders, paperwork, and routine follow-ups repeat all day.",
    },
    {
      id: "logistics",
      rx: /logistics|freight|trucking|transport|warehouse|shipping|delivery|dispatch|supply chain/,
      headline: "Dispatch updates and exception follow-up",
      summary: "Operations teams probably spend time checking shipment status, calling about exceptions, updating customers, and coordinating drivers/vendors.",
      entryPoint: "Start with an AI status-update and exception-triage agent that summarizes issues and pushes routine updates to customers or staff.",
      suggestedAgent: "Dispatch status + exception follow-up agent",
      why: "Because shipment updates, driver/vendor checks, and customer status messages repeat constantly.",
    },
    {
      id: "manufacturing",
      rx: /manufactur|industrial|metal|steel|machin|fabricat|components|food manufacturing|plant|factory|supply/,
      headline: "RFQs, order updates, and back-office paperwork",
      summary: "The likely pain is repetitive quote intake, supplier/customer follow-up, order-status updates, and paperwork moving between sales, ops, and finance.",
      entryPoint: "Start with an AI quote/order coordinator that captures requests, drafts follow-ups, and keeps internal handoffs moving.",
      suggestedAgent: "Quote intake + order update agent",
      why: "Because RFQs, order status, supplier follow-ups, and paperwork handoffs are repetitive.",
    },
    {
      id: "professional",
      rx: /legal|law|accounting|bookkeeping|insurance|wealth|financial|compliance|consulting|brokerage/,
      headline: "Client intake, document collection, and renewal follow-up",
      summary: "Client-facing staff probably chase forms, missing documents, signatures, renewals, appointment prep, and repetitive status questions.",
      entryPoint: "Start with an AI client-intake and document-chase agent that follows up politely and keeps the CRM/checklist current.",
      suggestedAgent: "Client intake + document-chase agent",
      why: "Because forms, missing documents, renewals, and status questions create repeat follow-up work.",
    },
    {
      id: "hospitality",
      rx: /hospitality|restaurant|catering|hotel|event|venue|salon|spa|fitness|gym/,
      headline: "Booking, review, and guest/customer follow-up",
      summary: "They likely juggle repeated questions, booking changes, staffing handoffs, review requests, and customer follow-up during busy service windows.",
      entryPoint: "Start with an AI reservation/customer follow-up agent for FAQs, reminders, review requests, and missed-inquiry recovery.",
      suggestedAgent: "Booking + review follow-up agent",
      why: "Because FAQs, reminders, booking changes, and review requests repeat during busy service windows.",
    },
    {
      id: "education-nonprofit",
      rx: /school|education|childcare|nonprofit|church|association|training|academy/,
      headline: "Enrollment/member follow-up and admin coordination",
      summary: "The likely pain is manual inquiry follow-up, reminders, forms, event coordination, and keeping families/members/donors updated.",
      entryPoint: "Start with an AI admin assistant for inquiry response, reminders, form collection, and recurring announcements.",
      suggestedAgent: "Inquiry follow-up + admin reminder agent",
      why: "Because inquiries, reminders, forms, and member/family updates are recurring admin work.",
    },
  ];

  function defaultPlaybook(lead) {
    const raw = lead?.raw || {};
    const bundle = lowerBundle(lead);
    if (/leadership|principal|director/.test(bundle)) {
      return {
        id: "leadership-admin",
        headline: "Leadership follow-up and admin overload",
        summary: "Best guess: the team has routine follow-up, scheduling, status updates, or paperwork that can be made more consistent.",
        entryPoint: "Start with a lightweight AI assistant that handles repetitive follow-up for staff review.",
        suggestedAgent: "Follow-up support agent",
        why: "Because routine replies, scheduling, and paperwork can be made more consistent.",
      };
    }
    if (/operation|office|admin|coordinator|manager|dispatch/.test(bundle)) {
      return {
        id: "ops-admin",
        headline: "Operations coordination and repetitive admin",
        summary: "Best guess: the team has repeatable coordination work — routing requests, updating records, sending reminders, and checking whether tasks got done.",
        entryPoint: "Start with an AI operations assistant for triage, reminders, status updates, and routine data-entry cleanup.",
        suggestedAgent: "Operations triage + reminder agent",
        why: "Because routing requests, updating records, reminders, and task checks are repeatable.",
      };
    }
    if (/sales|business development|marketing/.test(bundle)) {
      return {
        id: "growth-follow-up",
        headline: "Lead follow-up and missed-response recovery",
        summary: "Best guess: the sales/customer-facing side loses deals or time when inbound leads, quotes, reviews, and follow-ups are handled manually.",
        entryPoint: "Start with an AI lead-response and follow-up agent that drafts replies, reminders, and next-step nudges for staff approval.",
        suggestedAgent: "Lead response + follow-up agent",
        why: "Because inbound replies, quote nudges, reviews, and next steps are easy to miss manually.",
      };
    }
    return {
      id: "general-ops",
      headline: "Repetitive follow-up and admin handoffs",
      summary: "Best guess: they have manual customer/vendor follow-up, scheduling, data entry, or paperwork that repeats often enough for an AI agent to save time.",
      entryPoint: "Start with the simplest repeatable workflow: intake, reminder, follow-up, status update, or CRM/admin cleanup.",
      suggestedAgent: "Follow-up + admin cleanup agent",
      why: "Because customer/vendor follow-up, scheduling, data entry, and paperwork often repeat.",
    };
  }

  function selectPlaybook(lead) {
    const bundle = lowerBundle(lead);
    return PLAYBOOKS.find((playbook) => playbook.rx.test(bundle)) || defaultPlaybook(lead);
  }

  function headlineFromPain(pain, fallback) {
    const firstClause = text(pain).split(/[.;]/)[0];
    return compact(firstClause, 86) || fallback;
  }

  function clueList(value) {
    return text(value).split(/[;\n,]+/).map((item) => item.trim()).filter(Boolean);
  }

  function suggestedAgentFromPain(savedPain, fallback) {
    const clues = clueList(savedPain).slice(0, 2);
    if (clues.length) return compact(`${clues.join(" + ")} agent`, 72);
    return compact(fallback, 72);
  }

  function whyFromPain(savedPain, fallback) {
    const clues = clueList(savedPain).slice(0, 3);
    if (clues.length) return compact(`Because the saved research points to ${clues.join(", ")}.`, 150);
    return compact(fallback, 150);
  }

  function signalsForLead(lead, savedPain, reason) {
    const raw = lead?.raw || {};
    const signals = [];
    if (savedPain) signals.push(`Saved clue: ${compact(savedPain, 82)}`);
    if (raw.servicesOffered) signals.push(`Services: ${compact(raw.servicesOffered, 82)}`);
    if (lead?.industry || raw.industryCategory) signals.push(`Industry: ${compact(lead?.industry || raw.industryCategory, 64)}`);
    if (lead?.title || raw.title) signals.push(`Buyer: ${compact(lead?.title || raw.title, 64)}`);
    if (lead?.size || raw.fitBand) signals.push(`Customer type: ${compact(lead?.size || raw.fitBand, 48)}`);
    if (!savedPain && reason) signals.push(`Reason: ${compact(reason, 82)}`);
    return signals.slice(0, 5);
  }

  function operationalPainForLead(lead) {
    const raw = lead?.raw || {};
    const playbook = selectPlaybook(lead || {});
    const savedPain = firstText(raw.likelyOperationalPain, raw.operationalPainPoint, raw.workflowPainClues, lead?.workflowPainClues);
    const reason = firstText(raw.reasonToContact, lead?.reasonToContact);
    const savedAngle = firstText(raw.aiEntryPoint, raw.suggestedFirstCallAngle, lead?.suggestedFirstCallAngle);
    const headline = firstText(raw.likelyOperationalPainHeadline, raw.operationalPainHeadline) || headlineFromPain(savedPain, playbook.headline);
    const suggestedAgent = suggestedAgentFromPain(savedPain, playbook.suggestedAgent || playbook.headline);
    const why = whyFromPain(savedPain, playbook.why || playbook.summary);
    return {
      label: savedPain ? "Saved clue" : "Best guess",
      headline: compact(headline, 86),
      summary: compact(savedPain || playbook.summary, 250),
      entryPoint: compact(savedAngle || reason || playbook.entryPoint, 210),
      suggestedAgent,
      why,
      confidence: savedPain ? "Based on saved research clues" : "Directional — inferred from industry and role",
      signals: signalsForLead(lead || {}, savedPain, reason),
      playbook: playbook.id,
    };
  }

  function humanizeReason(reason) {
    return compact(text(reason)
      .replace(/Clawdified compatibility/gi, "Clawdified match")
      .replace(/workflowPainClues/gi, "workflow pain clues")
      .replace(/softwareAiHeaviness/gi, "software/AI heaviness")
      .replace(/tamFitScore|fitScore/gi, "match score"), 160);
  }

  function plainFitReasons(lead, painInsight) {
    const raw = lead?.raw || {};
    const fromScore = splitList(lead?.scoreReasons || raw.scoreReasons || raw.accountFitReasons).map(humanizeReason).filter(Boolean);
    if (fromScore.length) return fromScore.slice(0, 4);

    const reasons = [];
    const fitScore = Number(lead?.clawdifiedCompatibilityScore || lead?.fitScore || raw.clawdifiedCompatibilityScore || raw.tamFitScore || 0);
    if (fitScore >= 60) reasons.push("The match score says this row is worth a human look.");
    if (painInsight?.suggestedAgent) reasons.push(`Suggested agent: ${painInsight.suggestedAgent}.`);
    if (lead?.title || raw.title) reasons.push(`${lead?.title || raw.title} is close enough to the business workflow to feel the pain if it is real.`);
    if (lead?.size || raw.fitBand) reasons.push("The company is close enough to the ICP to review.");
    return reasons.slice(0, 4);
  }

  function plainFitRisks(lead) {
    const raw = lead?.raw || {};
    const risks = splitList(lead?.scoreRisks || raw.scoreRisks || raw.accountFitRisks).map(humanizeReason).filter(Boolean);
    if (risks.length) return risks.slice(0, 4);
    const missing = splitList(lead?.missingFields || raw.missingFields);
    const fallback = [];
    if (missing.some((field) => /email/i.test(field))) fallback.push("Direct email is still missing or unverified.");
    if (missing.some((field) => /phone/i.test(field))) fallback.push("Direct/mobile phone is still missing or unverified.");
    if (!fallback.length && missing.length) fallback.push(`Still missing: ${compact(missing.slice(0, 3).join(", "), 120)}.`);
    if (!fallback.length) fallback.push("No major watch-out was recorded yet; still verify the pain before outreach.");
    return fallback;
  }

  root.LeadInsights = {
    operationalPainForLead,
    plainFitReasons,
    plainFitRisks,
    _private: { compact, splitList, selectPlaybook },
  };
})(typeof window !== "undefined" ? window : globalThis);
