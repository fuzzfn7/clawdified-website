export async function onRequest(context) {
  const { request } = context;
  const accept = request.headers.get('Accept') || '';
  const url = new URL(request.url);

  // Only handle markdown negotiation for the homepage
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

  return context.next();
}
