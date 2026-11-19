const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Exercise the actual inline core without requiring a browser or dependencies.
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('/* ---------- learning core');
const end = html.indexOf('/* ---------- database sync');
const Engine = require('../training-engine.js');
const core = vm.runInNewContext(html.slice(start, end) +
  '\n({parseFact,packFact,factStats,recordFact,reviewQueue,mergeFacts,DAY_MS})', { Engine });
const { parseFact, packFact, factStats, recordFact, reviewQueue, mergeFacts, DAY_MS } = core;
const noon = Date.parse('2026-11-18T12:00:00Z');
let serial = 0;
const answer = (err = 0, ms = 900) => ({ ms, firstMs: ms, err });
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

test('mastery uses first-key latency even when typing the full answer takes longer',()=>{
  const f=parseFact('');
  record(f,Array.from({length:3},()=>({ms:2800,firstMs:900,err:0})),{verify:true});
  record(f,Array.from({length:2},()=>({ms:3100,firstMs:1000,err:0})),{verify:true,now:noon+DAY_MS});
  assert.equal(factStats(f).mastered,true);
  assert.equal(factStats(f).med,900);
  assert.ok(factStats(f).totalMed>2000);
});

test('legacy total-time checks cannot be reinterpreted as first-key evidence',()=>{
  const f=parseFact('');
  f.checks=[{ms:800,count:3,day:'2026-11-18',session:'old1'},{ms:800,count:3,day:'2026-11-19',session:'old2'}];
  f.times=[800,800];
  assert.equal(factStats(parseFact(packFact(f))).mastered,false);
});

test('assisted answers and immediate repeats do not create independent evidence',()=>{
  const f=parseFact('');
  record(f,[{ms:800,firstMs:100,err:0,assisted:true,completed:false}],{verify:true});
  record(f,[{ms:800,firstMs:100,err:0,repeat:true}],{verify:true,now:noon+DAY_MS});
  assert.equal(f.checks.length,0);
  assert.equal(factStats(f).mastered,false);
  assert.equal(f.firstTimes.length,0);
});

test('wrong inputs and inferred error types survive backup serialization',()=>{
  const f=parseFact('');
  record(f,[{ms:1500,firstMs:1000,err:1,text:'7 × 8',expected:56,answers:[{input:'65',type:'reversed'}]}]);
  const saved=parseFact(packFact(f));
  assert.equal(saved.attempts[0].input,'65');
  assert.equal(saved.attempts[0].expected,56);
  assert.equal(saved.attempts[0].type,'reversed');
});

test('skill-only tracking is not duplicated in the review queue',()=>{
  const f=parseFact('');record(f,[answer()]);f.trackOnly=true;
  const active=parseFact(packFact(f));active.trackOnly=false;
  const queue=reviewQueue({'s:table-7':packFact(f),'s:add-carry':packFact(active),k47p38:'5|0|3000|0'},noon+DAY_MS);
  assert.equal(queue.map(x=>x.key).join(','),'s:add-carry');
});

test('turning adaptation off preserves the selected skill tier while keeping accuracy',()=>{
  const f=parseFact('');
  for(let i=0;i<10;i++)record(f,[answer()],{adaptive:false});
  assert.equal(f.adaptive.tier,2);assert.equal(f.adaptive.total,10);assert.equal(f.adaptive.correct,10);
});

test('reading an opened solution does not inflate the recorded response duration',()=>{
  const source=html.slice(html.indexOf('function observation('),html.indexOf('function completeProblem('));
  const result=vm.runInNewContext(source+'\nobservation({assisted:true,completed:false});',{
    Engine,performance:{now:()=>120000},
    G:{cur:Engine.make('x',7,8),shown:0,revealed:true,helpAtMs:6000,firstMs:800,answers:[],curErrors:2}
  });
  assert.equal(result.ms,6000);assert.equal(result.firstMs,800);assert.equal(result.completed,false);
});

test('repeating the same wrong answer after clearing is a second attempt and opens help',()=>{
  const source=html.slice(html.indexOf('function press(k)'),html.indexOf("document.querySelectorAll('#keys button')"));
  const game={ready:true,done:false,revealed:false,end:10000,shown:0,firstMs:null,input:'',cur:Engine.make('x',7,8),curErrors:0,totalErrors:0,answers:[],lastWrong:null};
  vm.runInNewContext(source+"\nfor(const k of ['6','5','clr','6','5'])press(k);",{
    Engine,G:game,performance:{now:()=>100},drawAnswer(){},playBeep(){},triggerHaptic(){},
    $:()=>({classList:{remove(){},add(){}}}),showHelp:()=>{game.revealed=true}
  });
  assert.equal(game.totalErrors,2);assert.equal(game.answers.length,2);assert.equal(game.revealed,true);
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

test('standalone entry point is generated from the current source', () => {
  assert.equal(fs.readFileSync(path.join(__dirname, '..', 'calcolo.html'), 'utf8'), require('../scripts/build-standalone.cjs').standalone());
});

const selectionSource = html.slice(html.indexOf('function pickFromPool('), html.indexOf('function drawAnswer('));
function nextProblem(game, random = 0.1) {
  const generated = { key: 'k2p3', text: '2 + 3', ans: 5 };
  return vm.runInNewContext(selectionSource + '\nnext(); G.cur;', {
    Engine,
    G: { lastKey: null,presented: -1,retryQueue: [],answers:[],exercise:'normal',...game },
    state:{settings:{adaptive:false}},
    Math: Object.assign(Object.create(Math), { random: () => random }),
    gen: () => generated,
    newProblem: () => generated,
    fromKey: key => ({ key, text: key }),
    performance: { now: () => 0 },
    $: () => ({classList:{toggle(){}}}),
    drawAnswer: () => {},clearPresentation: () => {}
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
