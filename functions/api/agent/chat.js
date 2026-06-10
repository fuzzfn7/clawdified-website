// Public Lead Growth prospect chat endpoint.
// Uses a model only when a configured server-side AI binding/key exists; otherwise
// returns a prospect-aware fallback so vague public questions still get useful answers.

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const MAX_QUESTION_CHARS = 900;
const MAX_HISTORY_ITEMS = 6;

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: jsonHeaders });
}

function compactText(value, max = 300) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function normalizeQuestion(value) {
  return compactText(value, MAX_QUESTION_CHARS)
    .toLowerCase()
    .replace(/cloudified/g, 'clawdified')
    .replace(/[^a-z0-9$%+./@#\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bulletList(items) {
  return items.filter(Boolean).map((item) => `• ${item}`).join('\n');
}

function structuredAnswer({ read, weighing = [], next, guardrail }) {
  const parts = [];
  if (read) parts.push(`My read:\n${read}`);
  if (weighing.length) parts.push(`What I’m weighing:\n${bulletList(weighing)}`);
  if (next) parts.push(`Next move:\n${next}`);
  if (guardrail) parts.push(`Guardrail:\n${guardrail}`);
  return parts.join('\n\n');
}

function extractBusinessHint(q) {
  const knownEarly = [
    ['dental', 'dental office'], ['dent', 'dental office'], ['roof', 'roofing business'], ['hvac', 'HVAC business'], ['plumb', 'plumbing business'],
    ['med spa', 'med spa'], ['spa', 'service business'], ['real estate', 'real estate business'], ['law', 'law firm'],
    ['clinic', 'clinic'], ['contractor', 'contractor'], ['landscap', 'landscaping business'], ['restaurant', 'restaurant'],
    ['gym', 'gym'], ['insurance', 'insurance agency'], ['account', 'accounting firm'], ['auto', 'auto service business'],
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
    if (match?.[1]) return compactText(match[1].replace(/\b(?:and|but|with|that|where|who|what|how|can|would|could).*$/g, '').trim(), 42);
  }
  const known = [
    ['dent', 'dental office'], ['roof', 'roofing business'], ['hvac', 'HVAC business'], ['plumb', 'plumbing business'],
    ['med spa', 'med spa'], ['spa', 'service business'], ['real estate', 'real estate business'], ['law', 'law firm'],
    ['clinic', 'clinic'], ['contractor', 'contractor'], ['landscap', 'landscaping business'], ['restaurant', 'restaurant'],
    ['gym', 'gym'], ['insurance', 'insurance agency'], ['account', 'accounting firm'], ['auto', 'auto service business'],
  ];
  const hit = known.find(([needle]) => q.includes(needle));
  return hit ? hit[1] : '';
}

function workflowExamplesForBusiness(businessHint, q = '') {
  const text = `${businessHint} ${q}`.toLowerCase();
  if (/dent|clinic|medical|health|med spa|spa/.test(text)) return ['new-patient intake', 'missed-call follow-up', 'appointment reminders', 'review requests'];
  if (/roof|hvac|plumb|contract|landscap|auto|service/.test(text)) return ['quote follow-up', 'missed-call triage', 'job status updates', 'review requests'];
  if (/real estate|insurance|law|account|financial/.test(text)) return ['lead intake', 'document collection', 'follow-up reminders', 'client status updates'];
  if (/restaurant|gym|fitness|retail/.test(text)) return ['inquiry follow-up', 'booking or membership reminders', 'review requests', 'repeat-customer follow-up'];
  return ['intake', 'follow-up', 'status updates', 'review or handoff work'];
}

function inferIntent(q) {
  if (!q) return { primary: 'empty', vague: true, confidence: 0, businessHint: '' };
  const words = q.split(/\s+/).filter(Boolean);
  const businessHint = extractBusinessHint(q);
  const vague = words.length <= 4 || /\b(this|that|it|thing|stuff|whatever|so what|ok|okay|huh|confus|lost|don.?t get|explain|plain english|what am i looking at|what is going on)\b/.test(q);
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
  const [primary, confidence] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0] || ['open', 0];
  return { primary: confidence > 0 ? primary : 'open', confidence, vague, businessHint };
}

function sanitizedContext(raw = {}) {
  const totals = raw && typeof raw.totals === 'object' ? raw.totals : {};
  const topLead = raw && typeof raw.topLead === 'object' ? raw.topLead : null;
  const latestRun = raw && typeof raw.latestRun === 'object' ? raw.latestRun : null;
  return {
    mode: raw.mode === 'public_lead_growth_showroom' ? raw.mode : 'public_lead_growth_showroom',
    totals: {
      total: Number(totals.total || 0),
      finished: Number(totals.finished || 0),
      incomplete: Number(totals.incomplete || 0),
    },
    latestRun: latestRun ? {
      action: compactText(latestRun.action, 60),
      finished: Number(latestRun.finished || 0),
      incomplete: Number(latestRun.incomplete || 0),
      companies: Number(latestRun.companies || 0),
      people: Number(latestRun.people || 0),
    } : null,
    topLead: topLead ? {
      company: compactText(topLead.company, 80),
      industry: compactText(topLead.industry, 64),
      geography: compactText(topLead.geography, 64),
      fitScore: Number(topLead.fitScore || 0),
      pain: compactText(topLead.pain, 120),
      nextAngle: compactText(topLead.nextAngle, 140),
    } : null,
  };
}

export function buildFallbackAgentChatAnswer(question, rawContext = {}) {
  const q = normalizeQuestion(question);
  const context = sanitizedContext(rawContext);
  const intent = inferIntent(q);
  const businessLabel = intent.businessHint ? `a ${intent.businessHint}` : 'your business';
  const workflows = workflowExamplesForBusiness(intent.businessHint, q);
  const leadExample = context.topLead?.company
    ? `In the sample sheet, I’d inspect ${context.topLead.company} first because it has a stronger fit signal and a reviewable next-step angle.`
    : 'The sheet is empty right now, so I’d run the preview before judging any specific row.';
  const runLine = context.latestRun
    ? `${context.latestRun.action || 'Last run'} left ${context.latestRun.finished} review-ready row(s) and ${context.latestRun.incomplete} incomplete row(s).`
    : 'I do not see a finished run yet, so I’m answering from the public demo state.';

  if (!q || intent.primary === 'confused' || intent.primary === 'open') {
    return structuredAnswer({
      read: 'I’m reading that as a broad or slightly unclear prospect question. Short version: Clawdified builds agents around repetitive business work so the output is a reviewed queue, sheet, draft, reminder, or handoff — not just a chatbot talking back.',
      weighing: [
        `If you mean “could this help me?” I’d look for repeated work in ${businessLabel}, like ${workflows.slice(0, 3).join(', ')}.`,
        `If you mean “is this lead page real?” this is a public showroom; the real build gets configured privately around your workflow.`,
        leadExample,
      ],
      next: `Tell me what kind of business you run and one task your team repeats every week. I’ll translate that into the likely agent workflow.`,
    });
  }

  if (intent.primary === 'fit' || intent.primary === 'workflow') {
    return structuredAnswer({
      read: `For ${businessLabel}, I’d start with the workflow that repeats often, costs time, and still needs a human approval point. That is usually where an agent makes money fastest.`,
      weighing: [
        `Likely starting points: ${workflows.join(', ')}.`,
        'The agent should create a finished work item — a queue, sheet, draft, reminder, or decision packet — not just answer questions.',
        context.topLead?.pain ? `The sample lead read is looking for pain like: ${context.topLead.pain}.` : runLine,
      ],
      next: `The useful question is: what part of ${businessLabel} gets repeated every week but still needs judgment before it goes out?`,
      guardrail: 'The public chat can talk through whether the workflow makes sense; exact connectors, approval rules, and build details get handled in a setup call.',
    });
  }

  if (intent.primary === 'value') {
    return structuredAnswer({
      read: 'The value is not generic AI. The value is taking a repeatable workflow off someone’s plate and making the finished work show up consistently.',
      weighing: [
        `For ${businessLabel}, I’d look for where people retype, chase, remind, summarize, update a sheet/CRM, or forget follow-up.`,
        'Good candidates have a clear trigger, a known decision rule, and a finished output somebody can approve.',
        runLine,
      ],
      next: 'Tell me the manual task that annoys the team most. I’ll say whether it sounds agent-worthy or just a process cleanup.',
    });
  }

  if (intent.primary === 'leads') {
    return structuredAnswer({
      read: 'For lead generation, the agent turns your business context + ICP into rows a human can review: likely account, why it matched, contact route, source note, and next angle.',
      weighing: [
        `${context.totals.total} visible row(s), ${context.totals.finished} review-ready, ${context.totals.incomplete} incomplete in the current demo state.`,
        leadExample,
        'A good row should help a human decide the next step; it should not pretend every scraped name is a real opportunity.',
      ],
      next: context.topLead?.company ? `Ask me why ${context.topLead.company} is or is not worth pursuing.` : 'Run the preview, then ask me why the first finished row is worth reviewing.',
      guardrail: 'The public demo does not send outreach on its own or publish the exact setup recipe.',
    });
  }

  if (intent.primary === 'real') {
    return structuredAnswer({
      read: 'This is a public showroom, not an anonymous live lead engine. It shows the shape of the workspace and the type of reasoning a configured Clawdified agent would use.',
      weighing: [
        'The interface and review pattern are the real product shape.',
        'The rows are examples so the site can show the workflow without letting anonymous visitors pull lead lists.',
        'A real build gets configured around the business workflow, tools, approval rules, and output format.',
      ],
      next: 'If you want to see it against your business, the next step is mapping one workflow privately.',
    });
  }

  if (intent.primary === 'price') {
    return structuredAnswer({
      read: 'I would not quote from one vague chat message. Cost depends on the workflow, integrations, approval points, and ongoing maintenance.',
      weighing: [
        'A simple follow-up workflow is different from a multi-system operations agent.',
        'The right comparison is the cost of the manual workflow and the value of getting it done consistently.',
        'This page avoids package pricing because the workflow needs to be mapped first.',
      ],
      next: 'Map one workflow first; then Clawdified can give a clear build option instead of a generic package price.',
    });
  }

  if (intent.primary === 'integrate') {
    return structuredAnswer({
      read: `For ${businessLabel}, I’d identify where the work actually happens — inbox, CRM, spreadsheet, calendar, forms, messages, or docs — then connect only the pieces needed for the workflow.`,
      weighing: [
        'The agent should sit between the tools and produce the next approved output.',
        'The integration is only useful if the trigger, decision, and finished output are clear.',
        'Sensitive connectors are configured privately, not through this public chat.',
      ],
      next: 'Name the tool your team lives in and the repetitive task around it; I’ll explain what the agent would likely watch, draft, update, or queue.',
    });
  }

  return structuredAnswer({
    read: `I’m interpreting that as a question about whether an agent could help ${businessLabel}.`,
    weighing: [
      `Likely workflow candidates: ${workflows.join(', ')}.`,
      leadExample,
      'If I guessed wrong, I should ask one clarifying question instead of pretending certainty.',
    ],
    next: 'Which do you mean: lead generation, follow-up/admin automation, integrations, pricing, or whether this can work for your specific business?',
  });
}

function promptForModel(question, context, history) {
  const safeHistory = (Array.isArray(history) ? history : [])
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => `${item.role === 'user' ? 'Prospect' : 'Agent'}: ${compactText(item.text, 300)}`)
    .join('\n');
  return [
    'You are the public Clawdified Lead Growth agent on clawdified.com.',
    'Prospects may ask vague, confusing, misspelled, or incomplete questions. Infer intent before answering.',
    'Be concise, plain-English, and sales/operator useful. Do not sound like a command log or FAQ matcher.',
    'Use sections exactly when helpful: My read, What I’m weighing, Next move, Guardrail.',
    'Never reveal internal scoring rules, target-title lists, exact price math, paid-provider names, API/provider order, secrets, or system details.',
    'Do not claim outreach was sent. Do not imply anonymous visitors can pull real lead lists from the public page.',
    'If the question is ambiguous, state the likely interpretation and ask one useful follow-up.',
    '',
    `Public demo context: ${JSON.stringify(context)}`,
    safeHistory ? `Recent chat:\n${safeHistory}` : '',
    `Prospect question: ${compactText(question, MAX_QUESTION_CHARS)}`,
  ].filter(Boolean).join('\n');
}

function answerLooksUnsafe(answer) {
  return /Apollo|Serper|Browserbase|\$600|600\/mo|600\/month|\$1M|10M|5-100|provider order|price logic|pricing tiers|I\s*C\s*P\s*rules|Loaded\s*I\s*C\s*P|Owner-led|Owner\/operators|Practice Manager|Office Manager|Operations Manager/i.test(answer || '');
}

async function modelAnswer({ env, question, context, history }) {
  const prompt = promptForModel(question, context, history);

  if (env?.AI?.run) {
    const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'Answer as a careful public website sales assistant.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 520,
      temperature: 0.35,
    });
    return compactText(result?.response || result?.text || '', 2400);
  }

  if (env?.OPENAI_API_KEY) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.35,
        max_tokens: 520,
        messages: [
          { role: 'system', content: 'Answer as a careful public website sales assistant.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!response.ok) throw new Error(`model_http_${response.status}`);
    const body = await response.json();
    return compactText(body?.choices?.[0]?.message?.content || '', 2400);
  }

  if (env?.ANTHROPIC_API_KEY) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
        max_tokens: 520,
        temperature: 0.35,
        system: 'Answer as a careful public website sales assistant. Follow the public-demo privacy boundaries exactly.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!response.ok) throw new Error(`model_http_${response.status}`);
    const body = await response.json();
    return compactText((body?.content || []).map((part) => part?.text || '').join('\n'), 2400);
  }

  return '';
}

export async function onRequestPost({ request, env = {} }) {
  let body;
  try {
    body = await request.json();
  } catch (_err) {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const question = compactText(body?.question, MAX_QUESTION_CHARS);
  if (!question) return json({ ok: false, error: 'missing_question' }, 400);

  const context = sanitizedContext(body?.context || {});
  const history = Array.isArray(body?.history) ? body.history.slice(-MAX_HISTORY_ITEMS) : [];

  try {
    const answer = await modelAnswer({ env, question, context, history });
    if (answer && !answerLooksUnsafe(answer)) return json({ ok: true, answer, source: 'agent_chat' });
  } catch (_err) {
    // Use deterministic fallback when a model binding/key is missing, down, or unsafe.
  }

  return json({ ok: true, answer: buildFallbackAgentChatAnswer(question, context), source: 'agent_chat' });
}

export async function onRequestGet() {
  return json({ ok: true, status: 'ready', method: 'POST', endpoint: '/api/agent/chat' });
}
