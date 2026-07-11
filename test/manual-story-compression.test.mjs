import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manualStart = html.indexOf('<section class="manual-story"');
const agentStart = html.indexOf('<section class="agent-story"', manualStart);
const manual = html.slice(manualStart, agentStart);

test('manual proposal story is compressed into four decisive beats', () => {
  assert.ok(manualStart >= 0 && agentStart > manualStart);
  const copies = [...manual.matchAll(/<article class="manual-copy" data-manual-copy="(\d)"/g)];
  assert.equal(copies.length, 4);
  assert.deepEqual(copies.map(match => Number(match[1])), [0, 1, 2, 3]);

  const stepper = manual.match(/<div class="manual-stepper"[^>]*>(.*?)<\/div>/s)?.[1] ?? '';
  assert.equal((stepper.match(/<i(?: class="active")?><\/i>/g) ?? []).length, 4);

  assert.match(manual, /One contractor was losing ten hours every week preparing proposals\./);
  assert.match(manual, /Before he could build anything, he had to pull the whole job together\./);
  assert.match(manual, /Then he sat down and assembled the proposal by hand\./);
  assert.match(manual, /Ten hours at the desk\. Ten hours not in the field\./);
  assert.doesNotMatch(manual, /Each proposal started with a search through the field notes|Then he matched every proposal to the right site photos|He checked the template, rates, and approved terms again and again/);
});

test('four-beat scene visibly collects sources, builds the proposal, then prepares the email', () => {
  assert.equal((manual.match(/data-manual-source=/g) ?? []).length, 5);
  assert.match(manual, /class="manual-collection-route"/);
  assert.match(manual, /id="manualCollectionPath"/);
  assert.match(manual, /class="collection-pulse"/);
  assert.match(manual, /class="manual-source-bundle"/);
  assert.match(manual, /class="manual-output manual-proposal-output"/);
  assert.match(manual, /class="manual-email-output"/);
  assert.match(manual, /Proposal assembled/);
  assert.match(manual, /Customer email prepared/);
});

test('four-beat motion uses four progress states and a shorter scroll runway', () => {
  assert.match(html, /\/\* Four-beat manual proposal story \*\//);
  assert.match(html, /\.manual-story\{height:520vh\}/);
  assert.match(html, /@media\(max-width:600px\)\{\.manual-story\{height:500vh\}/);
  assert.match(html, /const manualBoundaries=\[0,0,6,9,10\]/);
  assert.match(html, /const manualTasks=\[\s*'The proposal steals time from the field',\s*'Pulling five scattered sources together',\s*'Building the proposal by hand',\s*'Preparing the email\. Ten hours gone\.'/s);
  assert.match(html, /const manualScaled=manualProgress\*4/);
  assert.match(html, /const manualStep=Math\.min\(3,Math\.floor\(manualScaled\)\)/);
  assert.match(html, /const tally=manualStep===3\?10:from\+\(to-from\)\*local/);
  assert.match(html, /data-manual-step="1"[^\n]*\.manual-collection-route/);
  assert.match(html, /data-manual-step="2"[^\n]*\.manual-proposal-output/);
  assert.match(html, /data-manual-step="3"[^\n]*\.manual-email-output/);
});
