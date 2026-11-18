/* Thirsty Beaches — event quote form (catering pages)
   Sends to the tb-where Worker (POST /quote). If that can't be reached it retries once, then shows an
   inline error that keeps everything typed, with "Try again" and an "Email it instead" link
   (pre-filled email to hello@thirstybeaches.com), so a request is never lost.
   Markup contract: <form class="quote" id="quoteForm"> … see tools/build-catering.py form().
   URL params: ?event=wedding (loose match against the event options), ?city=Lehi (prefills an empty city). */
(function(){
  const API='https://tb-where.nicholasroper.workers.dev';
  const EMAIL='hello@thirstybeaches.com';
  const EMAIL_RE=/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
  const form=document.getElementById('quoteForm'); if(!form) return;
  const msg=form.querySelector('.quote__msg'), go=form.querySelector('[type="submit"]'), GO=go.textContent;
  const more=form.querySelector('.quote__more'), nav=document.querySelector('.nav'), bar=document.querySelector('.bookbar');
  const $=n=>{ const e=form.elements[n]; return e&&e.nodeType===1?e:null; };
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const reduce=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  let alertBox=form.querySelector('.quote__alert');
  if(!alertBox){ alertBox=document.createElement('div'); alertBox.className='quote__alert'; alertBox.setAttribute('role','alert'); alertBox.tabIndex=-1; alertBox.hidden=true; form.prepend(alertBox); }

  // real sticky-nav height -> CSS scroll-padding (so #quote and focused fields don't land under it)
  const setNav=()=>{ if(nav) document.documentElement.style.setProperty('--navh',Math.round(nav.getBoundingClientRect().height)+'px'); };
  setNav(); addEventListener('resize',setNav);
  if(nav&&'ResizeObserver'in window) new ResizeObserver(setNav).observe(nav);

  // label each control by its visible label text only, so the error text inside the <label> is a description, not part of the name
  form.querySelectorAll('label.qf>span:first-child').forEach(s=>{
    const c=s.parentNode.querySelector('input,select,textarea'); if(!c||!c.name) return;
    s.id=s.id||'qlab-'+c.name; c.setAttribute('aria-labelledby',s.id);
  });

  // dates in the visitor's own time zone (toISOString is UTC, which is "tomorrow" after 6pm in Utah)
  const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const minDate=()=>{ const n=new Date(); return ymd(new Date(n.getFullYear(),n.getMonth(),n.getDate()+1)); };
  if($('date')) $('date').min=minDate();

  // preselect the event type from ?event= / data-event, matching loosely ("wedding" -> "Wedding or reception")
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9+]+/g,' ').trim();
  function pickEvent(want){
    const sel=$('event'), w=norm(want); if(!sel||!w) return;
    const os=[...sel.options].filter(o=>o.value), v=o=>norm(o.value);
    const o=os.find(o=>v(o)===w)||os.find(o=>v(o).startsWith(w))||os.find(o=>(' '+v(o)).includes(' '+w))
      ||os.find(o=>v(o).includes(w))||os.find(o=>(' '+w+' ').includes(' '+v(o).split(' ')[0]));
    if(o){ sel.value=o.value; clearErr('event'); }
  }
  function applyParams(sp){
    if(sp.get('event')) pickEvent(sp.get('event'));
    const c=(sp.get('city')||'').trim();
    if(c&&$('city')&&!$('city').value.trim()) $('city').value=c.slice(0,120);
  }
  const sp=new URLSearchParams(location.search);
  if(!sp.get('event')&&form.dataset.event) pickEvent(form.dataset.event);
  applyParams(sp);
  // same-page links like ?event=hoa#quote: apply without reloading the page
  document.addEventListener('click',e=>{
    const a=e.target.closest&&e.target.closest('a[href*="#quote"]');
    if(!a||e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
    const u=new URL(a.href,location.href);
    if(u.origin!==location.origin||u.pathname!==location.pathname||u.hash!=='#quote'||!u.search) return;
    e.preventDefault(); applyParams(u.searchParams);
    try{ history.pushState(null,'',u.pathname+u.search+u.hash); }catch(_){}
    const sec=document.getElementById('quote');
    sec.scrollIntoView({behavior:reduce()?'auto':'smooth',block:'start'});
    if(!sec.hasAttribute('tabindex')) sec.setAttribute('tabindex','-1');
    sec.focus({preventScroll:true});
  });

  /* ---------- validation feedback: summary above the fields + a message under each field ---------- */
  const NEED={name:'Add your name.',email:'Add an email so we can send your quote.',event:'Pick the kind of event.',
    date:'Pick the event date.',city:'Add the city or venue.',guests:'Pick a rough guest count.'};
  const BAD={email:'That email doesn’t look right. Check for a typo.',date:'Pick a date from tomorrow onward.',
    datefmt:'Use the date picker, or type the date as YYYY-MM-DD.'};
  const labelOf=n=>{ const s=document.getElementById('qlab-'+n); return s?s.textContent.replace('*','').trim():n; };
  function setErr(n,text){
    const f=$(n); if(!f) return;
    let e=document.getElementById('qerr-'+n);
    if(!e){ e=document.createElement('span'); e.className='qf__err'; e.id='qerr-'+n; f.insertAdjacentElement('afterend',e); }
    e.textContent=text; e.hidden=false;
    f.setAttribute('aria-invalid','true'); f.setAttribute('aria-describedby',e.id);
  }
  function clearErr(n){
    const f=$(n), e=document.getElementById('qerr-'+n);
    if(f){ f.removeAttribute('aria-invalid'); f.removeAttribute('aria-describedby'); }
    if(e){ e.hidden=true; e.textContent=''; }
  }
  function summary(){
    const bad=[...form.querySelectorAll('[aria-invalid="true"]')];
    if(!bad.length){ alertBox.hidden=true; alertBox.innerHTML=''; return; }
    alertBox.innerHTML='<p><strong>Almost there.</strong> '+(bad.length>1?bad.length+' things need':'One thing needs')+' a look before we can quote it:</p><ul>'+
      bad.map(f=>'<li><a href="#qerr-'+esc(f.name)+'" data-f="'+esc(f.name)+'">'+esc(labelOf(f.name))+'</a>: '+esc(document.getElementById('qerr-'+f.name).textContent)+'</li>').join('')+'</ul>';
    alertBox.hidden=false;
  }
  alertBox.addEventListener('click',e=>{ const a=e.target.closest('a[data-f]'); if(!a) return; e.preventDefault(); reveal($(a.dataset.f),false); });
  const barSpace=()=>bar&&!bar.classList.contains('is-hidden')&&getComputedStyle(bar).display!=='none'?bar.getBoundingClientRect().height:0;
  // focus a field and scroll it (and, if both fit, the summary above it) into view below the sticky nav
  function reveal(el,withAlert){
    if(!el) return;
    const top=(nav?nav.getBoundingClientRect().height:0)+12, room=innerHeight-barSpace()-top-12;
    const box=(el.closest('.qf')||el).getBoundingClientRect();
    let y=scrollY+box.top-top;
    if(withAlert&&!alertBox.hidden){ const a=alertBox.getBoundingClientRect(); if(box.bottom-a.top<=room) y=scrollY+a.top-top; }
    try{ el.focus({preventScroll:true}); }catch(_){ el.focus(); }
    scrollTo({top:Math.max(0,y),behavior:reduce()?'auto':'smooth'});
  }
  const clearAll=()=>{ Object.keys(NEED).concat(['phone']).forEach(clearErr); summary(); };
  function showErrors(list){ // list: [[field, message], ...]
    Object.keys(NEED).concat(['phone']).forEach(clearErr);
    list.forEach(([n,t])=>setErr(n,t));
    const els=list.map(([n])=>$(n)).filter(Boolean);
    if(more&&els.some(f=>more.contains(f))) more.open=true;
    summary();
    const order=[...form.elements];
    els.sort((a,b)=>order.indexOf(a)-order.indexOf(b));
    reveal(els[0]||alertBox,true);
  }
  function check(q){
    const out=[];
    Object.keys(NEED).forEach(k=>{ if(!String(q[k]).trim()) out.push([k,NEED[k]]); });
    if(q.email.trim()&&!EMAIL_RE.test(q.email.trim())) out.push(['email',BAD.email]);
    if(q.date){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(q.date)) out.push(['date',BAD.datefmt]);
      else if(q.date<minDate()) out.push(['date',BAD.date]);
    }
    return out;
  }
  // clear a field's message as soon as it's fixed
  const recheck=e=>{
    const f=e.target; if(!f.name||f.getAttribute('aria-invalid')!=='true') return;
    const still=check(data()).find(([n])=>n===f.name);
    if(still) setErr(f.name,still[1]); else clearErr(f.name);
    summary();
  };
  form.addEventListener('input',recheck); form.addEventListener('change',recheck);

  function data(){
    const v=n=>$(n)?$(n).value:'';
    return {
      name:v('name'), email:v('email'), phone:v('phone'),
      event:v('event'), date:v('date'), city:v('city'),
      guests:v('guests'), hours:v('hours'),
      services:[...form.querySelectorAll('input[name="services"]:checked')].map(i=>i.value),
      pay:v('pay'), notes:v('notes'), website:v('website'),
      page:location.pathname
    };
  }
  function say(t,cls){ msg.textContent=t; msg.className='quote__msg'+(cls?' '+cls:''); }
  function mailto(q,id){
    const lines=[
      'Event: '+q.event, 'Date: '+q.date, 'City / venue: '+q.city, 'Guests: '+q.guests,
      q.hours?'Hours: '+q.hours:'', q.services.length?'Interested in: '+q.services.join(', '):'',
      q.pay?'Who pays: '+q.pay:'', '', 'Name: '+q.name, 'Email: '+q.email, q.phone?'Phone: '+q.phone:'',
      q.notes?'\nNotes: '+q.notes:'', id?'\nRequest ID: '+id:''
    ].join('\n').replace(/\n{3,}/g,'\n\n');
    return 'mailto:'+EMAIL+'?subject='+encodeURIComponent((id?'Quote request '+id+': ':'Event quote: ')+q.event+' on '+q.date+' ('+q.city+')')+'&body='+encodeURIComponent(lines);
  }
  function fmtDate(s){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if(!m) return s;
    try{ return new Date(+m[1],m[2]-1,+m[3]).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'}); }catch(_){ return s; }
  }

  /* ---------- outcome boxes ---------- */
  function clearFail(){ const f=form.querySelector('.quote__fail'); if(f) f.remove(); }
  function fail(kind,q){
    clearFail();
    const box=document.createElement('div');
    box.className='quote__fail'+(kind==='dup'?' quote__fail--calm':''); box.setAttribute('role','alert'); box.tabIndex=-1;
    box.innerHTML=kind==='dup'
      ? '<p><strong>Looks like we already have your request.</strong> We’ll reply within one business day. Need to add or change something? Email it to us instead.</p>'+
        '<div class="quote__fail-act"><a class="btn btn--ghost" href="'+esc(mailto(q))+'">Email it instead</a></div>'
      : '<p><strong>We couldn’t send that just now.</strong> Your details are still filled in. Try again in a moment, or send them by email.</p>'+
        '<div class="quote__fail-act"><button class="btn btn--solid" type="button" data-retry>Try again</button><a class="btn btn--ghost" href="'+esc(mailto(q))+'">Email it instead</a></div>';
    form.querySelector('.quote__foot').insertAdjacentElement('afterend',box);
    const r=box.querySelector('[data-retry]'); if(r) r.addEventListener('click',submit);
    reveal(box,false);
  }
  function done(q,id){
    const first=(q.name.trim().split(/\s+/)[0]||'');
    const ev=/^something else$/i.test(q.event)?'event':q.event.toLowerCase();
    const note=q.notes.trim().length>180?q.notes.trim().slice(0,180)+'…':q.notes.trim();
    const rows=[['Event',q.event],['Date',fmtDate(q.date)],['Where',q.city],['Guests',q.guests],['How long',q.hours],
      ['Interested in',q.services.join(', ')],['Who pays',q.pay],['Reply to',q.email.trim()+(q.phone.trim()?' · '+q.phone.trim():'')],['Notes',note]]
      .filter(r=>String(r[1]||'').trim());
    form.innerHTML='<div class="quote__done" role="status" tabindex="-1"><h3>Got it'+(first?', '+esc(first):'')+'</h3>'+
      '<p>We’ll reply within one business day with availability and a price for your '+esc(ev)+'. Keep an eye on '+esc(q.email.trim())+'.</p>'+
      (id?'<p class="quote__id">Request ID <strong>'+esc(id)+'</strong></p>':'')+
      '<dl class="quote__sum">'+rows.map(r=>'<div><dt>'+r[0]+'</dt><dd>'+esc(r[1])+'</dd></div>').join('')+'</dl>'+
      '<p>Need to change something, or need it sooner? Email <a href="'+esc(mailto(q,id))+'">'+EMAIL+'</a>'+(id?' and mention your request ID':'')+'.</p></div>';
    const box=form.querySelector('.quote__done'); box&&reveal(box,false);
    try{ window.dispatchEvent(new CustomEvent('tb:quote',{detail:{event:q.event,via:'api'}})); }catch(e){}
  }

  /* ---------- send: 9s timeout, one automatic retry on network error / timeout ---------- */
  async function post(q){
    for(let attempt=0;;attempt++){
      const ctrl='AbortController'in window?new AbortController():null; let tm;
      try{
        const r=await Promise.race([
          fetch(API+'/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q),signal:ctrl?ctrl.signal:undefined}),
          new Promise((_,no)=>{ tm=setTimeout(()=>{ ctrl&&ctrl.abort(); no(new Error('timeout')); },9000); })
        ]);
        clearTimeout(tm);
        const j=await r.json().catch(()=>({}));
        return {status:r.status,ok:r.ok,j};
      }catch(err){
        clearTimeout(tm);
        if(attempt>=1) return {status:0,ok:false,j:{}};
        go.textContent='Still sending…';
        await new Promise(z=>setTimeout(z,700));
      }
    }
  }
  let busy=false;
  async function submit(e){
    if(e&&e.preventDefault) e.preventDefault();
    if(busy) return;
    const q=data();
    const errs=check(q);
    if(errs.length){ clearFail(); say(''); showErrors(errs); return; }
    clearAll(); clearFail();
    busy=true; go.disabled=true; go.textContent='Sending…'; say('');
    const r=await post(q);
    busy=false; go.disabled=false; go.textContent=GO;
    if(r.ok){ done(q,r.j&&r.j.id); return; }
    if(r.status===400&&r.j&&Array.isArray(r.j.fields)&&r.j.fields.some(f=>$(f))){
      showErrors(r.j.fields.filter(f=>$(f)).map(f=>[f, f==='email'&&r.j.error==='bad-email'?BAD.email:f==='date'&&r.j.error==='bad-date'?BAD.datefmt:(NEED[f]||'Check this one.')]));
      return;
    }
    fail(r.status===429?'dup':'down',q);
  }
  form.addEventListener('submit',submit);

  /* ---------- phones: sticky booking bar only once the hero "Get a Quote" has scrolled away,
     and hidden again while the form itself is on screen ---------- */
  if(bar){
    if('IntersectionObserver'in window){
      document.body.classList.add('has-bookbar');
      const cta=document.querySelector('.cat-hero .actions .btn--solid')||document.querySelector('.cat-hero');
      const st={hero:!!cta,quote:false};
      const upd=()=>bar.classList.toggle('is-hidden',st.hero||st.quote);
      upd();
      if(cta) new IntersectionObserver(es=>{ es.forEach(en=>st.hero=en.isIntersecting); upd(); },
        {rootMargin:'-'+Math.round(nav?nav.getBoundingClientRect().height:0)+'px 0px 0px 0px'}).observe(cta);
      new IntersectionObserver(es=>{ es.forEach(en=>st.quote=en.isIntersecting); upd(); },{threshold:.05}).observe(document.getElementById('quote'));
    } else bar.classList.remove('is-hidden');
  }
})();
