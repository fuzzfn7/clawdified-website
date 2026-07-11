import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const connectors = [
  ['Gmail', 'connect/gmail/index.html'],
  ['HubSpot', 'connect/hubspot/index.html'],
  ['Slack', 'connect/slack/index.html'],
  ['Meta', 'connect/social/index.html'],
];

function connectorSource(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function connectButtonTag(html) {
  const tag = html.match(/<button\b[^>]*\bid=["']connectButton["'][^>]*>/i)?.[0];
  assert.ok(tag, 'connector page must include #connectButton');
  return tag;
}

function executableScript(html) {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1, 'connector page must have one executable inline script');
  return scripts[0][1].replace(/\bcheckHealth\(\);\s*$/, '');
}

async function runHealthCheck(relativePath, fetchImpl) {
  const html = connectorSource(relativePath);
  const classes = new Set();
  const button = {
    disabled: /\sdisabled(?:\s|=|>)/i.test(connectButtonTag(html)),
    addEventListener() {},
  };
  const statusLine = {
    textContent: 'Checking connector…',
    classList: {
      remove(name) { classes.delete(name); },
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
    },
  };
  const context = vm.createContext({
    document: {
      getElementById(id) {
        if (id === 'connectButton') return button;
        if (id === 'statusLine') return statusLine;
        throw new Error(`Unexpected element id: ${id}`);
      },
    },
    fetch: fetchImpl,
    URLSearchParams,
    window: { location: { search: '', href: '' } },
  });
  vm.runInContext(executableScript(html), context, { filename: relativePath });
  await context.checkHealth();
  return { button, statusLine, classes };
}

for (const [name, relativePath] of connectors) {
  test(`${name} OAuth stays disabled until health is confirmed`, () => {
    const html = connectorSource(relativePath);
    assert.match(connectButtonTag(html), /\sdisabled(?:\s|=|>)/i);
  });

  test(`${name} OAuth enables only after a healthy response`, async () => {
    const state = await runHealthCheck(relativePath, async () => ({
      ok: true,
      json: async () => ({ ok: true }),
    }));
    assert.equal(state.button.disabled, false);
    assert.equal(state.statusLine.textContent, '');
    assert.equal(state.classes.has('bad'), false);
  });

  for (const [scenario, fetchImpl] of [
    ['an unhealthy response', async () => ({ ok: true, json: async () => ({ ok: false }) })],
    ['a malformed response', async () => ({ ok: true, json: async () => ({}) })],
    ['a truthy string response', async () => ({ ok: true, json: async () => ({ ok: 'true' }) })],
    ['a truthy numeric response', async () => ({ ok: true, json: async () => ({ ok: 1 }) })],
    ['a non-success HTTP response', async () => ({ ok: false, json: async () => ({ ok: true }) })],
    ['an invalid JSON response', async () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } })],
    ['a failed request', async () => { throw new Error('network unavailable'); }],
  ]) {
    test(`${name} OAuth fails closed after ${scenario}`, async () => {
      const state = await runHealthCheck(relativePath, fetchImpl);
      assert.equal(state.button.disabled, true);
      assert.equal(state.statusLine.textContent, 'Connector unavailable');
      assert.equal(state.classes.has('bad'), true);
    });
  }
}
