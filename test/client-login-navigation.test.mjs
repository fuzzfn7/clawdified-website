import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pages = [
  { name: 'homepage', html: readFileSync(new URL('../index.html', import.meta.url), 'utf8') },
  { name: 'Company Brain', html: readFileSync(new URL('../company-brain/index.html', import.meta.url), 'utf8') },
  { name: 'Agent Training', html: readFileSync(new URL('../agent-training/index.html', import.meta.url), 'utf8') }
];
const homepage = pages[0].html;
const serviceCss = readFileSync(new URL('../assets/service-coming-soon.css', import.meta.url), 'utf8');

function headerOf(html) {
  const start = html.indexOf('<header class="nav"');
  const end = html.indexOf('</header>', start);
  return html.slice(start, end + '</header>'.length);
}

for (const page of pages) {
  test(`${page.name} navigation exposes the shared client portal beside the project CTA`, () => {
    const header = headerOf(page.html);
    assert.match(header, /<a class="client-login" href="https:\/\/app\.clawdified\.com">Client login<\/a>/);
    assert.match(header, /<a class="nav-cta"[^>]*>Start a project<\/a>/);
    assert.ok(header.indexOf('class="client-login"') < header.indexOf('class="nav-cta"'), 'Client login should sit immediately before the primary project CTA');
    assert.equal((header.match(/href="https:\/\/app\.clawdified\.com"/g) || []).length, 1);
  });
}

test('Client login remains visibly secondary and available at phone width', () => {
  assert.match(homepage, /\.nav \.client-login\{[^}]*color:#60584e/);
  assert.match(homepage, /@media\(max-width:1100px\)\{[\s\S]*?\.nav nav \.client-login\{display:inline-flex/);
  assert.match(serviceCss, /\.nav-actions\{display:flex;align-items:center/);
  assert.match(serviceCss, /\.client-login\{[^}]*color:#6f665c/);
  assert.match(serviceCss, /@media\(max-width:600px\)\{[\s\S]*?\.client-login\{/);
});
