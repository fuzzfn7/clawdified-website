const ROUTES = {
  '/ai-agent-knoxville-tn': {
    title: 'AI Agent Services in Knoxville, TN | Clawdified',
    description: 'Looking for AI agent services in Knoxville? Clawdified builds custom AI agents that automate customer communication, lead follow-up, and daily operations for local businesses.',
    h1: 'AI Agent Services in Knoxville, Tennessee',
    intro: 'Knoxville businesses are discovering what AI agents can actually do — not chatbots that frustrate customers, but intelligent agents that learn your workflows and execute them autonomously. Clawdified builds these agents from scratch, tailored to how your business operates. Whether you need an agent that handles inbound leads at 2 AM, follows up with prospects who went cold, or manages your online reputation across every platform — we build it, deploy it, and keep it running.',
    detail: 'Our AI agents integrate directly with the tools you already use — Gmail, HubSpot, Slack, Google Business Profile, Facebook, and thousands more. They don\'t replace your team. They handle the repetitive, time-consuming tasks that keep your team from doing their best work. Every agent we build is custom to your business, your industry, and your specific workflows.',
  },
  '/ai-agent-agency-knoxville-tn': {
    title: 'AI Agent Agency in Knoxville, TN | Clawdified',
    description: 'Clawdified is Knoxville\'s AI agent agency. We design, build, and deploy custom AI agents for small businesses — from review management to SEO automation.',
    h1: 'Knoxville\'s AI Agent Agency',
    intro: 'Most AI agencies sell you a platform and wish you luck. Clawdified is different — we\'re an AI agent agency that builds custom automation for Knoxville businesses from the ground up. No templates, no cookie-cutter chatbots. We sit down with you, map your workflows, identify what\'s eating your time, and build AI agents that handle it.',
    detail: 'As a dedicated AI agent agency serving Knoxville and East Tennessee, we specialize in deploying agents that handle real business work: automated customer communication across SMS, email, and social media; review management that responds to every review the same night; SEO content engines that keep your search presence growing; and operational agents that handle the daily tasks your team shouldn\'t have to think about.',
  },
  '/small-business-ai-agent-knoxville-tn': {
    title: 'Small Business AI Agents in Knoxville, TN | Clawdified',
    description: 'AI agents built specifically for small businesses in Knoxville, TN. Automate customer responses, manage reviews, and optimize operations without hiring more staff.',
    h1: 'AI Agents Built for Small Businesses in Knoxville',
    intro: 'You don\'t need an enterprise AI platform. You need an agent that does the specific thing that\'s costing you time and money right now. Clawdified builds AI agents sized for small businesses in Knoxville — affordable, focused, and built around the way you actually work. No six-month implementation. No IT department required.',
    detail: 'Small businesses in Knoxville face a specific challenge: you need to compete with companies that have bigger teams, but you can\'t afford to hire for every role. AI agents close that gap. A single agent can handle your review responses, follow up with every lead, post to your social channels, and manage your customer communications — all running 24/7 for a flat monthly cost that\'s less than a part-time hire.',
  },
  '/ai-automation-agency-knoxville-tn': {
    title: 'AI Automation Agency in Knoxville, TN | Clawdified',
    description: 'Knoxville\'s AI automation agency. Intelligent automation that handles customer communication, reputation management, and business operations around the clock.',
    h1: 'AI Automation Agency — Knoxville, Tennessee',
    intro: 'Automation isn\'t new. What\'s new is automation that thinks. Clawdified is an AI automation agency in Knoxville that builds agents powered by the latest AI models — they don\'t just follow scripts, they understand context, make decisions, and handle situations that would normally require a human. That\'s the difference between old-school automation and what we build.',
    detail: 'Traditional automation breaks when something unexpected happens. AI-powered automation adapts. Our agents handle nuanced customer conversations, craft personalized responses to reviews, generate SEO content that actually ranks, and coordinate across your tools without rigid if-then rules. We deploy these for businesses across Knoxville and East Tennessee, with flat monthly pricing and no long-term contracts.',
  },
  '/business-automation-knoxville-tn': {
    title: 'Business Automation Services in Knoxville, TN | Clawdified',
    description: 'Automate your Knoxville business with custom AI agents. From answering customer inquiries to managing online reviews — Clawdified handles the work you shouldn\'t have to.',
    h1: 'Business Automation for Knoxville Companies',
    intro: 'Every hour your team spends on repetitive tasks is an hour they\'re not spending on growth. Clawdified provides business automation services in Knoxville that go beyond simple workflows — we deploy AI agents that handle customer communication, reputation management, lead follow-up, and operational tasks with the judgment and nuance that used to require a dedicated employee.',
    detail: 'Our business automation solutions are built for Knoxville companies that are ready to scale without scaling headcount. Whether you\'re in home services, professional services, healthcare, or retail — we build agents that understand your industry, speak your customers\' language, and execute your processes exactly the way you want them done. Setup takes days, not months.',
  },
};

export async function onRequest(context) {
  const { request } = context;
  const accept = request.headers.get('Accept') || '';
  const url = new URL(request.url);

  // P0: www -> apex 301 redirect
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

  // SEO route handling — unique content per route
  const route = ROUTES[url.pathname];
  if (route) {
    const response = await context.next();
    let html = await response.text();

    // Replace title
    html = html.replace(
      /<title>.*?<\/title>/,
      `<title>${route.title}</title>`
    );

    // Replace meta description
    html = html.replace(
      /<meta name="description" content="[^"]*"/,
      `<meta name="description" content="${route.description}"`
    );

    // Replace canonical to self
    html = html.replace(
      /<link rel="canonical" href="[^"]*"/,
      `<link rel="canonical" href="https://clawdified.com${url.pathname}"`
    );

    // Replace OG tags
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

    // Replace Twitter tags
    html = html.replace(
      /<meta name="twitter:title" content="[^"]*"/,
      `<meta name="twitter:title" content="${route.title}"`
    );
    html = html.replace(
      /<meta name="twitter:description" content="[^"]*"/,
      `<meta name="twitter:description" content="${route.description}"`
    );

    // Replace H1 — inject route-specific heading
    html = html.replace(
      /<h1>AI that <span class="hw-wrap">works<span class="hw-dots"[^>]*><span>\.<\/span><span>\.<\/span><span>\.<\/span><\/span><\/span><br><span class="hw-phrase" id="hw-phrase">for your business\.<\/span><\/h1>/,
      `<h1>${route.h1}</h1>`
    );

    // Replace hero subtitle with route-specific intro
    html = html.replace(
      /<p class="hero-sub">We learn how your business runs[^<]*<\/p>/,
      `<p class="hero-sub">${route.intro}</p>`
    );

    // Inject route-specific detail section after the hero
    const detailSection = `
<section style="padding:60px var(--s-page);max-width:780px;margin:0 auto;">
  <p style="font-size:16px;line-height:1.75;color:var(--muted);">${route.detail}</p>
</section>`;
    html = html.replace('</section>\n\n\n\n\n<!-- WHAT IT DOES', `</section>${detailSection}\n\n\n<!-- WHAT IT DOES`);

    // Update JSON-LD WebPage entry for this route
    html = html.replace(
      '"url": "https://clawdified.com",\n      "name": "Clawdified | AI Agents for Small Business — Knoxville, TN"',
      `"url": "https://clawdified.com${url.pathname}",\n      "name": "${route.title}"`
    );
    html = html.replace(
      '"description": "Custom AI agents that automate customer communication, review management, SEO, and daily operations for small businesses."',
      `"description": "${route.description}"`
    );

    const headers = new Headers(response.headers);
    return new Response(html, { status: 200, headers });
  }

  return context.next();
}
