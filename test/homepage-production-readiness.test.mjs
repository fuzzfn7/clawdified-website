import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const middleware = readFileSync(new URL('../functions/_middleware.js', import.meta.url), 'utf8');

test('homepage exposes one production indexing directive', () => {
  const robotTags = [...html.matchAll(/<meta name="robots" content="([^"]+)">/g)].map(match => match[1]);
  assert.deepEqual(robotTags, ['index, follow']);
  assert.doesNotMatch(html, /<meta name="robots" content="noindex">/);
});

test('homepage production identity has canonical and social image metadata', () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/clawdified\.com\/">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/clawdified\.com\/clawdified-icon-512\.png">/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/clawdified\.com\/clawdified-icon-512\.png">/);
  assert.match(html, /<link rel="manifest" href="\/site\.webmanifest">/);
});

test('homepage search copy positions every engagement as a custom build, not a fixed offer list', () => {
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1];

  assert.equal(title, 'Clawdified | Custom AI Agents Built Around Your Work');
  assert.equal(description, 'Clawdified builds custom AI agents around your workflows, tools, rules, and approvals. Every build is tailored to the work costing your business time.');
  assert.match(html, /<meta property="og:title" content="Clawdified \| Custom AI Agents Built Around Your Work">/);
  assert.match(html, /<meta property="og:description" content="Clawdified builds custom AI agents around your workflows, tools, rules, and approvals\. Every build is tailored to the work costing your business time\.">/);
  assert.match(html, /<h2 id="build-gateway-title">Now, let’s show you one example build\.<\/h2>/);
});

test('structured data keeps Knoxville as an address without narrowing the company to a local-only entity', () => {
  const schemaSource = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(schemaSource, 'homepage JSON-LD should exist');
  const schema = JSON.parse(schemaSource);
  const organization = schema['@graph'].find(node => node['@type'] === 'Organization');
  const service = schema['@graph'].find(node => node['@type'] === 'Service');

  assert.ok(organization);
  assert.ok(service);
  assert.equal(schema['@graph'].some(node => node['@type'] === 'LocalBusiness'), false);
  assert.equal(organization.address.addressLocality, 'Knoxville');
  assert.equal(organization.areaServed.name, 'United States');
  assert.equal(organization.founder['@id'], 'https://clawdified.com/about/#wesley-taylor');
  assert.equal(organization.image['@id'], 'https://clawdified.com/about/#founder-image');
  assert.match(organization.description, /Every build is custom; workflows shown on the site are examples, not packaged offers\./);
  assert.match(service.description, /Each agent is designed around the client’s work, systems, rules, and approval points; examples shown on the site are illustrative\./);
});

test('machine-readable homepage says examples are not packaged services or workflow limits', () => {
  const markdown = middleware.match(/const markdown = `([\s\S]*?)`;/)?.[1];
  assert.ok(markdown, 'homepage Markdown response should exist');
  assert.match(markdown, /There is no fixed menu of agents or supported workflows\./);
  assert.match(markdown, /Any workflow shown on this site is an example, not a packaged offer or a limit on what Clawdified builds\./);
  assert.match(markdown, /Knoxville, Tennessee is our home\. Clawdified works with clients remotely across the United States\./);
  assert.doesNotMatch(markdown, /## Services|Automated Customer Communication|Review & Reputation Management|SEO Automation/);
});
