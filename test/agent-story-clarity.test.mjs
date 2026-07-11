import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const agentStart = html.indexOf('<section class="agent-story"');
const agentEnd = html.indexOf('<footer class="case-close workflow-footer"', agentStart);
const agent = html.slice(agentStart, agentEnd);

test('agent story plainly says the agent does the preparation work through finished drafts', () => {
  assert.ok(agentStart >= 0 && agentEnd > agentStart);
  assert.match(agent, /Now let the agent do the proposal work\./);
  assert.match(agent, /It gathers the job information for him\./);
  assert.match(agent, /Then it builds the proposal and prepares the customer email\./);
  assert.match(agent, /The agent carries the job all the way to finished drafts, stopping only when something needs his decision\./);
  assert.match(agent, /He reviews the finished work, sends it, and gets 9\+ hours back\./);
  assert.match(agent, /Instead of preparing everything himself, he checks the completed proposal and email\. About ten hours of work becomes less than one hour of review\./);
  assert.doesNotMatch(agent, /prepares the work and holds the judgment|reviews finished drafts—not five scattered tools|Nothing important disappears|owner-ready example/i);
});

test('agent output labels show finished proposal and email ready for the contractor', () => {
  assert.match(agent, /Manual preparation <b>~10h \/ week<\/b>/);
  assert.match(agent, /Review \+ send <b id="reviewTime">&lt;1h \/ week<\/b>/);
  assert.match(agent, /<div class="map-heading">Job information<\/div>/);
  assert.match(agent, /<div class="map-heading">Finished work, ready to review<\/div>/);
  assert.match(agent, /<span>Customer email<\/span><strong>Prepared · ready to send<\/strong>/);
  assert.match(agent, /<span>Final check before sending<\/span><strong id="ownerStatusCinematic">Proposal and email are ready\. One pricing decision is highlighted\.<\/strong>/);
  assert.doesNotMatch(agent, /Attached draft · not sent|Same five sources|Awaiting one pricing decision/);
});

test('time back is stated as an explicit before-after equation in the final scene', () => {
  assert.match(agent, /class="time-back-equation">~10h preparation <i>→<\/i> &lt;1h review<\/small>/);
  assert.match(agent, /<strong>9\+ hours back every week<\/strong>/);
  assert.match(agent, /He reviews the finished proposal and email, then sends them\./);
  assert.match(html, /\/\* Agent finished-work clarity \*\//);
  assert.match(html, /data-agent-step="3"[^\n]*\.agent-scene-head span:last-child/);
  assert.match(html, /data-agent-step="3"[^\n]*\.field-return/);
});
