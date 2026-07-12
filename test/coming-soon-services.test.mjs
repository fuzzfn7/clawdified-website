import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const homepageUrl = new URL('../index.html', import.meta.url);
const companyBrainUrl = new URL('../company-brain/index.html', import.meta.url);
const agentTrainingUrl = new URL('../agent-training/index.html', import.meta.url);
const sharedStyleUrl = new URL('../assets/service-coming-soon.css', import.meta.url);
const homepage = readFileSync(homepageUrl, 'utf8');
const companyBrain = existsSync(companyBrainUrl) ? readFileSync(companyBrainUrl, 'utf8') : '';
const agentTraining = existsSync(agentTrainingUrl) ? readFileSync(agentTrainingUrl, 'utf8') : '';
const sharedStyle = existsSync(sharedStyleUrl) ? readFileSync(sharedStyleUrl, 'utf8') : '';
const footerStart = homepage.indexOf('<footer class="case-close workflow-footer"');
const footerEnd = homepage.indexOf('</footer>', footerStart);
const footer = homepage.slice(footerStart, footerEnd + '</footer>'.length);

test('Company Brain and Agent Training have real coming-soon routes', () => {
  assert.ok(existsSync(companyBrainUrl), '/company-brain/ should exist');
  assert.ok(existsSync(agentTrainingUrl), '/agent-training/ should exist');
  assert.ok(existsSync(sharedStyleUrl), 'coming-soon pages should share the Clawdified visual system');
});

test('homepage footer gives future services a dedicated coming-soon column', () => {
  assert.match(footer, /<div class="future-services"><h3>Coming soon<\/h3>/);
  assert.match(footer, /<a href="\/company-brain\/">Company Brain<\/a>/);
  assert.match(footer, /<a href="\/agent-training\/">Agent Training<\/a>/);
  assert.match(homepage, /\.footer-links\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

for (const service of [
  { html: companyBrain, title: 'Company Brain', canonical: 'company-brain', peerHref: '/agent-training/' },
  { html: agentTraining, title: 'Agent Training', canonical: 'agent-training', peerHref: '/company-brain/' },
]) {
  test(`${service.title} is an intentionally sparse, non-indexed coming-soon page`, () => {
    assert.match(service.html, /<meta name="robots" content="noindex, follow">/);
    assert.match(service.html, new RegExp(`<link rel="canonical" href="https:\\/\\/clawdified\\.com\\/${service.canonical}\\/">`));
    assert.match(service.html, new RegExp(`<h1[^>]*>${service.title}<\\/h1>`));
    assert.match(service.html, /<p class="status">Coming soon\.<\/p>/);
    assert.match(service.html, /href="\/assets\/service-coming-soon\.css"/);
    assert.match(service.html, /src="\/assets\/clawdified-claw-transparent\.png"/);
    assert.match(service.html, /src="\/assets\/clawdified-wordmark-industrial-notch\.svg"/);
    assert.match(service.html, new RegExp(`href="${service.peerHref.replaceAll('/', '\\/')}"`));
    assert.doesNotMatch(service.html, /lorem ipsum|feature|pricing|package/i);
  });
}

test('shared coming-soon visual keeps the warm grid, inset nav, and responsive layout', () => {
  assert.match(sharedStyle, /CLAWDIFIED_SERVICE_COMING_SOON_20260711/);
  assert.match(sharedStyle, /background-image:linear-gradient\(rgba\(104,89,69,\.045\) 1px,transparent 1px\)/);
  assert.match(sharedStyle, /\.nav\{\s*position:fixed/);
  assert.match(sharedStyle, /@media\(max-width:600px\)/);
  assert.match(sharedStyle, /@media\(prefers-reduced-motion:reduce\)/);
});
