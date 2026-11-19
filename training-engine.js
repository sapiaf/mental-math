/* Pure exercise and learning rules. Also used by the Node tests and standalone build. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.MathTrainer=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SYMBOLS={p:'+',m:'−',x:'×',d:'÷'};
  const LABELS={
    'add-small':'Addizioni entro 20','add-carry':'Riporto nelle unità','add-clear':'Addizioni senza riporto',
    'sub-small':'Sottrazioni entro 20','sub-borrow':'Sottrazioni con prestito','sub-clear':'Sottrazioni senza prestito',
    'mul-2x1':'Due cifre × una cifra','mul-2x2':'Due cifre × due cifre','div-basic':'Divisioni dalle tabelline','div-large':'Divisioni con numeri grandi',
    'missing-p':'Incognita nelle addizioni','missing-m':'Incognita nelle sottrazioni','missing-x':'Incognita nelle moltiplicazioni','missing-d':'Incognita nelle divisioni',
    chain:'Catene',flash:'Numeri in sequenza',audio:'Calcolo ascoltato',estimate:'Stima ±5%',
    discount:'Sconti',vat:'IVA al 22%',change:'Resto alla cassa',tip:'Mance',
    eleven:'Moltiplicare per 11','square-five':'Quadrati che finiscono in 5',squares:'Quadrati da 11 a 25',
    'complement-100':'Complementi a 100','complement-1000':'Complementi a 1000',
    conjugates:'Somma per differenza','near-100':'Numeri vicini a 100','divide-five':'Dividere per 5',
    'error-carry':'Recupero di riporto / prestito','error-neighbor':'Tabelline vicine','error-reversed':'Ordine delle cifre'
  };
  for(let n=2;n<=12;n++)LABELS['table-'+n]='Tabellina del '+n;
  const TECHNIQUES=[
    ['eleven','×11','Sposta di una cifra e aggiungi il numero: 34 × 11 = 340 + 34 = 374.'],
    ['square-five','Quadrati che finiscono in 5','35²: 3 × 4 = 12, poi aggiungi 25 → 1225.'],
    ['squares','Quadrati da 11 a 25','18² = (20 − 2)² = 400 − 80 + 4 = 324.'],
    ['complement-100','Complementi a 100','100 − 37: completa prima la decina (3), poi le altre decine (60) → 63.'],
    ['complement-1000','Complementi a 1000','1000 − 376 = 624: completa unità, decine e centinaia.'],
    ['conjugates','(a+b)(a−b)','(20 + 3)(20 − 3) = 20² − 3² = 391.'],
    ['near-100','Numeri vicini a 100','97 × 96: mancano 3 e 4. (100 − 3 − 4) × 100 + 3 × 4 = 9312.'],
    ['mul-2x1','Due cifre × una cifra','47 × 6 = 40 × 6 + 7 × 6 = 240 + 42 = 282.'],
    ['divide-five','÷5 come ×2 e ÷10','135 ÷ 5 = 270 ÷ 10 = 27.']
  ];
  const rand=(a,b,rng)=>a+Math.floor(rng()*(b-a+1));
  const choose=(a,rng)=>a[Math.floor(rng()*a.length)];
  const money=n=>Math.round(n*100)/100;
  const fmt=n=>String(money(n)).replace('.',',');
  function classify(p){
    if(p.skill)return p.skill;
    if(p.op==='p')return p.x+p.y<=20?'add-small':p.x%10+p.y%10>=10?'add-carry':'add-clear';
    if(p.op==='m')return p.x<=20?'sub-small':p.x%10<p.y%10?'sub-borrow':'sub-clear';
    if(p.op==='x'){
      if(Math.max(p.x,p.y)>12)return Math.min(p.x,p.y)<=9?'mul-2x1':'mul-2x2';
      const factor=[p.x,p.y].includes(7)?7:Math.max(p.x,p.y);
      return 'table-'+factor;
    }
    return p.x<=144&&p.y<=12?'div-basic':'div-large';
  }
  function make(op,x,y,extra={}){
    const ans=money(op==='p'?x+y:op==='m'?x-y:op==='x'?x*y:x/y);
    const key=(op==='p'||op==='x')?'k'+Math.min(x,y)+op+Math.max(x,y):'k'+x+op+y;
    const p={op,x,y,ans,key,text:fmt(x)+' '+SYMBOLS[op]+' '+fmt(y),...extra};
    p.skill=classify(p);return p;
  }
  function annotate(p){return {...p,skill:classify(p)}}
  function aggregate(p){
    return !!p.special||p.form==='missing'||(p.op==='p'&&Math.max(p.x,p.y)>12&&p.x+p.y>20)||(p.op==='m'&&p.x>20)||
      (p.op==='x'&&Math.max(p.x,p.y)>12)||(p.op==='d'&&(p.x>144||p.y>12));
  }
  function learningKey(p){return aggregate(p)?'s:'+classify(p):p.key}
  function fromKey(key,tier=2,rng=Math.random){
    if(key.startsWith('s:'))return generateSkill(key.slice(2),tier,rng);
    const m=/^k(\d+)([pmxd])(\d+)$/.exec(key);
    return m?make(m[2],+m[1],+m[3]):null;
  }
  function skillName(id){return LABELS[id]||id}
  function hint(p){
    if(p.hint)return p.hint;
    const {op,x,y}=p;
    if(p.form==='missing')return p.missingHint;
    if(op==='p')return x+' + '+(Math.floor(y/10)*10)+' = '+(x+Math.floor(y/10)*10)+'; poi + '+y%10+' = '+p.ans+'.';
    if(op==='m'){
      const round=Math.ceil(y/10)*10;
      return x+' − '+round+' + '+(round-y)+' = '+p.ans+'.';
    }
    if(op==='x'&&(x===9||y===9)){const n=x===9?y:x;return n+' × 10 − '+n+' = '+p.ans+'.'}
    if(op==='x'&&Math.max(x,y)>12){const a=Math.max(x,y),b=Math.min(x,y);return Math.floor(a/10)*10+' × '+b+' + '+a%10+' × '+b+' = '+p.ans+'.'}
    if(op==='x')return x+' × '+y+' = '+x+' × '+(y-1)+' + '+x+' = '+p.ans+'.';
    return 'Pensa all’operazione inversa: '+y+' × '+p.ans+' = '+x+'.';
  }
  function generateSkill(skill,tier=2,rng=Math.random){
    tier=Math.max(1,Math.min(5,tier));
    const r=(a,b)=>rand(a,b,rng),max=Math.min(9,2+tier*2);
    let p;
    if(skill.startsWith('table-')){const n=+skill.slice(6);p=make('x',n,r(2,12));}
    else if(skill==='add-small')p=make('p',r(2,10),r(2,10));
    else if(skill==='sub-small'){const x=r(2,10),y=r(2,10);p=make('m',x+y,x);}
    else if(skill==='add-carry'){
      const u=r(1,9),v=r(10-u,9);p=make('p',r(1,max)*10+u,r(1,max)*10+v);
    }else if(skill==='add-clear'){
      const u=r(0,8),v=r(0,9-u);p=make('p',r(1,max)*10+u,r(1,max)*10+v);
    }else if(skill==='sub-borrow'){
      const u=r(0,7),v=r(u+1,9),t=r(2,max);p=make('m',t*10+u,r(1,t-1)*10+v);
    }else if(skill==='sub-clear'){
      const u=r(1,9),t=r(2,max);p=make('m',t*10+u,r(1,t-1)*10+r(0,u));
    }else if(skill==='mul-2x1')p=make('x',r(12,max*10+9),r(2,max));
    else if(skill==='mul-2x2')p=make('x',r(12,max*10+9),r(12,max*10+9));
    else if(skill==='div-basic'||skill==='div-large'){
      const divisor=r(2,skill==='div-basic'?12:max),answer=r(skill==='div-basic'?2:13,skill==='div-basic'?12:max*10+9);
      p=make('d',divisor*answer,divisor);
    }else if(skill.startsWith('missing-')){
      const op=skill.slice(-1),a=r(2,12),b=r(2,12);
      p=missing(op==='m'?make(op,a+b,a):op==='d'?make(op,a*b,a):make(op,a,b),rng);
    }else if(skill==='eleven'){
      const a=r(12,89);p=make('x',a,11,{hint:a+' × 10 + '+a+' = '+a*11+'.'});
    }else if(skill==='square-five'){
      const n=r(1,9),a=n*10+5;p=make('x',a,a,{text:a+'²',hint:n+' × '+(n+1)+' = '+n*(n+1)+'; aggiungi 25 in coda → '+a*a+'.'});
    }else if(skill==='squares'){
      const a=r(11,25),base=Math.round(a/10)*10,d=a-base;
      p=make('x',a,a,{text:a+'²',hint:base+'² + 2 × '+base+' × ('+d+') + ('+d+')² = '+a*a+'.'});
    }else if(skill==='complement-100'||skill==='complement-1000'){
      const target=skill==='complement-100'?100:1000,a=r(1,target-1);p=make('m',target,a,{text:a+' + ? = '+target,hint:target+' − '+a+' = '+(target-a)+'.'});
    }else if(skill==='conjugates'){
      const a=r(2,9)*10,b=r(1,9);p=make('x',a+b,a-b,{text:'('+a+' + '+b+') × ('+a+' − '+b+')',hint:a+'² − '+b+'² = '+((a*a)-(b*b))+'.'});
    }else if(skill==='near-100'){
      const a=r(1,12),b=r(1,12);p=make('x',100-a,100-b,{hint:'(100 − '+a+' − '+b+') × 100 + '+a+' × '+b+' = '+(100-a)*(100-b)+'.'});
    }else if(skill==='divide-five'){
      const a=r(5,99)*5;p=make('d',a,5,{hint:a+' × 2 ÷ 10 = '+a/5+'.'});
    }else if(skill==='chain'){
      let value=r(2,9);const start=value,steps=[];
      for(let i=0;i<tier+2;i++){
        const kind=i%3;if(kind===0){const n=r(2,3);steps.push({op:'x',n});value*=n;}
        else if(kind===1){let n=r(1,9);if((value+n)%2)n++;steps.push({op:'p',n});value+=n;}
        else {steps.push({op:'d',n:2});value/=2;}
      }
      p={op:'p',x:start,y:0,ans:value,key:'chain:'+start+':'+steps.map(s=>s.op+s.n).join(','),
        text:start+' → '+steps.map(s=>SYMBOLS[s.op]+s.n).join(' → ')+' → ?',steps,hint:'Parti da '+start+'. '+steps.map(s=>SYMBOLS[s.op]+s.n).join(', ')+'. Risultato finale: '+value+'.'};
    }else if(skill==='flash'){
      const numbers=Array.from({length:3+tier},()=>r(1,tier<=2?9:25));
      p={op:'p',x:0,y:0,ans:numbers.reduce((a,b)=>a+b,0),key:'flash:'+numbers.join(','),text:'Somma i numeri',numbers,flashMs:Math.max(500,1500-tier*150),hint:numbers.join(' + ')+' = '+numbers.reduce((a,b)=>a+b,0)+'.'};
    }else if(skill==='audio'){
      const op=choose(['p','m','x','d'],rng),a=r(2,12),b=r(2,12);
      p=op==='d'?make('d',a*b,a):make(op,a,b);if(p.op==='m'&&p.x<p.y)p=make('m',p.y,p.x);
      p.speech=p.x+' '+({p:'più',m:'meno',x:'per',d:'diviso'}[p.op])+' '+p.y;
    }else if(skill==='estimate'){
      const a=r(101,999),b=r(11,39);p=make('x',a,b,{text:a+' × '+b+' ≈ ?',tolerance:.05,confirm:true,hint:'Arrotonda: '+Math.round(a/100)*100+' × '+Math.round(b/10)*10+'. Valore esatto '+a*b+'; accettiamo ±5%.'});
    }else if(['discount','vat','change','tip'].includes(skill)){
      const price=r(5,100)*5,percent=choose([5,10,15,20,25],rng);
      if(skill==='discount')p=make('m',price,price*percent/100,{text:'Prezzo '+price+' €, sconto '+percent+'%. Quanto paghi?',hint:percent+'% di '+price+' = '+fmt(price*percent/100)+' €. Sottrai lo sconto → '+fmt(price-price*percent/100)+' €.'});
      if(skill==='vat')p=make('p',price,price*.22,{text:'Imponibile '+price+' €. Totale con IVA al 22%?',hint:'20% + 2% = '+fmt(price*.2)+' + '+fmt(price*.02)+' €. Totale '+fmt(price*1.22)+' €.'});
      if(skill==='tip')p=make('x',price,percent/100,{text:'Conto '+price+' €. Quanto lasci di mancia al '+percent+'%?',hint:price+' ÷ 100 × '+percent+' = '+fmt(price*percent/100)+' €.'});
      if(skill==='change'){const cost=money(r(101,4900)/100);p=make('m',50,cost,{text:'Spesa '+fmt(cost)+' €, paghi 50 €. Resto?',hint:'Completa fino a 50 €: 50 − '+fmt(cost)+' = '+fmt(50-cost)+' €.'});}
      p.confirm=true;p.money=true;
    }else if(skill==='error-carry')p=generateSkill(choose(['add-carry','sub-borrow'],rng),tier,rng);
    else if(skill==='error-neighbor')p=generateSkill('table-'+r(6,9),tier,rng);
    else if(skill==='error-reversed')return errorExercise('reversed',{},tier,rng);
    else throw new Error('Abilità sconosciuta: '+skill);
    p.skill=skill;
    if(!/^table-/.test(skill)&&!['add-small','sub-small','add-carry','add-clear','sub-borrow','sub-clear','mul-2x1','mul-2x2','div-basic','div-large'].includes(skill))p.special=true;
    return p;
  }
  function missing(base,rng=Math.random){
    const left=rng()<.5,ans=left?base.x:base.y,original=base.ans;
    let inverse;
    if(base.op==='p')inverse=original+' − '+(left?base.y:base.x)+' = '+ans;
    if(base.op==='m')inverse=left?original+' + '+base.y+' = '+ans:base.x+' − '+original+' = '+ans;
    if(base.op==='x')inverse=original+' ÷ '+(left?base.y:base.x)+' = '+ans;
    if(base.op==='d')inverse=left?original+' × '+base.y+' = '+ans:base.x+' ÷ '+original+' = '+ans;
    return {...base,ans,form:'missing',special:true,skill:'missing-'+base.op,key:'missing:'+base.key+':'+(left?'l':'r'),
      text:(left?'?':base.x)+' '+SYMBOLS[base.op]+' '+(left?base.y:'?')+' = '+original,missingHint:'Usa l’inversa: '+inverse+'.'};
  }
  function diagnose(p,input){
    const n=Number(String(input).replace(',','.'));if(!Number.isFinite(n)||n===p.ans)return null;
    const raw=String(Math.abs(n)),expected=String(Math.abs(p.ans));
    if(raw.length>=2&&raw!==expected&&raw===expected.split('').reverse().join(''))return 'reversed';
    if((p.op==='p'||p.op==='m')&&Math.abs(n-p.ans)===10)return 'carry';
    if(p.op==='x'&&p.form!=='missing'){
      const nearby=[];for(let a=2;a<=12;a++)for(let b=2;b<=12;b++)if(a*b===n&&Math.abs(n-p.ans)<=Math.max(p.x,p.y))nearby.push([a,b]);
      if(nearby.length)return 'neighbor';
    }
    return 'other';
  }
  const ERROR_LABELS={carry:'Possibile riporto / prestito dimenticato',neighbor:'Possibile confusione tra tabelline',reversed:'Possibili cifre invertite',other:'Risposta da rivedere'};
  function errorSkill(type){return ({carry:'error-carry',neighbor:'error-neighbor',reversed:'error-reversed'})[type]||null}
  function errorExercise(type,attempt,tier=2,rng=Math.random){
    if(type==='neighbor'){
      const source=/^(\d+) × (\d+)$/.exec(attempt.text||'');
      if(source){
        const pairs=[[+source[1],+source[2]]];
        for(let a=2;a<=12;a++)for(let b=a;b<=12;b++)if(a*b===Number(attempt.input))pairs.push([a,b]);
        if(pairs.length>1){
          const pair=choose(pairs,rng),p=make('x',pair[0],pair[1]);
          return {...p,skill:'error-neighbor',special:true,instruction:'Distingui i due prodotti che hai confuso',
            hint:pairs.map(([a,b])=>a+' × '+b+' = '+a*b).join('; ')+'. Sono prodotti diversi.'};
        }
      }
    }
    if(type==='carry'){
      const p=generateSkill((attempt.text||'').includes('−')?'sub-borrow':'add-carry',tier,rng);
      return {...p,skill:'error-carry',special:true,instruction:'Controlla il passaggio della decina'};
    }
    if(type==='reversed'){
      let p;
      for(let i=0;i<30;i++){
        p=generateSkill('table-'+rand(4,9,rng),tier,rng);
        const digits=String(p.ans);if(digits.length===2&&digits!==digits.split('').reverse().join(''))break;
      }
      if(p.ans<10||p.ans>99||String(p.ans)===String(p.ans).split('').reverse().join(''))p=make('x',6,7);
      return {...p,skill:'error-reversed',special:true,instruction:'Controlla l’ordine: decine, poi unità',
        hint:'Il risultato è '+p.ans+': '+Math.floor(p.ans/10)+' decine e '+p.ans%10+' unità.'};
    }
    return generateSkill(errorSkill(type)||'add-small',tier,rng);
  }
  function adapt(previous,success){
    const a={tier:2,window:[],total:0,correct:0,...previous};
    a.window=[...(a.window||[]),!!success].slice(-10);a.total++;if(success)a.correct++;
    if(a.window.length===10){
      const rate=a.window.filter(Boolean).length/10;
      if(rate>.9)a.tier=Math.min(5,a.tier+1);
      else if(rate<.8)a.tier=Math.max(1,a.tier-1);
      a.lastRate=rate;a.window=[];
    }
    return a;
  }
  function autoLevel(level,results){
    const measured=results.filter(r=>!r.repeat);if(!/^\d+$/.test(level)||measured.length<10)return level;
    const rate=measured.filter(r=>!r.err&&!r.assisted&&r.completed!==false).length/measured.length;
    return String(Math.max(1,Math.min(7,+level+(rate>.9?1:rate<.8?-1:0))));
  }
  function acceptable(p,input){
    if(input===''||input==='.'||input.endsWith('.'))return false;
    const n=Number(input);if(!Number.isFinite(n))return false;
    return p.tolerance?Math.abs(n-p.ans)<=Math.abs(p.ans)*p.tolerance+1e-9:Math.abs(n-p.ans)<.00001;
  }
  function scheduleRetries(queue,p,index){
    return queue.concat([3,8].map(gap=>({at:index+gap+1,problem:{...p,repeat:true}}))).sort((a,b)=>a.at-b.at);
  }
  return {LABELS,TECHNIQUES,ERROR_LABELS,make,annotate,classify,aggregate,learningKey,fromKey,skillName,hint,generateSkill,missing,diagnose,errorSkill,errorExercise,adapt,autoLevel,acceptable,scheduleRetries,fmt};
});
