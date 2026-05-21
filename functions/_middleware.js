const ROUTES = {
  '/ai-agent-knoxville-tn': {
    title: 'AI Agent Services in Knoxville, TN | Clawdified',
    description: 'Looking for AI agent services in Knoxville? Clawdified builds custom AI agents that automate customer communication, lead follow-up, and daily operations for local businesses.',
  },
  '/ai-agent-agency-knoxville-tn': {
    title: 'AI Agent Agency in Knoxville, TN | Clawdified',
    description: 'Clawdified is Knoxville\'s AI agent agency. We design, build, and deploy custom AI agents for small businesses — from review management to SEO automation.',
  },
  '/small-business-ai-agent-knoxville-tn': {
    title: 'Small Business AI Agents in Knoxville, TN | Clawdified',
    description: 'AI agents built specifically for small businesses in Knoxville, TN. Automate customer responses, manage reviews, and optimize operations without hiring more staff.',
  },
  '/ai-automation-agency-knoxville-tn': {
    title: 'AI Automation Agency in Knoxville, TN | Clawdified',
    description: 'Knoxville\'s AI automation agency. Intelligent automation that handles customer communication, reputation management, and business operations around the clock.',
  },
  '/business-automation-knoxville-tn': {
    title: 'Business Automation Services in Knoxville, TN | Clawdified',
    description: 'Automate your Knoxville business with custom AI agents. From answering customer inquiries to managing online reviews — Clawdified handles the work you shouldn\'t have to.',
  },
};

const LEGAL_ROUTES = {
  '/privacy': {
    slug: 'privacy',
    title: 'Privacy Policy | Clawdified',
    description: 'Clawdified privacy policy for website visitors, client workflows, and optional Meta/Facebook connector authorization.',
    eyebrow: 'Privacy Policy',
    updated: 'May 21, 2026',
    sections: [
      ['Overview', 'Clawdified builds AI automation agents for small businesses. This policy explains what information we collect, how we use it, and how clients can request deletion or access changes.'],
      ['Information we collect', 'We may collect business contact details, project notes, workflow requirements, messages you send to us, website usage information, and information you explicitly authorize through third-party integrations such as Meta/Facebook Login.'],
      ['Meta/Facebook connector data', 'If you connect a Facebook, Instagram, or Meta Business account, we only request data needed to set up or operate the requested automation. This may include your basic profile, business or page identifiers, page/account metadata, and authorized content or message context required for the workflow. We do not sell Meta platform data.'],
      ['How we use information', 'We use information to provide and improve Clawdified services, configure automations, support client workflows, troubleshoot integrations, communicate with clients, and comply with platform or legal requirements.'],
      ['Sharing', 'We share information only with service providers needed to operate the website or client automation, when a client directs us to connect a tool, or when required by law.'],
      ['Storage and security', 'We use reasonable technical and organizational safeguards. No internet service can guarantee absolute security, so clients should avoid sending sensitive secrets unless a secure handoff method has been agreed.'],
      ['Your choices', 'You can revoke third-party access through the connected platform, request deletion using the data deletion page, or contact Clawdified to update or remove project information where legally and operationally possible.'],
      ['Contact', 'For privacy questions or data requests, use the contact options on clawdified.com or visit https://clawdified.com/data-deletion for deletion instructions.'],
    ],
  },
  '/terms': {
    slug: 'terms',
    title: 'Terms of Service | Clawdified',
    description: 'Clawdified terms of service for website visitors and clients using AI automation workflows.',
    eyebrow: 'Terms of Service',
    updated: 'May 21, 2026',
    sections: [
      ['Use of the site and services', 'Clawdified provides information about AI automation services and may provide custom software, workflow automation, demos, and integration support for clients. You agree to use the site and services lawfully and not to misuse, disrupt, or attempt unauthorized access to our systems.'],
      ['Client workflows and approvals', 'AI agents can draft, summarize, classify, or prepare actions, but client-facing sends, public posts, paid actions, credential use, and production changes should be reviewed and approved by the appropriate human operator unless a separate written agreement says otherwise.'],
      ['Third-party platforms', 'Some workflows connect to third-party services such as Meta/Facebook, Google, CRMs, email providers, or other business tools. Those services have their own terms and privacy rules. You are responsible for having the rights and permissions needed to connect your accounts and data.'],
      ['No guaranteed results', 'Automation, lead generation, SEO, review, and workflow results vary based on data quality, account permissions, platform limits, market conditions, and client follow-through. We do not guarantee specific revenue, ranking, lead, or review outcomes.'],
      ['Intellectual property', 'Unless otherwise agreed in writing, Clawdified retains its pre-existing tools, templates, methods, and reusable components. Client-specific deliverables and usage rights are handled by the applicable proposal, statement of work, or written agreement.'],
      ['Limitation of liability', 'To the fullest extent allowed by law, Clawdified is not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the site or services.'],
      ['Changes', 'We may update these terms as services change. The updated date on this page shows the latest revision.'],
      ['Contact', 'Questions about these terms can be sent through the contact options on clawdified.com.'],
    ],
  },
  '/data-deletion': {
    slug: 'data-deletion',
    title: 'User Data Deletion Instructions | Clawdified',
    description: 'Instructions for requesting deletion of Clawdified user data, including data authorized through Meta/Facebook Login.',
    eyebrow: 'User Data Deletion',
    updated: 'May 21, 2026',
    sections: [
      ['How to request deletion', 'To request deletion of data associated with Clawdified, use the contact options on clawdified.com and include the name of the connected business, the email address used with Clawdified, and the platform connection you want removed.'],
      ['Meta/Facebook data deletion', 'If your request relates to Facebook, Instagram, or Meta Business data, include your Facebook user ID if available, the connected Page or Business name, and the Clawdified workflow or app connection you want deleted. You can also remove Clawdified access directly from your Facebook or Meta account settings.'],
      ['What we delete', 'We will delete or de-identify stored data that is no longer needed for the requested service, including authorized integration records, cached platform data, workflow notes, and related operational records where legally and technically possible.'],
      ['What may be retained', 'We may retain limited records required for security, fraud prevention, legal compliance, billing, dispute resolution, backups, or platform audit obligations. Retained records are limited to what is necessary for those purposes.'],
      ['Timing', 'Deletion requests are reviewed as soon as reasonably possible. We may need to verify that the requester is authorized to act for the connected account or business before deleting data.'],
      ['Status updates', 'If you request deletion, Clawdified will confirm receipt and provide a completion or follow-up status using the contact route you provide.'],
    ],
  },
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLegalPage(page) {
  const sections = page.sections.map(([heading, body]) => `
    <section class="legal-section">
      <h2>${escapeHtml(heading)}</h2>
      <p>${escapeHtml(body)}</p>
    </section>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(page.title)}</title>
<meta name="description" content="${escapeHtml(page.description)}">
<link rel="canonical" href="https://clawdified.com/${escapeHtml(page.slug)}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Clawdified">
<meta property="og:title" content="${escapeHtml(page.title)}">
<meta property="og:description" content="${escapeHtml(page.description)}">
<meta property="og:url" content="https://clawdified.com/${escapeHtml(page.slug)}">
<style>
  :root{color-scheme:dark;--bg:#0f0e0a;--panel:#17140e;--ink:#ece7dc;--muted:rgba(236,231,220,.68);--line:rgba(236,231,220,.12);--hi:#d48553;--sans:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--serif:Georgia,serif}
  *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 0%,rgba(212,133,83,.14),transparent 34rem),var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.6}a{color:inherit}.wrap{max-width:920px;margin:0 auto;padding:48px 22px 72px}.top{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:64px}.brand{font-weight:700;text-decoration:none;letter-spacing:.01em}.home{color:var(--muted);text-decoration:none;font-size:14px}.eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--hi);font-weight:700}.hero{border:1px solid var(--line);border-radius:24px;background:rgba(23,20,14,.78);padding:34px;box-shadow:0 24px 80px rgba(0,0,0,.24)}h1{font-family:var(--serif);font-size:clamp(38px,7vw,68px);line-height:.96;margin:12px 0 18px;font-weight:500}p{color:var(--muted);font-size:17px;margin:0}.updated{margin-top:18px;color:rgba(236,231,220,.5);font-size:14px}.legal-section{padding:28px 0;border-bottom:1px solid var(--line)}.legal-section h2{font-size:20px;margin:0 0 10px}.footer{margin-top:42px;color:rgba(236,231,220,.52);font-size:14px}@media(max-width:640px){.top{align-items:flex-start;flex-direction:column;margin-bottom:38px}.hero{padding:24px}.wrap{padding-top:30px}}
</style>
</head>
<body>
  <main class="wrap">
    <nav class="top" aria-label="Legal page navigation">
      <a class="brand" href="/">Clawdified</a>
      <a class="home" href="/">Back to clawdified.com</a>
    </nav>
    <header class="hero">
      <div class="eyebrow">${escapeHtml(page.eyebrow)}</div>
      <h1>${escapeHtml(page.eyebrow)}</h1>
      <p>${escapeHtml(page.description)}</p>
      <div class="updated">Last updated: ${escapeHtml(page.updated)}</div>
    </header>
    ${sections}
    <p class="footer">Clawdified · Knoxville, Tennessee · https://clawdified.com</p>
  </main>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request } = context;
  const accept = request.headers.get('Accept') || '';
  const url = new URL(request.url);

  // www -> apex 301 redirect
  if (url.hostname === 'www.clawdified.com') {
    return Response.redirect(`https://clawdified.com${url.pathname}${url.search}`, 301);
  }

  const legalPage = LEGAL_ROUTES[url.pathname];
  if (legalPage) {
    return new Response(renderLegalPage(legalPage), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  // Markdown negotiation for homepage
  if (url.pathname === '/' && accept.includes('text/markdown')) {
    const markdown = `# Clawdified — AI That Works For You

Custom AI agents that automate real business workflows. Based in Knoxville, Tennessee.

## Services

- **AI Agent Development** — Custom AI agents tailored to your business processes
- **Automated Customer Communication** — AI-powered responses across SMS, email, and social media
- **Review & Reputation Management** — Automated review solicitation and response
- **SEO Automation** — AI-driven content generation and search optimization
- **Business Process Automation** — Streamline repetitive operational tasks with AI

## How It Works

1. **Discovery** — We audit your current workflows and identify automation opportunities
2. **Build** — We develop custom AI agents tailored to your specific needs
3. **Deploy** — Your agents go live, handling tasks autonomously
4. **Optimize** — Continuous monitoring and improvement of agent performance

## Contact

- Website: [clawdified.com](https://clawdified.com)
- Location: Knoxville, Tennessee
`;
    return new Response(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'x-markdown-tokens': String(markdown.split(/\s+/).length),
      },
    });
  }

  // SEO route handling — head-only changes, zero visual difference
  const route = ROUTES[url.pathname];
  if (route) {
    const response = await context.next();
    let html = await response.text();

    // Replace title (browser tab + Google results only)
    html = html.replace(/<title>.*?<\/title>/, `<title>${route.title}</title>`);

    // Replace meta description (Google results only)
    html = html.replace(
      /<meta name="description" content="[^"]*"/,
      `<meta name="description" content="${route.description}"`
    );

    // Self-canonical (tells Google this is its own page)
    html = html.replace(
      /<link rel="canonical" href="[^"]*"/,
      `<link rel="canonical" href="https://clawdified.com${url.pathname}"`
    );

    // OG tags (link preview only)
    html = html.replace(
      /<meta property="og:title" content="[^"]*"/,
      `<meta property="og:title" content="${route.title}"`
    );
    html = html.replace(
      /<meta property="og:description" content="[^"]*"/,
      `<meta property="og:description" content="${route.description}"`
    );
    html = html.replace(
      /<meta property="og:url" content="[^"]*"/,
      `<meta property="og:url" content="https://clawdified.com${url.pathname}"`
    );

    // Twitter tags (link preview only)
    html = html.replace(
      /<meta name="twitter:title" content="[^"]*"/,
      `<meta name="twitter:title" content="${route.title}"`
    );
    html = html.replace(
      /<meta name="twitter:description" content="[^"]*"/,
      `<meta name="twitter:description" content="${route.description}"`
    );

    const headers = new Headers(response.headers);
    return new Response(html, { status: 200, headers });
  }

  return context.next();
}
