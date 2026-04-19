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

export async function onRequest(context) {
  const { request } = context;
  const accept = request.headers.get('Accept') || '';
  const url = new URL(request.url);

  // www -> apex 301 redirect
  if (url.hostname === 'www.clawdified.com') {
    return Response.redirect(`https://clawdified.com${url.pathname}${url.search}`, 301);
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
