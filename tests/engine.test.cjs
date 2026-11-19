const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../training-engine.js');
let seed=38271;
const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};

test('all skill generators produce finite positive answers at every difficulty',()=>{
  for(const skill of Object.keys(E.LABELS))for(let tier=1;tier<=5;tier++)for(let i=0;i<30;i++){
    const p=E.generateSkill(skill,tier,rng);
    assert.ok(Number.isFinite(p.ans)&&p.ans>=0,skill+' '+JSON.stringify(p));
    assert.ok(p.text&&p.key&&p.skill);
    assert.ok(E.hint(p).length>5);
    if(!p.special&&p.form!=='missing'){
      const result=p.op==='p'?p.x+p.y:p.op==='m'?p.x-p.y:p.op==='x'?p.x*p.y:p.x/p.y;
      assert.equal(p.ans,Math.round(result*100)/100);
    }
  }
});

test('carry and borrow generators stay in their intended family',()=>{
  for(let i=0;i<200;i++){
    const add=E.generateSkill('add-carry',3,rng),sub=E.generateSkill('sub-borrow',3,rng);
    assert.ok(add.x%10+add.y%10>=10);
    assert.ok(sub.x%10<sub.y%10&&sub.x>sub.y);
    const plain=E.generateSkill('add-clear',3,rng);assert.ok(plain.x%10+plain.y%10<10);
  }
});

test('large facts share a review skill while basic multiplication remains a fact',()=>{
  assert.equal(E.learningKey(E.make('p',47,38)),'s:add-carry');
  assert.equal(E.learningKey(E.make('p',58,27)),'s:add-carry');
  assert.equal(E.learningKey(E.make('m',53,18)),'s:sub-borrow');
  assert.equal(E.learningKey(E.make('x',47,6)),'s:mul-2x1');
  assert.equal(E.learningKey(E.make('x',7,8)),'k7x8');
  assert.equal(E.learningKey(E.make('p',12,12)),'k12p12');
  const variants=new Set(Array.from({length:30},()=>E.fromKey('s:add-carry',3,rng).key));
  assert.ok(variants.size>20);
});

test('missing operands use the proper inverse on either side of each operation',()=>{
  for(const base of [E.make('p',7,8),E.make('m',55,18),E.make('x',7,8),E.make('d',56,7)]){
    for(const left of [true,false]){
      const p=E.missing(base,()=>left?0:0.99);
      assert.equal(p.ans,left?base.x:base.y);
      assert.match(p.text,/\?/);assert.match(p.missingHint,/inversa/);
      assert.ok(E.acceptable(p,String(p.ans)));
    }
  }
});

test('error analysis distinguishes carry, transposition and nearby table facts',()=>{
  assert.equal(E.diagnose(E.make('p',47,38),'75'),'carry');
  assert.equal(E.diagnose(E.make('m',53,18),'45'),'carry');
  assert.equal(E.diagnose(E.make('x',7,8),'65'),'reversed');
  assert.equal(E.diagnose(E.make('x',7,8),'54'),'neighbor');
  assert.equal(E.diagnose(E.make('x',7,8),'56'),null);
  assert.equal(E.diagnose(E.make('x',7,8),'999'),'other');
  for(const type of ['carry','reversed','neighbor'])assert.ok(E.generateSkill(E.errorSkill(type),2,rng));
});

test('error drills contrast the actual confused products and preserve operation context',()=>{
  const attempt={text:'7 × 8',input:'54',expected:56};
  const answers=new Set();
  for(let i=0;i<100;i++){
    const p=E.errorExercise('neighbor',attempt,2,rng);answers.add(p.ans);
    assert.match(p.hint,/7 × 8 = 56/);assert.match(p.hint,/6 × 9 = 54/);
    const reversed=E.errorExercise('reversed',attempt,2,rng);
    assert.equal(String(reversed.ans).length,2);
    assert.notEqual(String(reversed.ans),String(reversed.ans).split('').reverse().join(''));
    assert.equal(E.errorExercise('carry',{text:'53 − 18'},2,rng).op,'m');
  }
  assert.deepEqual([...answers].sort((a,b)=>a-b),[54,56]);
});

test('adaptation waits for ten outcomes and stays steady around the target',()=>{
  let a;
  for(let i=0;i<9;i++)a=E.adapt(a,true);
  assert.equal(a.tier,2);
  a=E.adapt(a,true);assert.equal(a.tier,3);
  for(let i=0;i<10;i++)a=E.adapt(a,false);
  assert.equal(a.tier,2);
  for(let i=0;i<10;i++)a=E.adapt(a,i<9);
  assert.equal(a.tier,2);
  for(let i=0;i<200;i++)a=E.adapt(a,false);assert.equal(a.tier,1);
  for(let i=0;i<200;i++)a=E.adapt(a,true);assert.equal(a.tier,5);
});

test('automatic levels require ten measured outcomes and exclude immediate repeats',()=>{
  const clean={completed:true,err:0,assisted:false};
  assert.equal(E.autoLevel('5',Array(9).fill(clean)),'5');
  assert.equal(E.autoLevel('5',Array(10).fill(clean)),'6');
  assert.equal(E.autoLevel('5',Array(10).fill({...clean,assisted:true})),'4');
  assert.equal(E.autoLevel('5',Array(10).fill({...clean,repeat:true})),'5');
  assert.equal(E.autoLevel('c',Array(10).fill(clean)),'c');
});

test('same-round retries follow three and eight intervening problems',()=>{
  const p=E.make('x',7,9),q=E.scheduleRetries([],p,0);
  assert.deepEqual(q.map(x=>x.at),[4,9]);
  assert.ok(q.every(x=>x.problem.repeat&&x.problem.ans===63));
});

test('estimates accept the inclusive five-percent band and reject outside values',()=>{
  const p={ans:1000,tolerance:.05};
  assert.ok(E.acceptable(p,'950'));assert.ok(E.acceptable(p,'1050'));
  assert.equal(E.acceptable(p,'949'),false);assert.equal(E.acceptable(p,'1051'),false);
  assert.equal(E.acceptable(p,''),false);
});

test('real-world answers retain cents without floating-point equality problems',()=>{
  for(const skill of ['discount','vat','change','tip'])for(let i=0;i<100;i++){
    const p=E.generateSkill(skill,2,rng);
    assert.ok(p.money&&p.confirm);
    assert.equal(Math.round(p.ans*100)/100,p.ans);
    assert.ok(E.acceptable(p,String(p.ans)));
  }
});

test('chains and flash sequences have independently verifiable answers',()=>{
  for(let i=0;i<100;i++){
    const chain=E.generateSkill('chain',3,rng);
    const total=chain.steps.reduce((n,s)=>s.op==='x'?n*s.n:s.op==='p'?n+s.n:n/s.n,chain.x);
    assert.equal(chain.ans,total);
    const flash=E.generateSkill('flash',3,rng);
    assert.equal(flash.ans,flash.numbers.reduce((a,b)=>a+b,0));
    assert.equal(flash.numbers.length,6);
  }
});

test('all requested techniques are present and generate solvable exercises',()=>{
  assert.equal(E.TECHNIQUES.length,9);
  for(const [id] of E.TECHNIQUES){const p=E.generateSkill(id,2,rng);assert.ok(E.acceptable(p,String(p.ans)))}
});
