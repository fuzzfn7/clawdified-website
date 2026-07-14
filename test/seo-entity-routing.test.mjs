import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { onRequest } from '../functions/_middleware.js';

const rootUrl = new URL('../', import.meta.url);
const read = relativePath => {
  const url = new URL(relativePath, rootUrl);
  return existsSync(url) ? readFileSync(url, 'utf8') : '';
};

const homepage = read('index.html');
const readme = read('README.md');
const sitemap = read('sitemap.xml');
const robots = read('robots.txt');
const headers = read('_headers');
const businessSkill = read('.well-known/agent-skills/business-info/SKILL.md');
const skillIndex = read('.well-known/agent-skills/index.json');
const llms = read('llms.txt');
const llmsFull = read('llms-full.txt');
const notFound = read('404.html');
const agents = read('agents/index.html');
const leadExample = read('agents/lead-growth/index.html');
const seoExample = read('agents/seo-competitor/index.html');
const redirects = read('_redirects');
const middlewareSource = read('functions/_middleware.js');
const utilityShells = [
  'connect/client/index.html',
  'connect/gmail/index.html',
  'connect/hubspot/index.html',
  'connect/slack/index.html',
  'connect/social/index.html',
  'admin/connections/index.html',
];

async function middlewareRequest(path, { accept = 'text/html', hostname = 'clawdified.com' } = {}) {
  return onRequest({
    request: new Request(`https://${hostname}${path}`, {
      headers: { Accept: accept },
    }),
    next: async () => new Response(homepage, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }),
  });
}

const survivor = '/ai-agent-agency-knoxville-tn';
const retiredFounderImage = '/assets/wesley-taylor-founder-clawdified.jpg';
const retiredEntityRoutes = ['/about', '/about/', '/contact', '/contact/'];
const legacyLocalRoutes = [
  '/ai-agent-knoxville-tn',
  '/small-business-ai-agent-knoxville-tn',
  '/ai-automation-agency-knoxville-tn',
  '/business-automation-knoxville-tn',
];

const forbiddenCatalogTerms = /lead follow-up|review management|SEO automation|customer communication|customer responses|reputation management/i;

test('retired founder image is gone before static asset lookup', async () => {
  const response = await middlewareRequest(retiredFounderImage);
  assert.equal(response.status, 410);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noimageindex');
});

test('retired About and Contact routes are permanently gone and undiscoverable', async () => {
  assert.equal(existsSync(new URL('about', rootUrl)), false);
  assert.equal(existsSync(new URL('contact', rootUrl)), false);

  for (const path of retiredEntityRoutes) {
    const response = await middlewareRequest(`${path}?source=retired`);
    assert.equal(response.status, 410, path);
    assert.equal(await response.text(), '', path);
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0', path);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', path);
  }

  for (const [name, source] of [
    ['homepage', homepage],
    ['404 page', notFound],
    ['Knoxville page source', middlewareSource],
    ['llms.txt', llms],
    ['llms-full.txt', llmsFull],
    ['sitemap', sitemap],
  ]) {
    assert.doesNotMatch(source, /href="\/(?:about|contact)\/"|https:\/\/clawdified\.com\/(?:about|contact)\//, name);
  }
  assert.doesNotMatch(homepage, />About Clawdified<|>Contact page</);
});

test('four duplicate Knoxville routes permanently redirect to one established survivor', async () => {
  for (const path of legacyLocalRoutes) {
    const response = await middlewareRequest(`${path}?source=legacy`);
    assert.equal(response.status, 301, path);
    assert.equal(response.headers.get('location'), `https://clawdified.com${survivor}?source=legacy`, path);

    const wwwResponse = await middlewareRequest(`${path}?source=www`, { hostname: 'www.clawdified.com' });
    assert.equal(wwwResponse.status, 301, `www ${path}`);
    assert.equal(wwwResponse.headers.get('location'), `https://clawdified.com${survivor}?source=www`, `www ${path}`);
  }
});

test('trailing-slash legal routes redirect to their no-slash canonicals', async () => {
  for (const path of ['/privacy', '/terms', '/data-deletion']) {
    const response = await middlewareRequest(`${path}/?source=slash`);
    assert.equal(response.status, 301, path);
    assert.equal(response.headers.get('location'), `https://clawdified.com${path}?source=slash`, path);
  }
});

test('surviving Knoxville route is a unique broad custom-agent page', async () => {
  const response = await middlewareRequest(survivor);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<title>Custom AI Agents in Knoxville, TN \| Clawdified<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/clawdified\.com\/ai-agent-agency-knoxville-tn">/);
  assert.match(html, /<h1>Custom AI agents in Knoxville, Tennessee<\/h1>/);
  assert.match(html, /srcset="\/assets\/clawdified-wordmark-nav-238x32\.png 2x, \/assets\/clawdified-wordmark-nav-357x48\.png 3x"/);
  assert.match(html, /Every build starts with the work itself/);
  assert.match(html, /serving clients remotely across the United States/);
  assert.doesNotMatch(html, forbiddenCatalogTerms);
  assert.doesNotMatch(html, /proposal generation|report automation|lead generation/i);
});

test('homepage examples are excluded from generated search snippets', () => {
  for (const marker of [
    'class="build-gateway"',
    'class="manual-story"',
    'class="agent-story"',
    'class="legacy-content"',
  ]) {
    const start = homepage.indexOf(marker);
    assert.ok(start >= 0, `${marker} should exist`);
    const tagStart = homepage.lastIndexOf('<', start);
    const tagEnd = homepage.indexOf('>', start);
    assert.match(homepage.slice(tagStart, tagEnd + 1), /data-nosnippet/);
  }
});

test('agent showroom remains public proof without becoming an indexable catalog', () => {
  const head = agents.slice(0, agents.indexOf('</head>'));
  assert.match(head, /<meta name="robots" content="noindex, follow">/);
  assert.match(head, /<title>Clawdified Agent Examples \| Custom AI Agent Workspaces<\/title>/);
  assert.match(head, /Examples of custom AI agent workspaces built around different business workflows\./);
  assert.doesNotMatch(head, /lead generation|SEO competitor|local SEO|Lead Growth System|SEO & Competitor Intelligence/i);
  assert.doesNotMatch(head, /"@type": "ItemList"/);
  assert.match(headers, /\/agents\/\s+X-Robots-Tag: noindex, follow/);
  assert.doesNotMatch(sitemap, /<loc>https:\/\/clawdified\.com\/agents\/<\/loc>/);
  assert.match(agents, /These are example workspaces, not a service menu or packaged offer\./);
  assert.doesNotMatch(agents, /not the full service menu/i);

  for (const marker of ['class="hero-proof"', 'class="sec systems-menu"', 'class="sec custom-builds-sec"', 'class="sec demo-section"']) {
    const start = agents.indexOf(marker);
    assert.ok(start >= 0, `${marker} should exist`);
    const tagStart = agents.lastIndexOf('<', start);
    const tagEnd = agents.indexOf('>', start);
    assert.match(agents.slice(tagStart, tagEnd + 1), /data-nosnippet/);
  }
});

test('named agent demos remain public proof without becoming indexable service pages', () => {
  assert.match(leadExample, /<meta name="robots" content="noindex, follow"/);
  assert.match(seoExample, /<meta name="robots" content="noindex, follow"/);
  assert.doesNotMatch(sitemap, /\/agents\/lead-growth\//);
  assert.doesNotMatch(sitemap, /\/agents\/seo-competitor\//);
  assert.match(headers, /\/agents\/lead-growth\/\s+X-Robots-Tag: noindex, follow/);
  assert.match(headers, /\/agents\/seo-competitor\/\s+X-Robots-Tag: noindex, follow/);
});

test('connector and admin utility shells cannot become indexable offerings', () => {
  for (const path of utilityShells) {
    assert.match(read(path), /<meta name="robots" content="noindex\s*,\s*nofollow"\s*\/?>/, path);
  }
  assert.match(headers, /\/connect\/\*\s+X-Robots-Tag: noindex, nofollow/);
  assert.match(headers, /\/admin\/\*\s+X-Robots-Tag: noindex, nofollow/);
  assert.doesNotMatch(redirects, /^https?:\/\//m);
});

test('README release identity matches the staged homepage bytes', () => {
  const digest = createHash('sha256').update(homepage).digest('hex');
  assert.ok(readme.includes('`index.html` SHA-256 `' + digest + '`'));
  assert.doesNotMatch(readme, /clawdified-wordmark-industrial-notch\.svg/);
  for (const asset of ['clawdified-wordmark-nav-119x16.png', 'clawdified-wordmark-nav-238x32.png', 'clawdified-wordmark-nav-357x48.png']) {
    assert.match(readme, new RegExp(asset.replaceAll('.', '\\.')));
  }
});

test('homepage keeps broad entity signals without a visible SEO paragraph or service catalog', () => {
  const body = homepage.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
  assert.doesNotMatch(body, /Clawdified builds custom AI agents around the way each business works\./);
  assert.doesNotMatch(body, /Based in Knoxville and serving clients remotely across the United States/);
  assert.match(homepage, /<meta name="description" content="Clawdified builds custom AI agents around your workflows, tools, rules, and approvals\./);
  assert.match(homepage, /"addressLocality":"Knoxville"/);
  assert.match(homepage, /Operated by Clawdified LLC/);
  assert.doesNotMatch(homepage, /href="\/company-brain\/"|href="\/agent-training\/"|<h3>Coming soon<\/h3>/);

  const schemaSource = homepage.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(schemaSource);
  const schema = JSON.parse(schemaSource);
  const organization = schema['@graph'].find(node => node['@type'] === 'Organization');
  assert.deepEqual(organization.sameAs, ['https://www.linkedin.com/company/clawdified/']);
  assert.doesNotMatch(JSON.stringify(schema), forbiddenCatalogTerms);
});

test('404 page keeps the responsive wordmark after retired-page links are removed', () => {
  const responsiveWordmark = /srcset="\/assets\/clawdified-wordmark-nav-238x32\.png 2x, \/assets\/clawdified-wordmark-nav-357x48\.png 3x"/;
  assert.match(notFound, responsiveWordmark);
});

test('real llms files and business skill state the broad custom-build position', () => {
  for (const [name, contents] of [
    ['llms.txt', llms],
    ['llms-full.txt', llmsFull],
    ['business skill', businessSkill],
  ]) {
    assert.match(contents, /custom AI agents/i, name);
    assert.match(contents, /no fixed (menu|catalog)/i, name);
    assert.match(contents, /examples? (?:shown )?(?:on the site )?(?:are|is) (?:an )?example/i, name);
    assert.doesNotMatch(contents, forbiddenCatalogTerms, name);
  }

  const index = JSON.parse(skillIndex);
  const frontmatter = businessSkill.match(/^---\n([\s\S]*?)\n---\n/)?.[1] || '';
  assert.match(frontmatter, /^name: business-info$/m);
  assert.match(frontmatter, /^description: Official Clawdified business identity and broad custom AI agent positioning\.$/m);
  assert.match(index.skills[0].description, /custom AI agents built around each client’s work/i);
  assert.match(index.skills[0].digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(index.skills[0].digest, `sha256:${createHash('sha256').update(businessSkill).digest('hex')}`);
  assert.match(headers, /\/llms\.txt\s+Content-Type: text\/plain; charset=utf-8/);
  assert.match(headers, /\/llms-full\.txt\s+Content-Type: text\/plain; charset=utf-8/);
});

test('sitemap keeps the broad Knoxville survivor and excludes retired entity pages', () => {
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.equal(locations.includes('https://clawdified.com/about/'), false);
  assert.equal(locations.includes('https://clawdified.com/contact/'), false);
  assert.ok(locations.includes(`https://clawdified.com${survivor}`));
  for (const path of legacyLocalRoutes) {
    assert.equal(locations.includes(`https://clawdified.com${path}`), false, path);
  }
  assert.match(sitemap, /<loc>https:\/\/clawdified\.com\/<\/loc>\s*<lastmod>2026-07-13<\/lastmod>/);
});

test('AI crawler policy allows retrieval/search while keeping training opt-out', () => {
  const universalGroup = robots.match(/User-agent: \*\s*([\s\S]*?)(?=\nUser-agent:)/)?.[1] || '';
  const cohereGroup = robots.match(/User-agent: cohere-ai\s*([\s\S]*?)(?=\nSitemap:|$)/)?.[1] || '';
  assert.match(universalGroup, /Content-Signal: ai-train=no, search=yes, ai-input=yes/);
  assert.doesNotMatch(cohereGroup, /Content-Signal:/);
  assert.match(robots, /User-agent: Google-Extended\s+Disallow: \//);
  assert.match(robots, /User-agent: OAI-SearchBot\s+Allow: \//);
  assert.match(robots, /User-agent: ChatGPT-User\s+Allow: \//);
  assert.match(robots, /User-agent: GPTBot\s+Disallow: \//);
  assert.match(robots, /User-agent: Claude-SearchBot\s+Allow: \//);
  assert.match(robots, /User-agent: Claude-User\s+Allow: \//);
  assert.match(robots, /User-agent: ClaudeBot\s+Disallow: \//);
  assert.match(robots, /Content-Signal: ai-train=no, search=yes, ai-input=yes/);
});

test('custom 404 page prevents Cloudflare Pages SPA-style soft 404 fallback', () => {
  assert.match(notFound, /<meta name="robots" content="noindex, follow">/);
  assert.match(notFound, /<title>Page Not Found \| Clawdified<\/title>/);
  assert.match(notFound, /<h1>That page does not exist\.<\/h1>/);
});
