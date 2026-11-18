// Flip to false on opening day: turns the status card and stops section live.
const PRELAUNCH=true;
/* Thirsty Beaches — front end */
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* One cup illustration for the builder, mixer and exported drink card. */
(function(){
  const TB=window.TB=window.TB||{};
  const CUP='M272 586 L748 586 L641 1400 Q512 1436 367 1400 Z';
  const SWIRL='M27 50 C43 41 45 67 56 60 S73 46 85 51 L83 67 C68 59 69 79 58 75 C43 68 51 93 40 100 C47 79 31 77 27 68 Z';
  const VEIN='M65 57 C47 76 78 88 59 107 C50 118 63 125 54 139 L62 139 C72 123 61 117 68 106 C86 84 61 77 73 60 Z';
  const SHELL='/assets/cup-80s-shell.webp?v=arcade20261018';
  const CREAM='/assets/cup-80s-cream.png?v=arcade20261018';
  TB.cupArt={CUP,SWIRL,VEIN,SHELL,CREAM};
  /* PRELAUNCH: "Show this at the window" has no window to go to yet. Swap it for the
     text signup, plus a quiet event-quote link. */
  TB.toSignup=()=>{
    const box=document.querySelector('.alerts'),inp=document.getElementById('subInput');
    if(!box||!inp) return;
    box.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'center'});
    inp.focus({preventScroll:true});
  };
  TB.prelaunchActs=btn=>{
    btn.textContent='Text me when it\u2019s pourable';
    btn.addEventListener('click',TB.toSignup);
    const a=document.createElement('a');a.className='link prelink';a.href='#events';
    a.textContent='Want this at your event? Get a quote';
    btn.after(a);
    return a;
  };
  /* Garnish is specified in the recipe, not rendered as a photorealistic sticker. */
  TB.garnishArt=(name,color)=>{
    return null;
  };
  TB.garnishSVG=(name,color)=>{
    const g=TB.garnishArt(name,color);if(!g)return '';
    const [x,y,w,h]=g.box;
    return `<image class="cup__garnish" href="${g.src}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
  };
  TB.drawGarnish=(x,g,img)=>{
    if(!g||!img)return;const [a,b,w,h]=g.box,k=Math.min(w/img.width,h/img.height);
    x.drawImage(img,a+(w-img.width*k)/2,b+(h-img.height*k)/2,img.width*k,img.height*k);
  };
  const esc=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let uid=0;
  /* colours are only ever '#rrggbb' from our own tables; anything else (a crafted share link, a model reply) falls back,
     so a value can never close the attribute it is written into */
  const hexOk=(v,d)=>/^#[0-9a-f]{3,8}$/i.test(String(v||''))?String(v):d;
  TB.cupSVG=(c,label,builder=false)=>{
    c={top:hexOk(c&&c.top,'#C25896'),bot:hexOk(c&&c.bot,'#C25896'),cream:c&&c.cream?hexOk(c.cream,'#FFF6E8'):null};
    const id='drinkcup'+(++uid),stopTop=builder?' id="liqTop"':'',stopBot=builder?' id="liqBot"':'';
    return `<svg class="cup cup--arcade" viewBox="0 0 110 150" role="img" aria-label="${esc(label||'Your dirty soda, over nugget ice')}">
      <defs>
        <linearGradient id="${id}liq" x1="0" y1="0" x2="0" y2="1"><stop${stopTop} offset="0" stop-color="${c.top}"/><stop${stopBot} offset="1" stop-color="${c.bot}"/></linearGradient>
        <clipPath id="${id}clip"><path d="${CUP}"/></clipPath>
        <clipPath id="${id}surface"><path d="M258 431 Q506 470 767 430 L750 540 Q508 592 271 539 Z"/></clipPath>
        <mask id="${id}cream" x="0" y="0" width="1024" height="1536" maskUnits="userSpaceOnUse" style="mask-type:alpha"><image data-href="${CREAM}" width="1024" height="1536"/></mask>
      </defs>
      <g transform="translate(5 0) scale(.09765625)">
        <image class="cup__shell" data-href="${SHELL}" width="1024" height="1536"/>
        <path class="cup__tint" d="${CUP}" fill="url(#${id}liq)" opacity=".08"/>
        <g${builder?' id="swirl"':''} fill="${c.cream||'#fff6e8'}" style="display:${c.cream?'block':'none'}"><rect width="1024" height="1536" mask="url(#${id}cream)"/></g>
        <g${builder?' data-bubble-body':''} clip-path="url(#${id}clip)" aria-hidden="true"></g>
        <g${builder?' data-bubble-surface':''} clip-path="url(#${id}surface)" aria-hidden="true"></g>
        <image class="cup__print" data-href="/assets/logo-480.webp?v=logo20261018" x="312" y="737" width="399" height="266"/>
        <g${builder?' id="bits"':''}></g>
      </g>
    </svg>`;
  };
  /* cup art is ~200KB: cups are written with data-href and only fetch their images
     once they are shown and about to scroll into view (call after inserting a cup) */
  const wake=svg=>svg.querySelectorAll('image[data-href]').forEach(im=>{im.setAttribute('href',im.dataset.href);im.removeAttribute('data-href');});
  const cupIO=('IntersectionObserver' in window)?new IntersectionObserver(es=>es.forEach(e=>{
    if(e.isIntersecting){cupIO.unobserve(e.target);wake(e.target);}
  }),{rootMargin:'600px 0px'}):null;
  TB.wakeCups=root=>(root||document).querySelectorAll('svg.cup').forEach(svg=>{
    if(!svg.querySelector('image[data-href]')) return;
    if(cupIO) cupIO.observe(svg); else wake(svg);
  });
})();

/* ── nav shrink ───────────────────────────────────── */
(function(){
  const nav=document.querySelector('.nav'); if(!nav) return;
  const f=()=>nav.classList.toggle('is-stuck', scrollY>40);
  f(); addEventListener('scroll',f,{passive:true});
})();

/* ── reveal on scroll ─────────────────────────────── */
(function(){
  const els=document.querySelectorAll('.reveal'); if(!els.length) return;
  if(!('IntersectionObserver'in window)){els.forEach(e=>e.classList.add('in'));return;}
  const io=new IntersectionObserver(en=>{
    en.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});
  },{rootMargin:'0px 0px -12% 0px'});
  els.forEach(e=>io.observe(e));
})();

/* ── hero + ticker on screen? ─────────────────────
   Infinite CSS animations (stars, floor, scroll cue, ticker) and the hero loops only run
   while their section is visible: they were burning half the main thread on phones. */
(function(){
  const TB=window.TB=window.TB||{};
  const hero=document.querySelector('.hero'), tick=document.querySelector('.ticker');
  TB.heroOn=true;
  if(!('IntersectionObserver' in window)) return;
  const io=new IntersectionObserver(es=>es.forEach(e=>{
    e.target.classList.toggle('is-off',!e.isIntersecting);
    if(e.target===hero){ TB.heroOn=e.isIntersecting; document.dispatchEvent(new CustomEvent('tb:hero',{detail:e.isIntersecting})); }
  }));
  if(hero) io.observe(hero);
  if(tick) io.observe(tick);
})();
/* touch screens get no hover glow or pointer parallax at all */
const NOHOVER = matchMedia('(hover: none)').matches;

/* ── pointer glow ─────────────────────────────────── */
(function(){
  const g=document.querySelector('.glow'); if(!g||REDUCED||NOHOVER) return;
  let x=innerWidth/2,y=innerHeight/2,cx=x,cy=y,raf=0;
  /* runs only while it is catching up with the pointer, then stops */
  function loop(){
    raf=0;
    if(document.body.dataset.arcade) return;
    cx+=(x-cx)*.09; cy+=(y-cy)*.09;
    g.style.transform=`translate(${cx}px,${cy}px) translate(-50%,-50%)`;
    if(Math.abs(x-cx)>.5||Math.abs(y-cy)>.5) raf=requestAnimationFrame(loop);
  }
  addEventListener('pointermove',e=>{x=e.clientX;y=e.clientY;if(!raf)raf=requestAnimationFrame(loop);},{passive:true});
})();

/* ── hero parallax ────────────────────────────────── */
(function(){
  const layers=[...document.querySelectorAll('[data-par]')]; if(!layers.length||REDUCED||NOHOVER) return;
  const TB=window.TB||{};
  let tx=0,ty=0,cx=0,cy=0,raf=0;
  function loop(){
    raf=0;
    if(document.body.dataset.arcade||TB.heroOn===false) return;
    cx+=(tx-cx)*.06; cy+=(ty-cy)*.06;
    layers.forEach(l=>{
      const d=parseFloat(l.dataset.par)||1;
      l.style.transform=(l.dataset.base||'')+` translate3d(${cx*d*26}px,${cy*d*16}px,0)`;
    });
    if(Math.abs(tx-cx)>.001||Math.abs(ty-cy)>.001) raf=requestAnimationFrame(loop);
  }
  addEventListener('pointermove',e=>{
    tx=(e.clientX/innerWidth-.5); ty=(e.clientY/innerHeight-.5);
    if(!raf) raf=requestAnimationFrame(loop);
  },{passive:true});
})();

/* ── hero bubbles ─────────────────────────────────── */
(function(){
  const c=document.getElementById('fx'); if(!c||REDUCED) return;
  const ctx=c.getContext('2d'); let w,h,parts=[],raf=0;
  const COLORS=[[42,245,228],[255,60,172],[255,209,102]];
  /* a 3x phone canvas is 9x the pixels of 1x for no visible gain on soft dots */
  const DPR=Math.min(2,window.devicePixelRatio||1);
  const TB=window.TB||{};

  function size(){
    const r=c.getBoundingClientRect();
    const bw=Math.max(r.width, c.parentElement.clientWidth||0);
    const bh=Math.max(r.height, c.parentElement.clientHeight||0);
    w=c.width=Math.round(bw*DPR);
    h=c.height=Math.round(bh*DPR);
  }

  function make(y){
    return {
      x:Math.random()*w,                              // anywhere across the hero
      y: y===undefined ? Math.random()*h : y,
      r:(Math.random()*2.4+.6)*DPR,
      v:(Math.random()*.5+.16)*DPR,
      a:Math.random()*.22+.06,
      c:COLORS[(Math.random()*COLORS.length)|0],
      d:Math.random()*Math.PI*2
    };
  }
  function seed(){
    const n=Math.min(160,Math.round(w/12));          // plenty of them
    parts=Array.from({length:n},()=>make());
  }
  const live=()=>!document.hidden&&TB.heroOn!==false&&!document.body.dataset.arcade;

  /* faint, slow dots: 30fps (two steps per paint) looks the same and halves the paint work */
  let lastT=0;
  function tick(now){
    raf=0;
    if(!live()){ lastT=0; return; }
    if(lastT&&now-lastT<30){ raf=requestAnimationFrame(tick); return; }
    lastT=now;
    ctx.clearRect(0,0,w,h);
    for(const p of parts){
      p.y-=p.v*2; p.d+=.02; p.x+=Math.sin(p.d)*.7;
      if(p.y<-10) Object.assign(p, make(h+10));
      const [R,G,B]=p.c;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7);
      ctx.fillStyle=`rgba(${R},${G},${B},${p.a})`; ctx.fill();
    }
    raf=requestAnimationFrame(tick);
  }
  const go=()=>{ if(!raf&&live()) raf=requestAnimationFrame(tick); };
  size(); seed(); go();
  // fonts and images can change the hero's height after first paint
  addEventListener('load',()=>{size();seed();});
  /* phones fire resize when the URL bar slides; only re-seed when the width changes */
  let lastW=innerWidth;
  addEventListener('resize',()=>{ if(innerWidth!==lastW){lastW=innerWidth;size();seed();} },{passive:true});
  document.addEventListener('visibilitychange',go);
  document.addEventListener('tb:hero',go);
  /* the arcade overlay stops the loop; pick it back up when it closes */
  new MutationObserver(go).observe(document.body,{attributes:true,attributeFilter:['data-arcade']});
})();

/* ── VHS toggle ───────────────────────────────────── */
(function(){
  const b=document.getElementById('vhsBtn'); if(!b) return;
  let on=false; try{ on = localStorage.getItem('tb-vhs')==='1'; }catch(e){}
  if(on){document.body.classList.add('vhs');b.setAttribute('aria-pressed','true');}
  b.addEventListener('click',()=>{
    const now=document.body.classList.toggle('vhs');
    b.setAttribute('aria-pressed',now?'true':'false');
    try{localStorage.setItem('tb-vhs',now?'1':'0');}catch(e){}
  });
})();

/* ── toast ────────────────────────────────────────── */
function toast(msg){
  let t=document.querySelector('.toast');
  if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t);}
  t.textContent=msg; t.classList.add('on');
  clearTimeout(t._x); t._x=setTimeout(()=>t.classList.remove('on'),2200);
}

/* ── easter egg: type THIRSTY ─────────────────────── */
(function(){
  const want='thirsty'; let buf='';
  addEventListener('keydown',e=>{
    if(e.target&&e.target.matches&&e.target.matches('input,textarea')) return;
    buf=(buf+e.key.toLowerCase()).slice(-want.length);
    if(buf===want) rain();
  });
  function rain(){
    if(REDUCED){toast('🌴 Stay Thirsty, Beaches');return;}
    const box=document.createElement('div'); box.className='rain'; document.body.appendChild(box);
    const icons=['🌴','🥤','🌊','☀️','🍒','🍍'];
    for(let i=0;i<48;i++){
      const s=document.createElement('span');
      s.textContent=icons[(Math.random()*icons.length)|0];
      s.style.left=Math.random()*100+'vw';
      s.style.animationDuration=(2.6+Math.random()*2.4)+'s';
      s.style.animationDelay=(Math.random()*1.1)+'s';
      s.style.fontSize=(1.1+Math.random()*1.8)+'rem';
      box.appendChild(s);
    }
    toast('🌴 Stay Thirsty, Beaches');
    setTimeout(()=>box.remove(),6200);
  }
})();

/* ── the builder ──────────────────────────────────── */
(function(){
  const root=document.getElementById('builder'); if(!root) return;

  const BASES=[{n:'Dr Pepper',c:'#7A3B26'},{n:'Coke',c:'#3A1E14'},{n:'Sprite',c:'#CFEFA8'},
    {n:'Mountain Dew',c:'#B9DC4B'},{n:'Root Beer',c:'#4B2A19'},{n:'Fanta Orange',c:'#FF8A2C'},
    {n:'Lemonade',c:'#FFE27A'},{n:'Strawberry Lemonade',c:'#FF6F91'}];
  const SYRUPS=[{n:'Coconut Cream',c:'#F4EBDD'},{n:'Vanilla',c:'#EFD9A8'},{n:'Raspberry',c:'#E0245E'},
    {n:'Blue Raspberry',c:'#2FA8FF'},{n:'Strawberry',c:'#FF5470'},{n:'Peach',c:'#FFB07A'},
    {n:'Mango',c:'#FFC244'}];
  const CREAMS=[{n:'Half & Half',c:'#FFF6E8'},{n:'Heavy Cream',c:'#FFFBF2'},
    {n:'Coconut Cream',c:'#F6EEE0'},{n:'No cream',c:null}];
  const TOPS=[{n:'Strawberry',c:'#FF3F6C'},{n:'Pineapple',c:'#FFD84D'},{n:'Lime',c:'#8BE04E'},
    {n:'Cherry',c:'#E01F45'},{n:'Nothing',c:null}];

  const FIRST=['Dirty','Filthy','Sunset','Riptide','Midnight','Salty','Golden','Neon','Barefoot','Rowdy','Reckless','Sticky'];
  const LAST=['Situation','Business','Confession','Decision','Mistake','Ritual','Sunrise','Hour','Habit','Rumour','Alibi','Detour'];

  /* shared with the drink card + Mix me something below */
  const TB=window.TB=window.TB||{};
  const pick={base:0,syrup:0,cream:0,top:0};
  const oldCup=root.querySelector('.cup');
  if(oldCup) oldCup.outerHTML=TB.cupSVG({top:'#a07561',bot:'#7a3b26',cream:'#fff6e8',topper:'#ff3f6c'},'Your dirty soda, over nugget ice',true);
  const cup=root.querySelector('.cup');
  TB.lists={BASES,SYRUPS,CREAMS,TOPS};
  TB.buildCard=()=>{
    const base=BASES[pick.base],syr=SYRUPS[pick.syrup],cr=CREAMS[pick.cream],tp=TOPS[pick.top];
    const liquid=mix(base.c,syr.c,.28);
    const secret=!!document.querySelector('.preview.secret');
    const nm=document.getElementById('drinkName').textContent;
    return {
      eyebrow: secret?'Secret menu \u00b7 say the name':'Pour Decisions \u00b7 $3.49',
      name:nm, recipe:document.getElementById('recipe').textContent.replace(/ \u00b7 Secret menu.*$/,''),
      colors:{top:mix(liquid,'#ffffff',.18),bot:liquid,cream:cr.c,topper:tp.c,garnish:tp.n},
      url:location.origin+'/#build='+[pick.base,pick.syrup,pick.cream,pick.top].join('-'),
      text:nm+'. Built it at Thirsty Beaches. Your turn:',
      file:nm
    };
  };

  /* independent indices so all 12 x 12 names are reachable across the 1,120 builds,
     instead of both words collapsing to the same mod-12 value */
  const nameIdx=()=>[
    (pick.base*5+pick.syrup*3+pick.cream*2+pick.top)%FIRST.length,
    (pick.syrup*7+pick.top*5+pick.cream*3+pick.base*2)%LAST.length
  ];
  const name=()=>{const [a,b]=nameIdx();return FIRST[a]+' '+LAST[b];};
  function mix(a,b,t){const p=x=>parseInt(x,16);
    const A=[p(a.slice(1,3)),p(a.slice(3,5)),p(a.slice(5,7))],B=[p(b.slice(1,3)),p(b.slice(3,5)),p(b.slice(5,7))];
    return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');}

  function render(animate,touched){
    const base=BASES[pick.base],syr=SYRUPS[pick.syrup],cr=CREAMS[pick.cream],tp=TOPS[pick.top];
    const liquid=mix(base.c,syr.c,.28);
    document.getElementById('liqTop').setAttribute('stop-color',mix(liquid,'#ffffff',.18));
    document.getElementById('liqBot').setAttribute('stop-color',liquid);

    const sw=document.getElementById('swirl');
    if(cr.c){sw.style.display='block';sw.setAttribute('fill',cr.c);} else sw.style.display='none';

    const bits=document.getElementById('bits');
    bits.innerHTML=TB.garnishSVG(tp.n,tp.c);
    /* The shared particle controller preserves bubble phase across recipe changes. */

    document.getElementById('drinkName').textContent=name();
    const parts=[base.n,syr.n+' syrup'];
    if(cr.c)parts.push(cr.n); if(tp.c)parts.push(tp.n+' on top');
    document.getElementById('recipe').textContent=parts.join(' · ')+' · over nugget ice';
    cup?.setAttribute('aria-label',name()+': '+document.getElementById('recipe').textContent);
    const say=document.getElementById('buildSay');
    if(say) say.textContent=document.getElementById('drinkName').textContent+', '+document.getElementById('recipe').textContent;

    if(animate&&!REDUCED&&cup){cup.classList.remove('shake');void cup.offsetWidth;cup.classList.add('shake');}
    const detail={base:pick.base,syrup:pick.syrup,cream:pick.cream,top:pick.top};
    window.__tbBuild=detail;
    document.dispatchEvent(new CustomEvent('tb:build',{detail}));
    /* don't touch the URL until the customer actually changes something — otherwise
       the builder clobbers #play before arcade.js ever reads it (app.js loads first) */
    if(touched) history.replaceState(null,'','#build='+[pick.base,pick.syrup,pick.cream,pick.top].join('-'));
  }

  function group(id,list,key){
    const box=document.getElementById(id);
    list.forEach((item,i)=>{
      const b=document.createElement('button');
      b.type='button';b.className='opt';b.setAttribute('aria-pressed',i===0?'true':'false');
      if(item.c){const d=document.createElement('span');d.className='dot';d.style.background=item.c;b.appendChild(d);}
      b.appendChild(document.createTextNode(item.n));
      b.addEventListener('click',()=>{
        pick[key]=i;
        [...box.children].forEach((el,j)=>el.setAttribute('aria-pressed',j===i?'true':'false'));
        render(false,true);
      });
      box.appendChild(b);
    });
  }
  function sync(){
    [['optBase','base'],['optSyrup','syrup'],['optCream','cream'],['optTop','top']].forEach(([id,k])=>{
      const box=document.getElementById(id);
      [...box.children].forEach((el,j)=>el.setAttribute('aria-pressed',j===pick[k]?'true':'false'));
    });
  }

  group('optBase',BASES,'base');group('optSyrup',SYRUPS,'syrup');
  group('optCream',CREAMS,'cream');group('optTop',TOPS,'top');

  /* restore a shared build — validate every index instead of silently clamping,
     so a mangled link doesn't quietly serve a different drink as if it were the shared one */
  if(location.hash.indexOf('#build=')===0){
    const m=location.hash.match(/^#build=(-?\d+)-(-?\d+)-(-?\d+)-(-?\d+)$/);
    const v=(s,len)=>{ if(s===undefined) return -1; const i=parseInt(s,10); return Number.isInteger(i)&&i>=0&&i<len?i:-1; };
    const b=v(m&&m[1],BASES.length), sy=v(m&&m[2],SYRUPS.length), c=v(m&&m[3],CREAMS.length), t=v(m&&m[4],TOPS.length);
    if(!m||Math.min(b,sy,c,t)<0){
      toast('That link got mangled on the way over — here’s ours instead');
    }else{
      pick.base=b; pick.syrup=sy; pick.cream=c; pick.top=t; sync();
      document.querySelector('.preview')?.classList.add('is-shared');
      requestAnimationFrame(()=>document.getElementById('build')
        ?.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'start'}));
    }
  }
  render(false);
  TB.wakeCups?.(root);
  TB.mountFizz?.(root,{builder:true});

  /* phones: the cup sits above the options, so a one-line bar (swatch, name, price)
     follows you while you tap through them */
  const bar=document.createElement('div');
  bar.className='bbar'; bar.setAttribute('aria-hidden','true');
  bar.innerHTML='<span class="bbar__sw"></span><span class="bbar__n"></span><span class="bbar__p">$3.49</span>';
  document.body.appendChild(bar);
  const paintBar=()=>{
    const base=BASES[pick.base],syr=SYRUPS[pick.syrup],cr=CREAMS[pick.cream];
    const liquid=mix(base.c,syr.c,.28);
    bar.querySelector('.bbar__sw').style.background=cr.c?`linear-gradient(180deg,${cr.c} 0 34%,${liquid} 34%)`:liquid;
    bar.querySelector('.bbar__n').textContent=document.getElementById('drinkName').textContent;
  };
  /* after the tb:build listeners (secret menu) have had their say */
  document.addEventListener('tb:build',()=>requestAnimationFrame(paintBar));
  paintBar();
  if('IntersectionObserver' in window){
    const steps=root.querySelector('.steps'),pv=root.querySelector('.preview');
    let stepsOn=false,pvOn=true;
    const io=new IntersectionObserver(es=>{
      es.forEach(e=>{ if(e.target===steps) stepsOn=e.isIntersecting; else pvOn=e.isIntersecting; });
      bar.classList.toggle('on',stepsOn&&!pvOn);
    },{threshold:0});
    if(steps) io.observe(steps); if(pv) io.observe(pv);
  }

  document.getElementById('surprise')?.addEventListener('click',()=>{
    pick.base=(Math.random()*BASES.length)|0; pick.syrup=(Math.random()*SYRUPS.length)|0;
    pick.cream=(Math.random()*CREAMS.length)|0; pick.top=(Math.random()*TOPS.length)|0;
    sync(); render(true,true);
    requestAnimationFrame(()=>toast('🥤 '+document.getElementById('drinkName').textContent));
  });

  /* "Send it to a friend" makes a real image (the drink card) plus the link */
  document.getElementById('shareBtn')?.addEventListener('click',()=>{
    history.replaceState(null,'','#build='+[pick.base,pick.syrup,pick.cream,pick.top].join('-'));
    if(TB.openCard) TB.openCard(TB.buildCard());
  });
  document.getElementById('copyBtn')?.addEventListener('click',async()=>{
    const txt=document.getElementById('drinkName').textContent+'\n'+document.getElementById('recipe').textContent;
    try{ await navigator.clipboard.writeText(txt); toast('Recipe copied'); }
    catch(e){ toast('Could not copy'); }
  });

  /* the primary window action: a big, screenshot-ready card with the recipe and price.
     Before opening day there is no window yet, so it signs you up instead. */
  const wc=document.getElementById('wcard');
  const wbtn=document.getElementById('windowBtn');
  if(PRELAUNCH&&wbtn){
    TB.prelaunchActs?.(wbtn);
    return;
  }
  wbtn?.addEventListener('click',()=>{
    document.getElementById('wcardK').textContent='Pour Decisions \u00b7 $3.49';
    document.getElementById('wcardCode').hidden=true;
    document.getElementById('wcardName').textContent=document.getElementById('drinkName').textContent;
    document.getElementById('wcardRecipe').textContent=document.getElementById('recipe').textContent;
    if(typeof wc.showModal==='function') wc.showModal(); else wc.setAttribute('open','');
  });
  document.getElementById('wcardX')?.addEventListener('click',()=>{
    if(typeof wc.close==='function') wc.close(); else wc.removeAttribute('open');
  });
})();

/* ── menu filter + search + random ────────────────── */
(function(){
  const search=document.getElementById('menuSearch');
  /* only the category pills filter; "Pick for me" shares the look, not the job */
  const pills=document.querySelectorAll('.filters .pill[data-cat]');
  if(!search&&!pills.length) return;
  const secs=[...document.querySelectorAll('.menu__sec')];
  const empty=document.getElementById('noResults');
  const bar=document.getElementById('menuBar');
  const nav=document.querySelector('.nav');
  const root=document.documentElement;
  let cat='all';

  /* sticky bar sits under the real nav (its height changes when it shrinks) */
  function measure(){
    if(nav) root.style.setProperty('--navh',Math.round(nav.getBoundingClientRect().height)+'px');
    if(bar) root.style.setProperty('--barh',Math.round(bar.getBoundingClientRect().height)+'px');
  }
  measure();
  if('ResizeObserver' in window){ const ro=new ResizeObserver(measure); nav&&ro.observe(nav); bar&&ro.observe(bar); }
  else addEventListener('resize',measure);

  /* right-edge fade on the scrolling pills, dropped once you reach the end */
  const strip=document.querySelector('.menu__bar .filters');
  if(strip){
    const edge=()=>strip.classList.toggle('is-end',strip.scrollLeft+strip.clientWidth>=strip.scrollWidth-4);
    strip.addEventListener('scroll',edge,{passive:true}); addEventListener('resize',edge); edge();
  }

  /* seasons: Fall Sep–Nov, Halloween Oct, Winter Dec–Feb, Valentine's Feb (by month, local time) */
  const SEASONS={fall:{m:[9,10,11],label:'fall'},halloween:{m:[10],label:'Halloween'},
    winter:{m:[12,1,2],label:'winter'},valentines:{m:[2],label:'Valentine’s'}};
  const month=new Date().getMonth()+1;
  const seasonal=document.getElementById('seasonal');
  if(seasonal){
    const groups=[...seasonal.querySelectorAll('.menu__sub')].map(h=>{
      const key=h.textContent.toLowerCase().replace(/[^a-z]/g,'');
      return {h,ul:h.nextElementSibling,s:SEASONS[key]};
    }).filter(g=>g.s&&g.ul&&g.ul.matches('.menu__grid'));
    groups.forEach(g=>{
      const on=g.s.m.includes(month);
      const tag=document.createElement('span'); tag.className='menu__when';
      tag.textContent=on?'Pouring now':'Back for '+g.s.label;
      g.h.appendChild(tag);
      g.h.classList.toggle('is-off',!on); g.ul.classList.toggle('is-off',!on);
      g.ul.querySelectorAll('.row').forEach(r=>{ if(!on) r.dataset.off='1'; });
    });
    /* what's pouring now goes first; the rest keeps its order below */
    const anchor=groups.length&&groups[0].h;
    if(anchor){
      const onFirst=groups.filter(g=>g.s.m.includes(month)).concat(groups.filter(g=>!g.s.m.includes(month)));
      const frag=document.createDocumentFragment();
      onFirst.forEach(g=>{frag.appendChild(g.h);frag.appendChild(g.ul);});
      seasonal.appendChild(frag);
    }
  }

  /* search: accent-, case- and hyphen-insensitive, matched on word starts */
  const fold=t=>t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
    .replace(/&/g,' and ').replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const stem=w=>w.length>4&&/ies$/.test(w)?w.slice(0,-3)+'y':w.length>3&&/[^s]s$/.test(w)?w.slice(0,-1):w;
  const EXTRA={'beach-babies':'kids kid children','rescue-energy-drinks':'energy','soft-serve':'ice cream',
    'floats':'float soft serve','treats':'candy','seasonal':'seasonal limited','coffee':'coffee espresso'};
  const index=[];
  secs.forEach(sec=>{
    const secTxt=(sec.querySelector('.menu__h')?.textContent||'')+' '+(EXTRA[sec.dataset.cat]||'');
    sec.querySelectorAll('.menu__grid').forEach(ul=>{
      const sub=ul.previousElementSibling?.matches('.menu__sub')?ul.previousElementSibling.firstChild.textContent:'';
      ul.querySelectorAll('.row').forEach(row=>{
        const tags=[...row.querySelectorAll('.tag')].map(t=>t.classList.contains('tag--sf')?'sugar free sf':'caffeine caffeinated').join(' ');
        const t=fold([row.querySelector('.row__n')?.textContent,row.querySelector('.row__d')?.textContent,secTxt,sub,tags].join(' '));
        index.push({row,sec,words:t.split(' ')});
      });
    });
  });
  const hit=(words,q)=>q.every(w=>words.some(x=>x.startsWith(w)||x.startsWith(stem(w))));

  const count=document.getElementById('resultCount');
  function apply(){
    const raw=(search?.value||'').trim(), q=raw?fold(raw).split(' ').filter(Boolean):[];
    const per=new Map(secs.map(s=>[s,0])); let shown=0;
    index.forEach(({row,sec,words})=>{
      const ok=(cat==='all'||sec.dataset.cat===cat)&&(!q.length||hit(words,q));
      row.style.display=ok?'':'none'; if(ok){per.set(sec,per.get(sec)+1);shown++;}
    });
    secs.forEach(sec=>{
      sec.style.display=per.get(sec)?'':'none';
      /* hide a season heading whose drinks are all filtered out */
      sec.querySelectorAll('.menu__sub').forEach(h=>{
        const ul=h.nextElementSibling; if(!ul) return;
        h.style.display=[...ul.children].some(r=>r.style.display!=='none')?'':'none';
      });
    });
    if(empty) empty.style.display=shown?'none':'block';
    if(count){
      if(q.length||cat!=='all'){ count.style.display='block'; count.textContent=shown+(shown===1?' drink':' drinks'); }
      else count.style.display='none';
    }
  }
  /* if the bar is stuck mid-list, bring the (new) first result up under it */
  function toTop(smooth){
    const first=secs.find(s=>s.style.display!=='none')||empty; if(!first) return;
    const off=(nav?nav.getBoundingClientRect().height:0)+(bar?bar.getBoundingClientRect().height:0)+12;
    const y=first.getBoundingClientRect().top+scrollY-off;
    if(scrollY>y+1) scrollTo({top:Math.max(0,y),behavior:smooth&&!REDUCED?'smooth':'auto'});
  }
  const press=c=>pills.forEach(x=>x.setAttribute('aria-pressed',x.dataset.cat===c?'true':'false'));
  pills.forEach(p=>p.addEventListener('click',()=>{
    cat=p.dataset.cat; press(cat); apply(); toTop(true);
  }));
  search?.addEventListener('input',()=>{apply();toTop(false);});
  search?.addEventListener('keydown',e=>{ if(e.key==='Enter') search.blur(); });

  /* a homepage category link (/menu#dirty-sodas) should land already filtered,
     not dropped into the middle of 114 unfiltered drinks */
  function fromHash(first){
    const hashCat=location.hash.slice(1);
    const hashPill=[...pills].find(p=>p.dataset.cat===hashCat);
    if(hashPill){ cat=hashCat; press(cat); }
    if(first||hashPill) apply();
    if(hashPill){
      const sec=document.getElementById(hashCat);
      const go=()=>{ measure(); sec&&sec.scrollIntoView({block:'start'}); };
      requestAnimationFrame(go);
      if(first&&document.readyState!=='complete') addEventListener('load',()=>setTimeout(go,0),{once:true});
    }
  }
  fromHash(true);
  addEventListener('hashchange',()=>fromHash(false));

  /* Pick for me: a drink that's actually pouring now (no candy bags, nothing out of season) */
  document.getElementById('randomBtn')?.addEventListener('click',()=>{
    cat='all'; if(search) search.value='';
    press('all'); apply();
    const rows=index.filter(({row,sec})=>sec.dataset.cat!=='treats'&&!row.dataset.off).map(x=>x.row);
    if(!rows.length) return;
    document.querySelectorAll('.row.hit').forEach(r=>r.classList.remove('hit'));
    const r=rows[(Math.random()*rows.length)|0];
    r.classList.add('hit');
    r.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'center'});
    toast(r.querySelector('.row__n').textContent);
  });
})();

document.querySelectorAll('.yr').forEach(el=>el.textContent=new Date().getFullYear());

/* ── live trailer location ────────────────────────── */
(function(){
  const box=document.getElementById('tbStatus'); if(!box) return;

  /* set this to your Worker URL once it's deployed */
  const API='https://tb-where.nicholasroper.workers.dev';

  const stState=document.getElementById('stState');
  const stWhere=document.getElementById('stWhere');
  const stMeta=document.getElementById('stMeta');
  const dirBtn=document.getElementById('dirBtn');
  const distBtn=document.getElementById('distBtn');
  const retryBtn=document.getElementById('retryBtn');
  const mapEl=document.getElementById('map');
  let map,marker,here=null,them=null;

  const miles=(a,b)=>{
    const R=3958.8,t=x=>x*Math.PI/180;
    const dLat=t(b.lat-a.lat),dLng=t(b.lng-a.lng);
    const s=Math.sin(dLat/2)**2+Math.cos(t(a.lat))*Math.cos(t(b.lat))*Math.sin(dLng/2)**2;
    return 2*R*Math.asin(Math.sqrt(s));
  };
  const ago=m=>m<1?'just now':m<60?m+' min ago':Math.round(m/60)+' hr ago';

  // Leaflet (JS+CSS from unpkg) loads only when #find nears the viewport,
  // with a first-scroll fallback for browsers without IntersectionObserver.
  let leafletP=null,pending=null;
  function loadLeaflet(){
    if(leafletP) return leafletP;
    leafletP=new Promise(res=>{
      if(typeof L!=='undefined') return res(true);
      const css=document.createElement('link');
      css.rel='stylesheet'; css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(css);
      const js=document.createElement('script');
      js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      js.onload=()=>res(true); js.onerror=()=>res(false);
      document.head.appendChild(js);
    }).then(ok=>{ if(pending) paintMap(pending[0],pending[1]); return ok; });
    return leafletP;
  }
  (function watchFind(){
    const sec=document.getElementById('find');
    if(!sec) return;
    if('IntersectionObserver' in window){
      const io=new IntersectionObserver(es=>{
        if(es.some(e=>e.isIntersecting)){ io.disconnect(); loadLeaflet(); }
      },{rootMargin:'300px 0px'});
      io.observe(sec);
    } else {
      addEventListener('scroll',loadLeaflet,{once:true,passive:true});
    }
  })();

  function drawMap(lat,lng){
    pending=[lat,lng];
    if(typeof L!=='undefined') paintMap(lat,lng);
  }
  function paintMap(lat,lng){
    if(typeof L==='undefined'){ mapEl.style.display='none'; return; }
    if(!map){
      map=L.map(mapEl,{scrollWheelZoom:false,attributionControl:true}).setView([lat,lng],14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
    } else map.setView([lat,lng],14);
    if(marker) marker.remove();
    marker=L.marker([lat,lng],{icon:L.divIcon({className:'',html:'<div class="pin"></div>',iconSize:[22,22]})}).addTo(map);
  }

  /* open: a green "Open now" pill at the top of the hero, linking down to the map */
  const TB=window.TB=window.TB||{};
  const soon=document.getElementById('heroSoon');
  let pill=null;
  function setOpen(on,label){
    if(TB.open!==on){ TB.open=on; document.dispatchEvent(new CustomEvent('tb:open',{detail:on})); }
    if(!soon) return;
    if(on){
      if(!pill){ pill=document.createElement('a'); pill.className='soon soon--go'; pill.href='#find'; soon.after(pill); }
      pill.textContent=(label?'Open now at '+label:'Open now')+' \u00b7 Directions';
      soon.hidden=true;
    } else {
      if(pill){ pill.remove(); pill=null; }
      soon.hidden=false;
    }
  }

  function closed(d){
    setOpen(false);
    box.classList.remove('is-open');
    retryBtn.hidden=true;
    if(PRELAUNCH){
      box.classList.add('is-soon');
      stState.textContent='Opening soon';
      stWhere.textContent='The trailer is almost ready. When we open, this card turns green and shows exactly where we\u2019re parked.';
      stMeta.textContent='';
      mapEl.style.display='none'; dirBtn.hidden=true; distBtn.hidden=true;
      return;
    }
    stState.textContent='Gone Surfing';
    stWhere.textContent = d && d.label
      ? 'Last spotted at '+d.label+'. Check the stops below, or drop us a line.'
      : 'Back on the road soon — check the stops below, or drop us a line.';
    stMeta.textContent = d && d.lastSeen ? 'Last update '+ago(Math.round((Date.now()-d.lastSeen)/60000)) : '';
    mapEl.style.display='none'; dirBtn.hidden=true; distBtn.hidden=true;
  }

  function offline(){
    setOpen(false);
    box.classList.remove('is-open');
    if(PRELAUNCH){ closed(null); return; }
    stState.textContent='Can’t reach the trailer';
    stWhere.textContent='Something isn’t loading right now. Check the stops below, or try again.';
    stMeta.textContent='';
    mapEl.style.display='none'; dirBtn.hidden=true; distBtn.hidden=true; retryBtn.hidden=false;
  }

  async function load(){
    const ctrl=('AbortController' in window)?new AbortController():null;
    const to=ctrl?setTimeout(()=>ctrl.abort(),6000):null;
    try{
      const r=await fetch(API+'/where',{cache:'no-store',signal:ctrl?ctrl.signal:undefined});
      if(to) clearTimeout(to);
      if(!r.ok) throw 0;
      const d=await r.json();
      if(!d.open){ closed(d); return; }
      them={lat:d.lat,lng:d.lng};
      setOpen(true,d.label);
      box.classList.add('is-open');
      retryBtn.hidden=true;
      stState.textContent='We\u2019re open';
      stWhere.textContent=d.label?('Parked at '+d.label):'Parked and pouring — tap through for directions.';
      stMeta.textContent='Updated '+ago(d.ageMin);
      mapEl.style.display='';
      drawMap(d.lat,d.lng);
      const ios=/iPhone|iPad|Macintosh/.test(navigator.userAgent);
      dirBtn.href=(ios?'https://maps.apple.com/?daddr=':'https://www.google.com/maps/dir/?api=1&destination=')+d.lat+','+d.lng;
      dirBtn.hidden=false; distBtn.hidden=false;
    }catch(e){ if(to) clearTimeout(to); offline(); }
  }
  retryBtn.addEventListener('click',()=>{ stState.textContent='Checking…'; load(); });

  distBtn.addEventListener('click',()=>{
    if(!navigator.geolocation){ toast('Your browser can\u2019t share location'); return; }
    distBtn.textContent='Locating…';
    navigator.geolocation.getCurrentPosition(p=>{
      here={lat:p.coords.latitude,lng:p.coords.longitude};
      const d=miles(here,them);
      distBtn.textContent=d<0.2?'You\u2019re basically here':d.toFixed(1)+' miles away';
      if(map){
        L.circleMarker([here.lat,here.lng],{radius:6,color:'#00F0FF',weight:2,fillOpacity:.6}).addTo(map);
        map.fitBounds([[here.lat,here.lng],[them.lat,them.lng]],{padding:[40,40]});
      }
    },()=>{ distBtn.textContent='Location blocked'; },{timeout:9000});
  });

  load();
  setInterval(load,60000);
})();

/* ── upcoming stops ───────────────────────────────── */
(function(){
  const box=document.getElementById('stopList'); if(!box) return;
  const API='https://tb-where.nicholasroper.workers.dev';
  const empty=document.getElementById('stopsEmpty');

  const DAY=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function pretty(iso){
    const [y,m,d]=iso.split('-').map(Number);
    const dt=new Date(y,m-1,d);
    const today=new Date(); today.setHours(0,0,0,0);
    const diff=Math.round((dt-today)/86400000);
    if(diff===0) return {txt:'Today', today:true};
    if(diff===1) return {txt:'Tomorrow', today:false};
    return {txt:DAY[dt.getDay()]+' '+MON[dt.getMonth()]+' '+dt.getDate(), today:false};
  }
  const clock=t=>{
    if(!t) return '';
    const [H,M]=t.split(':').map(Number);
    const ap=H>=12?'pm':'am'; const h=((H+11)%12)+1;
    return h+(M?':'+String(M).padStart(2,'0'):'')+ap;
  };

  function showEmpty(msg){
    empty.textContent=msg; empty.style.display='block';
  }
  /* "Opening soon" copy only while we are actually not open yet */
  let noStops=false;
  const eyebrow=document.querySelector('#stops .eyebrow'),eyebrowTxt=eyebrow?eyebrow.textContent:'';
  function emptyCopy(){
    if(!noStops) return;
    const pre=PRELAUNCH&&!(window.TB&&window.TB.open);
    showEmpty(pre
      ? 'Not open yet. The first stops land here the minute they’re booked. Drop your number below and you’ll hear first.'
      : 'Nothing booked this week yet. Check back soon, or drop your number below.');
    if(eyebrow) eyebrow.textContent=pre?'Opening soon':eyebrowTxt;
  }
  document.addEventListener('tb:open',emptyCopy);

  (async()=>{
    try{
      const {stops}=await (await fetch(API+'/schedule',{cache:'no-store'})).json();
      if(!stops || !stops.length){
        noStops=true; emptyCopy();
        return;
      }
      /* build nodes with textContent, not innerHTML — s.label/s.note come from our own
         worker today, but one bad calendar paste shouldn't be able to break the layout */
      box.innerHTML='';
      empty.style.display='none'; /* the prelaunch line ships in the HTML; real stops replace it */
      stops.forEach(s=>{
        const p=pretty(s.date);
        const time=[clock(s.start),clock(s.end)].filter(Boolean).join(' – ');
        const d=document.createElement('div'); d.className='stop'+(p.today?' stop--today':'');
        const day=document.createElement('span'); day.className='stop__day'; day.textContent=p.txt;
        const where=document.createElement('p'); where.className='stop__where'; where.textContent=s.label;
        d.append(day,where);
        if(time){ const t=document.createElement('p'); t.className='stop__time'; t.textContent=time; d.appendChild(t); }
        if(s.note){ const n=document.createElement('p'); n.className='stop__note'; n.textContent=s.note; d.appendChild(n); }
        box.appendChild(d);
      });
    }catch(e){ showEmpty('Couldn’t load this week’s stops. Try again in a minute.'); }
  })();
})();

/* ── alert signup ─────────────────────────────────── */
(function(){
  const btn=document.getElementById('subBtn'); if(!btn) return;
  const API='https://tb-where.nicholasroper.workers.dev';
  const input=document.getElementById('subInput');
  const consent=document.getElementById('subConsent');
  const consentRow=document.getElementById('subConsentRow');
  const consentText=document.getElementById('subConsentText');
  const msg=document.getElementById('subMsg');
  const hint=document.getElementById('subHint');
  const label=document.getElementById('subLabel');
  const form=document.getElementById('subForm');
  const say=(t,c='')=>{ msg.className='alerts__msg '+c; msg.textContent=t; };
  const via=()=>{ const r=form&&form.querySelector('input[name=via]:checked'); return r?r.value:'sms'; };

  /* Text / Email: the right keyboard for each, and the text-message consent box only for text */
  function sync(){
    const email=via()==='email';
    input.type=email?'email':'tel';
    input.setAttribute('inputmode',email?'email':'tel');
    input.setAttribute('autocomplete',email?'email':'tel');
    input.placeholder=email?'you@example.com':'(555) 555-5555';
    if(label) label.textContent=email?'Email address':'Mobile number';
    if(consentRow) consentRow.hidden=email;
    if(consent) consent.required=!email;
    if(hint) hint.textContent=email?'We\u2019ll email you once to confirm your address.':'We\u2019ll text you one message to confirm your number.';
    say('');
  }
  if(form) form.querySelectorAll('input[name=via]').forEach(r=>r.addEventListener('change',sync));
  sync();

  /* The form only appears once the Worker says a confirmation text or email can actually be sent, so nobody is promised a
     message that never comes. Until then the page says alerts are coming soon. */
  const wrap=document.getElementById('subWrap'), soon=document.getElementById('subSoon');
  (async()=>{
    try{
      const r=await fetch(API+'/subscribe/status',{cache:'no-store'}); if(!r.ok) return;
      const st=await r.json(); if(!st||(!st.sms&&!st.email)) return;
      const opt=v=>form.querySelector('input[name=via][value='+v+']');
      if(!st.sms){ const o=opt('sms'); if(o){ o.closest('label').hidden=true; } const e=opt('email'); if(e) e.checked=true; }
      if(!st.email){ const o=opt('email'); if(o){ o.closest('label').hidden=true; } const sm=opt('sms'); if(sm) sm.checked=true; }
      sync();
      if(wrap) wrap.hidden=false; if(soon) soon.hidden=true;
    }catch(e){ /* stay hidden: better no form than a broken promise */ }
  })();

  /* the exact consent wording shown, hashed: the server only accepts a version it knows */
  async function consentVersion(){
    try{
      const txt=consentText.textContent.normalize('NFC').replace(/\s+/g,' ').trim();
      const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(txt));
      return Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('');
    }catch(e){ return undefined; }
  }

  const submit=async e=>{
    if(e) e.preventDefault();
    if(btn.disabled) return;
    const email=via()==='email';
    const contact=input.value.trim();
    if(!contact){ say(email?'Pop your email in first':'Pop your number in first','err'); input.setAttribute('aria-invalid','true'); input.focus(); return; }
    input.removeAttribute('aria-invalid');
    if(!email&&!consent.checked){ say('Tick the box so we know it\u2019s okay to text you','err'); consent.focus(); return; }
    say('Adding you\u2026');
    btn.disabled=true;
    try{
      const body={contact,smsConsent:!email&&consent.checked,source:'web'};
      if(!email) body.consentVersion=await consentVersion();
      const r=await fetch(API+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const d=await r.json();
      if(r.ok){
        say(d.confirmSent===false
            ?'You\u2019re on the list to confirm. We\u2019ll be in touch. Nothing goes out until your signup is confirmed.'
            :email?'Almost there. Check your email for the confirmation link. Nothing goes out until you confirm.'
                  :'Almost there. We\u2019ll text you once to confirm your number. Reply YES and you\u2019re in.','ok');
        input.value=''; if(consent) consent.checked=false;
      }
      else if(d.error==='bad-contact') say(email?'That doesn\u2019t look like an email':'That doesn\u2019t look like a US mobile number','err');
      else if(d.error==='consent-required') say('Tick the box so we know it\u2019s okay to text you','err');
      else if(d.error==='consent-changed') say('This page is out of date. Reload it and try again.','err');
      else if(r.status===429) say('Too many tries. Give it a little while.','err');
      else say('Something went wrong, try again','err');
    }catch(e){ say('Network error, try again','err'); }
    finally{ btn.disabled=false; }
  };
  if(form) form.addEventListener('submit',submit); else btn.addEventListener('click',submit);
})();

/* ── add to home screen ───────────────────────────── */
(function(){
  /* the banner sells the punch card and live map, which aren't live before opening day */
  if (PRELAUNCH) return;
  const KEY='tb-install-dismissed';
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return;                       // already installed
  try{ if (localStorage.getItem(KEY)) return; }catch(e){}   // they said no

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
  let deferred = null;

  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; show(); });

  /* iOS never fires that event, so offer instructions instead — but only
     once they've actually looked around a bit */
  if (isIOS) setTimeout(show, 25000);

  let shown = false;
  /* never cover the hero: wait until they've scrolled past it */
  function show(){
    if (shown) return;
    /* ...and never on top of the Mix me something form, which sits right under the hero */
    const mixSec=document.getElementById('mix');
    const past=mixSec&&!mixSec.hidden ? mixSec.offsetTop+mixSec.offsetHeight-innerHeight*0.4 : innerHeight*0.6;
    if (scrollY < past){
      addEventListener('scroll', show, { passive:true, once:true });
      return;
    }
    shown = true;
    removeEventListener('scroll', show);
    const bar = document.createElement('div');
    bar.className = 'install';
    bar.innerHTML = `
      <img src="/assets/icon-192.png?v=logo20261018" alt="">
      <div class="install__t">
        <b>Keep us on your phone</b>
        <small>${isIOS ? 'Tap Share, then “Add to Home Screen”'
                       : 'Punch card, menu and live map — one tap away'}</small>
      </div>
      ${isIOS ? '' : '<button class="install__go" type="button">Install</button>'}
      <button class="install__x" type="button" aria-label="No thanks">&times;</button>`;
    document.body.appendChild(bar);
    requestAnimationFrame(()=>bar.classList.add('up'));

    bar.querySelector('.install__x').onclick = () => {
      bar.classList.remove('up');
      try{ localStorage.setItem(KEY,'1'); }catch(e){}
      setTimeout(()=>bar.remove(), 500);
    };
    const go = bar.querySelector('.install__go');
    if (go) go.onclick = async () => {
      if (!deferred) return;
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') toast('Nice — we\u2019re on your home screen 🥤');
      try{ localStorage.setItem(KEY,'1'); }catch(e){}
      bar.classList.remove('up'); setTimeout(()=>bar.remove(), 500);
      deferred = null;
    };
  }
})();


/* ── easter egg: the secret menu ───────────────────
   One exact build in the builder unlocks a drink that is not on the menu page.
   Change SECRET to move it. Indexes follow BASES / SYRUPS / CREAMS / TOPS above. */
(function(){
  const SECRET={base:5,syrup:1,cream:1,top:3,name:'Lifeguard Off Duty',line:'Secret menu. Say the name at the window.'};
  const pv=document.querySelector('.preview'); if(!pv) return;
  let badge=null, told=false;
  document.addEventListener('tb:build',e=>{
    const p=e.detail;
    const hit=p.base===SECRET.base&&p.syrup===SECRET.syrup&&p.cream===SECRET.cream&&p.top===SECRET.top;
    pv.classList.toggle('secret',hit);
    if(hit){
      document.getElementById('drinkName').textContent=SECRET.name;
      document.getElementById('recipe').textContent+=' · '+SECRET.line;
      if(!badge){
        badge=document.createElement('p'); badge.className='preview__badge'; badge.textContent='Secret menu unlocked';
        pv.insertBefore(badge,document.getElementById('drinkName'));
      }
      if(!told){ told=true; toast('🔓 You found the secret menu'); try{localStorage.setItem('tb-secret','1');}catch(x){} }
      if(!REDUCED){ try{navigator.vibrate&&navigator.vibrate([30,40,30]);}catch(x){} }
    } else if(badge){ badge.remove(); badge=null; }
  });
  /* the builder may already have rendered (and validated a shared build) before this
     listener existed — reuse that validated state instead of re-parsing the raw hash,
     which used to append SECRET.line to the recipe a second time on a secret deep link */
  if(window.__tbBuild) document.dispatchEvent(new CustomEvent('tb:build',{detail:window.__tbBuild}));
})();

/* ── easter egg: tilt the phone, the drink sloshes; shake it for a surprise ── */
(function(){
  if(REDUCED) return;
  if(!('ontouchstart' in window)) return;                 // phones and tablets only
  const cup=document.querySelector('#builder .cup'); if(!cup) return;
  const NS='http://www.w3.org/2000/svg';
  const clip=cup.querySelector('g[clip-path]'); if(!clip) return;
  const g=document.createElementNS(NS,'g'); g.id='liqG';
  while(clip.firstChild) g.appendChild(clip.firstChild);
  clip.appendChild(g);

  /* tilt: keep the liquid level while the phone leans */
  let target=0, cur=0, raf=null;
  function step(){
    cur+=(target-cur)*.14;
    g.setAttribute('transform','rotate('+cur.toFixed(2)+(cup.classList.contains('cup--arcade')?' 512 950)':' 55 92)'));
    if(Math.abs(target-cur)>.05) raf=requestAnimationFrame(step); else raf=null;
  }
  function onTilt(e){
    if(e.gamma==null) return;
    let gm=e.gamma;
    const o=(screen.orientation&&screen.orientation.angle)||window.orientation||0;
    if(o===90) gm=-(e.beta||0); else if(o===-90||o===270) gm=(e.beta||0);
    target=Math.max(-26,Math.min(26,-gm*.85));
    if(!raf) raf=requestAnimationFrame(step);
  }

  /* shake: two hard jolts inside 700ms runs Surprise Me */
  let lastMag=null, jolts=[], lastShake=0;
  function onMotion(e){
    const a=e.accelerationIncludingGravity; if(!a||a.x==null) return;
    const m=Math.hypot(a.x,a.y,a.z);
    if(lastMag!=null && Math.abs(m-lastMag)>16){
      const now=Date.now(); jolts=jolts.filter(t=>now-t<700); jolts.push(now);
      if(jolts.length>=2 && now-lastShake>1800){
        lastShake=now; jolts=[];
        const b=document.getElementById('surprise'); if(b){ b.click(); toast('🥤 Shaken, not stirred'); }
      }
    }
    lastMag=m;
  }

  let armed=false;
  async function arm(){
    if(armed) return true;
    try{
      if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
        if(await DeviceOrientationEvent.requestPermission()!=='granted') return false;
      }
      if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){
        try{ await DeviceMotionEvent.requestPermission(); }catch(x){}
      }
    }catch(x){ return false; }
    armed=true;
    addEventListener('deviceorientation',onTilt,{passive:true});
    addEventListener('devicemotion',onMotion,{passive:true});
    try{ if(!localStorage.getItem('tb-tilt-hint')){ localStorage.setItem('tb-tilt-hint','1'); toast('Tilt it. Shake it.'); } }catch(x){}
    return true;
  }
  function disarm(){
    armed=false;
    removeEventListener('deviceorientation',onTilt); removeEventListener('devicemotion',onMotion);
    target=0; if(!raf) raf=requestAnimationFrame(step);
  }
  /* iOS only grants motion access from a tap, and the prompt should only ever come from
     a control that says what it's for: a "Tilt to slosh" toggle. Android needs no prompt. */
  if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
    const t=document.createElement('button');
    t.type='button'; t.className='link tilt'; t.textContent='Tilt to slosh'; t.setAttribute('aria-pressed','false');
    t.addEventListener('click',async()=>{
      if(armed){ disarm(); t.setAttribute('aria-pressed','false'); return; }
      const ok=await arm();
      t.setAttribute('aria-pressed',ok?'true':'false');
      if(!ok) toast('Motion is off for this site in Settings');
    });
    const pv=cup.closest('.preview'); (pv||cup.parentNode).appendChild(t);
  } else { arm(); }
})();

/* ── easter egg: M-M-M-MAX THIRSTROOM ─────────────────
   Type "max" on a keyboard, or tap VHS MODE five times fast.
   A pirate broadcast from twenty minutes into the future. */
(function(){
  const LINES=[
    'W-w-we interrupt this b-b-broadcast.',
    'This is M-M-M-MAX THIRSTROOM, c-coming to you live from t-t-twenty minutes into the future.',
    'The eighties c-c-called. They want their s-s-soda back. We said n-n-no.',
    'Stay th-th-th-THIRSTY, b-b-beaches. And p-p-press PLAY at the bottom of the p-page.'
  ];
  let live=false, taps=0, tapT=0, buf='';

  addEventListener('keydown',e=>{
    if(e.target&&e.target.matches&&e.target.matches('input,textarea')) return;
    if(e.key==='Escape'&&live){ kill(); return; }
    buf=(buf+e.key.toLowerCase()).slice(-3);
    if(buf==='max'){ buf=''; hijack(); }
  });
  const vb=document.getElementById('vhsBtn');
  if(vb) vb.addEventListener('click',()=>{
    const now=Date.now(); taps=(now-tapT<900)?taps+1:1; tapT=now;
    if(taps>=5){ taps=0; hijack(); }
  });

  let box=null, timer=null;
  function hijack(){
    if(live) return; live=true;
    if(typeof REDUCED!=='undefined'&&REDUCED){ toast('📺 M-M-Max Thirstroom says: stay thirsty, beaches'); live=false; return; }
    box=document.createElement('div'); box.className='max'; box.setAttribute('role','dialog'); box.setAttribute('aria-label','Max Thirstroom');
    box.innerHTML=`
      <div class="max__stripes"></div>
      <div class="max__scan"></div>
      <div class="max__head"><img src="/assets/logo.png?v=logo20261018" alt=""><img src="/assets/logo.png?v=logo20261018" alt="" class="max__ghost max__ghost--c"><img src="/assets/logo.png?v=logo20261018" alt="" class="max__ghost max__ghost--m"></div>
      <div class="max__tv">
        <span class="max__rec">● REC</span><span class="max__ch">CH 84</span>
        <p class="max__say" aria-live="polite"></p>
      </div>
      <button class="max__x" type="button">CHANGE CHANNEL</button>`;
    document.body.appendChild(box);
    box.querySelector('.max__x').onclick=kill;
    box.addEventListener('click',e=>{ if(e.target===box) kill(); });
    setTimeout(()=>box&&box.classList.add('on'),20);
    say(0);
    try{ localStorage.setItem('tb-max','1'); }catch(e){}
  }
  function say(i){
    if(!box) return;
    const p=box.querySelector('.max__say');
    if(i>=LINES.length){ timer=setTimeout(kill,2600); return; }
    const txt=LINES[i]; let k=0; p.textContent='';
    (function tick(){
      if(!box) return;
      const ch=txt[k++]; if(ch===undefined){ timer=setTimeout(()=>say(i+1),1400); return; }
      p.textContent+=ch;
      /* stutter on the hyphenated bits, snap through the rest */
      const d = ch==='-' ? 140 : (Math.random()<.08 ? 220 : 34);
      if(ch==='-'){ box.classList.add('jolt'); setTimeout(()=>box&&box.classList.remove('jolt'),120); }
      timer=setTimeout(tick,d);
    })();
  }
  function kill(){
    if(!box) return; clearTimeout(timer);
    const b=box; box=null; b.classList.remove('on');
    setTimeout(()=>{ b.remove(); live=false; },450);
    toast('📼 Secret unlocked: Max Thirstroom. Type MAX any time.');
  }
})();

/* ── the drink card: a real 1080×1350 image of any drink, made on a canvas ──
   Used by "Send it to a friend" in the builder and by Mix me something.
   No libraries: Path2D draws the same cup the builder shows. */
(function(){
  const TB=window.TB=window.TB||{};
  const {CUP,SHELL,CREAM}=TB.cupArt;
  const MON=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  function wrap(x,text,maxW,maxLines){
    const words=String(text).split(/\s+/).filter(Boolean),lines=[];let cur='';
    for(const w of words){
      const t=cur?cur+' '+w:w;
      if(x.measureText(t).width<=maxW||!cur) cur=t; else {lines.push(cur);cur=w;}
    }
    if(cur) lines.push(cur);
    if(lines.length>maxLines){
      const keep=lines.slice(0,maxLines);let last=keep[maxLines-1]+'…';
      while(x.measureText(last).width>maxW&&last.length>2) last=last.slice(0,-2)+'…';
      keep[maxLines-1]=last; return keep;
    }
    return lines;
  }
  function seeded(str){let h=2166136261;for(const ch of str){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
    return ()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return ((h>>>0)%10000)/10000;};}

  let logo=null;
  function loadLogo(){
    if(logo) return logo;
    logo=new Promise(res=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>res(i);i.onerror=()=>res(null);i.src='/assets/logo.png?v=logo20261018';});
    return logo;
  }
  let shellPromise=null;
  function loadShell(){
    if(!shellPromise) shellPromise=new Promise(res=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>res(i);i.onerror=()=>res(null);i.src=SHELL;});
    return shellPromise;
  }
  function loadGarnish(c){
    return new Promise(res=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>res(i);i.onerror=()=>res(null);i.src=CREAM;});
  }

  TB.drawCard=async d=>{
    const W=1080,H=1350,c=document.createElement('canvas');c.width=W;c.height=H;
    const x=c.getContext('2d');
    try{ await Promise.race([Promise.all(['96px Bungee','30px "DM Mono"','32px Archivo'].map(f=>document.fonts.load(f))),new Promise(r=>setTimeout(r,1500))]); }catch(e){}
    const [img,shell,garnish]=await Promise.all([loadLogo(),loadShell(),loadGarnish(d.colors)]);
    const rnd=seeded(d.name||'thirsty');
    const ls=v=>{ if('letterSpacing' in x) x.letterSpacing=v; };

    /* measure the words first, then fit the scene above them */
    const fitName=max=>{let sz=max,ln;
      for(;sz>=56;sz-=4){x.font=sz+'px Bungee, Impact, sans-serif';ln=wrap(x,(d.name||'').toUpperCase(),940,9);
        if(ln.length<=2&&ln.every(l=>x.measureText(l).width<=940)) return [sz,ln];}
      sz=56;x.font=sz+'px Bungee, Impact, sans-serif';return [sz,wrap(x,(d.name||'').toUpperCase(),940,2)];};
    x.font='400 29px "DM Mono", monospace';const rec=wrap(x,d.recipe||'',940,d.why?2:3);
    let whyMax=d.why?2:0,cap=104,size,lines,why,HZ;
    /* last baseline must clear the footer (H-110); squeeze the why, then the name, before the scene shrinks */
    for(let pass=0;pass<8;pass++){
      [size,lines]=fitName(cap);
      x.font='400 31px Archivo, sans-serif';why=whyMax?wrap(x,'\u201c'+d.why+'\u201d',900,whyMax):[];
      const body=108+size*.98+16+lines.length*size*1.02+6+rec.length*42+(why.length?12+why.length*44:0)-42;
      HZ=Math.round(Math.min(770,H-110-body));
      if(HZ>=640) break;
      if(whyMax>1) whyMax--; else cap-=8;
    }
    HZ=Math.max(640,HZ);
    x.font=size+'px Bungee, Impact, sans-serif';const nameF=x.font;

    /* sky, stars, sun */
    let g=x.createLinearGradient(0,0,0,HZ);
    [[0,'#031C26'],[.16,'#0B2140'],[.4,'#37124F'],[.58,'#5C2A72'],[.72,'#96447F'],[.84,'#C25896'],[.93,'#D66F8A'],[1,'#DE9A6E']]
      .forEach(([o,col])=>g.addColorStop(o,col));
    x.fillStyle=g;x.fillRect(0,0,W,HZ);
    x.fillStyle='#09010F';x.fillRect(0,HZ,W,H-HZ);
    for(let i=0;i<70;i++){x.globalAlpha=.25+rnd()*.6;x.fillStyle=rnd()<.2?'#ffd9f2':'#fff';
      x.beginPath();x.arc(rnd()*W,rnd()*HZ*.55,rnd()*2+.6,0,7);x.fill();}
    x.globalAlpha=1;
    const R=330,sun=document.createElement('canvas');sun.width=2*R;sun.height=R;
    const s=sun.getContext('2d');g=s.createLinearGradient(0,0,0,R);
    [[0,'#FFF3B0'],[.22,'#FFD166'],[.46,'#FF9E5E'],[.78,'#FF3CAC'],[1,'#C21A8F']].forEach(([o,col])=>g.addColorStop(o,col));
    s.fillStyle=g;s.beginPath();s.arc(R,R,R,Math.PI,0);s.fill();
    s.globalCompositeOperation='destination-out';
    [[.5,.035],[.6,.045],[.7,.055],[.8,.065],[.9,.075]].forEach(([y,h])=>s.fillRect(0,R*y,2*R,R*h));
    x.save();x.shadowColor='rgba(255,60,172,.55)';x.shadowBlur=90;x.drawImage(sun,W/2-R,HZ-R);x.restore();

    /* grid floor, fading into the dark text area */
    x.save();x.beginPath();x.rect(0,HZ,W,H-HZ);x.clip();
    x.strokeStyle='rgba(42,245,228,.55)';x.lineWidth=2;
    for(let i=-24;i<=24;i++){x.beginPath();x.moveTo(W/2+i*46,HZ);x.lineTo(W/2+i*520,H);x.stroke();}
    x.strokeStyle='rgba(255,60,172,.5)';
    for(let i=1;i<14;i++){const y=HZ+(H-HZ)*Math.pow(i/14,2.1);x.beginPath();x.moveTo(0,y);x.lineTo(W,y);x.stroke();}
    g=x.createLinearGradient(0,HZ,0,HZ+170);g.addColorStop(0,'rgba(9,1,15,0)');g.addColorStop(1,'rgba(9,1,15,.94)');
    x.fillStyle=g;x.fillRect(0,HZ,W,H-HZ);x.restore();
    x.save();x.shadowColor='rgba(42,245,228,.9)';x.shadowBlur=24;x.fillStyle='rgba(220,255,252,.95)';x.fillRect(0,HZ-1,W,3);x.restore();

    /* logo */
    const lw=360;
    if(img){const lh=lw*img.height/img.width;x.save();x.globalCompositeOperation='screen';x.drawImage(img,W/2-lw/2,44,lw,lh);x.restore();}

    /* the cup, sized so the straw clears the logo */
    const k=Math.min(3.2,(HZ+40-300)/135),ox=W/2-55*k,oy=HZ+40-137*k,col=d.colors||{};
    x.save();x.translate(ox,oy);x.scale(k,k);
    x.translate(5,0);x.scale(.09765625,.09765625);
    const cup=new Path2D(CUP);
    if(shell)x.drawImage(shell,0,0,1024,1536);
    else{x.strokeStyle='#00dcff';x.lineWidth=10;x.stroke(cup);}
    g=x.createLinearGradient(0,586,0,1400);g.addColorStop(0,col.top||'#9a4a6a');g.addColorStop(1,col.bot||'#7A3B26');
    x.save();x.globalAlpha=.08;x.fillStyle=g;x.fill(cup);x.restore();
    if(col.cream&&garnish){
      const layer=document.createElement('canvas');layer.width=1024;layer.height=1536;
      const layerCtx=layer.getContext('2d');layerCtx.drawImage(garnish,0,0);
      layerCtx.globalCompositeOperation='source-in';layerCtx.fillStyle=col.cream;layerCtx.fillRect(0,0,1024,1536);
      x.drawImage(layer,0,0);
    }
    if(img)x.drawImage(img,312,737,399,266);
    x.restore();

    /* words */
    x.textAlign='center';x.textBaseline='alphabetic';
    let y=HZ+108;
    x.font='500 30px "DM Mono", monospace';ls('6px');x.fillStyle='#2AF5E4';
    x.shadowColor='rgba(42,245,228,.8)';x.shadowBlur=14;
    x.fillText(String(d.eyebrow||'').toUpperCase(),W/2,y);x.shadowBlur=0;ls('0px');
    x.font=nameF;y+=size*.98+16;
    lines.forEach(l=>{
      const gg=x.createLinearGradient(0,y-size*.82,0,y);
      [[0,'#FFFFFF'],[.34,'#CFEFFF'],[.46,'#7FD8FF'],[.52,'#243B8F'],[.6,'#7FD8FF'],[.78,'#FF9ADF'],[1,'#FF3CAC']].forEach(([o,cl])=>gg.addColorStop(o,cl));
      x.fillStyle='rgba(90,10,80,.85)';x.fillText(l,W/2,y+5);
      x.save();x.shadowColor='rgba(42,245,228,.45)';x.shadowBlur=26;x.fillStyle=gg;x.fillText(l,W/2,y);x.restore();
      y+=size*1.02;
    });
    y+=6;
    x.font='400 29px "DM Mono", monospace';x.fillStyle='rgba(255,244,250,.86)';
    rec.forEach(l=>{x.fillText(l,W/2,y);y+=42;});
    if(why.length){y+=12;x.font='400 31px Archivo, sans-serif';x.fillStyle='#FFD166';why.forEach(l=>{x.fillText(l,W/2,y);y+=44;});}

    /* camcorder furniture */
    x.textAlign='left';x.font='500 28px "DM Mono", monospace';ls('4px');
    x.fillStyle='#fff';x.shadowColor='rgba(0,0,0,.6)';x.shadowBlur=6;x.fillText('▶ PLAY',52,74);
    x.fillStyle='#2AF5E4';x.fillText('THIRSTYBEACHES.COM',52,H-46);
    const dt=new Date();x.textAlign='right';x.fillStyle='#FFB347';x.shadowColor='rgba(255,122,69,.9)';x.shadowBlur=12;
    x.fillText(MON[dt.getMonth()]+'.'+String(dt.getDate()).padStart(2,'0')+' '+dt.getFullYear(),W-52,H-46);
    x.shadowBlur=0;ls('0px');
    /* faint scanlines */
    x.fillStyle='rgba(0,0,0,.10)';for(let yy=0;yy<H;yy+=4)x.fillRect(0,yy,W,1);
    return await new Promise(r=>c.toBlob(r,'image/jpeg',.9));
  };

  /* the dialog: preview, Send it (image + link), Save image, Copy link */
  const dlg=document.getElementById('dcard'); if(!dlg) return;
  const imgEl=document.getElementById('dcardImg'),send=document.getElementById('dcardSend'),
        save=document.getElementById('dcardSave');
  let cur=null,file=null,obj=null;
  const slug=s=>String(s||'drink').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'drink';

  TB.openCard=async d=>{
    cur=d;file=null;
    if(obj){URL.revokeObjectURL(obj);obj=null;}
    imgEl.removeAttribute('src');imgEl.alt='';dlg.classList.add('is-loading');
    send.hidden=false;send.className='btn btn--solid';save.className='btn btn--ghost';
    if(typeof dlg.showModal==='function'){ if(!dlg.open) dlg.showModal(); } else dlg.setAttribute('open','');
    const blob=await TB.drawCard(d);
    if(cur!==d||!blob) return;
    obj=URL.createObjectURL(blob);
    imgEl.src=obj;imgEl.alt='Drink card: '+d.name+'. '+(d.recipe||'');
    dlg.classList.remove('is-loading');
    const fname='thirsty-beaches-'+slug(d.file||d.name)+'.jpg';
    save.href=obj;save.download=fname;
    try{ file=new File([blob],fname,{type:'image/jpeg'}); }catch(e){ file=null; }
    const canFiles=!!(file&&navigator.canShare&&navigator.canShare({files:[file]}));
    if(!canFiles&&!navigator.share){ send.hidden=true; save.className='btn btn--solid'; }
  };
  /* share must start inside the tap, so nothing async happens before it */
  send.addEventListener('click',()=>{
    if(!cur) return;
    const data={title:'Thirsty Beaches',text:cur.text+' '+cur.url};
    if(file&&navigator.canShare&&navigator.canShare({files:[file]})) data.files=[file];
    else data.url=cur.url;
    navigator.share(data).catch(()=>{});
  });
  document.getElementById('dcardCopy').addEventListener('click',async()=>{
    if(!cur) return;
    try{ await navigator.clipboard.writeText(cur.url); toast('Link copied'); }catch(e){ toast('Could not copy'); }
  });
  const close=()=>{ if(typeof dlg.close==='function') dlg.close(); else dlg.removeAttribute('open'); };
  document.getElementById('dcardX').addEventListener('click',close);
  dlg.addEventListener('click',e=>{ if(e.target===dlg) close(); });
})();

/* ── Mix me something ─────────────────────────────────
   Front end for POST /api/mix (Tollbooth, functions/). Until that ships it runs on a
   local mock that only uses real builder ingredients. The section stays hidden on
   thirstybeaches.com while in mock mode (add ?mix=1 to preview it there).

   Assumed contract (ONE place to change: apiMix + normalize):
     request  JSON {mood, likes, dislikes, kid:boolean, image?: "data:image/jpeg;base64,…" (≤768px, never sent when kid)}
     response {name, base, syrups[], cream, topper, why, size, price, build_hash|null}; errors {error} with 400/429 */
(function(){
  const MIX_MODE='api';                       // 'mock' | 'api'
  const sec=document.getElementById('mix'); if(!sec) return;
  const PROD=/(^|\.)thirstybeaches\.com$/.test(location.hostname);
  if(MIX_MODE!=='api'&&PROD&&!/[?&]mix=1\b/.test(location.search)) return;
  sec.hidden=false;
  const heroMix=document.getElementById('heroMixBtn'); if(heroMix) heroMix.hidden=false; /* the hero button only shows once the mixer is on */
  const TB=window.TB||{};
  const $=id=>document.getElementById(id);
  const form=$('mixForm'),out=$('mixOut'),go=$('mixGo'),err=$('mixErr'),mood=$('mixMood'),
        likes=$('mixLikes'),nope=$('mixNope'),kid=$('mixKid'),photo=$('mixPhoto'),thumb=$('mixThumb'),
        pT=$('mixPhotoT'),pS=$('mixPhotoS'),pL=$('mixPhotoLbl');
  let shot=null,tries=0,last=null;

  /* ingredient colours: exact builder matches first, then keywords for whatever the AI picks */
  const KEYS=[[/dr\.? ?pepper/,'#7A3B26'],[/root ?beer/,'#4B2A19'],[/coke|cola|pepsi/,'#3A1E14'],[/dew/,'#B9DC4B'],
    [/strawberry lemonade|pink lemonade/,'#FF6F91'],[/lemonade|lemon/,'#FFE27A'],[/orange|fanta/,'#FF8A2C'],
    [/sprite|7 ?up|sparkling|tonic|fresca|ginger|club/,'#CFEFA8'],[/energy/,'#F2E27A'],[/blue/,'#2FA8FF'],
    [/raspberry/,'#E0245E'],[/strawberr/,'#FF5470'],[/cherry|grenadine/,'#E01F45'],[/peach/,'#FFB07A'],
    [/mango|passion/,'#FFC244'],[/pineapple/,'#FFD84D'],[/lime/,'#8BE04E'],[/watermelon|guava/,'#FF6F7F'],
    [/grape|blackberr/,'#6B2D8C'],[/pomegranate|cranberr/,'#C0143C'],[/grapefruit/,'#FF8C7A'],
    [/cotton candy/,'#FFB3E6'],[/caramel|butterscotch|cinnamon|pumpkin/,'#C68642'],[/chocolate|mocha/,'#5A3220'],
    [/apple/,'#B5E655'],[/coconut|vanilla|cream|half|marshmallow|whip/,'#F4EBDD'],[/punch/,'#E8344E']];
  function colorOf(name,fallback){
    const n=String(name||'').toLowerCase(); if(!n) return fallback;
    for(const L of Object.values(TB.lists||{})) for(const it of L) if(it.n.toLowerCase()===n&&it.c) return it.c;
    for(const [re,c] of KEYS) if(re.test(n)) return c;
    return fallback;
  }
  function blend(a,b,t){const p=(h,i)=>parseInt(h.slice(1+i*2,3+i*2),16);
    return '#'+[0,1,2].map(i=>Math.round(p(a,i)+(p(b,i)-p(a,i))*t).toString(16).padStart(2,'0')).join('');}
  function colorsFor(d){
    let liq=colorOf(d.base,'#C25896');
    d.syrups.forEach((s,i)=>{liq=blend(liq,colorOf(s,liq),i?.14:.28);});
    return {top:blend(liq,'#ffffff',.18),bot:liq,
      cream:d.cream&&!/^no\b|none/i.test(d.cream)?colorOf(d.cream,'#FFF6E8'):null,
      topper:d.topper&&!/^no|none|nothing/i.test(d.topper)?colorOf(d.topper,'#FF3F6C'):null,garnish:d.topper};
  }

  const clean=(v,n)=>String(v==null?'':v).replace(/[\u0000-\u001f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,n);
  function normalize(r){
    if(!r||typeof r!=='object') throw new Error('shape');
    const syr=(Array.isArray(r.syrups)?r.syrups:[r.syrups]).map(s=>clean(s,32)).filter(Boolean).slice(0,3);
    const price=typeof r.price==='number'?r.price:parseFloat(String(r.price||'').replace(/[^\d.]/g,''));
    const d={name:clean(r.name,48),base:clean(r.base,40),syrups:syr,cream:clean(r.cream,32),topper:clean(r.topper,32),
      why:clean(r.why,220),price:isFinite(price)&&price>0&&price<50?price:null,hash:clean(r.build_hash,24)};
    if(!d.name||!d.base) throw new Error('shape');
    return d;
  }
  const recipeOf=d=>{
    const p=[d.base]; if(d.syrups.length) p.push(d.syrups.join(' + ')+(d.syrups.length>1?' syrups':' syrup'));
    if(d.cream&&!/^no\b|none/i.test(d.cream)) p.push(d.cream);
    if(d.topper&&!/^no|none|nothing/i.test(d.topper)) p.push(d.topper+' on top');
    p.push('over nugget ice'); return p.join(' · ');
  };
  const money=v=>v==null?'':'$'+v.toFixed(2);

  /* ---- the real call (matches Tollbooth's draft functions/api/mix.js: JSON body, photo as a data URL) ---- */
  const toDataURL=b=>new Promise((res,rej)=>{const f=new FileReader();f.onload=()=>res(f.result);f.onerror=rej;f.readAsDataURL(b);});
  async function apiMix(inp){
    const body={mood:inp.mood,likes:inp.likes,dislikes:inp.dislikes,kid:!!inp.kid};
    if(inp.photo&&!inp.kid) body.image=await toDataURL(inp.photo);
    const ctrl=new AbortController(),t=setTimeout(()=>ctrl.abort(),25000);
    try{
      const r=await fetch('/api/mix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctrl.signal});
      const d=await r.json().catch(()=>null);
      if(r.status===429) throw Object.assign(new Error('busy'),{code:'busy'});
      if(!r.ok) throw Object.assign(new Error('http '+r.status),{status:r.status,msg:d&&typeof d.error==='string'?clean(d.error,140):''});
      return normalize(d);
    }finally{ clearTimeout(t); }
  }

  /* ---- the mock: real builder ingredients only, honours likes/dislikes/kid ---- */
  function hash(s){let h=2166136261;for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
  function mockMix(inp){
    const L=TB.lists,seed=hash([inp.mood,inp.likes,inp.dislikes,inp.kid,!!inp.photo,tries].join('|').toLowerCase());
    let n=seed; const r=k=>{n=Math.imul(n^(n>>>15),2246822507)>>>0;return n%k;};
    const words=s=>s.toLowerCase().split(/[^a-z]+/).filter(w=>w.length>2);
    const hate=words(inp.dislikes),love=words(inp.likes),m=inp.mood.toLowerCase();
    const ok=it=>!hate.some(w=>it.n.toLowerCase().includes(w));
    const loved=it=>love.some(w=>it.n.toLowerCase().includes(w));
    const choose=(list,prefer)=>{const a=list.filter(ok),p=a.filter(loved),q=a.filter(prefer||(()=>false));
      const pool=p.length?p:q.length?q:a.length?a:list; return pool[r(pool.length)];};
    const caff=/dr pepper|coke|mountain dew/i;
    const bases=inp.kid?L.BASES.filter(b=>!caff.test(b.n)):L.BASES;
    const base=choose(bases,b=>(/boost|tired|caffeine|energy|monday|wake/.test(m)&&caff.test(b.n))
      ||(/sour|tart|zing/.test(m)&&/lemonade/i.test(b.n))||(/beach|tropic|vacation|sun/.test(m)&&/sprite|lemonade|fanta/i.test(b.n)));
    const syrPref=s=>(/sweet|sugar|dessert|treat/.test(m)&&/vanilla|strawberry|coconut/i.test(s.n))
      ||(/beach|tropic|vacation|sun/.test(m)&&/coconut|mango|peach/i.test(s.n))||(/sour|tart/.test(m)&&/raspberry/i.test(s.n));
    const s1=choose(L.SYRUPS,syrPref); let s2=choose(L.SYRUPS.filter(s=>s!==s1),syrPref);
    if(r(3)===0) s2=null;
    const creams=L.CREAMS.filter(c=>c.c); const cream=hate.some(w=>/cream|dairy|milk/.test(w))?null:choose(creams);
    const top=choose(L.TOPS.filter(t=>t.c));
    const A=['Low Tide','Neon','Sunburnt','Midnight','Barefoot','Salt-Air','Golden Hour','Boardwalk','Heatwave','Palm Shade','Tidepool','Last Call'];
    const B=['Lullaby','Alibi','Confession','Mixtape','Postcard','Detour','Daydream','Encore','Rumor','Getaway','Love Letter','Slow Dance'];
    const said=inp.mood?'You said “'+clean(inp.mood,40)+'”, so ':'';
    const why=said+base.n+' for the backbone, '+s1.n.toLowerCase()+(s2?' and '+s2.n.toLowerCase():'')+' for the mood'
      +(love.length?', and we leaned into the '+love[0]:'')+(hate.length?'. No '+hate[0]+', promise':'')+'.';
    return normalize({name:A[r(A.length)]+' '+B[r(B.length)],base:base.n,syrups:[s1.n].concat(s2?[s2.n]:[]),
      cream:cream?cream.n:'',topper:top?top.n:'',why,price:inp.kid?2.99:3.49,
      build_hash:'MIX-'+(seed%65536).toString(16).toUpperCase().padStart(4,'0')});
  }

  /* ---- photo: shrink on the phone before it goes anywhere ---- */
  async function shrink(f){
    try{
      const bmp=await createImageBitmap(f,{imageOrientation:'from-image'});
      const k=Math.min(1,768/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');
      c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);
      c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
      return await new Promise(r=>c.toBlob(r,'image/jpeg',.82));
    }catch(e){ return f.size<5e6?f:null; }
  }
  function setPhoto(b){
    if(thumb._u) URL.revokeObjectURL(thumb._u);
    shot=b; thumb._u=b?URL.createObjectURL(b):null;
    thumb.style.backgroundImage=b?'url('+thumb._u+')':'';
    pL.classList.toggle('has',!!b);
    pT.textContent=b?'Selfie added':'Add a selfie';
    pS.textContent=b?'Tap to change. Clear it with the ×.':'Optional. Only used to pick your drink.';
    let x=pL.querySelector('.mix__px');
    if(b&&!x){x=document.createElement('button');x.type='button';x.className='mix__px';x.setAttribute('aria-label','Remove selfie');x.textContent='×';
      x.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();photo.value='';setPhoto(null);});pL.appendChild(x);}
    if(!b&&x) x.remove();
  }
  photo.addEventListener('change',async()=>{const f=photo.files&&photo.files[0]; setPhoto(f?await shrink(f):null);});
  /* no photos of kids: the kid toggle turns the camera off */
  kid.addEventListener('change',()=>{
    if(kid.checked){photo.value='';setPhoto(null);photo.disabled=true;pL.classList.add('off');pS.textContent='No photos on kids’ drinks.';}
    else{photo.disabled=false;pL.classList.remove('off');setPhoto(null);}
  });

  /* quick moods fill the box; tapping again clears it */
  const chips=[...sec.querySelectorAll('.mix__moods .opt')];
  const syncChips=()=>chips.forEach(c=>c.setAttribute('aria-pressed',mood.value.trim().toLowerCase()===c.dataset.mood.toLowerCase()?'true':'false'));
  chips.forEach(c=>c.addEventListener('click',()=>{mood.value=c.getAttribute('aria-pressed')==='true'?'':c.dataset.mood;syncChips();}));
  mood.addEventListener('input',syncChips);

  /* ---- states ---- */
  const idleCup=()=>TB.cupSVG({top:'#2a1850',bot:'#1B0538',cream:null,topper:null},'An empty cup');
  function idle(){
    out.className='mix__out is-idle';
    out.innerHTML='<div class="mix__idle">'+idleCup()+'<p>Your drink shows up here.</p></div>';
    TB.wakeCups?.(out);
  }
  const LINES=['Reading the vibe…','Checking the syrup shelf…','Arguing about the cream…','Pouring…'];
  function pouring(){
    out.className='mix__out is-pouring';
    out.innerHTML='<div class="mix__idle">'+TB.cupSVG({top:'#FF9ADF',bot:'#FF3CAC',cream:'#FFF6E8',topper:null},'Mixing your drink')+'<p class="mix__status" role="status">'+LINES[0]+'</p></div>';
    TB.wakeCups?.(out);
    let i=0; const p=out.querySelector('.mix__status');
    return setInterval(()=>{ if(p) p.textContent=LINES[Math.min(++i,LINES.length-1)]; },900);
  }
  function result(d,shared){
    last=d;
    const col=colorsFor(d);
    out.className='mix__out is-done';
    out.innerHTML='';
    const card=document.createElement('div');card.className='mix__card';
    const el=(tag,cls,txt)=>{const e=document.createElement(tag);e.className=cls;if(txt!=null)e.textContent=txt;card.appendChild(e);return e;};
    el('p','mix__k',(shared?'Sent to you':'Mixed for you')+(d.price!=null?' · '+money(d.price):''));
    const cupBox=el('div','mix__cup');cupBox.innerHTML=TB.cupSVG(col,d.name);
    el('h3','mix__name',d.name);
    el('p','mix__recipe',recipeOf(d));
    if(d.why) el('p','mix__why',d.why);
    if(d.hash&&!PRELAUNCH) el('p','mix__code','Window code '+d.hash);
    const acts=document.createElement('div');acts.className='mix__acts';card.appendChild(acts);
    const b1=document.createElement('button');b1.type='button';b1.className='btn btn--solid';b1.textContent='Show this at the window';
    const b2=document.createElement('button');b2.type='button';b2.className='btn btn--ghost';b2.textContent='Send it to a friend';
    acts.append(b1,b2);
    const again=el('button','link mix__again',shared?'Now mix mine':'Mix another');again.type='button';
    out.appendChild(card);
    TB.wakeCups?.(card);
    /* before opening day there's no window: sign up instead, or get it at your event */
    if(PRELAUNCH&&TB.prelaunchActs) TB.prelaunchActs(b1);
    else b1.addEventListener('click',()=>{
      const wc=$('wcard'); if(!wc) return;
      $('wcardK').textContent='Mixed for you'+(d.price!=null?' · '+money(d.price):'');
      $('wcardName').textContent=d.name; $('wcardRecipe').textContent=recipeOf(d);
      const code=$('wcardCode'); code.hidden=!d.hash; code.textContent=d.hash?'Code '+d.hash:'';
      if(typeof wc.showModal==='function') wc.showModal(); else wc.setAttribute('open','');
    });
    b2.addEventListener('click',()=>{
      const url=location.origin+'/#mix='+pack(d);
      TB.openCard&&TB.openCard({eyebrow:'Mixed for me'+(d.price!=null?' · '+money(d.price):''),name:d.name,recipe:recipeOf(d),
        why:d.why,colors:col,url,text:'Thirsty Beaches invented me a drink: '+d.name+'. Get yours:',file:d.name});
    });
    again.addEventListener('click',()=>{
      if(shared){ idle(); sec.classList.remove('has-result'); }
      form.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'start'});
      mood.focus({preventScroll:true});
    });
    sec.classList.add('has-result');
  }

  /* share links carry the drink itself, so they work without a server lookup */
  const pack=d=>{const j=JSON.stringify({n:d.name,b:d.base,s:d.syrups,c:d.cream,t:d.topper,w:d.why,p:d.price,h:d.hash});
    return btoa(unescape(encodeURIComponent(j))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
  const unpack=s=>{const j=decodeURIComponent(escape(atob(s.replace(/-/g,'+').replace(/_/g,'/'))));
    const o=JSON.parse(j); return normalize({name:o.n,base:o.b,syrups:o.s,cream:o.c,topper:o.t,why:o.w,price:o.p,build_hash:o.h});};

  /* errors: friendly copy, and scroll the message into view (the form may be off-screen
     after the result area took over the phone screen). RATE_LIMIT in functions/api/mix.js
     is 5 mixes per visitor per hour. */
  function showErr(x){
    const st=x&&x.status||0, m=x&&x.msg||'';
    let t, toBuild=false;
    if(x&&x.code==='busy'){ t='That\u2019s 5 mixes this hour, the most we pour per person. Build your own while the mixer cools off.'; toBuild=true; }
    else if(st>=500||/not configured/i.test(m)){ t='The mixer is taking a break right now. Build your own instead.'; toBuild=true; }
    else if(m&&st>=400&&st<500) t=m;
    else { t='The mixer hiccuped. Try again, or build your own below.'; toBuild=true; }
    err.textContent=t;
    if(toBuild){ err.append(' '); const a=document.createElement('a'); a.href='#build'; a.className='link'; a.textContent='Go to the builder'; err.appendChild(a); }
    err.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'center'});
    err.focus({preventScroll:true});
  }

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    err.textContent='';
    const inp={mood:clean(mood.value,80),likes:clean(likes.value,60),dislikes:clean(nope.value,60),kid:kid.checked,photo:shot};
    if(!inp.mood&&!inp.likes&&!inp.photo){ err.textContent='Give us a mood, something you love, or a selfie.'; mood.focus(); return; }
    go.disabled=true; tries++;
    sec.classList.add('has-result');
    const t=pouring();
    if(innerWidth<900) out.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'center'});
    try{
      const d=MIX_MODE==='api'?await apiMix(inp):await new Promise(r=>setTimeout(()=>r(mockMix(inp)),REDUCED?300:2200));
      clearInterval(t); result(d,false);
      if(innerWidth<900) out.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'start'});
    }catch(x){
      clearInterval(t); idle(); sec.classList.remove('has-result');
      showErr(x);
    }finally{ go.disabled=false; }
  });

  idle();
  if(location.hash.indexOf('#mix=')===0){
    try{ result(unpack(location.hash.slice(5)),true);
      requestAnimationFrame(()=>sec.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'start'})); }
    catch(e){ toast('That drink got lost on the way over. Mix your own.'); }
  }
})();

/* ── Order ahead button ───────────────────────────── */
/* Shown only while the trailer is live AND the station has ordering ahead switched on
   (station GET /api/order-ahead -> {enabled, open}; it reads the same tb-where /where as the
   "Open now" pill). On the home page it also waits for that pill (TB.open / 'tb:open').
   Buttons: [data-order-ahead] in the page (hero / menu header) + a floating one that shows
   while those are scrolled out of view. Hidden again the moment either signal says no. */
(function(){
  const API='https://station.thirstybeaches.com/api/order-ahead';
  const URL_='https://station.thirstybeaches.com/order';
  const inPage=[...document.querySelectorAll('[data-order-ahead]')];
  if(!inPage.length) return;
  const homeGate=!!document.getElementById('tbStatus');        // home page: the /where poller above is the first gate
  const fab=document.createElement('a');
  fab.className='oa-fab'; fab.href=URL_; fab.hidden=true; fab.textContent='Order ahead';
  fab.setAttribute('aria-label','Order ahead: order and pay on your phone, pick up at the window');
  document.body.appendChild(fab);
  let on=false, seen=new Set();
  function paint(){
    inPage.forEach(el=>{ el.hidden=!on; });
    fab.hidden=!on||seen.size>0;
    document.body.classList.toggle('oa-on',on&&!fab.hidden);
  }
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(es=>{ es.forEach(e=>{ if(e.isIntersecting) seen.add(e.target); else seen.delete(e.target); }); paint(); });
    inPage.forEach(el=>io.observe(el));
  }
  async function check(){
    if(homeGate&&window.TB&&window.TB.open===false){ on=false; paint(); return; }
    const ctrl=('AbortController' in window)?new AbortController():null;
    const to=ctrl?setTimeout(()=>ctrl.abort(),6000):null;
    try{
      const r=await fetch(API,{signal:ctrl?ctrl.signal:undefined});
      if(to) clearTimeout(to);
      const d=r.ok?await r.json():null;
      on=!!(d&&d.enabled===true&&d.open===true)&&!(homeGate&&!(window.TB&&window.TB.open));
    }catch(e){ if(to) clearTimeout(to); on=false; }
    paint();
  }
  document.addEventListener('tb:open',check);
  if(!homeGate) check();
  setInterval(check,60000);
})();
