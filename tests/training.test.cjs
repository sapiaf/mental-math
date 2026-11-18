const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Exercise the actual inline core without requiring a browser or dependencies.
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('/* ---------- learning core');
const end = html.indexOf('/* ---------- database sync');
const core = vm.runInNewContext(html.slice(start, end) +
  '\n({parseFact,packFact,factStats,recordFact,reviewQueue,mergeFacts,DAY_MS})');
const { parseFact, packFact, factStats, recordFact, reviewQueue, mergeFacts, DAY_MS } = core;
const noon = Date.parse('2026-11-18T12:00:00Z');
let serial = 0;
const answer = (err = 0, ms = 900) => ({ ms, err });
function record(f, results, options = {}) {
  return recordFact(f, results, { now: noon, session: 'round-' + (++serial), ...options });
}

test('legacy facts preserve counts, response times and lifetime errors', () => {
  const f = parseFact('12|1000|800,900,1000|3');
  assert.equal(f.n, 12);
  assert.equal(f.err, 3);
  assert.equal(f.times.join(','), '800,900,1000');
  assert.equal(factStats(f).mastered, false);
  assert.equal(factStats(f).errors, 0); // Unknown historical dates are not invented.
  assert.equal(parseFact(packFact(f)).err, 3);
});

test('historical errors do not prevent mastery after evidence on two days', () => {
  const f = parseFact('12|1000|2400|9');
  record(f, [answer(), answer(), answer()], { verify: true });
  record(f, [answer(), answer()], { verify: true, now: noon + DAY_MS });
  assert.equal(factStats(f).mastered, true);
  assert.equal(f.err, 9);
  assert.equal(factStats(f).count, 5);
  assert.equal(factStats(f).days, 2);
});

test('a single fast answer or many answers on one day cannot grant mastery', () => {
  const f = parseFact('');
  record(f, [answer()], { verify: true });
  assert.equal(factStats(f).mastered, false);
  record(f, Array.from({ length: 50 }, () => answer()), { verify: true, now: noon + 60000 });
  assert.equal(factStats(f).mastered, false);
  assert.equal(f.checks.length, 2);
});

test('drills and aborted rounds cannot manufacture verification evidence', () => {
  const f = parseFact('');
  for (let d = 0; d < 3; d++) {
    record(f, Array.from({ length: 10 }, () => answer()), { now: noon + d * DAY_MS });
  }
  record(f, [answer()], { verify: true, partial: true });
  assert.equal(f.n, 31);
  assert.equal(f.checks.length, 0);
  assert.equal(factStats(f).mastered, false);
});

test('recent errors expire while lifetime errors remain in the backup', () => {
  const f = parseFact('');
  record(f, [answer(2)], { verify: true });
  assert.equal(factStats(f).errors, 2);
  for (let d = 1; d <= 5; d++) {
    record(f, [answer()], { verify: true, now: noon + d * DAY_MS });
  }
  assert.equal(factStats(f).errors, 0);
  assert.equal(factStats(f).mastered, true);
  assert.equal(parseFact(packFact(f)).err, 2);
});

test('a current error revokes previously confirmed mastery', () => {
  const f = parseFact('');
  record(f, [answer(), answer(), answer()], { verify: true });
  record(f, [answer(), answer()], { verify: true, now: noon + DAY_MS });
  assert.equal(factStats(f).mastered, true);
  record(f, [answer(1)], { now: noon + DAY_MS + 1000 });
  assert.equal(factStats(f).mastered, false);
});

test('review intervals advance only when a scheduled review is due', () => {
  const f = parseFact('');
  let now = noon;
  for (const days of [1, 3, 7, 14, 30, 30]) {
    record(f, [answer()], { now });
    assert.equal(f.review.days, days);
    assert.equal(f.review.due, now + days * DAY_MS);
    const due = f.review.due;
    record(f, Array.from({ length: 40 }, () => answer()), { now: now + 60000 });
    assert.equal(f.review.days, days);
    assert.equal(f.review.due, due);
    now = due;
  }
});

test('an early review on the due date neither postpones nor blocks the due review', () => {
  const f = parseFact('');
  record(f, [answer()]);
  const due = f.review.due;
  record(f, [answer()], { now: due - 1000 });
  assert.equal(f.review.due, due);
  record(f, [answer()], { now: due });
  assert.equal(f.review.days, 3);
});

test('slow responses and mistakes shorten the next review interval', () => {
  const f = parseFact('');
  record(f, [answer()]);
  record(f, [answer()], { now: f.review.due });
  assert.equal(f.review.days, 3);
  const now = f.review.due;
  record(f, [answer(0, 2500)], { now });
  assert.equal(f.review.days, 1);
  record(f, [answer(1)], { now: now + 1000 });
  assert.equal(f.review.days, 0);
  assert.equal(f.review.due, now + 1000 + 600000);
});

test('errors on an unanswered problem are saved and scheduled without a fake completion', () => {
  const f = parseFact('');
  record(f, [{ err: 2, completed: false }], { verify: true, partial: true });
  assert.equal(f.n, 0);
  assert.equal(f.times.length, 0);
  assert.equal(f.err, 2);
  assert.equal(f.checks.length, 0);
  assert.equal(reviewQueue({ k7x8: packFact(f) }, noon + 600000).length, 1);
});

test('aborting a successful round does not postpone an overdue review', () => {
  const f = parseFact('');
  record(f, [answer()]);
  const due = f.review.due;
  record(f, [answer()], { partial: true, now: due + 1000 });
  assert.equal(f.review.due, due);
  assert.equal(f.checks.length, 0);
});

test('review queue includes overdue legacy facts and excludes future or invalid entries', () => {
  const f = parseFact('');
  record(f, [answer(1)]);
  const queue = reviewQueue({
    k7x8: packFact(f),
    k2p3: '1|' + (noon - 3 * DAY_MS) + '|900|0',
    k3p4: '1|' + noon + '|900|0',
    broken: '1|0|900|0'
  }, noon + 600000);
  assert.equal(queue.map(x => x.key).join(','), 'k7x8,k2p3');
});

test('backup serialization retains recent errors, verification and review dates', () => {
  const f = parseFact('');
  record(f, [answer(), answer(1)], { verify: true });
  assert.equal(packFact(parseFact(packFact(f))), packFact(f));
});

test('merging backups retains evidence from both devices without duplicating sessions', () => {
  const a = parseFact(''), b = parseFact('');
  record(a, [answer(), answer(), answer()], { verify: true });
  record(b, [answer(), answer()], { verify: true, now: noon + DAY_MS });
  const merged = mergeFacts({ k7x8: packFact(a) }, { k7x8: packFact(b) });
  const f = parseFact(merged.k7x8);
  assert.equal(f.checks.length, 2);
  assert.equal(factStats(f).mastered, true);
  assert.equal(f.review.at, b.review.at);
  assert.equal(parseFact(mergeFacts(merged, merged).k7x8).checks.length, 2);
});

test('a newer unresolved error survives merge when the completion count is equal', () => {
  const a = parseFact('');
  record(a, [answer()]);
  const b = parseFact(packFact(a));
  record(b, [{ err: 1, completed: false }], { partial: true, now: noon + 1000 });
  const f = parseFact(mergeFacts({ k7x8: packFact(a) }, { k7x8: packFact(b) }).k7x8);
  assert.equal(factStats(f).errors, 1);
  assert.equal(f.review.days, 0);
});

test('both entry points ship the same application', () => {
  assert.equal(fs.readFileSync(path.join(__dirname, '..', 'calcolo.html'), 'utf8'), html);
});

const selectionSource = html.slice(html.indexOf('function pickFromPool('), html.indexOf('function drawAnswer('));
function nextProblem(game, random = 0.1) {
  const generated = { key: 'k2p3', text: '2 + 3', ans: 5 };
  return vm.runInNewContext(selectionSource + '\nnext(); G.cur;', {
    G: { lastKey: null, ...game },
    Math: Object.assign(Object.create(Math), { random: () => random }),
    gen: () => generated,
    fromKey: key => ({ key, text: key }),
    performance: { now: () => 0 },
    $: () => ({}),
    drawAnswer: () => {}
  });
}

test('daily review and check generate valid problems when a new user has no review pool', () => {
  for (const phase of ['review', 'check']) {
    assert.equal(nextProblem({ mode: 'daily', phase, pool: [], cfg: {} }).ans, 5);
  }
});

test('daily review uses the selected review facts', () => {
  assert.equal(nextProblem({ mode: 'daily', phase: 'review', pool: [{ key: 'k7x8', med: 900 }] }).key, 'k7x8');
});

test('daily verification mixes review facts and generated problems', () => {
  const game = { mode: 'daily', phase: 'check', pool: [{ key: 'k7x8', med: 900 }] };
  assert.equal(nextProblem(game, 0.1).key, 'k7x8');
  assert.equal(nextProblem(game, 0.9).key, 'k2p3');
});
