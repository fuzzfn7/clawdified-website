const PRIMARY_LOCAL_PATH = '/ai-agent-agency-knoxville-tn';
const RETIRED_PUBLIC_PATHS = new Set([
  '/assets/wesley-taylor-founder-clawdified.jpg',
]);
const LEGACY_LOCAL_PATHS = new Set([
  '/ai-agent-knoxville-tn',
  '/small-business-ai-agent-knoxville-tn',
  '/ai-automation-agency-knoxville-tn',
  '/business-automation-knoxville-tn',
]);

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

function renderKnoxvillePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Custom AI Agents in Knoxville, TN | Clawdified</title>
<meta name="description" content="Clawdified builds custom AI agents around the work costing your business time. Based in Knoxville and serving clients remotely across the United States.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://clawdified.com/ai-agent-agency-knoxville-tn">
<link rel="icon" type="image/png" sizes="64x64" href="/assets/clawdified-favicon-heritage-20260711.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Clawdified">
<meta property="og:title" content="Custom AI Agents in Knoxville, TN | Clawdified">
<meta property="og:description" content="Clawdified builds custom AI agents around the work costing your business time. Based in Knoxville and serving clients remotely across the United States.">
<meta property="og:url" content="https://clawdified.com/ai-agent-agency-knoxville-tn">
<meta property="og:image" content="https://clawdified.com/clawdified-icon-512.png">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Service","@id":"https://clawdified.com/ai-agent-agency-knoxville-tn#service","name":"Custom AI Agents in Knoxville, Tennessee","serviceType":"Custom AI agent design and implementation","description":"Clawdified builds custom AI agents around each client's work, systems, rules, exceptions, and approval points.","provider":{"@id":"https://clawdified.com/#organization"},"areaServed":[{"@type":"City","name":"Knoxville"},{"@type":"Country","name":"United States"}],"url":"https://clawdified.com/ai-agent-agency-knoxville-tn"}</script>
<style>
  :root{color-scheme:light;--ink:#26211c;--muted:#756d64;--line:rgba(38,33,28,.13);--paper:#fff;--warm:#f7f3ed;--copper:#b8663f;--sans:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--serif:Georgia,serif}
  *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 78% 4%,rgba(212,153,105,.18),transparent 30rem),var(--paper);color:var(--ink);font-family:var(--sans);line-height:1.6}a{color:inherit}.wrap{width:min(1080px,calc(100% - 44px));margin:auto}.nav{height:82px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:10px;text-decoration:none}.brand img:first-child{width:28px;height:28px}.brand img:last-child{width:119px;height:16px}.nav-links{display:flex;gap:18px;align-items:center}.nav-links a{text-decoration:none;font-size:14px}.button{padding:11px 16px;border-radius:11px;background:var(--ink);color:#fff}.hero{padding:118px 0 104px}.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--copper);font-weight:750}.hero h1{max-width:900px;margin:18px 0 24px;font:500 clamp(50px,8vw,92px)/.96 var(--serif);letter-spacing:-.045em}.hero p{max-width:720px;margin:0;color:var(--muted);font-size:clamp(19px,2vw,24px)}.grid{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--line);border-bottom:1px solid var(--line)}.grid article{padding:34px;border-left:1px solid var(--line)}.grid article:first-child{border-left:0}.grid span{font-size:11px;color:var(--copper);font-weight:750}.grid h2{margin:18px 0 10px;font-size:25px;line-height:1.1}.grid p{margin:0;color:var(--muted)}.statement{padding:104px 0}.statement h2{max-width:870px;margin:0;font:500 clamp(42px,6vw,72px)/1 var(--serif);letter-spacing:-.035em}.statement p{max-width:720px;margin:25px 0 0;color:var(--muted);font-size:19px}.cta{padding:58px 0 72px;background:var(--warm)}.cta .wrap{display:flex;align-items:center;justify-content:space-between;gap:25px}.cta h2{margin:0;font-size:32px}.cta p{margin:7px 0 0;color:var(--muted)}.footer{padding:30px 0;color:var(--muted);font-size:13px}.footer .wrap{display:flex;justify-content:space-between;gap:20px}@media(max-width:760px){.nav-links a:first-child{display:none}.hero{padding:82px 0 72px}.grid{grid-template-columns:1fr}.grid article{border-left:0;border-top:1px solid var(--line)}.grid article:first-child{border-top:0}.cta .wrap,.footer .wrap{align-items:flex-start;flex-direction:column}}
</style>
</head>
<body>
  <header class="nav wrap">
    <a class="brand" href="/" aria-label="Clawdified home"><img src="/assets/clawdified-claw-transparent.png" alt=""><img src="/assets/clawdified-wordmark-nav-119x16.png" srcset="/assets/clawdified-wordmark-nav-238x32.png 2x, /assets/clawdified-wordmark-nav-357x48.png 3x" width="119" height="16" alt=""></a>
    <nav class="nav-links" aria-label="Primary"><a href="/about/">About</a><a class="button" href="https://cal.com/intro-clawdified/30min">Start a project</a></nav>
  </header>
  <main>
    <section class="hero wrap">
      <div class="eyebrow">Clawdified · Knoxville, Tennessee</div>
      <h1>Custom AI agents in Knoxville, Tennessee</h1>
      <p>Clawdified builds custom AI agents around the work costing your business time. Every build follows the way your business already works.</p>
    </section>
    <section class="grid wrap" aria-label="How Clawdified builds">
      <article><span>01</span><h2>Start with the work.</h2><p>Every build starts with the work itself: what begins it, where the information lives, which rules matter, and what finished means.</p></article>
      <article><span>02</span><h2>Build around the business.</h2><p>The agent takes shape around the client's systems, exceptions, handoffs, and approval points rather than a fixed template.</p></article>
      <article><span>03</span><h2>Keep the right control.</h2><p>The repeatable work moves through the agent while human judgment stays wherever the business needs it.</p></article>
    </section>
    <section class="statement wrap">
      <h2>Based in Knoxville. Built for the way your work gets done.</h2>
      <p>Knoxville is home, and Clawdified works with businesses locally while serving clients remotely across the United States. There is no fixed menu of agents. The workflow defines the build.</p>
    </section>
    <section class="cta"><div class="wrap"><div><h2>Show us the work stealing your time.</h2><p>We will determine whether a custom AI agent can give those hours back.</p></div><a class="button" href="https://cal.com/intro-clawdified/30min">Book a call</a></div></section>
  </main>
  <footer class="footer"><div class="wrap"><span>© 2026 Clawdified · Operated by Clawdified LLC</span><span><a href="/contact/">Contact</a> · <a href="https://www.linkedin.com/company/clawdified/">LinkedIn</a></span></div></footer>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request } = context;
  const accept = request.headers.get('Accept') || '';
  const url = new URL(request.url);
  const path = url.pathname.length > 1 && url.pathname.endsWith('/')
    ? url.pathname.slice(0, -1)
    : url.pathname;

  if (RETIRED_PUBLIC_PATHS.has(url.pathname)) {
    return new Response(null, {
      status: 410,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Robots-Tag': 'noindex, nofollow, noimageindex',
      },
    });
  }

  if (LEGACY_LOCAL_PATHS.has(path)) {
    return Response.redirect(`https://clawdified.com${PRIMARY_LOCAL_PATH}${url.search}`, 301);
  }

  const legalPage = LEGAL_ROUTES[path];
  if (legalPage && (url.pathname !== path || url.hostname === 'www.clawdified.com')) {
    return Response.redirect(`https://clawdified.com${path}${url.search}`, 301);
  }

  if (path === PRIMARY_LOCAL_PATH && url.pathname !== PRIMARY_LOCAL_PATH) {
    return Response.redirect(`https://clawdified.com${PRIMARY_LOCAL_PATH}${url.search}`, 301);
  }

  // www -> apex 301 redirect after route-specific canonicalization.
  if (url.hostname === 'www.clawdified.com') {
    return Response.redirect(`https://clawdified.com${url.pathname}${url.search}`, 301);
  }

  if (path === PRIMARY_LOCAL_PATH) {
    return new Response(renderKnoxvillePage(), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

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
    const markdown = `# Clawdified — Custom AI Agents Built Around Your Work

Clawdified designs and builds custom AI agents around each client's work, tools, rules, exceptions, and approvals. Every build is custom.

## What Clawdified Builds

There is no fixed menu of agents or supported workflows. Clawdified starts with the work costing a business time and designs an agent around how that work actually gets done.

Any workflow shown on this site is an example, not a packaged offer or a limit on what Clawdified builds.

## How a Custom Build Works

1. **Understand the work** — Map the workflow, systems, information, rules, exceptions, and approval points
2. **Design around the business** — Shape the agent around the client's existing tools and operating process
3. **Build and verify** — Test the agent against the agreed workflow and expected outcomes
4. **Operate with control** — Keep human review or approval wherever the business requires it

## Location and Service Area

Knoxville, Tennessee is our home. Clawdified works with clients remotely across the United States.

## Contact

- Website: [clawdified.com](https://clawdified.com)
`;
    return new Response(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'x-markdown-tokens': String(markdown.split(/\s+/).length),
      },
    });
  }

  return context.next();
}
